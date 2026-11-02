/* entekhab.net — Bitcoin Battlefield 4.0 kit (three.js r128, loaded after gfx3.js and before battle.js)
   Environment: extended bases, watchtowers, comm arrays, SAM sites, ballistic-missile launchers, container yard,
   radar dome, ammo dump, ruined village, two lakes, an asphalt road with markings, street lamps, burnt-out wrecks.
   Atmosphere: ground mist, haze rings, light shafts, searchlight and lamp beams, window glow at night.
   Air layer: recon drones, cruise and ballistic missiles with ribbon trails, SAM interceptors, jet formations.
   Sound: missile / cruise / sonic-boom / intercept designs and radio voice call-outs.
   Graphics helpers only; battle.js objects (scene, FX, AUDIO, ARMY, WORLD, DIRECTOR …) are read at run time. */
(function () {
'use strict';
const G = window.GFX, K = window.GFX4 = {};
const TAU = Math.PI * 2;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rr = (a, b) => a + Math.random() * (b - a);
let seed = 4242;
const srand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const sr = (a, b) => a + srand() * (b - a);
const roadZ = x => 2 * Math.sin(x * .035);
K.roadZ = roadZ;

/* ---------------------------------------------------------------- layout (metres; bulls x<0, bears x>0, background = -z) */
const LAY = K.LAY = {
  lakes: [{ x: -86, z: -55, rx: 15, rz: 9, d: 1.8, rot: .25, w: null }, { x: 91, z: -52, rx: 17, rz: 10, d: 1.8, rot: -.35, w: null }],
  pads: [], items: []
};
function item(k, x, z, rot, side, r) { LAY.items.push({ k, x, z, rot: rot || 0, side }); if (r) LAY.pads.push({ x, z, r, h: null }); }
[-1, 1].forEach(m => {
  const side = m < 0 ? 'bull' : 'bear', face = m < 0 ? 0 : Math.PI;      // structures face the battlefield
  item('sam', 18 * m, -56, face, side, 6);
  item('tel', 26 * m, -68, face, side, 6.5);
  item('tel', 39 * m, -73, face, side, 6.5);
  item('tower', 64 * m, -47, face, side, 3.4);
  item('tower', 9 * m, -49, face, side, 3.4);
  item('tower', 95 * m, -26, face, side, 3.4);
  item('tower', 95 * m, 27, face, side, 3.4);
  item('barracks', 109 * m, -9, Math.PI / 2, side, 10);
  item('barracks', 109 * m, 13, Math.PI / 2, side, 10);
  item('hangar', 125 * m, -34, face, side, 12);
  item('helipad', 117 * m, 38, 0, side, 8.5);
  item('lamp', 0, 0, 0, side, 0);
});
item('comm', -42, -59, 0, 'bull', 6); item('dump', -56, -68, .2, 'bull', 8);
item('comm', 29, -59, 0, 'bear', 4.5); item('dome', 44, -61, 0, 'bear', 7); item('yard', 59, -69, -.12, 'bear', 11);
item('ruin', -10, -79, .2, 'n', 6); item('ruin', 3, -86, -.3, 'n', 6); item('ruin', 14, -78, .55, 'n', 6); item('ruin', -2, -96, 0, 'n', 6);
item('wreck', -24, -22, .7, 'n', 0); item('wreck', 21, 25, 2.2, 'n', 0); item('wreck', 37, -12, -.9, 'n', 0);
LAY.items = LAY.items.filter(i => i.k !== 'lamp');

/* lake shape: rotated ellipse with a noisy shoreline; e < 1 is (roughly) water */
function lakeE(l, x, z) {
  const dx = x - l.x, dz = z - l.z, c = Math.cos(l.rot), s = Math.sin(l.rot);
  const u = (dx * c - dz * s) / l.rx, v = (dx * s + dz * c) / l.rz;
  return Math.hypot(u, v) * (1 + .13 * (G.fbmW ? G.fbmW(x * .09 + 3, z * .09 - 7, 2) : 0));
}
/* terrain modifier: flat pads under structures, lake basins with a flat shore band */
K.terrainMod = function (raw) {
  return function (x, z) {
    let h = raw(x, z);
    for (const p of LAY.pads) {
      const dx = x - p.x, dz = z - p.z, R = p.r + 5;
      if (dx > R || dx < -R || dz > R || dz < -R) continue;
      if (p.h === null) p.h = raw(p.x, p.z) + .04;
      h = mix(h, p.h, sm(R, p.r, Math.hypot(dx, dz)));
    }
    for (const l of LAY.lakes) {
      const e = lakeE(l, x, z); if (e > 1.95) continue;
      if (l.w === null) l.w = raw(l.x, l.z);
      const shore = l.w + .45, T = mix(l.w - l.d, shore, sm(.5, 1.1, e));
      h = mix(h, T, sm(1.95, 1.25, e));
    }
    return h;
  };
};
/* footprint test used by battle.js flora placement (no trees inside buildings or lakes) */
K.blocked = function (x, z, pad) {
  pad = pad || 2;
  for (const p of LAY.pads) { const dx = x - p.x, dz = z - p.z, R = p.r + pad; if (dx * dx + dz * dz < R * R) return true; }
  for (const l of LAY.lakes) if (lakeE(l, x, z) < 1.25) return true;
  if (Math.abs(z - roadZ(x)) < 5 && Math.abs(x) < 94) return true;
  return false;
};

/* ---------------------------------------------------------------- shared textures */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function tnoise(size, per, oct, sd) {          // tileable value-noise fbm in 0..1
  const N = new Float32Array(size * size), lat = [];
  for (let o = 0; o < oct; o++) { const p = per << o, a = new Float32Array(p * p); for (let i = 0; i < a.length; i++) a[i] = srand(); lat.push([p, a]); }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = .5, tot = 0;
    for (let o = 0; o < oct; o++) {
      const [p, a] = lat[o], fx = x / size * p, fy = y / size * p, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const u = tx * tx * (3 - 2 * tx), w = ty * ty * (3 - 2 * ty), g = (i, j) => a[((j % p) + p) % p * p + ((i % p) + p) % p];
      v += amp * mix(mix(g(ix, iy), g(ix + 1, iy), u), mix(g(ix, iy + 1), g(ix + 1, iy + 1), u), w); tot += amp; amp *= .5;
    }
    N[y * size + x] = v / tot;
  }
  return N;
}
let _mist = null, _glow = null, _road = null;
K.mistTex = function () {
  if (_mist) return _mist;
  const S = 256, c = canvas(S), x = c.getContext('2d'), im = x.createImageData(S, S), n = tnoise(S, 4, 5, 1);
  for (let i = 0; i < S * S; i++) { const px = i % S, py = (i / S) | 0, ex = Math.min(px, S - px, py, S - py) / (S * .5); const v = cl((n[i] - .38) * 2.4, 0, 1) * Math.pow(cl(ex * 1.25, 0, 1), 1.4); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v * 255; im.data[i * 4 + 3] = 255; }   // alphaMap reads the green channel
  x.putImageData(im, 0, 0); _mist = new THREE.CanvasTexture(c); return _mist;
};
K.glowTex = function () { if (!_glow) _glow = G.glowTex(); return _glow; };
K.roadTex = function () {                       // asphalt with edge lines and a dashed centre line; 1 repeat = 9 m
  if (_road) return _road;
  const W = 512, H = 128, c = canvas(W, H), x = c.getContext('2d'), n = tnoise(128, 8, 4, 3);
  const im = x.createImageData(W, H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const v = n[(py % 128) * 128 + (px % 128)], k = 64 + v * 30 + (Math.random() * 10), i = (py * W + px) * 4;
    im.data[i] = k; im.data[i + 1] = k; im.data[i + 2] = k + 2; im.data[i + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  x.fillStyle = 'rgba(232,230,220,.92)'; x.fillRect(0, H * .07, W, H * .045); x.fillRect(0, H * .885, W, H * .045);
  x.fillStyle = 'rgba(236,214,120,.95)'; x.fillRect(0, H * .48, W * .333, H * .04);           // 3 m dash, 6 m gap
  x.globalAlpha = .18; x.fillStyle = '#000'; for (let i = 0; i < 26; i++) { x.beginPath(); x.ellipse(Math.random() * W, H * (.25 + Math.random() * .5), 18 + Math.random() * 40, 3 + Math.random() * 5, 0, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  _road = new THREE.CanvasTexture(c); _road.wrapS = THREE.RepeatWrapping; _road.wrapT = THREE.ClampToEdgeWrapping; _road.encoding = THREE.sRGBEncoding;
  _road.anisotropy = G.aniso || 1; return _road;
};

/* ---------------------------------------------------------------- materials */
const FOGU = () => THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
const TAIL = '\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}';
/* volumetric beam: bright where the cone faces the camera, soft at the silhouette; SHAFT = sun shafts (fade both ends) */
K.beamMaterial = function (col, shaft) {
  const u = Object.assign(FOGU(), { uCol: { value: G.lin(col) }, uInt: { value: 0 }, uTime: { value: 0 } });
  return new THREE.ShaderMaterial({
    uniforms: u, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    defines: shaft ? { SHAFT: 1 } : {},
    vertexShader: 'varying vec3 vN;varying vec3 vV;varying float vY;varying float vD;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vY=uv.y;vD=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uCol;uniform float uInt,uTime,fogNear,fogFar;varying vec3 vN;varying vec3 vV;varying float vY;varying float vD;void main(){float f=abs(dot(normalize(vN),normalize(vV)));\n#ifdef SHAFT\nfloat a=pow(f,2.4);\n#else\nfloat a=pow(f,1.7);\n#endif\n\n#ifdef SHAFT\na*=smoothstep(0.,.55,vY)*(1.-smoothstep(.82,1.,vY))*(.75+.25*sin(uTime*.6+vY*7.));\n#else\na*=pow(vY,1.35)*(.9+.1*sin(uTime*13.));\n#endif\na*=uInt*(1.-smoothstep(fogNear,fogFar*1.15,vD));gl_FragColor=vec4(uCol,a);' + TAIL
  });
};
K.waterMaterial = function () {
  const u = Object.assign(FOGU(), {
    uTime: { value: 0 }, uSky: { value: new THREE.Color(.2, .35, .6) }, uHor: { value: new THREE.Color(.6, .7, .8) }, uDeep: { value: G.lin(0x1d3a3c) },
    uSunDir: { value: new THREE.Vector3(.3, .6, .2) }, uSunCol: { value: new THREE.Color(1, .95, .85) }, uGlint: { value: 1 }
  });
  return new THREE.ShaderMaterial({
    uniforms: u, fog: true, transparent: true, depthWrite: true,
    vertexShader: 'varying vec3 vW;varying float vD;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mv=viewMatrix*w;vD=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float uTime,uGlint,fogNear,fogFar;uniform vec3 fogColor,uSky,uHor,uDeep,uSunDir,uSunCol;varying vec3 vW;varying float vD;' +
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}' +
      'float w(vec2 p,float t){return n(p+vec2(t,t*.7))+.5*n(p*2.3-vec2(t*1.3,t*.4))+.25*n(p*5.1+vec2(t*.6,-t));}' +
      'void main(){vec2 p=vW.xz*.32;float t=uTime*.55,e=.12,a=w(p,t);vec3 N=normalize(vec3((a-w(p+vec2(e,0.),t))*1.1,1.,(a-w(p+vec2(0.,e),t))*1.1));vec3 V=normalize(cameraPosition-vW);' +
      'float fr=.03+.97*pow(1.-max(dot(N,V),0.),5.);vec3 R=reflect(-V,N);vec3 sky=mix(uHor,uSky,clamp(R.y*1.7,0.,1.));vec3 col=mix(uDeep,sky,fr*.78);' +
      'col+=uSunCol*pow(max(dot(R,normalize(uSunDir)),0.),160.)*2.6*uGlint;col=mix(col,fogColor,smoothstep(fogNear,fogFar,vD));gl_FragColor=vec4(col,.93);' + TAIL
  });
};
K.trailMaterial = function () {
  const u = Object.assign(FOGU(), { uCol: { value: new THREE.Color(.55, .55, .55) } });
  return new THREE.ShaderMaterial({
    uniforms: u, fog: true, transparent: true, depthWrite: false,
    vertexShader: 'attribute float aA;attribute float aV;varying float vA;varying float vV;varying float vD;void main(){vA=aA;vV=aV;vec4 mv=modelViewMatrix*vec4(position,1.);vD=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uCol,fogColor;uniform float fogNear,fogFar;varying float vA;varying float vV;varying float vD;void main(){float e=smoothstep(0.,.5,vV)*smoothstep(1.,.5,vV);float a=vA*e;vec3 c=mix(uCol,fogColor,smoothstep(fogNear,fogFar,vD));gl_FragColor=vec4(c,a);' + TAIL
  });
};
const C3 = hex => { const c = new THREE.Color(hex).convertSRGBToLinear(); return [c.r, c.g, c.b]; };
function prim(g, hex, k) {
  const gg = g.index ? g.toNonIndexed() : g, c = C3(hex), kk = k || 1;
  G.paint(gg, () => [c[0] * kk, c[1] * kk, c[2] * kk]); return gg;
}
const B = (w, h, d, x, y, z, hex, k) => prim(G.T(new THREE.BoxGeometry(w, h, d), x, y, z), hex, k);
const CY = (r0, r1, h, seg, x, y, z, hex, open) => prim(G.T(new THREE.CylinderGeometry(r0, r1, h, seg, 1, !!open), x, y, z), hex);
/* ambient occlusion + grime painted into vertex colours (structure-local y, metres) */
function grime(list, top) {
  for (const g of list) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), k = (.6 + .4 * sm(0, 2.4, y)) * (1 + .06 * sm(top * .6, top, y)) * (.93 + .14 * (G.noise ? G.noise(p.getX(i) * .7 + y, p.getZ(i) * .7) : .5));
      c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
    }
  }
  return list;
}
function place(list, x, y, z, rot) { for (const g of list) { g.rotateY(rot); g.translate(x, y, z); } return list; }

/* ---------------------------------------------------------------- structure builders (local: y up from ground, +x faces the battlefield) */
const PAL = {
  bull: { steel: 0x58624b, wall: 0x8f8e86, roof: 0x4a5541, hut: 0x6c7556, dark: 0x2a2d29, trim: 0x6e6d66 },
  bear: { steel: 0x86704f, wall: 0xa68e69, roof: 0x8a7353, hut: 0xa08a62, dark: 0x3a3127, trim: 0x7d6a50 }
};
const WARM = 0xffc27a, GLASS = 0x1a1f24;
let LITE = false;                              // set by K.build: fewer small parts on software renderers
function beamGeo(p, q, t, hex) {               // thin square strut between two points
  const d = new THREE.Vector3().subVectors(q, p), len = d.length(), g = new THREE.BoxGeometry(t, len, t);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())));
  g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2); return prim(g, hex);
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
function bTower(side) {
  const P = PAL[side], L = [], Lt = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(beamGeo(v3(sx * 1.75, 0, sz * 1.75), v3(sx * 1.3, 9.3, sz * 1.3), .24, P.steel));
  for (const y of [2.4, 5.0, 7.6]) {
    const s = 1.75 - y / 9.3 * .45;
    L.push(B(2 * s, .12, .12, 0, y, s, P.steel), B(2 * s, .12, .12, 0, y, -s, P.steel), B(.12, .12, 2 * s, s, y, 0, P.steel), B(.12, .12, 2 * s, -s, y, 0, P.steel));
  }
  L.push(beamGeo(v3(-1.7, .2, 1.7), v3(1.45, 4.9, 1.5), .09, P.steel), beamGeo(v3(1.7, .2, -1.7), v3(-1.45, 4.9, -1.5), .09, P.steel));
  L.push(B(3.9, .26, 3.9, 0, 9.4, 0, P.dark));
  for (const s of [-1, 1]) { L.push(B(3.9, .6, .07, 0, 9.85, s * 1.92, P.steel)); L.push(B(.07, .6, 3.9, s * 1.92, 9.85, 0, P.steel)); }
  L.push(B(3.0, 1.05, 3.0, 0, 10.05, 0, P.hut), B(3.0, .5, 3.0, 0, 11.38, 0, P.hut));
  Lt.push(B(3.04, .72, 3.04, 0, 10.93, 0, WARM));
  L.push(B(3.9, .16, 3.9, 0, 11.7, 0, P.roof));
  const cap = new THREE.ConeGeometry(2.75, .9, 4); cap.rotateY(Math.PI / 4); cap.translate(0, 12.23, 0); L.push(prim(cap, P.roof));
  L.push(B(.07, 9.3, .07, -1.85, 4.65, .34, P.steel), B(.07, 9.3, .07, -1.85, 4.65, -.34, P.steel));
  for (let y = .45; y < 9.2; y += LITE ? 1.5 : .5) L.push(B(.06, .05, .68, -1.85, y, 0, P.steel));
  const head = new THREE.CylinderGeometry(.34, .4, .6, 10); head.rotateZ(Math.PI / 2); head.translate(1.85, 10.62, 0); L.push(prim(head, 0x2b2d2f));
  const lens = new THREE.CylinderGeometry(.3, .3, .05, 10); lens.rotateZ(Math.PI / 2); lens.translate(2.17, 10.62, 0); Lt.push(prim(lens, 0xfff4dc));
  return { L, Lt, top: 12.7, beam: v3(2.2, 10.62, 0) };
}
function bBarracks(side) {
  const P = PAL[side], L = [], Lt = [], bull = side === 'bull';
  L.push(B(14.4, .3, 7.6, 0, .15, 0, P.trim));
  L.push(B(14, 3.0, 7, 0, 1.8, 0, P.wall));
  if (bull) {
    const sh = new THREE.Shape(); sh.moveTo(-3.95, 0); sh.lineTo(3.95, 0); sh.lineTo(0, 1.75); sh.closePath();
    const rf = new THREE.ExtrudeGeometry(sh, { depth: 14.6, bevelEnabled: false }); rf.translate(0, 3.28, -7.3); rf.rotateY(Math.PI / 2); L.push(prim(rf, P.roof));
    L.push(CY(.22, .22, .9, 8, 3.5, 5.0, 0, 0x55585a), CY(.22, .22, .9, 8, -3.5, 5.0, 0, 0x55585a));
  } else {
    L.push(B(14.4, .32, 7.4, 0, 3.46, 0, P.roof));
    for (const s of [-1, 1]) { L.push(B(14.4, .5, .25, 0, 3.86, s * 3.58, P.wall)); L.push(B(.25, .5, 7.4, s * 7.08, 3.86, 0, P.wall)); }
    L.push(CY(1.0, 1.0, 1.5, 12, 4.4, 4.5, -1.2, 0x6d6b62));
  }
  for (let i = 0; i < 6; i++) {
    const x = -5.6 + i * 2.24; if (Math.abs(x) < 1) continue;
    for (const s of [-1, 1]) { Lt.push(B(1.05, .85, .06, x, 2.1, s * 3.52, WARM)); L.push(B(1.25, .1, .14, x, 1.62, s * 3.55, P.trim)); }
  }
  L.push(B(1.0, 2.05, .08, 0, 1.2, 3.54, P.dark), B(1.0, 2.05, .08, 0, 1.2, -3.54, P.dark));
  L.push(B(1.6, .14, 1.2, 0, .3, 4.2, P.trim));
  L.push(B(.9, .7, .6, 6.2, 1.2, 3.85, 0x9a9a96), B(.9, .7, .6, -6.2, 1.2, -3.85, 0x9a9a96));
  Lt.push(B(.3, .2, .2, 0, 2.55, 3.66, 0xfff0c8));
  return { L, Lt, top: bull ? 5.1 : 4.1 };
}
function bHangar(side) {
  const P = PAL[side], L = [], Lt = [], r = 6, len = 16;
  const arc = new THREE.CylinderGeometry(r, r, len, LITE ? 12 : 18, 1, true, -Math.PI / 2, Math.PI); arc.rotateX(-Math.PI / 2); arc.rotateY(Math.PI / 2);
  const c0 = C3(side === 'bull' ? 0x5f6852 : 0x9b8b6b), ga = arc.toNonIndexed();
  G.paint(ga, (x, y, z) => { const a = Math.atan2(y, z), k = .82 + .18 * Math.cos(a * 30); return [c0[0] * k, c0[1] * k, c0[2] * k]; }); L.push(ga);
  const back = new THREE.CircleGeometry(r, 18, 0, Math.PI); back.rotateY(-Math.PI / 2); back.translate(-len / 2, 0, 0); L.push(prim(back, P.trim));
  const back2 = new THREE.CircleGeometry(r, 18, 0, Math.PI); back2.rotateY(Math.PI / 2); back2.translate(-len / 2 + .05, 0, 0); L.push(prim(back2, P.trim));
  const inner = new THREE.CircleGeometry(r * .97, 18, 0, Math.PI); inner.rotateY(Math.PI / 2); inner.translate(len / 2 - .7, 0, 0); L.push(prim(inner, 0x121413));
  L.push(B(12, .12, 14, len / 2 + 6, .06, 0, 0x7a7972));
  for (let i = 0; i < 5; i++) L.push(B(.12, .02, 1.6, len / 2 + 1.5 + i * 2.2, .13, 0, 0xd8c457));
  Lt.push(B(.12, .25, 7, len / 2 - .8, 4.7, 0, 0xfff0d0));
  return { L, Lt, top: 6, park: [v3(len / 2 + 5, 0, 3.4), v3(len / 2 + 5, 0, -3.4)] };
}
function bHelipad() {
  const L = [], Lt = [];
  L.push(CY(7.4, 7.7, .18, 30, 0, .09, 0, 0x77766f));
  L.push(B(.5, .02, 4.2, -1.1, .19, 0, 0xdedbd0), B(.5, .02, 4.2, 1.1, .19, 0, 0xdedbd0), B(2.2, .02, .5, 0, .19, 0, 0xdedbd0));
  const ring = new THREE.RingGeometry(5.5, 5.85, 40); ring.rotateX(-Math.PI / 2); ring.translate(0, .19, 0); L.push(prim(ring, 0xd6b23e));
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; Lt.push(B(.22, .14, .22, Math.cos(a) * 7.1, .26, Math.sin(a) * 7.1, 0x7dff9a)); }
  return { L, Lt, top: 1 };
}
function bSam(side) {
  const P = PAL[side], L = [], Lt = [];
  L.push(B(6.2, .9, 2.4, 0, 1.15, 0, P.steel), B(1.2, .5, 2.0, -3.5, .9, 0, P.dark));
  for (const x of [-1.8, -.6]) for (const z of [-1.25, 1.25]) { const w = new THREE.CylinderGeometry(.55, .55, .4, 12); w.rotateX(Math.PI / 2); w.translate(x, .55, z); L.push(prim(w, 0x161616)); }
  L.push(CY(1, 1.05, .35, 14, .4, 1.78, 0, P.dark));
  const box = new THREE.BoxGeometry(3.8, 1.5, 2.1); box.rotateZ(.66); box.translate(.55, 3.0, 0); L.push(prim(box, P.steel));
  for (const z of [-.5, .5]) for (const y of [-.35, .35]) { const t = new THREE.CylinderGeometry(.27, .27, .06, 10); t.rotateZ(.66 - Math.PI / 2); t.translate(.55 + Math.cos(.66) * 1.92 - Math.sin(.66) * y, 3.0 + Math.sin(.66) * 1.92 + Math.cos(.66) * y, z); L.push(prim(t, 0x101010)); }
  L.push(CY(.08, .1, 2.6, 6, -2.2, 2.6, 0, P.dark));
  const pnl = new THREE.BoxGeometry(.14, 1.3, 1.9); pnl.rotateZ(-.25); pnl.translate(-2.2, 4.1, 0); L.push(prim(pnl, 0xbdbdb4));
  Lt.push(B(.12, .12, .12, -2.2, 4.85, 0, 0xff4a2a));
  return { L, Lt, top: 5, tip: v3(.55 + Math.cos(.66) * 2.1, 3.0 + Math.sin(.66) * 2.1, 0) };
}
function bTelBase(side) {
  const P = PAL[side], L = [], Lt = [];
  L.push(B(9.2, 1.0, 2.7, 0, 1.25, 0, P.steel), B(2.2, 1.75, 2.7, 3.6, 2.45, 0, P.hut), B(.06, .66, 2.2, 4.72, 2.8, 0, GLASS));
  for (const x of [-3.2, -1.7, 1.2, 2.9]) for (const z of [-1.38, 1.38]) { const w = new THREE.CylinderGeometry(.6, .6, .46, 12); w.rotateX(Math.PI / 2); w.translate(x, .6, z); L.push(prim(w, 0x151515)); }
  for (const z of [-1.3, 1.3]) L.push(B(.22, 1.1, .22, -4.35, .55, z, P.dark));
  L.push(B(.9, .9, 2.0, -3.9, 2.0, 0, P.dark));
  Lt.push(B(.08, .12, .3, 4.73, 1.7, .95, 0xfff2cc), B(.08, .12, .3, 4.73, 1.7, -.95, 0xfff2cc));
  return { L, Lt, top: 3.4, pivot: v3(-4.0, 2.25, 0) };
}
function bComm(side) {
  const P = PAL[side], L = [], Lt = [], H = side === 'bull' ? 26 : 20, legs = [];
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .3; legs.push([Math.cos(a), Math.sin(a)]); }
  const at = (i, y) => { const r = mix(1.6, .35, y / H); return v3(legs[i][0] * r, y, legs[i][1] * r); };
  for (let i = 0; i < 3; i++) L.push(beamGeo(at(i, 0), at(i, H), .13, 0xb8b6ae));
  for (let y = 0; y < H - 1; y += LITE ? 4.8 : 2.4) for (let i = 0; i < 3; i++) L.push(beamGeo(at(i, y), at((i + 1) % 3, Math.min(H, y + 2.4)), .05, 0xc23a2a));
  const dish = (y, ay) => { const d = new THREE.LatheGeometry([[0, 0], [.5, .06], [1.0, .25], [1.4, .55]].map(p => new THREE.Vector2(p[0], p[1])), 16); d.rotateZ(Math.PI / 2); d.translate(.25, 0, 0); d.rotateY(ay); d.translate(0, y, 0); L.push(prim(d, 0xd8d6cf)); };
  dish(H * .55, 0); dish(H * .72, 2.2);
  L.push(CY(.03, .03, 4, 4, 0, H + 2, 0, 0x777777));
  Lt.push(B(.32, .32, .32, 0, H + .1, 0, 0xff3020), B(.24, .24, .24, 0, H * .5, .7, 0xff3020));
  L.push(B(3, 2.4, 3, 2.6, 1.2, 2.6, P.hut), B(3.3, .18, 3.3, 2.6, 2.48, 2.6, P.roof));
  return { L, Lt, top: H, blink: [v3(0, H + .3, 0)] };
}
function bDome() {
  const L = [], Lt = [];
  const s = new THREE.SphereGeometry(4.3, 22, 12, 0, TAU, 0, Math.PI * .6); s.translate(0, 3.0, 0);
  const gs = s.toNonIndexed(), c0 = C3(0xdcd7c8);
  G.paint(gs, (x, y, z) => { const k = .9 + .1 * Math.sign(Math.sin(Math.atan2(z, x) * 11)) * Math.sign(Math.sin(y * 2.3)); return [c0[0] * k, c0[1] * k, c0[2] * k]; }); L.push(gs);
  L.push(CY(4.4, 4.6, 3, 22, 0, 1.5, 0, 0x8b7a5e), B(.1, 2, 1.4, 4.47, 1, 0, 0x3a3631));
  Lt.push(B(.25, .25, .25, 0, 7.4, 0, 0xff3020));
  return { L, Lt, top: 7.5, blink: [v3(0, 7.6, 0)] };
}
function bYard() {
  const L = [], Lt = [], pal = [0x8b3a2e, 0x2f5d7c, 0x3f6b3a, 0x7a7a74, 0xb5832a, 0x6a2f2a];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const n = srand() < .55 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const g = new THREE.BoxGeometry(6.06, 2.59, 2.44, LITE ? 4 : 12, 1, 1), x = (c - .5) * 6.6, z = (r - 1) * 2.9, gc = g.toNonIndexed(), col = C3(pal[(srand() * pal.length) | 0]);
      G.paint(gc, (px) => { const kk = .84 + .16 * Math.abs(Math.cos(px * 10)); return [col[0] * kk, col[1] * kk, col[2] * kk]; });
      gc.rotateY((srand() - .5) * .06); gc.translate(x, 1.3 + k * 2.6, z); L.push(gc);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(B(.45, 10, .45, sx * 9, 5, sz * 6.2, 0xc9a227));
  for (const sz of [-1, 1]) L.push(B(18.6, .6, .6, 0, 10.1, sz * 6.2, 0xc9a227));
  L.push(B(1.4, .8, 13, 2.5, 10.3, 0, 0xb08d1e), B(.05, 3.6, .05, 2.5, 8.2, 0, 0x333333));
  Lt.push(B(.25, .25, .25, -9, 10.5, 6.2, 0xff6a2a), B(.25, .25, .25, 9, 10.5, -6.2, 0xff6a2a));
  return { L, Lt, top: 10.5, blink: [v3(-9, 10.7, 6.2), v3(9, 10.7, -6.2)] };
}
function bDump() {
  const L = [], Lt = [];
  for (let i = 0; i < 16; i++) { const st = (i / 6) | 0, x = -3 + (i % 3) * 1.3 + st * 3.6 - 3, y = .4 + (((i % 6) / 3) | 0) * .8, z = (st - 1) * 1.9; L.push(B(1.2, .78, .8, x, y, z, srand() < .5 ? 0x56603e : 0x7a6142)); }
  for (let i = 0; i < 9; i++) L.push(CY(.3, .3, .9, 10, 3 + (i % 3) * .66, .45, 1.5 + ((i / 3) | 0) * .66, 0x4b5e3c));
  const mkNet = flip => {
    const p = new THREE.PlaneGeometry(11, 8, 11, 8); p.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
    const a = p.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i), z = a.getZ(i); a.setY(i, 2.9 - .75 * (1 - Math.pow(x / 5.5, 2)) * (1 - Math.pow(z / 4, 2)) + G.noise(x * .8, z * .8) * .18); }
    p.computeVertexNormals(); const g = p.toNonIndexed(), c1 = C3(0x3d4630), c2 = C3(0x5b5a3a);
    G.paint(g, (x, y, z) => { const t = G.noise(x * 1.7 + 5, z * 1.7) > .5 ? 1 : 0; return t ? c1 : c2; }); return g;
  };
  L.push(mkNet(false), mkNet(true));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(CY(.07, .07, 2.9, 5, sx * 5.4, 1.45, sz * 3.9, 0x4b4332));
  return { L, Lt, top: 3 };
}
function bRuin() {
  const L = [], Lt = [], W = 6, D = 5, plaster = 0xb3a68d;
  const wall = (len, hgt, holes) => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0);
    const minTop = holes.reduce((m, h) => Math.max(m, h[1] + h[3] + .35), 1.1);
    const n = 7; for (let i = n; i >= 0; i--) { const x = len * i / n, y = hgt - srand() * (i % 2 ? 1.8 : .9) - (srand() < .25 ? 1.2 : 0); s.lineTo(x, Math.max(minTop, y)); }
    s.closePath();
    for (const [hx, hy, hw, hh] of holes) { const h = new THREE.Path(); h.moveTo(hx, hy); h.lineTo(hx + hw, hy); h.lineTo(hx + hw, hy + hh); h.lineTo(hx, hy + hh); h.closePath(); s.holes.push(h); }
    return new THREE.ExtrudeGeometry(s, { depth: .38, bevelEnabled: false, curveSegments: 1 });
  };
  const add = (g, x, z, ry) => { g.translate(-0, 0, -.19); g.rotateY(ry); g.translate(x, 0, z); L.push(prim(g, plaster)); };
  add(wall(W, 4.2, [[1, 1.3, .9, 1.1], [4, 1.3, .9, 1.1]]), -W / 2, D / 2, 0);
  add(wall(W, 3.4, [[2.4, 1.2, 1.0, 1.0]]), W / 2, -D / 2, Math.PI);
  add(wall(D, 3.8, [[1.8, 1.3, .9, 1.0]]), -W / 2, -D / 2, -Math.PI / 2);
  add(wall(D, 2.6, []), W / 2, D / 2, Math.PI / 2);
  const slab = new THREE.BoxGeometry(6.2, .25, 3.2); slab.rotateZ(.38); slab.translate(.3, 1.5, -.6); L.push(prim(slab, 0x6e5d4a));
  for (let i = 0; i < (LITE ? 4 : 9); i++) { const g = new THREE.IcosahedronGeometry(.35 + srand() * .55, 0); g.scale(1, .55, 1); g.translate((srand() - .5) * 8, .15, (srand() - .5) * 7); L.push(prim(g, srand() < .5 ? 0x8e8574 : 0x7b6f5d)); }
  return { L, Lt, top: 4.2 };
}
function bWreck() {
  const L = [];
  const hull = G.mbtHull(), tur = G.mbtTurret();
  const char = (g, k) => { const gg = g.index ? g.toNonIndexed() : g; G.paint(gg, (x, y, z) => { const n = G.noise(x * 2.1 + 9, z * 2.1 + y); const r = n > .62 ? [.32, .16, .08] : [.07, .062, .055]; return [r[0] * k, r[1] * k, r[2] * k]; }); return gg; };
  const h = char(hull, 1); h.scale(1.35, 1.35, 1.35); L.push(h);
  const t = char(tur, .9); t.rotateY(.7); t.rotateZ(-.32); t.translate(-1.2, -.5, 2.6); t.scale(1.35, 1.35, 1.35); L.push(t);
  return { L, Lt: [], top: 2.4, ember: v3(0, 1.4, 0) };
}
const BUILD = { tower: bTower, barracks: bBarracks, hangar: bHangar, helipad: bHelipad, sam: bSam, tel: bTelBase, comm: bComm, dome: bDome, yard: bYard, dump: bDump, ruin: bRuin, wreck: bWreck };

/* ---------------------------------------------------------------- environment build */
K.build = function (scene, hgt, tier) {
  const T = G.TIERS[tier] || G.TIERS.high, lite = tier === 'lite' || !G.std, std = !!G.std;
  const E = { tier, lite, scene, hgt, items: [], beams: [], blinks: [], embers: [], tels: { bull: [], bear: [] }, sams: { bull: [], bear: [] }, park: [], night: 0, t: 0 };
  K.env = E; LITE = lite;
  const chunks = { L: [], C: [], R: [] }, lights = [], chunk = x => x < -82 ? 'L' : x > 82 ? 'R' : 'C';
  for (const it of LAY.items) {
    const fn = BUILD[it.k]; if (!fn) continue;
    const r = fn(it.side), y = hgt(it.x, it.z) - .02;
    grime(r.L, r.top || 4);
    place(r.L, it.x, y, it.z, it.rot); place(r.Lt, it.x, y, it.z, it.rot);
    chunks[chunk(it.x)].push(...r.L); lights.push(...r.Lt);
    const W = (v) => v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), it.rot).add(new THREE.Vector3(it.x, y, it.z));
    if (r.beam) E.beams.push({ p: W(r.beam), rot: it.rot, k: 'search', ph: srand() * 6 });
    if (r.blink) r.blink.forEach(b => E.blinks.push(W(b)));
    if (r.ember) E.embers.push({ p: W(r.ember), side: it.side, t: srand() * 4 });
    if (it.k === 'tel') E.tels[it.side].push({ pivot: W(r.pivot), rot: it.rot, raise: 0, tgt: 0, reload: 0 });
    if (it.k === 'sam') E.sams[it.side].push({ tip: W(r.tip), rot: it.rot });
    if (r.park) r.park.forEach(p => E.park.push({ p: W(p), rot: it.rot + Math.PI / 2, side: it.side }));
    if (it.k === 'helipad') E.park.push({ p: new THREE.Vector3(it.x, y + .2, it.z), rot: it.rot + (it.side === 'bull' ? 0 : Math.PI), side: it.side, heli: true });
  }
  /* street lamps along the road */
  for (let x = -84; x <= 84; x += 21) {
    const s = ((x / 21) | 0) % 2 ? 1 : -1, z = roadZ(x) + s * 4.4, y = hgt(x, z) - .05, L = [], Lt = [];
    L.push(CY(.08, .11, 6.4, 6, 0, 3.2, 0, 0x3b3d3f), B(.08, .08, 1.7, 0, 6.3, -s * .8, 0x3b3d3f), B(.5, .14, .26, 0, 6.24, -s * 1.6, 0x2b2c2e));
    Lt.push(B(.4, .05, .2, 0, 6.15, -s * 1.6, 0xffd9a0));
    place(L, x, y, z, 0); place(Lt, x, y, z, 0); chunks.C.push(...L); lights.push(...Lt);
    E.beams.push({ p: new THREE.Vector3(x, y + 6.1, z - s * 1.6), rot: 0, k: 'lamp' });
  }
  /* road studs (cat's eyes) every 12 m on both edges */
  for (let x = -88; x <= 88; x += 12) for (const s of [-1, 1]) { const z = roadZ(x) + s * 2.75, g = B(.16, .06, .1, x, hgt(x, z) + .1, z, 0xfff1c0); lights.push(g); }
  const om = std ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: .04 }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  om.userData.envK = .55;
  E.meshes = [];
  for (const k of ['L', 'C', 'R']) { if (!chunks[k].length) continue; const mesh = new THREE.Mesh(G.merge(chunks[k]), om); mesh.castShadow = !lite; mesh.receiveShadow = std; scene.add(mesh); E.meshes.push(mesh); }
  E.mesh = E.meshes[0];
  const lm = new THREE.MeshBasicMaterial({ vertexColors: true }); E.lmat = lm;
  const lmesh = new THREE.Mesh(G.merge(lights), lm); scene.add(lmesh);
  /* asphalt road ribbon that follows the terrain */
  const RX = 92, NS = 184, w = 6.2, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const x = -RX + i * (2 * RX / NS), zc = roadZ(x);
    for (let j = 0; j < 3; j++) { const v = j / 2, z = zc + (v - .5) * w; pos.push(x, hgt(x, z) + .07, z); uv.push((x + RX) / 9, v); }
    if (i < NS) for (let j = 0; j < 2; j++) { const a = i * 3 + j, b = a + 3; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals();
  const rm = std ? new THREE.MeshStandardMaterial({ map: K.roadTex(), roughness: .82, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) : new THREE.MeshLambertMaterial({ map: K.roadTex(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  rm.userData.envK = .35;
  const road = new THREE.Mesh(rg, rm); road.receiveShadow = std; road.renderOrder = 1; scene.add(road); E.road = road;
  /* lakes */
  E.water = K.waterMaterial();
  for (const l of LAY.lakes) {
    if (l.w === null) l.w = hgt(l.x, l.z);
    const c = new THREE.CircleGeometry(1, 40); c.rotateX(-Math.PI / 2); c.scale(l.rx * 1.25, 1, l.rz * 1.25); c.rotateY(l.rot);
    const m = new THREE.Mesh(c, E.water); m.position.set(l.x, l.w, l.z); m.renderOrder = 2; scene.add(m);
    /* reeds */
    const rd = []; for (let i = 0; i < (lite ? 24 : 110); i++) { const a = srand() * TAU, e = 1.0 + srand() * .22; const ca = Math.cos(l.rot), sa = Math.sin(l.rot), u = Math.cos(a) * l.rx * e, v = Math.sin(a) * l.rz * e; const x = l.x + u * ca + v * sa, z = l.z - u * sa + v * ca; const h = .7 + srand() * 1.1; const g = new THREE.ConeGeometry(.06, h, 3); g.translate(x, hgt(x, z) + h / 2 - .1, z); rd.push(prim(g, srand() < .5 ? 0x5d6b38 : 0x7b7a45)); }
    const rm2 = new THREE.MeshLambertMaterial({ vertexColors: true }); scene.add(new THREE.Mesh(G.merge(rd), rm2));
    /* small jetty */
    const j = [B(.9, .12, 7, 0, 0, 0, 0x6b5136)]; for (let k = -3; k <= 3; k += 1.5) j.push(CY(.08, .08, 1.4, 5, 0, -.6, k, 0x4b3a28));
    const ja = l.rot + Math.PI / 2, jx = l.x + Math.cos(ja) * l.rz * .75, jz = l.z - Math.sin(ja) * l.rz * .75; place(j, jx, l.w + .32, jz, l.rot); scene.add(new THREE.Mesh(G.merge(j), om));
  }
  /* ground mist sheets + lake mist */
  const mt = K.mistTex(); E.mist = [];
  const nMist = lite ? 0 : T.post ? 10 : 7;          // software renderers pay for every transparent pixel: lite keeps only the lake mist
  for (let i = 0; i < nMist; i++) {
    const tex = mt.clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: tex, transparent: true, opacity: .12, depthWrite: false });
    const g = new THREE.PlaneGeometry(110, 46); g.rotateX(-Math.PI / 2);
    const me = new THREE.Mesh(g, m), x = sr(-110, 110), z = sr(-40, 34); me.position.set(x, 1.6 + sr(0, 2.8), z); me.renderOrder = 3; scene.add(me);
    E.mist.push({ m: me, vx: sr(.4, 1.1), base: me.position.x, a: sr(.6, 1) });
  }
  for (const l of LAY.lakes) { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: mt, transparent: true, opacity: .2, depthWrite: false }); const g = new THREE.PlaneGeometry(l.rx * 3, l.rz * 3); g.rotateX(-Math.PI / 2); const me = new THREE.Mesh(g, m); me.position.set(l.x, l.w + .7, l.z); me.renderOrder = 3; scene.add(me); E.mist.push({ m: me, vx: 0, base: l.x, a: 1.4, lake: true }); }
  /* haze rings (aerial perspective in every direction) */
  E.haze = [];
  const hz = (r, h, a) => {
    const g = new THREE.CylinderGeometry(r, r, h, 48, 1, true); g.translate(0, h / 2 - 4, 0);
    const c = canvas(4, 64), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgb(0,0,0)'); gr.addColorStop(.55, 'rgb(90,90,90)'); gr.addColorStop(1, 'rgb(255,255,255)'); x.fillStyle = gr; x.fillRect(0, 0, 4, 64);   // grey = alpha (alphaMap reads green)
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: new THREE.CanvasTexture(c), transparent: true, opacity: a, depthWrite: false, side: THREE.BackSide, fog: false });
    const me = new THREE.Mesh(g, m); me.renderOrder = -1; scene.add(me); E.haze.push({ m: me, a });
  };
  hz(250, 70, .32); if (!lite) hz(320, 90, .42);
  /* light shafts + beams */
  E.shaftMat = K.beamMaterial(0xfff1d6, true); E.searchMat = K.beamMaterial(0xdfe9ff, false); E.lampMat = K.beamMaterial(0xffd29a, false);
  E.shafts = [];
  const nSh = lite ? 2 : 6;
  for (let i = 0; i < nSh; i++) {
    const g = new THREE.CylinderGeometry(2.2 + srand() * 2, 9 + srand() * 6, 120, 16, 1, true);
    const me = new THREE.Mesh(g, E.shaftMat); me.renderOrder = 5; me.frustumCulled = false; scene.add(me);
    E.shafts.push({ m: me, g: new THREE.Vector3(sr(-130, 130), 0, sr(-150, -70)) });
  }
  for (const b of E.beams) {
    const len = b.k === 'lamp' ? 6.3 : 38, g = new THREE.CylinderGeometry(b.k === 'lamp' ? .25 : .3, b.k === 'lamp' ? 3.2 : 6.5, len, 14, 1, true);
    g.translate(0, -len / 2, 0);               // apex at the group origin, cone hangs down -y
    const grp = new THREE.Group(), me = new THREE.Mesh(g, b.k === 'lamp' ? E.lampMat : E.searchMat); me.frustumCulled = false; me.renderOrder = 5;
    if (b.k === 'search') me.rotation.z = Math.PI / 2 - .38;    // tip forward (+x) and down
    grp.add(me); grp.position.copy(b.p); grp.rotation.y = b.rot; scene.add(grp); b.g = grp; b.mesh = me;
  }
  /* blinking aviation lights + ember glows (points) */
  const bp = new THREE.BufferGeometry(); bp.setAttribute('position', new THREE.Float32BufferAttribute(E.blinks.flatMap(v => [v.x, v.y, v.z]), 3));
  E.blinkM = new THREE.PointsMaterial({ map: K.glowTex(), color: 0xff3b24, size: 2.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .9 });
  E.blinkP = new THREE.Points(bp, E.blinkM); scene.add(E.blinkP);
  const ep = new THREE.BufferGeometry(); ep.setAttribute('position', new THREE.Float32BufferAttribute(E.embers.flatMap(e => [e.p.x, e.p.y, e.p.z]), 3));
  E.emberM = new THREE.PointsMaterial({ map: K.glowTex(), color: 0xff7a2a, size: 5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .7 });
  E.emberP = new THREE.Points(ep, E.emberM); scene.add(E.emberP);
  E.tick = envTick; E.mood = envMood; E.crater = envCrater; E.vehicles = envVehicles;
  return E;
};
function envVehicles() {                   // parked trucks + static helicopters (vehicle materials exist after ARMY.init)
  const E = this; if (E.vehDone || typeof ARMY === 'undefined' || !ARMY.vmat) return; E.vehDone = true;
  for (const p of E.park) {
    if (p.heli && E.lite) continue;               // parked helicopters are several draw calls each
    const g = p.heli ? G.heli(ARMY.vmat[p.side]) : G.truck(ARMY.vmat[p.side]); g.position.copy(p.p); g.rotation.y = p.rot; g.scale.setScalar(p.heli ? 1.25 : 1.3);
    E.scene.add(g); if (p.heli && g.userData.rotor) g.userData.rotor.rotation.y = .4;
  }
  /* TEL erector arms with a ready missile */
  for (const side of ['bull', 'bear']) for (const t of E.tels[side]) {
    const P = PAL[side], arm = new THREE.Group(); arm.position.copy(t.pivot); arm.rotation.y = t.rot;
    const tilt = new THREE.Group(); arm.add(tilt);
    const rail = new THREE.Mesh(G.merge([B(8.8, .34, .72, 4.4, 0, 0, P.steel), B(.5, .9, .9, .1, -.2, 0, P.dark)]), E.mesh.material); tilt.add(rail);
    const ms = new THREE.Mesh(K.missileGeo('B', side), K.missileMat()); ms.rotation.z = -Math.PI / 2; ms.position.set(4.4, .62, 0); tilt.add(ms);
    E.scene.add(arm); t.arm = arm; t.tilt = tilt; t.ms = ms;
  }
}
function envCrater(x, z, r) {              // keep the asphalt glued to a deformed terrain
  const E = this; if (!E.road || !G.std || Math.abs(z - roadZ(x)) > r + 4) return;     // lite terrain is never deformed
  const p = E.road.geometry.attributes.position; let any = false;
  for (let i = 0; i < p.count; i++) { const dx = p.getX(i) - x, dz = p.getZ(i) - z; if (dx * dx + dz * dz < (r + 1) * (r + 1)) { p.setY(i, E.hgt(p.getX(i), p.getZ(i)) + .07); any = true; } }
  if (any) { p.needsUpdate = true; E.road.geometry.computeVertexNormals(); }
}
function envMood(p, storm) {
  const E = this, L = h => G.lin(h);
  const night = cl(p.stars * 1.1 + storm * .55 + (p.el < 10 ? .25 : 0), 0, 1); E.night = night;
  E.lmat.color.setScalar(mix(.16, 2.4, night));
  const u = E.water.uniforms; u.uSky.value.copy(L(p.top)); u.uHor.value.copy(L(p.hor)); u.uSunCol.value.copy(L(p.sun)).multiplyScalar(p.si * .55 * (1 - storm * .7)); u.uGlint.value = 1 - storm * .8;
  if (typeof WORLD !== 'undefined' && WORLD.sunDir) u.uSunDir.value.copy(WORLD.sunDir);
  u.uDeep.value.copy(L(0x1d3a3c)).lerp(L(p.hgnd), .35).multiplyScalar(mix(1, .35, night));
  const fogC = L(p.fog);
  const mistA = mix(.07, .2, cl((150 - p.fn) / 80 + storm * .6, 0, 1)) * mix(1, .55, night * (1 - storm));
  E.mist.forEach(m => { m.m.material.color.copy(fogC).lerp(new THREE.Color(1, 1, 1), .25 * (1 - night)); m.m.material.opacity = mistA * m.a; });
  E.haze.forEach(h => { h.m.material.color.copy(fogC); h.m.material.opacity = h.a * (.8 + storm * .3); });
  /* sun shafts: aligned to the sun, strongest at dawn/dusk and through broken cloud */
  const sd = (typeof WORLD !== 'undefined' && WORLD.sunDir) ? WORLD.sunDir : new THREE.Vector3(.3, .7, .2);
  const low = 1 - cl((p.el - 8) / 40, 0, 1), cloud = p.cloud;
  E.shaftBase = (p.stars > .8 ? .022 : (.026 + .05 * low) * (.6 + cloud * .8)) * (1 - storm * .65) * (E.lite ? .8 : 1);
  E.shaftMat.uniforms.uCol.value.copy(L(p.stars > .8 ? 0x9fb6ff : p.sun));
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion().setFromUnitVectors(up, sd.clone().normalize());
  E.shafts.forEach(s => { s.m.quaternion.copy(q); const c = s.g.clone(); c.y = E.hgt(c.x, c.z) - 4; s.m.position.copy(c).addScaledVector(sd, 60); });
  E.searchMat.uniforms.uInt.value = .55 * sm(.3, .75, night);
  E.lampMat.uniforms.uInt.value = .7 * sm(.25, .7, night);
  const beamsOn = night > .27; if (beamsOn !== E.beamsOn) { E.beamsOn = beamsOn; E.beams.forEach(b => { if (b.g) b.g.visible = beamsOn; }); }
  const shOn = E.shaftBase > .004; E.shafts.forEach(s => { s.m.visible = shOn; });
  E.blinkM.opacity = .35 + .6 * night;
  K.trailCol = L(p.sun).multiplyScalar(.42 * p.si * (1 - storm * .6)).add(L(p.hsky).multiplyScalar(.95)); if (K.air && K.air.trails) K.air.trails.mat.uniforms.uCol.value.copy(K.trailCol);
}
function envTick(dt, t) {
  const E = this; E.t += dt;
  E.water.uniforms.uTime.value = t;
  E.shaftMat.uniforms.uTime.value = t; E.searchMat.uniforms.uTime.value = t; E.lampMat.uniforms.uTime.value = t;
  const pulse = E.pulseT > 0 ? (E.pulseT -= dt, 1 + 2.2 * Math.sin(Math.min(1, E.pulseT / 4) * Math.PI)) : 1;
  E.shaftMat.uniforms.uInt.value = (E.shaftBase || 0) * pulse;
  const wind = (typeof WORLD !== 'undefined' ? WORLD.wind : 0) || 0;
  for (const m of E.mist) { if (m.lake) continue; m.m.position.x += (m.vx + wind * .8) * dt; if (m.m.position.x > 150) m.m.position.x = -150; }
  if (E.night > .25) for (const b of E.beams) if (b.k === 'search') b.g.rotation.y = b.rot + Math.sin(t * .42 + b.ph) * .85;
  E.blinkP.visible = Math.sin(t * 3.1) > -.2;
  E.emberM.opacity = (.35 + .4 * E.night) * (.75 + .25 * Math.sin(t * 11) * Math.sin(t * 7.3));
  if (typeof FX !== 'undefined' && FX.smoke && PREF.layers.fx) for (const e of E.embers) { e.t -= dt; if (e.t <= 0) { e.t = E.lite ? 1.6 : .7; FX.smoke(e.p.x + rr(-.6, .6), e.p.y + .8, e.p.z + rr(-.6, .6), 1, 3.2, 0); } }
  /* TEL erectors */
  for (const side of ['bull', 'bear']) for (const tl of E.tels[side]) { if (!tl.tilt) continue; tl.raise += (tl.tgt - tl.raise) * Math.min(1, dt * 1.6); tl.tilt.rotation.z = tl.raise * 1.32; if (tl.reload > 0) { tl.reload -= dt; if (tl.reload <= 0) { tl.ms.visible = true; tl.tgt = 0; } } }
}
K.pulse = function () { if (K.env) K.env.pulseT = 4; };

/* ---------------------------------------------------------------- missiles: geometry */
K.missileGeo = function (kind, side) {
  const L = [], bodyC = kind === 'I' ? 0xe9e7e0 : side === 'bear' ? 0xc9bb98 : 0xd9dbd2, band = side === 'bear' ? 0x8c2a22 : 0x2f5a2c;
  const fin = (w, h, y, r) => { for (let i = 0; i < 4; i++) { const f = new THREE.BoxGeometry(w, h, .05); f.translate(w / 2 + r * .8, y, 0); f.rotateY(i * Math.PI / 2); L.push(prim(f, 0x3a3a38)); } };
  if (kind === 'B') {
    L.push(CY(.42, .42, 7.4, 14, 0, -.6, 0, bodyC), CY(0, .42, 1.6, 14, 0, 3.85, 0, bodyC), CY(.43, .43, .5, 14, 0, 1.8, 0, band), CY(.36, .3, .4, 12, 0, -4.5, 0, 0x2a2a2a));
    fin(.7, 1.1, -3.7, .42);
  } else if (kind === 'C') {
    L.push(CY(.26, .26, 3.9, 12, 0, -.2, 0, bodyC), CY(0, .26, .9, 12, 0, 2.2, 0, bodyC), CY(.27, .27, .3, 12, 0, .9, 0, band), CY(.2, .16, .3, 10, 0, -2.3, 0, 0x2a2a2a));
    const w = new THREE.BoxGeometry(.05, .55, 2.6); w.translate(0, .1, 0); L.push(prim(w, 0x8d8d86)); fin(.42, .6, -1.85, .26);
  } else {
    L.push(CY(.16, .16, 2.9, 10, 0, -.2, 0, bodyC), CY(0, .16, .55, 10, 0, 1.52, 0, bodyC), CY(.13, .1, .2, 8, 0, -1.75, 0, 0x2a2a2a)); fin(.3, .45, -1.4, .16);
  }
  return G.merge(L);
};
let _mm = null;
K.missileMat = function () { if (!_mm) { _mm = G.std ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .25 }) : new THREE.MeshLambertMaterial({ vertexColors: true }); _mm.userData.envK = .8; } return _mm; };

/* ---------------------------------------------------------------- ribbon trails (camera-facing, widening, fading) */
function Trails(scene, n, lite) {
  this.list = []; this.mat = K.trailMaterial(); this.N = lite ? 28 : 44;
  for (let i = 0; i < n; i++) {
    const N = this.N, g = new THREE.BufferGeometry();
    const P = new THREE.BufferAttribute(new Float32Array(N * 6), 3), A = new THREE.BufferAttribute(new Float32Array(N * 2), 1), V = new THREE.BufferAttribute(new Float32Array(N * 2), 1);
    P.setUsage(THREE.DynamicDrawUsage); A.setUsage(THREE.DynamicDrawUsage);
    for (let k = 0; k < N; k++) { V.setX(k * 2, 0); V.setX(k * 2 + 1, 1); }
    const idx = []; for (let k = 0; k < N - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', P); g.setAttribute('aA', A); g.setAttribute('aV', V); g.setIndex(idx); g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, this.mat); m.frustumCulled = false; m.renderOrder = 6; m.visible = false; scene.add(m);
    this.list.push({ m, g, P, A, pts: [], on: false, emit: false, life: 5, w0: .5, w1: 3, a0: .8, last: null });
  }
}
Trails.prototype.get = function (o) {
  const t = this.list.find(t => !t.on); if (!t) return null;
  Object.assign(t, { on: true, emit: true, pts: [], last: null, life: 5, w0: .5, w1: 3, a0: .8 }, o || {}); t.m.visible = true; return t;
};
Trails.prototype.tick = function (now, camPos) {
  const tg = new THREE.Vector3(), vw = new THREE.Vector3(), sd = new THREE.Vector3();
  for (const t of this.list) {
    if (!t.on) continue;
    while (t.pts.length && now - t.pts[t.pts.length - 1].t > t.life) t.pts.pop();
    if (!t.emit && !t.pts.length) { t.on = false; t.m.visible = false; t.g.setDrawRange(0, 0); continue; }
    const n = Math.min(t.pts.length, this.N);
    for (let i = 0; i < n; i++) {
      const p = t.pts[i], a = t.pts[Math.max(0, i - 1)], b = t.pts[Math.min(n - 1, i + 1)];
      tg.set(a.x - b.x, a.y - b.y, a.z - b.z); vw.set(camPos.x - p.x, camPos.y - p.y, camPos.z - p.z);
      sd.crossVectors(tg, vw); const l = sd.length() || 1;
      const age = cl((now - p.t) / t.life, 0, 1), w = (t.w0 + (t.w1 - t.w0) * Math.pow(age, .6)) * .5 / l;
      t.P.setXYZ(i * 2, p.x + sd.x * w, p.y + sd.y * w + age * 1.5, p.z + sd.z * w);
      t.P.setXYZ(i * 2 + 1, p.x - sd.x * w, p.y - sd.y * w + age * 1.5, p.z - sd.z * w);
      const a2 = t.a0 * Math.pow(1 - age, 1.4) * Math.min(1, i / 2.5);
      t.A.setX(i * 2, a2); t.A.setX(i * 2 + 1, a2);
    }
    t.P.needsUpdate = true; t.A.needsUpdate = true; t.g.setDrawRange(0, Math.max(0, n - 1) * 6);
  }
};
Trails.prototype.add = function (t, p, now) {
  if (!t || !t.emit) return;
  const l = t.pts[0]; if (l && (l.x - p.x) ** 2 + (l.y - p.y) ** 2 + (l.z - p.z) ** 2 < .7 && now - l.t < .08) return;
  t.pts.unshift({ x: p.x, y: p.y, z: p.z, t: now }); if (t.pts.length > this.N) t.pts.length = this.N;
};

/* ---------------------------------------------------------------- air layer runtime (missiles, interceptors, formations, drones) */
const A4 = K.air = { ready: false, M: [], Q: [], clock: 0 };
A4.init = function () {
  const lite = K.env ? K.env.lite : !G.std; this.lite = lite;
  this.geo = { B: { bull: K.missileGeo('B', 'bull'), bear: K.missileGeo('B', 'bear') }, C: { bull: K.missileGeo('C', 'bull'), bear: K.missileGeo('C', 'bear') }, I: K.missileGeo('I') };
  this.glowMat = new THREE.SpriteMaterial({ map: K.glowTex(), color: 0xffb35a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  this.pool = [];
  for (let i = 0; i < 20; i++) { const m = new THREE.Mesh(this.geo.I, K.missileMat()); m.visible = false; const s = new THREE.Sprite(this.glowMat); m.add(s); scene.add(m); this.pool.push({ m, s, on: false }); }
  this.trails = new Trails(scene, lite ? 12 : 26, lite); if (K.trailCol) this.trails.mat.uniforms.uCol.value.copy(K.trailCol);
  /* recon drones: two per army circling over their own half */
  this.drones = [];
  const dg = G.merge([CY(.2, .12, 2.6, 8, 0, 0, 0, 0x8f9290), B(.5, .05, 4.6, -.1, .05, 0, 0x8f9290), B(.35, .5, .04, -1.15, .3, .35, 0x6f7270), B(.35, .5, .04, -1.15, .3, -.35, 0x6f7270), CY(.12, .12, .25, 8, .4, -.2, 0, 0x222222)].map((g, i) => { if (i === 0 || i === 4) g.rotateZ(Math.PI / 2); return g; }));
  const dm = K.missileMat();
  const blinkM = new THREE.SpriteMaterial({ map: K.glowTex(), color: 0xff4030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  ['bull', 'bear'].forEach((side, si) => { for (let k = 0; k < 2; k++) {
    const m = new THREE.Mesh(dg, dm); m.rotation.order = 'YXZ'; m.scale.setScalar(1.6); const b = new THREE.Sprite(blinkM); b.scale.setScalar(1.6); b.position.set(-.2, -.2, 0); m.add(b); scene.add(m);
    this.drones.push({ m, b, cx: (si ? 1 : -1) * (36 + k * 18), cz: -12 + k * 20, r: 26 + k * 10, y: 46 + k * 9, w: (k ? -1 : 1) * (.16 + k * .03), ph: si * 2 + k * 3 });
  } });
  this.ready = true;
};
A4.after = function (ms, fn) { this.Q.push({ t: vt() + ms, fn }); };
A4.clear = function () { this.Q.length = 0; this.M.forEach(m => this.free(m)); this.M.length = 0; };
A4.spawn = function (kind, side, p0, p1, dur, apex) {
  const slot = this.pool.find(p => !p.on); if (!slot) return null;
  slot.on = true; slot.m.geometry = kind === 'I' ? this.geo.I : this.geo[kind][side]; slot.m.visible = true;
  slot.s.position.set(0, kind === 'B' ? -4.9 : kind === 'C' ? -2.6 : -1.95, 0); slot.s.scale.setScalar(kind === 'B' ? 6 : kind === 'C' ? 3.2 : 2.4);
  const tr = this.trails.get(kind === 'B' ? { life: 7.5, w0: 1.6, w1: 9, a0: .92 } : kind === 'C' ? { life: 4.2, w0: .6, w1: 3.4, a0: .8 } : { life: 3.0, w0: .45, w1: 2.6, a0: .85 });
  const m = { kind, side, p0: p0.clone(), p1: p1.clone(), t0: vt(), dur, apex: apex || 0, slot, tr, on: true, ph: Math.random() * 6.28, pos: p0.clone(), wx: p0.x, wz: p0.z, g: slot.m };
  this.M.push(m); return m;
};
A4.free = function (m) { m.on = false; if (m.slot) { m.slot.on = false; m.slot.m.visible = false; } if (m.tr) m.tr.emit = false; };
A4.posAt = function (m, s, out) {
  out = out || new THREE.Vector3();
  if (m.kind === 'B') { const h = s * s * (3 - 2 * s); out.set(mix(m.p0.x, m.p1.x, h), mix(m.p0.y, m.p1.y, s) + m.apex * 4 * s * (1 - s), mix(m.p0.z, m.p1.z, h)); }
  else if (m.kind === 'C') {
    const x = mix(m.p0.x, m.p1.x, s), z = mix(m.p0.z, m.p1.z, s) + Math.sin(s * Math.PI * 2.5 + m.ph) * 5 * (1 - s);
    const g = ARMY.gy(x, z), cruiseY = Math.max(g + 12, mix(m.p0.y, g + 12, sm(0, .2, s))) + 9 * sm(.74, .88, s);
    out.set(x, mix(cruiseY, m.p1.y, sm(.88, 1, s)), z);
  } else out.set(mix(m.p0.x, m.p1.x, s), mix(m.p0.y, m.p1.y, s) + 7 * Math.sin(Math.PI * s), mix(m.p0.z, m.p1.z, s));
  return out;
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
A4.tick = function (dt) {
  if (!this.ready) return;
  const now = vt(), ts = now / 1000;
  for (let i = this.Q.length - 1; i >= 0; i--) if (this.Q[i].t <= now) { const q = this.Q.splice(i, 1)[0]; try { q.fn(); } catch (e) { console.error(e); } }
  for (let i = this.M.length - 1; i >= 0; i--) {
    const m = this.M[i]; if (!m.on) { this.M.splice(i, 1); continue; }
    const s = (now - m.t0) / 1000 / m.dur;
    if (m.kind === 'I' && (!m.target || !m.target.on)) { this.free(m); continue; }
    if (s >= 1) { this.hit(m); this.free(m); this.M.splice(i, 1); continue; }
    this.posAt(m, s, _a); this.posAt(m, Math.min(1, s + .01), _b);
    const mesh = m.slot.m; mesh.position.copy(_a); _b.sub(_a); if (_b.lengthSq() > 1e-6) mesh.quaternion.setFromUnitVectors(_up, _b.normalize());
    m.pos.copy(_a); m.wx = _a.x; m.wz = _a.z;
    m.slot.s.material.opacity = .75 + Math.random() * .25;
    this.trails.add(m.tr, _a, ts);
    if (m.snd) { m.snd.wx = _a.x; m.snd.wz = _a.z; m.snd.g.position.y = _a.y; }
    if (m.kind === 'B' && s < .16 && typeof FX !== 'undefined') { const lp = m.lp || _a; for (let k = 0; k < 3; k++) { const f = k / 3; FX.spawn(0, mix(lp.x, _a.x, f) + rr(-.8, .8), mix(lp.y, _a.y, f) - 3, mix(lp.z, _a.z, f) + rr(-.8, .8), rr(-1.2, 1.2), rr(-.6, .6), rr(-1.2, 1.2), 3.5 + Math.random() * 2.5, 6.5); } m.lp = (m.lp || new THREE.Vector3()).copy(_a); }
  }
  this.trails.tick(ts, cam.position);
  for (const d of this.drones) {
    d.ph += d.w * dt; const x = d.cx + Math.cos(d.ph) * d.r, z = d.cz + Math.sin(d.ph) * d.r;
    const sg = Math.sign(d.w), vx = -Math.sin(d.ph) * sg, vz = Math.cos(d.ph) * sg;
    d.m.position.set(x, d.y + Math.sin(ts * .7 + d.ph) * 1.2, z); d.m.rotation.set(sg * .24, Math.atan2(-vz, vx), 0);
    d.b.visible = Math.sin(ts * 6 + d.ph) > .6;
  }
};
A4.hit = function (m) {
  const p = m.p1;
  if (m.kind === 'I') { if (m.target && m.target.on) { this.airburst(m.pos, 1.4); this.free(m.target); AUDIO.play('intercept', { x: m.pos.x, z: m.pos.z, vol: .9 }); if (VIEW === L) evt(VIEW, { k: 'intercept', p: VIEW.price }); K.say('intercept'); } return; }
  if (m.kind === 'B') { FX.explode(p.x, p.z, 3.1, 0xffd6a0, true); DIRECTOR.punch(1.1); K.pulse(); }
  else FX.explode(p.x, p.z, 2.2, 0xffc890, true);
};
A4.airburst = function (p, size) {
  const lite = this.lite;
  for (let i = 0; i < (lite ? 5 : 10); i++) FX.spawn(7, p.x + rr(-1, 1), p.y + rr(-1, 1), p.z + rr(-1, 1), rr(-4, 4), rr(-2, 4), rr(-4, 4), .7 + Math.random() * .5, 5 + size * 3);
  for (let i = 0; i < (lite ? 12 : 32); i++) FX.spawn(1, p.x, p.y, p.z, rr(-14, 14), rr(-6, 10), rr(-14, 14), .6 + Math.random() * .8, 1);
  FX.smoke(p.x, p.y, p.z, lite ? 4 : 9, 5, 0); FX.muzzle(p.x, p.y, p.z, 7 + size * 2); DIRECTOR.shake(.25);
};
/* ballistic barrage from the attacker's launchers; roughly every second missile meets an interceptor from the defender's SAM site */
A4.ballistic = function (att, tx, tz, n, usd, delay) {
  if (!this.ready) return;
  const tels = (K.env && K.env.tels[att]) || [];
  this.after(delay || 0, () => {
    tels.forEach(t => { t.tgt = 1; });
    HUD.radio('missile'); K.say('missile');
    for (let i = 0; i < n; i++) this.after(1500 + i * 450, () => this.launchB(att, tels.length ? tels[i % tels.length] : null, clamp(tx + rr(-9, 9), -72, 72), clamp(tz + rr(-14, 14), -36, 36), i));
  });
};
A4.launchB = function (att, tel, tx, tz, i) {
  let p0;
  if (tel && tel.ms) { tel.ms.updateMatrixWorld(true); p0 = tel.ms.getWorldPosition(new THREE.Vector3()); tel.ms.visible = false; tel.reload = 16; }
  else { const d = att === 'bull' ? -1 : 1; p0 = new THREE.Vector3(d * 32, ARMY.gy(d * 32, -70) + 4, -70); }
  const p1 = new THREE.Vector3(tx, ARMY.gy(tx, tz), tz);
  const m = this.spawn('B', att, p0, p1, 5.4 + Math.random() * .6, 115 + Math.random() * 35); if (!m) return;
  FX.smoke(p0.x, p0.y - 2.5, p0.z, this.lite ? 7 : 16, 6, 0); FX.muzzle(p0.x, p0.y - 3, p0.z, 5);
  AUDIO.play('missile', { x: p0.x, z: p0.z, vol: .95 });
  const def = att === 'bull' ? 'bear' : 'bull';
  if (K.env && K.env.sams[def].length && (i % 2 === 1 || Math.random() < .25)) this.after(1700 + Math.random() * 500, () => this.launchI(def, m));
};
A4.launchI = function (def, target) {
  if (!target || !target.on) return;
  const sam = K.env.sams[def][0], p0 = sam.tip.clone(), tm = 1.8;
  const sT = ((vt() - target.t0) / 1000 + tm) / target.dur; if (sT >= .9) return;
  const pm = this.posAt(target, sT);
  const m = this.spawn('I', def, p0, pm, tm, 0); if (!m) return; m.target = target;
  FX.smoke(p0.x, p0.y, p0.z, this.lite ? 3 : 6, 3, 0); FX.muzzle(p0.x, p0.y, p0.z, 2.6);
  AUDIO.play('missile', { x: p0.x, z: p0.z, vol: .6, small: true });
};
/* cruise missiles: come in low from the attacker's rear, weave, pop up and dive on the target */
A4.cruise = function (att, tx, tz, n, delay) {
  if (!this.ready) return;
  this.after(delay || 0, () => {
    HUD.radio('cruise'); K.say('cruise');
    for (let i = 0; i < n; i++) this.after(i * 380, () => {
      const d = att === 'bull' ? -1 : 1, p0 = new THREE.Vector3(d * 236, 26, clamp(tz + rr(-70, 70), -110, 90));
      const p1 = new THREE.Vector3(clamp(tx + rr(-10, 10), -72, 72), 0, clamp(tz + rr(-16, 16), -36, 36)); p1.y = ARMY.gy(p1.x, p1.z);
      const m = this.spawn('C', att, p0, p1, Math.hypot(p1.x - p0.x, p1.z - p0.z) / 88, 0); if (!m) return;
      if (i === 0) { m.snd = { wx: p0.x, wz: p0.z, g: { position: { y: p0.y } } }; AUDIO.play('cruise', { x: p0.x, z: p0.z, vol: .85, dur: m.dur, follow: m.snd }); }
    });
  });
};
/* jet formation (2 = strike pair, 5 = V formation) using the shared aircraft pool */
A4.formation = function (att, tx, tz, n, usd, delay) {
  this.after(delay || 0, () => {
    const dir = att === 'bull' ? -1 : 1; let lead = null;
    for (let k = 0; k < n; k++) {
      const a = FX.pick('jet', att); if (!a) break;
      const row = Math.ceil(k / 2), sd = k % 2 ? 1 : -1, dz = k ? sd * row * 7 : 0, back = row * 9;
      a.on = true; a.att = att; a.t0 = vt(); a.dur = 3.0; a.x0 = dir * (240 + back); a.x1 = -dir * (240 - back); a.z = clamp(tz + dz, -60, 60); a.y = 26 + row * 1.6;
      a.tx = clamp(tx + rr(-4, 4) + dz * .25, -72, 72); a.tz = clamp(tz + dz * .6, -36, 36); a.dir = dir; a.dropped = false; a.usd = usd; a.nuke = false; a.g.visible = true; a.g.rotation.set(0, dir < 0 ? 0 : Math.PI, 0);
      if (!lead) { lead = a; AUDIO.play('jet', { x: a.x0, z: a.z, vol: 1, dur: 3.4, follow: a }); }
    }
    if (lead && n >= 4) this.after(1350, () => AUDIO.play('boom', { vol: .85 }));
    if (lead) HUD.radio('incoming');
  });
};

/* ---------------------------------------------------------------- sound designs (synthesised; routed through battle.js AUDIO buses) */
const rel = (A, end) => setTimeout(() => { A.voices = Math.max(0, A.voices - 1); }, Math.max(0, (end - A.ctx.currentTime) * 1000) + 60);
K.SFX = {
  missile(A, o) {
    const C = A.ctx, t0 = C.currentTime + (o.delay || 0), v = o.vol == null ? .8 : o.vol, dur = o.small ? 1.7 : 3.6, g = A.out(o, 'sfx');
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(o.small ? 3200 : 1700, t0); lp.frequency.exponentialRampToValueAtTime(o.small ? 900 : 420, t0 + dur);
    const s = A.src('white', 1); s.connect(lp).connect(g);
    const b = A.src('brown', .8), bg = C.createGain(); bg.gain.value = o.small ? .5 : 1.4; b.connect(bg).connect(g);
    const cr = C.createGain(); cr.gain.value = 0; const s2 = A.src('white', 2.2); const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; s2.connect(hp).connect(cr).connect(g);
    for (let t = t0 + .05; t < t0 + dur * .8; t += .03 + Math.random() * .05) { cr.gain.setValueAtTime(.35 * v * Math.random(), t); cr.gain.setValueAtTime(0, t + .012); }
    A.env(g, t0, .06, v, dur * .5, v * .55, dur * .44, t0 + dur);
    s.start(t0); s.stop(t0 + dur); b.start(t0); b.stop(t0 + dur); s2.start(t0); s2.stop(t0 + dur); rel(A, t0 + dur);
  },
  cruise(A, o) {
    const C = A.ctx, t0 = C.currentTime, v = o.vol == null ? .7 : o.vol, dur = Math.max(1.5, o.dur || 3), g = A.out(o, 'sfx');
    const os = C.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(1380, t0); os.frequency.setValueAtTime(1380, t0 + dur * .7); os.frequency.exponentialRampToValueAtTime(760, t0 + dur);
    const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 1.6; const og = C.createGain(); og.gain.value = .2; os.connect(og).connect(bp).connect(g);
    const s = A.src('white', 1.2), hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700; const sg = C.createGain(); sg.gain.value = .75; s.connect(hp).connect(sg).connect(g);
    A.env(g, t0, dur * .6, v, dur * .25, v * .7, dur * .15, t0 + dur);
    os.start(t0); os.stop(t0 + dur); s.start(t0); s.stop(t0 + dur); rel(A, t0 + dur);
  },
  boom(A, o) {
    const C = A.ctx, t0 = C.currentTime + (o.delay || 0), v = o.vol == null ? .9 : o.vol, g = A.out(o, 'sfx');
    for (const d of [0, .12]) { const s = A.src('white', 1), f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1700; const k = C.createGain(); s.connect(f).connect(k).connect(g); A.env(k, t0 + d, .004, v, .3, null, 0, t0 + d + .5); s.start(t0 + d); s.stop(t0 + d + .55); }
    const o2 = C.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(72, t0); o2.frequency.exponentialRampToValueAtTime(30, t0 + .7); const k2 = C.createGain(); o2.connect(k2).connect(g); A.env(k2, t0, .01, v, .6, null, 0, t0 + .8); o2.start(t0); o2.stop(t0 + .85);
    rel(A, t0 + .9);
  },
  intercept(A, o) {
    const C = A.ctx, t0 = C.currentTime, v = o.vol == null ? .85 : o.vol, g = A.out(o, 'sfx');
    const s = A.src('white', 1.3), f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(2600, t0); f.frequency.exponentialRampToValueAtTime(320, t0 + 1.1); f.Q.value = .8; s.connect(f).connect(g);
    const o2 = C.createOscillator(); o2.type = 'triangle'; o2.frequency.setValueAtTime(140, t0); o2.frequency.exponentialRampToValueAtTime(45, t0 + .5); const k = C.createGain(); o2.connect(k).connect(g); A.env(k, t0, .005, v * .8, .45, null, 0, t0 + .6);
    A.env(g, t0, .003, v, .9, null, 0, t0 + 1.3); s.start(t0); s.stop(t0 + 1.35); o2.start(t0); o2.stop(t0 + .65); rel(A, t0 + 1.4);
  }
};

/* ---------------------------------------------------------------- radio voice call-outs (speech synthesis on the voice bus volume) */
const SAY = {
  missile: { fa: 'پرتاب موشک شناسایی شد', en: 'Missile launch detected' },
  intercept: { fa: 'رهگیری موفق', en: 'Intercept confirmed' },
  raid: { fa: 'حمله‌ی هوایی گسترده، پناه بگیرید', en: 'Air raid, take cover' },
  air: { fa: 'پشتیبانی هوایی در راه است', en: 'Air support inbound' },
  cruise: { fa: 'موشک کروز در مسیر', en: 'Cruise missiles inbound' }
};
K.say = function (key) {
  try {
    if (!window.speechSynthesis || typeof AUDIO === 'undefined' || !AUDIO.on || !SAY[key]) return;
    const t = performance.now(); if (t - (K._sayT || 0) < 8000) return; K._sayT = t;
    const vol = PREF && PREF.vol ? (PREF.vol.voice == null ? .8 : PREF.vol.voice) * (PREF.vol.master == null ? 1 : PREF.vol.master) : .8; if (vol < .03) return;
    const lg = typeof lang !== 'undefined' ? lang : 'fa', vs = speechSynthesis.getVoices();
    let v = null, text = SAY[key].en, code = 'en-US';
    if (lg !== 'en') { const fv = vs.find(x => /^fa/i.test(x.lang)); if (fv) { v = fv; text = SAY[key].fa; code = fv.lang; } }
    if (!v) v = vs.find(x => /^en/i.test(x.lang)) || null;
    const u = new SpeechSynthesisUtterance(text); u.lang = code; if (v) u.voice = v; u.volume = cl(vol, 0, 1); u.rate = 1.08; u.pitch = .8;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* speech is optional */ }
};

/* ---------------------------------------------------------------- wiring */
G.terrainMod = K.terrainMod;
K.boot = function () { if (K.env) K.env.vehicles(); A4.init(); };
})();
