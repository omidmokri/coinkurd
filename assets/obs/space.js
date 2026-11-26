/* entekhab.net — the Observatory in deep space (owner 2026-11-26: the whole section in the style of the SOPR and HODL pages).
   One canvas behind every page of /charts/: a galaxy band with dust lanes, drifting nebulae that swell and fade with the
   frames' breath, three depths of twinkling stars that move apart as you scroll or move the pointer, far galaxies, and now
   and then a falling star. Painted at 30 frames a second at most, stopped when the tab is hidden, and drawn once and left
   still under prefers-reduced-motion or on the light mode for devices without a graphics chip (html.nx-lite).
   window.OBSKY.wake() redraws it at once (assets/obs/cosmos.js calls it when a view mounts). */
(function () {
  'use strict';
  var w = window, d = document, de = d.documentElement;
  if (w.OBSKY) return;
  de.classList.add('ob-space');
  var RM = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function still() { return RM || de.classList.contains('nx-lite'); }
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  /* a seeded random, so the sky is the same sky on every visit and every page */
  var seed0 = 20261126;
  function rnd() { seed0 = (seed0 * 1664525 + 1013904223) >>> 0; return seed0 / 4294967296; }

  var cv, g, W = 0, H = 0, dpr = 1, raf = 0, last = 0, t0 = 0;
  var stars = [], spikes = [], gals = [], band = null, neb = null, shoot = null;
  var sy = 0, px = 0, py = 0, tx = 0, ty = 0;   /* scroll, and the pointer's eased offset */

  function paint() {
    seed0 = 20261126;
    var area = W * H, small = W < 700;
    /* stars in three depths */
    stars = [];
    var n = Math.round(Math.min(small ? 380 : 760, area / (small ? 2600 : 2100)));
    for (var i = 0; i < n; i++) {
      var z = rnd(), c = rnd();
      stars.push({ x: rnd() * W, y: rnd() * H * 1.6, z: z, r: z < .82 ? .35 + z * .65 : .95 + z * .85, ph: rnd() * 6.283, sp: .35 + rnd() * 1.5,
        c: c < .1 ? '#ffd9a8' : c < .26 ? '#b4ccff' : c < .3 ? '#ffc2e0' : '#ffffff' });
    }
    /* a few bright stars with soft cross spikes */
    spikes = [];
    for (i = 0; i < (small ? 3 : 6); i++) spikes.push({ x: rnd() * W, y: rnd() * H * 1.4, r: 1.4 + rnd() * 1.2, ph: rnd() * 6.283, c: rnd() < .5 ? '#cfe0ff' : '#fff4e0' });
    /* far galaxies: small tilted glows */
    gals = [];
    for (i = 0; i < (small ? 2 : 4); i++) gals.push({ x: rnd() * W, y: rnd() * H, a: rnd() * 3.14, s: 10 + rnd() * 18, c: ['#9b7bff', '#7cc8ff', '#ff9ccf', '#ffd9a8'][i % 4] });

    var bw = Math.max(1, Math.round(W / 2)), bh = Math.max(1, Math.round(H / 2));
    /* the galaxy band: a diagonal river of light with dark dust lanes, painted once at half size */
    band = d.createElement('canvas'); band.width = bw; band.height = bh;
    var q = band.getContext('2d');
    q.save(); q.translate(bw / 2, bh / 2); q.rotate(-.42);
    var L = Math.hypot(bw, bh) * .62;
    for (i = 0; i < 70; i++) {
      var u = (rnd() * 2 - 1) * L, v = (rnd() + rnd() + rnd() - 1.5) * bh * .09, r = bh * (.05 + rnd() * .12);
      var gr = q.createRadialGradient(u, v, 0, u, v, r), col = rnd() < .5 ? '#7c8cff' : rnd() < .5 ? '#b08cff' : '#7fd7ff';
      gr.addColorStop(0, rgba(col, .055)); gr.addColorStop(1, rgba(col, 0));
      q.fillStyle = gr; q.fillRect(u - r, v - r, r * 2, r * 2);
    }
    q.globalCompositeOperation = 'destination-out';            /* dust lanes */
    for (i = 0; i < 26; i++) {
      var du = (rnd() * 2 - 1) * L, dv = (rnd() - .5) * bh * .05, dr = bh * (.02 + rnd() * .05);
      var dg = q.createRadialGradient(du, dv, 0, du, dv, dr); dg.addColorStop(0, 'rgba(0,0,0,.5)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = dg; q.fillRect(du - dr, dv - dr, dr * 2, dr * 2);
    }
    q.globalCompositeOperation = 'lighter';                    /* the band's own fine stars */
    for (i = 0; i < (small ? 500 : 1100); i++) {
      var su = (rnd() * 2 - 1) * L, sv = (rnd() + rnd() + rnd() + rnd() - 2) * bh * .07;
      q.fillStyle = 'rgba(220,230,255,' + (.15 + rnd() * .45) + ')'; q.fillRect(su, sv, rnd() < .9 ? .6 : 1.1, rnd() < .9 ? .6 : 1.1);
    }
    q.restore();
    /* nebulae, painted once; they drift and breathe when drawn */
    neb = d.createElement('canvas'); neb.width = bw; neb.height = bh;
    var m = neb.getContext('2d');
    [['#3a1c71', .55, .16, .18, .55], ['#0f5c8c', .5, .84, .3, .5], ['#7a1f5c', .4, .72, .8, .45], ['#14306b', .45, .22, .86, .6], ['#0b6b6b', .28, .5, .52, .35], ['#4b2a9a', .3, .95, .95, .4]].forEach(function (c) {
      var cx = c[2] * bw, cy = c[3] * bh, rr = c[4] * Math.max(bw, bh), gg = m.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gg.addColorStop(0, rgba(c[0], c[1])); gg.addColorStop(.45, rgba(c[0], c[1] * .33)); gg.addColorStop(1, rgba(c[0], 0));
      m.fillStyle = gg; m.fillRect(0, 0, bw, bh);
    });
  }

  function size() {
    dpr = Math.min(1.5, w.devicePixelRatio || 1); W = w.innerWidth; H = w.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(); frame(performance.now(), true);
  }

  function frame(now, once) {
    if (!once && now - last < 33) { raf = w.requestAnimationFrame(frame); return; }
    last = now;
    var t = (now - t0) / 1000, calm = still();
    var breath = calm ? .5 : .5 + .5 * Math.sin(t * 2 * Math.PI / 6 - Math.PI / 2);   /* the same 6-second breath as the frames */
    px += (tx - px) * .06; py += (ty - py) * .06;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    var bg = g.createLinearGradient(0, 0, W * .3, H);
    bg.addColorStop(0, '#02030a'); bg.addColorStop(.55, '#060818'); bg.addColorStop(1, '#0b0622');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    /* nebulae drift a little and swell with the breath */
    if (neb) {
      var dx = calm ? 0 : Math.sin(t / 40) * W * .015, dy = calm ? 0 : Math.cos(t / 52) * H * .012;
      g.globalAlpha = .78 + .22 * breath;
      g.drawImage(neb, dx - px * 6 - W * .03, dy - py * 6 - sy * .03 - H * .03, W * 1.06, H * 1.06);
    }
    g.globalCompositeOperation = 'lighter';
    if (band) { g.globalAlpha = .85 + .15 * breath; g.drawImage(band, -px * 10, -py * 10 - sy * .05, W, H); }
    for (var i = 0; i < gals.length; i++) {
      var ga = gals[i], gy = ((ga.y - sy * .06) % (H * 1.2) + H * 1.2) % (H * 1.2);
      g.save(); g.translate(ga.x - px * 8, gy - py * 8); g.rotate(ga.a); g.scale(1, .38);
      var gg = g.createRadialGradient(0, 0, 0, 0, 0, ga.s);
      gg.addColorStop(0, rgba(ga.c, .5)); gg.addColorStop(.25, rgba(ga.c, .16)); gg.addColorStop(1, rgba(ga.c, 0));
      g.globalAlpha = 1; g.fillStyle = gg; g.beginPath(); g.arc(0, 0, ga.s, 0, 6.283); g.fill(); g.restore();
    }
    for (i = 0; i < stars.length; i++) {
      var s = stars[i], k = .05 + s.z * .28, y = ((s.y - sy * k - py * s.z * 18) % (H * 1.6) + H * 1.6) % (H * 1.6);
      if (y > H + 4) continue;
      var x = s.x - px * s.z * 18;
      var tw = calm ? .8 : .5 + .5 * Math.sin(t * s.sp + s.ph);
      g.globalAlpha = (.22 + s.z * .78) * tw; g.fillStyle = s.c;
      g.beginPath(); g.arc(x, y, s.r, 0, 6.283); g.fill();
      if (s.r > 1.45) { g.globalAlpha *= .22; g.beginPath(); g.arc(x, y, s.r * 3.4, 0, 6.283); g.fill(); }
    }
    for (i = 0; i < spikes.length; i++) {
      var p = spikes[i], yy = ((p.y - sy * .3 - py * 18) % (H * 1.4) + H * 1.4) % (H * 1.4);
      if (yy > H + 30) continue;
      var xx = p.x - px * 18, a = calm ? .7 : .55 + .45 * Math.sin(t * .9 + p.ph), len = p.r * 9 * (.8 + .2 * a);
      var hg = g.createRadialGradient(xx, yy, 0, xx, yy, p.r * 6);
      hg.addColorStop(0, rgba(p.c, .9 * a)); hg.addColorStop(.2, rgba(p.c, .28 * a)); hg.addColorStop(1, rgba(p.c, 0));
      g.globalAlpha = 1; g.fillStyle = hg; g.beginPath(); g.arc(xx, yy, p.r * 6, 0, 6.283); g.fill();
      g.strokeStyle = rgba(p.c, .5 * a); g.lineWidth = .7;
      g.beginPath(); g.moveTo(xx - len, yy); g.lineTo(xx + len, yy); g.moveTo(xx, yy - len); g.lineTo(xx, yy + len); g.stroke();
    }
    if (!calm) {
      if (!shoot && Math.random() < .003) shoot = { x: W * (.3 + Math.random() * .7), y: Math.random() * H * .45, vx: -(5 + Math.random() * 5), vy: 2 + Math.random() * 2.2, life: 1 };
      if (shoot) {
        var tl = 18, lg = g.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * tl, shoot.y - shoot.vy * tl);
        lg.addColorStop(0, 'rgba(255,255,255,' + .95 * shoot.life + ')'); lg.addColorStop(.3, 'rgba(124,200,255,' + .45 * shoot.life + ')'); lg.addColorStop(1, 'rgba(155,123,255,0)');
        g.globalAlpha = 1; g.strokeStyle = lg; g.lineWidth = 1.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(shoot.x - shoot.vx * tl, shoot.y - shoot.vy * tl); g.stroke();
        shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= .017; if (shoot.life <= 0) shoot = null;
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (!calm && !once && !d.hidden) raf = w.requestAnimationFrame(frame); else if (!once) raf = 0;
  }

  function start() {
    if (cv) return;
    cv = d.createElement('canvas'); cv.className = 'ob-sky'; cv.setAttribute('aria-hidden', 'true');
    d.body.insertBefore(cv, d.body.firstChild);
    g = cv.getContext('2d'); t0 = performance.now();
    var tm = 0;
    w.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(size, 150); });
    w.addEventListener('scroll', function () { sy = w.scrollY || 0; if (still()) frame(performance.now(), true); }, { passive: true });
    if (!RM && w.matchMedia && w.matchMedia('(pointer:fine)').matches) {
      w.addEventListener('pointermove', function (e) { tx = (e.clientX / W - .5) * 2; ty = (e.clientY / H - .5) * 2; }, { passive: true });
    }
    d.addEventListener('visibilitychange', function () { if (!d.hidden) wake(); });
    sy = w.scrollY || 0; size();
    if (!still()) raf = w.requestAnimationFrame(frame);
  }
  function wake() { if (!cv) return; frame(performance.now(), true); if (!still() && !raf) raf = w.requestAnimationFrame(frame); }
  w.OBSKY = { wake: wake };
  if (d.body) start(); else d.addEventListener('DOMContentLoaded', start);
})();
