/* entekhab.net — a world of its own for every page of the Observatory (owner 2026-11-26: "every page a different space,
   every click something the visitor did not expect"). Drawn on the sky canvas of assets/obs/space.js through window.OBWORLD
   (the scene) and window.OBFX (clicks, the warp between pages). Everything is drawn here, no image is loaded. Ideas from
   NASA and SpaceX: Juno over Jupiter's poles and its aurora, Curiosity's blue sunset on Mars, Europa Clipper looking for
   plumes, Cassini's last dive into Saturn, the aurora and the cities seen from the ISS, Starship, the 1977 "Wow!" signal.
   Reduced motion: the same worlds, slowly, with no warp, no zoom and no sudden events. The switch on the page stops it all. */
(function () {
  'use strict';
  var w = window, d = document, de = d.documentElement, TAU = Math.PI * 2;
  var RM = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function lite() { return de.classList.contains('nx-lite'); }
  function still() { return de.classList.contains('ek-still'); }
  function mk(a, b) { var c = d.createElement('canvas'); c.width = a; c.height = b || a; return c; }
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(k) { k = cl(k, 0, 1); return 1 - Math.pow(1 - k, 3); }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  var s0 = 77;
  function rnd() { s0 = (s0 * 1664525 + 1013904223) >>> 0; return s0 / 4294967296; }
  function field(N, seed, oct, base) {
    var out = new Float32Array(N * N), s = seed >>> 0;
    function r() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    var amp = 1, tot = 0, P = base;
    for (var o = 0; o < oct; o++) {
      var lat = new Float32Array(P * P), i;
      for (i = 0; i < lat.length; i++) lat[i] = r();
      for (var y = 0; y < N; y++) {
        var fy = y / N * P, y0 = Math.floor(fy), ty = fy - y0, y1 = (y0 + 1) % P; ty = ty * ty * (3 - 2 * ty);
        for (var x = 0; x < N; x++) {
          var fx = x / N * P, x0 = Math.floor(fx), tx = fx - x0, x1 = (x0 + 1) % P; tx = tx * tx * (3 - 2 * tx);
          var a = lat[y0 * P + x0], b = lat[y0 * P + x1], c = lat[y1 * P + x0], e = lat[y1 * P + x1];
          out[y * N + x] += amp * ((a + (b - a) * tx) * (1 - ty) + (c + (e - c) * tx) * ty);
        }
      }
      tot += amp; amp *= .5; P *= 2;
    }
    for (i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  function ramp(st, v) {
    for (var i = 1; i < st.length; i++) if (v <= st[i][0]) {
      var a = st[i - 1], b = st[i], k = (v - a[0]) / (b[0] - a[0] || 1);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    }
    var l = st[st.length - 1]; return [l[1], l[2], l[3]];
  }

  /* ---------- which world this page lives in */
  var main = d.getElementById('ob-main'), view = main ? main.getAttribute('data-view') || '' : '';
  /* every page its own place: [world, version]. No two pages share both (owner 2026-11-26: "no repeats") */
  var SCENE = {
    oi: ['jupiter', 'eva'], funding: ['titan', 'day'], ls: ['cockpit', 'earth'], basis: ['moon', 'day'], options: ['deepfield', 'webb'],
    hl: ['blackhole', 'fear'], liqheat: ['sun', ''], liqmap: ['mars', 'storm'], liqhist: ['comet', ''], cvd: ['neptune', ''],
    vprof: ['nebula', 'pillars'], mvrv: ['europa', 'ufo'], flows: ['earth', 'iss'], network: ['saturn', 'close'], thermo: ['moon', 'night'],
    models: ['deepfield', 'lens'], capflow: ['orbit', 'walk'], nvm: ['nebula', 'orion'], hashp: ['orbit', 'rise'], ethsup: ['mars', 'day'],
    pools: ['io', ''], cycle: ['saturn', 'chute'], wave: ['triton', ''], compass: ['blackhole', 'calm'], rotation: ['orbit', 'comet'],
    score: ['cockpit', 'mars'], stables: ['earth', 'aurora'], defi: ['earth', 'cupola'], risk: ['asteroids', ''], scanner: ['mars', 'night'],
    hub: ['launch', ''], sopr: ['titan', 'night'], hodl: ['void', '']
  };
  var SC = SCENE[view] || ['launch', ''];
  var KIND = SC[0];
  de.setAttribute('data-world', KIND);

  /* ---------- a planet: a strip of its surface wrapped on a lit sphere, turned a little every few frames */
  function sphere(D, strip, SW, SH, L, emis) {
    var c = mk(D), x = c.getContext('2d'), im = x.createImageData(D, D), p = im.data;
    var ll = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]); L = [L[0] / ll, L[1] / ll, L[2] / ll];
    var I = [], U = [], V = [], S = [], A = [];
    for (var y = 0; y < D; y++) for (var xx = 0; xx < D; xx++) {
      var nx = (xx + .5) / D * 2 - 1, ny = (y + .5) / D * 2 - 1, r2 = nx * nx + ny * ny;
      if (r2 >= 1) continue;
      var r = Math.sqrt(r2), nz = Math.sqrt(1 - r2);
      I.push(y * D + xx);
      U.push(Math.floor((Math.atan2(nx, nz) / TAU + .25) * SW));
      V.push(Math.min(SH - 1, Math.floor((Math.asin(ny) / Math.PI + .5) * SH)) * SW);
      var l = nx * L[0] + ny * L[1] + nz * L[2], sh = cl(l * 1.15 + .04, 0, 1);
      S.push(Math.pow(sh, .75) * (.5 + .5 * Math.pow(nz, .4)));
      A.push(cl((1 - r) * D * .5, 0, 1) * 255);
    }
    I = new Uint32Array(I); U = new Uint16Array(U); V = new Uint32Array(V); S = new Float32Array(S); A = new Uint8Array(A);
    var n = I.length;
    return { cv: c, draw: function (rot) {
      var off = Math.floor((((rot % 1) + 1) % 1) * SW) % SW;
      for (var k = 0; k < n; k++) {
        var u = U[k] + off; if (u >= SW) u -= SW;
        var si = (V[k] + u) * 4, o = I[k] * 4, sh = S[k], R = strip[si] * sh, G = strip[si + 1] * sh, B = strip[si + 2] * sh;
        if (emis) { var e = 1 - Math.min(1, sh * 5); if (e > 0) { R += emis[si] * e; G += emis[si + 1] * e; B += emis[si + 2] * e; } }
        p[o] = R; p[o + 1] = G; p[o + 2] = B; p[o + 3] = A[k];
      }
      x.putImageData(im, 0, 0);
    } };
  }
  /* Jupiter's belts and zones, the Great Red Spot and the white ovals; Saturn in paler gold */
  var JUP = [[0, 88, 96, 116], [.08, 128, 124, 128], [.15, 186, 170, 150], [.2, 160, 118, 90], [.25, 214, 198, 174], [.31, 154, 102, 74],
    [.37, 226, 212, 190], [.44, 238, 226, 204], [.5, 232, 214, 186], [.55, 190, 150, 112], [.6, 146, 92, 64], [.64, 170, 120, 86],
    [.68, 224, 208, 182], [.74, 180, 138, 104], [.8, 214, 198, 174], [.88, 138, 132, 134], [1, 88, 96, 116]];
  var SAT = [[0, 120, 128, 124], [.1, 170, 164, 136], [.2, 214, 196, 150], [.3, 198, 172, 120], [.4, 230, 212, 168], [.5, 236, 220, 178],
    [.6, 210, 184, 130], [.7, 226, 206, 160], [.8, 196, 174, 128], [.9, 160, 154, 128], [1, 120, 128, 124]];
  function bandStrip(SW, sat) {
    var SH = SW / 2, N = SH, f1 = field(N, sat ? 41 : 11, 4, 4), f2 = field(N, sat ? 53 : 23, 3, 4), px = new Uint8ClampedArray(SW * SH * 4);
    var ov = [[.08, .735], [.21, .728], [.46, .74], [.63, .731], [.83, .738]];
    for (var y = 0; y < SH; y++) {
      var v = y / SH, ry = y * N, lat = Math.abs(v - .5) * 2;
      for (var x = 0; x < SW; x++) {
        var nA = f1[ry + (x >> 1)], nB = f2[((y * 3) % N) * N + (x >> 1)];
        var tw = v + (nA - .5) * (sat ? .014 : .04) * (1 - lat * .5) + Math.sin(x / SW * TAU * 6 + v * 40) * (sat ? .002 : .005);
        var c = ramp(sat ? SAT : JUP, cl(tw, 0, 1)), k = (sat ? .94 : .86) + (sat ? .12 : .26) * nB;
        if (!sat) {
          var dx = x / SW - .3; dx -= Math.round(dx);
          var ex = dx / .055, ey = (v - .655) / .03, e = ex * ex + ey * ey;
          if (e < 2) {
            var m = e < 1 ? Math.pow(1 - e, .45) : 0, ring = Math.exp(-Math.pow((Math.sqrt(e) - 1.08) * 5, 2));
            c = mix(c, [204, 96, 62], m * (.75 + .25 * nA)); c = mix(c, [240, 228, 210], ring * .45);
          }
          for (var o = 0; o < ov.length; o++) {
            var ox = x / SW - ov[o][0]; ox -= Math.round(ox);
            var q = (ox / .014) * (ox / .014) + ((v - ov[o][1]) / .009) * ((v - ov[o][1]) / .009);
            if (q < 1) c = mix(c, [246, 240, 230], Math.pow(1 - q, .6) * .85);
          }
        }
        var i = (y * SW + x) * 4; px[i] = c[0] * k; px[i + 1] = c[1] * k; px[i + 2] = c[2] * k; px[i + 3] = 255;
      }
    }
    return px;
  }
  /* Saturn's rings: the C ring, the bright B ring, the Cassini division, the A ring with the Encke gap, the thin F ring */
  function ringTex(S) {
    var c = mk(S), x = c.getContext('2d'), im = x.createImageData(S, S), p = im.data, h = S / 2, gro = [];
    for (var i = 0; i < 500; i++) gro.push(.72 + rnd() * .56);
    for (var y = 0; y < S; y++) for (var xx = 0; xx < S; xx++) {
      var r = Math.sqrt((xx - h) * (xx - h) + (y - h) * (y - h)) / h, a = 0, col;
      if (r < .52 || r > .99) continue;
      if (r < .62) { a = .2; col = [150, 136, 118]; }
      else if (r < .8) { a = .55 + .35 * (r - .62) / .18; col = [232, 214, 180]; }
      else if (r < .835) { a = .05; col = [150, 140, 130]; }
      else if (r < .955) { a = (r > .925 && r < .932) ? .08 : .6; col = [212, 198, 172]; }
      else if (r > .975 && r < .985) { a = .45; col = [226, 226, 226]; }
      if (!a) continue;
      a *= gro[Math.floor(r * 499)];
      var j = (y * S + xx) * 4; p[j] = col[0]; p[j + 1] = col[1]; p[j + 2] = col[2]; p[j + 3] = cl(a, 0, 1) * 255;
    }
    x.putImageData(im, 0, 0); return c;
  }
  /* a soft vertical ray for the aurora curtains: teal at the foot, violet and pink higher up */
  function rayTex() {
    var c = mk(8, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(94,242,214,0)'); g.addColorStop(.06, 'rgba(94,242,214,.9)'); g.addColorStop(.4, 'rgba(94,242,214,.4)');
    g.addColorStop(.7, 'rgba(155,123,255,.3)'); g.addColorStop(.9, 'rgba(255,111,181,.12)'); g.addColorStop(1, 'rgba(255,111,181,0)');
    x.fillStyle = g; x.fillRect(0, 0, 8, 128);
    var h = x.createLinearGradient(0, 0, 8, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 8, 128);
    return c;
  }

  /* textures built one at a time after the page has opened, so nothing stalls a phone */
  var TX = {}, queued = false;
  function build(list) {
    if (queued) return; queued = true;
    setTimeout(function next() {
      var it = list.shift(); if (!it) return;
      try { TX[it[0]] = it[1](); } catch (e) { TX[it[0]] = null; }
      if (w.OBSKY) w.OBSKY.wake();
      setTimeout(next, 40);
    }, 250);
  }
  var LT = lite(), PD = LT ? 224 : 320, SWJ = LT ? 384 : 512;

  /* ---------- the worlds */
  var lastR = {}, rot = {};
  function turn(key, sp, t, C, every) {
    var s = sp && sp.cv ? sp : null; if (!s) return null;
    var now = C.t, gap = every * (C.lt ? 2 : 1) * (C.RM ? 2.5 : 1);
    if (lastR[key] == null || now - lastR[key] > gap || now < lastR[key]) { s.draw(t); lastR[key] = now; }
    return s.cv;
  }
  function X(C, f) { return (C.rtl ? 1 - f : f) * C.W; }
  /* the window onto the world (.ob-stage, under the title): the scene is laid out in the part of the screen down to its bottom edge,
     so its ground, its craft and its people are seen and not hidden under the panels. STY gives a height inside that window. */
  var stEl = null, stTop = 0, stBot = 0, stAt = -9;
  function stage(C) {
    if (C.t - stAt > .6 || C.t < stAt) {
      stAt = C.t; if (!stEl || !stEl.isConnected) stEl = d.querySelector('.ob-stage');
      if (stEl) { var r = stEl.getBoundingClientRect(), y0 = w.scrollY || 0; stTop = r.top + y0; stBot = r.bottom + y0; } else stTop = stBot = 0;
    }
  }
  function VHof(C) { stage(C); return stBot > 0 ? cl(stBot, C.H * .42, C.H) : C.H; }
  function STY(C, f) { return stBot > 0 && stBot <= C.H + 1 ? stTop + (C.H - stTop) * f : C.H * (.18 + f * .2); }
  function halo(g, x, y, r0, r1, stops) {
    var gr = g.createRadialGradient(x, y, r0, x, y, r1);
    for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
    g.fillStyle = gr; g.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
  }
  function moon(g, x, y, r, col, lx) {
    var gr = g.createRadialGradient(x - lx * r * .4, y - r * .3, r * .1, x, y, r);
    gr.addColorStop(0, col[0]); gr.addColorStop(.75, col[1]); gr.addColorStop(1, col[2]);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  var arrive = 0;   /* page-open zoom of the planet worlds, 0 → 1 */

  var WORLDS = {};

  /* JUPITER — the derivatives pages: the planet swings into view as if the craft were arriving, its moons going round,
     the aurora on its pole in the site's colours, and now and then Juno flashing past */
  WORLDS.jupiter = {
    cfg: { clouds: .5, gal: true, gal2: false, bh: false, wh: false },
    init: function () { build([['jS', function () { return bandStrip(SWJ); }], ['jup', function () { return TX.jS && sphere(PD, TX.jS, SWJ, SWJ / 2, [-.45, -.35, .82]); }]]); },
    juno: null, nextJuno: 14,
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, big = C.small;
      var R = big ? W * .52 : Math.min(H * .42, W * .24), cx = X(C, big ? .8 : .8), cy = big ? H * .86 : H * .66;
      var k = C.RM || C.still ? 1 : ease(arrive);
      var cam = C.RM ? 0 : cl(C.ssy / (H * 2), 0, 1);
      R *= (.16 + .84 * k) * (1 + cam * .16); cx = cx + (X(C, .5) - cx) * (1 - k) * .6 - C.ppx * 14; cy = cy - (cy - H * .2) * (1 - k) - cam * H * .06 - C.ppy * 14;
      var t = C.t, mv = C.mv, L = C.rtl ? 1 : -1;
      var moons = [[1.55, 40, .052, ['#fff3c0', '#e8b84a', '#7a4a12']], [2.05, 75, .046, ['#ffffff', '#d8d0c4', '#5a5248']], [2.75, 140, .07, ['#f0ece6', '#a89c8c', '#3a342e']]];
      var pos = [];
      for (var i = 0; i < moons.length; i++) {
        var m = moons[i], a = t * TAU / m[1] * mv + i * 2.1;
        pos.push([cx + Math.cos(a) * R * m[0], cy + Math.sin(a) * R * m[0] * .16, R * m[2], Math.sin(a) > 0, m[3]]);
      }
      g.globalCompositeOperation = 'source-over';
      for (i = 0; i < pos.length; i++) if (!pos[i][3]) { g.globalAlpha = .9; moon(g, pos[i][0], pos[i][1], pos[i][2], pos[i][4], -L); }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'lighter';
      halo(g, cx, cy, R * .9, R * 1.35, [[0, 'rgba(255,214,170,.16)'], [.4, 'rgba(155,123,255,.06)'], [1, 'rgba(155,123,255,0)']]);
      g.globalCompositeOperation = 'source-over';
      var img = turn('jup', TX.jup, -t / 95 * mv, C, .16);
      if (img) {
        g.imageSmoothingEnabled = true; g.save(); if (C.rtl) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); }
        g.drawImage(img, cx - R, cy - R, R * 2, R * 2);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = .22; g.drawImage(img, cx - R, cy - R, R * 2, R * 2); g.restore();
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
      else { g.fillStyle = '#1a1420'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill(); }
      /* the shadows of the moons crossing the disc */
      for (i = 0; i < pos.length; i++) if (pos[i][3]) {
        var sx = pos[i][0] + L * R * .1, sy = pos[i][1] + R * .06;
        if ((sx - cx) * (sx - cx) + (sy - cy) * (sy - cy) < R * R * .9) { g.globalAlpha = .65; g.fillStyle = '#000'; g.beginPath(); g.arc(sx, sy, pos[i][2] * .8, 0, TAU); g.fill(); }
      }
      g.globalAlpha = 1;
      /* the rim of the atmosphere, then the polar aurora that Hubble and Webb see in ultraviolet and infrared */
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(255,226,190,.22)'; g.lineWidth = Math.max(1.5, R * .02); g.beginPath(); g.arc(cx, cy, R * 1.005, 0, TAU); g.stroke();
      /* the aurora oval sits on the pole, just over the limb: only its near half shows, flickering */
      var ab = .55 + .45 * Math.sin(t * 1.7 * mv) * Math.sin(t * .63 * mv + 1), ax = cx + L * R * .1, ay = cy - R * .955;
      g.save(); g.beginPath(); g.arc(cx, cy, R * 1.06, 0, TAU); g.clip(); g.translate(ax, ay); g.scale(1, .3);
      for (var au = 0; au < 3; au++) {
        g.strokeStyle = au === 0 ? 'rgba(94,242,214,' + (.22 + .3 * ab) + ')' : au === 1 ? 'rgba(124,200,255,' + (.12 + .14 * ab) + ')' : 'rgba(155,123,255,' + (.1 + .12 * ab * C.breath) + ')';
        g.lineWidth = R * (.012 + au * .02); g.beginPath(); g.arc(0, 0, R * (.17 + au * .015), Math.PI * .05, Math.PI * .95); g.stroke();
      }
      g.restore();
      g.globalCompositeOperation = 'source-over';
      for (i = 0; i < pos.length; i++) if (pos[i][3]) moon(g, pos[i][0], pos[i][1], pos[i][2], pos[i][4], -L);
      /* Juno, on its long loop over the poles */
      if (!C.RM && !C.once) {
        if (!this.juno && t > this.nextJuno) this.juno = { t: t };
        if (this.juno) {
          var u = (t - this.juno.t) / 5;
          if (u >= 1) { this.juno = null; this.nextJuno = t + 25 + Math.random() * 25; }
          else {
            var jx = cx + (u * 2.6 - 1.3) * R * (C.rtl ? -1 : 1), jy = cy - R * (1.15 - Math.sin(u * Math.PI) * .35);
            g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(u * Math.PI);
            halo(g, jx, jy, 0, 10, [[0, 'rgba(255,255,255,1)'], [.3, 'rgba(124,200,255,.5)'], [1, 'rgba(124,200,255,0)']]);
            g.strokeStyle = 'rgba(220,236,255,.8)'; g.lineWidth = 1;
            for (var q = 0; q < 3; q++) { var aa = q * TAU / 3 + t; g.beginPath(); g.moveTo(jx, jy); g.lineTo(jx + Math.cos(aa) * 7, jy + Math.sin(aa) * 7); g.stroke(); }
            g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          }
        }
      }
      this.at = [cx, cy, R];
    }
  };

  /* MARS — the liquidation pages: the surface at dusk, the small sun in the blue glow Curiosity photographed, ridges in
     layers, dust running in the wind and, every half minute, a dust storm that darkens the sky before it clears */
  WORLDS.mars = {
    cfg: { clouds: 0, band: false, gal: false, gal2: false, bh: false, wh: false, dust: false, starTop: .55, stars: .75, spikes: false },
    init: function () {},
    rid: null, rw: 0, parts: null, storm: 0, nextStorm: 18, stT: -1, phobos: 0,
    ridges: function (W, H) {
      s0 = 404; var L = [];
      for (var l = 0; l < 3; l++) {
        var pts = [], ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU], n = 120;
        for (var i = 0; i <= n; i++) {
          var u = i / n;
          pts.push(Math.sin(u * 3.1 + ph[0]) * .5 + Math.sin(u * 7.3 + ph[1]) * .3 + Math.sin(u * 17 + ph[2]) * .12 + (rnd() - .5) * .08);
        }
        L.push(pts);
      }
      this.rid = L; this.rw = W;
      var n2 = LT ? 60 : 120; this.parts = [];
      for (var j = 0; j < n2; j++) this.parts.push({ x: rnd() * W, y: H * (.45 + rnd() * .55), s: .5 + rnd(), a: .15 + rnd() * .4 });
    },
    sky: function (C) {
      var g = C.g, W = C.W, H = C.H, hz = H * (C.small ? .8 : .74);
      if (VAR === 'night') {   /* scanner: night on Mars, both moons up, the ground only a shape */
        skyG(C, [[0, '#010208'], [.55, '#060a1c'], [.8, '#141a34'], [1, '#22203a']]);
        this.sun = [X(C, .7), hz + H * .3, 4, .22]; return;
      }
      if (VAR === 'day') {     /* ethsup: noon, the butterscotch sky, the sun small and high */
        skyG(C, [[0, '#3a2418'], [.4, '#8a5a3a'], [.75, '#d0a070'], [1, '#e8c09a']]);
        this.sun = [X(C, .6) - C.ppx * 4, H * .14, Math.max(4, Math.min(W, H) * .01), 1.12]; return;
      }
      var sun = .5 + .5 * Math.cos(C.t * TAU / 150 * C.mv), sh = hz - H * (.04 + .14 * sun), day = .55 + .45 * sun;
      var gr = g.createLinearGradient(0, 0, 0, hz);
      gr.addColorStop(0, '#07050c'); gr.addColorStop(.45, 'rgb(' + (32 * day | 0) + ',' + (16 * day | 0) + ',' + (22 * day | 0) + ')');
      gr.addColorStop(.8, 'rgb(' + (104 * day | 0) + ',' + (56 * day | 0) + ',' + (40 * day | 0) + ')'); gr.addColorStop(1, 'rgb(' + (186 * day | 0) + ',' + (120 * day | 0) + ',' + (78 * day | 0) + ')');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      this.sun = [X(C, .7) - C.ppx * 4, sh, Math.max(4, Math.min(W, H) * .011), day];
    },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv;
      if (!this.rid || this.rw !== W) this.ridges(W, H);
      var hz = H * (C.small ? .8 : .74), S = this.sun;
      /* the storm: builds for a few seconds, holds, then clears */
      if (!C.once && !C.RM && this.stT < 0 && t > this.nextStorm && (VAR === 'storm' || this.asked)) { this.stT = t; this.asked = 0; }
      var sf = 0;
      if (this.stT >= 0) { var u = (t - this.stT) / 9; if (u >= 1) { this.stT = -1; this.nextStorm = t + (VAR === 'storm' ? 8 + Math.random() * 8 : 0); } else sf = u < .3 ? ease(u / .3) : u < .65 ? 1 : 1 - ease((u - .65) / .35); }
      if (C.RM && VAR === 'storm') sf = .25 + .2 * Math.sin(t * TAU / 40);
      this.sf = sf;
      /* the sun and its blue halo */
      g.globalCompositeOperation = 'lighter';
      var sr = S[2], vis = (1 - sf * .75) * (VAR === 'night' ? 0 : 1);
      halo(g, S[0], S[1], 0, sr * 18, [[0, 'rgba(230,240,255,' + .95 * vis + ')'], [.06, 'rgba(170,205,255,' + .55 * vis + ')'], [.22, 'rgba(110,160,240,' + .18 * vis + ')'], [1, 'rgba(90,140,220,0)']]);
      g.fillStyle = 'rgba(255,252,240,' + vis + ')'; g.beginPath(); g.arc(S[0], S[1], sr, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      /* Phobos, crossing the sky */
      var pu = ((t * mv) % 80) / 80;
      if (VAR === 'night') { moon(g, X(C, .2) - C.ppx * 3, H * .16, 9, ['#e8d8c8', '#8a7060', '#2a2018'], C.rtl ? 1 : -1); moon(g, X(C, .46) - C.ppx * 2, H * .09, 4, ['#f0e4d8', '#a08878', '#3a2a20'], C.rtl ? 1 : -1); }
      if (pu < .45) {
        var ppx = X(C, -.05 + pu / .45 * 1.1), ppy = H * (.12 + .1 * Math.sin(pu / .45 * Math.PI));
        g.save(); g.translate(ppx, ppy); g.rotate(.5); g.fillStyle = 'rgba(70,52,46,.95)'; g.beginPath(); g.ellipse(0, 0, 7, 5, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,200,160,.5)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, 7, 5, 0, Math.PI * .9, Math.PI * 1.6); g.stroke(); g.restore();
      }
      /* three ridges, far to near */
      var cols = [[132, 70, 48], [86, 42, 28], [38, 18, 12]], amp = [H * .04, H * .055, H * .07], base = [hz, hz + H * .06, hz + H * .15], par = [4, 9, 18];
      for (var l = 0; l < 3; l++) {
        var P = this.rid[l], n = P.length - 1, c = cols[l], dk = S[3] * (1 - sf * .35);
        g.fillStyle = 'rgb(' + (c[0] * dk | 0) + ',' + (c[1] * dk | 0) + ',' + (c[2] * dk | 0) + ')';
        g.beginPath(); g.moveTo(-20, H);
        for (var i = 0; i <= n; i++) g.lineTo(-20 + (W + 40) * i / n - C.ppx * par[l], base[l] - P[i] * amp[l] - C.ppy * par[l] * .3);
        g.lineTo(W + 20, H); g.closePath(); g.fill();
        if (l === 2) { g.strokeStyle = 'rgba(255,170,110,' + (.18 * S[3]) + ')'; g.lineWidth = 1.2; g.stroke(); }
        if (l === 0) {   /* the haze between the ridges */
          var hg = g.createLinearGradient(0, hz - H * .06, 0, hz + H * .08);
          hg.addColorStop(0, 'rgba(190,120,80,0)'); hg.addColorStop(1, 'rgba(190,120,80,' + (.22 * S[3]) + ')');
          g.fillStyle = hg; g.fillRect(0, hz - H * .06, W, H * .14);
        }
      }
      /* a rover on the near ridge, its mast light blinking */
      var rx = X(C, .16) - C.ppx * 18, ri = Math.round((rx + 20) / (W + 40) * 120), ry = base[2] - this.rid[2][cl(ri, 0, 120)] * amp[2] - C.ppy * 5;
      g.fillStyle = '#140806'; g.fillRect(rx - 9, ry - 7, 18, 5); g.fillRect(rx - 2, ry - 15, 2, 8); g.fillRect(rx - 4, ry - 17, 6, 3);
      for (var wh = -7; wh <= 7; wh += 7) { g.beginPath(); g.arc(rx + wh, ry - 1.5, 2.2, 0, TAU); g.fill(); }
      if (Math.sin(t * 3) > .6 || C.RM) { g.globalCompositeOperation = 'lighter'; halo(g, rx - 1, ry - 16, 0, 6, [[0, 'rgba(94,242,214,.9)'], [1, 'rgba(94,242,214,0)']]); g.globalCompositeOperation = 'source-over'; }
      /* dust in the wind */
      var wind = (34 + 18 * Math.sin(t * .37)) * (1 + sf * 3) * mv * (C.rtl ? -1 : 1), dt = C.once ? 0 : C.dt;
      g.globalCompositeOperation = 'lighter';
      for (i = 0; i < this.parts.length; i++) {
        var q = this.parts[i];
        q.x += wind * q.s * dt; q.y += Math.sin(t * 1.3 + i) * 6 * dt * mv;
        if (q.x > W + 10) q.x = -10; if (q.x < -10) q.x = W + 10;
        g.globalAlpha = q.a * (.5 + sf); g.strokeStyle = 'rgba(236,170,120,1)'; g.lineWidth = q.s;
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - wind * q.s * .06, q.y); g.stroke();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      if (sf > 0) { g.fillStyle = 'rgba(120,62,36,' + (.42 * sf) + ')'; g.fillRect(0, 0, W, H); }
    }
  };

  /* EUROPA — the on-chain pages: standing on the ice of Jupiter's moon, the giant planet half-lit above, plumes of
     water breaking out of the cracks now and then, and something faint that moves under the ice */
  WORLDS.europa = {
    cfg: { clouds: .3, gal: true, gal2: true, bh: false, wh: false, starTop: .8 },
    init: function () {
      build([['jS', function () { return bandStrip(SWJ); }], ['jup', function () { return TX.jS && sphere(PD, TX.jS, SWJ, SWJ / 2, [1, -.15, .28]); }],
        ['glints', function () { s0 = 515; var G = []; for (var i = 0; i < (LT ? 40 : 90); i++) G.push([rnd(), Math.pow(rnd(), 1.6), rnd() * TAU, .6 + rnd() * 1.4]); return G; }]]);
    },
    plumes: [], nextPlume: 7, glow: null, nextGlow: 20,
    plume: function (C, x) {
      var n = C.lt ? 60 : 130, P = [];
      for (var i = 0; i < n; i++) P.push({ x: x, y: 0, vx: (Math.random() - .5) * 36, vy: -(110 + Math.random() * 170) * (C.H / 900), d: Math.random() * .9, a: .4 + Math.random() * .6 });
      this.plumes.push({ t: C.t, P: P, x: x });
    },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv;
      var hz = H * (C.small ? .78 : .72) - (C.RM ? 0 : cl(C.ssy * .03, 0, H * .05));
      /* Jupiter, filling a third of the sky */
      var R = C.small ? W * .42 : Math.min(W, H) * .32, cx = X(C, C.small ? .66 : .74) - C.ppx * 6, cy = (C.small ? H * .25 : H * .3) - C.ppy * 6;
      g.globalCompositeOperation = 'lighter';
      halo(g, cx, cy, R * .95, R * 1.3, [[0, 'rgba(255,220,180,.12)'], [1, 'rgba(255,220,180,0)']]);
      g.globalCompositeOperation = 'source-over';
      var img = turn('jup', TX.jup, -t / 140 * mv, C, .2);
      if (img) { g.save(); if (C.rtl) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); } g.drawImage(img, cx - R, cy - R, R * 2, R * 2); g.restore(); }
      /* the ice: a smooth, dark frozen plain under Jupiter's light, with a few glints. No texture: a picture of the
         ridges laid in perspective strips read as a broken screen (owner 2026-11-26, the thermocap page). */
      var gi = g.createLinearGradient(0, hz, 0, H); gi.addColorStop(0, '#22344c'); gi.addColorStop(.18, '#142238'); gi.addColorStop(1, '#070d1a');
      g.fillStyle = gi; g.fillRect(0, hz, W, H - hz);
      var gl = TX.glints;
      if (gl) {
        g.globalCompositeOperation = 'lighter';
        for (var k = 0; k < gl.length; k++) {
          var Q = gl[k], gy2 = hz + (H - hz) * Q[1], gx2 = ((Q[0] * W - (t * 4 * mv + C.ppx * 20) * (.3 + Q[1])) % W + W) % W;
          var tw = C.RM ? .5 : .5 + .5 * Math.sin(t * Q[3] + Q[2]);
          g.fillStyle = 'rgba(190,225,255,' + (.08 + .3 * tw * (.4 + Q[1] * .6)).toFixed(3) + ')';
          var sz = .8 + Q[1] * 1.6; g.fillRect(gx2, gy2, sz, sz);
        }
        g.globalCompositeOperation = 'source-over';
      }
      var side = g.createLinearGradient(X(C, 1), 0, X(C, 0), 0); side.addColorStop(0, 'rgba(255,214,170,.12)'); side.addColorStop(1, 'rgba(255,214,170,0)');
      g.fillStyle = side; g.fillRect(0, hz, W, H - hz);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(160,200,255,.25)'; g.fillRect(0, hz, W, 1);
      /* what moves under the ice */
      if (!C.once && !this.glow && t > this.nextGlow) this.glow = { t: t, x0: X(C, .1 + Math.random() * .3), x1: X(C, .55 + Math.random() * .35), y: hz + (H - hz) * (.35 + Math.random() * .4) };
      if (this.glow) {
        var G = this.glow, u = (t - G.t) / (C.RM ? 18 : 10);
        if (u >= 1) { this.glow = null; this.nextGlow = t + 30 + Math.random() * 25; }
        else {
          var env = Math.sin(u * Math.PI), gx = G.x0 + (G.x1 - G.x0) * u, gy = G.y + Math.sin(u * 9) * 6;
          for (var j = 0; j < 6; j++) {
            var tx = gx - (G.x1 - G.x0) * .02 * j, al = env * (.45 - j * .06) * (.6 + .4 * Math.sin(t * 4 - j));
            halo(g, tx, gy + Math.sin(u * 9 - j * .5) * 4, 0, 16 - j * 1.6, [[0, 'rgba(94,242,214,' + al + ')'], [1, 'rgba(94,242,214,0)']]);
          }
        }
      }
      /* the plumes */
      if (!C.once && !C.RM && t > this.nextPlume) { this.plume(C, X(C, .15 + Math.random() * .7)); this.nextPlume = t + 14 + Math.random() * 12; }
      for (var p = this.plumes.length - 1; p >= 0; p--) {
        var PL = this.plumes[p], age = t - PL.t;
        if (age > 6) { this.plumes.splice(p, 1); continue; }
        halo(g, PL.x, hz, 0, 40, [[0, 'rgba(200,230,255,' + (.35 * (1 - age / 6)) + ')'], [1, 'rgba(200,230,255,0)']]);
        g.fillStyle = 'rgb(214,236,255)';
        for (j = 0; j < PL.P.length; j++) {
          var q = PL.P[j], a2 = age - q.d; if (a2 < 0) continue;
          var qx = q.x + q.vx * a2, qy = hz + q.vy * a2 + 28 * (C.H / 900) * a2 * a2;
          if (qy > hz) continue;
          g.globalAlpha = q.a * cl(1 - a2 / 5, 0, 1); g.fillRect(qx, qy, 1.4, 1.4);
        }
        g.globalAlpha = 1;
      }
      g.globalCompositeOperation = 'source-over';
      this.hz = hz;
    }
  };

  /* SATURN — the cycle pages: the ringed planet and Titan in its haze, and now and then a small light diving into the
     clouds, the way Cassini ended its mission in 2017 */
  WORLDS.saturn = {
    cfg: { clouds: .4, gal: true, gal2: true, bh: false, wh: false },
    init: function () { build([['sS', function () { return bandStrip(SWJ, true); }], ['sat', function () { return TX.sS && sphere(LT ? 200 : 288, TX.sS, SWJ, SWJ / 2, [-.5, -.4, .77]); }], ['ring', function () { s0 = 616; return ringTex(LT ? 640 : 1024); }]]); },
    dive: null, nextDive: 16,
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv;
      var R = C.small ? W * .2 : Math.min(W, H) * .15, cx = X(C, C.small ? .68 : .74) - C.ppx * 10, cy = (C.small ? H * .24 : H * .36) - C.ppy * 10;
      if (VAR === 'close') { R *= C.small ? 1.5 : 2.1; cx = X(C, C.small ? .6 : .66) - C.ppx * 10; cy = H * (C.small ? .3 : .48) - C.ppy * 10; }
      if (!C.RM) { var cam = cl(C.ssy / (H * 2), 0, 1); R *= 1 + cam * .25; cy -= cam * H * .05; }
      var ang = (C.rtl ? .36 : -.36) + Math.sin(t * TAU / 200 * mv) * .03, tilt = .24, Rr = R * 2.3, ring = TX.ring;
      /* Titan, far out */
      var ta = t * TAU / 160 * mv, tx = cx + Math.cos(ta) * R * 4.6, ty = cy + Math.sin(ta) * R * 4.6 * .2, tr = Math.max(2.5, R * .07);
      g.globalCompositeOperation = 'lighter'; halo(g, tx, ty, tr * .8, tr * 2.4, [[0, 'rgba(255,190,110,.35)'], [1, 'rgba(255,190,110,0)']]);
      g.globalCompositeOperation = 'source-over'; moon(g, tx, ty, tr, ['#ffd9a0', '#d8943c', '#6a3a10'], -1);
      function half(top) {
        if (!ring) return;
        g.save(); g.translate(cx, cy); g.rotate(ang); g.beginPath();
        if (top) g.rect(-Rr - 2, -Rr * tilt - 2, Rr * 2 + 4, Rr * tilt + 2); else g.rect(-Rr - 2, 0, Rr * 2 + 4, Rr * tilt + 2);
        g.clip(); g.scale(1, tilt); g.globalAlpha = top ? .85 : 1; g.drawImage(ring, -Rr, -Rr, Rr * 2, Rr * 2); g.restore(); g.globalAlpha = 1;
      }
      half(true);
      var img = turn('sat', TX.sat, t / 110 * mv, C, .3);
      if (img) { g.save(); if (C.rtl) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); } g.drawImage(img, cx - R, cy - R, R * 2, R * 2); g.restore(); }
      /* the shadow of the rings across the globe */
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip(); g.translate(cx, cy); g.rotate(ang); g.scale(1, tilt);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = R * .5; g.beginPath(); g.arc(0, R * .9, R * 1.5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.restore();
      half(false);
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(255,236,200,.16)'; g.lineWidth = Math.max(1, R * .02); g.beginPath(); g.arc(cx, cy, R * 1.01, 0, TAU); g.stroke();
      /* the last dive */
      if (!C.once && !C.RM) {
        if (!this.dive && t > this.nextDive) this.dive = { t: t, x0: X(C, Math.random() < .5 ? .1 : .4), y0: H * .05 };
        if (this.dive) {
          var D = this.dive, u = (t - D.t) / 4.5;
          if (u >= 1.6) { this.dive = null; this.nextDive = t + 35 + Math.random() * 25; }
          else if (u < 1) {
            var ex = cx - R * .3 * (C.rtl ? -1 : 1), ey = cy - R * .92, k = ease(u), bx = D.x0 + (ex - D.x0) * k, by = D.y0 + (ey - D.y0) * k * k;
            var tg = g.createLinearGradient(bx, by, D.x0 + (ex - D.x0) * k * .7, D.y0 + (ey - D.y0) * k * k * .5);
            tg.addColorStop(0, 'rgba(255,240,214,.9)'); tg.addColorStop(1, 'rgba(255,240,214,0)');
            g.strokeStyle = tg; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx, by); g.lineTo(D.x0 + (ex - D.x0) * k * .7, D.y0 + (ey - D.y0) * k * k * .5); g.stroke();
            halo(g, bx, by, 0, 6, [[0, 'rgba(255,255,255,.95)'], [1, 'rgba(255,255,255,0)']]);
          } else {
            var f = 1 - (u - 1) / .6;
            halo(g, cx - R * .3 * (C.rtl ? -1 : 1), cy - R * .92, 0, R * .25, [[0, 'rgba(255,214,160,' + .6 * f + ')'], [1, 'rgba(255,111,181,0)']]);
          }
        }
      }
      g.globalCompositeOperation = 'source-over';
    }
  };

  /* EARTH — the stablecoin, DeFi, risk and scanner pages: in orbit over the night side, the cities' lights going by,
     the aurora dancing along the edge of the planet, the station passing, and a sunrise breaking over the rim */
  WORLDS.earth = {
    cfg: { clouds: .35, gal: true, gal2: false, bh: false, wh: false },
    init: function () { build([['ray', rayTex]]); },
    city: null, cw: 0, sunrise: null, nextRise: 12, iss: null, nextIss: 6,
    cities: function (C) {
      s0 = 818; var N = C.lt ? 380 : 760, f = field(128, 919, 4, 4), P = [];
      while (P.length < N) {
        var u = rnd(), v = rnd(), n = f[Math.floor(v * 127) * 128 + Math.floor(u * 127)];
        if (n < .52 || rnd() > (n - .5) * 3) continue;
        P.push([u, v, .6 + rnd() * 1.1, rnd() * TAU]);
      }
      this.city = P; this.cw = C.W;
    },
    rise: function (C) { this.sunrise = { t: C.t }; },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv;
      if (!this.city || this.cw !== W) this.cities(C);
      var R = Math.max(W, H) * (C.small ? 2.2 : 1.5), top = H * (C.small ? .8 : .78) - (C.RM ? 0 : cl(C.ssy * .04, 0, H * .08)) - C.ppy * 6;
      var cx = W / 2 - C.ppx * 8, cy = top + R, A = Math.asin(Math.min(1, (W * .65) / R));
      /* the night side */
      var gr = g.createRadialGradient(cx, cy, R * .96, cx, cy, R);
      gr.addColorStop(0, '#010208'); gr.addColorStop(1, '#071434');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      /* cities going by */
      var depth = H - top + 10, spin = t / 260 * mv;
      g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < this.city.length; i++) {
        var p = this.city[i], u = ((p[0] + spin) % 1) * 2 - 1, an = u * A, q = Math.pow(p[1], 1.6), rr = R - q * depth * 1.15;
        var x = cx + Math.sin(an) * rr, y = cy - Math.cos(an) * rr;
        if (y < top - 2 || y > H || x < -4 || x > W + 4) continue;
        g.globalAlpha = cl(p[1] * 8, 0, 1) * (.55 + .3 * Math.sin(t * .7 + p[3]));
        g.fillStyle = p[2] > 1.4 ? '#ffe2a8' : '#ffcf6b'; g.fillRect(x, y, p[2], p[2]);
      }
      g.globalAlpha = 1;
      /* the thin blue line of the atmosphere */
      g.strokeStyle = 'rgba(124,200,255,.12)'; g.lineWidth = 22; g.beginPath(); g.arc(cx, cy, R + 8, -Math.PI / 2 - A, -Math.PI / 2 + A); g.stroke();
      g.strokeStyle = 'rgba(94,170,255,.42)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R + 1.5, -Math.PI / 2 - A, -Math.PI / 2 + A); g.stroke();
      /* the aurora: curtains of light along the rim */
      var ray = TX.ray;
      if (ray) {
        var dpr = C.dpr, M = (C.lt ? 36 : 64) * (VAR === 'aurora' ? 1.5 : 1) | 0, cur = [[-.55, -.18, 0], [-.05, .28, 2.2], [.34, .62, 4.1]];
        for (var c = 0; c < cur.length; c++) {
          var a0 = cur[c][0] * A, a1 = cur[c][1] * A, ph = cur[c][2];
          for (var j = 0; j < M; j++) {
            var k = j / M, env = Math.sin(k * Math.PI), an2 = a0 + (a1 - a0) * k + Math.sin(t * .25 * mv + k * 6 + ph) * .012 * A;
            var hgt = (40 + 90 * env) * (.55 + .45 * Math.sin(k * 23 + t * 1.1 * mv + ph)) * (C.small ? .7 : 1);
            var bx = cx + Math.sin(an2) * (R + 4), by = cy - Math.cos(an2) * (R + 4);
            g.globalAlpha = Math.min(1, env * (.35 + .3 * C.breath) * (VAR === 'aurora' ? 1.9 : 1));
            var co = Math.cos(an2), si = Math.sin(an2);
            g.setTransform(dpr * co, dpr * si, -dpr * si, dpr * co, dpr * bx, dpr * by);
            g.drawImage(ray, -4, -hgt, 8, hgt);
          }
        }
        g.setTransform(C.dpr, 0, 0, C.dpr, 0, 0); g.globalAlpha = 1;
      }
      /* sunrise over the rim, about once a minute */
      if (!C.once && !C.RM && !this.sunrise && t > this.nextRise) this.rise(C);
      if (this.sunrise) {
        var su = (t - this.sunrise.t) / 9;
        if (su >= 1) { this.sunrise = null; this.nextRise = t + 50 + Math.random() * 30; }
        else {
          var fe = su < .35 ? ease(su / .35) : 1 - ease((su - .35) / .65), sa = (C.rtl ? .82 : -.82) * A, sx = cx + Math.sin(sa) * (R + 2), sy = cy - Math.cos(sa) * (R + 2);
          halo(g, sx, sy, 0, H * .5, [[0, 'rgba(255,250,236,' + .9 * fe + ')'], [.05, 'rgba(255,207,107,' + .55 * fe + ')'], [.3, 'rgba(255,111,181,' + .14 * fe + ')'], [1, 'rgba(155,123,255,0)']]);
          var lg = g.createLinearGradient(sx - W * .5, sy, sx + W * .5, sy);
          lg.addColorStop(0, 'rgba(255,230,190,0)'); lg.addColorStop(.5, 'rgba(255,230,190,' + .6 * fe + ')'); lg.addColorStop(1, 'rgba(255,230,190,0)');
          g.fillStyle = lg; g.fillRect(sx - W * .5, sy - 1, W, 2);
          g.strokeStyle = 'rgba(255,190,120,' + .5 * fe + ')'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R + 2, sa - .25 * A, sa + .25 * A); g.stroke();
        }
      }
      /* the station */
      if (!C.once && !this.iss && t > this.nextIss) this.iss = { t: t };
      if (this.iss) {
        var iu = (t - this.iss.t) / (C.RM ? 40 : 16);
        if (iu >= 1) { this.iss = null; this.nextIss = t + 20 + Math.random() * 25; }
        else {
          var ix = X(C, -.05 + iu * 1.1), iy = top - H * (.1 + .05 * Math.sin(iu * Math.PI));
          g.globalAlpha = Math.sin(iu * Math.PI);
          halo(g, ix, iy, 0, 7, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
          g.fillStyle = 'rgba(220,230,255,.85)'; g.fillRect(ix - 6, iy - .5, 12, 1); g.fillRect(ix - .5, iy - 2.5, 1, 5);
          g.globalAlpha = 1;
        }
      }
      g.globalCompositeOperation = 'source-over';
      this.top = top;
    }
  };


  /* ---------- the cast: astronauts and craft, drawn by hand (owner 2026-11-26: "I saw no astronaut, no craft whose door
     opened"). Each takes a position, a size and the time; nothing here allocates more than a gradient or two a frame. */
  function rr(g, x, y, ww, hh, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r);
    g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath();
  }
  function blink(g, x, y, r, col, on) {
    if (!on) return; g.globalCompositeOperation = 'lighter';
    halo(g, x, y, 0, r, [[0, 'rgba(' + col + ',1)'], [.35, 'rgba(' + col + ',.5)'], [1, 'rgba(' + col + ',0)']]);
    g.globalCompositeOperation = 'source-over';
  }
  /* an astronaut in a white suit with a gold visor. o: t, wave (arm up and waving), walk, float, flag, lamp, tether [x,y],
     tint (a shade over the suit: night, dusk), flip */
  function astro(g, x, y, s, ang, o) {
    o = o || {}; var u = s / 10, t = o.t || 0;
    if (o.tether) {
      g.strokeStyle = 'rgba(230,236,248,.75)'; g.lineWidth = Math.max(1, u * .35); g.beginPath(); g.moveTo(x, y);
      var tx = o.tether[0], ty = o.tether[1], mx = (x + tx) / 2 + Math.sin(t * .7) * s * .8, my = (y + ty) / 2 + s * 1.2 + Math.cos(t * .5) * s * .4;
      g.quadraticCurveTo(mx, my, tx, ty); g.stroke();
    }
    g.save(); g.translate(x, y); g.rotate(ang || 0); if (o.flip) g.scale(-1, 1);
    var suit = g.createLinearGradient(-6 * u, -4 * u, 6 * u, 4 * u);
    suit.addColorStop(0, '#8f98ab'); suit.addColorStop(.42, '#f6f8fc'); suit.addColorStop(1, '#a9b1c2');
    g.fillStyle = '#c3c9d4'; rr(g, -5.6 * u, -6.4 * u, 11.2 * u, 11 * u, 2 * u); g.fill();               /* the backpack */
    var lk = o.walk ? Math.sin(t * 3.2) * .38 : o.float ? Math.sin(t * .7) * .22 : o.hop ? -.25 : 0;
    function leg(lx, a) {
      g.save(); g.translate(lx, 4.6 * u); g.rotate(a); g.fillStyle = suit; rr(g, -1.9 * u, 0, 3.8 * u, 8.8 * u, 1.7 * u); g.fill();
      g.fillStyle = '#7d8597'; rr(g, -2.1 * u, 7.4 * u, 4.4 * u, 2.3 * u, 1.1 * u); g.fill(); g.restore();
    }
    leg(-2.2 * u, lk); leg(2.2 * u, o.hop ? .25 : -lk);
    g.fillStyle = suit; rr(g, -4.6 * u, -5.4 * u, 9.2 * u, 11.4 * u, 3.2 * u); g.fill();                 /* the torso */
    g.fillStyle = '#d5dae3'; rr(g, -2.7 * u, -1.6 * u, 5.4 * u, 3.1 * u, .8 * u); g.fill();
    g.fillStyle = '#5ef2d6'; g.fillRect(-1.9 * u, -.9 * u, 1 * u, .9 * u); g.fillStyle = Math.sin(t * 5) > 0 ? '#ff4f9a' : '#5a2040'; g.fillRect(.6 * u, -.9 * u, 1 * u, .9 * u);
    g.fillStyle = '#9b7bff'; g.beginPath(); g.arc(-2.6 * u, -3.6 * u, .9 * u, 0, TAU); g.fill();       /* the patch: the site's colours */
    function arm(sx, a) {
      g.save(); g.translate(sx, -3.6 * u); g.rotate(a); g.fillStyle = suit; rr(g, -1.6 * u, -.6 * u, 3.2 * u, 7.8 * u, 1.5 * u); g.fill();
      g.fillStyle = '#e8ecf3'; g.beginPath(); g.arc(0, 7.6 * u, 1.55 * u, 0, TAU); g.fill(); g.restore();
    }
    var aL = o.float ? .5 + Math.sin(t * .8 + 1) * .35 : o.walk ? .2 + Math.sin(t * 3.2) * .3 : .32;
    var aR = o.wave != null ? -2.55 + Math.sin(t * 5 + o.wave) * .42 : o.flag ? -2.9 : o.float ? -.7 + Math.sin(t * .9) * .35 : o.walk ? -.2 - Math.sin(t * 3.2) * .3 : -.32;
    arm(-4.4 * u, aL); arm(4.4 * u, aR);
    if (o.flag) {      /* a flag in the site's colours: teal into violet, with a star */
      var px = 4.4 * u + Math.sin(-aR) * 7.6 * u, py = -3.6 * u + Math.cos(-aR) * 7.6 * u;
      g.strokeStyle = '#dfe4ee'; g.lineWidth = Math.max(1, u * .5); g.beginPath(); g.moveTo(px, py + 6 * u); g.lineTo(px, py - 16 * u); g.stroke();
      var fg = g.createLinearGradient(px, 0, px + 12 * u, 0); fg.addColorStop(0, '#5ef2d6'); fg.addColorStop(1, '#9b7bff');
      g.fillStyle = fg; g.beginPath(); g.moveTo(px, py - 16 * u);
      for (var k = 0; k <= 6; k++) g.lineTo(px + k * 2 * u, py - 16 * u + Math.sin(t * 2.4 + k * .9) * u * .7 * (k / 6));
      for (k = 6; k >= 0; k--) g.lineTo(px + k * 2 * u, py - 9 * u + Math.sin(t * 2.4 + k * .9) * u * .7 * (k / 6));
      g.closePath(); g.fill();
      g.fillStyle = '#ffcf6b'; g.beginPath(); g.arc(px + 5 * u, py - 12.5 * u + Math.sin(t * 2.4 + 2.2) * u * .3, 1.2 * u, 0, TAU); g.fill();
    }
    var hg = g.createRadialGradient(-1.4 * u, -10 * u, .4 * u, 0, -8.4 * u, 4.6 * u);
    hg.addColorStop(0, '#ffffff'); hg.addColorStop(.7, '#e2e6ee'); hg.addColorStop(1, '#9aa2b2');
    g.fillStyle = hg; g.beginPath(); g.arc(0, -8.4 * u, 4.4 * u, 0, TAU); g.fill();                  /* the helmet */
    var vg = g.createLinearGradient(-3 * u, -11 * u, 3 * u, -6 * u);
    vg.addColorStop(0, '#ffe7a3'); vg.addColorStop(.35, '#d99a2b'); vg.addColorStop(.75, '#6a3a0a'); vg.addColorStop(1, '#2a1404');
    g.fillStyle = vg; g.beginPath(); g.ellipse(.7 * u, -8.2 * u, 3.3 * u, 2.7 * u, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-.4 * u, -9.4 * u, 1.3 * u, .55 * u, -.5, 0, TAU); g.fill();
    if (o.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = o.tint; g.fillRect(-8 * u, -14 * u, 16 * u, 30 * u); g.globalCompositeOperation = 'source-over'; }
    g.restore();
    if (o.lamp) {      /* a headlamp, its beam on whatever is ahead */
      var la = (ang || 0) + (o.flip ? Math.PI : 0) + (o.lampA || 0), hx = x + Math.sin(ang || 0) * 8.4 * u, hy = y - Math.cos(ang || 0) * 8.4 * u, L2 = s * 9;
      g.globalCompositeOperation = 'lighter';
      var bg2 = g.createLinearGradient(hx, hy, hx + Math.cos(la) * L2, hy + Math.sin(la) * L2);
      bg2.addColorStop(0, 'rgba(230,244,255,.45)'); bg2.addColorStop(1, 'rgba(230,244,255,0)');
      g.fillStyle = bg2; g.beginPath(); g.moveTo(hx, hy);
      g.lineTo(hx + Math.cos(la - .22) * L2, hy + Math.sin(la - .22) * L2); g.lineTo(hx + Math.cos(la + .22) * L2, hy + Math.sin(la + .22) * L2); g.fill();
      halo(g, hx, hy, 0, u * 3, [[0, 'rgba(255,255,255,.95)'], [1, 'rgba(255,255,255,0)']]);
      g.globalCompositeOperation = 'source-over';
    }
  }
  /* a crew capsule: the cone, the heat shield, a lit window and now and then a puff from a thruster */
  function capsule(g, x, y, s, ang, t, open) {
    g.save(); g.translate(x, y); g.rotate(ang);
    var bg = g.createLinearGradient(-s * .7, 0, s * .7, 0); bg.addColorStop(0, '#59606f'); bg.addColorStop(.45, '#eef1f7'); bg.addColorStop(1, '#727a8c');
    g.fillStyle = bg; g.beginPath(); g.moveTo(-s * .28, -s * .55); g.lineTo(s * .28, -s * .55); g.lineTo(s * .7, s * .45); g.lineTo(-s * .7, s * .45); g.closePath(); g.fill();
    g.fillStyle = '#3a2a22'; g.beginPath(); g.ellipse(0, s * .46, s * .72, s * .12, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#c9ced8'; g.fillRect(-s * .2, -s * .72, s * .4, s * .18);
    g.fillStyle = '#20263a'; g.beginPath(); g.moveTo(-s * .18, -s * .2); g.lineTo(s * .05, -s * .2); g.lineTo(s * .02, 0); g.lineTo(-s * .22, 0); g.fill();
    blink(g, -s * .08, -s * .1, s * .25, '255,207,107', true);
    if (open) {    /* the side hatch, open, light spilling out */
      g.fillStyle = '#0c0f1a'; g.beginPath(); g.moveTo(s * .2, -s * .1); g.lineTo(s * .46, -s * .1); g.lineTo(s * .58, s * .3); g.lineTo(s * .28, s * .3); g.fill();
      g.globalCompositeOperation = 'lighter'; halo(g, s * .4, s * .1, 0, s * .5, [[0, 'rgba(255,230,180,.55)'], [1, 'rgba(255,230,180,0)']]); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#d6dbe4'; g.save(); g.translate(s * .46, -s * .1); g.rotate(-.9 + Math.sin(t * .6) * .05); g.fillRect(0, 0, s * .3, s * .42); g.restore();
    }
    if (Math.sin(t * 1.3) > .93) { g.globalCompositeOperation = 'lighter'; halo(g, -s * .62, s * .1, 0, s * .3, [[0, 'rgba(255,255,255,.8)'], [1, 'rgba(200,220,255,0)']]); g.globalCompositeOperation = 'source-over'; }
    g.restore();
  }
  /* a station: modules along a truss, four pairs of golden solar wings, a light that blinks */
  function station(g, x, y, s, ang, t, sun) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#9aa1b0'; g.fillRect(-s * 1.6, -s * .035, s * 3.2, s * .07);
    for (var i = 0; i < 4; i++) {
      var wx = -s * 1.45 + i * s * .82 + (i > 1 ? s * .24 : 0);
      for (var j = -1; j <= 1; j += 2) {
        var sg = g.createLinearGradient(wx, j * s * .08, wx, j * s * .62); sg.addColorStop(0, '#6a4a18'); sg.addColorStop(.5, sun ? '#ffd58a' : '#c08a32'); sg.addColorStop(1, '#5a3a12');
        g.fillStyle = sg; g.fillRect(wx, j > 0 ? s * .08 : -s * .62, s * .2, s * .54);
        g.fillStyle = 'rgba(20,12,4,.55)'; g.fillRect(wx + s * .098, j > 0 ? s * .08 : -s * .62, s * .006, s * .54);
      }
    }
    var mg = g.createLinearGradient(0, -s * .12, 0, s * .12); mg.addColorStop(0, '#f2f4f8'); mg.addColorStop(1, '#7c8394');
    g.fillStyle = mg; rr(g, -s * .5, -s * .11, s * 1, s * .22, s * .1); g.fill(); rr(g, -s * .1, -s * .38, s * .2, s * .76, s * .08); g.fill();
    g.fillStyle = '#e9edf4'; g.fillRect(s * .55, -s * .2, s * .26, s * .14); g.fillRect(-s * .8, s * .06, s * .24, s * .14);
    blink(g, s * .5, 0, s * .12, '255,79,154', Math.sin(t * 3) > .7);
    g.restore();
  }
  /* a lunar lander: the gold descent stage on four legs, the grey cabin above */
  function lander(g, x, y, s, t) {
    g.strokeStyle = '#b8bfcc'; g.lineWidth = Math.max(1, s * .04);
    for (var k = -1; k <= 1; k += 2) { g.beginPath(); g.moveTo(x + k * s * .4, y - s * .55); g.lineTo(x + k * s * .85, y); g.stroke(); g.beginPath(); g.ellipse(x + k * s * .85, y, s * .12, s * .03, 0, 0, TAU); g.stroke(); }
    var gd = g.createLinearGradient(x - s * .5, 0, x + s * .5, 0); gd.addColorStop(0, '#6a4510'); gd.addColorStop(.4, '#ffd27a'); gd.addColorStop(.7, '#c08a32'); gd.addColorStop(1, '#4a2e08');
    g.fillStyle = gd; g.beginPath(); g.moveTo(x - s * .5, y - s * .35); g.lineTo(x - s * .38, y - s * .78); g.lineTo(x + s * .38, y - s * .78); g.lineTo(x + s * .5, y - s * .35); g.closePath(); g.fill();
    var ag = g.createLinearGradient(x - s * .4, 0, x + s * .4, 0); ag.addColorStop(0, '#5a6070'); ag.addColorStop(.5, '#d8dce4'); ag.addColorStop(1, '#6a7080');
    g.fillStyle = ag; g.beginPath(); g.moveTo(x - s * .36, y - s * .78); g.lineTo(x - s * .3, y - s * 1.2); g.lineTo(x + s * .05, y - s * 1.32); g.lineTo(x + s * .36, y - s * 1.12); g.lineTo(x + s * .36, y - s * .78); g.fill();
    g.fillStyle = '#141826'; g.beginPath(); g.moveTo(x - s * .22, y - s * 1.05); g.lineTo(x - s * .04, y - s * 1.12); g.lineTo(x - s * .06, y - s * .95); g.fill();
    g.strokeStyle = '#dfe4ee'; g.beginPath(); g.moveTo(x + s * .3, y - s * 1.2); g.lineTo(x + s * .42, y - s * 1.42); g.stroke();
    blink(g, x + s * .42, y - s * 1.42, s * .1, '94,242,214', Math.sin(t * 2.2) > .5);
  }
  function rover(g, x, y, s, t, dark) {
    g.fillStyle = dark || '#c9ccd4';
    g.fillRect(x - s * .6, y - s * .55, s * 1.2, s * .28); g.fillRect(x + s * .3, y - s * 1.15, s * .06, s * .6); g.fillRect(x + s * .2, y - s * 1.25, s * .3, s * .14);
    g.fillStyle = dark || '#3a3e4a'; for (var k = -1; k <= 1; k++) { g.beginPath(); g.arc(x + k * s * .5, y - s * .14, s * .14, 0, TAU); g.fill(); }
    blink(g, x + s * .45, y - s * 1.18, s * .14, '94,242,214', Math.sin(t * 3) > .5);
  }
  /* a small helicopter: two rotors turning, four thin legs, a solar panel on top */
  function heli(g, x, y, s, t) {
    g.fillStyle = '#2a2018'; rr(g, x - s * .22, y - s * .2, s * .44, s * .3, s * .05); g.fill();
    g.strokeStyle = '#2a2018'; g.lineWidth = Math.max(1, s * .03);
    for (var k = -1; k <= 1; k += 2) { g.beginPath(); g.moveTo(x + k * s * .15, y + s * .1); g.lineTo(x + k * s * .42, y + s * .42); g.stroke(); }
    g.fillRect(x - s * .015, y - s * .75, s * .03, s * .55);
    var b1 = Math.abs(Math.cos(t * 31)), b2 = Math.abs(Math.sin(t * 29));
    g.fillStyle = 'rgba(40,30,24,.85)'; g.fillRect(x - s * .65 * b1, y - s * .6, s * 1.3 * b1, s * .04); g.fillRect(x - s * .65 * b2, y - s * .74, s * 1.3 * b2, s * .04);
    g.fillStyle = '#26304a'; g.fillRect(x - s * .18, y - s * .82, s * .36, s * .07);
  }
  /* the Webb telescope: eighteen gold mirrors in a honeycomb, the arms to the small mirror, the violet sunshield */
  function webb(g, x, y, s, ang, t) {
    g.save(); g.translate(x, y); g.rotate(ang);
    var sh = [[0, '#8a7ab8'], [.5, '#d8d0f0'], [1, '#6a5a98']];
    for (var L = 0; L < 4; L++) {
      var sg = g.createLinearGradient(-s * 1.6, 0, s * 1.6, 0); for (var q = 0; q < 3; q++) sg.addColorStop(sh[q][0], sh[q][1]);
      g.globalAlpha = .55 + L * .1; g.fillStyle = sg; g.beginPath();
      g.moveTo(-s * (1.7 - L * .08), s * (.85 + L * .06)); g.lineTo(0, s * (.55 + L * .06)); g.lineTo(s * (1.7 - L * .08), s * (.85 + L * .06)); g.lineTo(0, s * (1.2 + L * .06)); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    var h = s * .19, P = [[0, -2], [1, -2], [-1, -1], [1, -1], [2, -1], [-2, 0], [-1, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, -1], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, -3]];
    for (var i = 0; i < 18; i++) {
      var ax = P[i][0], ay = P[i][1], cx = (ax + ay * .5) * h * 1.74 - h * .4, cy = ay * h * 1.5 - s * .1;
      var gg = g.createLinearGradient(cx - h, cy - h, cx + h, cy + h); var sp = .5 + .5 * Math.sin(t * .9 + i);
      gg.addColorStop(0, '#fff2b8'); gg.addColorStop(.4 + sp * .2, '#e2a63a'); gg.addColorStop(1, '#6a3c08');
      g.fillStyle = gg; g.beginPath();
      for (var k = 0; k < 6; k++) { var a = k * TAU / 6 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * h * .97, cy + Math.sin(a) * h * .97); }
      g.closePath(); g.fill();
    }
    g.strokeStyle = '#c8ccd8'; g.lineWidth = Math.max(1, s * .02);
    for (k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(k * s * .5, k ? s * .2 : -s * .7); g.lineTo(0, -s * 1.15); g.stroke(); }
    g.fillStyle = '#e8ecf3'; g.beginPath(); g.arc(0, -s * 1.15, s * .07, 0, TAU); g.fill();
    g.restore();
  }
  /* Cassini: the white dish, the gold body, the long boom */
  function cassini(g, x, y, s, ang) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.strokeStyle = '#c8ccd8'; g.lineWidth = Math.max(1, s * .03); g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 2.2, s * .5); g.stroke();
    var gb = g.createLinearGradient(-s * .3, 0, s * .3, 0); gb.addColorStop(0, '#5a3a10'); gb.addColorStop(.5, '#ffd27a'); gb.addColorStop(1, '#6a4510');
    g.fillStyle = gb; g.fillRect(-s * .25, -s * .2, s * .5, s * 1.1);
    g.fillStyle = '#3a3e4a'; g.fillRect(-s * .12, s * .9, s * .24, s * .3);
    var dg = g.createRadialGradient(-s * .2, -s * .5, 0, 0, -s * .4, s * .75); dg.addColorStop(0, '#ffffff'); dg.addColorStop(1, '#9aa2b2');
    g.fillStyle = dg; g.beginPath(); g.ellipse(0, -s * .38, s * .72, s * .2, 0, 0, TAU); g.fill();
    g.fillStyle = '#d8dce4'; g.beginPath(); g.arc(s * .35, s * .4, s * .16, 0, TAU); g.fill();
    g.restore();
  }
  /* a deep-space probe: a dish that looks home, a boom, a power unit */
  function probe(g, x, y, s, ang, t) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.strokeStyle = '#c8ccd8'; g.lineWidth = Math.max(1, s * .03);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-s * 1.6, s * .4); g.moveTo(0, 0); g.lineTo(s * 1.3, s * .6); g.moveTo(0, 0); g.lineTo(s * .2, -s * 1.8); g.stroke();
    g.fillStyle = '#7a808e'; g.fillRect(s * 1.2, s * .5, s * .35, s * .2);
    var dg = g.createRadialGradient(-s * .15, -s * .15, 0, 0, 0, s * .7); dg.addColorStop(0, '#ffffff'); dg.addColorStop(.8, '#c8ccd8'); dg.addColorStop(1, '#6a7080');
    g.fillStyle = dg; g.beginPath(); g.arc(0, 0, s * .62, 0, TAU); g.fill();
    g.fillStyle = '#5a6070'; g.beginPath(); g.arc(0, 0, s * .1, 0, TAU); g.fill();
    blink(g, s * .2, -s * 1.8, s * .2, '124,200,255', Math.sin(t * 1.4) > .8);
    g.restore();
  }
  /* a solar probe behind its white heat shield, the shield's edge glowing */
  function sunProbe(g, x, y, s, ang, t) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#5a6070'; g.fillRect(s * .1, -s * .18, s * .7, s * .36);
    g.fillStyle = '#26304a'; g.fillRect(s * .3, -s * .7, s * .12, s * .5); g.fillRect(s * .3, s * .2, s * .12, s * .5);
    var hs = g.createLinearGradient(-s * .2, 0, s * .1, 0); hs.addColorStop(0, '#fff6e0'); hs.addColorStop(1, '#b8bcc8');
    g.fillStyle = hs; g.beginPath(); g.ellipse(0, 0, s * .16, s * .78, 0, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,170,90,' + (.5 + .3 * Math.sin(t * 7)) + ')'; g.lineWidth = Math.max(1.2, s * .05);
    g.beginPath(); g.ellipse(-s * .02, 0, s * .16, s * .78, 0, Math.PI * .5, Math.PI * 1.5); g.stroke(); g.globalCompositeOperation = 'source-over';
    g.restore();
  }
  /* Hubble: the silver tube, its door open, two solar wings */
  function hubble(g, x, y, s, ang) {
    g.save(); g.translate(x, y); g.rotate(ang);
    var tb = g.createLinearGradient(0, -s * .3, 0, s * .3); tb.addColorStop(0, '#f2f4f8'); tb.addColorStop(.5, '#b8bfcc'); tb.addColorStop(1, '#5a6070');
    g.fillStyle = tb; rr(g, -s, -s * .28, s * 2, s * .56, s * .1); g.fill();
    g.fillStyle = '#20263a'; g.beginPath(); g.ellipse(-s, 0, s * .08, s * .27, 0, 0, TAU); g.fill();
    g.fillStyle = '#d8dce4'; g.save(); g.translate(-s, -s * .28); g.rotate(-.9); g.fillRect(-s * .5, -s * .02, s * .5, s * .04); g.restore();
    for (var k = -1; k <= 1; k += 2) { var wg = g.createLinearGradient(0, k * s * .35, 0, k * s * 1.2); wg.addColorStop(0, '#2a3a6a'); wg.addColorStop(1, '#6a5a2a'); g.fillStyle = wg; g.fillRect(-s * .1, k > 0 ? s * .35 : -s * 1.2, s * .5, s * .85); }
    g.restore();
  }
  /* a capsule under its parachute, swinging */
  function chute(g, x, y, s, t) {
    var sw = Math.sin(t * 1.1) * .12;
    g.save(); g.translate(x, y); g.rotate(sw);
    g.strokeStyle = 'rgba(240,230,210,.7)'; g.lineWidth = 1;
    for (var k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(k * s * .45, -s * 1.6); g.stroke(); }
    var cg = g.createLinearGradient(-s, 0, s, 0); cg.addColorStop(0, '#d9822b'); cg.addColorStop(.5, '#fff2d8'); cg.addColorStop(1, '#d9822b');
    g.fillStyle = cg; g.beginPath(); g.ellipse(0, -s * 1.6, s * 1, s * .5, 0, Math.PI, TAU); g.fill();
    g.fillStyle = '#d8dce4'; g.beginPath(); g.ellipse(0, 0, s * .28, s * .12, 0, 0, TAU); g.fill();
    g.fillStyle = '#6a4510'; g.fillRect(-s * .28, 0, s * .56, s * .06);
    g.restore();
  }
  /* a rotor lander for Titan: a body and four pairs of rotors */
  function copter(g, x, y, s, t) {
    g.fillStyle = '#e8ecf3'; rr(g, x - s * .45, y - s * .12, s * .9, s * .24, s * .1); g.fill();
    g.fillStyle = '#9aa1b0';
    for (var k = -1; k <= 1; k += 2) {
      g.fillRect(x + k * s * .45, y - s * .05, k * s * .35, s * .05);
      var b = Math.abs(Math.cos(t * 27 + k)), rx = x + k * s * .8;
      g.fillStyle = 'rgba(232,236,243,.8)'; g.fillRect(rx - s * .35 * b, y - s * .16, s * .7 * b, s * .03); g.fillRect(rx - s * .35 * b, y - s * .09, s * .7 * b, s * .03); g.fillStyle = '#9aa1b0';
    }
    g.strokeStyle = '#9aa1b0'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - s * .3, y + s * .12); g.lineTo(x - s * .4, y + s * .3); g.moveTo(x + s * .3, y + s * .12); g.lineTo(x + s * .4, y + s * .3); g.stroke();
    blink(g, x, y + s * .14, s * .2, '255,207,107', true);
  }
  /* a small fighter, its engine burning */
  function dart(g, x, y, s, ang, t) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.globalCompositeOperation = 'lighter';
    var fl = 1 + .3 * Math.sin(t * 40), eg = g.createLinearGradient(-s * .5, 0, -s * (1.4 + fl * .6), 0);
    eg.addColorStop(0, 'rgba(255,255,255,.95)'); eg.addColorStop(.3, 'rgba(124,200,255,.7)'); eg.addColorStop(1, 'rgba(155,123,255,0)');
    g.fillStyle = eg; g.beginPath(); g.moveTo(-s * .5, -s * .1); g.lineTo(-s * (1.4 + fl * .6), 0); g.lineTo(-s * .5, s * .1); g.fill();
    g.globalCompositeOperation = 'source-over';
    var bg = g.createLinearGradient(0, -s * .3, 0, s * .3); bg.addColorStop(0, '#eef1f8'); bg.addColorStop(1, '#4a5064');
    g.fillStyle = bg; g.beginPath(); g.moveTo(s * .7, 0); g.lineTo(-s * .5, -s * .38); g.lineTo(-s * .3, 0); g.lineTo(-s * .5, s * .38); g.closePath(); g.fill();
    g.fillStyle = '#5ef2d6'; g.beginPath(); g.ellipse(s * .15, 0, s * .16, s * .06, 0, 0, TAU); g.fill();
    g.restore();
  }

  /* ---------- more worlds (owner 2026-11-26: "every click a different world, no repeats"): each page of the Observatory
     now has a place of its own — its sky, its ground, its light and its cast. VAR picks the version of a shared world. */
  var VAR = '';
  function strip(SW, seed, fn) {
    var SH = SW / 2, f1 = field(SH, seed, 5, 4), f2 = field(SH, seed + 9, 4, 6), px = new Uint8ClampedArray(SW * SH * 4);
    for (var y = 0; y < SH; y++) {
      var v = y / SH;
      for (var x = 0; x < SW; x++) { var j = y * SH + (x >> 1), c = fn(f1[j], f2[j], v, x / SW), i = (y * SW + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; }
    }
    return px;
  }
  var PAL = {
    earth: function (a, b, v) {
      var lat = Math.abs(v - .5) * 2, c;
      if (lat > .84 + (a - .5) * .12) c = [236, 242, 250];
      else if (a > .56) c = mix([62, 104, 50], [160, 136, 90], cl((b - .3) * 2, 0, 1));
      else c = mix([8, 30, 82], [30, 100, 176], cl(a * 1.7, 0, 1));
      return mix(c, [248, 250, 253], cl((b - .5) * 3, 0, .92));
    },
    neptune: function (a, b, v, u) {
      var c = ramp([[0, 40, 70, 160], [.3, 56, 100, 214], [.45, 74, 128, 240], [.55, 52, 96, 210], [.7, 70, 122, 232], [1, 36, 64, 150]], cl(v + (a - .5) * .06, 0, 1));
      var dx = u - .3; dx -= Math.round(dx); var e = (dx / .06) * (dx / .06) + ((v - .4) / .035) * ((v - .4) / .035);
      if (e < 1) c = mix(c, [16, 30, 80], Math.pow(1 - e, .5) * .85);
      if (b > .66 && Math.abs(v - .62) < .035) c = mix(c, [240, 246, 255], cl((b - .66) * 3, 0, 1));
      return c;
    },
    io: function (a, b) {
      var c = mix([226, 200, 84], [246, 232, 150], b);
      if (a > .57) c = mix(c, [214, 112, 40], cl((a - .57) * 5, 0, 1));
      if (b > .66) c = mix(c, [246, 244, 228], cl((b - .66) * 6, 0, .9));
      if (a > .72 && b < .46) c = [46, 28, 18];
      return c;
    },
    mars: function (a, b, v) {
      var c = mix([118, 50, 24], [200, 100, 54], a); if (b > .6) c = mix(c, [70, 40, 30], cl((b - .6) * 4, 0, .8));
      var lat = Math.abs(v - .5) * 2; if (lat > .88) c = mix(c, [240, 236, 230], cl((lat - .88) * 10, 0, 1)); return c;
    },
    sun: function (a, b) { var k = a * .7 + b * .3; return mix([190, 60, 8], [255, 214, 120], cl((k - .25) * 1.8, 0, 1)); }
  };
  function skyG(C, st) { var g = C.g, gr = g.createLinearGradient(0, 0, 0, C.H); for (var i = 0; i < st.length; i++) gr.addColorStop(st[i][0], st[i][1]); g.fillStyle = gr; g.fillRect(0, 0, C.W, C.H); }
  function ridgesOf(seed, k, n, rough) {
    s0 = seed; var L = [];
    for (var l = 0; l < k; l++) {
      var ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU], P = [];
      for (var i = 0; i <= n; i++) { var u = i / n; P.push(Math.sin(u * 3.1 + ph[0]) * .5 + Math.sin(u * 7.3 + ph[1]) * .3 * rough + Math.sin(u * 17 + ph[2]) * .12 * rough + (rnd() - .5) * .06 * rough); }
      L.push(P);
    }
    return L;
  }
  function ridge(C, P, base, amp, par, fill, edge) {
    var g = C.g, W = C.W, H = C.H, n = P.length - 1; g.fillStyle = fill; g.beginPath(); g.moveTo(-20, H);
    for (var i = 0; i <= n; i++) g.lineTo(-20 + (W + 40) * i / n - C.ppx * par, base - P[i] * amp - C.ppy * par * .3);
    g.lineTo(W + 20, H); g.closePath(); g.fill();
    if (edge) { g.strokeStyle = edge; g.lineWidth = 1.2; g.stroke(); }
  }
  function onRidge(C, P, base, amp, par, x) { var n = P.length - 1, i = cl(Math.round((x + 20 + C.ppx * par) / (C.W + 40) * n), 0, n); return base - P[i] * amp - C.ppy * par * .3; }
  function planet(g, img, cx, cy, R, rtl) {
    if (!img) { g.fillStyle = '#10121c'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill(); return; }
    g.save(); if (rtl) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); } g.drawImage(img, cx - R, cy - R, R * 2, R * 2); g.restore();
  }
  function rim(g, cx, cy, R, col, wd) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.globalCompositeOperation = 'source-over'; }
  var SWs = LT ? 256 : 384;
  function earthTx(D, L) { return [['eS', function () { return strip(SWs, 31, PAL.earth); }], ['eP' + D, function () { return TX.eS && sphere(D, TX.eS, SWs, SWs / 2, L); }]]; }
  function txt(g, s, x, y, px, col) { g.font = '600 ' + px + 'px ui-monospace,Menlo,Consolas,monospace'; g.fillStyle = col; g.fillText(s, x, y); }

  /* TITAN — Saturn's moon in its orange haze: dunes, a methane lake, Saturn's ghost through the smog.
     Day (funding): a rotor lander flies over the dunes at sunset. Night (sopr): a lone floating probe on the dark lake. */
  WORLDS.titan = {
    cfg: { clouds: 0, gal: false, gal2: false, bh: false, wh: false, dust: false, starTop: .35, stars: .35, spikes: false, band: false },
    init: function () { this.cfg.stars = VAR === 'night' ? .55 : .15; },
    rd: null, drops: null,
    sky: function (C) {
      var n = VAR === 'night';
      skyG(C, n ? [[0, '#050308'], [.45, '#140b10'], [.72, '#2a1812'], [1, '#120a08']] : [[0, '#24120a'], [.4, '#6a3410'], [.7, '#c47a30'], [.78, '#e8a858'], [1, '#3a200c']]);
      var g = C.g, W = C.W, H = C.H, sx = X(C, .72) - C.ppx * 4, sy = H * (n ? .3 : .34), sr = Math.min(W, H) * (C.small ? .2 : .16);
      g.globalAlpha = n ? .55 : .22; g.save(); g.translate(sx, sy); g.rotate(C.rtl ? .3 : -.3);
      g.strokeStyle = 'rgba(255,226,180,.8)'; g.lineWidth = sr * .16; g.beginPath(); g.ellipse(0, 0, sr * 2.1, sr * .4, 0, 0, TAU); g.stroke();
      var pg = g.createRadialGradient(-sr * .3, -sr * .3, 0, 0, 0, sr); pg.addColorStop(0, '#ffe2b0'); pg.addColorStop(1, '#7a4a20');
      g.fillStyle = pg; g.beginPath(); g.arc(0, 0, sr, 0, TAU); g.fill(); g.restore(); g.globalAlpha = 1;
      if (!n) { g.globalCompositeOperation = 'lighter'; halo(g, X(C, .28), H * .7, 0, H * .5, [[0, 'rgba(255,200,120,.55)'], [.3, 'rgba(255,140,60,.18)'], [1, 'rgba(255,111,60,0)']]); g.globalCompositeOperation = 'source-over'; }
      this.sat = [sx, sy, sr];
    },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, n = VAR === 'night', hz = H * (C.small ? .76 : .7);
      if (!this.rd) this.rd = ridgesOf(707, 3, 90, .35);
      var cols = n ? ['#1a100c', '#120a08', '#080504'] : ['#7a3e14', '#4a240c', '#241006'];
      ridge(C, this.rd[0], hz, H * .03, 3, cols[0]);
      /* the lake, Saturn and the light shivering on it */
      var lx0 = X(C, n ? .05 : .45), lx1 = X(C, n ? .9 : .98), ly = hz + H * .03, lh = H * (n ? .16 : .09);
      var a0 = Math.min(lx0, lx1), a1 = Math.max(lx0, lx1);
      var lg = g.createLinearGradient(0, ly, 0, ly + lh); lg.addColorStop(0, n ? '#1c1418' : '#4a2a18'); lg.addColorStop(1, n ? '#05040a' : '#1a0e08');
      g.fillStyle = lg; g.beginPath(); g.ellipse((a0 + a1) / 2, ly + lh / 2, (a1 - a0) / 2, lh / 2, 0, 0, TAU); g.fill();
      var S = this.sat; if (S) {
        g.globalCompositeOperation = 'lighter';
        var rx = S[0], rw = S[2] * 1.2;
        if (rx > a0 && rx < a1) for (var k = 0; k < 14; k++) {
          var yy = ly + lh * (.12 + k / 16), al = (n ? .22 : .12) * (1 - k / 16) * (.6 + .4 * Math.sin(t * 2.2 * mv + k * 1.7));
          halo(g, rx + Math.sin(t * 1.3 * mv + k) * rw * .15, yy, 0, rw * (.5 + k * .04), [[0, 'rgba(255,214,160,' + al + ')'], [1, 'rgba(255,214,160,0)']]);
        }
        g.globalCompositeOperation = 'source-over';
      }
      ridge(C, this.rd[1], hz + H * (n ? .18 : .12), H * .04, 9, cols[1]);
      ridge(C, this.rd[2], hz + H * (n ? .26 : .22), H * .05, 18, cols[2], n ? null : 'rgba(255,170,90,.18)');
      if (!n) {
        /* the rotor lander, flying its slow loops over the dunes */
        var u = t * mv / 26, fx = X(C, .5 + .38 * Math.sin(u * TAU)), fy = H * (.42 + .07 * Math.sin(u * TAU * 2)) - C.ppy * 10;
        copter(g, fx, fy, Math.max(30, Math.min(W, H) * .06), t);
        g.globalAlpha = .25; g.fillStyle = '#1a0c04'; g.beginPath(); g.ellipse(fx, hz + H * .2, 26, 4, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
      } else {
        /* the floating probe and its rings on the still lake, and a slow methane drizzle */
        var bx = X(C, .3) - C.ppx * 6, by = ly + lh * .45 + Math.sin(t * .8) * 1.5, bs = Math.max(16, Math.min(W, H) * .03);
        for (var r = 0; r < 3; r++) { var ru = ((t * mv * .08) + r / 3) % 1; g.strokeStyle = 'rgba(255,207,160,' + (.25 * (1 - ru)) + ')'; g.lineWidth = 1; g.beginPath(); g.ellipse(bx, by + bs * .3, bs * (1 + ru * 6), bs * (.2 + ru * 1.1), 0, 0, TAU); g.stroke(); }
        g.fillStyle = '#c9ced8'; g.beginPath(); g.ellipse(bx, by, bs, bs * .45, 0, Math.PI, TAU); g.fill(); g.fillStyle = '#4a5064'; g.fillRect(bx - bs, by - 1, bs * 2, bs * .25);
        g.fillStyle = '#c9ced8'; g.fillRect(bx - 1, by - bs * 1.6, 2, bs * 1.2);
        blink(g, bx, by - bs * 1.65, bs * .9, '255,207,107', Math.sin(t * 1.6) > .2);
        if (!this.drops) { s0 = 909; this.drops = []; for (var j = 0; j < (C.lt ? 40 : 90); j++) this.drops.push([rnd(), rnd(), .5 + rnd()]); }
        g.fillStyle = 'rgba(220,190,160,.35)';
        for (j = 0; j < this.drops.length; j++) { var D = this.drops[j], dy = ((D[1] + t * mv * .03 * D[2]) % 1) * H, dx = D[0] * W; g.fillRect(dx, dy, 1, 2.2 * D[2]); }
      }
    }
  };

  /* THE COCKPIT — looking out of a crew craft. ls: Earth turning below, a station far off. score: closing in on Mars,
     the planet growing in the window and the numbers counting down to touchdown. */
  WORLDS.cockpit = {
    cfg: { clouds: 0, gal: false, gal2: false, bh: false, wh: false, dust: false, spikes: false, band: false, stars: .8 },
    init: function () { build(VAR === 'mars' ? [['mS', function () { return strip(SWs, 51, PAL.mars); }], ['mP', function () { return TX.mS && sphere(PD, TX.mS, SWs, SWs / 2, [-.6, -.3, .74]); }]] : earthTx(PD, [-.5, -.45, .74])); },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, m = VAR === 'mars';
      if (!m) {
        var R = Math.max(W, H) * .78, cx = X(C, .3) - C.ppx * 10, cy = H * 1.12 - C.ppy * 8;
        planet(g, turn('eP' + PD, TX['eP' + PD], t / 160 * mv, C, .25), cx, cy, R, C.rtl);
        rim(g, cx, cy, R * 1.004, 'rgba(110,180,255,.45)', Math.max(3, R * .012));
        station(g, X(C, .7) - C.ppx * 4, H * .22 + Math.sin(t * .2) * 6, Math.max(26, Math.min(W, H) * .05), (C.rtl ? -.25 : .25) + t * .01 * mv, t, true);
      } else {
        var cyc = ((t * mv) % 46) / 46, k = Math.pow(cyc, 2.2), R2 = Math.min(W, H) * (.06 + 1.6 * k), mx = X(C, .5), my = H * (.36 + .5 * k);
        planet(g, turn('mP', TX.mP, t / 120 * mv, C, .3), mx, my, R2, C.rtl);
        rim(g, mx, my, R2 * 1.01, 'rgba(255,170,120,.35)', Math.max(2, R2 * .015));
        if (cyc > .93) { g.fillStyle = 'rgba(255,230,200,' + ((cyc - .93) / .07 * .5) + ')'; g.fillRect(0, 0, W, H); }
        this.alt = Math.max(0, Math.round((1 - k) * 12400)); this.cyc = cyc;
      }
      /* the frame: two windows and a centre post, the panel below */
      var sm = C.small, pad = W * (sm ? .03 : .05), top = H * .07, bot = H * (sm ? .74 : .7), mid = W / 2, gap = sm ? 0 : W * .018;
      g.beginPath(); g.rect(0, 0, W, H);
      if (sm) { rr(g, pad, top, W - pad * 2, bot - top, 26); }
      else {
        g.moveTo(pad + 30, top); g.lineTo(mid - gap, top + 10); g.lineTo(mid - gap, bot); g.lineTo(pad, bot - 20); g.lineTo(pad, top + 40); g.closePath();
        g.moveTo(W - pad - 30, top); g.lineTo(mid + gap, top + 10); g.lineTo(mid + gap, bot); g.lineTo(W - pad, bot - 20); g.lineTo(W - pad, top + 40); g.closePath();
      }
      var pg = g.createLinearGradient(0, 0, 0, H); pg.addColorStop(0, 'rgba(14,18,32,.97)'); pg.addColorStop(.7, 'rgba(18,24,42,.97)'); pg.addColorStop(1, 'rgba(8,10,20,.98)');
      g.fillStyle = pg; g.fill('evenodd');
      g.strokeStyle = 'rgba(124,200,255,.35)'; g.lineWidth = 2; g.stroke();
      /* the panel: little screens and lights, and the numbers */
      var n2 = sm ? 5 : 9;
      for (var i = 0; i < n2; i++) {
        var px = W * (.08 + i * (.84 / (n2 - 1))), py = bot + H * .06;
        g.fillStyle = 'rgba(94,242,214,' + (.08 + .06 * Math.sin(t * 1.3 + i)) + ')'; rr(g, px - 18, py, 36, 22, 4); g.fill();
        g.fillStyle = (Math.sin(t * (1 + i * .3) + i * 2) > .4) ? (i % 3 ? '#5ef2d6' : '#ffcf6b') : '#1a2236'; g.beginPath(); g.arc(px, py + 36, 2.6, 0, TAU); g.fill();
      }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (m) {
        var a = this.alt || 0, s1 = a > 0 ? 'ALT ' + a + ' m' : 'TOUCHDOWN', v = Math.round(a * .06 + 2);
        txt(g, s1, W / 2, bot + H * .03, sm ? 13 : 15, a > 0 ? 'rgba(94,242,214,.95)' : 'rgba(255,207,107,1)');
        if (a > 0) txt(g, 'V ' + v + ' m/s', W / 2, bot + H * .13, sm ? 11 : 13, 'rgba(124,200,255,.8)');
      } else txt(g, 'ORBIT 408 km  ·  7.66 km/s', W / 2, bot + H * .03, sm ? 11 : 14, 'rgba(94,242,214,.85)');
      g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    }
  };

  /* THE MOON — basis: a bright day, the lander, the site's flag planted and an astronaut waving and hopping, Earth high in
     the black sky. thermo: the south pole at night, the sun a sliver on the horizon, two astronauts walking by headlamp. */
  WORLDS.moon = {
    cfg: { clouds: 0, gal: false, gal2: false, bh: false, wh: false, dust: false, spikes: false, band: false, starTop: .62 },
    init: function () { var n = VAR === 'night'; this.cfg.stars = n ? 1 : .35; build(earthTx(LT ? 120 : 160, n ? [.9, -.2, .3] : [-.5, -.3, .8])); },
    rd: null, cr: null,
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, n = VAR === 'night', hz = H * (C.small ? .7 : .64);
      if (!this.rd) { this.rd = ridgesOf(303, 3, 90, .7); s0 = 313; this.cr = []; for (var i = 0; i < 26; i++) this.cr.push([rnd(), rnd(), .4 + rnd()]); }
      /* Earth */
      var er = Math.min(W, H) * (n ? .085 : .065), ex = X(C, n ? .78 : .24) - C.ppx * 3, ey = n ? hz - er * .35 : H * .16 - C.ppy * 3;
      g.globalCompositeOperation = 'lighter'; halo(g, ex, ey, er * .9, er * 1.6, [[0, 'rgba(110,180,255,.25)'], [1, 'rgba(110,180,255,0)']]); g.globalCompositeOperation = 'source-over';
      var D = LT ? 120 : 160; planet(g, turn('eP' + D, TX['eP' + D], t / 90 * mv, C, .4), ex, ey, er, C.rtl);
      if (n) { g.globalCompositeOperation = 'lighter'; halo(g, X(C, .04), hz, 0, H * .3, [[0, 'rgba(255,250,236,.8)'], [.08, 'rgba(255,240,210,.25)'], [1, 'rgba(255,240,210,0)']]); g.globalCompositeOperation = 'source-over'; }
      var cols = n ? ['#1c1e2a', '#10121c', '#05060c'] : ['#7c7c82', '#5e5e64', '#3c3c42'];
      ridge(C, this.rd[0], hz, H * .035, 3, cols[0], n ? 'rgba(220,230,255,.35)' : null);
      var gg = g.createLinearGradient(0, hz, 0, H); gg.addColorStop(0, n ? '#14161f' : '#9a9aa0'); gg.addColorStop(1, n ? '#030308' : '#48484e');
      g.fillStyle = gg; g.fillRect(0, hz + H * .02, W, H);
      ridge(C, this.rd[1], hz + H * .04, H * .025, 7, n ? '#0c0d16' : '#8a8a90');
      /* craters, lit on the far rim */
      for (i = 0; i < this.cr.length; i++) {
        var q = this.cr[i], v = Math.pow(q[1], 1.3), cy = hz + H * .06 + (H - hz) * v, crx = q[2] * (8 + v * 60) * (C.small ? .7 : 1), cx = q[0] * W - C.ppx * (4 + v * 14);
        g.fillStyle = n ? 'rgba(0,0,4,.6)' : 'rgba(40,40,46,.45)'; g.beginPath(); g.ellipse(cx, cy, crx, crx * .26, 0, 0, TAU); g.fill();
        g.strokeStyle = n ? 'rgba(200,214,255,.28)' : 'rgba(230,230,236,.5)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, crx, crx * .26, 0, n ? Math.PI * 1.05 : Math.PI * .1, n ? Math.PI * 1.45 : Math.PI * .9); g.stroke();
      }
      var as = Math.max(34, Math.min(W, H) * .075);
      if (!n) {
        var lx = X(C, .14) - C.ppx * 10, ly = hz + H * .12; lander(g, lx, ly, as * 1.3, t);
        var ax = X(C, .3) - C.ppx * 12, hop = C.RM ? 0 : Math.max(0, Math.sin(t * mv * TAU / 7)) * as * .9, ay = hz + H * .15 - as * 1.3 - hop;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(ax, hz + H * .15, as * .5 * (1 - hop / (as * 2)), as * .1, 0, 0, TAU); g.fill();
        for (i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,40,46,.5)'; g.beginPath(); g.ellipse(lx + (ax - lx) * (i + .5) / 6, hz + H * .15 - (i % 2) * 4, 3, 1.4, 0, 0, TAU); g.fill(); }
        astro(g, ax, ay, as, 0, { t: t, flag: true, hop: hop > 2, flip: C.rtl });
        var bx = X(C, .42) - C.ppx * 12; astro(g, bx, hz + H * .15 - as * 1.3, as * .92, 0, { t: t + 1.7, wave: 0, flip: !C.rtl });
      } else {
        for (i = 0; i < 2; i++) {
          var wx = X(C, .16 + i * .14) - C.ppx * 12, wy = hz + H * (.13 + i * .03) - as * 1.3, la = (C.rtl ? Math.PI : 0) + Math.sin(t * .5 * mv + i * 2) * .35 + .25;
          astro(g, wx, wy, as * (1 - i * .08), 0, { t: t + i * 1.3, walk: true, lamp: true, lampA: la - (C.rtl ? Math.PI : 0), flip: C.rtl, tint: 'rgba(10,16,40,.45)' });
        }
        rover(g, X(C, .5) - C.ppx * 12, hz + H * .17, as * 1.1, t, '#20232e');
      }
    }
  };

  /* DEEP FIELD — options: the galaxies of a Webb deep field, the telescope itself in front, its gold mirrors catching
     light. models: a cluster bending the light of the galaxies behind it into arcs, Hubble looking on. */
  function dfTex() {
    var S = LT ? 384 : 512, c = mk(S), x = c.getContext('2d'); s0 = 1111;
    var cols = [['255,170,110', '200,90,60'], ['255,236,200', '220,170,110'], ['190,214,255', '110,140,230'], ['255,200,240', '180,110,200']];
    for (var i = 0; i < (LT ? 170 : 260); i++) {
      var px = rnd() * S, py = rnd() * S, r = .8 + Math.pow(rnd(), 3) * 9, e = .3 + rnd() * .7, a = rnd() * Math.PI, cc = cols[Math.floor(rnd() * 4)];
      x.save(); x.translate(px, py); x.rotate(a); x.scale(1, e);
      var gr = x.createRadialGradient(0, 0, 0, 0, 0, r * 2.2); gr.addColorStop(0, 'rgba(' + cc[0] + ',.95)'); gr.addColorStop(.3, 'rgba(' + cc[1] + ',.45)'); gr.addColorStop(1, 'rgba(' + cc[1] + ',0)');
      x.fillStyle = gr; x.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
      if (r > 5) { x.strokeStyle = 'rgba(' + cc[0] + ',.35)'; x.lineWidth = r * .25; x.beginPath(); x.arc(0, 0, r * 1.3, 0, Math.PI * .8); x.stroke(); x.beginPath(); x.arc(0, 0, r * 1.3, Math.PI, Math.PI * 1.8); x.stroke(); }
      x.restore();
    }
    for (i = 0; i < 26; i++) {
      var sx = rnd() * S, sy = rnd() * S, L = 4 + rnd() * 14; x.strokeStyle = 'rgba(255,250,240,.7)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(sx - L, sy); x.lineTo(sx + L, sy); x.moveTo(sx, sy - L * 1.2); x.lineTo(sx, sy + L * 1.2); x.moveTo(sx - L * .5, sy - L * .3); x.lineTo(sx + L * .5, sy + L * .3); x.moveTo(sx + L * .5, sy - L * .3); x.lineTo(sx - L * .5, sy + L * .3); x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(sx, sy, 1.3, 0, TAU); x.fill();
    }
    return c;
  }
  WORLDS.deepfield = {
    cfg: { clouds: 0, gal: false, gal2: false, bh: false, wh: false, dust: false, spikes: false, band: false, stars: .45 },
    init: function () { build([['df', dfTex]]); },
    sky: function (C) { skyG(C, VAR === 'lens' ? [[0, '#03020a'], [1, '#0a0614']] : [[0, '#020208'], [1, '#06040e']]); },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, L = VAR === 'lens', T = TX.df;
      if (T) {
        var big = Math.max(W, H) * 1.25, z = 1 + .12 * Math.sin(t * TAU / 90 * mv), sz = big * z, ox = (W - sz) / 2 - C.ppx * 14, oy = (H - sz) / 2 - C.ppy * 14 - C.ssy * .02;
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = .95; g.drawImage(T, ox, oy, sz, sz);
        g.globalAlpha = .5; g.save(); g.translate(W / 2, H / 2); g.rotate(1.3); g.drawImage(T, -sz * .4, -sz * .4, sz * .8, sz * .8); g.restore();
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
      if (L) {
        var cx = X(C, .68) - C.ppx * 6, cy = H * .32 - C.ppy * 6, r = Math.min(W, H) * .16, br = .6 + .4 * C.breath;
        g.globalCompositeOperation = 'lighter';
        halo(g, cx, cy, 0, r * 1.2, [[0, 'rgba(255,236,190,.55)'], [.25, 'rgba(255,207,107,.2)'], [1, 'rgba(255,207,107,0)']]);
        var arcs = [[1, .2, 1.3], [1.15, 2.3, .9], [.9, 3.6, 1.1], [1.3, 5.1, .7]];
        for (var i = 0; i < arcs.length; i++) {
          var A = arcs[i], a0 = A[1] + Math.sin(t * .1 * mv + i) * .05;
          g.strokeStyle = 'rgba(160,200,255,' + (.35 + .25 * br) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r * A[0], a0, a0 + A[2]); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,' + (.25 + .3 * br) + ')'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r * A[0], a0 + .1, a0 + A[2] - .1); g.stroke();
        }
        g.strokeStyle = 'rgba(155,123,255,' + .18 * br + ')'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r * .62, 0, TAU); g.stroke();
        g.globalCompositeOperation = 'source-over';
        var hu = t * mv / 70; hubble(g, X(C, .2 + .06 * Math.sin(hu * TAU)) - C.ppx * 16, H * (.2 + .04 * Math.cos(hu * TAU)), Math.max(26, Math.min(W, H) * .05), (C.rtl ? .4 : -.4) + Math.sin(t * .2) * .1);
      } else {
        webb(g, X(C, .8) - C.ppx * 16, H * .25 - C.ppy * 12 + Math.sin(t * .4) * 5, Math.max(40, Math.min(W, H) * .09), Math.sin(t * .15 * mv) * .12 + (C.rtl ? .1 : -.1), t * mv);
      }
    }
  };

  /* BLACK HOLE — hl: up close, in fear: the bright ring bent over the dark, the disk turning fast, a probe falling in and
     stretching. compass: a quiet violet one far off, an astronaut sitting on a rock, watching. */
  WORLDS.blackhole = {
    cfg: { clouds: .2, gal: false, gal2: false, bh: false, wh: false, dust: false, band: false },
    init: function () { this.cfg.clouds = VAR === 'calm' ? .35 : .15; },
    fall: 0,
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, calm = VAR === 'calm';
      var R = Math.min(W, H) * (calm ? .085 : C.small ? .16 : .15), cx = X(C, calm ? .7 : C.small ? .6 : .72) - C.ppx * 8, cy = H * (calm ? .26 : C.small ? .22 : .32) - C.ppy * 8;
      var c1 = calm ? '155,123,255' : '255,170,80', c2 = calm ? '94,242,214' : '255,90,40', sp = (calm ? .15 : .9) * mv;
      g.globalCompositeOperation = 'lighter';
      halo(g, cx, cy, R, R * 5, [[0, 'rgba(' + c1 + ',.22)'], [.4, 'rgba(' + c2 + ',.06)'], [1, 'rgba(' + c2 + ',0)']]);
      /* the far side of the disk, bent up over the hole */
      for (var k = 0; k < 3; k++) { g.strokeStyle = 'rgba(' + (k ? c2 : c1) + ',' + (.5 - k * .14) + ')'; g.lineWidth = R * (.22 - k * .05); g.beginPath(); g.ellipse(cx, cy - R * .08, R * (1.55 + k * .12), R * (1.2 + k * .1), 0, Math.PI, TAU); g.stroke(); }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      rim(g, cx, cy, R * 1.03, 'rgba(255,244,222,' + (calm ? .55 : .85) + ')', Math.max(1.5, R * .025));
      /* the near side, flat across the front, brighter where it comes towards us */
      g.globalCompositeOperation = 'lighter';
      var dg = g.createLinearGradient(cx - R * 2.8, 0, cx + R * 2.8, 0), hot = C.rtl ? 1 : 0;
      dg.addColorStop(hot, 'rgba(255,250,236,.95)'); dg.addColorStop(.5, 'rgba(' + c1 + ',.75)'); dg.addColorStop(1 - hot, 'rgba(' + c2 + ',.25)');
      g.strokeStyle = dg; g.lineWidth = R * .26; g.beginPath(); g.ellipse(cx, cy, R * 2.7, R * .36, 0, -.08, Math.PI + .08); g.stroke();
      g.lineWidth = R * .1; g.beginPath(); g.ellipse(cx, cy, R * 3.2, R * .45, 0, -.05, Math.PI + .05); g.stroke();
      for (k = 0; k < (calm ? 4 : 8); k++) {
        var a = t * sp * (1 + k * .09) + k * 1.3, ex = cx + Math.cos(a) * R * (2.4 + (k % 3) * .3), ey = cy + Math.sin(a) * R * .38;
        if (Math.sin(a) < 0) continue;
        halo(g, ex, ey, 0, R * .25, [[0, 'rgba(255,255,255,.8)'], [1, 'rgba(' + c1 + ',0)']]);
      }
      g.globalCompositeOperation = 'source-over';
      if (!calm) {
        /* the probe, spiralling in, stretched and reddened as it goes */
        var u = ((t * mv) % 34) / 34, ang = u * TAU * 2.2 + 1, dist = R * (6 - 5 * Math.pow(u, .7)), px = cx + Math.cos(ang) * dist, py = cy + Math.sin(ang) * dist * .45;
        g.save(); g.globalAlpha = u < .9 ? 1 : (1 - u) * 10; g.translate(px, py); g.rotate(Math.atan2(cy - py, cx - px) - Math.PI / 2); g.scale(1 - u * .7, 1 + u * 2.4);
        probe(g, 0, 0, Math.max(10, R * .14), 0, t);
        if (u > .5) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,40,20,' + (u - .5) + ')'; g.fillRect(-R, -R, R * 2, R * 2); }
        g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        if (!C.RM && u > .97) { g.fillStyle = 'rgba(255,120,60,.08)'; g.fillRect(0, 0, W, H); }
      } else {
        /* a rock, and someone sitting on it, looking at the hole */
        var rx = X(C, .2) - C.ppx * 14, ry = H * .34 + Math.sin(t * .3) * 4 - C.ppy * 10, rs = Math.max(40, Math.min(W, H) * .085);
        var rg = g.createLinearGradient(rx - rs, ry, rx + rs, ry + rs); rg.addColorStop(0, '#5a5470'); rg.addColorStop(1, '#14121e');
        g.fillStyle = rg; g.beginPath(); g.moveTo(rx - rs, ry); g.lineTo(rx - rs * .6, ry - rs * .3); g.lineTo(rx + rs * .5, ry - rs * .34); g.lineTo(rx + rs * 1.1, ry + rs * .1); g.lineTo(rx + rs * .4, ry + rs * .6); g.lineTo(rx - rs * .7, ry + rs * .5); g.closePath(); g.fill();
        astro(g, rx, ry - rs * .3 - rs * .95, rs * .62, C.rtl ? .1 : -.1, { t: t, flip: !C.rtl, tint: 'rgba(80,60,160,.25)' });
      }
    }
  };

  /* THE SUN — liqheat: the edge of the Sun filling a corner, loops of fire standing off the limb, a flare and its wave
     every so often, a solar probe holding its white shield up to it */
  WORLDS.sun = {
    cfg: { clouds: 0, gal: false, gal2: false, bh: false, wh: false, dust: false, band: false, spikes: false, stars: .5 },
    init: function () { build([['sS2', function () { return strip(SWs, 61, PAL.sun); }], ['sP', function () { return TX.sS2 && sphere(LT ? 256 : 360, TX.sS2, SWs, SWs / 2, [0, 0, 1]); }]]); },
    fl: null, nextFl: 9,
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, R = Math.max(W, H) * (C.small ? .55 : .42), cx = X(C, 1.02) - C.ppx * 6, cy = H * (C.small ? .02 : .12) - C.ppy * 6;
      g.globalCompositeOperation = 'lighter';
      halo(g, cx, cy, R * .95, R * 1.8, [[0, 'rgba(255,200,120,.45)'], [.25, 'rgba(255,111,60,.14)'], [1, 'rgba(255,79,154,0)']]);
      g.globalCompositeOperation = 'source-over';
      planet(g, turn('sP', TX.sP, t / 200 * mv, C, .35), cx, cy, R, false);
      g.globalCompositeOperation = 'lighter';
      /* prominences: loops standing on the limb */
      var P = [2.1, 2.5, 2.9, 1.75]; if (C.rtl) for (var q = 0; q < P.length; q++) P[q] = Math.PI - P[q];
      for (var i = 0; i < P.length; i++) {
        var a = P[i] + Math.sin(t * .1 + i) * .02, h = R * (.07 + .05 * Math.sin(t * .4 * mv + i * 2)), bx = cx + Math.cos(a) * R, by = cy + Math.sin(a) * R, w2 = .05;
        var x1 = cx + Math.cos(a - w2) * R, y1 = cy + Math.sin(a - w2) * R, x2 = cx + Math.cos(a + w2) * R, y2 = cy + Math.sin(a + w2) * R;
        var ox = Math.cos(a) * h * 2.2, oy = Math.sin(a) * h * 2.2;
        g.strokeStyle = 'rgba(255,120,60,.55)'; g.lineWidth = R * .014; g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(x1 + ox, y1 + oy, x2 + ox, y2 + oy, x2, y2); g.stroke();
        g.strokeStyle = 'rgba(255,214,160,.4)'; g.lineWidth = R * .005; g.stroke();
        void bx; void by;
      }
      /* a flare, then its wave rolling out */
      if (!C.once && !C.RM && !this.fl && t > this.nextFl) this.fl = { t: t, a: (C.rtl ? Math.PI - 2.4 : 2.4) + (Math.random() - .5) * .6 };
      if (this.fl) {
        var u = (t - this.fl.t) / 6, fa = this.fl.a, fx = cx + Math.cos(fa) * R, fy = cy + Math.sin(fa) * R;
        if (u >= 1) { this.fl = null; this.nextFl = t + 14 + Math.random() * 10; }
        else {
          var f = u < .08 ? u / .08 : 1 - (u - .08) / .92;
          halo(g, fx, fy, 0, R * .5 * (.4 + f), [[0, 'rgba(255,255,240,' + .9 * f + ')'], [.2, 'rgba(255,190,110,' + .4 * f + ')'], [1, 'rgba(255,111,60,0)']]);
          g.strokeStyle = 'rgba(255,170,90,' + (1 - u) * .5 + ')'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R * (1.05 + u * 1.3), fa - .5, fa + .5); g.stroke();
          if (u < .1) { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(255,200,140,' + (.12 * (1 - u / .1)) + ')'; g.fillRect(0, 0, W, H); }
        }
      }
      g.globalCompositeOperation = 'source-over';
      var px = X(C, C.small ? .3 : .34) - C.ppx * 18, py = H * (C.small ? .42 : .4) + Math.sin(t * .5) * 6 - C.ppy * 12;
      sunProbe(g, px, py, Math.max(30, Math.min(W, H) * .065), Math.atan2(cy - py, cx - px), t);
    }
  };

  /* A COMET — liqhist: the two-lobed nucleus close by, jets of gas breaking from its sunlit side, a small lander bouncing
     across it in the weak gravity */
  WORLDS.comet = {
    cfg: { clouds: 0, gal: false, gal2: true, bh: false, wh: false, dust: false, band: false },
    init: function () { s0 = 1212; var S = []; for (var i = 0; i < 2; i++) { var P = []; for (var k = 0; k < 18; k++) P.push(.78 + rnd() * .3); S.push(P); } this.sh = S; },
    jets: [],
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, R = Math.min(W, H) * (C.small ? .2 : .17), cx = X(C, C.small ? .62 : .72) - C.ppx * 10, cy = H * (C.small ? .26 : .36) - C.ppy * 10, L = C.rtl ? 1 : -1;
      var rot = Math.sin(t * .05 * mv) * .2;
      g.globalCompositeOperation = 'lighter'; halo(g, cx, cy, R * .5, R * 3, [[0, 'rgba(200,230,255,.18)'], [1, 'rgba(124,200,255,0)']]); g.globalCompositeOperation = 'source-over';
      g.save(); g.translate(cx, cy); g.rotate(rot);
      var lobes = [[-R * .45, R * .1, R * .7], [R * .5, -R * .15, R * .55]];
      for (var l = 0; l < 2; l++) {
        var B = lobes[l], P = this.sh[l], n = P.length, gr = g.createRadialGradient(B[0] + L * B[2] * .5, B[1] - B[2] * .4, 0, B[0], B[1], B[2] * 1.2);
        gr.addColorStop(0, '#9a948c'); gr.addColorStop(.5, '#4a4642'); gr.addColorStop(1, '#141210');
        g.fillStyle = gr; g.beginPath();
        for (var k = 0; k <= n; k++) { var a = k / n * TAU, r = B[2] * P[k % n]; g.lineTo(B[0] + Math.cos(a) * r, B[1] + Math.sin(a) * r * .85); }
        g.closePath(); g.fill();
      }
      g.restore();
      /* the jets */
      if (this.jets.length < (C.lt ? 60 : 140) && !C.once) for (var j = 0; j < 3; j++) {
        var src = [[-.7, -.3], [.1, -.55], [.75, -.4]][j], sx = cx + src[0] * R * L * -1, sy = cy + src[1] * R;
        this.jets.push({ x: sx, y: sy, vx: (L * -1) * (10 + Math.random() * 30) + (Math.random() - .5) * 14, vy: -(20 + Math.random() * 30), a: 0 });
      }
      g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgb(220,236,255)';
      for (j = this.jets.length - 1; j >= 0; j--) {
        var p = this.jets[j]; p.a += C.dt; p.x += p.vx * C.dt * mv; p.y += p.vy * C.dt * mv;
        if (p.a > 4) { this.jets.splice(j, 1); continue; }
        g.globalAlpha = .5 * (1 - p.a / 4); g.fillRect(p.x, p.y, 1.6, 1.6);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      /* the lander, bouncing slowly over the top of the nucleus */
      var u = ((t * mv) % 24) / 24, hx = cx + (u * 1.6 - .8) * R * L * -1, hy = cy - R * .75 - Math.abs(Math.sin(u * Math.PI * 3)) * R * .5 * (1 - u * .5);
      g.save(); g.translate(hx, hy); g.rotate(u * 4); var ls = Math.max(9, R * .13);
      g.fillStyle = '#d8dce4'; g.fillRect(-ls, -ls * .6, ls * 2, ls * 1.2); g.fillStyle = '#26304a'; g.fillRect(-ls * .8, -ls * .5, ls * 1.6, ls * .5);
      g.strokeStyle = '#d8dce4'; g.lineWidth = 1; g.beginPath(); g.moveTo(-ls, ls * .6); g.lineTo(-ls * 1.6, ls * 1.4); g.moveTo(ls, ls * .6); g.lineTo(ls * 1.6, ls * 1.4); g.moveTo(0, ls * .6); g.lineTo(0, ls * 1.5); g.stroke();
      g.restore(); blink(g, hx, hy - 4, 10, '94,242,214', Math.sin(t * 2) > .3);
    }
  };

  /* NEPTUNE — cvd: the blue planet with its dark storm and faint rings, Triton going round, and a small probe leaving,
     smaller every second: a goodbye */
  WORLDS.neptune = {
    cfg: { clouds: .15, gal: false, gal2: true, bh: false, wh: false, dust: false, band: false },
    init: function () { build([['nS', function () { return strip(SWs, 71, PAL.neptune); }], ['nP', function () { return TX.nS && sphere(PD, TX.nS, SWs, SWs / 2, [-.55, -.25, .8]); }]]); },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, R = Math.min(W, H) * (C.small ? .26 : .27), cx = X(C, C.small ? .66 : .72) - C.ppx * 6, cy = H * (C.small ? .24 : .36) - C.ppy * 6;
      g.globalCompositeOperation = 'lighter'; halo(g, cx, cy, R * .95, R * 1.4, [[0, 'rgba(90,140,255,.2)'], [1, 'rgba(90,140,255,0)']]); g.globalCompositeOperation = 'source-over';
      g.save(); g.translate(cx, cy); g.rotate(C.rtl ? .25 : -.25);
      g.strokeStyle = 'rgba(200,214,255,.12)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, R * 1.9, R * .3, 0, Math.PI, TAU); g.stroke(); g.restore();
      planet(g, turn('nP', TX.nP, -t / 100 * mv, C, .25), cx, cy, R, C.rtl);
      g.save(); g.translate(cx, cy); g.rotate(C.rtl ? .25 : -.25);
      g.strokeStyle = 'rgba(200,214,255,.14)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, R * 1.9, R * .3, 0, 0, Math.PI); g.stroke(); g.restore();
      var ta = -t * TAU / 70 * mv, tx = cx + Math.cos(ta) * R * 2.3, ty = cy + Math.sin(ta) * R * .5;
      if (Math.sin(ta) < 0 || Math.hypot(tx - cx, ty - cy) > R) moon(g, tx, ty, Math.max(3, R * .06), ['#f4e8e4', '#b8a0a0', '#3a2a2e'], C.rtl ? 1 : -1);
      /* the probe going away */
      var u = ((t * mv) % 60) / 60, s = Math.max(4, Math.min(W, H) * .07 * (1 - u * .9)), px = X(C, .22 + u * .35) - C.ppx * 20 * (1 - u), py = H * (.24 + u * .08);
      g.globalAlpha = u < .9 ? 1 : (1 - u) * 10; probe(g, px, py, s, (C.rtl ? .5 : -.5) + u * .4, t); g.globalAlpha = 1;
    }
  };

  /* A NEBULA — vprof: the Pillars of Creation, brown columns of dust with lit edges, stars being born at their tips, and a
     great creature gliding through. nvm: the Orion Nebula in pink and teal, the four stars at its heart, a ship passing. */
  function nebTex(orion) {
    var Wt = LT ? 240 : 320, Ht = LT ? 180 : 240, N = Wt, f1 = field(N, orion ? 88 : 77, 5, 4), f2 = field(N, orion ? 99 : 66, 4, 8);
    var c = mk(Wt, Ht), x = c.getContext('2d'), im = x.createImageData(Wt, Ht), p = im.data;
    var PC = [[.3, .045, .3], [.55, .06, .12], [.78, .04, .42]];
    for (var y = 0; y < Ht; y++) for (var xx = 0; xx < Wt; xx++) {
      var a = f1[(y % N) * N + xx], b = f2[(y % N) * N + xx], v = y / Ht, u = xx / Wt, col;
      if (orion) {
        col = ramp([[0, 6, 4, 18], [.35, 60, 14, 60], [.55, 200, 60, 120], [.7, 255, 160, 190], [.85, 120, 230, 220], [1, 230, 250, 255]], cl(a * 1.1 + (1 - Math.hypot(u - .55, v - .5) * 1.6) * .35, 0, 1));
        if (b < .38) col = mix(col, [10, 6, 14], cl((.38 - b) * 5, 0, .85));
      } else {
        col = ramp([[0, 4, 8, 20], [.4, 16, 50, 70], [.6, 40, 110, 120], [.8, 150, 190, 170], [1, 230, 240, 220]], cl(a * 1.05 + (1 - v) * .2, 0, 1));
        var dens = 0;
        for (var k = 0; k < 3; k++) {
          var P = PC[k], top = P[2] + (b - .5) * .12, wd = P[1] * (1 + (v - top) * 1.6) + (a - .5) * .03, dx = Math.abs(u - P[0] - (v - top) * .04);
          if (v > top) dens = Math.max(dens, cl((wd - dx) / (wd * .35), 0, 1) * cl((v - top) / .03, 0, 1));
        }
        if (dens > 0) {
          var dust = mix([70, 40, 26], [24, 12, 8], b);
          col = mix(col, dust, dens);
          if (dens > .05 && dens < .55) col = mix(col, [255, 214, 150], (1 - Math.abs(dens - .3) / .25) * .5);
        }
      }
      var i = (y * Wt + xx) * 4; p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; p[i + 3] = 255;
    }
    x.putImageData(im, 0, 0); return c;
  }
  WORLDS.nebula = {
    cfg: { clouds: 0, gal: false, gal2: false, bh: false, wh: false, dust: true, band: false, stars: .7 },
    init: function () { var o = VAR === 'orion'; build([['neb', function () { return nebTex(o); }]]); },
    sky: function (C) {
      var g = C.g, W = C.W, H = C.H, T = TX.neb;
      if (!T) { skyG(C, [[0, '#04060e'], [1, '#0a0816']]); return; }
      var sc = Math.max(W / T.width, H / T.height) * 1.12, ww = T.width * sc, hh = T.height * sc;
      g.imageSmoothingEnabled = true;
      g.drawImage(T, (W - ww) / 2 - C.ppx * 12 + Math.sin(C.t * .02 * C.mv) * 12, (H - hh) / 2 - C.ppy * 12 - C.ssy * .02, ww, hh);
      g.fillStyle = 'rgba(2,3,10,.28)'; g.fillRect(0, 0, W, H);
    },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, o = VAR === 'orion';
      g.globalCompositeOperation = 'lighter';
      if (o) {
        var cx = W * .55 - C.ppx * 12, cy = H * .5 - C.ppy * 12;
        halo(g, cx, cy, 0, Math.min(W, H) * .25, [[0, 'rgba(255,240,250,.35)'], [1, 'rgba(255,111,181,0)']]);
        var ts = [[0, 0], [14, 6], [-8, 12], [6, -10]];
        for (var i = 0; i < 4; i++) halo(g, cx + ts[i][0], cy + ts[i][1], 0, 9 + 3 * Math.sin(t * 2 + i), [[0, 'rgba(255,255,255,1)'], [.3, 'rgba(200,230,255,.6)'], [1, 'rgba(200,230,255,0)']]);
        g.globalCompositeOperation = 'source-over';
        var u = ((t * mv) % 40) / 40, sx = X(C, -.15 + u * 1.3), sy = H * (.3 - .1 * u) - C.ppy * 14, s = Math.max(18, Math.min(W, H) * .04);
        g.save(); g.translate(sx, sy); g.rotate(C.rtl ? -Math.PI / 2 - .2 : Math.PI / 2 + .2); starship(g, 0, 0, s, t); g.restore();
      } else {
        var tips = [[.3, .3], [.55, .12], [.78, .42]];
        for (i = 0; i < 3; i++) { var b = .5 + .5 * Math.sin(t * .9 + i * 2); halo(g, tips[i][0] * W - C.ppx * 12, tips[i][1] * H - C.ppy * 12, 0, 14 + 8 * b, [[0, 'rgba(255,250,230,' + (.4 + .5 * b) + ')'], [1, 'rgba(255,207,107,0)']]); }
        g.globalCompositeOperation = 'source-over';
        var u2 = ((t * mv) % 70) / 70, dir = C.rtl ? -1 : 1, cs = Math.max(60, Math.min(W, H) * .16);
        g.globalAlpha = Math.min(1, Math.sin(u2 * Math.PI) * 1.6);
        creature(g, W / 2 + dir * (u2 - .5) * W * 1.3, H * (.24 + .06 * Math.sin(u2 * TAU)) - C.ppy * 14, cs, t, dir);
        g.globalAlpha = 1;
      }
    }
  };

  /* IO — pools: on Jupiter's volcanic moon, sulphur-yellow ground, a volcano throwing its blue umbrella high into the
     black sky, lava glowing at the vent, Jupiter enormous above */
  WORLDS.io = {
    cfg: { clouds: 0, gal: false, gal2: false, bh: false, wh: false, dust: false, band: false, spikes: false, starTop: .5, stars: .6 },
    init: function () {
      build([['jS', function () { return bandStrip(SWJ); }], ['jupI', function () { return TX.jS && sphere(PD, TX.jS, SWJ, SWJ / 2, [-.8, .2, .55]); }]]);
      s0 = 1313; this.bl = []; for (var i = 0; i < 40; i++) this.bl.push([rnd(), rnd(), rnd(), Math.floor(rnd() * 4)]);
    },
    pl: [], rd: null,
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, hz = H * (C.small ? .72 : .66);
      if (!this.rd) this.rd = ridgesOf(1414, 2, 90, .9);
      var R = Math.min(W, H) * (C.small ? .5 : .46), cx = X(C, .74) - C.ppx * 5, cy = H * .06 - C.ppy * 5;
      planet(g, turn('jupI', TX.jupI, t / 150 * mv, C, .3), cx, cy, R, C.rtl);
      ridge(C, this.rd[0], hz, H * .05, 4, '#8a6a28');
      var gg = g.createLinearGradient(0, hz, 0, H); gg.addColorStop(0, '#c8a84a'); gg.addColorStop(.5, '#8a6a24'); gg.addColorStop(1, '#3a2a0c');
      g.fillStyle = gg; g.fillRect(0, hz + H * .02, W, H);
      var bc = ['rgba(214,112,40,.45)', 'rgba(246,244,228,.35)', 'rgba(40,24,14,.5)', 'rgba(180,60,20,.4)'];
      for (var i = 0; i < this.bl.length; i++) { var q = this.bl[i], v = Math.pow(q[1], 1.3), by = hz + H * .04 + (H - hz) * v, br = (10 + v * 90) * (.5 + q[2]); g.fillStyle = bc[q[3]]; g.beginPath(); g.ellipse(q[0] * W - C.ppx * (4 + v * 14), by, br, br * .22, 0, 0, TAU); g.fill(); }
      ridge(C, this.rd[1], hz + H * .14, H * .03, 14, '#5a4214');
      /* the volcano */
      var vx = X(C, .28) - C.ppx * 6, vy = hz + H * .01, top = H * (C.small ? .2 : .14), sp = (vy - top);
      g.globalCompositeOperation = 'lighter';
      halo(g, vx, vy, 0, H * .08, [[0, 'rgba(255,90,30,.75)'], [.3, 'rgba(255,60,20,.3)'], [1, 'rgba(255,40,20,0)']]);
      if (!C.once && this.pl.length < (C.lt ? 120 : 260)) for (var k = 0; k < (C.RM ? 1 : 4); k++) this.pl.push({ a: 0, vx: (Math.random() - .5) * .9, vy: .85 + Math.random() * .3 });
      g.fillStyle = 'rgb(170,200,255)';
      for (k = this.pl.length - 1; k >= 0; k--) {
        var p = this.pl[k]; p.a += C.dt * mv * .16; if (p.a > 1) { this.pl.splice(k, 1); continue; }
        var px = vx + p.vx * p.a * sp * 1.3, py = vy - sp * p.vy * (2 * p.a - p.a * p.a) * 1.2;
        g.globalAlpha = .55 * Math.sin(p.a * Math.PI); g.fillRect(px, py, 1.8, 1.8);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      var ps = Math.max(18, Math.min(W, H) * .04), pu = ((t * mv) % 50) / 50;
      probe(g, X(C, .1 + pu * .8), H * (.12 + .05 * Math.sin(pu * Math.PI)), ps, -.3 + pu, t);
    }
  };

  /* TRITON — wave: Neptune's moon, pink-grey frozen ground in dimples, dark geysers going straight up and then bent by a
     thin wind, Neptune a blue crescent low in the sky, one small lander far off */
  WORLDS.triton = {
    cfg: { clouds: 0, gal: false, gal2: true, bh: false, wh: false, dust: false, band: false, spikes: false, starTop: .6 },
    init: function () { build([['nS', function () { return strip(SWs, 71, PAL.neptune); }], ['nP2', function () { return TX.nS && sphere(LT ? 200 : 260, TX.nS, SWs, SWs / 2, [.95, -.1, .15]); }]]); s0 = 1515; this.dm = []; for (var i = 0; i < 60; i++) this.dm.push([rnd(), rnd(), rnd()]); },
    gp: [], rd: null,
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, hz = H * (C.small ? .72 : .66);
      if (!this.rd) this.rd = ridgesOf(1616, 2, 90, .5);
      var R = Math.min(W, H) * .2, cx = X(C, .26) - C.ppx * 4, cy = H * .22 - C.ppy * 4;
      planet(g, turn('nP2', TX.nP2, t / 120 * mv, C, .4), cx, cy, R, C.rtl);
      ridge(C, this.rd[0], hz, H * .03, 4, '#8a7a80');
      var gg = g.createLinearGradient(0, hz, 0, H); gg.addColorStop(0, '#b8a6a8'); gg.addColorStop(.4, '#7a6a70'); gg.addColorStop(1, '#2a2228');
      g.fillStyle = gg; g.fillRect(0, hz + H * .015, W, H);
      for (var i = 0; i < this.dm.length; i++) { var q = this.dm[i], v = Math.pow(q[1], 1.2), dy = hz + H * .03 + (H - hz) * v, dr = (6 + v * 40) * (.6 + q[2]); g.fillStyle = 'rgba(60,46,54,.28)'; g.beginPath(); g.ellipse(q[0] * W - C.ppx * (3 + v * 12), dy, dr, dr * .3, 0, 0, TAU); g.fill(); }
      ridge(C, this.rd[1], hz + H * .12, H * .025, 12, '#4a3c44');
      /* the geysers */
      var srcs = [.4, .62, .86];
      if (!C.once) for (var s = 0; s < srcs.length; s++) if (Math.random() < (C.lt ? .5 : 1)) this.gp.push({ s: s, a: 0, j: (Math.random() - .5) * .02 });
      g.fillStyle = 'rgb(40,30,36)';
      for (var k = this.gp.length - 1; k >= 0; k--) {
        var p = this.gp[k]; p.a += C.dt * mv * .08; if (p.a > 1) { this.gp.splice(k, 1); continue; }
        var gx = X(C, srcs[p.s] + p.j) - C.ppx * 5, rise = Math.min(p.a, .45) / .45, bend = Math.max(0, p.a - .45) / .55;
        var px = gx + (C.rtl ? -1 : 1) * bend * W * .25, py = hz - rise * H * .28 + bend * H * .02;
        g.globalAlpha = .45 * (1 - p.a); g.fillRect(px, py, 2.2, 2.2);
      }
      g.globalAlpha = 1;
      var lx = X(C, .72) - C.ppx * 6; lander(g, lx, hz + H * .05, Math.max(14, Math.min(W, H) * .03), t);
    }
  };

  /* THE ASTEROID BELT — risk: rocks coming at us out of the dark, a small craft weaving between them, a red warning glow
     whenever one passes too close */
  WORLDS.asteroids = {
    cfg: { clouds: .15, gal: false, gal2: false, bh: false, wh: false, dust: false, band: false },
    init: function () {
      s0 = 1717; this.R = [];
      for (var i = 0; i < (LT ? 22 : 38); i++) { var P = []; for (var k = 0; k < 9; k++) P.push(.7 + rnd() * .45); this.R.push({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: rnd(), P: P, r: rnd() * TAU, sp: (rnd() - .5) * .8, s: .5 + rnd() }); }
    },
    warn: 0,
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, cx = W / 2 - C.ppx * 20, cy = H * .42 - C.ppy * 20, F = Math.max(W, H) * .5, close = 0;
      this.R.sort(function (a, b) { return b.z - a.z; });
      for (var i = 0; i < this.R.length; i++) {
        var A = this.R[i];
        if (!C.once) A.z -= C.dt * mv * .05;
        if (A.z < .05) { A.z = 1; A.x = Math.random() * 2 - 1; A.y = Math.random() * 2 - 1; }
        var sc = 1 / (A.z * 4 + .2), x = cx + A.x * F * sc * .6, y = cy + A.y * F * sc * .45, r = A.s * 14 * sc * (C.small ? .8 : 1);
        if (x < -r || x > W + r || y < -r || y > H + r) continue;
        if (A.z < .12 && r > 60) close = 1;
        var gr = g.createLinearGradient(x - r, y - r, x + r, y + r); gr.addColorStop(0, '#8a8290'); gr.addColorStop(.5, '#3a3440'); gr.addColorStop(1, '#0e0c12');
        g.globalAlpha = cl((1 - A.z) * 2, 0, 1); g.fillStyle = gr; g.beginPath();
        for (var k = 0; k < 9; k++) { var a = A.r + t * A.sp * mv + k / 9 * TAU; g.lineTo(x + Math.cos(a) * r * A.P[k], y + Math.sin(a) * r * A.P[k]); }
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      this.warn += ((close ? 1 : 0) - this.warn) * .08;
      if (this.warn > .02) { var vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(255,40,60,0)'); vg.addColorStop(1, 'rgba(255,40,60,' + .35 * this.warn + ')'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
      var u = t * mv * .3, dx = X(C, .5 + .3 * Math.sin(u)), dy = H * (.3 + .12 * Math.sin(u * 1.7)), dang = Math.atan2(.12 * 1.7 * Math.cos(u * 1.7) * H, .3 * Math.cos(u) * W * (C.rtl ? -1 : 1));
      dart(g, dx, dy, Math.max(16, Math.min(W, H) * .035), dang, t);
    }
  };

  /* EARTH FROM CLOSE ORBIT — three versions. capflow: the bright day side, an astronaut floating at the end of a tether.
     hashp: the sun rising over the rim, the station's solar wings turning gold. rotation: a comet passing over Earth. */
  WORLDS.orbit = {
    cfg: { clouds: 0, gal: false, gal2: false, bh: false, wh: false, dust: false, band: false, stars: .8 },
    init: function () { build(earthTx(PD, VAR === 'rise' ? [.95, -.3, .1] : [-.5, -.5, .7])); },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, v = VAR;
      var R = Math.max(W, H) * (v === 'comet' ? .62 : .9), cx = X(C, v === 'comet' ? .3 : .5) - C.ppx * 8, cy = H * (v === 'comet' ? 1.25 : C.small ? 1.42 : 1.55) + R * (v === 'comet' ? 0 : .02) - C.ppy * 8;
      if (v !== 'comet') cy = H * (C.small ? .74 : .7) + R;
      planet(g, turn('eP' + PD, TX['eP' + PD], t / 140 * mv, C, .25), cx, cy, R, C.rtl);
      rim(g, cx, cy, R * 1.003, 'rgba(110,180,255,.5)', Math.max(3, R * .01));
      g.globalCompositeOperation = 'lighter'; halo(g, cx, cy, R, R * 1.04, [[0, 'rgba(110,180,255,.3)'], [1, 'rgba(110,180,255,0)']]); g.globalCompositeOperation = 'source-over';
      var s = Math.max(36, Math.min(W, H) * .08);
      if (v === 'rise') {
        var u = ((t * mv) % 40) / 40, f = u < .5 ? ease(u * 2) : 1 - ease((u - .5) * 2) * .7, sa = C.rtl ? .55 : -.55, sx = cx + Math.sin(sa) * R, sy = cy - Math.cos(sa) * R - f * 6;
        g.globalCompositeOperation = 'lighter';
        halo(g, sx, sy, 0, H * .7 * (.4 + f), [[0, 'rgba(255,252,240,' + .95 * f + ')'], [.04, 'rgba(255,207,107,' + .6 * f + ')'], [.25, 'rgba(255,111,181,' + .14 * f + ')'], [1, 'rgba(155,123,255,0)']]);
        g.strokeStyle = 'rgba(255,170,90,' + .7 * f + ')'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, R + 3, -Math.PI / 2 + sa - .2, -Math.PI / 2 + sa + .2); g.stroke();
        g.strokeStyle = 'rgba(110,180,255,' + .6 * f + ')'; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, R + 9, -Math.PI / 2 + sa - .35, -Math.PI / 2 + sa + .35); g.stroke();
        g.globalCompositeOperation = 'source-over';
        station(g, X(C, .22) - C.ppx * 22, H * .2 - C.ppy * 14, s * 2.2, (C.rtl ? -.15 : .15) + Math.sin(t * .1) * .03, t, f > .4);
      } else if (v === 'comet') {
        var cu = ((t * mv) % 50) / 50, hx = X(C, -.1 + cu * 1.2), hy = H * (.12 + .1 * cu) - C.ppy * 10, dir = C.rtl ? 1 : -1, tl = Math.min(W, H) * .7;
        g.globalCompositeOperation = 'lighter';
        var ion = g.createLinearGradient(hx, hy, hx + dir * tl, hy - tl * .25); ion.addColorStop(0, 'rgba(160,210,255,.7)'); ion.addColorStop(1, 'rgba(124,200,255,0)');
        g.fillStyle = ion; g.beginPath(); g.moveTo(hx, hy - 3); g.lineTo(hx + dir * tl, hy - tl * .25 - 16); g.lineTo(hx + dir * tl, hy - tl * .25 + 10); g.lineTo(hx, hy + 3); g.fill();
        var du = g.createLinearGradient(hx, hy, hx + dir * tl * .8, hy + tl * .1); du.addColorStop(0, 'rgba(255,240,210,.55)'); du.addColorStop(1, 'rgba(255,207,107,0)');
        g.fillStyle = du; g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo(hx + dir * tl * .4, hy - 10, hx + dir * tl * .8, hy + tl * .1 - 30); g.lineTo(hx + dir * tl * .8, hy + tl * .1 + 30); g.quadraticCurveTo(hx + dir * tl * .4, hy + 20, hx, hy + 2); g.fill();
        halo(g, hx, hy, 0, 22, [[0, 'rgba(255,255,255,1)'], [.3, 'rgba(200,236,255,.5)'], [1, 'rgba(124,200,255,0)']]);
        g.globalCompositeOperation = 'source-over';
        station(g, X(C, .78) - C.ppx * 10, H * .42 - C.ppy * 8, s * .7, .2 + t * .02, t, true);
      } else {
        /* the spacewalk: a piece of the station from the corner, the astronaut on a tether, turning slowly */
        var tx = X(C, .96), ty = H * .1;
        g.fillStyle = '#9aa1b0'; g.save(); g.translate(tx, ty); g.rotate(C.rtl ? -.5 : .5); g.fillRect(-s * 2.5, -s * .15, s * 3, s * .3);
        g.fillStyle = '#e8ecf3'; rr(g, -s * .4, -s * .45, s * 1.6, s * .9, s * .3); g.fill(); g.restore();
        var ax = X(C, .74 + .03 * Math.sin(t * .23 * mv)) - C.ppx * 18, ay = H * (.3 + .03 * Math.sin(t * .31 * mv)) - C.ppy * 14;
        astro(g, ax, ay, s, Math.sin(t * .18 * mv) * .6 + .3, { t: t, float: true, tether: [tx - (C.rtl ? -1 : 1) * s * .6, ty + s * .4], flip: C.rtl });
      }
    }
  };

  /* THE VOID — hodl: almost nothing. A pale blue dot far away, a band of sunlight, and an astronaut drifting further off,
     the tether cut, turning over slowly. Sadness, and the long view. */
  WORLDS.void = {
    cfg: { clouds: .05, gal: false, gal2: false, bh: false, wh: false, dust: false, band: false, spikes: false, stars: .4, shoot: false },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, dx = X(C, .8) - C.ppx * 3, dy = H * .24 - C.ppy * 3;
      g.globalCompositeOperation = 'lighter';
      var bg = g.createLinearGradient(X(C, .55), 0, X(C, 1), H); bg.addColorStop(0, 'rgba(255,230,200,0)'); bg.addColorStop(.5, 'rgba(255,230,200,.06)'); bg.addColorStop(1, 'rgba(255,230,200,0)');
      g.fillStyle = bg; g.beginPath(); g.moveTo(X(C, .74), 0); g.lineTo(X(C, .86), 0); g.lineTo(X(C, .9), H); g.lineTo(X(C, .66), H); g.fill();
      halo(g, dx, dy, 0, 10, [[0, 'rgba(170,210,255,1)'], [.25, 'rgba(110,170,255,.45)'], [1, 'rgba(110,170,255,0)']]);
      g.globalCompositeOperation = 'source-over';
      var u = ((t * mv) % 90) / 90, s = Math.max(10, Math.min(W, H) * .1 * (1 - u * .8)), ax = X(C, .3 + u * .25) - C.ppx * 16 * (1 - u), ay = H * (.3 + u * .05) - C.ppy * 12;
      g.globalAlpha = u < .08 ? u / .08 : u > .92 ? (1 - u) / .08 : 1;
      astro(g, ax, ay, s, t * .12 * mv, { t: t, float: true, flip: C.rtl, tint: 'rgba(20,30,60,.25)' });
      g.strokeStyle = 'rgba(230,236,248,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(ax - s * 1.5, ay + s, ax - s * 2.2 * Math.cos(t * .3), ay + s * 2); g.stroke();
      g.globalAlpha = 1;
    }
  };

  /* LAUNCH — the hub: Earth's bright rim below and Starship climbing past it, the booster falling away and coming home */
  WORLDS.launch = {
    cfg: { clouds: .2, gal: true, gal2: false, bh: false, wh: false, dust: false, band: true, stars: .9 },
    init: function () { build(earthTx(PD, [-.3, -.6, .74])); },
    front: function (C) {
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, R = Math.max(W, H) * 1.1, cx = W / 2 - C.ppx * 6, cy = H * (C.small ? .82 : .8) + R - C.ppy * 6;
      planet(g, turn('eP' + PD, TX['eP' + PD], t / 160 * mv, C, .3), cx, cy, R, C.rtl);
      rim(g, cx, cy, R * 1.002, 'rgba(110,180,255,.55)', Math.max(3, R * .006));
      g.globalCompositeOperation = 'lighter'; halo(g, cx, cy, R, R * 1.03, [[0, 'rgba(110,180,255,.35)'], [1, 'rgba(110,180,255,0)']]); g.globalCompositeOperation = 'source-over';
      var u = ((t * mv) % 26) / 26, s = Math.max(20, Math.min(W, H) * .045), lx = X(C, .74) - C.ppx * 12;
      if (u < .8) {
        var k = u / .8, sy = H * 1.05 - Math.pow(k, 1.6) * H * 1.4, tilt = (C.rtl ? -1 : 1) * k * .25, sep = k > .45;
        g.save(); g.translate(lx + (C.rtl ? -1 : 1) * k * k * W * .12, sy); g.rotate(tilt);
        if (!sep) starship(g, 0, 0, s, t);
        else {
          starship(g, 0, -s * .2, s * .8, t);
          var bk = (k - .45) / .55; g.save(); g.translate(0, s * 2.4 + bk * s * 6); g.rotate(bk * 2.4);
          g.fillStyle = '#c8ccd8'; g.fillRect(-s * .2, -s * .8, s * .4, s * 1.8); g.restore();
        }
        g.restore();
      }
    }
  };

  /* THE CUPOLA — defi: looking down at the night Earth and its aurora through the station's seven-window dome */
  function cupolaFrame(C) {
    var g = C.g, W = C.W, H = C.H, cx = W / 2 - C.ppx * 4, cy = H * .42 - C.ppy * 4, r0 = Math.min(W, H) * (C.small ? .3 : .26), r1 = r0 * 2.35, gap = r0 * .07;
    g.beginPath(); g.rect(0, 0, W, H); g.moveTo(cx + r0, cy); g.arc(cx, cy, r0, 0, TAU, true);
    for (var i = 0; i < 6; i++) {
      var a0 = i * TAU / 6 + .06, a1 = (i + 1) * TAU / 6 - .06, ri = r0 + gap;
      g.moveTo(cx + Math.cos(a0) * ri, cy + Math.sin(a0) * ri); g.lineTo(cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1);
      g.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1); g.lineTo(cx + Math.cos(a1) * ri, cy + Math.sin(a1) * ri); g.closePath();
    }
    var fg = g.createRadialGradient(cx, cy, r0, cx, cy, Math.max(W, H)); fg.addColorStop(0, 'rgba(60,66,84,.98)'); fg.addColorStop(.3, 'rgba(26,30,44,.98)'); fg.addColorStop(1, 'rgba(8,10,18,.99)');
    g.fillStyle = fg; g.fill('evenodd'); g.strokeStyle = 'rgba(200,214,240,.28)'; g.lineWidth = 2; g.stroke();
    for (i = 0; i < 12; i++) { var a = i * TAU / 12; g.fillStyle = 'rgba(200,214,240,.35)'; g.beginPath(); g.arc(cx + Math.cos(a) * (r0 + gap * .5), cy + Math.sin(a) * (r0 + gap * .5), 2, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'lighter'; halo(g, cx - r0 * .4, cy - r0 * .5, 0, r0 * .5, [[0, 'rgba(255,255,255,.05)'], [1, 'rgba(255,255,255,0)']]); g.globalCompositeOperation = 'source-over';
  }

  /* the cast on the five first worlds, by version */
  var HERO = {
    eva: function (C) {   /* oi: over Jupiter, the capsule's hatch open, an astronaut out on a tether */
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, s = Math.max(30, Math.min(W, H) * .1);
      var kx = X(C, C.small ? .2 : .24) - C.ppx * 20, ky = STY(C, .42) + Math.sin(t * .4) * 6 - C.ppy * 10;
      capsule(g, kx, ky, s * 1.4, (C.rtl ? -.2 : .2) + Math.sin(t * .1 * mv) * .05, t, true);
      var ax = kx + (C.rtl ? -1 : 1) * s * (2.2 + .4 * Math.sin(t * .21 * mv)), ay = ky + s * (.8 + .4 * Math.sin(t * .27 * mv));
      astro(g, ax, ay, s * .8, Math.sin(t * .2 * mv) * .5 - .2, { t: t, float: true, tether: [kx + (C.rtl ? -1 : 1) * s * .5, ky + s * .1], flip: C.rtl, wave: Math.sin(t * .05) > .6 ? 0 : null });
    },
    ufo: function (C) {   /* mvrv: something hovering over the ice of Europa, now and then lighting it up */
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, hz = WORLDS.europa.hz || H * .72, s = Math.max(24, Math.min(W, H) * .05);
      var x = X(C, .26 + .06 * Math.sin(t * .13 * mv)) - C.ppx * 14, y = hz - H * (.16 + .03 * Math.sin(t * .7 * mv)) - C.ppy * 10, b = ((t * mv) % 14) / 14;
      if (b > .55 && b < .85) {
        var on = Math.min(1, (b - .55) / .05) * Math.min(1, (.85 - b) / .05), bm = g.createLinearGradient(0, y, 0, hz + 12);
        bm.addColorStop(0, 'rgba(94,242,214,' + .5 * on + ')'); bm.addColorStop(1, 'rgba(94,242,214,0)');
        g.globalCompositeOperation = 'lighter'; g.fillStyle = bm; g.beginPath(); g.moveTo(x - s * .3, y); g.lineTo(x + s * .3, y); g.lineTo(x + s * 1.1, hz + 12); g.lineTo(x - s * 1.1, hz + 12); g.fill();
        halo(g, x, hz + 8, 0, s * 2, [[0, 'rgba(94,242,214,' + .45 * on + ')'], [1, 'rgba(94,242,214,0)']]); g.globalCompositeOperation = 'source-over';
      }
      saucer(g, x, y, s, t);
    },
    iss: function (C) {   /* flows: the station itself, big, going slowly over the night side */
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, u = ((t * mv) % 80) / 80, s = Math.max(40, Math.min(W, H) * .1);
      station(g, X(C, -.15 + u * 1.3) - C.ppx * 16, STY(C, .45 - .12 * Math.sin(u * Math.PI)) - C.ppy * 8, s, (C.rtl ? .12 : -.12) + u * .1, t, false);
    },
    aurora: function (C) { /* stables: a train of new satellites crossing above the aurora */
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, u = ((t * mv) % 36) / 36;
      g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 16; i++) { var x = X(C, -.3 + u * 1.6 - i * .022), y = H * (.12 + (u * 1.6 - i * .022) * .1); halo(g, x, y, 0, 4, [[0, 'rgba(255,255,255,.95)'], [1, 'rgba(200,230,255,0)']]); }
      g.globalCompositeOperation = 'source-over';
    },
    cupola: cupolaFrame,
    close: function (C) { /* network: Cassini, close to the rings */
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, s = Math.max(26, Math.min(W, H) * .055);
      cassini(g, X(C, .22 + .03 * Math.sin(t * .1 * mv)) - C.ppx * 18, STY(C, .45) + Math.sin(t * .3) * 5 - C.ppy * 10, s, (C.rtl ? -.5 : .5) + Math.sin(t * .07) * .1);
    },
    chute: function (C) { /* cycle: a probe under its parachute, going down into Titan's haze */
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, u = ((t * mv) % 45) / 45, s = Math.max(16, Math.min(W, H) * .035);
      g.globalAlpha = u < .1 ? u / .1 : u > .9 ? (1 - u) / .1 : 1;
      chute(g, X(C, .2 + u * .08) - C.ppx * 14, STY(C, -.2 + u * .75) - C.ppy * 8, s * (1.3 - u * .5), t); g.globalAlpha = 1;
    },
    storm: function (C) { /* liqmap: an astronaut by the rover, lamp on, leaning into the dust */
      var g = C.g, W = C.W, H = C.H, t = C.t, s = Math.max(30, Math.min(W, H) * .06), M = WORLDS.mars, hz = H * (C.small ? .8 : .74);
      if (!M.rid) return;
      var x = X(C, .28) - C.ppx * 18, y = onRidge(C, M.rid[2], hz + H * .15, H * .07, 18, x) - s * 1.3;
      astro(g, x, y, s, C.rtl ? -.12 : .12, { t: t, walk: true, lamp: true, lampA: (C.rtl ? Math.PI : 0) + .2, flip: C.rtl, tint: 'rgba(120,50,20,' + (.15 + .4 * (M.sf || 0)) + ')' });
    },
    day: function (C) {   /* ethsup: the little helicopter hopping, its shadow on the ground */
      if (KIND !== 'mars') return;
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, u = ((t * mv) % 16) / 16, s = Math.max(30, Math.min(W, H) * .06), hz = H * (C.small ? .8 : .74);
      var up = Math.sin(Math.min(1, u / .8) * Math.PI), x = X(C, .34 + u * .1) - C.ppx * 16, gy = hz + H * .1, y = gy - up * H * .22 - s * .4;
      g.fillStyle = 'rgba(40,20,10,' + (.35 - up * .2) + ')'; g.beginPath(); g.ellipse(x, gy, s * .5, s * .08, 0, 0, TAU); g.fill();
      heli(g, x, y, s, t);
    },
    night: function (C) { /* scanner: a craft sweeping the dark ground with a scanning beam */
      if (KIND !== 'mars') return;
      var g = C.g, W = C.W, H = C.H, t = C.t, mv = C.mv, s = Math.max(24, Math.min(W, H) * .05), hz = H * (C.small ? .8 : .74);
      var x = X(C, .5 + .3 * Math.sin(t * .09 * mv)) - C.ppx * 12, y = hz - H * .2 + Math.sin(t * .8) * 5, sw = Math.sin(t * .9 * mv) * s * 3;
      g.globalCompositeOperation = 'lighter';
      var bm = g.createLinearGradient(0, y, 0, hz + H * .08); bm.addColorStop(0, 'rgba(94,242,214,.4)'); bm.addColorStop(1, 'rgba(94,242,214,.02)');
      g.fillStyle = bm; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x + sw + s * .8, hz + H * .08); g.lineTo(x + sw - s * .8, hz + H * .08); g.fill();
      g.strokeStyle = 'rgba(94,242,214,.6)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x + sw, hz + H * .08, s * .8, s * .14, 0, 0, TAU); g.stroke();
      g.globalCompositeOperation = 'source-over';
      saucer(g, x, y, s, t);
    }
  };

  /* ---------- clicks: every click on the open sky brings something different */
  var FX = [], bag = [], lastK = '', clicks = 0, ambientNext = 40;
  var BASE = ['pod', 'astro', 'ufo', 'creature', 'starship', 'wow', 'comet', 'shower', 'nova'];
  var LOCAL = { mars: ['storm', 'drone'], europa: ['plume'], jupiter: ['bolt'], earth: ['sunrise'], saturn: ['shower'], deep: ['nova'] };
  function pick() {
    if (!bag.length) {
      bag = BASE.concat(LOCAL[KIND] || []);
      for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
      if (bag[bag.length - 1] === lastK) bag.unshift(bag.pop());
    }
    if (clicks === 1) { var big = ['pod', 'astro', 'ufo', 'creature', 'starship'][Math.floor(Math.random() * 5)], at = bag.indexOf(big); if (at >= 0) bag.splice(at, 1); return big; }
    return bag.pop();
  }
  var CT = null;
  function addFx(x, y) {
    clicks++;
    if (still()) return;
    if (RM) { FX.push({ k: 'glow', x: x, y: y, t0: -1 }); return; }
    var k = pick(); lastK = k;
    var Wd = WORLDS[KIND];
    if (k === 'storm' && Wd) { Wd.nextStorm = 0; Wd.asked = 1; return; }
    if (k === 'plume' && Wd && CT) { Wd.plume(CT, x); return; }
    if (k === 'sunrise' && Wd && CT) { Wd.rise(CT); return; }
    FX.push({ k: k, x: x, y: y, t0: -1, s: Math.random() });
  }
  function okTarget(el) {
    if (!el || !el.closest) return false;
    if (el.closest('a,button,input,select,textarea,label,summary,details,[role=button],[role=tab],[contenteditable],.ob-hc,#ekh,#ekf,#ekb,#eks,#ekq,#eka,.ek-mo,svg,canvas:not(.ob-sky),img,video,iframe')) return false;
    var s = w.getSelection && w.getSelection(); if (s && String(s).length) return false;
    return true;
  }
  d.addEventListener('click', function (e) { if (e.button || !okTarget(e.target)) return; addFx(e.clientX, e.clientY); });
  w.OBSURPRISE = function (x, y) { addFx(x == null ? innerWidth / 2 : x, y == null ? innerHeight / 3 : y); };

  function saucer(g, x, y, s, t) {
    g.globalCompositeOperation = 'lighter';
    halo(g, x, y - s * .25, 0, s * .9, [[0, 'rgba(94,242,214,.5)'], [1, 'rgba(94,242,214,0)']]);
    g.globalCompositeOperation = 'source-over';
    var bd = g.createLinearGradient(x, y - s * .2, x, y + s * .2); bd.addColorStop(0, '#e8ecff'); bd.addColorStop(.5, '#8a8fb8'); bd.addColorStop(1, '#2a2c48');
    g.fillStyle = bd; g.beginPath(); g.ellipse(x, y, s, s * .22, 0, 0, TAU); g.fill();
    var dm = g.createRadialGradient(x, y - s * .3, 0, x, y - s * .2, s * .45); dm.addColorStop(0, 'rgba(200,255,246,.95)'); dm.addColorStop(1, 'rgba(94,242,214,.25)');
    g.fillStyle = dm; g.beginPath(); g.ellipse(x, y - s * .12, s * .42, s * .3, 0, Math.PI, TAU); g.fill();
    var cols = ['#5ef2d6', '#7cc8ff', '#9b7bff', '#ff6fb5', '#ffcf6b'];
    for (var i = 0; i < 7; i++) { var a = i / 7 * Math.PI + .2, lx = x + Math.cos(a) * s * .8 * (i % 2 ? 1 : -1) * (i / 7), ly = y + s * .06;
      g.fillStyle = cols[(i + Math.floor(t * 8)) % 5]; g.beginPath(); g.arc(x - s * .75 + i * s * .25, ly, Math.max(1.2, s * .05), 0, TAU); g.fill(); void lx; }
  }
  function creature(g, x, y, s, t, dir) {
    var flap = Math.sin(t * 2.4) * .35;
    g.save(); g.translate(x, y); g.scale(dir, 1);
    g.globalCompositeOperation = 'lighter';
    var body = g.createRadialGradient(0, 0, 0, 0, 0, s);
    body.addColorStop(0, 'rgba(155,123,255,.28)'); body.addColorStop(.7, 'rgba(94,242,214,.08)'); body.addColorStop(1, 'rgba(94,242,214,0)');
    g.fillStyle = body;
    g.beginPath(); g.moveTo(s * .9, 0);
    g.bezierCurveTo(s * .4, -s * (.2 + flap), -s * .2, -s * (.9 + flap), -s * .5, -s * (.7 + flap * 1.2));
    g.bezierCurveTo(-s * .4, -s * .2, -s * .7, -s * .05, -s * 1.6, 0);
    g.bezierCurveTo(-s * .7, s * .05, -s * .4, s * .2, -s * .5, s * (.7 + flap * 1.2));
    g.bezierCurveTo(-s * .2, s * (.9 + flap), s * .4, s * (.2 + flap), s * .9, 0); g.fill();
    for (var i = 0; i < 9; i++) {
      var u = i / 8, side = i % 2 ? 1 : -1, px = s * (.6 - u * 1.1), py = side * s * (.15 + .55 * Math.sin(u * Math.PI)) * (1 + flap * .6);
      var al = .5 + .5 * Math.sin(t * 5 + i * 1.3);
      halo(g, px, py, 0, s * .09, [[0, 'rgba(94,242,214,' + al + ')'], [1, 'rgba(94,242,214,0)']]);
    }
    g.restore();
  }
  function starship(g, x, y, s, t) {
    g.globalCompositeOperation = 'lighter';
    var fl = 1 + .15 * Math.sin(t * 40);
    var pl = g.createLinearGradient(x, y + s * 1.1, x, y + s * (1.1 + 2.4 * fl));
    pl.addColorStop(0, 'rgba(255,255,255,.95)'); pl.addColorStop(.15, 'rgba(255,207,107,.85)'); pl.addColorStop(.5, 'rgba(255,111,181,.35)'); pl.addColorStop(1, 'rgba(155,123,255,0)');
    g.fillStyle = pl; g.beginPath(); g.moveTo(x - s * .16, y + s * 1.1); g.lineTo(x + s * .16, y + s * 1.1); g.lineTo(x + s * .4, y + s * (1.1 + 2.4 * fl)); g.lineTo(x - s * .4, y + s * (1.1 + 2.4 * fl)); g.fill();
    halo(g, x, y + s * 1.15, 0, s * .7, [[0, 'rgba(124,200,255,.7)'], [1, 'rgba(124,200,255,0)']]);
    g.globalCompositeOperation = 'source-over';
    var bd = g.createLinearGradient(x - s * .18, 0, x + s * .18, 0); bd.addColorStop(0, '#5c6274'); bd.addColorStop(.45, '#eef1f8'); bd.addColorStop(1, '#6a7084');
    g.fillStyle = bd; g.beginPath(); g.moveTo(x - s * .18, y + s * 1.1); g.lineTo(x - s * .18, y - s * .7); g.quadraticCurveTo(x, y - s * 1.25, x + s * .18, y - s * .7); g.lineTo(x + s * .18, y + s * 1.1); g.closePath(); g.fill();
    g.fillStyle = '#3a3f50'; g.fillRect(x - s * .3, y - s * .7, s * .12, s * .22); g.fillRect(x + s * .18, y - s * .7, s * .12, s * .22);
    g.fillRect(x - s * .32, y + s * .75, s * .14, s * .32); g.fillRect(x + s * .18, y + s * .75, s * .14, s * .32);
  }
  function drawFx(C) {
    var g = C.g, t = C.t, W = C.W, H = C.H;
    for (var i = FX.length - 1; i >= 0; i--) {
      var F = FX[i]; if (F.t0 < 0) F.t0 = t;
      var a = t - F.t0, x = F.x, y = F.y, u, k;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1;
      if (F.k === 'glow') {
        u = a / 3.5; if (u >= 1) { FX.splice(i, 1); continue; }
        halo(g, x, y, 0, 30 + u * 70, [[0, 'rgba(124,200,255,' + .35 * (1 - u) + ')'], [.6, 'rgba(155,123,255,' + .12 * (1 - u) + ')'], [1, 'rgba(155,123,255,0)']]);
      } else if (F.k === 'nova') {
        u = a / 1.8; if (u >= 1) { FX.splice(i, 1); continue; }
        var fl = u < .1 ? u / .1 : 1 - (u - .1) / .9;
        halo(g, x, y, 0, 26 + 60 * fl, [[0, 'rgba(255,255,255,' + fl + ')'], [.2, 'rgba(255,207,107,' + .6 * fl + ')'], [1, 'rgba(255,111,181,0)']]);
        g.strokeStyle = 'rgba(255,207,107,' + (1 - u) * .7 + ')'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 10 + u * 140, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(94,242,214,' + (1 - u) * .5 + ')'; g.beginPath(); g.arc(x, y, 6 + u * 90, 0, TAU); g.stroke();
        for (k = 0; k < 8; k++) { var aa = k * TAU / 8 + .2, ln = (20 + 60 * fl) * (k % 2 ? .5 : 1); g.strokeStyle = 'rgba(255,244,222,' + fl * .7 + ')'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(aa) * ln, y + Math.sin(aa) * ln); g.stroke(); }
      } else if (F.k === 'ufo') {
        u = a / 3.6; if (u >= 1) { FX.splice(i, 1); continue; }
        var from = x < W / 2 ? -80 : W + 80, sx, sy, sz = Math.max(26, Math.min(W, H) * .05);
        if (u < .25) { k = ease(u / .25); sx = from + (x - from) * k; sy = y - 70 - (1 - k) * 60; }
        else if (u < .65) { sx = x + Math.sin(a * 3) * 6; sy = y - 70 + Math.sin(a * 5) * 4;
          var bm = g.createLinearGradient(0, sy, 0, y); bm.addColorStop(0, 'rgba(94,242,214,.45)'); bm.addColorStop(1, 'rgba(94,242,214,0)');
          var on = Math.min(1, (u - .25) / .05) * Math.min(1, (.65 - u) / .05); g.globalAlpha = on; g.fillStyle = bm;
          g.beginPath(); g.moveTo(sx - sz * .3, sy); g.lineTo(sx + sz * .3, sy); g.lineTo(sx + sz * .9, y + 10); g.lineTo(sx - sz * .9, y + 10); g.fill(); g.globalAlpha = 1; }
        else { k = (u - .65) / .35; k = k * k; sx = x + Math.sin(k * 14) * 40 * (1 - k) + (x < W / 2 ? 1 : -1) * k * W * 1.1; sy = y - 70 - k * H * .9; }
        saucer(g, sx, sy, sz, a);
      } else if (F.k === 'ufofar') {
        u = a / 1.6; if (u >= 1) { FX.splice(i, 1); continue; }
        var fx = F.dir > 0 ? -20 + u * (W + 40) : W + 20 - u * (W + 40), fy = F.y + Math.sin(u * 20) * 6;
        saucer(g, fx, fy, 7, a);
      } else if (F.k === 'comet') {
        u = a / 3; if (u >= 1) { FX.splice(i, 1); continue; }
        var dx = x < W / 2 ? 1 : -1, cx2 = x + dx * u * W * .55, cy2 = y + u * H * .18, al = Math.sin(u * Math.PI);
        var tl = g.createLinearGradient(cx2, cy2, cx2 - dx * 220, cy2 - 70);
        tl.addColorStop(0, 'rgba(255,255,255,' + al + ')'); tl.addColorStop(.3, 'rgba(124,200,255,' + .5 * al + ')'); tl.addColorStop(1, 'rgba(155,123,255,0)');
        g.strokeStyle = tl; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx2, cy2); g.lineTo(cx2 - dx * 220, cy2 - 70); g.stroke();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(94,242,214,' + .5 * al + ')'; g.beginPath(); g.moveTo(cx2, cy2); g.lineTo(cx2 - dx * 260, cy2 - 40); g.stroke();
        halo(g, cx2, cy2, 0, 14, [[0, 'rgba(255,255,255,' + al + ')'], [1, 'rgba(124,200,255,0)']]);
      } else if (F.k === 'shower') {
        u = a / 2.2; if (u >= 1) { FX.splice(i, 1); continue; }
        if (!F.m) { F.m = []; for (k = 0; k < 16; k++) F.m.push([Math.random() * TAU, .3 + Math.random() * .7, Math.random() * .4]); }
        for (k = 0; k < F.m.length; k++) {
          var m = F.m[k], mu = (u - m[2]) / .6; if (mu < 0 || mu > 1) continue;
          var r1 = mu * 260 * m[1], r0 = Math.max(0, r1 - 70), mx0 = x + Math.cos(m[0]) * r0, my0 = y + Math.sin(m[0]) * r0, mx1 = x + Math.cos(m[0]) * r1, my1 = y + Math.sin(m[0]) * r1;
          var sg = g.createLinearGradient(mx1, my1, mx0, my0); sg.addColorStop(0, 'rgba(255,255,255,' + (1 - mu) + ')'); sg.addColorStop(1, 'rgba(124,200,255,0)');
          g.strokeStyle = sg; g.lineWidth = 1.4; g.beginPath(); g.moveTo(mx0, my0); g.lineTo(mx1, my1); g.stroke();
        }
      } else if (F.k === 'wow') {
        u = a / 4; if (u >= 1) { FX.splice(i, 1); continue; }
        for (k = 0; k < 5; k++) { var ru = u * 1.6 - k * .12; if (ru < 0 || ru > 1) continue;
          g.strokeStyle = 'rgba(94,242,214,' + (1 - ru) * .6 + ')'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 8 + ru * 180, 0, TAU); g.stroke(); }
        var txt = '6EQUJ5', nch = Math.min(txt.length, Math.floor(a / .22) + 1), fa = u < .8 ? 1 : 1 - (u - .8) / .2;
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = fa;
        g.font = '700 ' + Math.max(16, Math.min(W, H) * .03) + 'px ui-monospace,Menlo,Consolas,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = 'rgba(94,242,214,.9)'; g.shadowBlur = 14; g.fillStyle = '#c8fff4';
        g.fillText(txt.slice(0, nch) + (nch < txt.length && Math.floor(a * 6) % 2 ? '_' : ''), x, y - 34); g.shadowBlur = 0; g.globalAlpha = 1;
      } else if (F.k === 'starship') {
        u = a / 3.4; if (u >= 1) { FX.splice(i, 1); continue; }
        var ss = Math.max(18, Math.min(W, H) * .045), k2 = u * u, sy2 = H + ss * 2 - k2 * (H + ss * 6);
        if (!F.sm) F.sm = [];
        if (F.sm.length < 50) F.sm.push([x + (Math.random() - .5) * ss * .6, sy2 + ss * 2.4, a]);
        g.globalCompositeOperation = 'source-over';
        for (k = 0; k < F.sm.length; k++) { var sm = F.sm[k], sa = a - sm[2]; if (sa > 2.5) continue;
          g.globalAlpha = .18 * (1 - sa / 2.5); g.fillStyle = '#c8cfe8'; g.beginPath(); g.arc(sm[0] + (Math.random() - .5) * 2, sm[1], 6 + sa * 22, 0, TAU); g.fill(); }
        g.globalAlpha = 1; starship(g, x, sy2, ss, a);
      } else if (F.k === 'creature') {
        u = a / 7; if (u >= 1) { FX.splice(i, 1); continue; }
        var dir = x < W / 2 ? 1 : -1, cs = Math.max(40, Math.min(W, H) * .09);
        g.globalAlpha = Math.sin(u * Math.PI);
        creature(g, x + dir * u * W * .7, y - u * H * .15 + Math.sin(a * 1.2) * 10, cs * (1 + u * .3), a, dir);
        g.globalAlpha = 1;
      } else if (F.k === 'pod') {
        /* a capsule comes in, stops by the click, its hatch opens and someone waves, then it closes and goes */
        u = a / 7; if (u >= 1) { FX.splice(i, 1); continue; }
        var ps = Math.max(34, Math.min(W, H) * .07), side = x < W / 2 ? -1 : 1, px, py = y - ps * .6 + Math.sin(a * 1.3) * 3, open = u > .22 && u < .72;
        if (u < .2) { k = ease(u / .2); px = x + side * (1 - k) * (W * .6); }
        else if (u < .75) px = x;
        else { k = (u - .75) / .25; k = k * k; px = x - side * k * W * .8; py -= k * H * .2; }
        g.globalCompositeOperation = 'source-over';
        capsule(g, px, py, ps, side * .08, a, open);
        if (open) { var pk = Math.min(1, (u - .22) / .08) * Math.min(1, (.72 - u) / .08); g.globalAlpha = pk; astro(g, px + ps * .46, py + ps * .02 - pk * ps * .25, ps * .38, .15, { t: a, wave: 0 }); g.globalAlpha = 1; }
      } else if (F.k === 'astro') {
        /* an astronaut drifts by, turning over, waving */
        u = a / 8; if (u >= 1) { FX.splice(i, 1); continue; }
        var dir2 = x < W / 2 ? 1 : -1, as2 = Math.max(30, Math.min(W, H) * .07);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, Math.sin(u * Math.PI) * 2);
        astro(g, x + dir2 * (u - .2) * W * .5, y - u * H * .12, as2, u * 3 * dir2, { t: a, wave: 0, float: true, flip: dir2 < 0 }); g.globalAlpha = 1;
      } else if (F.k === 'drone') {
        u = a / 5; if (u >= 1) { FX.splice(i, 1); continue; }
        var hop = Math.sin(u * Math.PI), dxp = x + (u - .5) * 120, dyp = y - hop * 90;
        g.globalCompositeOperation = 'source-over'; g.fillStyle = '#1a0c08';
        g.fillRect(dxp - 4, dyp - 3, 8, 6); g.fillRect(dxp - 1, dyp - 12, 2, 9);
        var bl = 14 * Math.abs(Math.cos(a * 30)); g.fillRect(dxp - bl, dyp - 12, bl * 2, 1.2); g.fillRect(dxp - bl, dyp - 9, bl * 2, 1.2);
        g.fillRect(dxp - 6, dyp + 3, 1.2, 5); g.fillRect(dxp + 5, dyp + 3, 1.2, 5);
      } else if (F.k === 'bolt') {
        u = a / 1.2; if (u >= 1) { FX.splice(i, 1); continue; }
        var J = WORLDS.jupiter.at, bx = x, by = y;
        if (J) { var ang = Math.random() * TAU, rr = J[2] * Math.sqrt(Math.random()) * .8; if (Math.hypot(x - J[0], y - J[1]) > J[2]) { bx = J[0] + Math.cos(ang) * rr; by = J[1] + Math.sin(ang) * rr; } }
        if (!F.b) F.b = [bx, by];
        var on2 = (u < .1 || (u > .25 && u < .32) || (u > .5 && u < .55)) ? 1 : .15 * (1 - u);
        halo(g, F.b[0], F.b[1], 0, 50, [[0, 'rgba(220,240,255,' + on2 + ')'], [.3, 'rgba(124,200,255,' + .4 * on2 + ')'], [1, 'rgba(124,200,255,0)']]);
      } else FX.splice(i, 1);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  /* ---------- the warp: leaving for another page jumps to light speed, arriving slows down out of it */
  var WK = 'ek_warp', warpIn = 0;
  try { var wv = +sessionStorage.getItem(WK); if (wv && Date.now() - wv < 6000) warpIn = 1; sessionStorage.removeItem(WK); } catch (e) { }
  function streaks(g, W, H, k, out, cx, cy) {
    if (!streaks.S) { streaks.S = []; for (var i = 0; i < (LT ? 140 : 260); i++) streaks.S.push([Math.random() * TAU, .05 + Math.random() * .95, Math.random()]); }
    var M = Math.hypot(W, H) * .7, S = streaks.S;
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (var j = 0; j < S.length; j++) {
      var s = S[j], r0 = s[1] * M * (out ? 1 + k * 1.2 : 2.2 - k * 1.2), len = (out ? k * k : (1 - k) * (1 - k)) * M * .6 * (.4 + s[2]);
      var x0 = cx + Math.cos(s[0]) * r0, y0 = cy + Math.sin(s[0]) * r0, x1 = cx + Math.cos(s[0]) * Math.max(0, r0 - len), y1 = cy + Math.sin(s[0]) * Math.max(0, r0 - len);
      var col = s[2] < .33 ? '94,242,214' : s[2] < .66 ? '124,200,255' : '155,123,255';
      g.strokeStyle = 'rgba(' + col + ',' + (.25 + .75 * (out ? k : 1 - k)) + ')'; g.lineWidth = 1 + s[2] * 1.5;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x0, y0); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }
  function warpOut(url, cx, cy) {
    var c = mk(1), dpr = Math.min(1.5, w.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    c.width = W * dpr; c.height = H * dpr; c.className = 'ob-warp'; c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483500;pointer-events:none';
    d.body.appendChild(c);
    var g = c.getContext('2d'), t0 = performance.now(), gone = false;
    function go() { if (gone) return; gone = true; try { sessionStorage.setItem(WK, String(Date.now())); } catch (e) { } location.assign(url); }
    setTimeout(go, 900);
    (function f(now) {
      var k = cl((now - t0) / 460, 0, 1);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(2,3,12,' + (.25 + .6 * k) + ')'; g.fillRect(0, 0, W, H);
      streaks(g, W, H, k, true, cx, cy);
      if (k > .7) { g.fillStyle = 'rgba(220,236,255,' + ((k - .7) / .3) * .85 + ')'; g.fillRect(0, 0, W, H); }
      if (k < 1) requestAnimationFrame(f); else go();
    })(t0);
  }
  w.addEventListener('pageshow', function (e) { if (e.persisted) { var c = d.querySelectorAll('.ob-warp'); for (var i = 0; i < c.length; i++) c[i].remove(); } });
  d.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || RM || still()) return;
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;
    var u; try { u = new URL(a.href, location.href); } catch (er) { return; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return;
    if (u.pathname === location.pathname && u.search === location.search) return;
    if (!d.querySelector('.ob-sky')) return;
    e.preventDefault();
    var r = a.getBoundingClientRect();
    warpOut(u.href, r.left + r.width / 2, r.top + r.height / 2);
  });
  /* the next page starts loading as soon as a finger or the mouse is on its link */
  var pre = {};
  function prefetch(e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (er) { return; }
    if (u.origin !== location.origin || pre[u.pathname] || u.pathname === location.pathname) return;
    pre[u.pathname] = 1; var l = d.createElement('link'); l.rel = 'prefetch'; l.href = u.pathname; d.head.appendChild(l);
  }
  d.addEventListener('pointerover', prefetch, { passive: true }); d.addEventListener('touchstart', prefetch, { passive: true });

  /* ---------- what space.js calls on every frame */
  VAR = SC[1];
  var W0 = WORLDS[KIND];
  if (W0) {
    if (W0.init) W0.init();
    var HF = HERO[VAR], F0 = W0.front, S0 = W0.sky, VC = {};
    var virt = function (C) { for (var k in C) VC[k] = C[k]; VC.H = VHof(C); return VC; };
    if (S0) W0.sky = function (C) {
      var V = virt(C);
      if (V.H < C.H) { C.g.fillStyle = '#03040c'; C.g.fillRect(0, V.H - 2, C.W, C.H - V.H + 2); }
      S0.call(W0, V);
    };
    W0.front = function (C) {
      var V = virt(C);
      if (F0) F0.call(W0, V);
      C.g.globalAlpha = 1; C.g.globalCompositeOperation = 'source-over';
      if (HF) { HF(V); C.g.globalAlpha = 1; C.g.globalCompositeOperation = 'source-over'; }
      below(C, V.H);
    };
    w.OBWORLD = W0;
  }
  /* under the window the scene goes on in its own colours, darker, behind the panels */
  var tiny = null, tg = null;
  function below(C, vh) {
    var H = C.H; if (vh >= H - 1) return;
    var g = C.g, W = C.W, dpr = C.dpr || 1;
    if (!tiny) { tiny = d.createElement('canvas'); tiny.width = 24; tiny.height = 1; tg = tiny.getContext('2d'); }
    g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    try { tg.clearRect(0, 0, 24, 1); tg.drawImage(g.canvas, 0, Math.max(0, Math.floor((vh - 6) * dpr)), Math.floor(W * dpr), Math.max(1, Math.floor(4 * dpr)), 0, 0, 24, 1);
      g.imageSmoothingEnabled = true; g.drawImage(tiny, 0, 0, 24, 1, 0, vh - 1, W, H - vh + 1); } catch (e) { g.fillStyle = '#03040c'; g.fillRect(0, vh - 1, W, H - vh + 1); }
    var fd = g.createLinearGradient(0, vh, 0, H); fd.addColorStop(0, 'rgba(3,4,12,.1)'); fd.addColorStop(.35, 'rgba(3,4,12,.55)'); fd.addColorStop(1, 'rgba(3,4,12,.8)');
    g.fillStyle = fd; g.fillRect(0, vh - 1, W, H - vh + 1); g.restore();
  }
  /* what a click brings is drawn on a layer over the page, so it is seen wherever the click was; nothing on it can be pressed */
  var fxc = null, fxg = null, fxOn = false, FC = {};
  function fxLayer(C) {
    if (!fxc) { fxc = d.createElement('canvas'); fxc.className = 'ob-fxc'; fxc.setAttribute('aria-hidden', 'true'); d.body.appendChild(fxc); fxg = fxc.getContext('2d'); }
    var dpr = C.dpr || 1, pw = Math.round(C.W * dpr), ph = Math.round(C.H * dpr);
    if (fxc.width !== pw || fxc.height !== ph) { fxc.width = pw; fxc.height = ph; }
    return fxg;
  }
  var tStart = -1;
  w.OBFX = function (C) {
    CT = C;
    if (tStart < 0) tStart = C.t;
    if (!C.RM && !C.still) arrive = cl((C.t - tStart - .1) / 3.2, 0, 1); else arrive = 1;
    if (C.once) return;
    if (!C.RM && !still() && C.t > ambientNext) { FX.push({ k: 'ufofar', x: 0, y: C.H * (.08 + Math.random() * .3), dir: Math.random() < .5 ? 1 : -1, t0: -1 }); ambientNext = C.t + 70 + Math.random() * 50; }
    if (FX.length) {
      var fg = fxLayer(C);
      if (fg) {
        if (!fxOn) { fxc.style.display = 'block'; fxOn = true; }
        fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, fxc.width, fxc.height); fg.setTransform(C.dpr || 1, 0, 0, C.dpr || 1, 0, 0);
        for (var k in C) FC[k] = C[k]; FC.g = fg; drawFx(FC); fg.globalAlpha = 1; fg.globalCompositeOperation = 'source-over';
      } else drawFx(C);
    } else if (fxOn) { fxg.setTransform(1, 0, 0, 1, 0, 0); fxg.clearRect(0, 0, fxc.width, fxc.height); fxc.style.display = 'none'; fxOn = false; }
    if (warpIn && !C.RM && !d.querySelector('.ob-door')) {
      var k = cl((C.t - tStart) / .8, 0, 1);
      streaks(C.g, C.W, C.H, k, false, C.W / 2, C.H / 2);
      if (k < .25) { C.g.fillStyle = 'rgba(220,236,255,' + (1 - k / .25) * .7 + ')'; C.g.fillRect(0, 0, C.W, C.H); }
      if (k >= 1) warpIn = 0;
    }
  };

  /* ---------- the switch: motion on or off, remembered on this device */
  var MK = 'ek_motion';
  function setStill(off) { de.classList.toggle('ek-still', off); try { localStorage.setItem(MK, off ? 'off' : 'on'); } catch (e) { } try { w.dispatchEvent(new Event('ek-motion')); } catch (e) { } }
  try { if (localStorage.getItem(MK) === 'off') de.classList.add('ek-still'); } catch (e) { }
  var LBL = {
    fa: ['توقف حرکت', 'پخش حرکت'], ckb: ['وەستاندنی جوڵە', 'دەستپێکردنەوەی جوڵە'], ar: ['إيقاف الحركة', 'تشغيل الحركة'], en: ['Pause motion', 'Play motion']
  };
  function lg() { var l = (de.getAttribute('lang') || 'fa').toLowerCase(); return l.indexOf('ckb') === 0 || l === 'ku' ? 'ckb' : l.indexOf('ar') === 0 ? 'ar' : l.indexOf('fa') === 0 ? 'fa' : 'en'; }
  function sw() {
    var head = d.querySelector('#ob-main .ob-head'); if (!head || d.querySelector('.ek-mo')) return;
    var b = d.createElement('button'); b.type = 'button'; b.className = 'ek-mo';
    function lab() {
      var off = still(), t = LBL[lg()][off ? 1 : 0];
      b.setAttribute('aria-pressed', off ? 'true' : 'false'); b.setAttribute('aria-label', t); b.title = t;
      b.innerHTML = (off ? '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>') + '<span>' + t + '</span>';
    }
    lab();
    b.addEventListener('click', function () { setStill(!still()); lab(); });
    try { new MutationObserver(lab).observe(de, { attributes: true, attributeFilter: ['lang'] }); } catch (e) { }
    head.appendChild(b);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', sw); else sw();
})();
