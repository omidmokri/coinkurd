/* entekhab.net — the market map: bubbles (cryptobubbles-style), a small physics world on one canvas.
   Area of a bubble = the chosen measure (size of the move by default; √market cap, √volume, money flow or equal);
   colour = direction and strength of the move over the chosen timeframe; the glow grows with the move.
   Each bubble is painted once into its own little canvas (a lit sphere: rim light, specular highlight, logo, symbol,
   change) and only re-painted when its size or numbers change, so a hundred bubbles move at 60 fps on a phone.
   Drag and throw bubbles; tap one for the coin panel. 3D: space3d.js floats the same bubbles in space. */
(function () {
  'use strict';
  var MM = window.MM, d = document, S = MM.S, D = MM.D, T = MM.T;
  var V = MM.views.bubbles = {};
  var st = null, RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function metric(c, key, tf) {
    if (key === 'mc') return Math.sqrt(c.mc || 0);
    if (key === 'v') return Math.sqrt(c.v || 0);
    if (key === 'eq') return 1;
    if (key === 'fl') { var F = D.flow && D.flow.f && D.flow.f[c.s], x = F && F[tf]; return (x ? Math.abs(x[0]) : 0) + 1; }
    var v = c.ch[tf]; return (v == null ? 0 : Math.abs(v)) + MM.SAT[tf] * 0.06;
  }
  function coins() {
    var i = S.top.bubbles || 0;
    return MM.pick('bubbles', { range: [i * 100, i * 100 + 100] });
  }
  V.coins = coins;
  /* target radii so the bubbles cover ~half of the area */
  function radii(list) {
    var key = S.size.bubbles || 'ch', tf = S.tf, W = st.w, H = st.h, m = Math.min(W, H);
    var vals = list.map(function (c) { return metric(c, key, tf); }), tot = vals.reduce(function (s, v) { return s + v; }, 0) || 1;
    var fill = (W < 600 ? 0.5 : 0.56) * W * H, rmin = Math.max(7, m * 0.016), rmax = m * (list.length < 25 ? 0.26 : 0.19);
    var out = vals.map(function (v) { return Math.sqrt(fill * v / (Math.PI * tot)); });
    for (var it = 0; it < 3; it++) {      /* re-spread the area the clamped bubbles gave up or took */
      var area = 0, free = 0;
      out = out.map(function (r) { return MM.clamp(r, rmin, rmax); });
      out.forEach(function (r) { area += Math.PI * r * r; if (r > rmin && r < rmax) free += Math.PI * r * r; });
      if (!free) break;
      var k = Math.sqrt(Math.max(0.3, Math.min(3, 1 + (fill - area) / free)));
      out = out.map(function (r) { return r > rmin && r < rmax ? r * k : r; });
    }
    return out.map(function (r) { return MM.clamp(r, rmin, rmax); });
  }

  /* ---------------------------------------------------------------- sprites */
  function lighten(c, a) { return [c[0] + (255 - c[0]) * a, c[1] + (255 - c[1]) * a, c[2] + (255 - c[2]) * a]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  var F = '"Space Grotesk",Vazirmatn,sans-serif';
  function paint(n) {
    var c = n.c, r = Math.max(4, n.r), dpr = st.dpr, tf = S.tf, ch = c.ch[tf];
    var x01 = ch == null ? 0 : MM.clamp(Math.abs(ch) / MM.SAT[tf], 0, 1);
    var col = MM.rgb(ch == null ? null : (ch >= 0 ? 1 : -1) * Math.max(Math.abs(ch), MM.SAT[tf] * 0.35));
    var glow = r * (0.16 + 0.34 * x01) + 3, R = r + glow, sz = Math.ceil(R * 2 * dpr) + 2;
    var cv = n.cv || (n.cv = d.createElement('canvas'));
    if (cv.width !== sz) { cv.width = sz; cv.height = sz; }
    var x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, sz, sz);
    x.setTransform(dpr, 0, 0, dpr, sz / 2, sz / 2);
    /* glow */
    var g = x.createRadialGradient(0, 0, r * 0.85, 0, 0, R);
    g.addColorStop(0, MM.css(col, 0.12 + 0.4 * x01)); g.addColorStop(1, MM.css(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, R, 0, 6.2832); x.fill();
    /* body: a dark glass sphere lit from the upper left, tinted by the move */
    var body = mix([14, 15, 18], col, 0.16 + 0.22 * x01);
    var gb = x.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.08, 0, 0, r);
    gb.addColorStop(0, MM.css(lighten(body, 0.22))); gb.addColorStop(0.55, MM.css(body)); gb.addColorStop(1, MM.css(mix(body, col, 0.35)));
    x.fillStyle = gb; x.beginPath(); x.arc(0, 0, r, 0, 6.2832); x.fill();
    /* rim light */
    x.lineWidth = Math.max(1.4, r * 0.055); x.strokeStyle = MM.css(col, 0.55 + 0.45 * x01);
    x.beginPath(); x.arc(0, 0, r - x.lineWidth / 2, 0, 6.2832); x.stroke();
    /* specular highlight */
    var gs = x.createRadialGradient(-r * 0.36, -r * 0.5, 0, -r * 0.36, -r * 0.5, r * 0.55);
    gs.addColorStop(0, 'rgba(255,255,255,.32)'); gs.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gs; x.beginPath(); x.arc(0, 0, r * 0.96, 0, 6.2832); x.fill();
    /* contents */
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.fillStyle = '#fff';
    var fs = MM.clamp(r * 0.36, 7, 44), fc = MM.clamp(r * 0.27, 7, 30), lg = MM.clamp(r * 0.5, 9, 48);
    if (r >= 22) {
      var showC = r >= 26, hh = lg + fs * 0.95 + (showC ? fc * 1.05 : 0), y0 = -hh / 2;
      x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 4; x.shadowOffsetY = 1;
      MM.drawLogo(x, c.s, 0, y0 + lg / 2, lg);
      x.font = '700 ' + fs + 'px ' + F;
      var sym = c.s; while (sym.length > 2 && x.measureText(sym).width > r * 1.7) sym = sym.slice(0, -1);
      x.fillText(sym, 0, y0 + lg + fs * 0.52);
      if (showC) { x.font = '600 ' + fc + 'px ' + F; x.fillStyle = 'rgba(255,255,255,.92)'; x.fillText(MM.fmtPct(ch), 0, y0 + lg + fs * 0.95 + fc * 0.58); }
    } else if (r >= 11) {
      MM.drawLogo(x, c.s, 0, 0, MM.clamp(r * 1.15, 9, 30));
    } else {
      MM.drawLogo(x, c.s, 0, 0, r * 1.3);
    }
    n.pr = r; n.R = R; n.key = key(n);
  }
  function key(n) { var ch = n.c.ch[S.tf]; return S.tf + '|' + (ch == null ? 'x' : ch.toFixed(2)) + '|' + S.pal + '|' + (MM.A.img ? 1 : 0); }

  /* ---------------------------------------------------------------- the world */
  function sync(animate) {
    var list = coins(), rs = radii(list), keep = {};
    list.forEach(function (c, i) {
      var n = st.nodes[c.s];
      if (!n) {
        n = st.nodes[c.s] = { c: c, x: st.w * (0.08 + Math.random() * 0.84), y: st.h * (0.08 + Math.random() * 0.84), vx: 0, vy: 0, r: animate ? 2 : rs[i], tr: rs[i], a: animate ? 0 : 1 };
      }
      n.c = c; n.tr = rs[i]; n.dead = false; keep[c.s] = 1;
    });
    Object.keys(st.nodes).forEach(function (s) { if (!keep[s]) st.nodes[s].dead = true; });
    st.list = Object.keys(st.nodes).map(function (s) { return st.nodes[s]; });
    st.wake = performance.now();
    if (st.d3 && MM.space3d) MM.space3d.update(st, 'data');
    run();
  }
  function step(dt) {
    var W = st.w, H = st.h, L = st.list, i, j, n, moving = 0, drift = RM ? 0.004 : 0.018;
    for (i = L.length - 1; i >= 0; i--) {
      n = L[i];
      if (n.dead) { n.tr = 0; n.a -= 0.06 * dt; if (n.a <= 0 || n.r < 1) { delete st.nodes[n.c.s]; L.splice(i, 1); continue; } }
      else if (n.a < 1) n.a = Math.min(1, n.a + 0.05 * dt);
      n.r += (n.tr - n.r) * Math.min(1, 0.12 * dt);
      if (n === st.drag) continue;
      /* a faint pull towards the middle, scaled by the stage's own width and height, so the bubbles spread over the
         whole rectangle instead of gathering in a disc */
      n.vx += (Math.random() - 0.5) * drift * dt + (W / 2 - n.x) / W * 0.012 * dt;
      n.vy += (Math.random() - 0.5) * drift * dt + (H / 2 - n.y) / H * 0.012 * dt;
      n.vx *= Math.pow(0.986, dt); n.vy *= Math.pow(0.986, dt);
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < n.r) { n.x = n.r; n.vx = Math.abs(n.vx) * 0.5; } else if (n.x > W - n.r) { n.x = W - n.r; n.vx = -Math.abs(n.vx) * 0.5; }
      if (n.y < n.r) { n.y = n.r; n.vy = Math.abs(n.vy) * 0.5; } else if (n.y > H - n.r) { n.y = H - n.r; n.vy = -Math.abs(n.vy) * 0.5; }
    }
    /* collisions: a grid of cells as wide as the biggest bubble */
    var cell = 2, grid = {};
    for (i = 0; i < L.length; i++) if (L[i].r * 2 > cell) cell = L[i].r * 2;
    for (i = 0; i < L.length; i++) { n = L[i]; var k = ((n.x / cell) | 0) + ',' + ((n.y / cell) | 0); (grid[k] = grid[k] || []).push(n); }
    for (var pass = 0; pass < 3; pass++) {
      for (i = 0; i < L.length; i++) {
        n = L[i]; var gx = (n.x / cell) | 0, gy = (n.y / cell) | 0;
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
          var cl = grid[(gx + ox) + ',' + (gy + oy)]; if (!cl) continue;
          for (j = 0; j < cl.length; j++) {
            var m = cl[j]; if (m === n || m.c.s < n.c.s) continue;
            var dx = m.x - n.x, dy = m.y - n.y, dist2 = dx * dx + dy * dy, min = n.r + m.r + 1.2;
            if (dist2 >= min * min || dist2 === 0) continue;
            var dist = Math.sqrt(dist2), ov = (min - dist), nx = dx / dist, ny = dy / dist;
            var wn = m === st.drag ? 1 : n === st.drag ? 0 : m.r * m.r / (n.r * n.r + m.r * m.r), wm = 1 - wn;
            n.x -= nx * ov * wn; n.y -= ny * ov * wn; m.x += nx * ov * wm; m.y += ny * ov * wm;
            var rv = (m.vx - n.vx) * nx + (m.vy - n.vy) * ny;
            if (rv < 0) { var imp = -rv * 0.6; n.vx -= nx * imp * wn; n.vy -= ny * imp * wn; m.vx += nx * imp * wm; m.vy += ny * imp * wm; }
          }
        }
      }
    }
    for (i = 0; i < L.length; i++) {
      n = L[i];
      if (n !== st.drag) { n.x = MM.clamp(n.x, n.r, W - n.r); n.y = MM.clamp(n.y, n.r, H - n.r); }   /* collisions may not push anyone out */
      moving += Math.abs(n.vx) + Math.abs(n.vy) + Math.abs(n.tr - n.r);
    }
    return moving / Math.max(1, L.length);
  }
  function draw(now) {
    var x = st.x, dpr = st.dpr, W = st.w, H = st.h, L = st.list, q = MM.q;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bg = x.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    bg.addColorStop(0, '#15161b'); bg.addColorStop(1, '#0a0a0c');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    var order = L.slice().sort(function (a, b) { return a.r - b.r; });
    for (var i = 0; i < order.length; i++) {
      var n = order[i]; if (n.r < 1) continue;
      if (!n.cv || Math.abs(n.pr - n.r) > Math.max(0.8, n.r * 0.035) || n.key !== key(n)) paint(n);
      var s = n.r / n.pr, hov = st.hover === n, sc = s * (hov ? 1.06 : 1), sz = n.cv.width / dpr * sc;
      x.globalAlpha = n.a * (q && n.c.s.indexOf(q) !== 0 && n.c.n.toUpperCase().indexOf(q) !== 0 ? 0.18 : 1);
      x.drawImage(n.cv, n.x - sz / 2, n.y - sz / 2, sz, sz);
      if (hov || (q && n.c.s.indexOf(q) === 0)) { x.globalAlpha = 1; x.lineWidth = 2; x.strokeStyle = hov ? 'rgba(255,255,255,.9)' : '#f7931a'; x.beginPath(); x.arc(n.x, n.y, n.r * sc + 2, 0, 6.2832); x.stroke(); }
      var fl = n.c.fl ? Date.now() - n.c.fl : null;
      if (fl != null && fl < 1200) { x.globalAlpha = (1 - fl / 1200) * 0.8; x.lineWidth = 2; x.strokeStyle = n.c.fx > 0 ? MM.upc() : MM.dnc(); x.beginPath(); x.arc(n.x, n.y, n.r * sc + 3 + fl / 120, 0, 6.2832); x.stroke(); }
    }
    x.globalAlpha = 1;
    if (!L.length) { x.fillStyle = '#9a9a94'; x.font = '600 14px Vazirmatn,sans-serif'; x.textAlign = 'center'; x.direction = MM.rtl() ? 'rtl' : 'ltr'; x.fillText(T(D.ok ? 'empty' : 'loading'), W / 2, H / 2); }
  }
  function loop(now) {
    st.raf = 0;
    if (!st || st.d3 || d.hidden || !st.vis) return;
    var dt = st.t ? MM.clamp((now - st.t) / 16.67, 0.25, 3) : 1; st.t = now;
    var mv = step(dt);
    draw(now);
    var calm = mv < 0.035 && !st.drag && now - st.wake > 2500;
    if (calm) { st.raf = -1; st.slow = setTimeout(function () { if (st) st.raf = requestAnimationFrame(loop); }, 66); }   /* ~15 fps while the world rests */
    else st.raf = requestAnimationFrame(loop);
  }
  function run() { if (st && !st.raf && !st.d3) { st.t = 0; st.raf = requestAnimationFrame(loop); } }
  function size() {
    var r = st.box.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = Math.max(200, Math.floor(r.width)), h = Math.max(240, Math.floor(r.height));
    if (w === st.w && h === st.h && dpr === st.dpr) return false;
    var sx = st.w ? w / st.w : 1, sy = st.h ? h / st.h : 1;
    st.list && st.list.forEach(function (n) { n.x *= sx; n.y *= sy; n.cv = null; });
    st.w = w; st.h = h; st.dpr = dpr;
    st.cv.width = Math.round(w * dpr); st.cv.height = Math.round(h * dpr);
    st.cv.style.width = w + 'px'; st.cv.style.height = h + 'px';
    return true;
  }
  function at(px, py) {
    var L = st.list, best = null;
    for (var i = 0; i < L.length; i++) { var n = L[i], dx = px - n.x, dy = py - n.y; if (!n.dead && dx * dx + dy * dy <= n.r * n.r && (!best || n.r < best.r)) best = n; }
    return best;
  }
  function wire() {
    var cv = st.cv, down = null;
    cv.addEventListener('pointerdown', function (e) {
      var r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, n = at(px, py);
      down = { x: px, y: py, t: performance.now(), n: n, moved: false, id: e.pointerId, lx: px, ly: py, lt: performance.now() };
      if (n) { st.drag = n; n.vx = n.vy = 0; try { cv.setPointerCapture(e.pointerId); } catch (er) { } }
      st.wake = performance.now(); run();
    });
    cv.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (down && st.drag) {
        if (Math.abs(px - down.x) + Math.abs(py - down.y) > 6) down.moved = true;
        var now = performance.now(), dt = Math.max(8, now - down.lt);
        st.drag.vx = (px - down.lx) / dt * 16; st.drag.vy = (py - down.ly) / dt * 16;
        st.drag.x = px; st.drag.y = py; down.lx = px; down.ly = py; down.lt = now;
        MM.tip(null); st.wake = now; run(); return;
      }
      if (e.pointerType === 'touch') return;
      var n = at(px, py);
      if (n !== st.hover) { st.hover = n; st.wake = performance.now(); run(); }
      cv.style.cursor = n ? 'grab' : 'default';
      if (n) MM.tip(MM.coinTip(n.c), e.clientX, e.clientY); else MM.tip(null);
    });
    var up = function (e) {
      if (!down) return;
      var n = down.n, click = n && !down.moved && performance.now() - down.t < 500;
      st.drag = null; down = null;
      if (click) { MM.tip(null); MM.openCoin(n.c.s); }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', function () { st.drag = null; down = null; });
    cv.addEventListener('pointerleave', function () { st.hover = null; MM.tip(null); });
    st.ro = new ResizeObserver(MM.debounce(function () { if (!st) return; if (size()) { sync(false); } if (st.d3 && MM.space3d) MM.space3d.resize(); }, 80));
    st.ro.observe(st.box);
    if (window.IntersectionObserver) { st.io = new IntersectionObserver(function (es) { if (!st) return; st.vis = es[0].isIntersecting; if (st.vis) run(); }); st.io.observe(st.box); }
    st.onVis = function () { if (!d.hidden) run(); };
    d.addEventListener('visibilitychange', st.onVis);
  }

  V.mount = function (stage) {
    st = { nodes: {}, list: [], w: 0, h: 0, dpr: 1, raf: 0, vis: true, wake: 0, d3: false };
    st.box = MM.h('<div class="mm-canvas mm-bub"><canvas role="img" aria-label="' + MM.esc(T('title_bubbles')) + '"></canvas></div>');
    stage.appendChild(st.box);
    st.cv = st.box.querySelector('canvas'); st.x = st.cv.getContext('2d', { alpha: false });
    size(); wire(); sync(true);
    st.onData = function (why) { if (!st) return; if (why !== 'live' || (S.size.bubbles || 'ch') === 'ch' || S.size.bubbles === 'fl') sync(false); else { st.wake = performance.now(); run(); } if (st.d3 && MM.space3d) MM.space3d.update(st, 'data'); };
    st.onLogos = function () { if (!st) return; st.list.forEach(function (n) { n.key = ''; }); run(); if (st.d3 && MM.space3d) MM.space3d.update(st, 'logos'); };
    MM.on('data', st.onData); MM.on('logos', st.onLogos); MM.on('palette', st.onLogos); MM.on('watch', st.onData);
    if (S.size.bubbles === 'fl') MM.loadFlow().then(function () { if (st) sync(false); }, function () { });
    if (S.d3.bubbles) V.set3d(true);
  };
  V.update = function () { if (!st) return; st.list.forEach(function (n) { n.key = ''; }); sync(true); };
  V.find = function () { if (st) { st.wake = performance.now(); run(); if (st.d3 && MM.space3d) MM.space3d.find(MM.q); } };
  V.resize = function () { if (st && size()) sync(false); if (st && st.d3 && MM.space3d) MM.space3d.resize(); };
  V.canvas = function () { if (!st) return null; if (st.d3 && MM.space3d) return MM.space3d.snapshot(); draw(performance.now()); return st.cv; };
  V.set3d = function (on) {
    if (!st) return;
    if (!on) { st.d3 = false; if (MM.space3d) MM.space3d.stop(); st.cv.hidden = false; run(); return; }
    st.d3 = true;
    (MM.load3d || function () { return Promise.reject(new Error('3d')); })().then(function () {
      if (!st || !st.d3) return;
      st.cv.hidden = true;
      MM.space3d.bubbles(st.box, function () { return st; }, { w: st.w, h: st.h });
    }, function (e) {
      if (!st) return;
      st.d3 = false; S.d3.bubbles = false; MM.save(); MM.syncTools(); st.cv.hidden = false; run();
      MM.toast(T(e && e.message === 'webgl' ? 'no3d' : 'loadErr'), 5000);
    });
  };
  V.debug = function () { return st; };          /* read-only hook for tests/mm_e2e.py */
  V.unmount = function () {
    if (!st) return;
    if (st.raf > 0) cancelAnimationFrame(st.raf);
    clearTimeout(st.slow);
    MM.off('data', st.onData); MM.off('logos', st.onLogos); MM.off('palette', st.onLogos); MM.off('watch', st.onData);
    d.removeEventListener('visibilitychange', st.onVis);
    if (st.ro) st.ro.disconnect(); if (st.io) st.io.disconnect();
    if (MM.space3d) MM.space3d.stop();
    MM.tip(null);
    st = null;
  };
  /* the same lazy 3D loader as the heatmap (defined there when that view came first) */
  MM.load3d = MM.load3d || function () {
    var ok = (function () { try { var c = d.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; } })();
    if (!ok) return Promise.reject(new Error('webgl'));
    MM.toast(T('loading3d'), 2500);
    return MM.loadScript('/assets/vendor/three/three.min.js').then(function () { return MM.loadScript(MM.asset('space3d.js')); });
  };
})();
