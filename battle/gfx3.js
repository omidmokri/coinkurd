/* entekhab.net — Bitcoin Battlefield 3.0 · graphics kit
   Procedural textures, sky + image-based lighting, terrain, flora, soldiers, vehicles, aircraft and
   post-processing. Everything is generated in code (no downloaded models or textures), on three.js r128
   (self-hosted). Colours are authored in sRGB and converted to linear; the renderer runs ACES + sRGB. */
(function () {
'use strict';
const G = window.GFX = {};
const TAU = Math.PI * 2;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => a + (b - a) * t;
G.lin = h => new THREE.Color(h).convertSRGBToLinear();
G.lin3 = a => { const c = new THREE.Color(a[0], a[1], a[2]).convertSRGBToLinear(); return [c.r, c.g, c.b]; };

/* ------------------------------------------------------------------ quality tiers */
G.TIERS = {
  ultra: { pr: 2, shadow: 4096, post: true, bloom: true, fxaa: true, grass: 14000, trees: 340, rocks: 160, std: true, cap: 150, tcap: 16, soft: 7000, glow: 5000, aniso: 8 },
  high: { pr: 1.5, shadow: 2048, post: true, bloom: true, fxaa: true, grass: 8000, trees: 280, rocks: 130, std: true, cap: 150, tcap: 16, soft: 6000, glow: 4000, aniso: 4 },
  low: { pr: 1, shadow: 1024, post: true, bloom: false, fxaa: true, grass: 3200, trees: 200, rocks: 90, std: true, cap: 130, tcap: 16, soft: 4000, glow: 2500, aniso: 2 },
  lite: { pr: .75, shadow: 0, post: false, bloom: false, fxaa: false, grass: 700, trees: 140, rocks: 50, std: false, cap: 120, tcap: 16, soft: 2200, glow: 1400, aniso: 1 }
};
/* software rasterisers (SwiftShader, llvmpipe, Microsoft Basic Render Driver) start on the lite tier */
G.gpuInfo = function () {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return { soft: true, name: 'none' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    return { soft: /swiftshader|llvmpipe|softpipe|basic render|software|mesa offscreen/i.test(name), name };
  } catch (e) { return { soft: false, name: '?' }; }
};

/* software rasterisers pay for every instruction of every pixel: swap the filmic tone curve for a short one and the sRGB power curve for a square root.
   Must run before the first material is compiled; returns the tone-mapping constant to use. */
G.softRender = function () {
  const C = THREE.ShaderChunk;
  C.tonemapping_pars_fragment = C.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }', 'vec3 CustomToneMapping( vec3 color ) { color *= toneMappingExposure * 2.05; color = color * color / ( color + 0.035 ); return clamp( color * ( 1.0 + color * 0.17 ) / ( 1.0 + color ), 0.0, 1.0 ); }');
  C.encodings_pars_fragment = C.encodings_pars_fragment.replace(/vec4 LinearTosRGB\( in vec4 value \) \{[^}]*\}/, 'vec4 LinearTosRGB( in vec4 value ) { return vec4( sqrt( value.rgb ), value.a ); }');
  return THREE.CustomToneMapping;
};

/* ------------------------------------------------------------------ tileable value noise */
const LAT = (() => { const P = 256, a = new Float32Array(P * P); let s = 1234567; for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; } return a; })();
function vn(x, y, per, off) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, m = per - 1;
  const x0 = (xi & m), y0 = (yi & m), x1 = ((xi + 1) & m), y1 = ((yi + 1) & m), o = off & 255;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = LAT[((y0 + o) & 255) * 256 + ((x0 + o * 7) & 255)], b = LAT[((y0 + o) & 255) * 256 + ((x1 + o * 7) & 255)];
  const c = LAT[((y1 + o) & 255) * 256 + ((x0 + o * 7) & 255)], d = LAT[((y1 + o) & 255) * 256 + ((x1 + o * 7) & 255)];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/* u,v in [0,1): tileable fbm with base period `per` (power of two) */
function fbm(u, v, per, oct, off, ridged) {
  let s = 0, a = .5, n = 0, p = per;
  for (let o = 0; o < oct && p <= 256; o++) { let x = vn(u * p, v * p, p, off + o * 31); if (ridged) x = 1 - Math.abs(2 * x - 1); s += a * x; n += a; a *= .5; p *= 2; }
  return s / n;
}
G.fbm = fbm;
/* smooth non-tiling 2D noise for world-space use (terrain heights) */
G.noise = (x, z) => vn(x, z, 256, 3) * 2 - 1;
G.fbmW = (x, z, oct) => { let s = 0, a = .5, f = 1, n = 0; for (let o = 0; o < (oct || 4); o++) { s += a * (vn(x * f + 37.1 * o, z * f - 11.3 * o, 256, o * 13) * 2 - 1); n += a; a *= .5; f *= 2.03; } return s / n; };

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function tex(c, rep, lin) {
  const t = new THREE.CanvasTexture(c);
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = G.aniso || 1;
  if (!lin) t.encoding = THREE.sRGBEncoding;
  return t;
}

/* ------------------------------------------------------------------ terrain detail + normal map
   RGBA detail (linear data): R grass blades, G soil + pebbles, B rock cracks, A macro variation */
G.terrainTextures = function () {
  if (G._tt) return G._tt;
  const N = 256, cD = canvas(N), xD = cD.getContext('2d'), iD = xD.createImageData(N, N), H = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    const blades = fbm(u, v * .35, 32, 4, 11) * .55 + fbm(u, v, 64, 3, 23) * .45;          // stretched → blade streaks
    const soil = fbm(u, v, 8, 5, 41), peb = Math.pow(fbm(u, v, 64, 2, 57), 3) * 2.2;
    const rock = fbm(u, v, 8, 5, 71, true), crack = Math.pow(fbm(u, v, 16, 4, 91, true), 6);
    const macro = fbm(u, v, 4, 4, 101);
    const i = (y * N + x) * 4;
    iD.data[i] = cl(blades * 255, 0, 255);
    iD.data[i + 1] = cl((soil * .8 + cl(peb, 0, 1) * .35) * 255, 0, 255);
    iD.data[i + 2] = cl((rock * .85 - crack * .6 + .1) * 255, 0, 255);
    iD.data[i + 3] = cl(macro * 255, 0, 255);
    H[y * N + x] = blades * .35 + soil * .25 + rock * .4 - crack * .5 + cl(peb, 0, 1) * .2;
  }
  xD.putImageData(iD, 0, 0);
  /* normal map from the combined height */
  const cN = canvas(N), xN = cN.getContext('2d'), iN = xN.createImageData(N, N), k = 2.4;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const h = (a, b) => H[((b + N) % N) * N + ((a + N) % N)];
    const dx = (h(x + 1, y) - h(x - 1, y)) * k, dy = (h(x, y + 1) - h(x, y - 1)) * k;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    iN.data[i] = (-dx / l * .5 + .5) * 255; iN.data[i + 1] = (-dy / l * .5 + .5) * 255; iN.data[i + 2] = (1 / l * .5 + .5) * 255; iN.data[i + 3] = 255;
  }
  xN.putImageData(iN, 0, 0);
  const detail = tex(cD, true, true), normal = tex(cN, true, true);
  detail.generateMipmaps = normal.generateMipmaps = true;
  G._tt = { detail, normal };
  return G._tt;
};

/* ------------------------------------------------------------------ small sprite textures */
G.puffTex = function () {      // soft, noisy smoke puff (alpha), for smoke/dust
  if (G._puff) return G._puff;
  const N = 128, c = canvas(N), x = c.getContext('2d'), im = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = i / N - .5, dy = j / N - .5, r = Math.sqrt(dx * dx + dy * dy) * 2;
    const n = fbm(i / N, j / N, 4, 5, 131);
    const a = cl((1 - r * (0.85 + n * .5)) * 1.6, 0, 1) * (0.55 + n * .6);
    const k = (j * N + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 255 * (0.75 + n * .25); im.data[k + 3] = cl(a * 255, 0, 255);
  }
  x.putImageData(im, 0, 0);
  G._puff = tex(c, false, true); return G._puff;
};
G.glowTex = function () {      // round soft glow (additive)
  if (G._glow) return G._glow;
  const c = canvas(64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.75)'); g.addColorStop(.6, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); G._glow = tex(c, false, true); return G._glow;
};
G.starTex = function () {      // muzzle flash / flare star
  if (G._star) return G._star;
  const c = canvas(128), x = c.getContext('2d');
  x.translate(64, 64); x.globalCompositeOperation = 'lighter';
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 40); g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(.3, 'rgba(255,200,120,.65)'); g.addColorStop(1, 'rgba(255,140,40,0)');
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 40, 0, TAU); x.fill();
  for (let i = 0; i < 6; i++) { x.rotate(TAU / 6 + Math.random() * .3); const l = 40 + Math.random() * 22; const s = x.createLinearGradient(0, 0, l, 0); s.addColorStop(0, 'rgba(255,240,200,.9)'); s.addColorStop(1, 'rgba(255,160,60,0)'); x.fillStyle = s; x.beginPath(); x.moveTo(0, -5); x.lineTo(l, 0); x.lineTo(0, 5); x.fill(); }
  G._star = tex(c, false, true); return G._star;
};
/* 4×4 flipbook of a fireball (frame 0 = bright core → frame 15 = sooty wisps) */
G.fireAtlas = function () {
  if (G._fire) return G._fire;
  const F = 128, c = canvas(F * 4), x = c.getContext('2d'), im = x.createImageData(F * 4, F * 4);
  for (let f = 0; f < 16; f++) {
    const fx = (f % 4) * F, fy = Math.floor(f / 4) * F, life = f / 15;
    for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) {
      const u = i / F - .5, v = j / F - .5, r = Math.sqrt(u * u + v * v) * 2;
      const n = fbm(i / F + life * .37, j / F - life * .53, 4, 5, 151 + f * 3);
      const edge = .55 + life * .35 + n * .45;
      let a = cl((edge - r) * 3.2, 0, 1) * (1 - life * .55);
      const heat = cl((1 - r / edge) * (1.35 - life * 1.1) + n * .35 - .15, 0, 1);
      const R = 255 * cl(.25 + heat * 1.6, 0, 1), Gc = 255 * cl(heat * 1.1 - .12, 0, 1) * (1 - life * .4), B = 255 * cl(heat * .7 - .45, 0, 1);
      const soot = cl(life * 1.4 - heat, 0, 1);
      const k = ((fy + j) * F * 4 + fx + i) * 4;
      im.data[k] = mix(R, 46, soot); im.data[k + 1] = mix(Gc, 40, soot); im.data[k + 2] = mix(B, 36, soot); im.data[k + 3] = a * 255;
    }
  }
  x.putImageData(im, 0, 0);
  G._fire = tex(c, false, false); return G._fire;
};
G.scorchTex = function () {    // ground scorch / crater decal
  if (G._scorch) return G._scorch;
  const N = 128, c = canvas(N), x = c.getContext('2d'), im = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N - .5, v = j / N - .5, r = Math.sqrt(u * u + v * v) * 2, n = fbm(i / N, j / N, 4, 5, 171);
    const a = cl((1 - r) * 2.2 - n * .7, 0, 1);
    const ring = cl(1 - Math.abs(r - .55) * 6, 0, 1) * .5;
    const k = (j * N + i) * 4, d = 18 + n * 30 + ring * 40;
    im.data[k] = d; im.data[k + 1] = d * .92; im.data[k + 2] = d * .85; im.data[k + 3] = cl(a * 235, 0, 235);
  }
  x.putImageData(im, 0, 0);
  G._scorch = tex(c, false, false); return G._scorch;
};
G.ringTex = function () {      // shockwave ring
  if (G._ring) return G._ring;
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 34, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.55, 'rgba(255,240,220,.85)'); g.addColorStop(.75, 'rgba(255,230,200,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); G._ring = tex(c, false, true); return G._ring;
};
/* label sprite with a proper Persian/English font (no letter-spacing) */
G.label = function (txt, col, size, opts) {
  opts = opts || {};
  const c = canvas(512, 128), x = c.getContext('2d');
  const draw = (t, cc) => {
    x.clearRect(0, 0, 512, 128);
    x.font = opts.font || '800 64px Vazirmatn, "Space Grotesk", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = /[؀-ۿ]/.test(t) ? 'rtl' : 'ltr';
    x.lineJoin = 'round'; x.lineWidth = 10; x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeText(t, 256, 66);
    x.shadowColor = cc; x.shadowBlur = opts.glow ? 18 : 0; x.fillStyle = cc; x.fillText(t, 256, 66);
  };
  draw(txt, col);
  const t = tex(c, false, false); t.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: !!opts.depth, depthWrite: false, toneMapped: false }));
  sp.scale.set(size * 4, size, 1); sp.renderOrder = 10;
  sp.userData.set = (tt, cc) => { draw(tt, cc || col); t.needsUpdate = true; };
  return sp;
};

/* ------------------------------------------------------------------ sky dome: gradient + sun + procedural clouds + stars */
G.makeSky = function () {
  const U = {
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uGround: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uTime: { value: 0 }, uCloud: { value: .35 },
    uStorm: { value: 0 }, uStars: { value: 0 }, uFlash: { value: 0 }, uSunSize: { value: 0 }, uCT: { value: null }
  };
  const soft = G.std === false;
  if (soft) {
    const N = 256, c = canvas(N), x = c.getContext('2d'), im = x.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = cl(fbm(i / N, j / N, 4, 5, 211) * 255, 0, 255), k = (j * N + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; }
    x.putImageData(im, 0, 0); U.uCT.value = tex(c, true, true);
  }
  const m = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false, defines: soft ? { SKY_TEX: 1 } : {},
    vertexShader: 'varying vec3 vDir;void main(){vDir=(modelMatrix*vec4(position,1.)).xyz-cameraPosition;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader: `uniform vec3 uSun,uZenith,uHorizon,uGround,uSunCol;uniform float uTime,uCloud,uStorm,uStars,uFlash,uSunSize;uniform sampler2D uCT;varying vec3 vDir;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
void main(){vec3 d=normalize(vDir);float h=d.y;float hz=pow(1.-max(h,0.),3.2);vec3 sky=mix(uZenith,uHorizon,hz);
if(h<0.)sky=mix(uHorizon,uGround,smoothstep(0.,-.22,h));
float sd=max(dot(d,uSun),0.);float stm=1.-uStorm*.85;
sky+=uSunCol*(pow(sd,6.)*.22+pow(sd,48.)*.55)*stm;
sky+=uSunCol*smoothstep(.99955-uSunSize,.9998-uSunSize*.5,sd)*9.*stm;
if(h>0.){vec2 uv=d.xz/(h+.14)*.55+vec2(uTime*.0045,uTime*.0018);
#ifdef SKY_TEX
float n=texture2D(uCT,uv*.3125).r,n2=texture2D(uCT,uv*.85+.37).r;
#else
float n=fbm(uv*1.25),n2=fbm(uv*3.4+7.);
#endif

 float cov=mix(.62,.2,uCloud);float c=smoothstep(cov,cov+.28,n*.72+n2*.28)*smoothstep(0.,.16,h);
 float lit=.55+.45*pow(sd,2.5);vec3 cc=mix(uHorizon*1.15+vec3(.06),vec3(1.),.45)*lit;
 cc=mix(cc,vec3(.16,.17,.2),uStorm*.82);cc+=uSunCol*pow(sd,10.)*.7*(1.-c*.4)*stm;
 sky=mix(sky,cc,c*(.55+.45*uCloud));
 if(uStars>0.){vec2 g=d.xz/(h+.25)*80.;vec2 id=floor(g);float r=h21(id);float st=step(.991,r)*smoothstep(0.,.3,h)*(1.-c);vec2 f=fract(g)-.5;st*=smoothstep(.25,0.,length(f));st*=.55+.45*sin(uTime*(1.3+r*3.)+r*40.);sky+=vec3(st*uStars*1.4);}}
sky=mix(sky,vec3(1.3),uFlash);gl_FragColor=vec4(sky,1.);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), m);
  mesh.frustumCulled = false; mesh.renderOrder = 9;
  return { mesh, U };
};
/* image-based lighting from the sky (re-rendered when the mood changes) */
G.makeEnv = function (ren) {
  const pm = new THREE.PMREMGenerator(ren), sc = new THREE.Scene();
  let skyClone = null, rt = null;
  return {
    update(sky) {
      if (!skyClone) { skyClone = new THREE.Mesh(sky.mesh.geometry, sky.mesh.material); sc.add(skyClone); }
      const old = rt; rt = pm.fromScene(sc, 0, .1, 2000); if (old) old.dispose(); return rt.texture;
    }
  };
};

/* ------------------------------------------------------------------ terrain */
G.heightFn = function () {
  const sm = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const f = function (x, z) {
    const ax = Math.abs(x);
    const core = .32 * G.fbmW(x * .035 + 3.1, z * .035 - 1.7, 3) + .1 * G.fbmW(x * .2, z * .2, 2);
    const edge = Math.max(sm(70, 110, ax), sm(44, 76, -z), sm(62, 100, z) * .7);
    const hills = Math.max(0, G.fbmW(x * .016 + 9, z * .016 - 4, 4) + .35) * 11 + Math.max(0, G.fbmW(x * .05, z * .05 + 3, 3)) * 2.5;
    const back = sm(70, 140, -z) * 10 * (.6 + .4 * G.fbmW(x * .01, 5, 2));
    let h = core + edge * hills + back;
    /* base plateaus (HQ compounds sit level) */
    for (const bx of [-80, 80]) { const d = Math.hypot(x - bx, z); if (d < 27) h = mix(h, core * .3 + .15, sm(27, 20, d)); }
    /* road: a dirt track across the field */
    const rd = Math.abs(z - 2 * Math.sin(x * .035)); if (rd < 3.2 && ax < 90) h -= .12 * sm(3.2, 1.2, rd);
    return h;
  };
  return G.terrainMod ? G.terrainMod(f) : f;     /* 4.0: pads under structures and lake basins (gfx4.js) */
};
G.terrainMaterial = function (tier) {
  const T = G.terrainTextures();
  const std = G.TIERS[tier].std;
  const m = std ? new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, normalMap: T.normal, normalScale: new THREE.Vector2(.9, .9) })
                : new THREE.MeshLambertMaterial({});
  if (std) { T.normal.repeat.set(120, 66); }
  const U = {
    uDetail: { value: T.detail }, uGrassA: { value: G.lin(0x2c4a1d) }, uGrassB: { value: G.lin(0x587a2e) }, uDryA: { value: G.lin(0x6a5832) }, uDryB: { value: G.lin(0x947c4c) },
    uDirtA: { value: G.lin(0x3b2e22) }, uDirtB: { value: G.lin(0x65503d) }, uRockA: { value: G.lin(0x514e49) }, uRockB: { value: G.lin(0x7f7b73) },
    uFront: { value: 0 }, uScorch: { value: 0 }, uSea: { value: G.seaY == null ? -50 : G.seaY }, uSandA: { value: G.lin(0x8f7f5c) }, uSandB: { value: G.lin(0xc3b189) }, uCraters: { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, 0, 0)) }, uWet: { value: 0 }
  };
  m.userData.U = U; m.userData.envK = .35;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vWP;varying vec3 vWN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);');
    if (!/worldpos_vertex/.test(sh.vertexShader)) sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = (std ? '#define TERRAIN_CRATERS\n' : '') + `uniform sampler2D uDetail;uniform vec3 uGrassA,uGrassB,uDryA,uDryB,uDirtA,uDirtB,uRockA,uRockB,uSandA,uSandB;uniform float uFront,uScorch,uWet,uSea;uniform vec4 uCraters[24];varying vec3 vWP;varying vec3 vWN;
float TR=0.,FL=0.;\n` + sh.fragmentShader.replace('#include <map_fragment>', `
vec4 d1=texture2D(uDetail,vWP.xz*.21),d2=texture2D(uDetail,vWP.xz*.037+.31),d3=texture2D(uDetail,vWP.xz*.009+.77);
float slope=1.-clamp(vWN.y,0.,1.);float side=smoothstep(-34.,34.,vWP.x+(d3.a-.5)*40.);float mac=d2.a*.6+d3.a*.4;
vec3 grass=mix(uGrassA,uGrassB,d1.r*.55+mac*.45)*(.72+.56*d1.r);
vec3 dry=mix(uDryA,uDryB,d1.r*.6+mac*.4)*(.78+.44*d1.r);
vec3 base=mix(grass,dry,side);
vec3 dirt=mix(uDirtA,uDirtB,d1.g)*(.7+.6*d1.g);vec3 rock=mix(uRockA,uRockB,d1.b)*(.62+.6*d1.b);
float road=1.-smoothstep(1.4,3.4,abs(vWP.z-2.*sin(vWP.x*.035)))*step(abs(vWP.x),90.);
float nml=exp(-pow((vWP.x-uFront)/9.,2.))*(.55+.45*d2.g)*step(abs(vWP.z),46.);
float wD=clamp(max(road*.85,nml*.9)+(mac-.62)*1.6+(d2.g-.5)*.5,0.,1.);
float wR=smoothstep(.3,.55,slope+(d1.b-.5)*.35);
vec3 col=mix(base,dirt,wD);col=mix(col,rock,wR);
float shore=1.-smoothstep(uSea+.25,uSea+1.5+d2.r*.9,vWP.y);col=mix(col,mix(uSandA,uSandB,d1.g*.6+d2.a*.4),shore*.92);
#ifdef TERRAIN_CRATERS
float burn=0.;for(int i=0;i<24;i++){vec4 c=uCraters[i];if(c.z<=0.)continue;float dd=length(vWP.xz-c.xy)/c.z;burn=max(burn,(1.-smoothstep(.35,1.,dd+(d1.g-.5)*.4))*c.w);}
col=mix(col,vec3(.035,.03,.026)+dirt*.18,burn*.85);
#endif
TR=mix(mix(.96,.9,wD),.82,wR);TR=mix(TR,.55,uWet*(1.-wR)*.8);col*=mix(1.,.72,uWet*.6);
diffuseColor.rgb*=col;FL=exp(-pow((vWP.x-uFront)/.55,2.))*step(abs(vWP.z),44.)*(.75+.25*sin(vWP.z*.7));`).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.,.5,.1)*FL*1.5;');
    if (std) sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=TR;');
  };
  return m;
};
/* software renderers: the whole ground palette is baked into vertex colours once; a pixel then costs one grain lookup */
G.grainTex = function () {
  const N = 256, c = canvas(N), x = c.getContext('2d'), im = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const u = i / N, v = j / N, k = (j * N + i) * 4, val = cl((.58 + .5 * (fbm(u, v * .35, 32, 4, 11) * .45 + fbm(u, v, 64, 3, 23) * .25 + fbm(u, v, 8, 5, 41) * .3)) * 255, 0, 255); im.data[k] = im.data[k + 1] = im.data[k + 2] = val; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); const t = tex(c, true, true); t.repeat.set(84, 52); t.minFilter = THREE.LinearMipmapNearestFilter; return t;
};
G.terrainBake = function (g) {
  const sm = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const p = g.attributes.position, n = g.attributes.normal, C = new Float32Array(p.count * 3), sea = G.seaY == null ? -50 : G.seaY, c = h => G.lin(h);
  const GA = c(0x2c4a1d), GB = c(0x587a2e), DA = c(0x6a5832), DB = c(0x947c4c), TA = c(0x3b2e22), TB = c(0x65503d), RA = c(0x514e49), RB = c(0x7f7b73), SA = c(0x8f7f5c), SB = c(0xc3b189);
  const o = new THREE.Color(), a = new THREE.Color(), b = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), fine = .5 + .5 * G.fbmW(x * .23 + 1.7, z * .23 - 4.1, 2), mac = .5 + .5 * G.fbmW(x * .045 + 3.1, z * .045 - 7.7, 3), big = .5 + .5 * G.fbmW(x * .011 + 11, z * .011 + 5, 2);
    const side = sm(-34, 34, x + (big - .5) * 40), slope = 1 - cl(n.getY(i), 0, 1);
    a.copy(GA).lerp(GB, fine * .55 + mac * .45).multiplyScalar(.72 + .56 * fine); b.copy(DA).lerp(DB, fine * .6 + mac * .4).multiplyScalar(.78 + .44 * fine); o.copy(a).lerp(b, side);
    const worn = sm(36, 6, Math.abs(x)) * (Math.abs(z) < 46 ? 1 : 0) * (.3 + .55 * mac);            // churned earth where the front moves
    a.copy(TA).lerp(TB, mac).multiplyScalar(.7 + .6 * mac); o.lerp(a, cl(worn + (mac - .62) * 1.6 + (big - .5) * .5, 0, 1));
    a.copy(RA).lerp(RB, fine).multiplyScalar(.62 + .6 * fine); o.lerp(a, sm(.3, .55, slope + (fine - .5) * .35));
    const shore = 1 - sm(sea + .25, sea + 1.5 + fine * .9, y); if (shore > 0) { a.copy(SA).lerp(SB, fine * .6 + mac * .4); o.lerp(a, shore * .92); }
    C[i * 3] = o.r * 1.2; C[i * 3 + 1] = o.g * 1.2; C[i * 3 + 2] = o.b * 1.2;
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: G.grainTex() });
  m.userData.U = { uFront: { value: 0 }, uWet: { value: 0 }, uSea: { value: sea }, uCraters: { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, 0, 0)) } };
  return m;
};
G.terrain = function (tier, hgt) {
  const hi = tier === 'ultra' || tier === 'high';
  const g = new THREE.PlaneGeometry(420, 260, hi ? 260 : 170, hi ? 160 : 104);
  g.rotateX(-Math.PI / 2); g.translate(0, 0, -18);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hgt(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, G.std === false ? G.terrainBake(g) : G.terrainMaterial(tier));
  m.receiveShadow = true; m.renderOrder = 5;          /* drawn after the things standing on it: its pixels are the dearest */
  return m;
};
/* far mountains: a fogless silhouette ring tinted by the horizon colour */
G.mountains = function () {
  const g = new THREE.CylinderGeometry(560, 560, 1, 160, 6, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i) + .5, a = Math.atan2(z, x);
    const ridge = Math.max(0, G.fbmW(Math.cos(a) * 3 + 11, Math.sin(a) * 3, 5) + .25) * 120 + 18;
    p.setY(i, y * ridge - 6);
  }
  g.computeVertexNormals();
  const U = { uCol: { value: new THREE.Color() }, uTop: { value: new THREE.Color() } };
  const m = new THREE.ShaderMaterial({
    uniforms: U, fog: false, side: THREE.BackSide,
    vertexShader: 'varying float vY;void main(){vY=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 uCol,uTop;varying float vY;void main(){vec3 c=mix(uCol,uTop,clamp(vY/110.,0.,1.));gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'
  });
  const mesh = new THREE.Mesh(g, m); mesh.userData.U = U; mesh.renderOrder = 8; return mesh;          /* late: only where nothing nearer was drawn */
};

/* ------------------------------------------------------------------ geometry helpers */
function jitter(g, amt, f, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = G.fbmW(x * f + seed, (y + z) * f - seed, 2);
    const l = Math.hypot(x, y, z) || 1;
    p.setXYZ(i, x + x / l * n * amt, y + y / l * n * amt * .6, z + z / l * n * amt);
  }
  g.computeVertexNormals(); return g;
}
function paint(g, fn) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function merge(list) {          // merge non-indexed geometries that all have position/normal/color (+ optional aPart)
  let n = 0; list.forEach(g => n += g.attributes.position.count);
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), A = new Float32Array(n);
  let o = 0;
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position, nn = g.attributes.normal, cc = g.attributes.color, pa = g.attributes.aPart;
    for (let i = 0; i < p.count; i++) {
      P[(o + i) * 3] = p.getX(i); P[(o + i) * 3 + 1] = p.getY(i); P[(o + i) * 3 + 2] = p.getZ(i);
      N[(o + i) * 3] = nn.getX(i); N[(o + i) * 3 + 1] = nn.getY(i); N[(o + i) * 3 + 2] = nn.getZ(i);
      if (cc) { C[(o + i) * 3] = cc.getX(i); C[(o + i) * 3 + 1] = cc.getY(i); C[(o + i) * 3 + 2] = cc.getZ(i); } else { C[(o + i) * 3] = C[(o + i) * 3 + 1] = C[(o + i) * 3 + 2] = 1; }
      A[o + i] = pa ? pa.getX(i) : 0;
    }
    o += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.setAttribute('aPart', new THREE.BufferAttribute(A, 1));
  return out;
}
G.merge = merge; G.paint = paint; G.jitter = jitter;
function solid(g, col, part) {  // colour a whole primitive + tag its part id
  const c = G.lin3(col); const gg = g.index ? g.toNonIndexed() : g;
  paint(gg, () => c); const n = gg.attributes.position.count; gg.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part || 0), 1)); return gg;
}
G.solid = solid;
const T = (g, x, y, z) => { g.translate(x, y, z); return g; };
const R = (g, ax, a) => { if (ax === 'x') g.rotateX(a); else if (ax === 'y') g.rotateY(a); else g.rotateZ(a); return g; };
G.T = T; G.R = R;
/* rounded box (bevelled) for vehicles and gear */
G.rbox = function (w, h, d, r, seg) {
  r = Math.min(r, w / 2 - .001, h / 2 - .001); const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const bv = Math.min(r * .8, d * .3);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * .8, bevelSegments: seg || 1, curveSegments: seg || 1 });
  g.translate(0, 0, -(d - bv * 2) / 2); return g;
};
/* side profile (x,y points) extruded along z, bevelled — hull shapes with sloped armour */
G.profile = function (pts, depth, bevel) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const b = bevel || .06; const g = new THREE.ExtrudeGeometry(s, { depth: depth - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(depth - b * 2) / 2); return g;
};

/* thin square strut between two points (unpainted) */
G.beam = function (p, q, t) {
  const d = new THREE.Vector3().subVectors(q, p), len = d.length(), g = new THREE.BoxGeometry(t, len, t);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())));
  g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2); return g.toNonIndexed();
};
/* a dish antenna as a solid shell with its feed: prof is the concave face from the axis out to the rim ([r, y] pairs).
   The lathe runs down the back from the axis to the rim and up the face back to the axis, so every face of the shell points
   outward and the dish is solid from every side (a single open surface vanishes whenever its back turns to the camera).
   Axis on +y, vertex at the origin; returns [shell, feed horn, three struts] for the caller to paint and place. */
G.dishGeo = function (prof, thick, seg, feed) {
  const n = prof.length, R = prof[n - 1][0], D = prof[n - 1][1];
  const back = prof.map(([r, y], i) => [i === n - 1 ? r + thick * .6 : r, y - thick]);
  const out = [new THREE.LatheGeometry(back.concat(prof.slice().reverse()).map(p => new THREE.Vector2(p[0], p[1])), seg || 16).toNonIndexed()];
  if (feed === false) return out;
  const f = Math.max(D * 1.25, R * R / (4 * D)), V3 = THREE.Vector3;
  const horn = new THREE.CylinderGeometry(R * .06, R * .09, R * .2, 8); horn.translate(0, f, 0); out.push(horn.toNonIndexed());
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + .5; out.push(G.beam(new V3(Math.cos(a) * R * .96, D - thick * .5, Math.sin(a) * R * .96), new V3(Math.cos(a) * R * .05, f - R * .06, Math.sin(a) * R * .05), R * .025)); }
  return out;
};

/* ------------------------------------------------------------------ flora */
G.pineGeo = function (lite) {
  const parts = [];
  const mid = lite === 2; if (mid) lite = false;
  const trunk = new THREE.CylinderGeometry(.16, .32, 3.2, lite || mid ? 5 : 7, 1, mid); T(trunk, 0, 1.6, 0); parts.push(solid(trunk, [.28, .2, .14]));
  const layers = lite ? 3 : mid ? 4 : 5;
  for (let i = 0; i < layers; i++) {
    const f = i / (layers - 1), r = 2.1 - f * 1.5, h = 2.4 - f * .9;
    const c = new THREE.ConeGeometry(r, h, lite ? 6 : mid ? 7 : 9, mid ? 1 : 2, true); T(c, 0, 2.2 + f * 4.6 + h / 2, 0);
    if (!lite) jitter(c, mid ? .28 : .35, .9, i * 3.1);
    const g = c.index ? c.toNonIndexed() : c;
    paint(g, (x, y, z) => { const k = .5 + (y - 2) / 9 * .5 + G.noise(x * 2 + i, z * 2) * .12; return G.lin3([.07 * k + .02, .2 * k + .04, .1 * k + .02]); });
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1)); parts.push(g);
  }
  return merge(parts);
};
G.broadleafGeo = function (lite) {
  const parts = [];
  const mid = lite === 2; if (mid) lite = false;
  const trunk = new THREE.CylinderGeometry(.2, .38, 3, lite || mid ? 5 : 7, 1, mid); T(trunk, 0, 1.5, 0); parts.push(solid(trunk, [.3, .22, .15]));
  if (!lite && !mid) { const br = new THREE.CylinderGeometry(.08, .14, 1.6, 5); R(br, 'z', .8); T(br, .5, 2.8, 0); parts.push(solid(br, [.3, .22, .15])); }
  const blobs = lite ? [[0, 4.0, 0, 2.3]] : mid ? [[0, 4.3, 0, 2.3], [1.2, 3.8, .7, 1.8], [-1.1, 4.2, -.6, 1.9]] : [[0, 4.3, 0, 2.2], [1.3, 3.7, .6, 1.7], [-1.2, 3.9, -.5, 1.8], [.3, 5.4, -.7, 1.6], [-.4, 3.5, 1.3, 1.5], [.9, 4.9, 1.0, 1.3], [-1.0, 5.1, .4, 1.3]];
  blobs.forEach(([x, y, z, r], i) => {
    const s = new THREE.IcosahedronGeometry(r, lite ? 0 : 1); if (!lite) jitter(s, r * .28, 1.4, i * 7.7); T(s, x, y, z);
    const g = s.index ? s.toNonIndexed() : s;
    paint(g, (px, py, pz) => { const ao = cl((py - 2.8) / 3.5, .3, 1), n = G.noise(px * 1.7, pz * 1.7 + py) * .1; return G.lin3([(.13 + n) * ao + .02, (.29 + n) * ao + .04, (.1 + n) * ao + .015]); });
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1)); parts.push(g);
  });
  return merge(parts);
};
G.deadTreeGeo = function () {
  const parts = [], c = [.16, .13, .11];
  const t = new THREE.CylinderGeometry(.12, .3, 4.2, 6); T(t, 0, 2.1, 0); parts.push(solid(t, c));
  /* branches grow out of the trunk: each one starts on the trunk's axis at height y and leans out at angle a (from vertical) towards heading h */
  const V3 = THREE.Vector3;
  [[2.4, .9, .25], [2.9, .8, 3.4], [3.4, .55, 1.6]].forEach(([y, a, h]) => {
    const dir = new V3(Math.sin(a) * Math.cos(h), Math.cos(a), Math.sin(a) * Math.sin(h)), p = new V3(0, y, 0), q = p.clone().addScaledVector(dir, 1.6);
    const b = new THREE.CylinderGeometry(.05, .1, 1.6, 5); b.translate(0, .8, 0);
    b.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir))); b.translate(p.x, p.y, p.z); void q;
    parts.push(solid(b, c));
  });
  return merge(parts);
};
G.rockGeo = function () {
  const g = new THREE.IcosahedronGeometry(1, 1); jitter(g, .35, 1.1, 4.2); g.scale(1, .62, 1.15);
  const gg = g.index ? g.toNonIndexed() : g; paint(gg, (x, y) => { const k = .75 + y * .2; return G.lin3([.42 * k, .4 * k, .37 * k]); });
  gg.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count), 1)); return gg;
};
/* grass: a clump of crossed tapered blades, swaying with the wind in the vertex shader */
G.grassGeo = function () {
  const P = [], C = [], N = [];
  const blade = (a, h, w, lean) => {
    const cx = Math.cos(a), cz = Math.sin(a), lx = Math.cos(a + 1.57) * lean, lz = Math.sin(a + 1.57) * lean;
    const v = [[-w * cx, 0, -w * cz], [w * cx, 0, w * cz], [lx * h, h, lz * h]];
    v.forEach((p, i) => { P.push(p[0], p[1], p[2]); const k = i === 2 ? 1 : 0; C.push(k, k, k); N.push(0, 1, 0); });
  };
  for (let i = 0; i < 7; i++) blade(i * .9 + Math.random() * .4, .5 + Math.random() * .55, .06 + Math.random() * .03, (Math.random() - .5) * .5);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return g;
};
G.grassMaterial = function (U) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: false, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = 'uniform float uTime,uWind;attribute vec3 color;varying float vTip;varying vec3 vIC;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `vec3 transformed=position;vTip=color.r;
#ifdef USE_INSTANCING
vec3 wp=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
#else
vec3 wp=vec3(0.);
#endif
float sw=sin(uTime*1.9+wp.x*.21+wp.z*.17)*.18+sin(uTime*3.7+wp.x*.6)*.06;transformed.x+=(sw+uWind*.35)*color.r*position.y*1.4;transformed.z+=sw*.4*color.r*position.y;`)
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\nvIC=instanceColor;\n#else\nvIC=vec3(1.);\n#endif');
    sh.fragmentShader = 'varying float vTip;varying vec3 vIC;\n' + sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb=vIC*mix(.55,1.15,vTip);').replace(/:\s*vLightBack/g, ': vLightFront').replace(/:\s*vIndirectBack/g, ': vIndirectFront');
  };
  return m;
};
/* ------------------------------------------------------------------ battlefield props */
G.hedgehogGeo = function () {          // Czech hedgehog anti-tank obstacle
  const parts = [], c = [.22, .21, .2];
  for (let i = 0; i < 3; i++) { const b = new THREE.BoxGeometry(2.2, .16, .16); if (i === 1) b.rotateY(Math.PI / 2); if (i === 2) b.rotateZ(Math.PI / 2); b.rotateX(.6); b.rotateY(.5); T(b, 0, .75, 0); parts.push(solid(b, c)); }
  return merge(parts);
};
G.wireGeo = function () {              // a coil of barbed wire between two posts
  const parts = [], t = new THREE.TorusGeometry(.42, .02, 3, 10);
  for (let i = 0; i < 9; i++) { const g = t.clone(); g.rotateY(Math.PI / 2); T(g, 0, .42, -2 + i * .5); parts.push(solid(g, [.3, .29, .27])); }
  [-2.2, 2.2].forEach(z => { const p = new THREE.CylinderGeometry(.04, .05, 1.1, 4); T(p, 0, .55, z); parts.push(solid(p, [.25, .19, .13])); });
  return merge(parts);
};

/* ------------------------------------------------------------------ per-vertex part/material attributes
   (the infantry itself now lives in gfx5.js: per-role meshes, a bone texture and CPU posing) */
function sp(g, part, mat, col) {
  const gg = g.index ? g.toNonIndexed() : g, n = gg.attributes.position.count, c = G.lin3(col || [1, 1, 1]);
  paint(gg, () => c);
  gg.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  gg.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(n).fill(mat), 1));
  return gg;
}
function mergeMat(list) {
  const out = merge(list); let n = 0; list.forEach(g => n += (g.index ? g.toNonIndexed() : g).attributes.position.count);
  const M = new Float32Array(n); let o = 0;
  list.forEach(g => { const a = g.attributes.aMat, c = g.attributes.position.count; for (let i = 0; i < c; i++) M[o + i] = a ? a.getX(i) : 0; o += c; });
  out.setAttribute('aMat', new THREE.BufferAttribute(M, 1)); return out;
}

/* ------------------------------------------------------------------ vehicles & aircraft
   aMat: 0 camo paint · 2 dark metal · 3 rubber/tracks · 4 team markings (emissive) · 5 glass · 6 lamp / afterburner */
G.TEAMS = {
  bull: { c1: 0x4b5d33, c2: 0x6f7f45, c3: 0x2e3524, acc: 0x22c55e, accE: 1.1, flag: 0x22c55e },
  bear: { c1: 0x7a6a50, c2: 0x9c8a68, c3: 0x463d31, acc: 0xef4444, accE: 1.1, flag: 0xef4444 }
};
const VEH_FS_HEAD = `uniform vec3 uC1,uC2,uC3,uAcc;uniform float uAccE,uDirt;varying float vMat;varying vec3 vObj;float SR=.6,SM=.25;vec3 SE=vec3(0.);
float hh(vec3 p){p=fract(p*.3183+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
const VEH_FS_BODY = `
vec3 base=vColor;
if(vMat<.5){float n=n3(vObj*.55)*.6+n3(vObj*1.3)*.4;base=n<.4?uC1:n<.6?uC2:uC3;float g=n3(vObj*6.)*.5+n3(vObj*19.)*.5;base*=mix(.86,1.08,g);
 float low=clamp(1.-vObj.y*.9,0.,1.);base=mix(base,vec3(.3,.25,.18),low*uDirt*.55);SR=mix(.55,.8,g);SM=.18;}
else if(vMat<2.5){SR=.38;SM=.75;}
else if(vMat<3.5){SR=.92;SM=0.;}
else if(vMat<4.5){base=uAcc;SE=uAcc*uAccE;SR=.45;SM=0.;}
else if(vMat<5.5){base=vec3(.04,.06,.08);SR=.06;SM=.9;}
else{base=vec3(1.,.55,.2);SE=vec3(2.6,1.3,.45);}
diffuseColor.rgb=base;`;
G.vehicleMaterial = function (team, std, U, opts) {
  opts = opts || {};
  const m = std ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: .25 }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  const TU = { uC1: { value: G.lin(team.c1) }, uC2: { value: G.lin(team.c2) }, uC3: { value: G.lin(team.c3) }, uAcc: { value: G.lin(team.acc) }, uAccE: { value: team.accE }, uDirt: { value: opts.dirt == null ? 1 : opts.dirt } };
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; Object.assign(sh.uniforms, TU);
    let head = 'attribute float aMat;attribute float aPart;uniform float uTime;varying float vMat;varying vec3 vObj;\n';
    let begin = 'vec3 transformed=position;vMat=aMat;vObj=position;';
    if (opts.recoil) { head += 'attribute float aFire;'; begin += 'float ft=uTime-aFire;if(aPart==7.&&ft>0.&&ft<.5)transformed.x-=.45*exp(-ft*10.);'; }
    sh.vertexShader = head + '\n' + sh.vertexShader.replace('#include <begin_vertex>', begin);
    sh.fragmentShader = VEH_FS_HEAD + sh.fragmentShader.replace('#include <color_fragment>', VEH_FS_BODY).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=SE;');
    if (std) sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=SR;').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=SM;');
  };
  m.userData.TU = TU; m.userData.envK = .85;
  return m;
};
const V = (g, mat, part, col) => sp(g, part || 0, mat, col);
function wheels(L, xs, z, r, w, y, mat) {
  xs.forEach(x => {
    const t = new THREE.CylinderGeometry(r, r, w, 10); t.rotateX(Math.PI / 2); t.translate(x, y, z); L.push(V(t, 3, 0, [.08, .08, .08]));
    const hub = new THREE.CylinderGeometry(r * .55, r * .55, w + .04, 6, 1, true); hub.rotateX(Math.PI / 2); hub.translate(x, y, z); L.push(V(hub, mat == null ? 0 : mat, 0));
  });
}
function plan(pts, h, bevel) {          // plan-view polygon extruded upward (turrets, wings)
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const b = bevel == null ? .05 : bevel;
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, h - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0); return g;     // shape x→x, shape y→ -z
}
/* main battle tank: hull (tracks, skirts, wheels) and turret (barrel = part 7 for recoil) */
G.mbtHull = function () {
  const L = [];
  L.push(V(G.profile([[-2.3, .38], [1.95, .38], [2.38, .78], [1.72, 1.12], [-2.18, 1.12], [-2.36, .82]], 2.02, .07), 0));
  [1.04, -1.04].forEach(z => {
    const tr = G.rbox(4.7, .74, .46, .3, 2); tr.translate(-.1, .41, z); L.push(V(tr, 3, 0, [.09, .09, .085]));
    wheels(L, [-1.75, -1.05, -.35, .35, 1.05, 1.75], z * 1.235, .29, .1, .36, 2);
    const sk = G.rbox(4.3, .32, .06, .05, 1); sk.translate(-.05, .86, z * 1.26); L.push(V(sk, 0));
  });
  const eng = G.rbox(1.3, .12, 1.5, .05, 1); eng.translate(-1.55, 1.17, 0); L.push(V(eng, 2, 0, [.12, .12, .12]));
  [.62, -.62].forEach(z => { const ex = new THREE.CylinderGeometry(.09, .1, .25, 8); ex.rotateZ(Math.PI / 2); ex.translate(-2.42, .95, z); L.push(V(ex, 2, 0, [.1, .1, .1])); });
  const id = G.rbox(.7, .04, 1.1, .02, 1); id.translate(-.6, 1.14, 0); L.push(V(id, 4));
  [.68, -.68].forEach(z => { const lp = new THREE.SphereGeometry(.07, 6, 4); lp.translate(2.0, 1.0, z); L.push(V(lp, 6)); });
  return mergeMat(L);
};
G.mbtTurret = function () {
  const L = [];
  const tu = plan([[-1.35, -.82], [.6, -.86], [1.25, -.42], [1.25, .42], [.6, .86], [-1.35, .82], [-1.55, .45], [-1.55, -.45]], .58, .06); tu.translate(0, 1.13, 0); L.push(V(tu, 0));
  const cup = new THREE.CylinderGeometry(.28, .3, .22, 10); cup.translate(-.35, 1.82, .38); L.push(V(cup, 0));
  const hatch = new THREE.CylinderGeometry(.22, .22, .05, 10); hatch.translate(-.35, 1.95, .38); L.push(V(hatch, 2, 0, [.12, .12, .12]));
  const sight = G.rbox(.3, .22, .22, .04, 1); sight.translate(.45, 1.82, -.42); L.push(V(sight, 2, 0, [.1, .1, .1]));
  const bin = G.rbox(.55, .32, 1.5, .05, 1); bin.translate(-1.72, 1.45, 0); L.push(V(bin, 0));
  const ant = new THREE.CylinderGeometry(.012, .012, 1.4, 3); ant.translate(-1.2, 2.4, -.6); L.push(V(ant, 2, 0, [.1, .1, .1]));
  const band = G.rbox(1.5, .1, .02, .01, 1); band.translate(-.3, 1.48, .86); L.push(V(band, 4)); const band2 = band.clone(); band2.translate(0, 0, -1.72); L.push(V(band2, 4));
  /* barrel assembly (recoils) */
  const mant = G.rbox(.42, .42, .62, .08, 1); mant.translate(1.33, 1.42, 0); L.push(V(mant, 0, 7));
  const brl = new THREE.CylinderGeometry(.085, .1, 3.3, 12); brl.rotateZ(-Math.PI / 2); brl.translate(3.1, 1.43, 0); L.push(V(brl, 2, 7, [.15, .15, .14]));
  const slv = new THREE.CylinderGeometry(.13, .13, .8, 12); slv.rotateZ(-Math.PI / 2); slv.translate(2.3, 1.43, 0); L.push(V(slv, 0, 7));
  const mb = new THREE.CylinderGeometry(.14, .14, .3, 10); mb.rotateZ(-Math.PI / 2); mb.translate(4.65, 1.43, 0); L.push(V(mb, 2, 7, [.12, .12, .12]));
  return mergeMat(L);
};
/* wheeled infantry fighting vehicle (light tier) */
G.ifvHull = function () {
  const L = [];
  L.push(V(G.profile([[-2.05, .55], [1.7, .55], [2.15, .95], [1.55, 1.4], [-1.95, 1.4], [-2.1, 1.05]], 1.86, .07), 0));
  [.82, -.82].forEach(z => wheels(L, [-1.45, -.5, .45, 1.4], z * 1.12, .4, .3, .4, 2));
  const step = G.rbox(3.4, .08, .12, .03, 1); step.translate(0, .6, .95); L.push(V(step, 2, 0, [.12, .12, .12])); const st2 = step.clone(); st2.translate(0, 0, -1.9); L.push(V(st2, 2, 0, [.12, .12, .12]));
  const rd = G.rbox(.6, .5, .9, .06, 1); rd.translate(-2.05, 1.05, 0); L.push(V(rd, 0));
  const id = G.rbox(.6, .035, 1.0, .015, 1); id.translate(-1.2, 1.41, 0); L.push(V(id, 4));
  [.6, -.6].forEach(z => { const lp = new THREE.SphereGeometry(.06, 6, 4); lp.translate(1.95, 1.08, z); L.push(V(lp, 6)); });
  return mergeMat(L);
};
G.ifvTurret = function () {
  const L = [];
  const tu = plan([[-.75, -.55], [.45, -.6], [.8, -.25], [.8, .25], [.45, .6], [-.75, .55]], .42, .05); tu.translate(-.1, 1.4, 0); L.push(V(tu, 0));
  const brl = new THREE.CylinderGeometry(.045, .055, 1.9, 8); brl.rotateZ(-Math.PI / 2); brl.translate(1.55, 1.62, 0); L.push(V(brl, 2, 7, [.14, .14, .14]));
  const atgm = G.rbox(.7, .18, .2, .04, 1); atgm.translate(-.1, 1.75, .58); L.push(V(atgm, 0));
  const band = G.rbox(.8, .08, .02, .01, 1); band.translate(-.15, 1.62, .58); L.push(V(band, 4));
  return mergeMat(L);
};
/* self-propelled howitzer: body mesh + barrel on a pivot (v2 logic: userData.piv, userData.bar) */
G.spg = function (mat) {
  const g = new THREE.Group(), L = [];
  L.push(V(G.profile([[-2.4, .4], [2.0, .4], [2.4, .8], [1.8, 1.1], [-2.3, 1.1], [-2.45, .82]], 2.1, .07), 0));
  [1.08, -1.08].forEach(z => { const tr = G.rbox(4.8, .72, .44, .3, 2); tr.translate(-.1, .42, z); L.push(V(tr, 3, 0, [.09, .09, .085])); wheels(L, [-1.8, -1.1, -.4, .3, 1.0, 1.7], z * 1.235, .28, .1, .37, 2); });
  const tu = plan([[-2.1, -1.0], [.7, -1.0], [1.05, -.6], [1.05, .6], [.7, 1.0], [-2.1, 1.0]], 1.15, .07); tu.translate(-.35, 1.1, 0); L.push(V(tu, 0));
  const band = G.rbox(2.2, .12, .02, .01, 1); band.translate(-.8, 1.8, 1.0); L.push(V(band, 4));
  const mg = new THREE.CylinderGeometry(.03, .03, .8, 5); mg.rotateZ(-Math.PI / 2); mg.translate(-.6, 2.45, .5); L.push(V(mg, 2, 0, [.1, .1, .1]));
  const pin = new THREE.CylinderGeometry(.025, .035, .24, 5); pin.translate(-.6, 2.33, .5); L.push(V(pin, 2, 0, [.1, .1, .1]));   // the machine gun stands on a pintle
  const body = new THREE.Mesh(mergeMat(L), mat); body.castShadow = body.receiveShadow = true; g.add(body);
  const piv = new THREE.Group(); piv.position.set(.75, 1.75, 0); piv.rotation.z = .55;
  const bar = new THREE.Mesh(mergeMat([V((() => { const c = new THREE.CylinderGeometry(.11, .14, 4.6, 12); c.rotateZ(-Math.PI / 2); c.translate(2.3, 0, 0); return c; })(), 2, 0, [.14, .14, .13]),
    V((() => { const c = new THREE.CylinderGeometry(.19, .19, .35, 10); c.rotateZ(-Math.PI / 2); c.translate(4.55, 0, 0); return c; })(), 2, 0, [.12, .12, .12]),
    V((() => { const c = G.rbox(.6, .5, .55, .08, 1); c.translate(.2, 0, 0); return c; })(), 0)]), mat);
  bar.castShadow = true; piv.add(bar); g.add(piv);
  g.userData.bar = bar; g.userData.piv = piv; g.userData.barX = 0; bar.position.x = 0;
  return g;
};
/* rocket artillery truck: chassis + cab + rocket pod (userData.pod) */
G.mlrs = function (mat) {
  const g = new THREE.Group(), L = [];
  const ch = G.rbox(5.2, .35, 1.7, .05, 1); ch.translate(0, .78, 0); L.push(V(ch, 2, 0, [.14, .14, .13]));
  L.push(V(G.profile([[1.4, .9], [2.65, .9], [2.75, 1.5], [2.45, 2.2], [1.4, 2.2]], 1.9, .08), 0));
  const glass = G.rbox(.05, .45, 1.5, .02, 1); glass.rotateZ(-.35); glass.translate(2.62, 1.88, 0); L.push(V(glass, 5));
  wheels(L, [-1.7, -.6, 1.95], .95, .48, .38, .48); wheels(L, [-1.7, -.6, 1.95], -.95, .48, .38, .48);
  const bed = G.rbox(3.0, .35, 1.9, .05, 1); bed.translate(-.9, 1.12, 0); L.push(V(bed, 0));
  const id = G.rbox(.8, .04, 1.3, .02, 1); id.translate(2.0, 2.22, 0); L.push(V(id, 4));
  const body = new THREE.Mesh(mergeMat(L), mat); body.castShadow = body.receiveShadow = true; g.add(body);
  const pod = new THREE.Group(); pod.position.set(-.9, 1.55, 0); pod.rotation.z = .62;
  const P = [V(G.rbox(2.9, .95, 1.6, .06, 1), 0)];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const t = new THREE.CylinderGeometry(.13, .13, .06, 8); t.rotateZ(Math.PI / 2); t.translate(1.46, -.3 + r * .3, -.52 + c * .35); P.push(V(t, 2, 0, [.05, .05, .05])); }
  const pm = new THREE.Mesh(mergeMat(P), mat); pm.position.x = .6; pm.castShadow = true; pod.add(pm); g.add(pod); g.userData.pod = pod;
  return g;
};
G.truck = function (mat) {
  const g = new THREE.Group(), L = [];
  const ch = G.rbox(4.6, .3, 1.6, .05, 1); ch.translate(0, .72, 0); L.push(V(ch, 2, 0, [.14, .14, .13]));
  L.push(V(G.profile([[1.2, .85], [2.35, .85], [2.42, 1.4], [2.1, 2.0], [1.2, 2.0]], 1.8, .08), 0));
  const glass = G.rbox(.05, .4, 1.4, .02, 1); glass.rotateZ(-.4); glass.translate(2.3, 1.7, 0); L.push(V(glass, 5));
  wheels(L, [-1.5, -.45, 1.7], .9, .44, .34, .44); wheels(L, [-1.5, -.45, 1.7], -.9, .44, .34, .44);
  const bed = G.rbox(2.9, .7, 1.8, .05, 1); bed.translate(-.8, 1.2, 0); L.push(V(bed, 0));
  const cov = new THREE.CylinderGeometry(.9, .9, 2.8, 12, 1, false, 0, Math.PI); cov.rotateZ(Math.PI / 2); cov.rotateX(Math.PI / 2); cov.rotateY(Math.PI / 2); cov.scale(1, .7, 1); cov.translate(-.8, 1.55, 0); L.push(V(cov, 0));
  const body = new THREE.Mesh(mergeMat(L), mat); body.castShadow = body.receiveShadow = true; g.add(body);
  return g;
};
/* attack helicopter: userData.rotor (spins on y), userData.tr (tail rotor, spins on z), nav lights */
G.heli = function (mat) {
  const g = new THREE.Group(), L = [];
  const fus = new THREE.LatheGeometry([[0, -1.9], [.38, -1.75], [.62, -1.2], [.7, -.2], [.66, .8], [.5, 1.6], [.25, 2.3], [0, 2.5]].map(p => new THREE.Vector2(p[0], p[1])), 12);
  fus.rotateZ(-Math.PI / 2); fus.scale(1, 1.12, .82); L.push(V(fus, 0));
  const can = new THREE.SphereGeometry(.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); can.scale(1.9, .8, .62); can.translate(.75, .48, 0); L.push(V(can, 5));
  const boom = new THREE.CylinderGeometry(.14, .3, 3.6, 8); boom.rotateZ(Math.PI / 2); boom.translate(-3.6, .25, 0); L.push(V(boom, 0));
  const fin = G.profile([[-5.6, .2], [-5.0, .2], [-5.2, 1.5], [-5.65, 1.55]], .1, .02); L.push(V(fin, 0));
  const stab = G.rbox(.6, .05, 1.6, .02, 1); stab.translate(-4.9, .3, 0); L.push(V(stab, 0));
  [1, -1].forEach(s => {
    const w = G.rbox(.7, .08, 1.3, .03, 1); w.translate(-.1, -.05, s * .95); L.push(V(w, 0));
    /* rocket pod on a pylon under the stub wing */
    const pyl = G.rbox(.42, .12, .06, .02, 1); pyl.translate(.05, -.13, s * 1.45); L.push(V(pyl, 2, 0, [.12, .12, .12]));
    const pod = new THREE.CylinderGeometry(.2, .2, 1.1, 10); pod.rotateZ(Math.PI / 2); pod.translate(.05, -.36, s * 1.45); L.push(V(pod, 2, 0, [.14, .14, .13]));
    /* skids on two cross struts each, bolted to the belly */
    const sk = G.rbox(2.4, .07, .07, .03, 1); sk.translate(.1, -.95, s * .62); L.push(V(sk, 2, 0, [.12, .12, .12]));
    [.75, -.55].forEach(x => L.push(V(G.beam(new THREE.Vector3(x, -.95, s * .62), new THREE.Vector3(x, -.5, s * .3), .06), 2, 0, [.12, .12, .12])));
  });
  /* chin turret: a ball under the nose and its gun */
  const ball = new THREE.SphereGeometry(.17, 8, 6); ball.translate(2.05, -.36, 0); L.push(V(ball, 2, 0, [.1, .1, .1]));
  const gun = new THREE.CylinderGeometry(.04, .04, .8, 6); gun.rotateZ(Math.PI / 2); gun.translate(2.55, -.4, 0); L.push(V(gun, 2, 0, [.1, .1, .1]));
  const band = G.rbox(1.0, .14, 1.12, .03, 1); band.translate(-1.2, .1, 0); L.push(V(band, 4));
  const body = new THREE.Mesh(mergeMat(L), mat); body.castShadow = true; g.add(body);
  const rotor = new THREE.Group(); rotor.position.set(.1, 1.0, 0);
  const R4 = []; const hub = new THREE.CylinderGeometry(.18, .22, .3, 8); R4.push(V(hub, 2, 0, [.1, .1, .1]));
  for (let i = 0; i < 4; i++) { const b = G.rbox(4.2, .03, .26, .012, 1); b.translate(2.15, .12, 0); b.rotateY(i * Math.PI / 2); R4.push(V(b, 2, 0, [.08, .08, .08])); }
  rotor.add(new THREE.Mesh(mergeMat(R4), mat));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.3, 32), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = .12; rotor.add(disc); g.add(rotor);
  const tr = new THREE.Group(); tr.position.set(-5.45, 1.05, .14);
  const T2 = []; for (let i = 0; i < 2; i++) { const b = G.rbox(.07, 1.3, .02, .01, 1); b.rotateZ(i * Math.PI / 2); T2.push(V(b, 2, 0, [.08, .08, .08])); }
  tr.add(new THREE.Mesh(mergeMat(T2), mat)); g.add(tr);
  g.userData.rotor = rotor; g.userData.tr = tr; g.userData.nav = G.navLights(g, [[-.1, -.05, 1.6, 0xff3030], [-.1, -.05, -1.6, 0x30ff60], [-5.6, 1.6, 0, 0xffffff]]);
  return g;
};
/* attack jet (big=true → flying-wing bomber) */
G.jet = function (mat, big) {
  const g = new THREE.Group(), L = [];
  if (!big) {
    const fus = new THREE.LatheGeometry([[0, -3.0], [.4, -3.0], [.42, -2.9], [.55, -1.5], [.6, .6], [.48, 2.0], [.22, 3.0], [0, 3.55]].map(p => new THREE.Vector2(p[0], p[1])), 14);
    fus.rotateZ(-Math.PI / 2); fus.scale(1, .9, 1.05); L.push(V(fus, 0));
    const can = new THREE.SphereGeometry(.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); can.scale(2.4, .75, .75); can.translate(1.55, .38, 0); L.push(V(can, 5));
    const wing = plan([[-.9, 0], [1.1, 0], [-1.6, 3.7], [-2.35, 3.7]], .1, .02); const w2 = plan([[-.9, 0], [1.1, 0], [-1.6, -3.7], [-2.35, -3.7]], .1, .02);
    [wing, w2].forEach(w => { w.translate(0, -.12, 0); L.push(V(w, 0)); });
    const st = plan([[-2.4, 0], [-1.7, 0], [-2.9, 1.5], [-3.3, 1.5]], .07, .015); const st2 = plan([[-2.4, 0], [-1.7, 0], [-2.9, -1.5], [-3.3, -1.5]], .07, .015); [st, st2].forEach(w => L.push(V(w, 0)));
    [.42, -.42].forEach(z => { const fn = G.profile([[-3.0, .3], [-2.1, .3], [-2.7, 1.75], [-3.15, 1.8]], .07, .015); fn.rotateX(z > 0 ? -.22 : .22); fn.translate(0, 0, z); L.push(V(fn, 0)); });
    /* the nozzle sits on the fuselage's flat tail; the afterburner glows at the bottom of it */
    const noz = new THREE.CylinderGeometry(.42, .38, .5, 12, 1, true); noz.rotateZ(Math.PI / 2); noz.translate(-3.25, 0, 0); L.push(V(noz, 2, 0, [.1, .1, .1]));
    const ab = new THREE.CircleGeometry(.38, 12); ab.rotateY(-Math.PI / 2); ab.translate(-3.02, 0, 0); L.push(V(ab, 6));
    const band = G.rbox(.9, .02, 1.6, .01, 1); band.translate(-1.2, -.08, 2.3); L.push(V(band, 4)); const b2 = band.clone(); b2.translate(0, 0, -4.6); L.push(V(b2, 4));
    /* wing missiles hang on pylons */
    const ms = new THREE.CylinderGeometry(.09, .09, 1.4, 6); ms.rotateZ(Math.PI / 2); [1.4, -1.4].forEach(z => { const m2 = ms.clone(); m2.translate(-.6, -.3, z); L.push(V(m2, 2, 0, [.85, .85, .82])); const py = G.rbox(.6, .14, .05, .02, 1); py.translate(-.6, -.17, z); L.push(V(py, 2, 0, [.12, .12, .12])); });
  } else {
    const w = plan([[3.2, 0], [-1.0, 7.8], [-2.0, 7.4], [-1.5, 5.2], [-2.6, 3.2], [-2.1, 1.4], [-2.7, 0], [-2.1, -1.4], [-2.6, -3.2], [-1.5, -5.2], [-2.0, -7.4], [-1.0, -7.8]], .55, .2);
    w.translate(0, -.2, 0); L.push(V(w, 0));
    const hump = new THREE.SphereGeometry(1.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); hump.scale(2.2, .55, .9); hump.translate(.6, .3, 0); L.push(V(hump, 0));
    const can = new THREE.SphereGeometry(.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); can.scale(1.6, .5, 1.2); can.translate(2.0, .45, 0); L.push(V(can, 5));
    [1.6, -1.6, 3.0, -3.0].forEach(z => { const n = new THREE.CylinderGeometry(.32, .38, 1.4, 10); n.rotateZ(Math.PI / 2); n.translate(-1.0, .28, z); L.push(V(n, 0)); const ab = new THREE.CircleGeometry(.27, 10); ab.rotateY(-Math.PI / 2); ab.translate(-1.71, .28, z); L.push(V(ab, 6)); });
    const band = G.rbox(1.2, .02, 2.0, .01, 1); band.translate(-.8, .2, 5.0); L.push(V(band, 4)); const b2 = band.clone(); b2.translate(0, 0, -10); L.push(V(b2, 4));
  }
  const body = new THREE.Mesh(mergeMat(L), mat); body.castShadow = true; g.add(body);
  g.userData.nav = G.navLights(g, big ? [[-1.2, 0, 7.7, 0xff3030], [-1.2, 0, -7.7, 0x30ff60]] : [[-2.0, -.1, 3.7, 0xff3030], [-2.0, -.1, -3.7, 0x30ff60], [-3.0, 1.8, .42, 0xffffff]]);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color: 0xff9a40, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .9 }));
  glow.scale.set(big ? 2.2 : 2.6, big ? 2.2 : 2.6, 1); glow.position.set(big ? -1.9 : -3.6, big ? .28 : 0, 0); g.add(glow); g.userData.ab = glow;
  return g;
};
G.navLights = function (g, list) {
  return list.map(([x, y, z, c]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(x, y, z); s.scale.setScalar(.9); g.add(s); return s;
  });
};

/* ------------------------------------------------------------------ HQ compound (one per army) */
G.hq = function (team, mat, dir) {
  /* built facing its own army's front: m = +1 when the field lies towards +x (bulls), -1 when it lies towards -x (bears); the group is never turned */
  const g = new THREE.Group(), L = [], m = dir < 0 ? 1 : -1;
  const bk = G.profile([[-4.5, 0], [4.5, 0], [4.5, 2.4], [3.2, 3.3], [-3.2, 3.3], [-4.5, 2.4]], 7, .25); L.push(V(bk, 0));
  const door = G.rbox(.12, 1.7, 1.8, .05, 1); door.translate(m * 4.52, .9, 0); L.push(V(door, 2, 0, [.08, .08, .08]));      // the door looks onto the gate
  const slit = G.rbox(.1, .28, 4.8, .05, 1); slit.translate(m * 4.4, 2.05, 0); L.push(V(slit, 5));
  const stripe = G.rbox(9.2, .3, .04, .02, 1); stripe.translate(0, 2.7, 3.52); L.push(V(stripe, 4)); const s2 = stripe.clone(); s2.translate(0, 0, -7.04); L.push(V(s2, 4));
  /* mast */
  for (let i = 0; i < 3; i++) { const leg = new THREE.CylinderGeometry(.05, .08, 9, 4); const a = i * 2.094; leg.translate(-2.4 * m + Math.cos(a) * .35, 7.7, -2 + Math.sin(a) * .35); L.push(V(leg, 2, 0, [.25, .25, .25])); }
  for (let k = 0; k < 6; k++) { const r = new THREE.TorusGeometry(.35, .03, 3, 9); r.rotateX(Math.PI / 2); r.translate(-2.4 * m, 3.8 + k * 1.4, -2); L.push(V(r, 2, 0, [.25, .25, .25])); }   // the rings run through the three legs
  const cap = new THREE.CylinderGeometry(.42, .42, .07, 9); cap.translate(-2.4 * m, 12.2, -2); L.push(V(cap, 2, 0, [.25, .25, .25]));
  const lamp = new THREE.SphereGeometry(.16, 8, 6); lamp.translate(-2.4 * m, 12.36, -2); L.push(V(lamp, 6));
  /* tents with team roofs */
  [[-1, 8.5, 1], [1, 8.5, -1]].forEach(([s, z, k]) => {
    /* a ridge tent: triangular section (ridge up, both eaves on the ground), the team-coloured fly on its two upper faces */
    const tx = s * 2.2 * m, t = new THREE.CylinderGeometry(1.6, 1.6, 3.6, 3, 1); t.rotateX(-Math.PI / 2); t.scale(1, .85, 1); t.translate(tx, .68, z * k); L.push(V(t, 0));
    const hw = 1.6 * .866, ht = 1.6 * 1.5 * .85, sl = Math.atan2(ht, hw), fl = Math.hypot(hw, ht);
    [1, -1].forEach(sd => { const f = new THREE.BoxGeometry(fl * .5, .04, 3.7); f.rotateZ(-sd * sl); f.translate(tx + sd * (hw * .25 + .02 * Math.sin(sl)), ht * .75 + .02 * Math.cos(sl), z * k); L.push(V(f, 4)); });
  });
  /* fuel tanks behind the bunker, on saddles */
  [[-5.7, -2], [-7.2, -2]].forEach(([x, z]) => { const xx = x * m, c = new THREE.CylinderGeometry(.7, .7, 2.4, 12); c.rotateX(Math.PI / 2); c.translate(xx, .84, z); L.push(V(c, 0));
    [-.7, .7].forEach(dz => { const sd = G.rbox(.9, .3, .22, .03, 1); sd.translate(xx, .15, z + dz); L.push(V(sd, 2, 0, [.22, .22, .2])); }); });
  const body = new THREE.Mesh(mergeMat(L), mat); body.castShadow = body.receiveShadow = true; g.add(body);
  /* radar dish (rotates): a solid shell on an arm from the post, high enough that its rim clears the roof as it turns */
  const rad = new THREE.Group(); rad.position.set(2.4 * m, 3.3, -2.2);
  const RL = G.dishGeo([[0, 0], [.4, .05], [.9, .22], [1.3, .5]], .05, 18).map((d, i) => { d.rotateZ(Math.PI / 2); d.translate(-.3, 1.6, 0); return V(d, 2, 0, i === 0 ? [.62, .64, .62] : i === 1 ? [.12, .12, .12] : [.3, .3, .3]); });
  const post = new THREE.CylinderGeometry(.08, .12, 1.7, 6); post.translate(0, .85, 0); RL.push(V(post, 2, 0, [.3, .3, .3]));
  const arm = G.rbox(.34, .14, .14, .03, 1); arm.translate(-.13, 1.6, 0); RL.push(V(arm, 2, 0, [.3, .3, .3]));
  rad.add(new THREE.Mesh(mergeMat(RL), mat)); g.add(rad); g.userData.radar = rad;
  /* its footprint, local to the group (unscaled): bunker, tents, tanks, flag pole — for the ground navigation */
  g.userData.foot = [{ t: 'b', x: 0, z: 0, hx: 4.75, hz: 3.75 }, { t: 'b', x: -2.2 * m, z: 8.5, hx: 1.45, hz: 1.85 }, { t: 'b', x: 2.2 * m, z: -8.5, hx: 1.45, hz: 1.85 }, { t: 'b', x: -6.45 * m, z: -2, hx: 1.5, hz: 1.25 }, { t: 'c', x: 0, z: 4.8, r: .2 }];
  g.userData.door = [m * 5.3, 0];
  return g;
};

/* ------------------------------------------------------------------ particles
   Two point systems: "soft" (normal blending: smoke, dust, debris, contrails, mushroom cloud) and
   "glow" (additive: sparks, embers, flipbook fire). Same spawn API as 2.0. */
G.particleSystem = function (N, glow, PU) {
  const g = new THREE.BufferGeometry();
  const mk = (n, s) => { const a = new THREE.BufferAttribute(new Float32Array(N * s), s); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); return a; };
  const S = { N, i: 0, dirty: false, aPos: mk('position', 3), aVel: mk('aVel', 3), aT: mk('aT', 2), aS: mk('aS', 2) };
  for (let i = 0; i < N; i++) S.aT.setXY(i, -100, 1);
  const vs = `attribute vec3 aVel;attribute vec2 aT;attribute vec2 aS;uniform float uTime,uPR,uWind;varying float vA;varying vec3 vC;varying float vF;varying float vRot;varying float vTy;
void main(){float age=uTime-aT.x;float f=age/aT.y;float ty=aS.y;vec3 p=position;vTy=ty;if(age<0.||f>1.){gl_Position=vec4(0.,0.,2.,1.);gl_PointSize=0.;vA=0.;vC=vec3(0.);vF=1.;vRot=0.;return;}
float rs=fract(sin(dot(position.xz+aT.xx,vec2(12.9898,78.233)))*43758.5453);vRot=rs*6.2831+age*(rs-.5)*.9;float sz=aS.x;
if(ty==0.){p+=aVel*age*(1.-f*.55)+vec3(uWind*age*2.2,age*age*.55,0.);vC=mix(vec3(.42,.39,.36),vec3(.16,.15,.15),f*.8);vA=(1.-f)*(1.-f)*.62;sz*=1.+f*2.4;}
else if(ty==2.){p+=aVel*age+vec3(uWind*age*8.,age*.35,0.);vC=vec3(.62,.54,.42);vA=(1.-f)*.3*min(1.,age*2.5);sz*=1.+f*1.6;}
else if(ty==3.){p+=aVel*age+vec3(0.,-9.8*.5*age*age,0.);p.y=max(p.y,.12);vC=vec3(.11,.1,.09);vA=1.-f*f;}
else if(ty==4.){p+=aVel*age+vec3(uWind*age*1.4,age*age*.18,0.);vC=mix(vec3(.96),vec3(.7,.7,.72),f);vA=(1.-f)*.42;sz*=1.+f*1.8;}
else if(ty==5.){p+=aVel*age*(1.-f*.35)+vec3(uWind*age,age*age*1.6,0.);vC=mix(vec3(.5,.35,.24),vec3(.42,.4,.38),f);vA=(1.-f)*.72;sz*=1.+f*1.9;}
else if(ty==1.){p+=aVel*age+vec3(0.,-9.8*.5*age*age,0.);p.y=max(p.y,.1);vC=mix(vec3(1.,.92,.6),vec3(1.,.35,.06),min(1.,f*1.8))*2.2;vA=1.-f;}
else if(ty==6.){p+=aVel*age+vec3(uWind*age*1.5,age*.9,0.);vC=vec3(1.,.5,.15)*1.8;vA=(1.-f)*(.6+.4*sin(age*30.+rs*20.));}
else{p+=aVel*age*(1.-f*.5)+vec3(uWind*age,age*age*.8,0.);vC=vec3(1.);vA=1.-f*f*.6;sz*=.7+f*1.1;}
vF=f;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=uPR*sz*(300./max(1.,-mv.z));gl_Position=projectionMatrix*mv;}`;
  const fsSoft = `uniform sampler2D uTex;uniform vec3 uLight,uAmb;varying float vA;varying vec3 vC;varying float vF;varying float vRot;varying float vTy;
void main(){vec2 c=gl_PointCoord-.5;float s=sin(vRot),k=cos(vRot);vec2 r=vec2(k*c.x-s*c.y,s*c.x+k*c.y)+.5;float a=texture2D(uTex,r).a*vA;if(a<.008)discard;
float top=.55+.45*(.5-c.y)*1.6;vec3 col=vC*(uAmb+uLight*top);gl_FragColor=vec4(col,a);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;
  const fsGlow = `uniform sampler2D uTex,uFire;varying float vA;varying vec3 vC;varying float vF;varying float vRot;varying float vTy;
void main(){vec2 c=gl_PointCoord-.5;if(vTy>6.5){float s=sin(vRot),k=cos(vRot);vec2 r=vec2(k*c.x-s*c.y,s*c.x+k*c.y)+.5;float fr=floor(min(15.,vF*16.));vec2 o=vec2(mod(fr,4.),3.-floor(fr/4.))*.25;vec4 t=texture2D(uFire,o+clamp(r,.01,.99)*.25);
 float a=t.a*vA;if(a<.01)discard;gl_FragColor=vec4(t.rgb*a*1.6,a);}
else{float a=texture2D(uTex,gl_PointCoord).a*vA;if(a<.01)discard;gl_FragColor=vec4(vC*a,a);}
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;
  const m = new THREE.ShaderMaterial({
    uniforms: glow ? { uTime: PU.uTime, uPR: PU.uPR, uWind: PU.uWind, uTex: { value: G.glowTex() }, uFire: { value: G.fireAtlas() } }
                   : { uTime: PU.uTime, uPR: PU.uPR, uWind: PU.uWind, uTex: { value: G.puffTex() }, uLight: PU.uLight, uAmb: PU.uAmb },
    vertexShader: vs, fragmentShader: glow ? fsGlow : fsSoft, transparent: true, depthWrite: false,
    blending: glow ? THREE.CustomBlending : THREE.NormalBlending
  });
  if (glow) { m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation; }
  S.points = new THREE.Points(g, m); S.points.frustumCulled = false; S.points.renderOrder = glow ? 6 : 5;
  S.spawn = function (ty, x, y, z, vx, vy, vz, life, size) { const i = this.i; this.i = (i + 1) % this.N; this.aPos.setXYZ(i, x, y, z); this.aVel.setXYZ(i, vx, vy, vz); this.aT.setXY(i, PU.uTime.value, life); this.aS.setXY(i, size, ty); this.dirty = true; };
  S.flush = function () { if (!this.dirty) return; this.dirty = false; this.aPos.needsUpdate = this.aVel.needsUpdate = this.aT.needsUpdate = this.aS.needsUpdate = true; };
  return S;
};

/* ------------------------------------------------------------------ ground decals (scorch marks), pooled */
G.decals = function (scene, n, hgtFn) {
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: G.scorchTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 1 });
  const op = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(0), 1); op.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aOp', op);
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float aOp;varying float vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOp=aOp;');
    sh.fragmentShader = 'varying float vOp;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a*=vOp;');
  };
  const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.count = n; mesh.frustumCulled = false; mesh.renderOrder = 1;
  const d = new THREE.Object3D(); d.scale.setScalar(0); d.updateMatrix(); for (let i = 0; i < n; i++) mesh.setMatrixAt(i, d.matrix);
  scene.add(mesh);
  const L = []; let k = 0;
  return {
    mesh,
    add(x, z, r) {
      const i = k; k = (k + 1) % n; d.position.set(x, hgtFn(x, z) + .06, z); d.rotation.set(0, Math.random() * 6.28, 0); d.scale.set(r * 2, 1, r * 2); d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix); mesh.instanceMatrix.needsUpdate = true; L[i] = { t: 0, life: 70 + Math.random() * 40 }; op.setX(i, .95); op.needsUpdate = true;
    },
    tick(dt) { let ch = false; for (let i = 0; i < n; i++) { const o = L[i]; if (!o) continue; o.t += dt; const a = o.t > o.life ? 0 : .95 * (1 - Math.max(0, (o.t - o.life * .6) / (o.life * .4))); if (Math.abs(op.getX(i) - a) > .01) { op.setX(i, a); ch = true; } if (a <= 0) L[i] = null; } if (ch) op.needsUpdate = true; },
    clear() { for (let i = 0; i < n; i++) { L[i] = null; op.setX(i, 0); } op.needsUpdate = true; }
  };
};

/* ------------------------------------------------------------------ post-processing */
G.GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 1 }, uSat: { value: 1.05 }, uCon: { value: 1.06 }, uTime: { value: 0 }, uGrain: { value: .025 }, uFlash: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3(0, 0, 0) } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uVig,uSat,uCon,uTime,uGrain,uFlash;uniform vec3 uTint,uLift;varying vec2 vUv;
void main(){vec4 c=texture2D(tDiffuse,vUv);vec3 col=c.rgb*uTint+uLift;float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,uSat);col=max(vec3(0.),(col-.18)*uCon+.18);
vec2 d=vUv-.5;d.x*=1.25;col*=1.-smoothstep(.42,1.2,length(d)*uVig)*.85;
float n=fract(sin(dot(vUv*vec2(12.9898,78.233)+fract(uTime*.37),vec2(1.,1.)))*43758.5453);col+=(n-.5)*uGrain*(.35+l);
col=mix(col,vec3(1.,.96,.9),uFlash);gl_FragColor=vec4(col,c.a);}`
};
G.post = function (ren, scene, cam, tier) {
  const cfg = G.TIERS[tier];
  if (!cfg.post || !THREE.EffectComposer || !THREE.ShaderPass) return null;
  const C = new THREE.EffectComposer(ren);
  const rp = new THREE.RenderPass(scene, cam); C.addPass(rp);
  let bloom = null;
  if (cfg.bloom && THREE.UnrealBloomPass) { const s = ren.getSize(new THREE.Vector2()); bloom = new THREE.UnrealBloomPass(new THREE.Vector2(s.x / 2, s.y / 2), .55, .55, .8); C.addPass(bloom); }
  const tiltH = THREE.HorizontalTiltShiftShader && tier !== 'low' ? new THREE.ShaderPass(THREE.HorizontalTiltShiftShader) : null;
  const tiltV = THREE.VerticalTiltShiftShader && tier !== 'low' ? new THREE.ShaderPass(THREE.VerticalTiltShiftShader) : null;
  if (tiltH) { tiltH.enabled = tiltV.enabled = false; tiltH.uniforms.r.value = tiltV.uniforms.r.value = .52; C.addPass(tiltH); C.addPass(tiltV); }
  const grade = new THREE.ShaderPass(G.GradeShader); C.addPass(grade);
  const gamma = new THREE.ShaderPass(THREE.GammaCorrectionShader); C.addPass(gamma);
  let fxaa = null; if (cfg.fxaa && THREE.FXAAShader) { fxaa = new THREE.ShaderPass(THREE.FXAAShader); C.addPass(fxaa); }
  const P = {
    C, rp, bloom, grade, fxaa, tiltH, tiltV,
    size(w, h) {
      C.setSize(w, h); const pr = ren.getPixelRatio();
      if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
      if (tiltH) { tiltH.uniforms.h.value = 1 / (w * pr) * 2.2; tiltV.uniforms.v.value = 1 / (h * pr) * 2.2; }
    },
    tilt(on, amt) { if (!tiltH) return; tiltH.enabled = tiltV.enabled = on; if (on) { const pr = ren.getPixelRatio(), s = ren.getSize(new THREE.Vector2()); tiltH.uniforms.h.value = amt / (s.x * pr); tiltV.uniforms.v.value = amt / (s.y * pr); } },
    render(c, dt) { rp.camera = c; C.render(dt); }
  };
  return P;
};
})();
