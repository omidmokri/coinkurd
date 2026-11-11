/* entekhab.net — the 3D coin of interface v3 ("Nexus"). Raw WebGL, no library (three.js is 600 KB; this file is a few KB):
   the site's own coin art (assets/coin-front|back.webp with their height maps) on a beveled, reeded disc, lit like metal
   in a dark studio, with three orbit ribbons and a few embers around it.
   nxCoin(canvas, opts) -> { set, pulse, face, pause, ok }   or null when WebGL is missing (the caller keeps its still coin). */
(function () {
  'use strict';
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute vec2 aU;uniform mat4 uPV;uniform mat3 uM;uniform float uS;' +
    'varying vec3 vP,vN,vO;varying vec2 vU;void main(){vO=aP;vec3 p=uM*aP*uS;vP=p;vN=uM*aN;vU=aU;gl_Position=uPV*vec4(p,1.);}';
  var FS = 'precision highp float;uniform sampler2D uC,uH;uniform vec3 uCam;uniform mat3 uM;uniform float uKind,uGlow,uFlip,uTx,uHeat;' +
    'varying vec3 vP,vN,vO;varying vec2 vU;' +
    /* the room the coin sits in: a warm soft box above, a hard key light, the glow of the pedestal below */
    'vec3 env(vec3 r){vec3 c=vec3(.016,.018,.024);' +
    'c+=vec3(1.,.9,.72)*smoothstep(.3,.96,r.y)*1.1;' +
    'c+=vec3(1.,.76,.42)*pow(max(dot(r,normalize(vec3(-.62,.42,.66))),0.),14.)*3.;' +
    'c+=vec3(1.,.48,.1)*smoothstep(-.15,-.95,r.y)*(.55+uHeat*.6);' +
    'c+=vec3(1.,.93,.82)*exp(-abs(r.y-.08)*11.)*.4;return c;}' +
    'void main(){vec3 N=normalize(vN),V=normalize(uCam-vP);vec3 alb=vec3(.86,.6,.22);float cav=0.;' +
    'if(uKind<.5){alb=texture2D(uC,vU).rgb;float e=uTx;' +
    'float hl=texture2D(uH,vU-vec2(e,0.)).r,hr=texture2D(uH,vU+vec2(e,0.)).r,hd=texture2D(uH,vU+vec2(0.,e)).r,hu=texture2D(uH,vU-vec2(0.,e)).r,h=texture2D(uH,vU).r;' +
    'N=normalize(N-uM*(vec3((hr-hl)*uFlip,hu-hd,0.)*3.4));cav=smoothstep(.46,.24,h);alb*=1.-cav*.35;}' +
    'else{float a=atan(vO.y,vO.x);N=normalize(N+uM*(vec3(-sin(a),cos(a),0.)*cos(a*150.)*.55));alb*=.8+.2*cos(a*150.);}' +
    'float nv=max(dot(N,V),0.);vec3 R=reflect(-V,N);vec3 F=alb+(1.-alb)*pow(1.-nv,5.);' +
    'float dif=max(dot(N,normalize(vec3(-.5,.6,.75))),0.);' +
    'vec3 col=alb*(.1+.4*dif)+env(R)*F*.95;' +
    'col+=vec3(1.,.4,.04)*cav*uGlow*1.5;' +                              /* heat in the engraving */
    'col+=vec3(1.,.55,.15)*pow(1.-nv,3.)*(.1+uGlow*.35);' +              /* rim */
    'col+=vec3(.16,.5,.56)*pow(max(dot(R,normalize(vec3(.8,-.1,-.59))),0.),8.)*pow(1.-nv,1.5)*.7;' +   /* a cold edge from behind, never on the face */
    'gl_FragColor=vec4(col,1.);}';
  var VS2 = 'attribute vec3 aP;attribute float aT;uniform mat4 uPV;uniform mat3 uR;varying float vT;void main(){vT=aT;gl_Position=uPV*vec4(uR*aP,1.);}';
  var FS2 = 'precision mediump float;uniform float uPh,uA;uniform vec3 uCol;varying float vT;void main(){float k=fract(vT-uPh);float a=(.07+.93*pow(k,7.))*uA;gl_FragColor=vec4(uCol*a,a);}';
  var VS3 = 'attribute vec4 aS;uniform mat4 uPV;uniform float uT,uPx;varying float vA;void main(){float l=fract(aS.z+uT*(.018+aS.w*.03));float a=aS.x*6.2832+uT*(.07+aS.w*.12);float r=1.22+aS.y*1.05;' +
    'gl_Position=uPV*vec4(cos(a)*r,l*3.4-1.7,sin(a)*r,1.);gl_PointSize=uPx*(1.6+aS.y*3.)*(7./gl_Position.w);vA=sin(l*3.1416)*(.3+.7*aS.x);}';
  var FS3 = 'precision mediump float;varying float vA;void main(){float k=smoothstep(.5,0.,length(gl_PointCoord-.5));k*=k;float a=min(1.,k*vA*1.5);gl_FragColor=vec4(vec3(1.,.66,.24)*a,a*.5);}';

  function prog(gl, vs, fs) {
    function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    var o = { p: p, u: {}, a: {} }, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), i, x;
    for (i = 0; i < n; i++) { x = gl.getActiveUniform(p, i); o.u[x.name] = gl.getUniformLocation(p, x.name); }
    n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (i = 0; i < n; i++) { x = gl.getActiveAttrib(p, i); o.a[x.name] = gl.getAttribLocation(p, x.name); }
    return o;
  }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; }
  function look(e) {   /* eye e, looking at the origin, y up */
    var l = Math.hypot(e[0], e[1], e[2]), z = [e[0] / l, e[1] / l, e[2] / l], xl = Math.hypot(z[2], z[0]), x = [z[2] / xl, 0, -z[0] / xl],
      y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
  }
  function mul4(a, b) { var o = [], i, j, k, s; for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) { s = 0; for (k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  function rotYX(y, x, z) {   /* column-major mat3 = Ry(y) * Rx(x) * Rz(z) */
    var cy = Math.cos(y), sy = Math.sin(y), cx = Math.cos(x), sx = Math.sin(x), cz = Math.cos(z || 0), sz = Math.sin(z || 0);
    var a = [cy, 0, -sy, sy * sx, cx, cy * sx, sy * cx, -sx, cy * cx];          /* Ry*Rx */
    return [a[0] * cz + a[3] * sz, a[1] * cz + a[4] * sz, a[2] * cz + a[5] * sz, -a[0] * sz + a[3] * cz, -a[1] * sz + a[4] * cz, -a[2] * sz + a[5] * cz, a[6], a[7], a[8]];
  }

  function nxCoin(cv, o) {
    o = o || {};
    var gl = null, at = { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' };
    try { gl = cv.getContext('webgl', at) || cv.getContext('experimental-webgl', at); } catch (e) { }
    if (!gl) return null;
    /* no graphics chip (software rendering): a spinning WebGL coin would freeze the page — the caller keeps its still coin */
    try {
      var dbg = gl.getExtension('WEBGL_debug_renderer_info'), rend = String((dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
      if (/swiftshader|llvmpipe|software|basic render/i.test(rend) && !window.NX_FORCE_GL) return null;
    } catch (e) { }
    var P1, P2, P3;
    try { P1 = prog(gl, VS, FS); P2 = prog(gl, VS2, FS2); P3 = prog(gl, VS3, FS3); } catch (e) { if (window.console) console.warn('nxCoin', e); return null; }

    /* ---- the disc: two faces with a bevel, and a reeded edge */
    var SEG = 128, T = .074, RB = .958, ZB = .028, pos = [], nor = [], uv = [], idx = [], rng = {};
    function vtx(x, y, z, nx, ny, nz, u, v) { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(u, v); return pos.length / 3 - 1; }
    function face(s) {   /* s = +1 front, -1 back (its picture is mirrored so it reads the right way round) */
      var st = idx.length, c = vtx(0, 0, s * T, 0, 0, s, .5, .5), i, a, x, y, r1 = [], r2 = [];
      for (i = 0; i <= SEG; i++) {
        a = i / SEG * Math.PI * 2; x = Math.cos(a); y = Math.sin(a);
        r1.push(vtx(x * RB, y * RB, s * T, 0, 0, s, .5 + s * x * RB * .5, .5 - y * RB * .5));
        r2.push(vtx(x, y, s * (T - ZB), x * .62, y * .62, s * .78, .5 + s * x * .5, .5 - y * .5));
      }
      for (i = 0; i < SEG; i++) { idx.push(c, r1[i], r1[i + 1], r1[i], r2[i], r2[i + 1], r1[i], r2[i + 1], r1[i + 1]); }
      return [st, idx.length - st];
    }
    rng.f = face(1); rng.b = face(-1);
    (function () {
      var st = idx.length, i, a, x, y, t = [], b = [];
      for (i = 0; i <= SEG; i++) { a = i / SEG * Math.PI * 2; x = Math.cos(a); y = Math.sin(a); t.push(vtx(x, y, T - ZB, x, y, 0, 0, 0)); b.push(vtx(x, y, -(T - ZB), x, y, 0, 0, 1)); }
      for (i = 0; i < SEG; i++) idx.push(t[i], b[i], b[i + 1], t[i], b[i + 1], t[i + 1]);
      rng.e = [st, idx.length - st];
    })();
    function buf(t, d) { var b = gl.createBuffer(); gl.bindBuffer(t, b); gl.bufferData(t, d, gl.STATIC_DRAW); return b; }
    var bP = buf(gl.ARRAY_BUFFER, new Float32Array(pos)), bN = buf(gl.ARRAY_BUFFER, new Float32Array(nor)), bU = buf(gl.ARRAY_BUFFER, new Float32Array(uv)),
      bI = buf(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx));

    /* ---- orbit ribbons (unit circle in the XZ plane, scaled per ribbon) and embers */
    var RS = 160, rp = [], rt = [], i, a;
    for (i = 0; i <= RS; i++) { a = i / RS * Math.PI * 2; rp.push(Math.cos(a), -1, Math.sin(a), Math.cos(a), 1, Math.sin(a)); rt.push(i / RS, i / RS); }
    var bRP = buf(gl.ARRAY_BUFFER, new Float32Array(rp)), bRT = buf(gl.ARRAY_BUFFER, new Float32Array(rt));
    var RINGS = [{ r: 1.3, tx: .17, tz: .2, sp: .11, col: [1, .62, .16] }, { r: 1.48, tx: -.33, tz: -.3, sp: -.075, col: [1, .78, .4] }, { r: 1.66, tx: .5, tz: .12, sp: .05, col: [1, .5, .1] }];
    var NP = o.embers === 0 ? 0 : (o.embers || 70), ps = [];
    for (i = 0; i < NP * 4; i++) ps.push(Math.random());
    var bS = buf(gl.ARRAY_BUFFER, new Float32Array(ps));

    /* ---- textures */
    var aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    function tex() {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 140, 50, 255]));
      return t;
    }
    var tx = { fc: tex(), fh: tex(), bc: tex(), bh: tex() }, got = {}, alive = true, ready = false;
    function load(key, src, cb) {
      var im = new Image(); im.decoding = 'async';
      im.onload = function () {
        if (!alive) return;
        gl.bindTexture(gl.TEXTURE_2D, tx[key]); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        var pot = !(im.width & (im.width - 1)) && !(im.height & (im.height - 1));
        if (pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
        else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
        got[key] = im.width; if (cb) cb(); dirty = true;
      };
      im.onerror = function () { if (cb) cb(true); };
      im.src = src;
    }
    var base = o.base || '/assets/';
    load('fc', base + 'coin-front.webp', function (bad) { if (!bad) { ready = true; kick(); } });
    load('fh', base + 'coin-front-bump.webp');
    /* the back is needed only once the coin has turned: fetched after the front is on screen */
    setTimeout(function () { load('bc', base + 'coin-back.webp'); load('bh', base + 'coin-back-bump.webp'); }, o.backDelay == null ? 600 : o.backDelay);

    /* ---- state */
    var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var st = { yaw: o.yaw == null ? -.55 : o.yaw, vel: 0, spin: RM ? 0 : (o.spin == null ? .42 : o.spin), tilt: 0, tiltT: 0, bias: 0, biasT: 0, glow: .2, glowT: .2, heat: 0, heatT: 0, facing: false, scale: 1, scaleT: 1 };
    var px = 0, py = 0, dirty = true, running = false, visible = true, paused = false, raf = 0, last = 0, t0 = performance.now(), first = true, W = 0, H = 0;
    var dprCap = o.dpr || 2, wf = 0, ws = 0, wstage = 0;   /* watchdog: frames counted, their time, how far it has stepped down */
    function size() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, dprCap), w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      if (w !== W || h !== H) { W = cv.width = w; H = cv.height = h; dirty = true; }
    }
    var EYE = o.eye || [0, .75, 5.75];
    function draw(now) {
      size();
      var t = (now - t0) / 1000, pv = mul4(persp(28 * Math.PI / 180, W / H, .1, 40), look(EYE));
      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      var M = rotYX(st.yaw + st.bias, st.tilt + .06, Math.sin(t * .5) * .012);
      gl.useProgram(P1.p);
      gl.uniformMatrix4fv(P1.u.uPV, false, pv); gl.uniformMatrix3fv(P1.u.uM, false, M); gl.uniform3fv(P1.u.uCam, EYE);
      gl.uniform1f(P1.u.uS, st.scale); gl.uniform1f(P1.u.uGlow, st.glow); gl.uniform1f(P1.u.uHeat, st.heat);
      gl.uniform1i(P1.u.uC, 0); gl.uniform1i(P1.u.uH, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, bP); gl.enableVertexAttribArray(P1.a.aP); gl.vertexAttribPointer(P1.a.aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bN); gl.enableVertexAttribArray(P1.a.aN); gl.vertexAttribPointer(P1.a.aN, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bU); gl.enableVertexAttribArray(P1.a.aU); gl.vertexAttribPointer(P1.a.aU, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bI);
      function part(r, c, h, kind, flip) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, h);
        gl.uniform1f(P1.u.uKind, kind); gl.uniform1f(P1.u.uFlip, flip); gl.uniform1f(P1.u.uTx, 1.6 / 512);
        gl.drawElements(gl.TRIANGLES, r[1], gl.UNSIGNED_SHORT, r[0] * 2);
      }
      part(rng.f, tx.fc, got.fh ? tx.fh : tx.fc, 0, 1);
      part(rng.b, got.bc ? tx.bc : tx.fc, got.bh ? tx.bh : (got.fh ? tx.fh : tx.fc), 0, -1);
      part(rng.e, tx.fc, tx.fc, 1, 1);
      if (P1.a.aN >= 0) gl.disableVertexAttribArray(P1.a.aN); if (P1.a.aU >= 0) gl.disableVertexAttribArray(P1.a.aU);

      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      if (o.rings !== false) {
        gl.useProgram(P2.p); gl.uniformMatrix4fv(P2.u.uPV, false, pv);
        gl.bindBuffer(gl.ARRAY_BUFFER, bRP); gl.enableVertexAttribArray(P2.a.aP); gl.vertexAttribPointer(P2.a.aP, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bRT); gl.enableVertexAttribArray(P2.a.aT); gl.vertexAttribPointer(P2.a.aT, 1, gl.FLOAT, false, 0, 0);
        RINGS.forEach(function (R, k) {
          var m = rotYX(t * R.sp * 1.4 + k, R.tx, R.tz), s = R.r * (1 + (st.scale - 1) * .5), wd = .0075 * (1 + st.glow * .8);
          gl.uniformMatrix3fv(P2.u.uR, false, [m[0] * s, m[1] * s, m[2] * s, m[3] * wd, m[4] * wd, m[5] * wd, m[6] * s, m[7] * s, m[8] * s]);
          gl.uniform1f(P2.u.uPh, t * R.sp * (RM ? 0 : 1)); gl.uniform1f(P2.u.uA, .5 + st.glow * .5); gl.uniform3fv(P2.u.uCol, R.col);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, (RS + 1) * 2);
        });
        gl.disableVertexAttribArray(P2.a.aT);
      }
      if (NP) {
        gl.useProgram(P3.p); gl.uniformMatrix4fv(P3.u.uPV, false, pv); gl.uniform1f(P3.u.uT, RM ? 3 : t); gl.uniform1f(P3.u.uPx, H / 520);
        gl.bindBuffer(gl.ARRAY_BUFFER, bS); gl.enableVertexAttribArray(P3.a.aS); gl.vertexAttribPointer(P3.a.aS, 4, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, NP);
      }
      gl.depthMask(true);
      if (first && ready) { first = false; if (o.onready) o.onready(); }
    }
    function step(now) {
      raf = 0; if (!alive) return;
      var gap = now - last, dt = Math.min(.05, gap / 1000 || .016); last = now;
      /* a device that cannot keep ~22 frames a second first gets a lighter picture, then the still coin */
      if (wstage < 3 && gap < 400 && !window.NX_FORCE_GL) {
        ws += gap; if (++wf >= 40) {
          if (ws / wf > 45) { wstage++; if (wstage === 1) { dprCap = 1; NP = 0; W = 0; } else { alive = false; halt(); if (o.onlost) o.onlost(); return; } } else if (wstage === 0) wstage = 3;
          wf = 0; ws = 0;
        }
      }
      if (!drag) {
        if (st.facing) {   /* turn the face towards the viewer and hold it there */
          var tgt = Math.round(st.yaw / (Math.PI * 2)) * Math.PI * 2; st.vel += ((tgt - st.yaw) * 14 - st.vel * 7) * dt;
        } else st.vel += (st.spin - st.vel) * Math.min(1, dt * 1.6);
        st.yaw += st.vel * dt;
      }
      var k = Math.min(1, dt * 5);
      st.tilt += (st.tiltT + py * .22 - st.tilt) * k; st.bias += (st.biasT + px * .3 - st.bias) * k;
      st.glow += (st.glowT - st.glow) * Math.min(1, dt * 3.2); st.heat += (st.heatT - st.heat) * Math.min(1, dt * 2);
      st.scale += (st.scaleT - st.scale) * Math.min(1, dt * 6);
      draw(now); dirty = false;
      if (RM && !drag && Math.abs(st.glowT - st.glow) < .01 && Math.abs(st.vel) < .01) { running = false; return; }   /* reduced motion: a still coin, redrawn only when asked */
      raf = requestAnimationFrame(step);
    }
    function kick() { if (!alive || !ready || paused || !visible || raf) return; running = true; last = performance.now(); raf = requestAnimationFrame(step); }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; running = false; }

    /* ---- pointer: the coin leans towards the pointer; it can be spun by dragging */
    var drag = null, hit = o.hit || cv;
    function onMove(e) {
      var r = (o.area || cv).getBoundingClientRect();
      px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2)); py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2));
      if (RM) kick();
    }
    if (window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) (o.area || cv).addEventListener('pointermove', onMove, { passive: true });
    hit.addEventListener('pointerdown', function (e) {
      if (e.button) return; drag = { x: e.clientX, t: performance.now(), v: 0 }; try { hit.setPointerCapture(e.pointerId); } catch (x) { } hit.classList.add('grab'); kick();
    });
    hit.addEventListener('pointermove', function (e) {
      if (!drag) return; var now = performance.now(), dx = e.clientX - drag.x, r = cv.getBoundingClientRect(), da = dx / (r.width * .3);
      st.yaw += da; drag.v = da / Math.max(.008, (now - drag.t) / 1000); drag.x = e.clientX; drag.t = now; st.facing = false;
    });
    function up() { if (!drag) return; st.vel = Math.max(-14, Math.min(14, drag.v)); drag = null; hit.classList.remove('grab'); kick(); }
    hit.addEventListener('pointerup', up); hit.addEventListener('pointercancel', up);
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); alive = false; halt(); if (o.onlost) o.onlost(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) halt(); else kick(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); else halt(); }).observe(cv);
    window.addEventListener('resize', function () { dirty = true; if (!running && ready && alive && !paused) { draw(performance.now()); } });

    return {
      ok: true,
      set: function (s) { if (s.glow != null) st.glowT = s.glow; if (s.heat != null) st.heatT = s.heat; if (s.bias != null) st.biasT = s.bias; if (s.tilt != null) st.tiltT = s.tilt; if (s.spin != null) st.spin = RM ? 0 : s.spin; if (s.scale != null) st.scaleT = s.scale; kick(); },
      face: function (on) { st.facing = !!on; kick(); },
      pulse: function () { st.glow = 1; st.heat = 1; if (!RM) st.vel += 9; st.facing = false; kick(); },
      pause: function (on) { paused = !!on; if (paused) halt(); else kick(); },
      redraw: function () { if (ready && alive) draw(performance.now()); },
      destroy: function () { alive = false; halt(); }
    };
  }
  window.nxCoin = nxCoin;
})();
