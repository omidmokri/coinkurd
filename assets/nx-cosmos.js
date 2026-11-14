/* entekhab.net — interface v3 "Nexus": the cosmos of the homepage stage (owner's request, 2026-11-14).
   nxGalaxy(box, o) — a spiral galaxy under the coin, in the place of the old glowing ring. It turns with the coin: the same
     axis, the same direction, and a speed taken from the coin's own spin every frame. Inside the coin's radius the stars turn
     exactly with it; further out they keep the coin's edge speed, so they turn more slowly (a flat rotation curve, as in a real
     disc galaxy); the arms are a pattern turning at about half the coin's rate, which stars drift through. Drag or flick the
     coin and the galaxy follows; when the coin turns to face a panel it slows down with it. The pointer pulls the stars near
     it and the plane leans with the coin. The outer orbit keeps what the ring showed: how far the current halving epoch has run.
   nxSpin(box, o) — the motion of the still coin when WebGL is not used (no graphics chip, data saver, a lost context): the
     same physics as assets/nx-coin.js — it spins, leans towards the pointer, can be flicked and turns to face — so the
     galaxy has one motion to follow on every machine. Same interface as nxCoin.
   nxCursor() — the pointer on the homepage: a glowing star handed to the browser as its cursor (it moves with the hardware
     cursor, however slowly the page is drawn), a ring that follows it and wraps around buttons, a trail of star dust and a
     burst on click. Off for touch, for reduced motion, inside the full-screen rooms and while a post is open.
   Everything here pauses when the stage is off screen or the tab is hidden, and steps down by itself on a slow machine. */
(function () {
  'use strict';
  var w = window, d = document, de = d.documentElement, TAU = Math.PI * 2;
  var RM = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var FINE = !!(w.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches);
  function lite() { return de.classList.contains('nx-lite'); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function gauss() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  function ease(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function raf(f) { return w.requestAnimationFrame(f); }

  /* a soft round light of one colour (with a white-hot centre for stars), drawn once and stamped many times */
  function blob(rgb, hot, n) {
    n = n || 64; var c = d.createElement('canvas'); c.width = c.height = n;
    var x = c.getContext('2d'), h = n / 2, g = x.createRadialGradient(h, h, 0, h, h, h), s = 'rgba(' + rgb + ',';
    if (hot) { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.09, 'rgba(255,255,255,.95)'); g.addColorStop(.2, s + '.62)'); g.addColorStop(.45, s + '.14)'); }
    else { g.addColorStop(0, s + '1)'); g.addColorStop(.3, s + '.5)'); g.addColorStop(.62, s + '.12)'); }
    g.addColorStop(1, s + '0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); return c;
  }
  /* a bright star with four diffraction spikes */
  function spike(rgb) {
    var n = 96, c = d.createElement('canvas'); c.width = c.height = n;
    var x = c.getContext('2d'), h = n / 2, s = 'rgba(' + rgb + ',';
    x.globalCompositeOperation = 'lighter';
    [[1, 0], [0, 1]].forEach(function (a) {
      var g = x.createLinearGradient(h - a[0] * h, h - a[1] * h, h + a[0] * h, h + a[1] * h);
      g.addColorStop(0, s + '0)'); g.addColorStop(.5, 'rgba(255,255,255,.95)'); g.addColorStop(1, s + '0)');
      x.fillStyle = g; if (a[0]) x.fillRect(0, h - .9, n, 1.8); else x.fillRect(h - .9, 0, 1.8, n);
    });
    x.drawImage(blob(rgb, true), h - 22, h - 22, 44, 44);
    return c;
  }

  /* ------------------------------------------------------------------ the picture of the galaxy, face on, painted once */
  var B = .38, R0 = .07, ARMS = [[0, 1], [Math.PI, 1], [Math.PI * .5, .36], [Math.PI * 1.5, .36]];   /* trailing logarithmic arms, ~22° pitch: two strong, two faint */
  function armAt(A, r) { return A[0] + Math.log(Math.max(r, R0) / R0) / B; }
  function paint(S) {
    var cv = d.createElement('canvas'); cv.width = cv.height = S;
    var x = cv.getContext('2d'), c = S / 2, R = S * .49, i, j, A, r, t, p, q;
    function at(rr, tt) { return [c + Math.cos(tt) * rr * R, c + Math.sin(tt) * rr * R]; }
    function put(sp, px, py, sz, a) { x.globalAlpha = clamp(a, 0, 1); x.drawImage(sp, px - sz / 2, py - sz / 2, sz, sz); }
    /* the diffuse light of the disc: old stars, warm in the middle, cooling outwards */
    var g = x.createRadialGradient(c, c, 0, c, c, R);
    g.addColorStop(0, 'rgba(255,240,212,.95)'); g.addColorStop(.05, 'rgba(255,214,150,.7)'); g.addColorStop(.14, 'rgba(247,150,40,.27)');
    g.addColorStop(.32, 'rgba(176,94,22,.1)'); g.addColorStop(.62, 'rgba(70,64,60,.045)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'lighter';
    var C = { iv: blob('255,238,210'), go: blob('255,196,102'), am: blob('247,147,26'), te: blob('70,212,222'), ic: blob('196,232,255'), co: blob('255,132,92') };
    var N = S > 600 ? 330 : S > 450 ? 230 : 170;
    /* first a wide, faint haze that each arm sits in */
    ARMS.forEach(function (Ar) {
      for (i = 0; i < N * .35; i++) {
        r = R0 + .05 + Math.pow(i / (N * .35), 1.1) * .9; t = armAt(Ar, r);
        p = at(r + gauss() * .03, t + gauss() * .05);
        put(r < .3 ? C.go : C.am, p[0], p[1], S * (.07 + Math.random() * .06), .028 * Ar[1] * (r > .7 ? Math.max(0, 1 - (r - .7) / .3) : 1));
      }
    });
    /* the arms: clouds of light strung along each spiral, warm inside, with young blue-green clusters further out */
    ARMS.forEach(function (Ar) {
      for (i = 0; i < N; i++) {
        r = R0 + Math.pow(i / N, 1.08) * 1.0; t = armAt(Ar, r);
        var wd = .016 + r * .075, f = Math.min(1, (r - R0) / .12) * (r > .74 ? Math.max(0, 1 - (r - .74) / .3) : 1);
        for (j = 0; j < 3; j++) {
          p = at(r + gauss() * wd * .55, t + gauss() * wd / Math.max(r, .1) * .9); q = Math.random();
          var sp = r < .22 ? (q < .5 ? C.iv : C.go) : q < .16 ? C.te : q < .22 ? C.ic : q < .6 ? C.am : C.go;
          put(sp, p[0], p[1], S * (.016 + Math.random() * .046) * (1.2 - r * .5), (.06 + Math.random() * .11) * Ar[1] * f);
        }
      }
    });
    /* dust lanes on the inner edge of the two main arms: light taken away, not darkness painted on */
    x.globalCompositeOperation = 'destination-out';
    var dk = blob('0,0,0');
    for (j = 0; j < 2; j++) for (i = 0; i < N * .85; i++) {
      r = .12 + (i / (N * .85)) * .8; t = armAt(ARMS[j], r);
      p = at(r - (.016 + r * .075) * .75 + gauss() * .006, t + gauss() * .025);
      put(dk, p[0], p[1], S * (.013 + Math.random() * .022), (.13 + Math.random() * .17) * Math.min(1, (r - .12) / .1));
    }
    x.globalCompositeOperation = 'lighter';
    /* star-forming knots and clusters along the arms */
    for (i = 0; i < (S > 600 ? 90 : S > 450 ? 60 : 45); i++) {
      A = ARMS[i % 2]; r = .2 + Math.random() * .7; p = at(r + gauss() * .02, armAt(A, r) + gauss() * .06); q = Math.random();
      put(q < .45 ? C.te : q < .7 ? C.co : C.ic, p[0], p[1], S * (.007 + Math.random() * .015), .35 + Math.random() * .4);
      put(C.iv, p[0], p[1], S * .005, .75);
    }
    /* a fine powder of stars, denser towards the middle and along the arms */
    var st = blob('255,244,224', true, 32);
    for (i = 0; i < (S > 600 ? 1800 : S > 450 ? 1100 : 700); i++) {
      r = Math.min(1, -.26 * Math.log(1 - Math.random() * .985)); t = Math.random() * TAU;
      if (Math.random() < .5) t = armAt(ARMS[(Math.random() * 2) | 0], r) + gauss() * .16;
      p = at(r, t); put(st, p[0], p[1], S * (.005 + Math.random() * .008), .2 + Math.random() * .42);
    }
    /* the nucleus, brightest of all */
    g = x.createRadialGradient(c, c, 0, c, c, R * .2);
    g.addColorStop(0, 'rgba(255,252,240,1)'); g.addColorStop(.18, 'rgba(255,232,180,.75)'); g.addColorStop(.5, 'rgba(255,180,80,.25)'); g.addColorStop(1, 'rgba(255,150,40,0)');
    x.globalAlpha = 1; x.fillStyle = g; x.fillRect(c - R * .2, c - R * .2, R * .4, R * .4);
    return cv;
  }

  /* ------------------------------------------------------------------ nxGalaxy */
  function nxGalaxy(box, o) {
    o = o || {};
    var cv = d.createElement('canvas'), g = null;
    try { g = cv.getContext('2d'); } catch (e) { }
    if (!g) return null;
    cv.className = 'nx-gx'; cv.setAttribute('aria-hidden', 'true');
    box.insertBefore(cv, box.firstChild);
    var LT = lite(), PH = w.innerWidth < 821;
    /* what a machine without a graphics chip can afford was measured on one (2026-11-14): a high-quality scaled picture
       costs ~21 ms there and a plain one ~5 ms, 420 star sprites ~16 ms and 170 about 5 ms; so it starts two steps down */
    var Q = LT ? { S: 384, nf: 170, nh: 7, dpr: 1, sc: .85, fps: 30, q: 'low', lvl: 2 }
      : PH ? { S: 512, nf: 440, nh: 8, dpr: 1.5, sc: 1, fps: 60, q: 'high', lvl: 0 }
        : { S: 768, nf: 1000, nh: 14, dpr: 2, sc: 1, fps: 60, q: 'high', lvl: 0 };
    var tex = null, SP = [blob('255,246,230', true, 32), blob('255,206,120', true, 32), blob('200,232,255', true, 32), blob('247,160,60', true, 32)], SK = [spike('255,226,170'), spike('190,230,255')];
    var K0 = .27, BASE = RM ? 0 : .4, RC = .42, PS = .55;   /* tilt of the plane; spin when nothing drives it; radius (of the disc) inside which the stars turn with the coin; pattern speed of the arms */
    var stars = [], hero = [], i, r, q;
    function seed(n) {
      stars = [];
      for (i = 0; i < n; i++) {
        r = Math.min(1.1, .03 - .3 * Math.log(1 - Math.random() * .97)); q = Math.random();
        stars.push({ r: r, a: Math.random() * TAU, s: .55 + Math.pow(Math.random(), 4) * 1.9, b: .35 + Math.random() * .65, f: .6 + Math.random() * 2.6, p: Math.random() * TAU, c: q < .55 ? 0 : q < .78 ? 1 : q < .92 ? 2 : 3, w: RC / Math.max(r, RC) });
      }
    }
    seed(Q.nf);
    for (i = 0; i < Q.nh; i++) { r = .24 + Math.random() * .72; hero.push({ r: r, a: Math.random() * TAU, s: 9 + Math.random() * 13, f: .25 + Math.random() * .55, p: Math.random() * TAU, c: Math.random() < .7 ? 0 : 1, w: RC / Math.max(r, RC) }); }

    var W = 0, H = 0, CX = 0, CY = 0, R = 0, dpr = 1, cw = 0, chh = 0, alive = true, paused = false, visible = true, rafId = 0, t0 = 0, lastDraw = 0;
    var pat = 0, V = BASE, halv = null, hv = 0, hvT = 0, pulseT = -1, mx = 0, my = 0, pin = false, H_ = 0, first = true, wf = 0, ws = 0;
    function layout() {
      var b = box.getBoundingClientRect(); if (!b.width || !b.height) return false;
      var narrow = w.innerWidth < 821, wide = narrow ? 1.04 : 1.12;
      cw = b.width * wide; chh = b.height * .68;
      cv.style.left = ((b.width - cw) / 2).toFixed(1) + 'px'; cv.style.top = (b.height * .4).toFixed(1) + 'px';
      cv.style.width = cw.toFixed(1) + 'px'; cv.style.height = chh.toFixed(1) + 'px';
      dpr = Math.min(w.devicePixelRatio || 1, Q.dpr) * Q.sc;
      var nw = Math.max(2, Math.round(cw * dpr)), nh = Math.max(2, Math.round(chh * dpr));
      if (cv.width !== nw || cv.height !== nh) { cv.width = nw; cv.height = nh; }
      W = nw; H = nh; CX = W / 2; CY = (b.height * .78 - b.height * .4) * dpr; R = W * .465;
      return true;
    }
    function draw(t, dt) {
      if (!tex) return;
      var m = null; try { m = o.motion ? o.motion() : null; } catch (e) { m = null; }
      var vel = m && isFinite(m.vel) ? m.vel : BASE, glow = m && isFinite(m.glow) ? m.glow : .2, tilt = m && isFinite(m.tilt) ? m.tilt : 0, bias = m && isFinite(m.bias) ? m.bias : 0;
      if (RM) vel = 0;
      V += (clamp(vel, -6, 6) - V) * Math.min(1, dt * 5);
      var v = RM ? 0 : Math.abs(V) < .05 ? (V < 0 ? -.05 : .05) : V;
      /* the entrance: the disc opens out and settles into its turn */
      var e = RM ? 1 : ease((t - t0) / 2400), Re = R * (.6 + .4 * e);
      pat -= (v * PS + (1 - e) * 1.6) * dt;
      var k = K0 + clamp(tilt, -.3, .3) * .12, roll = clamp(bias, -.9, .9) * .045, cr = Math.cos(roll), sr = Math.sin(roll), ox = CX - clamp(bias, -.9, .9) * 5 * dpr;
      var pT = pulseT >= 0 ? (t - pulseT) / 1000 : 9, flare = pT < 3 ? Math.exp(-pT * 2.4) : 0, Bt = (.9 + (glow - .2) * .32 + flare * .35) * e;
      hv += (hvT - hv) * Math.min(1, dt * 2.2);
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      /* the disc */
      g.globalAlpha = clamp(Bt, 0, 1);
      g.translate(ox, CY); g.rotate(roll); g.scale(1, k); g.rotate(pat); var sc = Re / (Q.S * .49); g.scale(sc, sc);
      g.imageSmoothingEnabled = true; try { g.imageSmoothingQuality = Q.q; } catch (x) { }
      g.drawImage(tex, -Q.S / 2, -Q.S / 2);
      g.setTransform(1, 0, 0, 1, 0, 0);
      /* an inner orbit, dashed, carried round with the arms */
      g.globalAlpha = .24 * e; g.lineWidth = Math.max(1, dpr); g.strokeStyle = 'rgba(247,147,26,.85)';
      g.setLineDash([2 * dpr, 8 * dpr]); g.lineDashOffset = -pat * Re * .84;   /* the dashes go round the same way as the stars */
      g.beginPath(); g.ellipse(ox, CY, Re * .84, Re * .84 * k, roll, 0, TAU); g.stroke(); g.setLineDash([]);
      /* the pointer, mapped onto the plane of the disc */
      var pu = 9, pv = 9, P = 0;
      if (pin && !RM) {
        var b = cv.getBoundingClientRect(), lx = (mx - b.left) * (W / b.width) - ox, ly = (my - b.top) * (H / b.height) - CY;
        var ux = lx * cr + ly * sr, uy = (-lx * sr + ly * cr) / k; pu = ux / Re; pv = uy / Re;
        P = pu * pu + pv * pv < 1.5 ? 1 : 0;
      }
      H_ += (P - H_) * Math.min(1, dt * 4);
      var wave = pT < 1.7 ? pT / 1.15 : -9, wa = 1 - pT / 1.7;
      /* the stars: each on its own orbit, the inner ones locked to the coin, the outer ones slower */
      g.globalCompositeOperation = 'lighter';
      for (i = 0; i < stars.length; i++) {
        var s = stars[i]; s.a -= v * s.w * dt;
        var x = s.r * Math.cos(s.a), y = s.r * Math.sin(s.a), boost = 1;
        if (H_ > .01) { var dx = pu - x, dy = pv - y, dd = dx * dx + dy * dy; if (dd < .072) { var f = 1 - Math.sqrt(dd) / .2683; f = f * f * H_; x += dx * f * .55 - dy * f * .4; y += dy * f * .55 + dx * f * .4; boost += f * 1.8; } }
        if (wave > -1) { var dw = Math.abs(s.r - wave); if (dw < .08) boost += (1 - dw / .08) * 2 * wa; }
        var X = x * Re, Y = y * Re * k, sx = ox + X * cr - Y * sr, sy = CY + X * sr + Y * cr;
        var dep = 1 + y * .18, tw = .62 + .38 * Math.sin(t * .001 * s.f + s.p);
        var sz = s.s * dpr * dep * (1 + (boost - 1) * .35) * 3.2;
        g.globalAlpha = clamp(s.b * tw * dep * boost * Bt, 0, 1);
        g.drawImage(SP[s.c], sx - sz / 2, sy - sz / 2, sz, sz);
      }
      for (i = 0; i < hero.length; i++) {
        var hs = hero[i]; hs.a -= v * hs.w * dt;
        var hx = hs.r * Math.cos(hs.a), hy = hs.r * Math.sin(hs.a), HX = hx * Re, HY = hy * Re * k;
        var tw2 = .55 + .45 * Math.sin(t * .001 * hs.f * TAU + hs.p), hz = hs.s * dpr * (.75 + .5 * tw2) * (1 + hy * .2);
        g.globalAlpha = clamp((.45 + .55 * tw2) * Bt, 0, 1);
        g.drawImage(SK[hs.c], ox + HX * cr - HY * sr - hz / 2, CY + HX * sr + HY * cr - hz / 2, hz, hz);
      }
      /* the bulge: a round glow that stands up out of the flat disc */
      var gb = g.createRadialGradient(0, 0, 0, 0, 0, Re * .24), ci = (.75 + (glow - .2) * .5 + flare * 1.1) * e;
      gb.addColorStop(0, 'rgba(255,250,236,' + clamp(.9 * ci, 0, 1).toFixed(3) + ')'); gb.addColorStop(.3, 'rgba(255,206,120,' + clamp(.42 * ci, 0, 1).toFixed(3) + ')');
      gb.addColorStop(.65, 'rgba(247,147,26,' + clamp(.12 * ci, 0, 1).toFixed(3) + ')'); gb.addColorStop(1, 'rgba(247,147,26,0)');
      g.globalAlpha = 1; g.setTransform(1, 0, 0, .62, ox, CY); g.fillStyle = gb; g.fillRect(-Re * .24, -Re * .24, Re * .48, Re * .48); g.setTransform(1, 0, 0, 1, 0, 0);
      /* the outer orbit: the share of the current halving epoch already mined */
      g.globalCompositeOperation = 'source-over';
      var rx = Re * 1.03, ry = rx * k;
      g.globalAlpha = .55 * e; g.lineWidth = Math.max(1, dpr); g.strokeStyle = 'rgba(255,255,255,.2)';
      g.beginPath(); g.ellipse(ox, CY, rx, ry, roll, 0, TAU); g.stroke();
      if (halv != null) {
        var pe = clamp(hv, 0, 1);
        if (pe > .002) {
          var lg = g.createLinearGradient(ox - rx, 0, ox + rx, 0); lg.addColorStop(0, '#a65a07'); lg.addColorStop(.5, '#ffd27a'); lg.addColorStop(1, '#a65a07');
          g.strokeStyle = lg; g.lineCap = 'round';
          g.globalAlpha = .22 * e; g.lineWidth = 7 * dpr; g.beginPath(); g.ellipse(ox, CY, rx, ry, roll, 0, TAU * pe); g.stroke();
          g.globalAlpha = .95 * e; g.lineWidth = 2.4 * dpr; g.beginPath(); g.ellipse(ox, CY, rx, ry, roll, 0, TAU * pe); g.stroke();
          var ha = TAU * pe, ax = Math.cos(ha) * rx, ay = Math.sin(ha) * ry, hpx = ox + ax * cr - ay * sr, hpy = CY + ax * sr + ay * cr, hz2 = (16 + 6 * Math.sin(t * .004)) * dpr;
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = .9 * e; g.drawImage(SP[1], hpx - hz2 / 2, hpy - hz2 / 2, hz2, hz2);
        }
      }
      g.globalCompositeOperation = 'lighter';
      /* where the pointer is over the disc: a soft well of light */
      if (H_ > .02 && pin) {
        var b2 = cv.getBoundingClientRect(), lpx = (mx - b2.left) * (W / b2.width), lpy = (my - b2.top) * (H / b2.height), lr = Re * .2;
        var lgw = g.createRadialGradient(lpx, lpy, 0, lpx, lpy, lr);
        lgw.addColorStop(0, 'rgba(255,236,190,' + (.42 * H_).toFixed(3) + ')'); lgw.addColorStop(.4, 'rgba(70,212,222,' + (.13 * H_).toFixed(3) + ')'); lgw.addColorStop(1, 'rgba(70,212,222,0)');
        g.globalAlpha = 1; g.fillStyle = lgw; g.fillRect(lpx - lr, lpy - lr, lr * 2, lr * 2);
      }
      /* a pulse: a ring of light that runs out through the disc */
      if (wave > -1 && wave < 1.4) {
        g.globalAlpha = clamp(wa, 0, 1); g.lineWidth = (2 + 6 * wa) * dpr; g.strokeStyle = 'rgba(255,214,140,.75)';
        g.beginPath(); g.ellipse(ox, CY, Math.max(1, wave * Re), Math.max(1, wave * Re * k), roll, 0, TAU); g.stroke();
        if (wave > .12) { g.lineWidth = 1.5 * dpr; g.strokeStyle = 'rgba(70,212,222,.6)'; g.beginPath(); g.ellipse(ox, CY, (wave - .1) * Re, (wave - .1) * Re * k, roll, 0, TAU); g.stroke(); }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      if (first) { first = false; if (o.onready) o.onready(); }
    }
    function step(now) {
      rafId = 0; if (!alive || paused || !visible) return;
      if (Q.fps < 60 && now - lastDraw < 1000 / Q.fps - 4) { rafId = raf(step); return; }
      var gap = now - lastDraw, dt = Math.min(.1, gap / 1000 || .016); lastDraw = now;
      draw(now, dt);
      /* the canvas is drawn later than this call returns, so what is watched is the time between frames: a page that falls
         well behind the frame rate asked for gets a plainer picture, fewer stars, a coarser canvas, then fewer frames */
      if (Q.lvl < 4 && gap < 500) { ws += gap; if (++wf >= 40) { if (ws / wf > 1000 / Q.fps * 1.6 + 4) stepDown(); wf = 0; ws = 0; } }
      if (!RM) rafId = raf(step);
    }
    function stepDown() {
      Q.lvl++;
      if (Q.lvl === 1) { Q.q = 'low'; seed(Math.round(stars.length * .5)); }
      else if (Q.lvl === 2) { Q.fps = 30; Q.sc *= .85; layout(); }
      else if (Q.lvl === 3) { Q.fps = 20; seed(Math.round(stars.length * .6)); }
      else Q.fps = 12;
    }
    function kick() { if (!alive || paused || !visible || rafId || !tex) return; lastDraw = performance.now() - 16; wf = 0; ws = 0; rafId = raf(step); }
    function halt() { if (rafId) w.cancelAnimationFrame(rafId); rafId = 0; }
    function build() {
      if (!alive) return;
      try { tex = paint(Q.S); } catch (e) { tex = null; return; }
      layout(); t0 = performance.now();
      if (RM) { draw(t0 + 5000, .016); return; }
      kick();
    }
    (w.requestIdleCallback || function (f) { setTimeout(f, 60); })(build, { timeout: 900 });

    if (o.area && FINE) {
      o.area.addEventListener('pointermove', function (ev) { if (ev.pointerType !== 'mouse') return; mx = ev.clientX; my = ev.clientY; pin = true; }, { passive: true });
      o.area.addEventListener('pointerleave', function () { pin = false; });
    }
    d.addEventListener('visibilitychange', function () { if (d.hidden) halt(); else kick(); });
    if ('IntersectionObserver' in w) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); else halt(); }).observe(cv);
    var rt = 0; w.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (layout() && tex && (RM || !rafId)) draw(performance.now(), .016); }, 120); });
    return {
      ok: true,
      halving: function (p) { if (!(p >= 0)) return; halv = clamp(p, 0, 1); hvT = halv; if (RM) { hv = halv; if (tex) draw(performance.now(), .016); } },
      pulse: function () { if (RM) return; pulseT = performance.now(); kick(); },
      pause: function (on) { paused = !!on; if (paused) halt(); else kick(); },
      redraw: function () { if (tex && layout()) draw(performance.now(), .016); },
      destroy: function () { alive = false; halt(); if (cv.parentNode) cv.parentNode.removeChild(cv); }
    };
  }

  /* ------------------------------------------------------------------ nxSpin: the still coin, set in motion */
  function nxSpin(box, o) {
    o = o || {};
    var el = box.querySelector('.nx-c3'), hit = o.hit || box.querySelector('.nx-hit'), area = o.area || box;
    if (!el) return null;
    box.classList.remove('css'); box.classList.add('nxj');
    var st = { yaw: o.yaw || 0, vel: 0, spin: RM ? 0 : (o.spin == null ? .42 : o.spin), tilt: 0, tiltT: 0, bias: 0, biasT: 0, glow: .2, glowT: .2, facing: false };
    var px = 0, py = 0, rafId = 0, last = 0, paused = false, visible = true, alive = true, drag = null;
    function put() { el.style.transform = 'translate(-50%,-50%) perspective(1400px) rotateX(' + (-st.tilt).toFixed(4) + 'rad) rotateY(' + (st.yaw + st.bias).toFixed(4) + 'rad)'; }
    function step(now) {
      rafId = 0; if (!alive) return;
      var dt = Math.min(.1, (now - last) / 1000 || .016); last = now;
      if (!drag) {
        if (st.facing) { var tgt = Math.round(st.yaw / TAU) * TAU; st.vel += ((tgt - st.yaw) * 14 - st.vel * 7) * Math.min(dt, .05); }
        else st.vel += (st.spin - st.vel) * Math.min(1, dt * 1.6);
        st.yaw += st.vel * dt;
      }
      var k = Math.min(1, dt * 5);
      st.tilt += (st.tiltT + py * .22 - st.tilt) * k; st.bias += (st.biasT + px * .3 - st.bias) * k;
      st.glow += (st.glowT - st.glow) * Math.min(1, dt * 3.2);
      put();
      if (RM && !drag && Math.abs(st.vel) < .01 && Math.abs(st.tiltT + py * .22 - st.tilt) < .002 && Math.abs(st.biasT + px * .3 - st.bias) < .002) return;
      rafId = raf(step);
    }
    function kick() { if (!alive || paused || !visible || rafId) return; last = performance.now(); rafId = raf(step); }
    function halt() { if (rafId) w.cancelAnimationFrame(rafId); rafId = 0; }
    if (FINE) area.addEventListener('pointermove', function (e) {
      var r = area.getBoundingClientRect();
      px = clamp(((e.clientX - r.left) / r.width - .5) * 2, -1, 1); py = clamp(((e.clientY - r.top) / r.height - .5) * 2, -1, 1);
      if (RM) kick();
    }, { passive: true });
    if (hit) {
      hit.addEventListener('pointerdown', function (e) { if (e.button) return; drag = { x: e.clientX, t: performance.now(), v: 0 }; try { hit.setPointerCapture(e.pointerId); } catch (x) { } hit.classList.add('grab'); kick(); });
      hit.addEventListener('pointermove', function (e) {
        if (!drag) return; var now = performance.now(), r = box.getBoundingClientRect(), da = (e.clientX - drag.x) / (r.width * .3);
        st.yaw += da; drag.v = da / Math.max(.008, (now - drag.t) / 1000); drag.x = e.clientX; drag.t = now; st.facing = false;
      });
      var up = function () { if (!drag) return; st.vel = clamp(drag.v, -14, 14); drag = null; hit.classList.remove('grab'); kick(); };
      hit.addEventListener('pointerup', up); hit.addEventListener('pointercancel', up);
    }
    d.addEventListener('visibilitychange', function () { if (d.hidden) halt(); else kick(); });
    if ('IntersectionObserver' in w) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); else halt(); }).observe(box);
    put(); kick();
    return {
      ok: true,
      set: function (s) { if (s.glow != null) st.glowT = s.glow; if (s.bias != null) st.biasT = s.bias; if (s.tilt != null) st.tiltT = s.tilt; if (s.spin != null) st.spin = RM ? 0 : s.spin; kick(); },
      face: function (on) { st.facing = !!on; kick(); },
      pulse: function () { st.glow = 1; if (!RM) st.vel += 9; st.facing = false; kick(); },
      pause: function (on) { paused = !!on; if (paused) halt(); else kick(); },
      redraw: put,
      motion: function () { return { yaw: st.yaw + st.bias, vel: drag ? drag.v : st.vel, glow: st.glow, tilt: st.tilt, bias: st.bias }; },
      destroy: function () { alive = false; halt(); box.classList.remove('nxj'); el.style.transform = ''; }
    };
  }

  /* ------------------------------------------------------------------ nxCursor */
  function nxCursor() {
    if (!FINE || RM || w.__nxCur) return null;
    try { if (localStorage.getItem('ek_cur') === 'off') return null; } catch (e) { }
    w.__nxCur = 1;
    var LT = lite(), D = (w.devicePixelRatio || 1) > 1.3 ? 2 : 1;
    /* the pointer: small pictures handed to the browser as its cursor, so it moves with the hardware cursor at full speed */
    function pic(kind, sc) {
      var n = 32 * sc, c = d.createElement('canvas'); c.width = c.height = n; var x = c.getContext('2d'); x.scale(sc, sc);
      var g = x.createRadialGradient(16, 16, 0, 16, 16, kind === 'pt' ? 11 : 13);
      g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(.5, 'rgba(247,147,26,.16)'); g.addColorStop(1, 'rgba(247,147,26,0)');
      x.fillStyle = g; x.fillRect(0, 0, 32, 32);
      function ring(rr, lw, col) { x.beginPath(); x.arc(16, 16, rr, 0, TAU); x.lineWidth = lw; x.strokeStyle = col; x.stroke(); }
      function core(rr) {
        x.beginPath(); x.arc(16, 16, rr + 1.3, 0, TAU); x.fillStyle = 'rgba(20,12,4,.78)'; x.fill();
        var cg = x.createRadialGradient(15.3, 15.3, 0, 16, 16, rr); cg.addColorStop(0, '#fff'); cg.addColorStop(.55, '#ffe2a4'); cg.addColorStop(1, '#f7931a');
        x.beginPath(); x.arc(16, 16, rr, 0, TAU); x.fillStyle = cg; x.fill();
      }
      function glint(len, a) {
        [[1, 0], [0, 1]].forEach(function (v) {
          var lg = x.createLinearGradient(16 - v[0] * len, 16 - v[1] * len, 16 + v[0] * len, 16 + v[1] * len);
          lg.addColorStop(0, 'rgba(255,240,200,0)'); lg.addColorStop(.5, 'rgba(255,248,230,' + a + ')'); lg.addColorStop(1, 'rgba(255,240,200,0)');
          x.fillStyle = lg; if (v[0]) x.fillRect(16 - len, 15.4, len * 2, 1.2); else x.fillRect(15.4, 16 - len, 1.2, len * 2);
        });
      }
      if (kind === 'pt') { glint(10, .85); core(3.3); }
      else if (kind === 'hv') { ring(9.6, 2.6, 'rgba(20,12,4,.7)'); ring(9.6, 1.4, '#ffd27a'); glint(6, .6); core(2.5); }
      else {   /* the coin: a ring with two arrows, turn me */
        ring(10, 3, 'rgba(20,12,4,.7)');
        x.lineWidth = 1.6; x.strokeStyle = '#ffd27a'; x.lineCap = 'round';
        [0, Math.PI].forEach(function (a0) {
          x.beginPath(); x.arc(16, 16, 10, a0 + .35, a0 + 2.45); x.stroke();
          var ex = 16 + Math.cos(a0 + 2.45) * 10, ey = 16 + Math.sin(a0 + 2.45) * 10, tx = -Math.sin(a0 + 2.45), ty = Math.cos(a0 + 2.45);
          x.beginPath(); x.moveTo(ex - tx * 3.4 + ty * 2.6, ey - ty * 3.4 - tx * 2.6); x.lineTo(ex + tx * .8, ey + ty * .8); x.lineTo(ex - tx * 3.4 - ty * 2.6, ey - ty * 3.4 + tx * 2.6); x.stroke();
        });
        core(kind === 'gd' ? 3.4 : 2.4);
      }
      return c.toDataURL('image/png');
    }
    function cur(kind, fb) { var a = pic(kind, 1), b = D > 1 ? pic(kind, 2) : a; return '-webkit-image-set(url(' + a + ') 1x,url(' + b + ') 2x) 16 16,' + fb; }
    var TXT = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=submit]):not([type=button]):not([type=reset]):not([type=color]),textarea,[contenteditable=""],[contenteditable=true]';
    var ACT = 'a[href],button,[role=button],[role=tab],[role=link],summary,select,label[for],.nx-p,[data-post],[data-d],input[type=checkbox],input[type=radio],input[type=range],input[type=submit],input[type=button]';
    var css = d.createElement('style'); css.id = 'nxcur-css';
    css.textContent = 'html.nx-cur,html.nx-cur *{cursor:' + cur('pt', 'auto') + '!important}' +
      'html.nx-cur :is(' + ACT + '),html.nx-cur :is(' + ACT + ') *{cursor:' + cur('hv', 'pointer') + '!important}' +
      'html.nx-cur .nx-hit{cursor:' + cur('gr', 'grab') + '!important}html.nx-cur .nx-hit.grab{cursor:' + cur('gd', 'grabbing') + '!important}' +
      'html.nx-cur :is(' + TXT + '){cursor:text!important}';
    d.head.appendChild(css);

    /* around it: a ring that follows (not on a machine without a graphics chip), a trail of star dust and a burst on click */
    var ring = null, fx = d.createElement('div'); fx.id = 'nxfx'; fx.setAttribute('aria-hidden', 'true');
    var COLS = ['255,196,102', '255,196,102', '255,236,200', '247,147,26', '255,214,140', '80,214,222'], pool = [], pi = 0, NP = LT ? 10 : 42, i;
    for (i = 0; i < NP; i++) { var s = d.createElement('i'); s.style.setProperty('--c', 'rgb(' + COLS[i % COLS.length] + ')'); fx.appendChild(s); pool.push(s); }
    var wave = d.createElement('b'); fx.appendChild(wave);
    d.body.appendChild(fx);
    if (!LT) { ring = d.createElement('div'); ring.id = 'nxcur'; ring.setAttribute('aria-hidden', 'true'); ring.innerHTML = '<i></i>'; d.body.appendChild(ring); }

    var on = false, P = { x: -200, y: -200 }, Rg = { x: -200, y: -200, w: 36, h: 36, r: 18 }, T = { x: -200, y: -200, w: 36, h: 36, r: 18, m: '' }, pvx = 0, pvy = 0, acc = 0, down = false, rafId = 0, last = 0, hot = null, brCache = new WeakMap();
    var modal = d.getElementById('modal');
    function allowed() { return !de.classList.contains('nx-room') && !(modal && modal.classList.contains('open')); }
    function setOn(v) {
      if (v === on) return; on = v;
      de.classList.toggle('nx-cur', v);
      if (ring) ring.classList.toggle('on', v);
    }
    function spark(x, y, dx, dy, s, life) {
      var el = pool[pi++ % NP]; if (el._a) { try { el._a.cancel(); } catch (e) { } }
      el._a = el.animate([{ transform: 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + s.toFixed(2) + ')', opacity: 1 },
        { transform: 'translate3d(' + (x + dx).toFixed(1) + 'px,' + (y + dy).toFixed(1) + 'px,0) scale(0)', opacity: 0 }], { duration: life, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    }
    function trail(x, y, vx, vy) {
      var sp = Math.sqrt(vx * vx + vy * vy);
      spark(x + (Math.random() - .5) * 6, y + (Math.random() - .5) * 6, (Math.random() - .5) * 26 - vx * .05, (Math.random() - .5) * 26 - vy * .05 - 9, .45 + Math.min(1, sp / 1400) * .7 + Math.random() * .5, 520 + Math.random() * 560);
    }
    function burst(x, y) {
      var n = LT ? 6 : 12;
      for (var j = 0; j < n; j++) { var a = j / n * TAU + Math.random() * .4, dd = 34 + Math.random() * 46; spark(x, y, Math.cos(a) * dd, Math.sin(a) * dd, 1 + Math.random() * .8, 520 + Math.random() * 260); }
      if (wave._a) { try { wave._a.cancel(); } catch (e) { } }
      wave._a = wave.animate([{ transform: 'translate3d(' + x + 'px,' + y + 'px,0) scale(.2)', opacity: .95 }, { transform: 'translate3d(' + x + 'px,' + y + 'px,0) scale(2.6)', opacity: 0 }], { duration: 640, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' });
    }
    /* what the pointer is over decides what the ring does: wrap a small control, swell over a panel, open up over the coin */
    function aim(t) {
      hot = null; T.m = '';
      if (!t || !t.closest) return;
      if (t.closest(TXT)) { T.m = 'txt'; return; }
      if (t.closest('.nx-hit')) { T.m = 'spin'; return; }
      var a = t.closest(ACT); if (!a) return;
      var r = a.getBoundingClientRect();
      if (a.classList.contains('nx-p') || r.width > 280 || r.height > 76) { T.m = 'big'; return; }
      hot = a; T.m = 'wrap';
    }
    function frame(now) {
      rafId = 0; if (!ring) return;
      var dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      if (T.m === 'wrap' && hot && hot.isConnected) {
        var r = hot.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, br = brCache.get(hot);
        if (br == null) { br = parseFloat(getComputedStyle(hot).borderTopLeftRadius) || 0; brCache.set(hot, br); }
        T.x = cx + (P.x - cx) * .12; T.y = cy + (P.y - cy) * .12; T.w = r.width + 12; T.h = r.height + 12; T.r = Math.min(T.h / 2, br + 6);
      } else {
        var z = T.m === 'spin' ? 64 : T.m === 'big' ? 54 : T.m === 'txt' ? 10 : 36;
        T.x = P.x; T.y = P.y; T.w = T.h = z; T.r = z / 2;
      }
      var kp = 1 - Math.exp(-dt * (T.m === 'wrap' ? 22 : 16)), ks = 1 - Math.exp(-dt * 14);
      Rg.x += (T.x - Rg.x) * kp; Rg.y += (T.y - Rg.y) * kp; Rg.w += (T.w - Rg.w) * ks; Rg.h += (T.h - Rg.h) * ks; Rg.r += (T.r - Rg.r) * ks;
      var st = 0, an = 0;
      if (!T.m) { var sp = Math.sqrt(pvx * pvx + pvy * pvy); st = Math.min(.3, sp / 3200); an = Math.atan2(pvy, pvx); }
      pvx *= .82; pvy *= .82;
      ring.style.width = Rg.w.toFixed(1) + 'px'; ring.style.height = Rg.h.toFixed(1) + 'px'; ring.style.borderRadius = Rg.r.toFixed(1) + 'px';
      ring.style.transform = 'translate3d(' + (Rg.x - Rg.w / 2).toFixed(1) + 'px,' + (Rg.y - Rg.h / 2).toFixed(1) + 'px,0)' + (st > .01 ? ' rotate(' + an.toFixed(3) + 'rad) scale(' + (1 + st).toFixed(3) + ',' + (1 - st * .5).toFixed(3) + ') rotate(' + (-an).toFixed(3) + 'rad)' : '') + (down ? ' scale(.86)' : '');
      ring.className = (on ? 'on' : '') + (T.m ? ' m-' + T.m : '') + (down ? ' dn' : '');
      var moving = Math.abs(T.x - Rg.x) + Math.abs(T.y - Rg.y) + Math.abs(T.w - Rg.w) + Math.abs(T.h - Rg.h) > .4 || st > .01;
      if (on && moving) rafId = raf(frame);
    }
    function kick() { if (ring && !rafId) { last = performance.now(); rafId = raf(frame); } }
    d.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') { setOn(false); return; }
      if (!allowed()) { setOn(false); return; }
      var pts = e.getCoalescedEvents ? e.getCoalescedEvents() : null; if (!pts || !pts.length) pts = [e];
      var wasOn = on; setOn(true);
      for (var j = 0; j < pts.length; j++) {
        var q = pts[j], dx = q.clientX - P.x, dy = q.clientY - P.y;
        if (wasOn) { acc += Math.sqrt(dx * dx + dy * dy); pvx = pvx * .6 + dx * 24; pvy = pvy * .6 + dy * 24; }
        P.x = q.clientX; P.y = q.clientY;
        if (acc > (LT ? 34 : 12)) { acc = 0; trail(P.x, P.y, pvx, pvy); }
      }
      if (!wasOn) { Rg.x = P.x; Rg.y = P.y; }
      aim(e.target); kick();
    }, { passive: true });
    d.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || !on) return; down = true; if (!e.button && T.m !== 'txt') burst(e.clientX, e.clientY); kick(); }, { passive: true });
    d.addEventListener('pointerup', function () { down = false; if (on) kick(); }, { passive: true });
    d.addEventListener('mouseout', function (e) { if (!e.relatedTarget || e.relatedTarget.tagName === 'IFRAME') setOn(false); });
    w.addEventListener('blur', function () { setOn(false); });
    var sct = 0; w.addEventListener('scroll', function () { if (!on || sct) return; sct = setTimeout(function () { sct = 0; aim(d.elementFromPoint(P.x, P.y)); kick(); }, 80); }, { passive: true });
    new MutationObserver(function () { if (!allowed()) setOn(false); }).observe(de, { attributes: true, attributeFilter: ['class'] });
    if (modal) new MutationObserver(function () { if (!allowed()) setOn(false); }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    return { off: function () { setOn(false); } };
  }

  w.nxGalaxy = nxGalaxy; w.nxSpin = nxSpin; w.nxCursor = nxCursor;
})();
