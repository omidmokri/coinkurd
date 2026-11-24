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
  var STOPS = [[0x1e, 0x5b, 0xff], [0x00, 0xd0, 0xff], [0x00, 0xe6, 0x76], [0xff, 0xe0, 0x2e], [0xff, 0x98, 0x00], [0xff, 0x2d, 0x1f]];
  var STEPS = 56, RAMP = [], RAMPF = [];
  (function () {
    for (var i = 0; i < STEPS; i++) {
      var u = i / (STEPS - 1) * (STOPS.length - 1), k = Math.min(STOPS.length - 2, Math.floor(u)), f = u - k, a = STOPS[k], b = STOPS[k + 1];
      var r = Math.round(a[0] + (b[0] - a[0]) * f), g = Math.round(a[1] + (b[1] - a[1]) * f), bl = Math.round(a[2] + (b[2] - a[2]) * f);
      RAMP.push('rgb(' + r + ',' + g + ',' + bl + ')');
      RAMPF.push('rgba(' + r + ',' + g + ',' + bl + ',.5)');                /* the same colour for the part that has not happened yet */
    }
  })();
  /* the colours the cycle overlay reads by: one per halving epoch, fixed, so turning the overlay on and off
     or hiding a cycle never repaints the others. Checked for colour-blind separation against the dark surface. */
  var CYC = { 1: '#c77dff', 2: '#00e0b0', 3: '#4da3ff', 4: '#ffa21a', 5: '#d6d6d0' };
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
  var DEF = { style: 'wave', bucket: 'd', log: true, halv: true, phase: true, ovl: false, live: true };
  var S = (function () {
    var s = OB.store.get('ek_obs_wv', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search);
    if (/^(wave|candle|line)$/.test(q.get('style') || '')) o.style = q.get('style');
    if (/^(d|w|m)$/.test(q.get('bucket') || '')) o.bucket = q.get('bucket');
    if (q.get('ovl') === '1') o.ovl = true;
    return o;
  })();
  var save = OB.debounce(function () { OB.store.set('ek_obs_wv', S); }, 300);
  var V = { el: null, ts: null, D: null, seq: 0, lastStyle: null, ws: null, bws: null, live: null, liveAt: 0, redraw: 0 };

  function tile(label, value, sub, cls, id) { return '<div class="ob-tile"><small>' + esc(label) + '</small><b class="ob-n' + (cls ? ' ' + cls : '') + '"' + (id ? ' id="' + id + '"' : '') + '>' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; }
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
    skeleton(true);
    status('');
    Promise.all([OB.getJSON('/data/obs/chain_btc.json' + (force ? '?r=' + Date.now() : ''), 20000), tip()]).then(function (r) {
      if (seq !== V.seq) return;
      var j = r[0], tp = r[1];
      A = anchors(tp.h, tp.t);
      var col = j.cols && j.cols.price; if (!col || !col.v || !col.v.length) throw new Error('no price');
      var t0 = Date.parse(j.t0 + 'T00:00:00Z'), off = col.o || 0, days = [];
      for (var i = 0; i < col.v.length; i++) { var v = col.v[i]; if (v != null && isFinite(v) && v > 0) days.push([t0 + (off + i) * DAY, v]); }
      V.D = { days: days, tip: tp, updated: j.updated_at || '' };
      skeleton(false); status('');
      render();
      liveOn();
    }, function (e) {
      if (seq !== V.seq) return;
      if (w.console) console.error(e);
      skeleton(false);
      status('<b>' + esc(T('err_file')) + '</b><br><span>' + esc(T('err_file_d')) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
    });
  }

  /* ---------------------------------------------------------------- the series */
  function build() {
    var D = V.D, B = BUCKET[S.bucket], tipH = D.tip.h;
    /* the series is one close a day, so a bar opens where the one before it closed — the usual way to candle a
       close-only series. Without that a daily bar would have open = close and no body at all, just a dot. */
    var rows = [], cur = null, prev = null;
    for (var i = 0; i < D.days.length; i++) {
      var h = heightAt(D.days[i][0]), p = D.days[i][1], k = Math.floor(h / B) * B;
      if (!cur || cur[0] !== k) {
        var o = prev == null ? p : prev;
        cur = [k, o, Math.max(o, p), Math.min(o, p), p]; rows.push(cur); prev = p;
      } else {
        if (p > cur[2]) cur[2] = p; if (p < cur[3]) cur[3] = p; cur[4] = p; prev = p;
      }
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
    if (V.live != null && rows.length) {                      /* the bar in progress follows the live price */
      var L = rows[rows.length - 1];
      L[4] = V.live; if (V.live > L[2]) L[2] = V.live; if (V.live < L[3]) L[3] = V.live;
    }
    var halv = [];
    for (var k2 = Math.max(0, h0); k2 <= endH + HALVING; k2 += HALVING) halv.push(k2);
    return { rows: rows, pcol: pcol, idx: idx, icol: icol, bands: bands, halv: halv, endH: endH, tipH: tipH };
  }

  /* the cycles laid over one another: x is blocks since that cycle's halving, y the price as a multiple of
     the price at that halving. The first epoch (2009–2012) has no price at its own halving — the series only
     begins in July 2010 — so it is not drawn; the about text says so. */
  function overlay() {
    var D = V.D, B = BUCKET[S.bucket], tipH = D.tip.h, by = {};
    for (var i = 0; i < D.days.length; i++) {
      var h = heightAt(D.days[i][0]), e = Math.floor(h / HALVING), u = Math.floor((h - e * HALVING) / B) * B;
      var m = by[e] || (by[e] = {});
      if (m[u] == null) m[u] = D.days[i][1];                 /* the first price in the bucket, so a cycle's base is its halving */
      m[u + 0.5] = D.days[i][1];                             /* …and the last, kept apart, for the close */
    }
    var series = [], cycles = [];
    Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).forEach(function (e) {
      var m = by[e], us = Object.keys(m).map(Number).filter(function (x) { return x % 1 === 0; }).sort(function (a, b) { return a - b; });
      if (!us.length || us[0] > 2 * B) return;               /* no price at this cycle's halving: nothing to index against */
      var base = m[us[0]], data = [];
      for (var k = 0; k < us.length; k++) { var c = m[us[k] + 0.5]; data.push([us[k], c / base]); }
      var cur = e === Math.floor(tipH / HALVING);
      if (cur && V.live != null && data.length) data[data.length - 1] = [data[data.length - 1][0], V.live / base];
      cycles.push({ e: e, cur: cur, color: CYC[e] || CYC[5], base: base });
      series.push({ name: T('wv_cyc', { y: String(new Date(dateAt(e * HALVING)).getUTCFullYear()) }) + (cur ? ' · ' + T('wv_now') : ''),
        type: 'line', color: CYC[e] || CYC[5], width: cur ? 2.4 : 1.5, data: data,
        fmt: function (v) { return OB.loc('×' + (v >= 10 ? v.toFixed(0) : v.toFixed(2))); } });
    });
    var idx = [], icol = [], uNow = tipH - Math.floor(tipH / HALVING) * HALVING;
    for (var u2 = 0; u2 <= HALVING; u2 += B) { var vv = wwi(u2); idx.push([u2, vv]); icol.push(hue(vv, false)); }
    if (idx[idx.length - 1][0] < HALVING) { idx.push([HALVING, wwi(HALVING)]); icol.push(hue(wwi(HALVING), false)); }   /* close the cycle exactly on the next halving */
    var bands = [{ x0: 0, x1: BULL - HALF, bull: true }, { x0: BULL - HALF, x1: BULL - HALF + BEAR, bull: false }, { x0: HALVING - HALF, x1: HALVING, bull: true }];
    return { series: series, cycles: cycles, idx: idx, icol: icol, bands: bands, uNow: uNow, tipH: tipH, ovl: true };
  }

  function renderOvl() {
    var G = V.G = overlay(), tipH = G.tipH, now = wwi(tipH), bull = isBull(tipH);
    var cur = G.cycles.filter(function (c) { return c.cur; })[0];
    var last = V.live != null ? V.live : null, mult = cur && last != null ? last / cur.base : null;
    $('#ob-tiles', V.el).innerHTML =
      tile(T('wv_t_h'), num(tipH), esc(V.D.tip.live ? T('wv_h_live') : T('wv_h_est'))) +
      tile(T('wv_t_idx'), OB.loc(now.toFixed(3)), esc(T(bull ? 'wv_bull' : 'wv_bear')), bull ? 'up' : 'dn') +
      tile(T('wv_t_since'), num(G.uNow), esc(T('wv_since_sub'))) +
      tile(T('wv_t_cycles'), OB.loc(String(G.cycles.length)), esc(T('wv_cycles_sub'))) +
      tile(T('wv_t_mult'), mult == null ? '—' : OB.loc('×' + mult.toFixed(2)), esc(T('wv_mult_sub')), mult == null ? '' : 'live', 'ob-livepx');

    var vb = [], vl = [];
    if (S.phase) G.bands.forEach(function (b) {
      vb.push({ x0: b.x0, x1: b.x1, color: b.bull ? 'rgba(0,230,118,.15)' : 'rgba(255,45,31,.14)', label: T(b.bull ? 'wv_bull' : 'wv_bear'), ink: b.bull ? 'rgba(0,230,118,.95)' : 'rgba(255,77,64,.95)' });
    });
    if (S.halv) vl.push({ x: 0, color: 'rgba(233,233,228,.4)', label: T('wv_halving'), ink: 'rgba(233,233,228,.55)' });
    vl.push({ x: G.uNow, color: 'rgba(247,147,26,.85)', width: 1.5, label: T('wv_now'), ink: 'rgba(247,147,26,.9)' });

    var keepO = V.lastStyle === 'ovl' && V.ts.v != null; V.lastStyle = 'ovl';
    V.ts.set({
      label: T('aria_wave_ovl'), xmode: 'num', keepView: keepO,
      xfmt: function (x) { return [num(x), '≈ ' + OB.loc((x / 52560).toFixed(1)) + ' ' + T('wv_yr')]; },
      xtip: function (x) { return T('wv_tip_ovl', { h: num(x), y: OB.loc((x / 52560).toFixed(2)) }); },
      panes: [
        { weight: 2.6, log: S.log, title: T('wv_vs_halv'), fmt: function (v) { return OB.loc('×' + (v >= 10 ? v.toFixed(0) : v.toFixed(2))); }, vbands: vb, vlines: vl, series: G.series },
        { weight: 1, min: 0, max: 1, title: T('wv_name'), fmt: function (v) { return OB.loc(v.toFixed(2)); }, vbands: vb, vlines: vl,
          series: [{ name: T('wv_name'), type: 'line', color: '#00e676', width: 2.2, data: G.idx, colors: G.icol, fmt: function (v) { return OB.loc(v.toFixed(3)); } }] }
      ]
    });
    var note = $('#ob-note', V.el); if (note) note.textContent = T('note_wave_ovl');
  }

  /* the same point one, two and three cycles back: the price at h − 210,000·k, with the ≈ date of that block.
     Read off the bars already built, so it follows the step the reader chose. */
  function priceAt(rows, h) {
    var lo = 0, hi = rows.length - 1, r = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (rows[m][0] <= h) { r = m; lo = m + 1; } else hi = m - 1; }
    if (r < 0) return null;
    var B = BUCKET[S.bucket];
    return h - rows[r][0] > B * 3 ? null : rows[r];
  }
  function priorCycles(h) {
    var G = V.G; if (!G || !G.rows) return null;
    var rows = [];
    for (var k = 1; k <= 3; k++) {
      var hk = h - k * HALVING; if (hk < 0) break;
      var r = priceAt(G.rows, hk); if (!r) continue;
      rows.push({ label: T('wv_prior', { k: OB.loc('−' + k), d: dstr(hk) }), value: OB.fmtUsd(r[4], r[4] < 10 ? 2 : 0),
        color: CYC[Math.floor(hk / HALVING)] || CYC[5], x: r[0], y: r[4], pane: 0 });
    }
    return rows.length ? { title: T('wv_prior_t'), rows: rows } : null;
  }

  function render() {
    if (!V.D || !V.ts) return;
    if (S.ovl) return renderOvl();
    var G = V.G = build(), tipH = G.tipH, now = wwi(tipH), bull = isBull(tipH);
    var last = V.live != null ? V.live : (G.rows.length ? G.rows[G.rows.length - 1][4] : null);
    var nextHalv = Math.ceil((tipH + 1) / HALVING) * HALVING;
    var prog = bull ? now : 1 - now;

    $('#ob-tiles', V.el).innerHTML =
      tile(T('wv_t_h'), num(tipH), esc(V.D.tip.live ? T('wv_h_live') : T('wv_h_est'))) +
      tile(T('wv_t_idx'), OB.loc(now.toFixed(3)), esc(T(bull ? 'wv_bull' : 'wv_bear')), bull ? 'up' : 'dn') +
      tile(T('wv_t_prog'), OB.loc(Math.round(prog * 100) + '%'), esc(T(bull ? 'wv_prog_bull' : 'wv_prog_bear'))) +
      tile(T('wv_t_next'), num(nextHalv), '≈ ' + esc(dstr(nextHalv))) +
      tile(T('p_price'), last == null ? '—' : OB.fmtUsd(last, 0), esc(T(V.live != null ? 'wv_px_live' : 'wv_px_day')), V.live != null ? 'live' : '', 'ob-livepx');

    var vb = [], vl = [];
    if (S.phase) G.bands.forEach(function (b) {
      vb.push({ x0: b.x0, x1: b.x1, color: b.bull ? 'rgba(0,230,118,.15)' : 'rgba(255,45,31,.14)', label: T(b.bull ? 'wv_bull' : 'wv_bear'), ink: b.bull ? 'rgba(0,230,118,.95)' : 'rgba(255,77,64,.95)' });
    });
    if (S.halv) G.halv.forEach(function (h) {
      vl.push({ x: h, color: h > tipH ? 'rgba(233,233,228,.22)' : 'rgba(233,233,228,.4)', dash: h > tipH ? [4, 4] : null, label: T('wv_halv_at', { h: num(h) }), ink: 'rgba(233,233,228,.55)' });
    });
    vl.push({ x: tipH, color: 'rgba(247,147,26,.85)', width: 1.5, label: T('wv_now'), ink: 'rgba(247,147,26,.9)' });

    var price = S.style === 'candle'
      ? { name: T('p_price'), type: 'candle', color: INK, up: '#00e676', dn: '#ff2d1f', data: G.rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4]]; }) }
      : { name: T('p_price'), type: 'line', color: '#ffa21a', width: 2, data: G.rows.map(function (r) { return [r[0], r[4]]; }) };
    price.fmt = function (v) { return OB.fmtUsd(v, v < 10 ? 2 : 0); };
    if (S.style === 'wave') price.colors = G.pcol;

    /* a candle drawn over fifteen years is a hairline, so candles open on the last stretch — ⟲ comes back here,
       and zooming out from it still reaches the whole history. Everything else opens on the whole history, and
       any view the reader has zoomed to survives every switch but a change of style. */
    var B = BUCKET[S.bucket], view = S.style === 'candle' ? [tipH - 320 * B, tipH + 14 * B] : null;
    var keep = V.lastStyle === S.style && V.ts.v != null;
    V.lastStyle = S.style;
    V.ts.set({
      label: T('aria_wave'), xmode: 'num', view: view, keepView: keep,
      xfmt: function (x) { return [num(x), '≈ ' + dax(x)]; },
      xtip: function (x) { return T('wv_tip', { h: num(x), d: dstr(x) }); },
      xcross: priorCycles,
      panes: [
        { weight: 2.6, log: S.log, title: T('p_price'), fmt: function (v) { return OB.compact(v); }, vbands: vb, vlines: vl, series: [price] },
        { weight: 1, min: 0, max: 1, title: T('wv_name'), fmt: function (v) { return OB.loc(v.toFixed(2)); }, vbands: vb, vlines: vl,
          series: [{ name: T('wv_name'), type: 'line', color: '#00e676', width: 2.2, data: G.idx, colors: G.icol, fmt: function (v) { return OB.loc(v.toFixed(3)); } }] }
      ]
    });
    var note = $('#ob-note', V.el); if (note) note.textContent = T('note_wave') + (S.style === 'candle' ? ' ' + T('wv_candle_note') : '');
  }

  /* ---------------------------------------------------------------- the skeleton, until the first load lands */
  function skHtml() {
    var t = '';
    for (var i = 0; i < 5; i++) t += '<div class="ob-tile"><small><i class="ob-sk" style="width:' + (52 + i * 7) + '%"></i></small><b class="ob-n"><i class="ob-sk" style="width:' + (62 - i * 4) + '%"></i></b><span><i class="ob-sk" style="width:46%"></i></span></div>';
    return t;
  }
  function skeleton(on) {
    var tl = $('#ob-tiles', V.el), bx = $('.ob-wvbox', V.el);
    if (bx) bx.classList.toggle('sk', !!on);
    if (tl && on && !tl.innerHTML) tl.innerHTML = skHtml();
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

  /* ------------------------------------------------------------- live
     Two streams, both optional and both allowed by the site's CSP: the spot price from Binance's public mirror
     (the tile, and the last bar once every few seconds — redrawing on every tick would be wasteful), and new
     blocks from mempool.space, which move the height, the index and every tile that reads them. */
  function liveOn() {
    if (!S.live || !w.WebSocket) return;
    try {
      V.ws = new WebSocket('wss://data-stream.binance.vision/ws/btcusdt@miniTicker');
      V.ws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        var px = parseFloat(m && m.c); if (!isFinite(px) || px <= 0) return;
        V.live = px; V.liveAt = Date.now(); paintLive();
      };
      V.ws.onerror = function () { try { V.ws.close(); } catch (e) { } };
    } catch (e) { V.ws = null; }
    try {
      V.bws = new WebSocket('wss://mempool.space/api/v1/ws');
      V.bws.onopen = function () { try { V.bws.send(JSON.stringify({ action: 'want', data: ['blocks'] })); } catch (e) { } };
      V.bws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        var b = m && (m.block || (m.blocks && m.blocks[m.blocks.length - 1]));
        var h = b && b.height;
        if (typeof h === 'number' && V.D && h > V.D.tip.h) { V.D.tip = { h: h, live: true, t: Date.now() }; A = anchors(h, Date.now()); render(); }
      };
      V.bws.onerror = function () { try { V.bws.close(); } catch (e) { } };
    } catch (e) { V.bws = null; }
  }
  function liveOff() {
    [V.ws, V.bws].forEach(function (x) { if (x) { x.onmessage = x.onerror = x.onopen = null; try { x.close(); } catch (e) { } } });
    V.ws = V.bws = null;
  }
  /* the tile on every tick, the chart at most once every eight seconds */
  function paintLive() {
    var t = V.el && d.getElementById('ob-livepx'), cur;
    if (t) {
      if (!S.ovl) { t.textContent = OB.fmtUsd(V.live, 0); t.classList.add('live'); }
      else {
        cur = (V.G && V.G.cycles || []).filter(function (c) { return c.cur; })[0];
        if (cur) { t.textContent = OB.loc('×' + (V.live / cur.base).toFixed(2)); t.classList.add('live'); }
      }
    }
    if (Date.now() - V.redraw > 8000) { V.redraw = Date.now(); render(); }
  }

  function mount(el) {
    V.el = el; V.D = null;
    el.innerHTML = '<div class="ob-tools">' +
      '<label class="ob-lbl"><span>' + esc(T('wv_style')) + '</span>' + OB.ui.seg('ob-st', [['wave', T('wv_wave')], ['candle', T('wv_candle')], ['line', T('wv_line')]], S.style) + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('wv_bucket')) + '</span>' + OB.ui.seg('ob-bk', [['d', T('wv_d')], ['w', T('wv_w')], ['m', T('wv_m')]], S.bucket, 'ob-rng') + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('wv_view')) + '</span>' + OB.ui.seg('ob-ov', [['t', T('wv_timeline')], ['o', T('wv_overlay')]], S.ovl ? 'o' : 't') + '</label>' +
      '<button type="button" class="ob-ib ob-gear" id="ob-gear" aria-expanded="false" aria-controls="ob-more" aria-label="' + esc(T('more')) + '" title="' + esc(T('more')) + '">' + OB.icon('gear') + '</button>' +
      '<div class="ob-more" id="ob-more">' +
      '<label class="ob-lbl"><span>' + esc(T('scale')) + '</span>' + OB.ui.seg('ob-sc', [['log', T('sc_log')], ['lin', T('sc_lin')]], S.log ? 'log' : 'lin') + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('wv_halv')) + '</span>' + OB.ui.seg('ob-hv', [['on', T('wv_on')], ['off', T('wv_off')]], S.halv ? 'on' : 'off') + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('wv_phases')) + '</span>' + OB.ui.seg('ob-ph', [['on', T('wv_on')], ['off', T('wv_off')]], S.phase ? 'on' : 'off') + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('wv_live')) + '</span>' + OB.ui.seg('ob-lv', [['on', T('wv_on')], ['off', T('wv_off')]], S.live ? 'on' : 'off') + '</label></div>' +
      OB.ui.acts(true) + '</div><div class="ob-tiles" id="ob-tiles"></div>' +
      '<div class="ob-tsbox ob-wvbox"><div class="ob-ts" id="ob-ts"></div>' + scaleHtml() + '<div class="ob-status" id="ob-status"></div></div>' +
      '<p class="ob-note" id="ob-note"></p>' +
      '<p class="ob-note ob-small" id="ob-credit">' + T('wv_credit') + '</p>';
    V.ts = new OB.TS($('#ob-ts', el));
    styleRow();
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'ob-st' && v !== S.style) { S.style = v; OB.ui.setSeg(el, 'ob-st', v); save(); render(); }
      else if (seg === 'ob-bk' && v !== S.bucket) { S.bucket = v; OB.ui.setSeg(el, 'ob-bk', v); save(); render(); }
      else if (seg === 'ob-sc') { S.log = v === 'log'; OB.ui.setSeg(el, 'ob-sc', v); save(); render(); }
      else if (seg === 'ob-hv') { S.halv = v === 'on'; OB.ui.setSeg(el, 'ob-hv', v); save(); render(); }
      else if (seg === 'ob-ph') { S.phase = v === 'on'; OB.ui.setSeg(el, 'ob-ph', v); save(); render(); }
      else if (seg === 'ob-ov') { S.ovl = v === 'o'; OB.ui.setSeg(el, 'ob-ov', v); styleRow(); save(); render(); }
      else if (seg === 'ob-lv') { S.live = v === 'on'; OB.ui.setSeg(el, 'ob-lv', v); save(); if (S.live) liveOn(); else { liveOff(); V.live = null; render(); } }
      else if (b.id === 'ob-gear') { var op = !$('.ob-tools', el).classList.contains('open'); $('.ob-tools', el).classList.toggle('open', op); b.setAttribute('aria-expanded', op ? 'true' : 'false'); if (V.ts) V.ts.onResize(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.ts && V.D) V.ts.png('BTC · ' + T('wv_name'), T('wv_png_sub'), 'entekhab-block-cycle.png'); }
      else if (b.id === 'ob-share') OB.ui.share(S.ovl ? { bucket: S.bucket, ovl: '1' } : { style: S.style, bucket: S.bucket });
      else if (b.id === 'ob-csv') exportCsv();
    };
    load();
  }
  function styleRow() { var r = V.el && $('#ob-st', V.el); if (r && r.parentNode) r.parentNode.hidden = !!S.ovl; }
  function unmount() { V.seq++; liveOff(); if (V.ts) V.ts.destroy(); V.ts = null; V.D = null; V.G = null; V.live = null; }
  OB.views.wave = { mount: mount, unmount: unmount };
  OB._wv = { wwi: wwi, priorCycles: function (h) { return priorCycles(h); }, paintLive: function () { paintLive(); }, heightAt: function (t) { return heightAt(t); }, dateAt: function (h) { return dateAt(h); }, setA: function (a) { A = a; }, S: S, V: V };
})();
