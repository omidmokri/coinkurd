/* entekhab.net — the Observatory in deep space, alive (owner 2026-11-26: stars, galaxies, nebulae, a black hole and a
   wormhole behind every page of /charts/, always slowly changing, with ideas from NASA's own pictures).
   Everything here is drawn by this file; no picture is loaded. The looks are taken from:
   - JWST's "Cosmic Cliffs" (Carina): blue-teal gas with warm, gold crests, and a second violet-magenta cloud like the
     "Pillars of Creation"; both made of tileable fractal noise, drifting against each other and breathing.
   - Hubble's face-on spirals: a galaxy of glowing arms with pink star-forming knots that slowly turns.
   - The Event Horizon Telescope's black hole: a dark shadow inside a bright photon ring, with a hot accretion disk whose
     far side is bent over the top by gravity and whose approaching side shines brighter (Doppler beaming).
   - JWST's six-pointed star spikes (plus the two faint horizontal ones).
   - A wormhole as a lensed throat of light, two swirls turning against each other.
   Painted at most 30 times a second (15 on the light mode, html.nx-lite, which also leaves out the second cloud), stopped
   when the tab is hidden. Under prefers-reduced-motion nothing slides with the scroll or pointer and no star falls; the sky
   only turns and drifts very slowly while the stars twinkle and the clouds breathe.
   window.OBSKY.wake() redraws it at once (assets/obs/cosmos.js calls it when a view mounts). */
(function () {
  'use strict';
  var w = window, d = document, de = d.documentElement;
  if (w.OBSKY) return;
  de.classList.add('ob-space');
  var RM = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function lite() { return de.classList.contains('nx-lite'); }
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  var seed0 = 20261126;
  function rnd() { seed0 = (seed0 * 1664525 + 1013904223) >>> 0; return seed0 / 4294967296; }
  function mk(s) { var c = d.createElement('canvas'); c.width = c.height = s; return c; }
  var TAU = Math.PI * 2;

  /* ---------- textures, made once */
  var TX = null;
  /* tileable fractal value noise */
  function noiseField(N, seed, oct, base) {
    var out = new Float32Array(N * N), s = seed >>> 0;
    function r() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    var amp = 1, tot = 0, P = base;
    for (var o = 0; o < oct; o++) {
      var lat = new Float32Array(P * P);
      for (var i = 0; i < lat.length; i++) lat[i] = r();
      for (var y = 0; y < N; y++) {
        var fy = y / N * P, y0 = Math.floor(fy), ty = fy - y0, y1 = (y0 + 1) % P; ty = ty * ty * (3 - 2 * ty);
        for (var x = 0; x < N; x++) {
          var fx = x / N * P, x0 = Math.floor(fx), tx = fx - x0, x1 = (x0 + 1) % P; tx = tx * tx * (3 - 2 * tx);
          var a = lat[y0 * P + x0], b = lat[y0 * P + x1], c = lat[y1 * P + x0], e = lat[y1 * P + x1];
          out[y * N + x] += amp * ((a + (b - a) * tx) * (1 - ty) + (c + (e - c) * tx) * ty);
        }
      }
      tot += amp; amp *= .52; P *= 2;
    }
    for (i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  function ramp(stops, v) {
    for (var i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
      var a = stops[i - 1], b = stops[i], k = (v - a[0]) / (b[0] - a[0] || 1);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    }
    var l = stops[stops.length - 1]; return [l[1], l[2], l[3]];
  }
  var RAMP_CLIFF = [[0, 18, 34, 96], [.45, 30, 92, 170], [.66, 52, 170, 210], [.8, 94, 242, 214], [.9, 255, 207, 107], [1, 255, 244, 214]];
  var RAMP_PILLAR = [[0, 40, 14, 90], [.45, 98, 52, 190], [.66, 155, 123, 255], [.82, 255, 79, 154], [1, 255, 206, 232]];
  function cloud(N, seed, stops, th, alphaK) {
    var n = noiseField(N, seed, 5, 4), m = noiseField(N, seed + 77, 3, 2);
    var c = mk(N), x = c.getContext('2d'), im = x.createImageData(N, N), p = im.data;
    for (var i = 0; i < n.length; i++) {
      var v = n[i] * .72 + m[i] * .28;                        /* large shapes from m, wisps from n */
      v = Math.min(1, Math.max(0, (v - .3) / .5));
      var a = v < th ? 0 : Math.pow((v - th) / (1 - th), 1.5);
      var col = ramp(stops, v);
      p[i * 4] = col[0]; p[i * 4 + 1] = col[1]; p[i * 4 + 2] = col[2]; p[i * 4 + 3] = Math.min(255, a * alphaK * 255);
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  function glowDot(col) {
    var c = mk(32), x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.12, rgba(col, .95)); gr.addColorStop(.35, rgba(col, .28)); gr.addColorStop(1, rgba(col, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return c;
  }
  /* a JWST star: core, halo, six long spikes and two faint horizontal ones */
  function spikeStar(col) {
    var S = 128, c = mk(S), x = c.getContext('2d'), h = S / 2;
    var gr = x.createRadialGradient(h, h, 0, h, h, 14);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.2, rgba(col, .9)); gr.addColorStop(1, rgba(col, 0));
    x.fillStyle = gr; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'lighter';
    function spike(ang, len, wid, a) {
      x.save(); x.translate(h, h); x.rotate(ang);
      var lg = x.createLinearGradient(0, 0, len, 0); lg.addColorStop(0, rgba(col, a)); lg.addColorStop(1, rgba(col, 0));
      x.fillStyle = lg; x.beginPath(); x.moveTo(0, -wid); x.lineTo(len, 0); x.lineTo(0, wid); x.closePath(); x.fill(); x.restore();
    }
    for (var k = 0; k < 6; k++) spike(-Math.PI / 2 + k * Math.PI / 3, h - 2, 1.6, .85);
    spike(0, h * .55, 1, .45); spike(Math.PI, h * .55, 1, .45);
    return c;
  }
  /* a face-on spiral galaxy */
  function galaxy(S, arms, warm, cool, tight, seed) {
    var c = mk(S), x = c.getContext('2d'), h = S / 2, s = seed >>> 0;
    function r() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    function gs() { return (r() + r() + r() - 1.5) / 1.5; }
    x.globalCompositeOperation = 'lighter';
    var disk = x.createRadialGradient(h, h, 0, h, h, h);
    disk.addColorStop(0, rgba(warm, .32)); disk.addColorStop(.18, rgba(warm, .12)); disk.addColorStop(.6, rgba(cool, .06)); disk.addColorStop(1, rgba(cool, 0));
    x.fillStyle = disk; x.fillRect(0, 0, S, S);
    for (var a = 0; a < arms; a++) {
      var off = a * TAU / arms, i, u, rr, ang;
      /* the arm's glow: soft overlapping clouds of light along the spiral */
      for (i = 0; i < 140; i++) {
        u = i / 140; rr = h * .08 + h * .86 * u; ang = u * 3.1 * Math.PI * tight + off + gs() * .1;
        var bx = h + Math.cos(ang) * rr, by = h + Math.sin(ang) * rr, br = h * (.1 - u * .05);
        var bg = x.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, rgba(u < .3 ? warm : cool, .09 * (1 - u * .55))); bg.addColorStop(1, rgba(cool, 0));
        x.fillStyle = bg; x.fillRect(bx - br, by - br, br * 2, br * 2);
      }
      /* its stars, and pink knots where new stars are being born */
      for (i = 0; i < 1600; i++) {
        u = i / 1600; rr = h * .08 + h * .86 * u;
        ang = u * 3.1 * Math.PI * tight + off + gs() * .2;
        var sp = rr * .08 * (1 + u);
        var px = h + Math.cos(ang) * rr + gs() * sp, py = h + Math.sin(ang) * rr + gs() * sp;
        var knot = r() < .018;
        x.fillStyle = knot ? 'rgba(255,111,181,' + (.25 + r() * .3) + ')' : rgba(u < .35 ? warm : cool, (.06 + r() * .2) * (1 - u * .6));
        var z = knot ? 1.6 : (r() < .92 ? .8 : 1.4);
        x.fillRect(px, py, z, z);
      }
    }
    var core = x.createRadialGradient(h, h, 0, h, h, h * .16);
    core.addColorStop(0, 'rgba(255,250,236,.72)'); core.addColorStop(.4, rgba(warm, .3)); core.addColorStop(1, rgba(warm, 0));
    x.fillStyle = core; x.fillRect(0, 0, S, S);
    return c;
  }
  /* the accretion disk, seen face-on; drawn flattened and turning */
  function diskTex(S) {
    var c = mk(S), x = c.getContext('2d'), im = x.createImageData(S, S), p = im.data, h = S / 2;
    var bands = []; for (var b = 0; b < 64; b++) bands.push(.55 + rnd() * .45);
    for (var y = 0; y < S; y++) for (var xx = 0; xx < S; xx++) {
      var dx = (xx - h) / h, dy = (y - h) / h, rr = Math.sqrt(dx * dx + dy * dy), i = (y * S + xx) * 4;
      if (rr < .3 || rr > 1) { p[i + 3] = 0; continue; }
      var ang = Math.atan2(dy, dx), f = Math.pow((1 - rr) / .7, 1.35);
      var st = bands[Math.floor(rr * 63)] * (.72 + .28 * Math.sin(ang * 3 + rr * 18)) * (.85 + .15 * Math.sin(ang * 11 - rr * 40));
      var edge = Math.min(1, (rr - .3) / .05) * Math.min(1, (1 - rr) / .25);
      var col = ramp([[0, 140, 40, 120], [.35, 255, 79, 154], [.62, 255, 170, 90], [.85, 255, 224, 170], [1, 255, 250, 236]], f);
      p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; p[i + 3] = Math.min(255, 255 * 1.35 * (.22 + 1.1 * f) * st * edge);
    }
    x.putImageData(im, 0, 0); return c;
  }
  /* the wormhole's throat: light spiralling in */
  function throat(S, seed) {
    var c = mk(S), x = c.getContext('2d'), h = S / 2, s = seed >>> 0;
    function r() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    x.globalCompositeOperation = 'lighter';
    for (var a = 0; a < 3; a++) for (var i = 0; i < 900; i++) {
      var u = i / 900, rr = h * (1 - u) * .96, ang = u * 5 * Math.PI + a * TAU / 3 + (r() - .5) * .35;
      var col = u < .5 ? '#9b7bff' : u < .8 ? '#7cc8ff' : '#5ef2d6';
      x.fillStyle = rgba(col, (.05 + .3 * u) * (.5 + r() * .5));
      var z = 1 + u * 1.6; x.fillRect(h + Math.cos(ang) * rr, h + Math.sin(ang) * rr, z, z);
    }
    var core = x.createRadialGradient(h, h, 0, h, h, h * .3);
    core.addColorStop(0, 'rgba(236,255,250,.9)'); core.addColorStop(.35, 'rgba(94,242,214,.45)'); core.addColorStop(1, 'rgba(94,242,214,0)');
    x.fillStyle = core; x.fillRect(0, 0, S, S);
    return c;
  }
  /* built one at a time between frames, so a phone never stalls while the page opens; the sky fills in within a second */
  function textures() {
    if (TX) return TX;
    var L = lite();
    TX = {};
    var q = [
      ['dot', function () { return { w: glowDot('#ffffff'), b: glowDot('#b4ccff'), y: glowDot('#ffd9a8'), p: glowDot('#ffc2e0') }; }],
      ['spike', function () { return [spikeStar('#cfe0ff'), spikeStar('#fff1dc')]; }],
      ['gal', function () { return galaxy(256, 2, '#ffd9a8', '#7cc8ff', 1, 5); }],
      ['disk', function () { seed0 = 909; return diskTex(L ? 160 : 256); }],
      ['throat', function () { return throat(192, 41); }],
      ['gal2', function () { return galaxy(128, 3, '#ffc2e0', '#9b7bff', .85, 17); }],
      ['cliff', function () { return cloud(L ? 160 : 224, 31, RAMP_CLIFF, .34, .62); }],
      ['pillar', function () { return L ? null : cloud(192, 113, RAMP_PILLAR, .4, .55); }]
    ];
    function next() {
      var it = q.shift(); if (!it) return;
      try { TX[it[0]] = it[1](); } catch (e) { TX[it[0]] = null; }
      if (cv && g) frame(performance.now(), true);
      setTimeout(next, 30);
    }
    setTimeout(next, 0);
    return TX;
  }

  /* ---------- the scene */
  var cv, g, W = 0, H = 0, dpr = 1, raf = 0, last = 0, t0 = 0;
  var stars = [], spikes = [], dust = [], band = null, Lp = null;
  var shoot = null, nextShoot = 4, nova = null, nextNova = 20;
  var sy = 0, px = 0, py = 0, tx = 0, ty = 0;

  function paint() {
    var small = W < 700, rtl = (de.dir || d.dir) === 'rtl', lt = lite();
    function X(f) { return (rtl ? 1 - f : f) * W; }
    var base = small ? W : Math.min(W, H * 1.5);
    Lp = small
      ? { gal: [X(.8), H * .17, base * .44], gal2: [X(.16), H * .44, base * .2], bh: [X(.26), H * .76, base * .075], wh: [X(.82), H * .58, base * .17] }
      : { gal: [X(.82), H * .24, base * .3], gal2: [X(.36), H * .13, base * .12], bh: [X(.14), H * .74, base * .042], wh: [X(.62), H * .86, base * .1] };
    seed0 = 20261126;
    var area = W * H;
    stars = [];
    var n = Math.round(Math.min(small ? 360 : 720, area / (small ? 2700 : 2200)) * (lt ? .6 : 1));
    for (var i = 0; i < n; i++) {
      var z = rnd(), c = rnd();
      stars.push({ x: rnd() * W, y: rnd() * H * 1.6, z: z, r: z < .84 ? .35 + z * .6 : .9 + z * .8, ph: rnd() * TAU, sp: .5 + rnd() * 1.8,
        c: c < .1 ? '#ffd9a8' : c < .26 ? '#b4ccff' : c < .3 ? '#ffc2e0' : '#ffffff', k: c < .1 ? 'y' : c < .26 ? 'b' : c < .3 ? 'p' : 'w' });
    }
    spikes = [];
    for (i = 0; i < (small ? 3 : 6); i++) spikes.push({ x: rnd() * W, y: rnd() * H * 1.3, s: 34 + rnd() * 36, ph: rnd() * TAU, k: i % 2 });
    dust = [];
    for (i = 0; i < (small ? 26 : 50); i++) dust.push({ x: rnd() * W, y: rnd() * H, vx: (rnd() - .5) * 6, vy: -2 - rnd() * 5, r: .5 + rnd() * 1.1, a: .15 + rnd() * .35 });

    /* the galaxy band, painted once at half size */
    var bw = Math.max(1, Math.round(W / 2)), bh = Math.max(1, Math.round(H / 2));
    band = d.createElement('canvas'); band.width = bw; band.height = bh;
    var q = band.getContext('2d');
    q.save(); q.translate(bw / 2, bh / 2); q.rotate(rtl ? .42 : -.42);
    var Lb = Math.hypot(bw, bh) * .62;
    for (i = 0; i < 70; i++) {
      var u = (rnd() * 2 - 1) * Lb, v = (rnd() + rnd() + rnd() - 1.5) * bh * .09, r = bh * (.05 + rnd() * .12);
      var gr = q.createRadialGradient(u, v, 0, u, v, r), col = rnd() < .5 ? '#7c8cff' : rnd() < .5 ? '#b08cff' : '#7fd7ff';
      gr.addColorStop(0, rgba(col, .055)); gr.addColorStop(1, rgba(col, 0));
      q.fillStyle = gr; q.fillRect(u - r, v - r, r * 2, r * 2);
    }
    q.globalCompositeOperation = 'destination-out';
    for (i = 0; i < 26; i++) {
      var du = (rnd() * 2 - 1) * Lb, dv = (rnd() - .5) * bh * .05, dr = bh * (.02 + rnd() * .05);
      var dg = q.createRadialGradient(du, dv, 0, du, dv, dr); dg.addColorStop(0, 'rgba(0,0,0,.5)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = dg; q.fillRect(du - dr, dv - dr, dr * 2, dr * 2);
    }
    q.globalCompositeOperation = 'lighter';
    for (i = 0; i < (small ? 500 : 1100); i++) {
      var su = (rnd() * 2 - 1) * Lb, sv = (rnd() + rnd() + rnd() + rnd() - 2) * bh * .07;
      q.fillStyle = 'rgba(220,230,255,' + (.15 + rnd() * .45) + ')'; q.fillRect(su, sv, rnd() < .9 ? .6 : 1.1, rnd() < .9 ? .6 : 1.1);
    }
    q.restore();
  }

  function size() {
    var small = w.innerWidth < 700;
    dpr = Math.min(small ? 1.25 : 1.5, w.devicePixelRatio || 1); W = w.innerWidth; H = w.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    textures(); paint(); frame(performance.now(), true);
  }

  /* a tileable texture laid over the whole screen, sliding by (ox, oy) */
  function tile(img, T, ox, oy) {
    ox = ((ox % T) + T) % T; oy = ((oy % T) + T) % T;
    for (var yy = -oy; yy < H; yy += T) for (var xx = -ox; xx < W; xx += T) g.drawImage(img, xx, yy, T + .5, T + .5);
  }

  function blackHole(cx, cy, r, t, mv) {
    var T = TX, R = r * 3.3, rot = t * TAU / 16 * mv;
    /* the glow around it */
    var gl = g.createRadialGradient(cx, cy, r * .8, cx, cy, R * 1.5);
    gl.addColorStop(0, 'rgba(255,170,90,.22)'); gl.addColorStop(.35, 'rgba(255,79,154,.08)'); gl.addColorStop(1, 'rgba(155,123,255,0)');
    g.fillStyle = gl; g.fillRect(cx - R * 1.5, cy - R * 1.5, R * 3, R * 3);
    /* the far side of the disk, bent up and over the shadow by gravity */
    g.save(); g.translate(cx, cy); g.rotate(-rot * .5); g.globalAlpha = .8;
    g.drawImage(T.disk, -r * 1.75, -r * 1.75, r * 3.5, r * 3.5); g.restore();
    /* the disk behind */
    g.save(); g.beginPath(); g.rect(cx - R - 2, cy - R - 2, R * 2 + 4, R + 2); g.clip();
    g.translate(cx, cy); g.scale(1, .26); g.rotate(rot); g.globalAlpha = 1;
    g.drawImage(T.disk, -R, -R, R * 2, R * 2); g.restore();
    /* the photon ring, then the shadow */
    var pr = g.createRadialGradient(cx, cy, r * .96, cx, cy, r * 1.5);
    pr.addColorStop(0, 'rgba(255,240,214,.95)'); pr.addColorStop(.12, 'rgba(255,200,130,.55)'); pr.addColorStop(.45, 'rgba(255,111,181,.12)'); pr.addColorStop(1, 'rgba(255,111,181,0)');
    g.globalAlpha = 1; g.fillStyle = pr; g.beginPath(); g.arc(cx, cy, r * 1.5, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,214,160,.35)'; g.lineWidth = Math.max(3, r * .12); g.beginPath(); g.arc(cx, cy, r * 1.05, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,244,222,.9)'; g.lineWidth = Math.max(1.2, r * .035); g.beginPath(); g.arc(cx, cy, r * 1.02, 0, TAU); g.stroke();
    /* the disk in front */
    g.save(); g.beginPath(); g.rect(cx - R - 2, cy, R * 2 + 4, R + 2); g.clip();
    g.translate(cx, cy); g.scale(1, .26); g.rotate(rot);
    g.drawImage(T.disk, -R, -R, R * 2, R * 2); g.restore();
    /* the side coming towards us shines brighter */
    var side = (de.dir === 'rtl') ? 1 : -1, dpx = cx + side * R * .55;
    var dp = g.createRadialGradient(dpx, cy, 0, dpx, cy, R * .55);
    dp.addColorStop(0, 'rgba(255,236,200,' + (.32 + .1 * Math.sin(t * 1.3)) + ')'); dp.addColorStop(1, 'rgba(255,236,200,0)');
    g.save(); g.translate(0, cy); g.scale(1, .3); g.translate(0, -cy); g.fillStyle = dp; g.fillRect(dpx - R * .6, cy - R * .6, R * 1.2, R * 1.2); g.restore();
  }

  function wormhole(cx, cy, s, t, mv, breath) {
    var T = TX, a = t * TAU / 26 * mv;
    var halo = g.createRadialGradient(cx, cy, s * .3, cx, cy, s * 1.25);
    halo.addColorStop(0, 'rgba(124,200,255,.16)'); halo.addColorStop(.6, 'rgba(155,123,255,.07)'); halo.addColorStop(1, 'rgba(155,123,255,0)');
    g.fillStyle = halo; g.fillRect(cx - s * 1.3, cy - s * 1.3, s * 2.6, s * 2.6);
    g.save(); g.translate(cx, cy); g.rotate(a); g.globalAlpha = .9; g.drawImage(T.throat, -s, -s, s * 2, s * 2); g.restore();
    g.save(); g.translate(cx, cy); g.rotate(-a * 1.6); g.scale(-1, 1); g.globalAlpha = .55; g.drawImage(T.throat, -s * .66, -s * .66, s * 1.32, s * 1.32); g.restore();
    /* the lensing rim */
    g.globalAlpha = .35 + .25 * breath; g.strokeStyle = 'rgba(200,236,255,.8)'; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, s * (.5 + .03 * breath), 0, TAU); g.stroke();
    g.globalAlpha = 1;
  }

  function frame(now, once) {
    if (!Lp) return;
    var lt = lite(), gap = RM ? 100 : lt ? 66 : 33;
    if (!once && now - last < gap) { raf = w.requestAnimationFrame(frame); return; }
    last = now;
    var t = (now - t0) / 1000, mv = RM ? .3 : 1, par = RM ? 0 : 1, T = TX;
    var breath = .5 + .5 * Math.sin(t * TAU / 6 - Math.PI / 2);   /* the frames' 6-second breath */
    px += (tx - px) * .06; py += (ty - py) * .06;
    var ssy = sy * par, ppx = px * par, ppy = py * par;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    var bg = g.createLinearGradient(0, 0, W * .3, H);
    bg.addColorStop(0, '#02030a'); bg.addColorStop(.55, '#050717'); bg.addColorStop(1, '#0a0620');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    /* the two clouds, drifting against each other */
    var big = Math.max(W, H);
    g.globalAlpha = .62 + .3 * breath;
    if (T.cliff) tile(T.cliff, big * 1.05, t * 7 * mv + ppx * 10, t * 2.2 * mv + ssy * .04 + ppy * 10);
    if (T.pillar) { g.globalAlpha = .4 + .3 * (1 - breath); tile(T.pillar, big * .8, -t * 5 * mv + ppx * 16 + big * .3, -t * 3 * mv + ssy * .07 + ppy * 16); }

    g.globalCompositeOperation = 'lighter';
    if (band) { g.globalAlpha = .8 + .2 * breath; g.drawImage(band, -ppx * 10, -ppy * 10 - ssy * .05, W, H); }

    var lift = Math.min(ssy * .08, H * .35);
    /* the galaxies, turning */
    var G = Lp.gal, G2 = Lp.gal2;
    if (T.gal) { g.save(); g.translate(G[0] - ppx * 8, G[1] - lift - ppy * 8); g.rotate(-.5); g.scale(1, .5); g.rotate(t * TAU / 120 * mv);
    g.globalAlpha = .82 + .18 * breath; g.drawImage(T.gal, -G[2], -G[2], G[2] * 2, G[2] * 2); g.restore(); }
    if (T.gal2) { g.save(); g.translate(G2[0] - ppx * 5, G2[1] - lift * .7 - ppy * 5); g.rotate(.7); g.scale(1, .62); g.rotate(-t * TAU / 90 * mv);
    g.globalAlpha = .7; g.drawImage(T.gal2, -G2[2], -G2[2], G2[2] * 2, G2[2] * 2); g.restore(); }

    var WH = Lp.wh; if (T.throat) wormhole(WH[0] - ppx * 9, WH[1] - lift - ppy * 9, WH[2], t, mv, breath);
    var BH = Lp.bh; if (T.disk) blackHole(BH[0] - ppx * 12, BH[1] - lift - ppy * 12, BH[2], t, mv);

    /* stars in three depths */
    g.globalCompositeOperation = 'source-over';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], k = .05 + s.z * .28, y = ((s.y - ssy * k - ppy * s.z * 18) % (H * 1.6) + H * 1.6) % (H * 1.6);
      if (y > H + 4) continue;
      var x = s.x - ppx * s.z * 18, tw = .45 + .55 * Math.sin(t * s.sp + s.ph);
      if (tw < .05) tw = .05;
      if (s.r > 1.2 && T.dot) { g.globalAlpha = Math.min(1, (.35 + s.z * .65) * tw); var rr = s.r * 3.4; g.drawImage(T.dot[s.k], x - rr, y - rr, rr * 2, rr * 2); }
      else { g.globalAlpha = (.22 + s.z * .78) * tw; g.fillStyle = s.c; g.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2); }
    }
    g.globalCompositeOperation = 'lighter';
    for (i = 0; T.spike && i < spikes.length; i++) {
      var p = spikes[i], yy = ((p.y - ssy * .3 - ppy * 18) % (H * 1.3) + H * 1.3) % (H * 1.3);
      if (yy > H + p.s) continue;
      var a = .55 + .45 * Math.sin(t * .8 + p.ph), sz = p.s * (.85 + .15 * a);
      g.globalAlpha = a; g.drawImage(T.spike[p.k], p.x - ppx * 18 - sz / 2, yy - sz / 2, sz, sz);
    }
    /* dust drifting up through the light */
    if (mv === 1 || RM) for (i = 0; i < dust.length; i++) {
      var q = dust[i];
      if (!once) { q.x += q.vx * (lt ? .066 : .033) * mv; q.y += q.vy * (lt ? .066 : .033) * mv; }
      if (q.y < -4) q.y = H + 4; if (q.x < -4) q.x = W + 4; if (q.x > W + 4) q.x = -4;
      g.globalAlpha = q.a * (.6 + .4 * breath); g.fillStyle = '#cfe0ff'; g.fillRect(q.x, q.y, q.r, q.r);
    }
    if (!RM) {
      /* a falling star every few seconds */
      if (!shoot && t > nextShoot) { shoot = { x: W * (.25 + Math.random() * .75), y: Math.random() * H * .45, vx: -(6 + Math.random() * 6), vy: 2.2 + Math.random() * 2.4, life: 1 }; if (de.dir === 'rtl') { shoot.x = W - shoot.x; shoot.vx = -shoot.vx; } }
      if (shoot) {
        var tl = 20, sc = lt ? 2 : 1, lg = g.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * tl, shoot.y - shoot.vy * tl);
        lg.addColorStop(0, 'rgba(255,255,255,' + .95 * shoot.life + ')'); lg.addColorStop(.3, 'rgba(124,200,255,' + .5 * shoot.life + ')'); lg.addColorStop(1, 'rgba(155,123,255,0)');
        g.globalAlpha = 1; g.strokeStyle = lg; g.lineWidth = 1.6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(shoot.x - shoot.vx * tl, shoot.y - shoot.vy * tl); g.stroke();
        if (!once) { shoot.x += shoot.vx * sc; shoot.y += shoot.vy * sc; shoot.life -= .016 * sc; }
        if (shoot.life <= 0) { shoot = null; nextShoot = t + 3 + Math.random() * 5; }
      }
      /* now and then a star flares up and fades: a nova */
      if (!nova && t > nextNova) nova = { x: W * (.1 + Math.random() * .8), y: H * (.1 + Math.random() * .6), t: t };
      if (nova && T.spike) {
        var age = (t - nova.t) / 4.5;
        if (age >= 1) { nova = null; nextNova = t + 25 + Math.random() * 25; }
        else {
          var fl = age < .15 ? age / .15 : 1 - (age - .15) / .85, ns = 10 + 26 * fl;
          g.globalAlpha = fl; g.drawImage(T.spike[1], nova.x - ns, nova.y - ns, ns * 2, ns * 2);
          g.globalAlpha = (1 - age) * .5; g.strokeStyle = 'rgba(255,207,107,.8)'; g.lineWidth = 1;
          g.beginPath(); g.arc(nova.x, nova.y, 6 + age * 60, 0, TAU); g.stroke();
        }
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (!once && !d.hidden) raf = w.requestAnimationFrame(frame); else if (!once) raf = 0;
  }

  function start() {
    if (cv) return;
    cv = d.createElement('canvas'); cv.className = 'ob-sky'; cv.setAttribute('aria-hidden', 'true');
    d.body.insertBefore(cv, d.body.firstChild);
    g = cv.getContext('2d'); if (!g) return;
    t0 = performance.now();
    var tm = 0;
    w.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(size, 150); });
    w.addEventListener('scroll', function () { sy = w.scrollY || 0; }, { passive: true });
    if (!RM && w.matchMedia && w.matchMedia('(pointer:fine)').matches) {
      w.addEventListener('pointermove', function (e) { tx = (e.clientX / W - .5) * 2; ty = (e.clientY / H - .5) * 2; }, { passive: true });
    }
    d.addEventListener('visibilitychange', function () { if (!d.hidden) wake(); });
    sy = w.scrollY || 0; size();
    raf = w.requestAnimationFrame(frame);
  }
  function wake() { if (!cv || !g) return; frame(performance.now(), true); if (!raf) raf = w.requestAnimationFrame(frame); }
  w.OBSKY = { wake: wake };
  if (d.body) start(); else d.addEventListener('DOMContentLoaded', start);
})();
