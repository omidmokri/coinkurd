/* entekhab.net — the market map in 3D (three.js r128, self-hosted; fetched only when "3D" is chosen).
   City  : the heatmap's own layout becomes a city — every coin a tower on its sector's platform; the footprint is the
           tile, the height is the strength of the move (√, on the timeframe's scale), the colour its direction; logos sit
           on the roofs, the biggest towers carry their symbol and change.
   Space : the bubbles float in a cluster of glossy spheres, same sizes and colours, logos facing you.
   Drag to turn, wheel or pinch to zoom, right-drag (or two fingers) to move; it turns slowly by itself when left alone.
   Hover a tower or sphere for the coin card, click for the coin panel. Nothing here invents a number: heights and colours
   are the same changes the 2D views show. */
(function () {
  'use strict';
  var MM = window.MM, THREE = window.THREE, d = document, S = MM.S, D = MM.D, T = MM.T;
  if (!THREE) return;
  var E = null;       /* the engine of the scene on screen */

  /* ---------------------------------------------------------------- shared */
  function col3(rgb) { var c = new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255); return c.convertSRGBToLinear ? c.convertSRGBToLinear() : c; }
  function mkRenderer(box, size) {
    var r = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setSize(size.w, size.h);
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    r.setClearColor(0x0a0a0c, 1);
    r.domElement.className = 'mm-gl';
    r.domElement.setAttribute('role', 'img');
    box.appendChild(r.domElement);
    return r;
  }
  function lights(scene) {
    scene.add(new THREE.HemisphereLight(0xc9d6ff, 0x0b0b0e, 0.75));
    var k = new THREE.DirectionalLight(0xffffff, 1.05); k.position.set(60, 120, 80); scene.add(k);
    var rim = new THREE.DirectionalLight(0xf7931a, 0.55); rim.position.set(-90, 40, -110); scene.add(rim);
    var fill = new THREE.DirectionalLight(0x6ea8ff, 0.25); fill.position.set(-60, 30, 90); scene.add(fill);
  }
  function atlasTexture() {
    if (!MM.A.img) return null;
    if (MM.A.tex && MM.A.tex.image === MM.A.img) return MM.A.tex;
    var t = new THREE.Texture(MM.A.img); t.needsUpdate = true; t.encoding = THREE.sRGBEncoding;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4;
    MM.A.tex = t; return t;
  }
  function atlasUV(s) {
    var m = MM.A.meta, i = m && m.i ? m.i[s] : null; if (i == null || !MM.A.img) return null;
    var AW = MM.A.img.width, AH = MM.A.img.height, cx = i % m.cols, ry = Math.floor(i / m.cols);
    return { u: cx * m.cell / AW, v: 1 - (ry + 1) * m.cell / AH, su: m.cell / AW, sv: m.cell / AH };
  }
  /* a text sprite (symbol + change), drawn on a small canvas */
  function label(lines, cols, px) {
    var c = d.createElement('canvas'), x = c.getContext('2d'), F = '"Space Grotesk",Vazirmatn,sans-serif';
    c.width = 256; c.height = 128;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(0,0,0,.75)'; x.shadowBlur = 8;
    x.font = '700 ' + (px || 54) + 'px ' + F; x.fillStyle = cols[0]; x.fillText(lines[0], 128, 42);
    if (lines[1]) { x.font = '600 40px ' + F; x.fillStyle = cols[1] || '#fff'; x.fillText(lines[1], 128, 96); }
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    sp.userData.canvas = c;
    return sp;
  }
  function disposeTree(o) {
    o.traverse(function (n) {
      if (n.geometry) n.geometry.dispose();
      if (n.material) { [].concat(n.material).forEach(function (m) { if (m.map && m.map !== MM.A.tex && m.map !== HALO) m.map.dispose(); m.dispose(); }); }
    });
  }

  /* orbit controls: drag to turn, wheel/pinch to zoom, right-drag or two fingers to pan; idle -> slow spin */
  function Orbit(cam, el, o) {
    var s = { th: o.th, ph: o.ph, r: o.r, tgt: new THREE.Vector3(0, o.ty || 0, 0), vth: 0, vph: 0, last: performance.now(), auto: true, pts: {}, min: o.min, max: o.max };
    function apply() {
      s.ph = MM.clamp(s.ph, 0.18, 1.48); s.r = MM.clamp(s.r, s.min, s.max);
      cam.position.set(s.tgt.x + s.r * Math.sin(s.ph) * Math.sin(s.th), s.tgt.y + s.r * Math.cos(s.ph), s.tgt.z + s.r * Math.sin(s.ph) * Math.cos(s.th));
      cam.lookAt(s.tgt);
    }
    var drag = null;
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('pointerdown', function (e) {
      s.armed = true;
      s.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      drag = { x: e.clientX, y: e.clientY, btn: e.button, moved: 0, t: performance.now() };
      s.auto = false; s.last = performance.now();
      try { el.setPointerCapture(e.pointerId); } catch (er) { }
    });
    el.addEventListener('pointermove', function (e) {
      var p = s.pts[e.pointerId]; if (!p || !drag) return;
      if (o.held && o.held()) { drag.moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y); p.x = e.clientX; p.y = e.clientY; return; }   /* a bubble is being dragged */
      var ids = Object.keys(s.pts), dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (ids.length === 2) {
        var a = s.pts[ids[0]], b = s.pts[ids[1]], d0 = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY;
        var d1 = Math.hypot(s.pts[ids[0]].x - s.pts[ids[1]].x, s.pts[ids[0]].y - s.pts[ids[1]].y);
        if (d0 > 0 && d1 > 0) s.r *= d0 / d1;
        pan(dx / 2, dy / 2);
      } else if (drag.btn === 2 || e.shiftKey) { pan(dx, dy); p.x = e.clientX; p.y = e.clientY; }
      else {
        s.vth = -dx * 0.0062; s.vph = -dy * 0.0052; s.th += s.vth; s.ph += s.vph;
        p.x = e.clientX; p.y = e.clientY;
      }
      drag.moved += Math.abs(dx) + Math.abs(dy); s.last = performance.now(); apply();
    });
    function end(e) { delete s.pts[e.pointerId]; if (!Object.keys(s.pts).length) { s.last = performance.now(); } }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', function () { s.armed = false; });
    /* the wheel zooms only after a click on the scene (or with Ctrl): scrolling the page over it must not fly the camera in */
    el.addEventListener('wheel', function (e) { if (!s.armed && !e.ctrlKey && !e.metaKey) return; e.preventDefault(); s.r *= Math.pow(1.0016, e.deltaY); s.auto = false; s.last = performance.now(); apply(); }, { passive: false });
    el.addEventListener('dblclick', function () { s.th = o.th; s.ph = o.ph; s.r = o.r; s.tgt.set(0, o.ty || 0, 0); apply(); });
    function pan(dx, dy) {
      var k = s.r * 0.0016, right = new THREE.Vector3(Math.cos(s.th), 0, -Math.sin(s.th)), fwd = new THREE.Vector3(Math.sin(s.th), 0, Math.cos(s.th));
      s.tgt.addScaledVector(right, -dx * k).addScaledVector(fwd, -dy * k);
    }
    apply();
    return {
      tick: function (now) {
        if (!Object.keys(s.pts).length) {
          if (Math.abs(s.vth) > 1e-4 || Math.abs(s.vph) > 1e-4) { s.th += s.vth; s.ph += s.vph; s.vth *= 0.92; s.vph *= 0.92; apply(); return true; }
          if (now - s.last > 4500) s.auto = true;
          if (s.auto && !o.still) { s.th += 0.0016; apply(); return true; }
        }
        return false;
      },
      dragged: function () { return drag && drag.moved > 6; },
      fit: function (r) { s.r = r; o.r = r; apply(); }, apply: apply, s: s,
      /* frame a sphere of radius R round the target: the whole scene in view, and the camera never inside it */
      fitSphere: function (R, aspect, fov) {
        var half = Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(1, aspect)), dist = R / Math.sin(half) * 1.04;
        s.min = R * 0.95; s.max = dist * 2.6; s.r = o.r = dist; apply();
      }
    };
  }

  function Engine(box, size, kind) {
    var e = { kind: kind, box: box, w: size.w, h: size.h, run: true, raf: 0, hover: -1, q: '' };
    e.r = mkRenderer(box, size);
    e.scene = new THREE.Scene();
    e.scene.fog = new THREE.Fog(0x0a0a0c, 160, 420);
    e.cam = new THREE.PerspectiveCamera(42, size.w / size.h, 0.5, 2000);
    lights(e.scene);
    e.ray = new THREE.Raycaster(); e.ptr = new THREE.Vector2();
    var hint = MM.h('<div class="mm-3dhint">' + MM.esc(T('hint3d')) + '</div>');
    box.appendChild(hint); e.hint = hint; setTimeout(function () { hint.classList.add('off'); }, 6000);
    return e;
  }
  function loop(now) {
    if (!E || !E.run) return;
    E.raf = requestAnimationFrame(loop);
    if (d.hidden) return;
    var moved = E.orbit.tick(now);
    var busy = E.step ? E.step(now) : false;
    if (moved || busy || E.dirty || E.always) { E.r.render(E.scene, E.cam); E.dirty = false; }
  }
  function pick(ev) {
    if (!E || !E.mesh) return null;
    var rc = E.r.domElement.getBoundingClientRect();
    E.ptr.set((ev.clientX - rc.left) / rc.width * 2 - 1, -(ev.clientY - rc.top) / rc.height * 2 + 1);
    E.ray.setFromCamera(E.ptr, E.cam);
    var hits = E.ray.intersectObject(E.mesh);
    return hits.length ? hits[0].instanceId : null;
  }
  function wirePick(el) {
    el.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch' || ev.buttons) { MM.tip(null); return; }
      var i = pick(ev), c = i != null && E.items[i] ? E.items[i].c : null;
      el.style.cursor = c ? 'pointer' : 'grab';
      if (i !== E.hover) { E.hover = i == null ? -1 : i; E.dirty = true; if (E.onHover) E.onHover(); }
      if (c) MM.tip(MM.coinTip(c), ev.clientX, ev.clientY); else MM.tip(null);
    });
    el.addEventListener('pointerleave', function () { MM.tip(null); E && (E.hover = -1); });
    el.addEventListener('click', function (ev) {
      if (E.orbit.dragged()) return;
      var i = pick(ev); if (i != null && E.items[i]) { MM.tip(null); MM.openCoin(E.items[i].c.s); }
    });
  }

  /* ================================================================ the city */
  function heightOf(c) {
    var v = c.ch[S.tf]; if (v == null) return 0.5;
    return 0.6 + 30 * Math.sqrt(MM.clamp(Math.abs(v) / MM.SAT[S.tf], 0, 1.25));
  }
  function cityBuild(getL) {
    var L = getL(), W = E.w, H = E.h, k = 100 / Math.max(W, H);
    if (E.city) { E.scene.remove(E.city); disposeTree(E.city); }
    var g = new THREE.Group(); E.city = g; E.k = k;
    var cx = W / 2, cy = H / 2;
    /* ground */
    var gnd = new THREE.Mesh(new THREE.PlaneGeometry(W * k * 3, H * k * 3), new THREE.MeshStandardMaterial({ color: 0x040405, roughness: 1, metalness: 0 }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.4; g.add(gnd);
    var grid = new THREE.GridHelper(Math.max(W, H) * k * 3, 60, 0x24252b, 0x111216); grid.position.y = -0.38; g.add(grid);
    /* sector platforms with a coloured edge */
    L.blocks.forEach(function (b) {
      var pw = b.w * k, pd = b.h * k, col = new THREE.Color(MM.SECC[b.k] || '#888');
      var slab = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.35, pd), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.8, metalness: 0.1 }));
      slab.position.set((b.x + b.w / 2 - cx) * k, -0.2, (b.y + b.h / 2 - cy) * k); g.add(slab);
      var ed = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55 }));
      ed.position.copy(slab.position); g.add(ed);
      var inSec = L.tiles.filter(function (t) { return t.c.sec === b.k; });
      if (b.w * k > 9 && b.h * k > 6 && inSec.length >= 3) {
        var lb = label([MM.secName(b.k), MM.fmtPct(b.ch)], ['#ecebe6', b.ch > 0 ? MM.upc() : b.ch < 0 ? MM.dnc() : '#bbb'], 40);
        var sc = MM.clamp(pw * 0.38, 5, 13), top = 0; inSec.forEach(function (t) { top = Math.max(top, heightOf(t.c)); });
        lb.scale.set(sc, sc / 2, 1); lb.center.set(0.5, 0);
        lb.position.set(slab.position.x, top + 3, slab.position.z); lb.material.opacity = 0.92; g.add(lb);
      }
    });
    /* towers: one instanced mesh */
    var tiles = L.tiles.filter(function (t) { return t.w > 1.5 && t.h > 1.5; }), n = tiles.length;
    var mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.18 });
    var mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, Math.max(1, n));
    mesh.count = n; E.mesh = mesh; g.add(mesh);
    E.items = tiles.map(function (t) {
      var h = heightOf(t.c);
      return { c: t.c, x: (t.x + t.w / 2 - cx) * k, z: (t.y + t.h / 2 - cy) * k, fw: Math.max(0.15, t.w * k - 0.35), fd: Math.max(0.15, t.h * k - 0.35), h: 0.4, th: h, area: t.w * t.h };
    });
    /* roofs with logos: one instanced mesh reading the logo sheet */
    var tex = atlasTexture();
    if (tex) {
      var geo = new THREE.PlaneGeometry(1, 1);
      var uvo = new Float32Array(Math.max(1, n) * 2);
      E.items.forEach(function (it, i) { var a = atlasUV(it.c.s); if (a) { uvo[i * 2] = a.u; uvo[i * 2 + 1] = a.v; } else { uvo[i * 2] = -1; uvo[i * 2 + 1] = -1; } });
      geo.setAttribute('uvo', new THREE.InstancedBufferAttribute(uvo, 2));
      var a0 = atlasUV(E.items[0] ? E.items[0].c.s : '') || { su: 0.05, sv: 0.05 };
      var sm = new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, cell: { value: new THREE.Vector2(a0.su, a0.sv) } }, transparent: true, depthWrite: false,
        vertexShader: 'attribute vec2 uvo; uniform vec2 cell; varying vec2 vUv; varying float vOk; void main(){ vOk = uvo.x < 0.0 ? 0.0 : 1.0; vUv = uvo + uv * cell; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform sampler2D map; varying vec2 vUv; varying float vOk; void main(){ if (vOk < 0.5) discard; vec4 c = texture2D(map, vUv); if (c.a < 0.08) discard; gl_FragColor = c; }'
      });
      var roofs = new THREE.InstancedMesh(geo, sm, Math.max(1, n)); roofs.count = n; E.roofs = roofs; g.add(roofs);
    } else E.roofs = null;
    /* labels on the 24 widest towers */
    E.labels = [];
    E.items.slice().sort(function (a, b) { return b.area - a.area; }).slice(0, 24).forEach(function (it) {
      if (it.fw < 4 || it.fd < 3) return;
      var sp = label([it.c.s, MM.fmtPct(it.c.ch[S.tf])], ['#fff', '#fff']);
      sp.center.set(0.5, 0); it.lb = sp; E.labels.push(it); g.add(sp);
    });
    E.scene.add(g);
    E.dirty = true;
    cityPose(0);
  }
  function cityPose(t) {
    var M = new THREE.Matrix4(), q = new THREE.Quaternion(), Q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    var busy = false, tf = S.tf, Qh = E.q;
    E.items.forEach(function (it, i) {
      var dh = it.th - it.h; if (Math.abs(dh) > 0.02) { it.h += dh * 0.12; busy = true; } else it.h = it.th;
      var dim = Qh && it.c.s.indexOf(Qh) !== 0;
      M.compose(new THREE.Vector3(it.x, it.h / 2, it.z), q, new THREE.Vector3(it.fw, it.h, it.fd));
      E.mesh.setMatrixAt(i, M);
      var rgb = MM.rgb(it.c.ch[tf]); if (E.hover === i) rgb = [rgb[0] + (255 - rgb[0]) * 0.3, rgb[1] + (255 - rgb[1]) * 0.3, rgb[2] + (255 - rgb[2]) * 0.3];
      if (dim) rgb = [rgb[0] * 0.25 + 10, rgb[1] * 0.25 + 10, rgb[2] * 0.25 + 12];
      E.mesh.setColorAt(i, col3(rgb));
      if (E.roofs) {
        var s = Math.min(Math.min(it.fw, it.fd) * 0.72, 11);
        M.compose(new THREE.Vector3(it.x, it.h + 0.03, it.z), Q2, new THREE.Vector3(s, s, 1));
        E.roofs.setMatrixAt(i, M);
      }
      if (it.lb) { var sc = MM.clamp(Math.min(it.fw, it.fd) * 0.8, 2.2, 9); it.lb.scale.set(sc, sc / 2, 1); it.lb.position.set(it.x, it.h + 0.4, it.z); it.lb.visible = !dim; }
    });
    E.mesh.instanceMatrix.needsUpdate = true; if (E.mesh.instanceColor) E.mesh.instanceColor.needsUpdate = true;
    if (E.roofs) E.roofs.instanceMatrix.needsUpdate = true;
    return busy;
  }
  function cityFit() {
    var R = 20;
    E.items.forEach(function (it) { R = Math.max(R, Math.hypot(Math.abs(it.x) + it.fw / 2, Math.abs(it.z) + it.fd / 2, it.th + 4)); });
    E.orbit.fitSphere(R * 0.66, E.w / E.h, E.cam.fov);      /* a sphere round a flat city is generous: come a little closer */
    E.orbit.s.min = R * 0.8;
  }
  function bubFit() {
    var rx = 10, ry = 10; E.items.forEach(function (it) { rx = Math.max(rx, Math.hypot(it.p.x, it.p.z) + it.tr); ry = Math.max(ry, Math.abs(it.p.y) + it.tr); });
    /* frame the cloud by its real width and height, not a sphere round it */
    var half = E.cam.fov * Math.PI / 360, dist = Math.max(ry / Math.tan(half), rx / (Math.tan(half) * E.w / E.h)) * 1.08 + rx * 0.5;
    E.orbit.s.min = 20; E.orbit.s.max = dist * 2.5; E.orbit.fit(dist);
  }
  function cityRelabel() {
    (E.labels || []).forEach(function (it) {
      var c = it.lb.userData.canvas, x = c.getContext('2d'), ch = it.c.ch[S.tf], F = '"Space Grotesk",Vazirmatn,sans-serif';
      x.clearRect(0, 0, c.width, c.height); x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.75)'; x.shadowBlur = 8;
      x.font = '700 54px ' + F; x.fillStyle = '#fff'; x.fillText(it.c.s, 128, 42);
      x.font = '600 40px ' + F; x.fillText(MM.fmtPct(ch), 128, 96);
      it.lb.material.map.needsUpdate = true;
    });
  }

  /* ================================================================ the bubble space */
  var HALO = null;
  function haloTex() {
    if (HALO) return HALO;
    var c = d.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 20, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.36, 'rgba(255,255,255,.55)'); gr.addColorStop(0.42, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); HALO = new THREE.CanvasTexture(c); return HALO;
  }
  function bubBuild(getSt) {
    var st = getSt(), list = st.list.filter(function (n) { return !n.dead; }), m = Math.min(st.w, st.h), k = 64 / m;
    if (E.grp) { E.scene.remove(E.grp); disposeTree(E.grp); }
    var g = new THREE.Group(); E.grp = g;
    var mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.18 });
    var mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 40, 28), mat, Math.max(1, list.length)); mesh.count = list.length;
    E.mesh = mesh; g.add(mesh);
    var prev = {}; (E.items || []).forEach(function (it) { prev[it.c.s] = it; });
    E.items = list.map(function (n) {
      var o = prev[n.c.s], r = Math.max(0.6, n.tr * k);
      if (o) { o.c = n.c; o.tr = r; return o; }
      var u = Math.random() * 2 - 1, a = Math.random() * 6.2832, rr = 10 + Math.random() * 30, sq = Math.sqrt(1 - u * u);
      return { c: n.c, p: new THREE.Vector3(rr * sq * Math.cos(a), rr * u * 0.7, rr * sq * Math.sin(a)), v: new THREE.Vector3(), r: 0.3, tr: r };
    });
    /* each logo on its own 64 px canvas (a clone of the whole sheet per sprite would upload the sheet a hundred times) */
    E.items.forEach(function (it) {
      var c = d.createElement('canvas'); c.width = c.height = 64;
      if (MM.drawLogo(c.getContext('2d'), it.c.s, 32, 32, 60)) {
        var t2 = new THREE.CanvasTexture(c); t2.encoding = THREE.sRGBEncoding; t2.minFilter = THREE.LinearFilter;
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t2, transparent: true, depthWrite: false })); it.logo = sp; g.add(sp);
      } else it.logo = null;
      it.lb = null;
      var ch = it.c.ch[S.tf];
      it.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: ch > 0 ? 0x34d399 : ch < 0 ? 0xff5a4d : 0x8a8a92, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(it.halo);
    });
    E.items.slice().sort(function (a, b) { return b.tr - a.tr; }).slice(0, 30).forEach(function (it) {
      if (it.tr < 2.4) return;
      var sp = label([it.c.s, MM.fmtPct(it.c.ch[S.tf])], ['#fff', '#fff']); sp.center.set(0.5, 1); it.lb = sp; g.add(sp);
    });
    E.scene.add(g); E.dirty = true;
  }
  /* take a bubble and throw it, as in 2D: it moves on the plane facing the camera, and keeps its speed when let go */
  function wireGrab(el) {
    var plane = new THREE.Plane(), hit = new THREE.Vector3(), off = new THREE.Vector3(), last = new THREE.Vector3();
    function ray(ev) { var rc = el.getBoundingClientRect(); E.ptr.set((ev.clientX - rc.left) / rc.width * 2 - 1, -(ev.clientY - rc.top) / rc.height * 2 + 1); E.ray.setFromCamera(E.ptr, E.cam); }
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      var i = pick(ev); if (i == null || !E.items[i]) return;
      var it = E.items[i]; ray(ev);
      plane.setFromNormalAndCoplanarPoint(E.cam.getWorldDirection(new THREE.Vector3()).negate(), it.p);
      if (!E.ray.ray.intersectPlane(plane, hit)) return;
      off.copy(it.p).sub(hit); last.copy(it.p); E.grab = { it: it }; it.v.set(0, 0, 0); el.style.cursor = 'grabbing';
    }, true);
    el.addEventListener('pointermove', function (ev) {
      if (!E.grab) return; ray(ev);
      if (!E.ray.ray.intersectPlane(plane, hit)) return;
      var it = E.grab.it, to = hit.add(off);
      it.v.copy(to).sub(last).multiplyScalar(0.9); last.copy(to); it.p.copy(to); MM.tip(null);
    });
    function up() { if (E && E.grab) { E.grab = null; el.style.cursor = 'grab'; } }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  function bubStep() {
    var it = E.items, n = it.length, i, j, moving = 0, camDir = new THREE.Vector3();
    for (i = 0; i < n; i++) {
      var a = it[i]; a.r += (a.tr - a.r) * 0.08; moving += Math.abs(a.tr - a.r);
      if (!(E.grab && E.grab.it === a)) { var asp = Math.max(1, E.w / E.h); a.v.x -= a.p.x * 0.0012 / asp; a.v.y -= a.p.y * 0.0016; a.v.z -= a.p.z * 0.0012; }   /* a wide cloud on a wide screen */
    }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var A = it[i], B = it[j], dx = B.p.x - A.p.x, dy = B.p.y - A.p.y, dz = B.p.z - A.p.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001, min = A.r + B.r + 1.4 + 0.3 * Math.min(A.r, B.r);
      if (dist < min) {
        var ov = (min - dist) / dist * 0.5, wa = B.r * B.r / (A.r * A.r + B.r * B.r), wb = 1 - wa;
        if (E.grab) { if (E.grab.it === A) { wa = 0; wb = 1; } else if (E.grab.it === B) { wa = 1; wb = 0; } }
        A.p.x -= dx * ov * wa; A.p.y -= dy * ov * wa; A.p.z -= dz * ov * wa; B.p.x += dx * ov * wb; B.p.y += dy * ov * wb; B.p.z += dz * ov * wb;
      }
    }
    var M = new THREE.Matrix4(), q = new THREE.Quaternion(), tf = S.tf, Qh = E.q;
    for (i = 0; i < n; i++) {
      var o = it[i], held = E.grab && E.grab.it === o;
      if (!held) { o.v.multiplyScalar(0.9); o.p.add(o.v); }
      moving += o.v.length();
      if (o.halo) { o.halo.position.copy(o.p); var hs = o.r * 2.9; o.halo.scale.set(hs, hs, 1); }
      M.compose(o.p, q, new THREE.Vector3(o.r, o.r, o.r)); E.mesh.setMatrixAt(i, M);
      var ch = o.c.ch[tf], rgb = MM.rgb(ch == null ? null : (ch >= 0 ? 1 : -1) * Math.max(Math.abs(ch), MM.SAT[tf] * 0.35));
      if (E.hover === i) rgb = [rgb[0] + (255 - rgb[0]) * 0.3, rgb[1] + (255 - rgb[1]) * 0.3, rgb[2] + (255 - rgb[2]) * 0.3];
      var dim = Qh && o.c.s.indexOf(Qh) !== 0; if (dim) rgb = [rgb[0] * 0.2 + 8, rgb[1] * 0.2 + 8, rgb[2] * 0.2 + 10];
      E.mesh.setColorAt(i, col3(rgb));
      camDir.copy(E.cam.position).sub(o.p).normalize();
      if (o.logo) { o.logo.position.copy(o.p).addScaledVector(camDir, o.r * 1.02); var ls = o.r * (o.lb ? 0.78 : 1.05); o.logo.scale.set(ls, ls, 1); o.logo.position.y += o.lb ? o.r * 0.22 : 0; o.logo.visible = !dim; }
      if (o.lb) { o.lb.position.copy(o.p).addScaledVector(camDir, o.r * 1.05); o.lb.position.y -= o.r * 0.05; var s2 = o.r * 1.15; o.lb.scale.set(s2, s2 / 2, 1); o.lb.visible = !dim; }
    }
    E.mesh.instanceMatrix.needsUpdate = true; if (E.mesh.instanceColor) E.mesh.instanceColor.needsUpdate = true;
    return moving > 0.01;
  }

  /* ================================================================ public */
  function stop() {
    if (!E) return;
    E.run = false; cancelAnimationFrame(E.raf);
    if (E.ro) E.ro.disconnect();
    try { disposeTree(E.scene); E.r.dispose(); if (E.r.forceContextLoss) E.r.forceContextLoss(); } catch (e) { }
    if (E.r.domElement.parentNode) E.r.domElement.parentNode.removeChild(E.r.domElement);
    if (E.hint && E.hint.parentNode) E.hint.parentNode.removeChild(E.hint);
    MM.tip(null);
    E = null;
  }
  MM.space3d = {
    city: function (box, getL, size) {
      stop();
      E = Engine(box, size, 'city'); E.getL = getL;
      var R = 100 * Math.max(1, size.h / size.w) * 1.05;
      E.orbit = Orbit(E.cam, E.r.domElement, { th: 0.42, ph: 0.92, r: R, min: 18, max: 260, ty: 0 });
      cityBuild(getL); cityFit();
      E.step = function () { return cityPose(); };
      wirePick(E.r.domElement);
      E.raf = requestAnimationFrame(loop);
    },
    bubbles: function (box, getSt, size) {
      stop();
      E = Engine(box, size, 'bub'); E.getSt = getSt;
      E.orbit = Orbit(E.cam, E.r.domElement, { th: 0, ph: 1.25, r: 120, min: 30, max: 300, ty: 0, held: function () { return !!(E && E.grab); } });
      bubBuild(getSt);
      for (var i = 0; i < 160; i++) bubStep();
      bubFit();                                              /* the whole cluster in view */
      E.step = function () { bubStep(); return true; };
      wirePick(E.r.domElement); wireGrab(E.r.domElement);
      E.raf = requestAnimationFrame(loop);
    },
    update: function (src, why) {
      if (!E) return;
      if (E.kind === 'city') {
        if (why === 'layout' || why === 'set' || why === 'size' || why === 'logos' || why === 'snapshot') cityBuild(E.getL);
        else { E.items.forEach(function (it) { it.th = heightOf(it.c); }); cityRelabel(); }
      } else {
        bubBuild(E.getSt);
      }
      E.dirty = true;
    },
    find: function (q) { if (E) { E.q = q || ''; E.dirty = true; } },
    resize: function () {
      if (!E) return;
      var r = E.box.getBoundingClientRect(), w = Math.max(200, Math.floor(r.width)), h = Math.max(240, Math.floor(r.height));
      E.w = w; E.h = h; E.r.setSize(w, h); E.cam.aspect = w / h; E.cam.updateProjectionMatrix();
      if (E.kind === 'city') { cityBuild(E.getL); cityFit(); } else bubFit();
      E.dirty = true;
    },
    snapshot: function () { if (!E) return null; E.r.render(E.scene, E.cam); return E.r.domElement; },
    stop: stop
  };
})();
