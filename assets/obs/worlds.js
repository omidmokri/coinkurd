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
  var MAP = {
    oi: 'jupiter', funding: 'jupiter', ls: 'jupiter', basis: 'jupiter', options: 'jupiter', hl: 'jupiter',
    liqheat: 'mars', liqmap: 'mars', liqhist: 'mars', cvd: 'mars', vprof: 'mars',
    mvrv: 'europa', flows: 'europa', network: 'europa', thermo: 'europa', models: 'europa', capflow: 'europa', nvm: 'europa',
    hashp: 'europa', ethsup: 'europa', pools: 'europa',
    cycle: 'saturn', wave: 'saturn', compass: 'saturn', rotation: 'saturn', score: 'saturn',
    stables: 'earth', defi: 'earth', risk: 'earth', scanner: 'earth'
  };
  var KIND = MAP[view] || 'deep';
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
  /* Europa's ice: pale plains crossed by the reddish double ridges (lineae) and blotches of chaos terrain */
  function iceTex(GW, GH) {
    var c = mk(GW, GH), x = c.getContext('2d');
    var gr = x.createLinearGradient(0, 0, 0, GH); gr.addColorStop(0, '#9fb3c6'); gr.addColorStop(1, '#e2ebf2');
    x.fillStyle = gr; x.fillRect(0, 0, GW, GH);
    var i, k;
    for (i = 0; i < 26; i++) {
      var bx = rnd() * GW, by = rnd() * GH, br = 20 + rnd() * 70, bg = x.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, 'rgba(150,96,74,.34)'); bg.addColorStop(1, 'rgba(150,96,74,0)'); x.fillStyle = bg; x.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    x.lineCap = 'round';
    for (i = 0; i < 46; i++) {
      var px = rnd() * GW, py = rnd() * GH, ang = rnd() * TAU, len = 60 + rnd() * 420, pts = [];
      for (k = 0; k < 18; k++) { pts.push([px, py]); ang += (rnd() - .5) * .35; px += Math.cos(ang) * len / 18; py += Math.sin(ang) * len / 18 * .6; }
      var wd = .8 + rnd() * 2.4;
      [[wd * 2.4, 'rgba(140,74,52,.38)'], [wd * .7, 'rgba(244,236,226,.55)']].forEach(function (s) {
        x.strokeStyle = s[1]; x.lineWidth = s[0]; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
        for (var q = 1; q < pts.length; q++) x.lineTo(pts[q][0], pts[q][1]); x.stroke();
      });
    }
    return c;
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
      if (img) { g.imageSmoothingEnabled = true; g.save(); if (C.rtl) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); } g.drawImage(img, cx - R, cy - R, R * 2, R * 2); g.restore(); }
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
      var ab = .5 + .5 * Math.sin(t * 1.7 * mv) * Math.sin(t * .63 * mv + 1);
      g.save(); g.translate(cx, cy - R * .9); g.scale(1, .24);
      g.strokeStyle = 'rgba(94,242,214,' + (.3 + .35 * ab * C.breath + .1) + ')'; g.lineWidth = R * .05; g.beginPath(); g.arc(0, 0, R * .3, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(155,123,255,' + (.25 + .25 * ab) + ')'; g.lineWidth = R * .1; g.beginPath(); g.arc(0, 0, R * .36, 0, TAU); g.stroke();
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
      if (!C.once && !C.RM && this.stT < 0 && t > this.nextStorm) this.stT = t;
      var sf = 0;
      if (this.stT >= 0) { var u = (t - this.stT) / 9; if (u >= 1) { this.stT = -1; this.nextStorm = t + 22 + Math.random() * 18; } else sf = u < .3 ? ease(u / .3) : u < .65 ? 1 : 1 - ease((u - .65) / .35); }
      if (C.RM) sf = .25 + .2 * Math.sin(t * TAU / 40);
      this.sf = sf;
      /* the sun and its blue halo */
      g.globalCompositeOperation = 'lighter';
      var sr = S[2], vis = 1 - sf * .75;
      halo(g, S[0], S[1], 0, sr * 18, [[0, 'rgba(230,240,255,' + .95 * vis + ')'], [.06, 'rgba(170,205,255,' + .55 * vis + ')'], [.22, 'rgba(110,160,240,' + .18 * vis + ')'], [1, 'rgba(90,140,220,0)']]);
      g.fillStyle = 'rgba(255,252,240,' + vis + ')'; g.beginPath(); g.arc(S[0], S[1], sr, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      /* Phobos, crossing the sky */
      var pu = ((t * mv) % 80) / 80;
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
        ['ice', function () { s0 = 515; return iceTex(LT ? 640 : 1024, LT ? 200 : 300); }]]);
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
      /* the ice, laid in bands so it recedes to the horizon */
      var ice = TX.ice, B = C.lt ? 14 : 24, drift = t * 5 * mv + C.ppx * 30;
      g.fillStyle = '#5a6e84'; g.fillRect(0, hz, W, H - hz);
      if (ice) {
        var GW = ice.width, GH = ice.height;
        for (var k = 0; k < B; k++) {
          var a = k / B, b = (k + 1) / B, ya = hz + (H - hz) * Math.pow(a, 1.7), yb = hz + (H - hz) * Math.pow(b, 1.7) + 1;
          var sc = .45 + a * 1.4, sw = GW / sc, sx = ((drift * (.4 + a) % GW) + GW) % GW;
          var sy = GH * a, shh = GH / B;
          if (sx + sw <= GW) g.drawImage(ice, sx, sy, sw, shh, 0, ya, W, yb - ya);
          else { var p1 = GW - sx; g.drawImage(ice, sx, sy, p1, shh, 0, ya, W * p1 / sw, yb - ya); g.drawImage(ice, 0, sy, sw - p1, shh, W * p1 / sw, ya, W * (sw - p1) / sw, yb - ya); }
        }
      }
      /* lit by Jupiter: blue night, brighter towards the planet, dark at the horizon */
      var sh = g.createLinearGradient(0, hz, 0, H); sh.addColorStop(0, 'rgba(4,8,22,.82)'); sh.addColorStop(.25, 'rgba(8,16,40,.6)'); sh.addColorStop(1, 'rgba(10,20,50,.38)');
      g.fillStyle = sh; g.fillRect(0, hz, W, H - hz);
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
        var dpr = C.dpr, M = C.lt ? 36 : 64, cur = [[-.55, -.18, 0], [-.05, .28, 2.2], [.34, .62, 4.1]];
        for (var c = 0; c < cur.length; c++) {
          var a0 = cur[c][0] * A, a1 = cur[c][1] * A, ph = cur[c][2];
          for (var j = 0; j < M; j++) {
            var k = j / M, env = Math.sin(k * Math.PI), an2 = a0 + (a1 - a0) * k + Math.sin(t * .25 * mv + k * 6 + ph) * .012 * A;
            var hgt = (40 + 90 * env) * (.55 + .45 * Math.sin(k * 23 + t * 1.1 * mv + ph)) * (C.small ? .7 : 1);
            var bx = cx + Math.sin(an2) * (R + 4), by = cy - Math.cos(an2) * (R + 4);
            g.globalAlpha = env * (.35 + .3 * C.breath);
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

  /* ---------- clicks: every click on the open sky brings something different */
  var FX = [], bag = [], lastK = '', clicks = 0, ambientNext = 40;
  var BASE = ['ufo', 'creature', 'starship', 'wow', 'comet', 'shower', 'nova'];
  var LOCAL = { mars: ['storm', 'drone'], europa: ['plume'], jupiter: ['bolt'], earth: ['sunrise'], saturn: ['shower'], deep: ['nova'] };
  function pick() {
    if (!bag.length) {
      bag = BASE.concat(LOCAL[KIND] || []);
      for (var i = bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
      if (bag[bag.length - 1] === lastK) bag.unshift(bag.pop());
    }
    if (clicks === 1) { var big = ['ufo', 'creature', 'starship'][Math.floor(Math.random() * 3)], at = bag.indexOf(big); if (at >= 0) bag.splice(at, 1); return big; }
    return bag.pop();
  }
  var CT = null;
  function addFx(x, y) {
    clicks++;
    if (still()) return;
    if (RM) { FX.push({ k: 'glow', x: x, y: y, t0: -1 }); return; }
    var k = pick(); lastK = k;
    var Wd = WORLDS[KIND];
    if (k === 'storm' && Wd) { Wd.nextStorm = 0; return; }
    if (k === 'plume' && Wd && CT) { Wd.plume(CT, x); return; }
    if (k === 'sunrise' && Wd && CT) { Wd.rise(CT); return; }
    FX.push({ k: k, x: x, y: y, t0: -1, s: Math.random() });
  }
  function okTarget(el) {
    if (!el || !el.closest) return false;
    if (el.closest('a,button,input,select,textarea,label,summary,details,[role=button],[role=tab],[contenteditable],#ob,.ob-hc,.ob-about,#ekh,#ekf,#ekb,#eks,#ekq,#eka,.ek-mo,svg,canvas:not(.ob-sky),img,video,iframe')) return false;
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
  var W0 = WORLDS[KIND];
  if (W0) { W0.init(); w.OBWORLD = W0; }
  var tStart = -1;
  w.OBFX = function (C) {
    CT = C;
    if (tStart < 0) tStart = C.t;
    if (!C.RM && !C.still) arrive = cl((C.t - tStart - .1) / 3.2, 0, 1); else arrive = 1;
    if (C.once) return;
    if (!C.RM && !still() && C.t > ambientNext) { FX.push({ k: 'ufofar', x: 0, y: C.H * (.08 + Math.random() * .3), dir: Math.random() < .5 ? 1 : -1, t0: -1 }); ambientNext = C.t + 70 + Math.random() * 50; }
    if (FX.length) drawFx(C);
    if (warpIn && !C.RM) {
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
  function lg() { var l = (de.getAttribute('lang') || 'fa').toLowerCase(); return l.indexOf('ckb') === 0 || l === 'ku' ? 'ckb' : l.indexOf('ar') === 0 ? 'ar' : l.indexOf('en') === 0 ? 'en' : 'fa'; }
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
