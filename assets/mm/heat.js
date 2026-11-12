/* entekhab.net — the market map: heatmap (coin360-style), drawn on one canvas.
   Size of a tile = the chosen measure (market cap, √market cap, volume, size of the move, money flow or equal);
   colour = the change over the chosen timeframe on that timeframe's scale (legend under the map). Tiles are grouped by
   sector (squarified treemap, Bruls–Huizing–van Wijk 2000); a sector's header shows its market-cap-weighted change.
   Tap a tile for the coin panel, a header to zoom into the sector. 3D: space3d.js builds a city from the same layout. */
(function () {
  'use strict';
  var MM = window.MM, d = document, S = MM.S, D = MM.D, T = MM.T;
  var V = MM.views.heatmap = {};
  var st = null;

  /* ---------------------------------------------------------------- squarified treemap */
  function worst(row, side, sum) {
    var mx = 0, mn = Infinity;
    for (var i = 0; i < row.length; i++) { var a = row[i].a; if (a > mx) mx = a; if (a < mn) mn = a; }
    var s2 = sum * sum, w2 = side * side;
    return Math.max(w2 * mx / s2, s2 / (w2 * mn));
  }
  function squarify(items, x, y, w, h) {
    var out = [], tot = 0, i;
    for (i = 0; i < items.length; i++) tot += items[i].v;
    if (!(tot > 0) || w <= 0 || h <= 0) return out;
    var k = w * h / tot, q = items.map(function (it) { return { it: it, a: it.v * k }; });
    var row = [], sum = 0;
    function place() {
      if (!row.length) return;
      if (w >= h) {
        var cw = sum / h, yy = y;
        row.forEach(function (r) { var rh = r.a / cw; out.push({ x: x, y: yy, w: cw, h: rh, it: r.it }); yy += rh; });
        x += cw; w -= cw;
      } else {
        var chh = sum / w, xx = x;
        row.forEach(function (r) { var rw = r.a / chh; out.push({ x: xx, y: y, w: rw, h: chh, it: r.it }); xx += rw; });
        y += chh; h -= chh;
      }
      row = []; sum = 0;
    }
    for (i = 0; i < q.length; i++) {
      var side = Math.min(w, h), nr = row.concat([q[i]]), ns = sum + q[i].a;
      if (!row.length || worst(nr, side, ns) <= worst(row, side, sum)) { row = nr; sum = ns; }
      else { place(); row = [q[i]]; sum = q[i].a; }
    }
    place();
    return out;
  }
  V.squarify = squarify;

  /* ---------------------------------------------------------------- measure */
  function measure(c, key, tf) {
    if (key === 'mc') return c.mc || 0;
    if (key === 'mcs') return Math.sqrt(c.mc || 0);
    if (key === 'v') return c.v || 0;
    if (key === 'eq') return 1;
    if (key === 'ch') { var v = c.ch[tf]; return (v == null ? 0 : Math.abs(v)) + MM.SAT[tf] * 0.04; }
    if (key === 'fl') { var f = flowOf(c, tf); return (f == null ? 0 : Math.abs(f)) + 1; }
    return c.mc || 0;
  }
  function flowOf(c, tf) { var F = D.flow && D.flow.f && D.flow.f[c.s]; var x = F && F[tf]; return x ? x[0] : null; }
  V.flowOf = flowOf;
  function wavg(list, tf) {
    var s = 0, m = 0;
    list.forEach(function (c) { var v = c.ch[tf]; if (v != null && c.sec !== 'stable') { s += (c.mc || 0) * v; m += c.mc || 0; } });
    return m ? s / m : null;
  }

  /* the full layout for a w × h area: [{c, x, y, w, h}] tiles and [{k, x, y, w, h, hd, ch, mc, n}] sector blocks */
  function layout(w, h) {
    var key = S.size.heatmap || 'mc', tf = S.tf, top = S.top.heatmap || 100;
    var coins = MM.pick('heatmap', { top: top });
    if (st.zoom) coins = coins.filter(function (c) { return c.sec === st.zoom; });
    var tiles = [], blocks = [], HD = w < 520 ? 16 : 19, G = 2;
    if (!coins.length) return { tiles: tiles, blocks: blocks };
    if (S.group === false || st.zoom) {
      var its = coins.map(function (c) { return { c: c, v: measure(c, key, tf) }; }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; });
      var hd0 = st.zoom ? HD + 4 : 0;
      if (st.zoom) blocks.push({ k: st.zoom, x: 0, y: 0, w: w, h: h, hd: hd0, ch: wavg(coins, tf), mc: coins.reduce(function (s, c) { return s + (c.mc || 0); }, 0), n: coins.length, zoom: 1 });
      squarify(its, 0, hd0, w, h - hd0).forEach(function (r) { tiles.push({ c: r.it.c, x: r.x, y: r.y, w: r.w, h: r.h }); });
      return { tiles: tiles, blocks: blocks };
    }
    var groups = {};
    coins.forEach(function (c) { (groups[c.sec] = groups[c.sec] || []).push(c); });
    var gl = Object.keys(groups).map(function (k) {
      var items = groups[k].map(function (c) { return { c: c, v: measure(c, key, tf) }; }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; });
      return { k: k, items: items, v: items.reduce(function (s, x) { return s + x.v; }, 0) };
    }).filter(function (g) { return g.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    squarify(gl, 0, 0, w, h).forEach(function (r) {
      var g = r.it, hd = r.w > 64 && r.h > HD * 2.4 ? HD : 0;
      var bx = r.x + G / 2, by = r.y + G / 2, bw = Math.max(0, r.w - G), bh = Math.max(0, r.h - G);
      blocks.push({ k: g.k, x: bx, y: by, w: bw, h: bh, hd: hd, ch: wavg(groups[g.k], tf), mc: groups[g.k].reduce(function (s, c) { return s + (c.mc || 0); }, 0), n: groups[g.k].length });
      squarify(g.items, bx, by + hd, bw, bh - hd).forEach(function (t) { tiles.push({ c: t.it.c, x: t.x, y: t.y, w: t.w, h: t.h }); });
    });
    return { tiles: tiles, blocks: blocks };
  }
  V.layout = function (w, h) { return layout(w, h); };

  /* ---------------------------------------------------------------- drawing */
  function shade(c, k) { return [MM.clamp(c[0] * k, 0, 255), MM.clamp(c[1] * k, 0, 255), MM.clamp(c[2] * k, 0, 255)]; }
  function lighten(c, a) { return [c[0] + (255 - c[0]) * a, c[1] + (255 - c[1]) * a, c[2] + (255 - c[2]) * a]; }
  function fitText(x, s, max, font, size) {
    x.font = font.replace('%', size); var tw = x.measureText(s).width;
    return tw <= max ? size : Math.max(7, Math.floor(size * max / tw));
  }
  var F_SYM = '700 %px "Space Grotesk",Vazirmatn,sans-serif', F_NUM = '600 %px "Space Grotesk",Vazirmatn,sans-serif', F_TXT = '700 %px Vazirmatn,"Space Grotesk",sans-serif';

  function drawTile(x, t, col, now) {
    var c = t.c, X = t.x + 0.5, Y = t.y + 0.5, W = t.w - 1, H = t.h - 1;
    if (W <= 0.5 || H <= 0.5) return;
    var g = x.createLinearGradient(0, Y, 0, Y + H);
    g.addColorStop(0, MM.css(lighten(col, 0.10)));
    g.addColorStop(0.55, MM.css(col));
    g.addColorStop(1, MM.css(shade(col, 0.82)));
    x.fillStyle = g; x.fillRect(X, Y, W, H);
    if (W > 6 && H > 6) {
      x.fillStyle = 'rgba(255,255,255,.09)'; x.fillRect(X, Y, W, 1);
      x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(X, Y + H - 1, W, 1);
    }
    /* contents by tile size */
    var tf = S.tf, ch = c.ch[tf], m = Math.min(W, H);
    if (W < 22 || H < 13) return;
    var cx = X + W / 2;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr';
    x.fillStyle = '#fff';
    x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 3; x.shadowOffsetY = 1;
    if (W < 46 || H < 34) {
      var fs0 = fitText(x, c.s, W - 4, F_SYM, MM.clamp(Math.min(W / 3.2, H / 1.8), 8, 13));
      x.font = F_SYM.replace('%', fs0); x.fillText(c.s, cx, Y + H / 2 + 0.5);
      x.shadowBlur = 0; x.shadowOffsetY = 0;
      return;
    }
    var fs = MM.clamp(Math.min(W / 4.4, H / 3.6), 10, 76);
    fs = fitText(x, c.s, W * 0.86, F_SYM, fs);
    var fp = MM.clamp(fs * 0.42, 9, 26), fc = MM.clamp(fs * 0.48, 9, 30);
    var lg = MM.clamp(m * 0.26, 12, 48);
    var showLogo = H > 52 && W > 52, showP = H > fs + fc + fp + 18, showC = true;
    var hh = (showLogo ? lg + fs * 0.25 : 0) + fs + (showP ? fp * 1.25 : 0) + (showC ? fc * 1.3 : 0);
    if (hh > H - 6) { showP = false; hh = (showLogo ? lg + fs * 0.25 : 0) + fs + fc * 1.3; }
    if (hh > H - 6) { showLogo = false; hh = fs + fc * 1.3; }
    if (hh > H - 4) { showC = false; hh = fs; }
    var yy = Y + (H - hh) / 2;
    if (showLogo) {
      x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 6; x.shadowOffsetY = 2;
      MM.drawLogo(x, c.s, cx, yy + lg / 2, lg);
      x.shadowBlur = 3; x.shadowOffsetY = 1; x.shadowColor = 'rgba(0,0,0,.45)';
      yy += lg + fs * 0.25;
    }
    x.font = F_SYM.replace('%', fs); x.fillText(c.s, cx, yy + fs / 2 + 1); yy += fs;
    if (showP) { x.font = F_NUM.replace('%', fp); x.fillStyle = 'rgba(255,255,255,.88)'; x.fillText(MM.fmtP(c.p), cx, yy + fp * 0.62 + 1); yy += fp * 1.25; }
    if (showC) { x.font = F_NUM.replace('%', fc); x.fillStyle = '#fff'; x.fillText(MM.fmtPct(ch), cx, yy + fc * 0.65 + 1); }
    x.shadowBlur = 0; x.shadowOffsetY = 0;
    /* a big tile also gets the market cap in a corner */
    if (W > 190 && H > 150) {
      x.font = F_NUM.replace('%', MM.clamp(fs * 0.24, 9, 15)); x.fillStyle = 'rgba(255,255,255,.62)'; x.textAlign = 'left'; x.textBaseline = 'top';
      x.fillText(MM.fmtUsd(c.mc), X + 7, Y + 6);
      x.textAlign = 'right'; x.fillText('#' + c.rk, X + W - 7, Y + 6);
    }
  }
  function drawBlock(x, b) {
    x.fillStyle = '#121317'; x.fillRect(b.x, b.y, b.w, b.h);
    if (!b.hd) return;
    var hd = b.hd, col = MM.SECC[b.k] || '#999';
    var g = x.createLinearGradient(0, b.y, 0, b.y + hd);
    g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(255,255,255,.02)');
    x.fillStyle = g; x.fillRect(b.x, b.y, b.w, hd);
    x.fillStyle = col; x.fillRect(b.x, b.y, b.w, 2);
    var rtl = MM.rtl(), pad = 7, fs = hd >= 19 ? 11.5 : 10.5;
    x.textBaseline = 'middle'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left';
    var name = (b.zoom ? '← ' : '') + MM.secName(b.k), chs = MM.fmtPct(b.ch), right = rtl ? b.x + b.w - pad : b.x + pad;
    x.font = F_TXT.replace('%', fs); x.fillStyle = '#ecebe6';
    var nw = x.measureText(name).width;
    x.font = F_NUM.replace('%', fs); var cw = x.measureText(chs).width;
    var room = b.w - pad * 2;
    if (nw + cw + 10 > room) { x.font = F_TXT.replace('%', fs); var s2 = name; while (s2.length > 3 && x.measureText(s2 + '…').width + cw + 10 > room) s2 = s2.slice(0, -1); name = s2 === name ? name : s2 + '…'; }
    x.font = F_TXT.replace('%', fs); x.fillStyle = '#ecebe6'; x.fillText(name, right, b.y + hd / 2 + 1);
    nw = x.measureText(name).width;
    if (nw + cw + 10 <= room) {
      x.font = F_NUM.replace('%', fs); x.direction = 'ltr';
      x.fillStyle = b.ch == null ? '#9a9a94' : b.ch > 0 ? MM.upc() : b.ch < 0 ? MM.dnc() : '#cfcfca';
      x.textAlign = rtl ? 'left' : 'right'; x.fillText(chs, rtl ? b.x + pad : b.x + b.w - pad, b.y + hd / 2 + 1);
      if (b.w > 260) { x.fillStyle = 'rgba(236,235,230,.5)'; x.fillText(MM.fmtUsd(b.mc), rtl ? b.x + pad + cw + 10 : b.x + b.w - pad - cw - 10, b.y + hd / 2 + 1); }
    }
  }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function render(now) {
    st.raf = 0;
    var cv = st.cv, x = st.x, dpr = st.dpr, W = st.w, H = st.h;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, W, H);
    var L = st.L, k = st.anim ? ease(MM.clamp((now - st.anim.t0) / st.anim.ms, 0, 1)) : 1, busy = k < 1;
    L.blocks.forEach(function (b) { drawBlock(x, b); });
    var hov = null, q = MM.q, any = false;
    L.tiles.forEach(function (t) {
      var r = t, from = st.anim && st.anim.from[t.c.s];
      if (from && k < 1) r = { c: t.c, x: from.x + (t.x - from.x) * k, y: from.y + (t.y - from.y) * k, w: from.w + (t.w - from.w) * k, h: from.h + (t.h - from.h) * k };
      else if (!from && k < 1) { var s = 0.4 + 0.6 * k; r = { c: t.c, x: t.x + t.w * (1 - s) / 2, y: t.y + t.h * (1 - s) / 2, w: t.w * s, h: t.h * s }; }
      var want = MM.rgb(t.c.ch[S.tf]), have = st.col[t.c.s];
      if (!have) have = st.col[t.c.s] = want.slice();
      else { var dd = 0; for (var i = 0; i < 3; i++) { var dv = want[i] - have[i]; have[i] += dv * 0.16; dd += Math.abs(dv); } if (dd > 1.5) busy = true; else { have[0] = want[0]; have[1] = want[1]; have[2] = want[2]; } }
      drawTile(x, r, have, now);
      t.r = r;
      if (st.hover === t.c.s) hov = r;
      var fl = t.c.fl ? Date.now() - t.c.fl : null;
      if (fl != null && fl < 1400 && r.w > 8 && r.h > 8) {
        var a = 1 - fl / 1400; x.strokeStyle = MM.css(t.c.fx > 0 ? [52, 211, 153] : [255, 90, 77], a * 0.9); x.lineWidth = 2;
        x.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3); busy = true;
      }
      if (q) { any = true; if (t.c.s.indexOf(q) !== 0 && t.c.n.toUpperCase().indexOf(q) !== 0) { x.fillStyle = 'rgba(8,8,10,.62)'; x.fillRect(r.x, r.y, r.w, r.h); } else { x.strokeStyle = '#f7931a'; x.lineWidth = 2.5; x.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3); } }
    });
    if (hov) {
      x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(hov.x, hov.y, hov.w, hov.h);
      x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 2; x.strokeRect(hov.x + 1, hov.y + 1, hov.w - 2, hov.h - 2);
    }
    if (!L.tiles.length) {
      x.fillStyle = '#9a9a94'; x.font = '600 14px Vazirmatn,sans-serif'; x.textAlign = 'center'; x.direction = MM.rtl() ? 'rtl' : 'ltr';
      x.fillText(T(D.ok ? 'empty' : 'loading'), W / 2, H / 2);
    }
    if (st.anim && k >= 1) st.anim = null;
    if (busy) st.raf = requestAnimationFrame(render);
  }
  function kick() { if (st && !st.raf && !st.d3) st.raf = requestAnimationFrame(render); }

  /* ---------------------------------------------------------------- relayout with a short morph */
  function relayout(animate) {
    if (!st) return;
    var old = {};
    (st.L ? st.L.tiles : []).forEach(function (t) { var r = t.r || t; old[t.c.s] = { x: r.x, y: r.y, w: r.w, h: r.h }; });
    st.L = layout(st.w, st.h);
    st.anim = animate && Object.keys(old).length ? { t0: performance.now(), ms: 520, from: old } : null;
    if (st.d3 && MM.space3d) MM.space3d.update(st.L, 'layout');
    kick();
  }
  function size() {
    if (!st) return;
    var r = st.box.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = Math.max(200, Math.floor(r.width)), h = Math.max(240, Math.floor(r.height));
    if (w === st.w && h === st.h && dpr === st.dpr) return false;
    st.w = w; st.h = h; st.dpr = dpr;
    st.cv.width = Math.round(w * dpr); st.cv.height = Math.round(h * dpr);
    st.cv.style.width = w + 'px'; st.cv.style.height = h + 'px';
    return true;
  }

  /* ---------------------------------------------------------------- pointer */
  function hit(px, py) {
    var L = st.L; if (!L) return null;
    for (var i = L.blocks.length - 1; i >= 0; i--) { var b = L.blocks[i]; if (b.hd && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.hd) return { b: b }; }
    for (i = 0; i < L.tiles.length; i++) { var t = L.tiles[i], r = t.r || t; if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return { t: t }; }
    return null;
  }
  function secTip(b) {
    var tf = S.tf, list = MM.pick('heatmap', { top: S.top.heatmap || 100 }).filter(function (c) { return c.sec === b.k && c.ch[tf] != null; });
    list.sort(function (a, c) { return c.ch[tf] - a.ch[tf]; });
    var row = function (c) { return '<span>' + MM.logo(c.s, 16) + '<b>' + MM.esc(c.s) + '</b><i class="mm-n ' + MM.cls(c.ch[tf]) + '">' + MM.fmtPct(c.ch[tf]) + '</i></span>'; };
    return '<div class="mm-th"><i class="mm-sdot" style="background:' + MM.SECC[b.k] + '"></i><div><b>' + MM.esc(MM.secName(b.k)) + '</b><small>' + MM.esc(T('sec_n', { n: MM.loc(b.n) })) + '</small></div>' +
      '<div class="mm-tp"><b class="mm-n">' + MM.fmtUsd(b.mc) + '</b><small class="mm-n ' + MM.cls(b.ch) + '">' + MM.fmtPct(b.ch) + '</small></div></div>' +
      (list.length ? '<div class="mm-tmv"><div><small>' + MM.esc(T('best')) + '</small>' + list.slice(0, 3).map(row).join('') + '</div><div><small>' + MM.esc(T('worst')) + '</small>' + list.slice(-3).reverse().map(row).join('') + '</div></div>' : '') +
      '<p class="mm-thint">' + MM.esc(T(b.zoom ? 'sec_out' : 'sec_in')) + '</p>';
  }
  function wire() {
    var cv = st.cv, touch = false;
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = cv.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top);
      var key = h ? (h.t ? h.t.c.s : 'sec:' + h.b.k) : null;
      cv.style.cursor = h ? 'pointer' : 'default';
      if (key !== st.hover) { st.hover = h && h.t ? h.t.c.s : null; kick(); }
      if (h && h.t) MM.tip(MM.coinTip(h.t.c), e.clientX, e.clientY);
      else if (h && h.b) MM.tip(secTip(h.b), e.clientX, e.clientY);
      else MM.tip(null);
    });
    cv.addEventListener('pointerleave', function () { st.hover = null; MM.tip(null); kick(); });
    cv.addEventListener('pointerdown', function (e) { touch = e.pointerType === 'touch'; });
    cv.addEventListener('click', function (e) {
      var r = cv.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top);
      MM.tip(null);
      if (!h) return;
      if (h.b) { st.zoom = h.b.zoom ? null : h.b.k; relayout(true); return; }
      MM.openCoin(h.t.c.s);
    });
    cv.addEventListener('dblclick', function () { if (st.zoom) { st.zoom = null; relayout(true); } });
    st.onKey = function (e) { if (e.key === 'Escape' && st.zoom && !d.querySelector('.mm-panel.on')) { st.zoom = null; relayout(true); } };
    d.addEventListener('keydown', st.onKey);
    st.ro = new ResizeObserver(MM.debounce(function () { if (!st) return; if (size()) relayout(false); if (st.d3 && MM.space3d) MM.space3d.resize(); }, 60));
    st.ro.observe(st.box);
  }

  /* ---------------------------------------------------------------- view API */
  V.mount = function (stage) {
    st = { box: null, cv: null, x: null, w: 0, h: 0, dpr: 1, L: { tiles: [], blocks: [] }, col: {}, hover: null, zoom: MM.pendingZoom || null, raf: 0, d3: false };
    MM.pendingZoom = null;      /* the money-flow page opens a sector straight into the heatmap */
    st.box = MM.h('<div class="mm-canvas"><canvas role="img" aria-label="' + MM.esc(T('title_heatmap')) + '"></canvas></div>');
    stage.appendChild(st.box);
    st.cv = st.box.querySelector('canvas'); st.x = st.cv.getContext('2d', { alpha: false });
    size(); wire();
    st.L = layout(st.w, st.h);
    st.onData = function (why) { if (!st) return; if (why === 'snapshot' || why === 'flow' || S.size.heatmap === 'ch' || S.size.heatmap === 'fl' || S.size.heatmap === 'mc' && why === 'live') relayout(why !== 'live'); else kick(); if (st.d3 && MM.space3d) MM.space3d.update(st.L, 'data'); };
    st.onLogos = function () { kick(); if (st.d3 && MM.space3d) MM.space3d.update(st.L, 'logos'); };
    MM.on('data', st.onData); MM.on('logos', st.onLogos); MM.on('palette', st.onLogos); MM.on('watch', st.onData);
    if ((S.size.heatmap || 'mc') === 'fl') MM.loadFlow().then(function () { if (st) relayout(true); }, function () { });
    kick();
    if (S.d3.heatmap) V.set3d(true);
    st.tick = setInterval(function () { if (st && !d.hidden) kick(); }, 1000);
  };
  V.update = function (why) {
    if (!st) return;
    if (why === 'pal') { st.col = {}; kick(); if (st.d3 && MM.space3d) MM.space3d.update(st.L, 'data'); return; }
    relayout(true);
    if (st.d3 && MM.space3d) MM.space3d.update(st.L, why);
  };
  V.find = function () { kick(); if (st && st.d3 && MM.space3d) MM.space3d.find(MM.q); };
  V.resize = function () { if (st && size()) relayout(false); if (st && st.d3 && MM.space3d) MM.space3d.resize(); };
  V.canvas = function () { if (!st) return null; if (st.d3 && MM.space3d) return MM.space3d.snapshot(); render(performance.now()); return st.cv; };
  V.set3d = function (on) {
    if (!st) return;
    if (!on) { st.d3 = false; if (MM.space3d) MM.space3d.stop(); st.cv.hidden = false; kick(); return; }
    st.d3 = true;
    MM.load3d().then(function () {
      if (!st || !st.d3) return;
      st.cv.hidden = true;
      MM.space3d.city(st.box, function () { return st.L; }, { w: st.w, h: st.h });
    }, function (e) {
      st.d3 = false; S.d3.heatmap = false; MM.save(); MM.syncTools(); st.cv.hidden = false; kick();
      MM.toast(T(e && e.message === 'webgl' ? 'no3d' : 'loadErr'), 5000);
    });
  };
  V.debug = function () { return st; };          /* read-only hook for tests/mm_e2e.py */
  V.unmount = function () {
    if (!st) return;
    if (st.raf) cancelAnimationFrame(st.raf);
    clearInterval(st.tick);
    MM.off('data', st.onData); MM.off('logos', st.onLogos); MM.off('palette', st.onLogos); MM.off('watch', st.onData);
    d.removeEventListener('keydown', st.onKey);
    if (st.ro) st.ro.disconnect();
    if (MM.space3d) MM.space3d.stop();
    MM.tip(null);
    st = null;
  };
  /* the 3D engine (three.js r128, self-hosted) is fetched only when 3D is chosen */
  MM.load3d = MM.load3d || function () {
    var ok = (function () { try { var c = d.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; } })();
    if (!ok) return Promise.reject(new Error('webgl'));
    MM.toast(T('loading3d'), 2500);
    return MM.loadScript('/assets/vendor/three/three.min.js').then(function () { return MM.loadScript(MM.asset('space3d.js')); });
  };
})();
