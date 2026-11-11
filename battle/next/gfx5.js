/* entekhab.net — «نبرد کن» 5.0 kit (three.js r128; loaded after gfx4.js and before battle.js)
   Infantry: one detailed soldier (rifleman, machine-gunner, anti-tank gunner, squad leader) posed per soldier on the CPU
   (two-bone arm IK, smooth blending between stances) and drawn instanced.
   Theatre: a northern coast and sea, a destroyer, a frigate and a submarine per army, harbour, radar stations.
   Space and air: reconnaissance satellites with a scan beam, FPV drones.
   Graphics helpers only; battle.js objects (scene, FX, AUDIO, ARMY, WORLD, DIRECTOR …) are read at run time. */
(function () {
'use strict';
const G = window.GFX, K = window.GFX5 = {};
const TAU = Math.PI * 2;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rr = (a, b) => a + Math.random() * (b - a);
const L3 = h => { const c = new THREE.Color(h).convertSRGBToLinear(); return [c.r, c.g, c.b]; };

/* ================================================================== indexed geometry helpers
   Everything here keeps shared vertices (smooth parts cost a third of the vertices of a non-indexed mesh). */
function mergeI(list, attrs) {             // attrs: extra float attributes to carry, e.g. ['aPM'] or ['color:3']
  attrs = (attrs || []).map(a => { const [n, s] = a.split(':'); return { n, s: +s || 1 }; });
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const X = attrs.map(a => new Float32Array(nv * a.s));
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, c = p.count;
    P.set(p.array.subarray(0, c * 3), vo * 3); if (n) N.set(n.array.subarray(0, c * 3), vo * 3);
    attrs.forEach((a, k) => { const s = g.attributes[a.n]; if (s) X[k].set(s.array.subarray(0, c * a.s), vo * a.s); else if (a.n === 'color') X[k].fill(1, vo * a.s, (vo + c) * a.s); });
    if (g.index) { const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[io++] = ix[i] + vo; } else for (let i = 0; i < c; i++) I[io++] = vo + i;
    vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  attrs.forEach((a, k) => out.setAttribute(a.n, new THREE.BufferAttribute(X[k], a.s)));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  return out;
}
K.mergeI = mergeI;
/* lofted shell through elliptical rings [y, rx, rz, cx] (bottom → top) */
function loft(rings, seg, capTop, capBot) {
  const P = [], I = [], n = rings.length;
  for (const [y, rx, rz, cx] of rings) for (let j = 0; j < seg; j++) { const a = j / seg * TAU; P.push((cx || 0) + Math.cos(a) * rx, y, Math.sin(a) * rz); }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg; I.push(a, c, b, b, c, d); }
  if (capTop) { const r = rings[n - 1], k = P.length / 3; P.push(r[3] || 0, r[0] + Math.min(r[1], r[2]) * .35, 0); for (let j = 0; j < seg; j++) I.push((n - 1) * seg + j, k, (n - 1) * seg + (j + 1) % seg); }
  if (capBot) { const r = rings[0], k = P.length / 3; P.push(r[3] || 0, r[0] - Math.min(r[1], r[2]) * .2, 0); for (let j = 0; j < seg; j++) I.push((j + 1) % seg, k, j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
}
/* soft box: eight shared corners, so it shades like a rounded pouch and costs 8 vertices instead of 24 */
function sbox(w, h, d, x, y, z, rot) {
  const P = [], N = [];
  for (let i = 0; i < 8; i++) { const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1; P.push(sx * w / 2, sy * h / 2, sz * d / 2); const l = Math.hypot(1 / w, 1 / h, 1 / d); N.push(sx / w / l, sy / h / l, sz / d / l); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setIndex([0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5]);
  if (rot) g.rotateZ(rot); g.translate(x || 0, y || 0, z || 0); return g;
}
const tube = (rTop, rBot, yTop, yBot, seg, x, z) => { const g = new THREE.CylinderGeometry(rTop, rBot, yTop - yBot, seg, 1, true); g.translate(x || 0, (yTop + yBot) / 2, z || 0); return g; };
const ball = (r, ws, hs, x, y, z, sx, sy, sz) => { const g = new THREE.SphereGeometry(r, ws, hs); if (sx) g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
const rodX = (r0, r1, x0, x1, seg, y, z, cap) => { const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, seg, 1, !cap); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, y, z); return g; };   // along +x: radius r0 at x0 → r1 at x1
K.loft = loft; K.sbox = sbox; K.tube = tube; K.ball = ball; K.rodX = rodX;

/* ================================================================== infantry
   Faces +X, Y up, left = +Z, 1 unit = 1 m (top of helmet 1.83).
   One geometry per role (0 rifle, 1 machine gun, 2 anti-tank, 3 leader) at two levels of detail; aPM = bone + 32 × surface.
   Bones: 0 pelvis · 1 torso · 2 head · 3/4 left thigh/shin · 5/6 right thigh/shin · 7/8 left arm · 9/10 right arm · 11 weapon
   Surfaces: 0 camouflage cloth · 1 skin · 2 gun metal · 3 webbing · 4 team accent · 5 boots and gloves · 6 dark kit · 7 lens · 8 olive tube / furniture
   Skinning: the CPU writes twelve 3×4 bone matrices per soldier into one float texture (37 texels a row); the vertex shader reads its bone's
   three texels. A vertex therefore costs a few dot products on any GPU, and a software rasteriser can afford the squads. */
const HIP = .93, SHO = 1.46, ELB = 1.17, KNEE = .5, UA = .29, FA = .3;
const WP = [.08, 1.24], WG_R = [.065, 1.17], WG_L = [.4, 1.2];        // weapon pivot and the two grips (rifle and machine gun)
const AP = [0, 1.5], AG_R = [.16, 1.44], AG_L = [.36, 1.45];          // the same for the launcher on the shoulder
const ROWT = 37;                                                       // texels per soldier: 12 bones × 3 + 1 (seed, rank + 10 × role)
K.infantryGeo = function (role, lod) {
  const hi = !lod, L = [], add = (g, bone, mat) => { const n = g.attributes.position.count; g.setAttribute('aPM', new THREE.BufferAttribute(new Float32Array(n).fill(bone + mat * 32), 1)); L.push(g); };
  const CAMO = 0, SKIN = 1, METAL = 2, GEAR = 3, ACC = 4, BOOT = 5, DARK = 6, LENS = 7, OLIVE = 8, TS = hi ? 8 : 5, LS = hi ? 10 : 6;
  /* legs */
  [[.105, 3, 4], [-.105, 5, 6]].forEach(([z, th, sh]) => {
    const s = Math.sign(z);
    add(tube(.094, .074, .96, KNEE, TS, 0, z), th, CAMO);
    if (hi) { add(sbox(.11, .16, .045, -.005, .73, z + s * .082), th, CAMO); add(ball(.073, 6, 4, .012, KNEE, z), sh, CAMO); }
    add(sbox(.06, .13, .12, .062, KNEE + .005, z), sh, DARK);                      // knee pad
    add(tube(.07, .056, KNEE + (hi ? 0 : .03), hi ? .2 : .08, TS, .008, z), sh, CAMO);
    if (hi) add(tube(.059, .064, .25, .06, 8, 0, z), sh, BOOT);
    add(sbox(.28, hi ? .1 : .13, .108, .078, hi ? .05 : .065, z), sh, BOOT);
  });
  if (hi) add(sbox(.07, .17, .04, 0, .77, -.2), 5, DARK);                          // thigh holster
  /* pelvis, belt */
  add(loft(hi ? [[.84, .1, .14, 0], [.9, .116, .166, 0], [1.0, .113, .16, 0], [1.045, .108, .155, 0]] : [[.84, .1, .14, 0], [.92, .118, .168, 0], [1.045, .11, .157, 0]], LS, false, true), 0, CAMO);
  if (hi) { add(loft([[.985, .12, .17, 0], [1.035, .12, .17, 0]], 10), 0, DARK); add(sbox(.07, .11, .09, -.03, .955, .19), 0, GEAR); add(sbox(.08, .13, .07, -.07, .95, -.185), 0, GEAR); }
  /* torso, plate carrier, pouches, pack */
  add(loft(hi ? [[1.0, .106, .152, 0], [1.1, .112, .158, .004], [1.25, .126, .178, .008], [1.38, .126, .198, .004], [1.46, .105, .2, 0], [1.51, .072, .12, 0], [1.535, .054, .062, 0]]
              : [[1.0, .108, .154, 0], [1.25, .126, .18, .008], [1.4, .124, .2, .004], [1.48, .09, .17, 0], [1.535, .054, .064, 0]], LS, true), 1, CAMO);
  add(sbox(.06, .31, .29, .118, 1.265, 0), 1, GEAR); add(sbox(.06, .31, .29, -.118, 1.265, 0), 1, GEAR);
  if (hi) {
    [.176, -.176].forEach(z => add(sbox(.2, .15, .04, 0, 1.15, z), 1, GEAR));
    [.105, -.105].forEach(z => add(sbox(.24, .035, .06, 0, 1.478, z), 1, GEAR));
    [-.088, 0, .088].forEach(z => add(sbox(.05, .125, .072, .168, 1.15, z), 1, DARK));
    add(sbox(.03, .085, .15, .158, 1.335, .0), 1, GEAR); add(sbox(.04, .115, .05, .152, 1.37, .112), 1, DARK); add(sbox(.014, .05, .075, .182, 1.34, -.07), 1, ACC);
    [.165, -.165].forEach(z => add(sbox(.09, .15, .05, -.21, 1.19, z), 1, GEAR));
    const r = new THREE.CylinderGeometry(.052, .052, .27, 8); r.rotateX(Math.PI / 2); r.translate(-.215, 1.455, 0); add(r, 1, CAMO);
  } else add(sbox(.05, .125, .25, .168, 1.15, 0), 1, DARK);
  add(sbox(.014, .065, .11, role === 1 ? -.318 : -.292, 1.4, 0), 1, ACC);
  if (role === 1) { add(sbox(.15, .31, .25, -.235, 1.265, 0), 1, OLIVE); add(sbox(.045, .17, .17, .105, .915, 0), 0, GEAR); [.228, -.228].forEach(zz => add(ball(.088, hi ? 6 : 5, hi ? 4 : 3, 0, 1.475, zz, 1, .78, 1), zz > 0 ? 7 : 9, GEAR)); if (hi) add(loft([[1.5, .104, .11, 0], [1.575, .086, .092, .004]], 10), 1, GEAR); }
  else add(sbox(.14, .35, .28, -.215, 1.25, 0), 1, DARK);
  /* head, glasses, helmet, ear cups */
  add(tube(.05, .057, 1.6, 1.5, hi ? 8 : 5, .005, 0), 2, SKIN);
  if (hi) add(loft([[1.5, .078, .088, .004], [1.55, .07, .08, .008]], 8), 2, CAMO);
  add(ball(.098, hi ? 10 : 7, hi ? 7 : 4, .014, 1.665, 0, 1.04, 1.16, .92), 2, SKIN);
  if (hi) add(sbox(.034, .04, .032, .116, 1.648, 0), 2, SKIN);                      // nose
  add(sbox(.03, .038, .152, .106, 1.683, 0), 2, LENS);
  add(loft(hi ? [[1.668, .133, .119, -.004], [1.7, .139, .125, -.006], [1.752, .129, .117, -.008], [1.797, .099, .091, -.008], [1.826, .052, .047, -.006]]
              : [[1.668, .134, .12, -.004], [1.712, .139, .125, -.006], [1.775, .116, .106, -.008], [1.824, .056, .05, -.006]], hi ? 10 : 7, true), 2, CAMO);
  add(loft([[1.69, .1405, .1265, -.006], [1.714, .1395, .1255, -.006]], hi ? 10 : 7), 2, ACC);
  if (hi) { [.109, -.109].forEach(z => add(sbox(.058, .075, .03, -.002, 1.66, z), 2, DARK)); add(sbox(.03, .042, .048, .137, 1.75, 0), 2, METAL); }
  /* arms */
  [[.215, 7, 8], [-.215, 9, 10]].forEach(([z, up, fo]) => {
    const s = Math.sign(z);
    if (hi) add(ball(.067, 6, 4, 0, SHO, z), up, CAMO);
    add(tube(.063, .052, SHO + (hi ? 0 : .04), ELB - (hi ? 0 : .02), TS, 0, z), up, CAMO);
    add(sbox(.075, .075, .014, 0, 1.365, z + s * .06), up, ACC);
    if (hi) { add(ball(.051, 6, 4, 0, ELB, z), fo, CAMO); add(sbox(.06, .1, .09, -.034, ELB, z), fo, DARK); }
    add(tube(.05, .041, ELB + (hi ? 0 : .02), .93, TS, 0, z), fo, CAMO);
    add(sbox(.078, .112, .052, .005, .874, z), fo, BOOT);
  });
  const y = WP[1], z = -.07, RS = hi ? 6 : 4;
  if (role === 0 || role === 3) {              /* rifle */
    add(sbox(.3, .076, .046, .16, y, z), 11, METAL); add(sbox(.26, .058, .05, .43, y + .002, z), 11, OLIVE);
    add(rodX(.013, .013, .56, .73, RS, y + .004, z), 11, METAL); if (hi) add(rodX(.018, .018, .71, .76, 6, y + .004, z, true), 11, METAL);
    add(sbox(.05, .16, .032, .2, y - .112, z, .2), 11, METAL); add(sbox(.04, .1, .034, .062, y - .078, z, -.28), 11, METAL);
    add(sbox(.2, .062, .04, -.09, y - .004, z), 11, OLIVE); if (hi) add(sbox(.035, .12, .046, -.2, y - .02, z), 11, METAL);
    add(sbox(.1, .05, .042, .2, y + .063, z), 11, DARK); if (hi) add(sbox(.03, .08, .03, .41, y - .066, z), 11, METAL);
  } else if (role === 1) {                     /* machine gun */
    add(sbox(.42, .09, .06, .2, y, z), 11, METAL); if (hi) add(sbox(.3, .03, .066, .2, y + .06, z), 11, DARK);
    add(rodX(.018, .018, .41, .85, RS, y + .004, z), 11, METAL); add(sbox(.26, .052, .052, .55, y + .004, z), 11, METAL);
    if (hi) add(rodX(.023, .023, .83, .89, 6, y + .004, z, true), 11, METAL);
    add(sbox(.13, .12, .1, .2, y - .105, z + .02), 11, OLIVE); add(sbox(.04, .1, .034, .03, y - .08, z, -.28), 11, METAL);
    add(sbox(.24, .075, .046, -.13, y - .005, z), 11, OLIVE); if (hi) { add(sbox(.035, .13, .05, -.25, y - .02, z), 11, METAL); add(sbox(.12, .022, .022, .32, y + .088, z), 11, METAL); }
    [.07, -.07].forEach(d => add(sbox(.02, .25, .02, .7, y - .13, z + d, .22), 11, METAL));
  } else {                                     /* anti-tank launcher on the right shoulder, spare rounds on the pack */
    const ay = 1.535, az = -.165;
    add(rodX(.058, .058, -.44, .52, hi ? 8 : 6, ay, az, true), 11, OLIVE); add(rodX(.088, .058, -.56, -.44, hi ? 8 : 6, ay, az), 11, OLIVE);
    if (hi) add(rodX(.067, .067, .5, .56, 8, ay, az), 11, METAL);
    add(sbox(.1, .07, .05, .2, ay + .068, az + .05), 11, DARK);
    if (hi) { add(sbox(.036, .1, .036, AG_R[0], ay - .082, az), 11, METAL); add(sbox(.036, .09, .036, AG_L[0], ay - .078, az), 11, METAL); add(sbox(.13, .03, .075, -.02, ay - .04, az), 11, DARK); }
    [.09, -.09].forEach(d => { const c = hi ? new THREE.CylinderGeometry(.034, .034, .5, 6) : sbox(.06, .5, .06, 0, 0, 0); c.translate(-.305, 1.3, d); add(c, 1, OLIVE); });
  }
  if (role === 3) {                            /* radio */
    add(sbox(.075, .13, .1, -.235, 1.5, .08), 1, DARK);
    const a = new THREE.CylinderGeometry(.005, .007, .72, hi ? 4 : 3, 1, true); a.translate(-.25, 1.92, .1); add(a, 1, METAL);
  }
  const g = mergeI(L, ['aPM']);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .9, 0), 4);
  return g;
};
/* one float texture holds every soldier's bones: a row per soldier */
K.boneTexture = function (rows) {
  const t = new THREE.DataTexture(new Float32Array(ROWT * rows * 4), ROWT, rows, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
};
K.skinOK = function (ren) { const c = ren.capabilities; return c.maxVertexTextures > 0 && (c.isWebGL2 || !!ren.extensions.get('OES_texture_float')); };
const INF_VS = `
attribute float aPM;attribute float aRow;uniform sampler2D uBones;uniform vec2 uBS;varying float vMat;varying vec3 vObj;varying float vRank;
`;
const INF_POSE = `
float mt=floor(aPM/32.+.01),bone=aPM-mt*32.;
#ifdef SKIN
float bv=(aRow+.5)*uBS.y,bu=(bone*3.+.5)*uBS.x;
vec4 r0=texture2D(uBones,vec2(bu,bv)),r1=texture2D(uBones,vec2(bu+uBS.x,bv)),r2=texture2D(uBones,vec2(bu+2.*uBS.x,bv)),me=texture2D(uBones,vec2(36.5*uBS.x,bv));
vec4 p4=vec4(position,1.);vec3 P0=vec3(dot(r0,p4),dot(r1,p4),dot(r2,p4));vec3 N0=normalize(vec3(dot(r0.xyz,normal),dot(r1.xyz,normal),dot(r2.xyz,normal)));
#else
vec3 P0=position;vec3 N0=normal;vec4 me=vec4(.5,0.,0.,0.);
#endif
vMat=mt;vObj=position*3.2+vec3(me.x*17.,0.,me.x*31.);vRank=me.y;
`;
const SK = L3(0xdcab85), GM = L3(0x2a2c2f), BT = L3(0x231f1b), LN = L3(0x0d1014);
const v3s = a => `vec3(${a.map(x => x.toFixed(4)).join(',')})`;
const INF_FS_HEAD = `uniform vec3 uC1,uC2,uC3,uAcc,uWeb,uOlv;uniform float uAccE;varying float vMat;varying vec3 vObj;varying float vRank;float SR=.85,SM=0.;vec3 SE=vec3(0.);
float hh(vec3 p){p=fract(p*.3183+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
const INF_FS_BODY = `
vec3 base;float rk=mod(vRank,10.);
if(vMat<.5){float n=n3(vObj)*.62+n3(vObj*2.6)*.38;base=n<.4?uC1:n<.6?uC2:uC3;SR=.92;}
else if(vMat<1.5){base=${v3s(SK)};SR=.6;}
else if(vMat<2.5){base=${v3s(GM)};SR=.42;SM=.55;}
else if(vMat<3.5){base=uWeb*(.86+.26*n3(vObj*1.7));SR=.82;}
else if(vMat<4.5){base=uAcc*(1.+step(1.5,rk)*.25);SE=uAcc*uAccE*(1.+step(.5,rk)*.5);SR=.5;}
else if(vMat<5.5){base=${v3s(BT)};SR=.72;}
else if(vMat<6.5){base=mix(uC3,${v3s(BT)},.45);SR=.86;}
else if(vMat<7.5){base=${v3s(LN)};SR=.12;SM=.5;}
else{base=uOlv;SR=.62;}
diffuseColor.rgb=base;`;
K.infantryMaterial = function (team, std, tex, rows, skin) {
  const m = std ? new THREE.MeshStandardMaterial({ roughness: .85, metalness: 0 }) : new THREE.MeshLambertMaterial({});
  m.userData.envK = .6; if (skin) m.defines = Object.assign(m.defines || {}, { SKIN: 1 });
  const TU = {
    uC1: { value: G.lin(team.c1) }, uC2: { value: G.lin(team.c2) }, uC3: { value: G.lin(team.c3) }, uAcc: { value: G.lin(team.acc) }, uAccE: { value: .5 },
    uWeb: { value: G.lin(team.c1).lerp(G.lin(0x6b5d43), .5) }, uOlv: { value: G.lin(team.c3).lerp(G.lin(0x4d5136), .6) },
    uBones: { value: tex }, uBS: { value: new THREE.Vector2(1 / ROWT, 1 / rows) }
  };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, TU);
    sh.vertexShader = INF_VS + sh.vertexShader.replace('#include <beginnormal_vertex>', INF_POSE + 'vec3 objectNormal=N0;').replace('#include <begin_vertex>', 'vec3 transformed=P0;');
    sh.fragmentShader = INF_FS_HEAD + sh.fragmentShader.replace('#include <color_fragment>', INF_FS_BODY).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=SE;');
    if (std) sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=SR;').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=SM;');
  };
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); if (skin) dm.defines = { SKIN: 1 };
  dm.onBeforeCompile = sh => { sh.uniforms.uBones = TU.uBones; sh.uniforms.uBS = TU.uBS; sh.vertexShader = INF_VS + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 normal=vec3(0.,1.,0.);' + INF_POSE + 'vec3 transformed=P0;'); };
  return { mat: m, depth: dm };
};
/* sagittal-plane affine [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f */
function rot(o, ang, cx, cy) { const c = Math.cos(ang), s = Math.sin(ang); o[0] = c; o[1] = s; o[2] = -s; o[3] = c; o[4] = cx - c * cx + s * cy; o[5] = cy - s * cx - c * cy; return o; }
function mul(o, A, B) {                     // o = A ∘ B (B first)
  const a = A[0] * B[0] + A[2] * B[1], b = A[1] * B[0] + A[3] * B[1], c = A[0] * B[2] + A[2] * B[3], d = A[1] * B[2] + A[3] * B[3], e = A[0] * B[4] + A[2] * B[5] + A[4], f = A[1] * B[4] + A[3] * B[5] + A[5];
  o[0] = a; o[1] = b; o[2] = c; o[3] = d; o[4] = e; o[5] = f; return o;
}
function put(T, o, M, zy, z0) {             // a sagittal affine as a 3×4 bone; z passes through, plus an optional shear along the limb
  T[o] = M[0]; T[o + 1] = M[2]; T[o + 2] = 0; T[o + 3] = M[4]; T[o + 4] = M[1]; T[o + 5] = M[3]; T[o + 6] = 0; T[o + 7] = M[5]; T[o + 8] = 0; T[o + 9] = zy || 0; T[o + 10] = 1; T[o + 11] = z0 || 0;
}
const Bm = new Float32Array(6), Um = new Float32Array(6), t1 = new Float32Array(6), t2 = new Float32Array(6), t3 = new Float32Array(6);
/* pose (20 floats at Q[o…], see K.pose) → the soldier's row of bone matrices */
K.bones = function (Q, o, role, T, row) {
  const to = row * ROWT * 4, g = Q[o + 15], hy = Q[o + 18];
  rot(Bm, Q[o + 12], 0, HIP); Bm[4] += Q[o + 13]; Bm[5] += Q[o + 14]; put(T, to, Bm);
  mul(Um, Bm, rot(t1, Q[o + 8], 0, 1)); put(T, to + 12, Um);
  mul(t2, Um, rot(t1, Q[o + 19], 0, 1.55));
  { const c = Math.cos(hy), s = Math.sin(hy), k = .005 - c * .005, p = to + 24; T[p] = t2[0] * c; T[p + 1] = t2[2]; T[p + 2] = t2[0] * s; T[p + 3] = t2[0] * k + t2[4]; T[p + 4] = t2[1] * c; T[p + 5] = t2[3]; T[p + 6] = t2[1] * s; T[p + 7] = t2[1] * k + t2[5]; T[p + 8] = -s; T[p + 9] = 0; T[p + 10] = c; T[p + 11] = s * .005; }
  mul(t2, Bm, rot(t1, Q[o], 0, HIP)); put(T, to + 36, t2); mul(t3, t2, rot(t1, Q[o + 1], .012, KNEE)); put(T, to + 48, t3);
  mul(t2, Bm, rot(t1, Q[o + 2], 0, HIP)); put(T, to + 60, t2); mul(t3, t2, rot(t1, Q[o + 3], .012, KNEE)); put(T, to + 72, t3);
  const dL = (role === 2 ? -.38 : -.235) * g, dR = (role === 2 ? .05 : .095) * g, fk = 2.4, f0 = .29 + fk * ELB;   // the hands close on the weapon: a shear that grows along the arm
  mul(t2, Um, rot(t1, Q[o + 4], 0, SHO)); put(T, to + 84, t2, -dL, dL * SHO); mul(t3, t2, rot(t1, Q[o + 5], 0, ELB)); put(T, to + 96, t3, -fk * dL, dL * f0);
  mul(t2, Um, rot(t1, Q[o + 6], 0, SHO)); put(T, to + 108, t2, -dR, dR * SHO); mul(t3, t2, rot(t1, Q[o + 7], 0, ELB)); put(T, to + 120, t3, -fk * dR, dR * f0);
  const P = role === 2 ? AP : WP; rot(t1, Q[o + 9], P[0], P[1]); t1[4] += Q[o + 10]; t1[5] += Q[o + 11]; mul(t2, Um, t1); put(T, to + 132, t2);
  T[to + 144] = Q[o + 16]; T[to + 145] = Q[o + 17];
};

/* ------------------------------------------------------------------ posing (CPU, once per soldier per frame)
   Soldier fields read: st (state), t0 (ms, state start), sd (seed), role (0 rifle, 1 machine gun, 2 anti-tank, 3 leader),
   rank, stn (stance: 0 standing ready, 1 kneeling, 2 standing aim, 3 prone), shot (ms of the last shot).
   Field written: q (smoothed controls). Output: 20 floats at A[o…]. */
const ST = { IDLE: 0, RUN: 1, FIRE: 2, DIE: 3, CHEER: 4, REST: 5, STAG: 6, WALK: 7 };
K.ST = ST;
const eo = x => { x = cl(x, 0, 1); return 1 - (1 - x) * (1 - x) * (1 - x); };
const _ik = [0, 0];
function armIK(tx, ty) {                    // hand target in the torso frame → shoulder and elbow angles
  const dx = tx, dy = ty - SHO, d = cl(Math.hypot(dx, dy), .07, UA + FA - .004);
  const ca = cl((UA * UA + d * d - FA * FA) / (2 * UA * d), -1, 1), cb = cl((UA * UA + FA * FA - d * d) / (2 * UA * FA), -1, 1);
  _ik[0] = Math.atan2(dx, -dy) - Math.acos(ca); _ik[1] = Math.PI - Math.acos(cb); return _ik;
}
const C = new Float32Array(18);             // target controls of the soldier being posed
/* controls: 0 hL 1 kL 2 hR 3 kR · 4 aL0 5 aL1 6 aR0 7 aR1 (free arm angles) · 8 lean 9 rA 10 rX 11 rY · 12 F 13 bx 14 by 15 grip · 16 hy 17 hp */
K.stance = function (role, sd) { const v = (sd * 7.13) % 1; return role === 1 ? (v < .6 ? 3 : 1) : role === 2 ? (v < .65 ? 1 : 0) : role === 3 ? (v < .7 ? 0 : 1) : (v < .38 ? 0 : v < .76 ? 1 : 2); };
K.pose = function (s, tms, dt, A, o) {
  const st = s.st, t = tms / 1000, tt = Math.max(0, (tms - s.t0) / 1000), sd = s.sd, role = s.role | 0, at = role === 2, stn = s.stn | 0;
  const P = at ? AP : WP, GR = at ? AG_R : WG_R, GL = at ? AG_L : WG_L;
  let k = 10;
  /* standing ready */
  C[0] = .1; C[1] = -.14; C[2] = -.12; C[3] = -.05; C[4] = .5; C[5] = .7; C[6] = .4; C[7] = .9; C[8] = -.03;
  C[9] = at ? .5 : -.7; C[10] = at ? 0 : .12; C[11] = 0; C[12] = 0; C[13] = 0; C[14] = -.006; C[15] = 1; C[16] = 0; C[17] = 0;
  let cyc = 0, amp = 0, rec = 0;
  const still = st === ST.IDLE || st === ST.FIRE || st === ST.REST;
  if (st === ST.RUN || st === ST.WALK) {
    const run = st === ST.RUN; cyc = t * (run ? 10.5 : 6) + sd * TAU; amp = run ? 1 : .5;
    C[0] = 0; C[1] = -.2; C[2] = 0; C[3] = -.2; C[8] = run ? -.27 : -.09; C[9] = at ? .28 : .95; C[10] = at ? 0 : .02; C[11] = at ? 0 : -.02; C[14] = run ? -.05 : -.012; k = 14;
  } else if (still) {
    const fire = st === ST.FIRE, rest = st === ST.REST;
    const look = Math.sin(t * .35 + sd * 40) * (((sd * 7) % 1) > .4 ? .55 : .15);
    if (stn === 3) {                        // prone behind the gun
      C[0] = .04; C[1] = -.06; C[2] = -.07; C[3] = -.1; C[8] = rest ? .1 : .22; C[12] = -1.47; C[14] = -.73; C[13] = -.12;
      C[9] = 1.47 - C[8] + .03; C[10] = .075; C[11] = .576; C[17] = rest ? .55 : 1.0; C[16] = rest ? look : look * .3;
    } else if (stn === 1) {                 // kneeling
      C[0] = 1.56; C[1] = -1.52; C[2] = -.1; C[3] = -1.47; C[8] = -.07; C[14] = -.425;
      if (rest) { C[9] = at ? .7 : -.55; C[10] = at ? 0 : .1; C[11] = at ? 0 : .04; C[8] = .03; C[16] = look; C[17] = -.1; }
      else { C[9] = .02; C[10] = at ? 0 : .1; C[11] = at ? 0 : .2; C[16] = look * .35; C[17] = -.06; }
    } else if (stn === 2 || fire) {         // standing, weapon shouldered
      C[0] = .22; C[1] = -.2; C[2] = -.2; C[3] = -.08; C[8] = -.1; C[14] = -.03; C[9] = .01; C[10] = at ? 0 : .1; C[11] = at ? 0 : .215; C[16] = fire ? 0 : look * .3; C[17] = -.07;
      if (rest) { C[9] = at ? .7 : -.8; C[11] = 0; C[8] = -.02; C[16] = look; }
    } else {                                // standing ready
      C[16] = look; C[17] = -.04;
      if (role === 3 && !rest && ((t * .11 + sd * 3) % 1) < .3) { C[15] = 0; C[4] = 1.45; C[5] = .12; C[6] = .25; C[7] = .55; C[9] = -1.15; C[10] = .16; C[11] = -.2; }   // the leader points the way
      if (rest) { C[9] = at ? .9 : -1.05; C[10] = at ? 0 : .12; C[11] = at ? 0 : -.05; C[8] = .02; }
    }
    if (fire) { rec = Math.exp(-Math.max(0, tms - (s.shot || s.t0)) / 1000 * 14); k = 22; }
  } else if (st === ST.CHEER) {
    const j = Math.abs(Math.sin(t * 5.5 + sd * TAU)) * .3;
    C[0] = j * .9; C[2] = j * .9; C[1] = C[3] = -j * 1.6; C[14] = j; C[8] = .08; C[17] = .25; C[15] = 0;
    C[4] = 2.75 + Math.sin(t * 7 + sd) * .15; C[5] = .25; C[6] = 2.6; C[7] = .3; C[9] = at ? .9 : 1.45; k = 16;
  } else if (st === ST.STAG) {
    const a = Math.sin(cl(tt / 1.6, 0, 1) * Math.PI);
    C[0] = .1 + .7 * a; C[1] = -.14 - 1.0 * a; C[2] = -.12 + .5 * a; C[3] = -.05 - .95 * a; C[14] = -.2 * a; C[8] = -.03 - .5 * a; C[17] = -.3 * a; C[9] = at ? .5 : -.7 - .3 * a; k = 18;
  } else if (st === ST.DIE) {
    k = 26; C[15] = 0;
    if (stn === 3) { C[12] = -1.5; C[14] = -.76; C[13] = -.12; C[8] = 0; C[17] = .15; C[9] = 1.6; C[10] = .12; C[11] = .5; C[4] = 2.9; C[5] = .2; C[6] = 2.5; C[7] = .5; C[0] = .04; C[2] = -.07; k = 5; }
    else if (stn === 1) { C[0] = 1.2; C[1] = -1.4; C[2] = .2; C[3] = -1.3; C[12] = -1.45; C[14] = -.72; C[8] = .05; C[17] = .3; C[9] = -1.2; C[4] = 2.4; C[5] = .6; C[6] = .3; C[7] = .4; k = 4.5; }
    else {
      const b = eo(tt / .45), f = eo((tt - .25) / .75), dir = sd > .5 ? 1 : -1;
      const F = 1.48 * dir * f + .08 * dir * Math.sin(Math.min(1, Math.max(0, tt - .9) * 4) * Math.PI) * Math.exp(-Math.max(0, tt - .9) * 3);
      C[1] = -1.25 * b; C[3] = -1.05 * b; C[0] = .75 * b; C[2] = .55 * b;
      C[4] = mix(.62, dir > 0 ? 2.1 : -.4, f) + Math.sin(sd * 91) * .4; C[6] = mix(.48, dir > 0 ? 1.7 : .9, f) + Math.sin(sd * 57) * .5; C[5] = .2 + ((sd * 13) % 1) * .8; C[7] = .3 + ((sd * 29) % 1) * .7;
      C[12] = F; C[13] = -HIP * Math.sin(F); C[14] = HIP * (Math.cos(F) - 1) - .3 * b * (1 - f) + f * .1 + Math.abs(Math.sin(F)) * .12; C[9] = at ? .5 : .6 + f * .9; C[8] = 0;
    }
    C[14] -= Math.max(0, tt - 3) * .22;
  }
  /* smooth the controls so every change of state blends */
  let q = s.q; if (!q) { q = s.q = new Float32Array(18); q.set(C); }
  const a = 1 - Math.exp(-dt * k); for (let i = 0; i < 18; i++) q[i] += (C[i] - q[i]) * a;
  let hL = q[0], kL = q[1], hR = q[2], kR = q[3], lean = q[8], rA = q[9], rX = q[10], rY = q[11], by = q[14];
  if (amp) {                                 // stride
    const run = amp === 1, sw = run ? .82 : .42, kn = run ? .95 : .55;
    hL += Math.sin(cyc) * sw; hR += Math.sin(cyc + Math.PI) * sw; kL -= kn * Math.max(0, Math.sin(cyc + 1.35)); kR -= kn * Math.max(0, Math.sin(cyc + 4.49));
    by += Math.abs(Math.sin(cyc)) * (run ? .07 : .03); rY += Math.sin(cyc * 2) * .012; lean += Math.sin(cyc * 2) * .015;
  } else if (still && stn !== 3) { by += Math.sin(t * 1.7 + sd * TAU) * .004; rA += Math.sin(t * .6 + sd * 9) * .012; }
  if (rec > .01) { rX -= .035 * rec; rA += .05 * rec; lean += .025 * rec; }
  /* hands: IK to the two grips, blended with the free arm angles by "grip" */
  const g = q[15], cs = Math.cos(rA), sn = Math.sin(rA);
  let sL = q[4], eL = q[5], sR = q[6], eR = q[7];
  if (g > .01) {
    let x = GR[0] - P[0], y = GR[1] - P[1]; armIK(x * cs - y * sn + P[0] + rX, x * sn + y * cs + P[1] + rY); sR = mix(sR, _ik[0], g); eR = mix(eR, _ik[1], g);
    x = GL[0] - P[0]; y = GL[1] - P[1]; armIK(x * cs - y * sn + P[0] + rX, x * sn + y * cs + P[1] + rY); sL = mix(sL, _ik[0], g); eL = mix(eL, _ik[1], g);
  }
  if (g < .99 && !at && (st === ST.CHEER || st === ST.DIE || (st === ST.IDLE && role === 3))) {   // a weapon carried in the right hand follows that hand
    const a1 = sR, a2 = sR + eR, hx = UA * Math.sin(a1) + FA * Math.sin(a2), hy2 = SHO - UA * Math.cos(a1) - FA * Math.cos(a2);
    const x = GR[0] - P[0], y = GR[1] - P[1], w = 1 - g; rX = mix(rX, hx - (x * cs - y * sn + P[0]), w); rY = mix(rY, hy2 - (x * sn + y * cs + P[1]), w);
  }
  A[o] = hL; A[o + 1] = kL; A[o + 2] = hR; A[o + 3] = kR; A[o + 4] = sL; A[o + 5] = eL; A[o + 6] = sR; A[o + 7] = eR;
  A[o + 8] = lean; A[o + 9] = rA; A[o + 10] = rX; A[o + 11] = rY; A[o + 12] = q[12]; A[o + 13] = q[13]; A[o + 14] = by; A[o + 15] = g;
  A[o + 16] = sd; A[o + 17] = (s.rank | 0) + 10 * role; A[o + 18] = q[16]; A[o + 19] = q[17];
};
/* where the muzzle is (soldier-local x forward, y up), for flashes and tracers */
K.muzzle = function (s) { const stn = s.stn | 0; return s.role === 2 ? [.75, s.stn === 1 ? 1.12 : 1.55] : stn === 3 ? [1.55, .34] : stn === 1 ? [.95, 1.04] : [.95, 1.45]; };

})();
