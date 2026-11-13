/* entekhab.net — «نبرد من» kit (three.js r128; loaded after gfx4.js and before battle.js)
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
             · 9 armour plate and 10 lit sensor (the machines in gfx6.js: humanoid robots and robot dogs, which share this material and bone texture)
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
  add(sbox(.034, .04, .032, .116, 1.648, 0), 2, SKIN);                              // nose
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
    [.07, -.07].forEach(d => add(sbox(.02, .25, .02, .7, y - .13, z + d, .22), 11, METAL)); add(sbox(.05, .03, .16, .675, y - .012, z), 11, METAL);   // bipod clamp on the barrel
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
const INF_FS_HEAD = `uniform vec3 uC1,uC2,uC3,uAcc,uWeb,uOlv,uPlt;uniform float uAccE;varying float vMat;varying vec3 vObj;varying float vRank;float SR=.85,SM=0.;vec3 SE=vec3(0.);
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
else if(vMat<8.5){base=uOlv;SR=.62;}
else if(vMat<9.5){float n=n3(vObj*1.3);base=uPlt*(.88+.2*n);SR=.44;SM=.6;}
else{base=uAcc*1.25;SE=uAcc*uAccE*4.4;SR=.3;}
diffuseColor.rgb=base;`;
K.infantryMaterial = function (team, std, tex, rows, skin) {
  const m = std ? new THREE.MeshStandardMaterial({ roughness: .85, metalness: 0 }) : new THREE.MeshLambertMaterial({});
  m.userData.envK = .6; if (skin) m.defines = Object.assign(m.defines || {}, { SKIN: 1 });
  const TU = {
    uC1: { value: G.lin(team.c1) }, uC2: { value: G.lin(team.c2) }, uC3: { value: G.lin(team.c3) }, uAcc: { value: G.lin(team.acc) }, uAccE: { value: .5 },
    uWeb: { value: G.lin(team.c1).lerp(G.lin(0x6b5d43), .5) }, uOlv: { value: G.lin(team.c3).lerp(G.lin(0x4d5136), .6) },
    uPlt: { value: G.lin(team.c2).lerp(G.lin(0x8b9196), .62) },                 // machines: armour plate in the army's tone
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
K.stance = function (role, sd) { const v = (sd * 7.13) % 1; return role === 4 ? (v < .5 ? 2 : 0) : role === 1 ? (v < .6 ? 3 : 1) : role === 2 ? (v < .65 ? 1 : 0) : role === 3 ? (v < .7 ? 0 : 1) : (v < .38 ? 0 : v < .76 ? 1 : 2); };
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
    const look = role === 4 ? Math.sin(t * .6 + sd * 40) * .62 : Math.sin(t * .35 + sd * 40) * (((sd * 7) % 1) > .4 ? .55 : .15);
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
    by += Math.abs(Math.sin(cyc)) * (run ? .07 : .03) * (role === 4 ? .45 : 1); rY += Math.sin(cyc * 2) * .012; lean += Math.sin(cyc * 2) * .015;
  } else if (still && stn !== 3 && role !== 4) { by += Math.sin(t * 1.7 + sd * TAU) * .004; rA += Math.sin(t * .6 + sd * 9) * .012; }
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
K.rig = { HIP, SHO, ELB, KNEE, UA, FA, WP, ROWT, rot, mul, put };              // the skeleton's measures and the bone writers, for gfx6.js
/* where the muzzle is (soldier-local x forward, y up), for flashes and tracers */
K.muzzle = function (s) { const stn = s.stn | 0; return s.role === 2 ? [.75, s.stn === 1 ? 1.12 : 1.55] : stn === 3 ? [1.55, .34] : stn === 1 ? [.95, 1.04] : [.95, 1.45]; };


/* ================================================================== coast and sea
   North of the missile sites the old hills become dunes and a beach that falls into a bay (headlands stay at the far corners).
   gfx4 has already installed its terrain modifier (pads, lakes); this one wraps it. */
const SEA = K.SEA = G.seaY = -1.15;
/* the motor pool shed in each base's front south corner (x = ±(80 − dx), on the axis of the yard between the HQ and the front wall): inside 2·hw wide from z0 (back wall) to z1 (the door), walls th thick and H high, a door Hd high */
const GAR = K.GAR = { dx: 10.6, z0: -26.65, z1: -12.4, hw: 4.2, th: .35, H: 5.6, Hd: 4.9, y: [null, null] };
K.shed = side => { const m = side === 'bull' ? -1 : 1; return { x: m * (80 - GAR.dx), z: (GAR.z0 + GAR.z1) / 2, door: GAR.z1, hw: GAR.hw }; };
const shoreWob = x => 5 * G.fbmW(x * .028 + 9.1, 4.3, 2);
{
  const prev = G.terrainMod;
  G.terrainMod = function (raw) {
    const f = prev ? prev(raw) : raw;
    return function (x, z) {
      let h = f(x, z);
      /* each base's motor pool stands on level ground: its floor and apron, eased into the ground round them */
      if (z > -33 && z < -1 && Math.abs(Math.abs(x) - (80 - GAR.dx)) < 9) for (const s of [-1, 1]) {
        const cx = s * (80 - GAR.dx), dx = Math.max(0, Math.abs(x - cx) - (GAR.hw + GAR.th + .4)), dz = Math.max(0, GAR.z0 - GAR.th - .4 - z, z - GAR.z1 - 4.8), d = Math.hypot(dx, dz);
        if (d < 2.5) { const i = s < 0 ? 0 : 1; if (GAR.y[i] == null) GAR.y[i] = f(cx, (GAR.z0 + GAR.z1) / 2); h = mix(h, GAR.y[i], sm(2.5, 0, d)); }
      }
      if (z < -44) {
        const ax = Math.abs(x), keep = sm(150, 195, ax);
        h = mix(h, Math.min(h, 2.4), (1 - sm(22, 70, ax)) * sm(-44, -62, z));          // a gap in the ridge: the bay shows from the field
        if (z < -70) {
          const low = Math.min(h, 1.5 + .9 * G.fbmW(x * .05 + 2, z * .05 - 3, 2));
          h = mix(h, mix(low, h, keep), sm(-70, -90, z));
          const w = shoreWob(x); h = mix(h, -6.5 - 11 * sm(-165, -250, z), sm(-98 - w, -126 - w, z) * (1 - keep));   // the shelf drops away offshore: room for a submarine to dive
        }
      }
      return h;
    };
  };
  const K4 = window.GFX4;
  if (K4 && K4.blocked) { const pb = K4.blocked; K4.blocked = function (x, z, pad) { return (z < -96 - shoreWob(x) && Math.abs(x) < 172) || (Math.abs(Math.abs(x) - 80) < 20 && Math.abs(z) < 31) || pb(x, z, pad); }; }
}
/* coloured primitives (non-indexed: position, normal, colour) for static props, the way gfx4 builds its structures */
function prim(g, hex, k) { const gg = g.index ? g.toNonIndexed() : g, c = L3(hex), kk = k || 1; G.paint(gg, () => [c[0] * kk, c[1] * kk, c[2] * kk]); return gg; }
const B = (w, h, d, x, y, z, hex, k) => prim(G.T(new THREE.BoxGeometry(w, h, d), x, y, z), hex, k);
const CY = (r0, r1, h, seg, x, y, z, hex, open) => prim(G.T(new THREE.CylinderGeometry(r0, r1, h, seg, 1, !!open), x, y, z), hex);
const RB = (w, h, d, r, x, y, z, hex) => prim(G.T(G.rbox(w, h, d, r, 1), x, y, z), hex);
function moved(list, x, y, z, rot) { for (const g of list) { if (rot) g.rotateY(rot); g.translate(x, y, z); } return list; }
K.kit = { prim, B, CY, RB, moved, L3 };
let _noise = null;
K.noiseTex = function () {                     // one tileable fbm tile, shared by the sea and the wakes
  if (_noise) return _noise;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), im = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = cl(G.fbm(i / N, j / N, 4, 5, 77) * 255, 0, 255), k = (j * N + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); _noise = new THREE.CanvasTexture(c); _noise.wrapS = _noise.wrapT = THREE.RepeatWrapping; return _noise;
};
const TAIL = '\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}';
/* the sea for software renderers: two lookups of the noise tile, a grazing-angle blend to the sky colour, a sun streak */
K.seaMaterial = function () {
  const u = Object.assign(THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), {
    uT: { value: K.noiseTex() }, uTime: { value: 0 }, uDeep: { value: G.lin(0x14323a) }, uSky: { value: new THREE.Color(.2, .35, .6) }, uHor: { value: new THREE.Color(.6, .7, .8) },
    uSunCol: { value: new THREE.Color(1, .95, .85) }, uSunXZ: { value: new THREE.Vector2(0, -1) }, uGlint: { value: 1 }
  });
  return new THREE.ShaderMaterial({
    uniforms: u, fog: true,
    vertexShader: 'varying vec3 vW;varying float vD;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mv=viewMatrix*w;vD=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform sampler2D uT;uniform float uTime,uGlint,fogNear,fogFar;uniform vec3 fogColor,uDeep,uSky,uHor,uSunCol;uniform vec2 uSunXZ;varying vec3 vW;varying float vD;' +
      'void main(){vec2 p=vW.xz*.021;float t=uTime*.02;float n=texture2D(uT,p+vec2(t,t*.6)).r*.6+texture2D(uT,p*2.9-vec2(t*1.3,t*.5)).r*.4;' +
      'vec3 V=cameraPosition-vW;float d=length(V);float gr=1.-clamp(V.y/d,0.,1.);gr*=gr;gr*=gr;vec3 col=mix(uDeep,mix(uHor,uSky,.35),clamp(gr*.85+(n-.5)*.24,0.,1.));' +
      'float s=max(dot(normalize(-V.xz),uSunXZ),0.);s*=s;s*=s;col+=uSunCol*smoothstep(.6,.8,n)*s*s*uGlint*.55;' +
      'col=mix(col,fogColor,smoothstep(fogNear,fogFar,vD));gl_FragColor=vec4(col,1.);' + TAIL
  });
};

/* ------------------------------------------------------------------ ships
   Local frame: bow towards +x, y up from the waterline. A hull is lofted through stations [x, half beam at deck, half beam at the waterline, deck height]. */
function hullGeo(st, cTop, cBoot, cDeck) {
  const P = [], C = [], yW = -1.4, yM = .55, a = L3(cTop), b = L3(cBoot), d = L3(cDeck);
  const tri = (p, q, r, c) => { P.push(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2]); for (let i = 0; i < 3; i++) C.push(c[0], c[1], c[2]); };
  const quad = (p, q, r, s, c) => { tri(p, q, r, c); tri(p, r, s, c); };
  const mid = s => s[2] + (s[1] - s[2]) * (yM - yW) / (s[3] - yW);
  for (let i = 0; i < st.length - 1; i++) {
    const s0 = st[i], s1 = st[i + 1], m0 = mid(s0), m1 = mid(s1);
    for (const sg of [1, -1]) {
      const A = [s0[0], s0[3], sg * s0[1]], Bq = [s1[0], s1[3], sg * s1[1]], Cq = [s1[0], yM, sg * m1], D = [s0[0], yM, sg * m0], E = [s1[0], yW, sg * s1[2]], F = [s0[0], yW, sg * s0[2]];
      if (sg > 0) { quad(A, D, Cq, Bq, a); quad(D, F, E, Cq, b); } else { quad(A, Bq, Cq, D, a); quad(D, Cq, E, F, b); }
    }
    quad([s0[0], s0[3], s0[1]], [s1[0], s1[3], s1[1]], [s1[0], s1[3], -s1[1]], [s0[0], s0[3], -s0[1]], d);
  }
  const s = st[0]; quad([s[0], s[3], s[1]], [s[0], s[3], -s[1]], [s[0], yW, -s[2]], [s[0], yW, s[2]], a);
  const e = st[st.length - 1]; if (e[1] > .3) quad([e[0], e[3], -e[1]], [e[0], e[3], e[1]], [e[0], yW, e[2]], [e[0], yW, -e[2]], a);   // a bow that ends wide (the carrier's flare) is closed too
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); return g;
}
const NAVY = {
  bull: { hull: 0x65706f, boot: 0x3c1917, deck: 0x3d4547, sup: 0x7b8684, dark: 0x2b3033, band: 0x22c55e },
  bear: { hull: 0x7d766a, boot: 0x3c1917, deck: 0x4a4640, sup: 0x928a7b, dark: 0x33302b, band: 0xef4444 }
};
let _shipMat = null;
const shipMat = () => _shipMat || (_shipMat = G.std ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .25, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
K.ship = { hullGeo, NAVY, shipMat };
/* surface combatant: big = destroyer (56 m), otherwise frigate (40 m) */
K.warship = function (side, big) {
  const P = NAVY[side], k = big ? 1 : .72, L = [], g = new THREE.Group();
  const st = [[-28, 2.6, 2.3, 2.6], [-24, 3.4, 3.0, 2.6], [-10, 3.7, 3.4, 2.7], [6, 3.6, 3.3, 2.9], [16, 3.0, 2.3, 3.3], [23, 1.8, 1.0, 3.8], [28, .12, .05, 4.3]].map(s => [s[0] * k, s[1] * k, s[2] * k, s[3] * (big ? 1 : .86)]);
  L.push(hullGeo(st, P.hull, P.boot, P.deck));
  const dk = big ? 2.75 : 2.4;                                                                    // deck height amidships
  /* the deck's own height at x (the sheer rises towards the bow): fittings stand on it, not on a guess */
  const deckAt = x => { for (let i = 0; i < st.length - 1; i++) if (x <= st[i + 1][0]) { const f = cl((x - st[i][0]) / (st[i + 1][0] - st[i][0]), 0, 1); return mix(st[i][3], st[i + 1][3], f); } return st[st.length - 1][3]; };
  /* superstructure blocks: bottom below the deck line so they sit in the hull wherever the sheer runs */
  const SB = (w, top, d, x, bot, z, hex) => B(w, top - bot, d, x, (top + bot) / 2, z, hex);
  /* bridge, deckhouse, funnel(s), mast */
  L.push(SB(8 * k, dk + 3.2, 6.2 * k, 4 * k, dk - .35, 0, P.sup), B(5.4 * k, 2.1, 5.2 * k, 3.6 * k, dk + 4.25, 0, P.sup), B(5.5 * k, .55, 5.3 * k, 3.6 * k, dk + 4.55, 0, 0x10161b));
  L.push(SB(9 * k, dk + 2.6, 5.6 * k, -5.5 * k, dk - .35, 0, P.sup));
  L.push(SB(3.2 * k, dk + 2.6, 3.4 * k, -11.3 * k, dk - .35, 0, P.sup));                             // after deckhouse extension: the close-in gun stands on it
  const fun = (x, r, h) => {
    const f = new THREE.CylinderGeometry(r * .72, r, h, 4); f.rotateY(Math.PI / 4); f.scale(1.35, 1, 1); f.translate(x, dk + 2.6 + h / 2, 0); L.push(prim(f, P.sup));
    const c = new THREE.CylinderGeometry(r * .75, r * .75, .35, 4); c.rotateY(Math.PI / 4); c.scale(1.35, 1, 1); c.translate(x, dk + 2.6 + h + .1, 0); L.push(prim(c, 0x16181a));
    const rAt = y => r - r * .28 * y / h, y0 = h * .62 - .35, y1 = h * .62 + .35;                  // the band hugs the funnel's taper
    const bd = new THREE.CylinderGeometry(rAt(y1) * 1.012, rAt(y0) * 1.012, .7, 4, 1, true); bd.rotateY(Math.PI / 4); bd.scale(1.35, 1, 1); bd.translate(x, dk + 2.6 + h * .62, 0); L.push(prim(bd, P.band));
  };
  fun(-3.2 * k, 1.5 * k, 3.3); if (big) fun(-9 * k, 1.25, 2.6);
  { const m = new THREE.CylinderGeometry(.34, .95 * k, 6.4, 4); m.rotateY(Math.PI / 4); m.translate(2.6 * k, dk + 5.3 + 3.2, 0); L.push(prim(m, P.sup)); L.push(B(.16, .16, 4.4 * k, 2.6 * k, dk + 9.6, 0, P.dark), CY(.05, .05, 3.2, 4, 2.6 * k, dk + 13.2, 0, P.dark)); }
  [[6.9 * k, 1], [6.9 * k, -1]].forEach(([x, sg]) => { const a = new THREE.BoxGeometry(.12, 1.7, 1.7); a.rotateY(sg * .7); a.translate(x - .35, dk + 4.1, sg * 2.5 * k); L.push(prim(a, P.dark)); });   // fixed array faces on the bridge front
  /* missile cells, close-in gun, boats, flight deck */
  const cells = (x, n) => { const d0 = deckAt(x); L.push(SB(n * .95 + .5, dk + .75, 3.5 * k, x, d0 - .3, 0, P.dark)); for (let i = 0; i < n; i++) for (const z of [-1.05, -.35, .35, 1.05]) L.push(B(.7, .08, .55 * k, x - (n - 1) * .475 + i * .95, dk + .79, z * k, 0x6b7376)); };
  cells(11.6 * k, big ? 4 : 3); if (big) cells(-15.5, 3);
  L.push(CY(.55, .7, 1.1, 8, -11.5 * k, dk + 3.15, 0, 0xdadcd8), prim(G.T(new THREE.SphereGeometry(.6, 8, 5, 0, TAU, 0, Math.PI / 2), -11.5 * k, dk + 3.7, 0), 0xe6e7e2));
  /* sea boats on chocks beside the deckhouse */
  [1, -1].forEach(sg => { const z = sg * 3.22 * k, y0 = deckAt(-6 * k); L.push(RB(2.6 * k, .7, .84 * k, .25, -6 * k, y0 + .62, z, 0xd2641c)); for (const dx of [-.8, .8]) L.push(B(.24, .4, .6 * k, -6 * k + dx * k, y0 + .15, z, P.dark)); });
  { const x = -23 * k, y = deckAt(x) + .03; L.push(B(1.9, .05, .28, x, y, .7, 0xe9e7df), B(1.9, .05, .28, x, y, -.7, 0xe9e7df), B(.28, .05, 1.4, x, y, 0, 0xe9e7df)); }
  { const x = -27.4 * k, y = deckAt(x); L.push(CY(.04, .04, 2.7, 4, x, y + 1.3, 0, 0xcfd2d0), prim(G.T(new THREE.PlaneGeometry(1.9, 1.15), x + .97, y + 2.0, 0), P.band)); }
  const body = new THREE.Mesh(G.merge(L), shipMat()); body.castShadow = !!G.std; g.add(body);
  /* gun turret (turns), radar bar (spins) */
  const tur = new THREE.Group(); tur.position.set(17.4 * k, deckAt(17.4 * k) - .05, 0);
  const brl = new THREE.CylinderGeometry(.13, .17, 3.6 * k, 8); brl.rotateZ(-Math.PI / 2 + .28); brl.translate(1.9 * k, .95, 0);
  tur.add(new THREE.Mesh(G.merge([CY(1.25 * k, 1.35 * k, .45, 10, 0, .22, 0, P.dark), RB(2.5 * k, 1.35, 2.1 * k, .3, 0, 1.1, 0, P.sup), prim(brl, P.dark)]), shipMat())); g.add(tur);
  const rad = new THREE.Mesh(G.merge([B(3.3 * k, .34, .45, 0, 0, 0, P.dark), CY(.16, .2, .5, 6, 0, -.3, 0, P.dark)]), shipMat()); rad.position.set(2.6 * k, dk + 12.1, 0); g.add(rad);
  /* wake */
  const wk = new THREE.Mesh(new THREE.PlaneGeometry(44 * k, 12 * k, 1, 1), K.wakeMat()); wk.rotation.x = -Math.PI / 2; wk.position.set(-47 * k, .06, 0); wk.renderOrder = 3; g.add(wk);
  g.userData = { side, big, tur, rad, wk, len: 56 * k, gunTip: new THREE.Vector3(3.6 * k, 1.5, 0), vls: new THREE.Vector3(11.6 * k, dk + 1.2, 0) };
  return g;
};
let _wake = null;
K.wakeMat = function () {
  if (_wake) return _wake;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'), im = x.createImageData(256, 64);
  for (let j = 0; j < 64; j++) for (let i = 0; i < 256; i++) { const u = i / 255, v = Math.abs(j / 63 - .5) * 2, w = .16 + (1 - u) * .84, e = cl(1 - v / w, 0, 1), n = G.fbm(i / 256, j / 64 * .25, 8, 4, 31), a = e * (.25 + .75 * cl(v / w * 1.6, 0, 1)) * Math.pow(u, 1.7) * cl((n - .3) * 2.6, 0, 1.2), k = (j * 256 + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = cl(a * 235, 0, 255); }
  x.putImageData(im, 0, 0);
  _wake = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: .5, fog: true }); return _wake;
};
/* attack submarine: local origin on the waterline when surfaced */
K.submarine = function (side) {
  const P = NAVY[side], L = [], g = new THREE.Group(), blk = 0x16191c, r = 2.5, y = -1.35;
  const body = new THREE.CylinderGeometry(r, r, 26, 12, 1, true); body.rotateZ(Math.PI / 2); body.translate(-1, y, 0); L.push(prim(body, blk));
  const bow = new THREE.SphereGeometry(r, 12, 6, 0, TAU, 0, Math.PI / 2); bow.rotateZ(-Math.PI / 2); bow.scale(1.5, 1, 1); bow.translate(12, y, 0); L.push(prim(bow, blk));
  const aft = new THREE.CylinderGeometry(.35, r, 9, 12, 1, true); aft.rotateZ(Math.PI / 2); aft.translate(-18.5, y, 0); L.push(prim(aft, blk));
  L.push(RB(6.4, 3.5, 1.5, .6, 3.2, y + r + 1.4, 0, blk), B(6.5, .3, 1.56, 3.2, y + r + 2.95, 0, P.band), B(1.4, .14, 4.6, 4.2, y + r + 1.9, 0, blk));
  L.push(CY(.07, .07, 2.6, 5, 4.6, y + r + 4.3, .2, 0x8b9091), CY(.1, .1, 1.6, 5, 2.4, y + r + 3.8, -.25, 0x8b9091));
  L.push(B(2.4, 3.6, .18, -21.4, y + .9, 0, blk), B(2.2, .16, 5.2, -21.4, y, 0, blk));
  for (let i = 0; i < 6; i++) L.push(CY(.62, .62, .06, 10, -2.4 - i * 1.8, y + r + .01, 0, 0x2c3236));
  const m = new THREE.Mesh(G.merge(L), shipMat()); g.add(m);
  g.userData = { side, sub: true, len: 44, tubes: new THREE.Vector3(-6, y + r + .3, 0), depth: -7.5, want: -7.5 };
  return g;
};
/* naval base on the shore: quay, pier on piles, sheds, fuel tanks, a crane, lamp posts */
function harbour(side, hgt) {
  const m = side === 'bull' ? -1 : 1, x0 = 86 * m, L = [], PW = side === 'bull' ? { wall: 0x8c8b83, roof: 0x4a5541, steel: 0x58624b } : { wall: 0xa68e69, roof: 0x8a7353, steel: 0x86704f };
  let zs = -96; for (let z = -92; z > -135; z -= .5) if (hgt(x0, z) < SEA + .35) { zs = z; break; }                 // where this meridian meets the water
  const top = SEA + 1.5;
  L.push(B(22, 2.6, 12, x0, top - 1.3, zs + 5, 0x77756f), B(22.4, .25, 12.4, x0, top + .05, zs + 5, 0x8d8b84));           // quay
  L.push(B(5, .45, 34, x0 - 5 * m, top - .1, zs - 17, 0x6f6d67));                                                          // pier
  for (let i = 0; i < 6; i++) for (const sx of [-2, 2]) L.push(CY(.3, .3, 6, 6, x0 - 5 * m + sx, top - 3.2, zs - 4 - i * 6, 0x4a4944));
  for (let i = 0; i < 5; i++) L.push(CY(.22, .26, .5, 6, x0 - 5 * m + 2.1 * m, top + .35, zs - 6 - i * 7, 0x24272a));       // bollards
  /* two sheds with pitched roofs (ridge up), doors facing the quay */
  [[5.5, 3], [-.5, 3]].forEach(([dx, dz]) => { const bx = x0 + dx * m; L.push(B(5, 3.4, 8, bx, top + 1.85, zs + dz + 4, PW.wall)); const rf = new THREE.CylinderGeometry(2.9, 2.9, 8.3, 3, 1); rf.rotateX(-Math.PI / 2); rf.scale(1, .5, 1); rf.translate(bx, top + 4.27, zs + dz + 4); L.push(prim(rf, PW.roof)); L.push(B(.1, 2.2, 2.6, bx - 2.52 * m, top + 1.25, zs + dz + 4, 0x23282b)); });
  [[-8, 7], [-8, 3.2]].forEach(([dx, dz]) => { L.push(CY(1.55, 1.55, 3.6, 12, x0 + dx * m, top + 1.95, zs + dz, 0xcfd1cc), CY(1.58, 1.58, .3, 12, x0 + dx * m, top + 3.3, zs + dz, PW.steel)); });
  /* a tower crane at the root of the pier: lattice tower on the quay, slewing cab, a jib out over the pier with its hoist rope and
     hook block, a counter-jib with its weight behind; every member meets the next one */
  const cx = x0 - 5 * m, cz = zs + 2.4, C = 0xc9a227, V = (x, y, z) => new THREE.Vector3(x, y, z), beam = (p, q, t, hex) => prim(G.beam(p, q, t), hex);
  for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.push(B(.26, 9.1, .26, cx + ax * 1.1, top + 4.6, cz + az * 1.1, C));
  L.push(B(2.8, .3, 2.8, cx, top + 4.6, cz, C), B(2.8, .3, 2.8, cx, top + 9.2, cz, C));
  for (const az of [-1, 1]) L.push(beam(V(cx - 1.1, top + .3, cz + az * 1.1), V(cx + 1.1, top + 4.5, cz + az * 1.1), .1, C), beam(V(cx + 1.1, top + 4.7, cz + az * 1.1), V(cx - 1.1, top + 9.1, cz + az * 1.1), .1, C));
  L.push(CY(1.2, 1.2, .3, 12, cx, top + 9.5, cz, 0x5a5a52), B(2.4, 1.8, 2.6, cx, top + 10.55, cz, 0xd8d5c8), B(.06, .7, 1.6, cx + 1.22, top + 10.8, cz, 0x1b2228));
  const jr = V(cx, top + 11.2, cz - 1.0), jt = V(cx, top + 13.6, cz - 15);                         // jib root on the cab, tip out over the pier
  L.push(beam(jr, jt, .42, C), beam(V(cx, top + 11.45, cz), V(cx, top + 14.2, cz - .2), .22, C), beam(V(cx, top + 14.2, cz - .2), V(cx, top + 13.75, cz - 14.8), .06, 0x2a2a2a));
  L.push(beam(V(cx, top + 11.2, cz + 1.0), V(cx, top + 11.4, cz + 6), .36, C), B(1.4, 1.3, 1.6, cx, top + 10.8, cz + 5.6, 0x6b6b66), beam(V(cx, top + 14.2, cz - .2), V(cx, top + 11.45, cz + 5.6), .05, 0x2a2a2a));
  const hz = cz - 11.5, hy = top + 11.2 + 2.4 * (11.5 - 1) / 14 - .12;                             // the rope hangs from the jib
  L.push(beam(V(cx, hy, hz), V(cx, top + 4.3, hz), .05, 0x1c1c1c), B(.5, .6, .4, cx, top + 4.0, hz, 0x2b2c2e), B(1.6, 1.0, 1.2, cx, top + 3.2, hz, 0x45627f));   // rope, hook block, a pallet on its way down
  /* two lamp posts on the pier: a plinth bolted to the deck, a galvanised pole, an arm reaching in over the deck and a lamp head whose
     lens is lit (it shares the floodlights' unlit material), so each reads as a lamp and not as a bare stick. They stand clear of the
     crane's load, which comes down over the root of the pier */
  const Lt = [], lx = x0 - 7.2 * m;
  for (const dz of [-15, -29]) { const z = zs + dz; L.push(CY(.22, .26, .2, 8, lx, top + .225, z, 0x6b6e70), CY(.1, .13, 5, 6, lx, top + 2.825, z, 0x7d8183), B(1.25, .08, .08, lx + .6 * m, top + 5.25, z, 0x7d8183), B(.7, .18, .36, lx + 1.15 * m, top + 5.2, z, 0x4a4e52)); Lt.push(B(.56, .05, .28, lx + 1.15 * m, top + 5.1, z, 0xfff0cc)); }
  return { L, Lt, x0, zs, lamps: [-15, -29].map(dz => new THREE.Vector3(lx + 1.15 * m, top + 5.05, zs + dz)), poles: [-15, -29].map(dz => [lx, zs + dz, top + 5.33]) };
}


/* ================================================================== space and air: reconnaissance satellites, FPV drones, radar stations */
K.satellite = function (side) {
  const P = NAVY[side], L = [], g = new THREE.Group();
  L.push(B(1.5, 2.2, 1.5, 0, 0, 0, 0xc8a240), B(1.56, .3, 1.56, 0, .5, 0, P.band), B(1.56, .1, 1.56, 0, -.6, 0, 0x8a6f2a));
  for (const sg of [1, -1]) { L.push(B(.12, .12, 1.0, 0, .2, sg * 1.2, 0x9a9da0)); L.push(B(.05, 1.9, 4.6, 0, .2, sg * 4.0, 0x15245a)); for (let i = 0; i < 4; i++) L.push(B(.07, 1.94, .05, 0, .2, sg * (2.0 + i * 1.33), 0x8f9aa8)); }
  L.push(CY(.42, .5, 1.5, 10, 0, -1.8, 0, 0x2b2e33), CY(.44, .44, .08, 10, 0, -2.58, 0, 0x10161b));
  G.dishGeo([[0, 0], [.35, .04], [.7, .2], [.95, .45]], .04, 12).forEach((d, i) => { d.rotateX(Math.PI / 2 + .5); d.translate(.2, 1.5, .5); L.push(prim(d, i === 1 ? 0x2b2e33 : i ? 0x9a9da0 : 0xe7e7e2)); });   // a solid dish: it does not vanish when its back turns to the camera
  L.push(CY(.03, .03, .9, 4, .2, 1.3, .2, 0x9a9da0));
  g.add(new THREE.Mesh(G.merge(L), shipMat())); g.scale.setScalar(1.15);
  return g;
};
K.fpvGeo = function () {
  const L = [B(.5, .08, .08, 0, 0, 0, 0x1a1c1e), B(.08, .08, .5, 0, 0, 0, 0x1a1c1e), B(.2, .1, .14, 0, .02, 0, 0x30343a), B(.16, .09, .1, .1, -.08, 0, 0xb5542a)];
  for (const [x, z] of [[.25, 0], [-.25, 0], [0, .25], [0, -.25]]) L.push(CY(.15, .15, .015, 8, x, .06, z, 0x555a60));
  return G.merge(L);
};
/* a rotating air-search radar on a platform; the 4.0 layout gets a flat pad for it (pads are read when the terrain is built) */
const RADAR_AT = { bull: [-47, -49], bear: [47, -49] };
if (window.GFX4 && GFX4.LAY) for (const k in RADAR_AT) GFX4.LAY.pads.push({ x: RADAR_AT[k][0], z: RADAR_AT[k][1], r: 4.2, h: null });
/* the gun lines (battle.js puts the guns, this file the revetments, on these coordinates): level ground, nothing growing in the pits */
const GUNS_AT = [[62, -45], [63, 45], [35, -44], [79, 38], [95, 38]];
if (window.GFX4 && GFX4.LAY) for (const m of [-1, 1]) for (const [x, z] of GUNS_AT) GFX4.LAY.pads.push({ x: x * m, z, r: 8, h: null });
function radarStation(side) {
  const st = side === 'bull' ? 0x58624b : 0x86704f, L = [B(5, .5, 3.4, 0, .25, 0, 0x6f6d67), B(2.2, 1.9, 2.2, -1.2, 1.45, 0, st), B(.9, .5, .06, -1.2, 1.7, 1.12, 0x10161b), CY(.32, .42, 2.4, 8, 1.2, 1.7, 0, 0x4b4f52), B(1.3, 1.0, 1.0, 1.4, 1.0, -1.1, 0x3d4144)];
  const A = [B(.22, 3.3, 6.2, 0, 1.9, 0, st)]; for (let i = 0; i < 6; i++) A.push(B(.26, 3.3, .08, 0, 1.9, -2.9 + i * 1.16, 0x23272a)); for (let i = 0; i < 4; i++) A.push(B(.26, .08, 6.2, 0, .35 + i * 1.03, 0, 0x23272a));
  A.push(B(1.2, .1, .1, .6, 1.9, 0, 0x23272a), B(.3, .4, .4, 1.2, 1.9, 0, 0xd8d5c8), CY(.14, .14, .5, 6, 0, .1, 0, 0x4b4f52));
  return { base: L, ant: A };
}
/* ================================================================== forward operating base around each headquarters, and earth revetments for the guns */
const FOB = { hx: 17, hz: 28, cx: 80 };
function fob(side, hgt) {
  const m = side === 'bull' ? -1 : 1, e = -m, bx = FOB.cx * m, L = [], Lt = [], fab = side === 'bull' ? 0x7d7a62 : 0x938466, fill = 0x54493a, con = 0x8d8b84;
  const roadZ = x => 2 * Math.sin(x * .035), NV = window.NAV, solid = sh => { if (NV) NV.add(sh); };
  const block = (x, z, rot) => { const y = hgt(x, z) - .08, a = RB(1.35, 1.9, 2.4, .12, 0, .95, 0, fab), b = B(1.1, .12, 2.1, 0, 1.92, 0, fill); moved([a, b], x, y, z, rot); L.push(a, b); if (NV) solid(NV.box(x, z, .7, 1.22, rot, 'fob')); };
  for (const sx of [1, -1]) { const x = bx + sx * FOB.hx; for (let z = -FOB.hz + 1.2; z <= FOB.hz - 1.2; z += 2.45) { if (Math.abs(z - roadZ(x)) < 5) continue; block(x, z, 0); } }
  for (const sz of [1, -1]) { const z = sz * FOB.hz; for (let x = bx - FOB.hx; x <= bx + FOB.hx; x += 2.45) block(x, z, Math.PI / 2); }
  /* gates on the road: concrete posts, a guard hut, and on the front gate a striped boom that rises when anyone comes through */
  let boom = null;
  for (const sx of [1, -1]) {
    const x = bx + sx * FOB.hx, zc = roadZ(x), y = hgt(x, zc);
    for (const sz of [1, -1]) { const py = Math.min(hgt(x - .65, zc + sz * 5 - .65), hgt(x + .65, zc + sz * 5 - .65), hgt(x - .65, zc + sz * 5 + .65), hgt(x + .65, zc + sz * 5 + .65)) - .1; L.push(B(1.3, y + 3.8 - py, 1.3, x, (y + 3.8 + py) / 2, zc + sz * 5, con), B(1.5, .25, 1.5, x, y + 3.9, zc + sz * 5, 0x6f6d67)); if (NV) solid(NV.box(x, zc + sz * 5, .68, .68, 0, 'fob')); }
    if (sx === e) {
      L.push(B(.3, 1.5, .3, x + e * .9, y + .75, zc - 4.3, 0x3b3d3f)); if (NV) solid(NV.circle(x + e * .9, zc - 4.3, .22, 'fob'));
      const BL = []; for (let i = 0; i < 8; i++) BL.push(B(.16, .16, 1.05, 0, 0, .6 + i * 1.05, i % 2 ? 0xe7e5df : 0xc0392b)); BL.push(B(.26, .26, .3, 0, 0, .1, 0x3b3d3f));
      boom = { L: BL, x: x + e * .9, y: y + 1.5, z: zc - 4.3, gx: x, gz: zc, side, open: 0 };
      Lt.push(B(.2, .2, .2, x, y + 4.15, zc + 5, 0xffd9a0), B(.2, .2, .2, x, y + 4.15, zc - 5, 0xffd9a0));
    }
    const hx2 = x - sx * 2.4, hz2 = zc + 8.2; L.push(B(2.4, 2.5, 2.4, hx2, hgt(hx2, hz2) + 1.25, hz2, 0x6b705c), B(2.9, .2, 2.9, hx2, hgt(hx2, hz2) + 2.6, hz2, 0x3d4135), B(.08, .9, 1.4, hx2 + sx * 1.22, hgt(hx2, hz2) + 1.6, hz2, 0x10161b)); if (NV) solid(NV.box(hx2, hz2, 1.25, 1.25, 0, 'fob'));
  }
  /* corner towers (the motor pool's shed takes the front corner on the south side) */
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    if (sx === e && sz === -1) continue;
    const x = bx + sx * (FOB.hx - 2.6), z = sz * (FOB.hz - 2.6), y = hgt(x, z);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) L.push(B(.22, 5.2, .22, x + ax * 1.3, y + 2.6, z + az * 1.3, 0x4f5346));
    L.push(B(3.3, .22, 3.3, x, y + 5.2, z, 0x5d5a4a), B(3.3, 1.0, .14, x, y + 5.8, z + 1.6, 0x6b705c), B(3.3, 1.0, .14, x, y + 5.8, z - 1.6, 0x6b705c), B(.14, 1.0, 3.3, x + 1.6, y + 5.8, z, 0x6b705c), B(.14, 1.0, 3.3, x - 1.6, y + 5.8, z, 0x6b705c), B(3.9, .18, 3.9, x, y + 7.6, z, 0x3d4135));
    for (const ax of [-1, 1]) for (const az of [-1, 1]) L.push(B(.12, 2.3, .12, x + ax * 1.5, y + 6.45, z + az * 1.5, 0x4f5346));
    Lt.push(B(.3, .16, .3, x - sx * 1.2, y + 7.42, z - sz * 1.2, 0xffe2b0)); if (NV) solid(NV.box(x, z, 1.45, 1.45, 0, 'fob'));
  }
  /* the motor pool: a vehicle shed against the south wall. Armour and lorries roll out of it one at a time and back into it, and its roller
     door goes up for them and comes down behind them (battle.js works the door): nothing on the ground appears or goes anywhere else */
  let shed = null;
  {
    const cx = m * (FOB.cx - GAR.dx), zc = (GAR.z0 + GAR.z1) / 2, len = GAR.z1 - GAR.z0, hw = GAR.hw, th = GAR.th, y = hgt(cx, zc), top = y + GAR.H, W = 2 * hw + 2 * th, wc = 0x8a8678, mid = (y - .5 + top) / 2;
    L.push(B(2 * hw, .12, len, cx, y - .04, zc, 0x6b6964), B(W, .1, 4.4, cx, y - .03, GAR.z1 + 2.2, 0x75736c));                       // floor and apron
    for (const s of [-1, 1]) L.push(B(th, GAR.H + .5, len + th, cx + s * (hw + th / 2), mid, zc - th / 2, wc));                            // side walls
    L.push(B(W, GAR.H + .5, th, cx, mid, GAR.z0 - th / 2, wc));                                                                             // back wall
    L.push(B(W, GAR.H - GAR.Hd, th, cx, y + (GAR.Hd + GAR.H) / 2, GAR.z1 - th / 2, wc));                                                  // over the door
    for (const s of [-1, 1]) L.push(B(.65, GAR.H + .5, .6, cx + s * (hw + .345), mid, GAR.z1 + .1, 0x5f5d55));                             // piers either side of it
    L.push(B(W + .5, .28, len + th + .7, cx, top + .14, zc - th / 2 + .15, 0x4d4b45), B(W - 1.6, .45, len - 2, cx, top + .5, zc, 0x5a5850));   // roof slab with eaves, vent
    L.push(B(2 * hw + .1, .5, .55, cx, y + GAR.Hd + .25, GAR.z1 + .15, 0x3e3d39));                                                         // the roller's drum
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) L.push(B(.05, .35, .62, cx + s * (hw + .7), y + .35 + i * .7, GAR.z1 + .1, i % 2 ? 0x1c1c1c : 0xd8b23a));   // hazard bands
    Lt.push(B(.7, .12, .25, cx, y + GAR.Hd + .62, GAR.z1 + .48, 0xffe0a8));                                                              // lamp over the door
    for (const dz of [-4.5, 0, 4.5]) Lt.push(B(.25, .06, 2.2, cx, top - .04, zc + dz, 0xf4f1e2));                                        // strip lights under the roof
    L.push(B(3.2, .9, .55, cx - 2.2, y + .45, GAR.z0 + .3, 0x5a4a35));                                                                     // work bench and drums at the back
    for (let i = 0; i < 3; i++) L.push(CY(.3, .3, .9, 8, cx + 1.6 + i * .7, y + .45, GAR.z0 + .35, i % 2 ? 0x2d4a6b : 0x8b2e22));
    const D = [], nS = 14; for (let i = 0; i < nS; i++) D.push(B(2 * hw - .04, GAR.Hd / nS + .004, i % 2 ? .05 : .07, 0, -(i + .5) * GAR.Hd / nS, 0, i % 2 ? 0x7d8288 : 0x8c9197));   // interlocking slats
    D.push(B(2 * hw - .04, .14, .1, 0, -GAR.Hd + .07, 0, 0xd8b23a));                                                                       // roller door slats, hung from the drum
    shed = { L: D, x: cx, y: y + GAR.Hd, z: GAR.z1 - .03, side };
    if (NV) { for (const s of [-1, 1]) solid(NV.box(cx + s * (hw + th / 2), zc - th / 2, th / 2 + .03, (len + th) / 2, 0, 'shed')); solid(NV.box(cx, GAR.z0 - th / 2, W / 2, th / 2 + .03, 0, 'shed'));
      for (const s of [-1, 1]) solid(NV.box(cx + s * (hw + .345), GAR.z1 + .1, .325, .3, 0, 'shed'));
      solid(NV.box(cx - 2.2, GAR.z0 + .3, 1.6, .28, 0, 'shed')); solid(NV.box(cx + 2.3, GAR.z0 + .35, 1.05, .3, 0, 'shed')); }
  }
  /* tents (ridge up), containers, crates and drums, floodlights */
  [[-12.5, -21], [-7, -21], [-12.5, -15.5], [-7, -15.5]].forEach(([dx, dz]) => { const x = bx + e * dx, z = dz, y = hgt(x, z), t = new THREE.CylinderGeometry(1.75, 1.75, 4.4, 3, 1); t.rotateX(-Math.PI / 2); t.scale(1, .82, 1); t.translate(x, y + .72, z); L.push(prim(t, side === 'bull' ? 0x5b6647 : 0x9a8763)); if (NV) solid(NV.box(x, z, 1.6, 2.25, 0, 'fob')); });
  [[-13, 20.5, 0x45627f, 0], [-9.6, 20.5, 0x874a3a, 0], [-11.3, 20.5, 0x596648, 2.62]].forEach(([dx, dz, c, up]) => { const x = bx + e * dx, y = hgt(x, dz); L.push(B(2.5, 2.6, 6.1, x, y + 1.3 + up, dz, c), B(2.56, .1, 6.16, x, y + 2.62 + up, dz, 0x2f3438)); if (NV && !up) solid(NV.box(x, dz, 1.3, 3.1, 0, 'fob')); });
  for (let i = 0; i < 7; i++) { const x = bx + e * (-4.5 + (i % 4) * 1.15), z = 22 + Math.floor(i / 4) * 1.2, y = hgt(x, z); L.push(i < 4 ? CY(.42, .42, 1.1, 8, x, y + .55, z, i % 2 ? 0x8b2e22 : 0x2d4a6b) : B(1, .8, 1, x, y + .4, z, 0x6d5a3c)); if (NV) solid(NV.circle(x, z, .55, 'fob')); }
  for (const [dx, dz] of [[15, 21], [-13, 9], [-13, -9]]) { const x = bx + e * dx, y = hgt(x, dz); L.push(CY(.09, .12, 7, 5, x, y + 3.5, dz, 0x3b3d3f), B(.9, .22, .5, x, y + 7, dz, 0x2b2c2e)); Lt.push(B(.7, .08, .36, x, y + 6.87, dz, 0xfff0cc)); if (NV) solid(NV.circle(x, dz, .22, 'fob')); }
  return { L, Lt, boom, shed };
}
/* a U of earth in front of and beside a gun position, open to the rear */
function revetment(x, z, e, hgt) {
  const L = [], c = 0x5b5a3d, mk = (len, px, pz, rot) => { const g = G.profile([[-1.7, 0], [1.7, 0], [.25, 1.45], [-.25, 1.45]], len, .05); if (rot) g.rotateY(Math.PI / 2); g.translate(px, hgt(px, pz) - .05, pz); L.push(prim(g, c, .9 + Math.random() * .2)); };
  mk(11, x + e * 6.6, z, 0); mk(11.5, x + e * 1.2, z + 5.8, 1); mk(11.5, x + e * 1.2, z - 5.8, 1);
  if (window.NAV) { const N = window.NAV; N.add(N.capsule(x + e * 6.6, z - 5.5, x + e * 6.6, z + 5.5, 1.75, 'revet')); for (const s of [1, -1]) N.add(N.capsule(x + e * 1.2 - 5.75, z + s * 5.8, x + e * 1.2 + 5.75, z + s * 5.8, 1.75, 'revet')); }
  return L;
}
/* ================================================================== 5.0 environment: build + run
   battle.js calls K.build(scene, hgt, tier) after the 4.0 environment, then env.tick(dt, t) every frame and env.mood(p, storm) when the sky changes. */
const Q = [];                                   // deferred actions on the scene clock (vt() is battle.js's clock in ms)
const _d = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);
K.after = function (ms, fn) { Q.push({ t: vt() + ms, fn }); };
K.build = function (scene, hgt, tier) {
  const lite = !G.std, K4 = window.GFX4, E = K.env = { scene, hgt, lite, t: 0, ships: [], subs: {}, night: 0 };
  /* sea: a single big plane; the shore is wherever the terrain dips under it */
  if (lite || !K4) E.seaMat = K.seaMaterial(); else { E.seaMat = K4.waterMaterial(); E.seaMat.fragmentShader = E.seaMat.fragmentShader.replace('vW.xz*.32', 'vW.xz*.1'); }
  const sg = new THREE.PlaneGeometry(1500, 640, 1, 1); sg.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(sg, E.seaMat); sea.position.set(0, SEA, -412); sea.renderOrder = 6; sea.frustumCulled = false; scene.add(sea); E.sea = sea;
  /* surf: a pale ribbon along the waterline that breathes with the swell */
  {
    const P = [], UV = [], I = []; let last = -1, n = 0;
    for (let x = -174; x <= 174; x += 3) {
      if (hgt(x, -141) > SEA) { last = -1; continue; }
      let lo = -141, hi = -88; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (hgt(x, m) < SEA) lo = m; else hi = m; }
      const zs = (lo + hi) / 2; P.push(x, SEA + .05, zs + .7, x, SEA + .05, zs - 2.6); UV.push(0, 0, 0, 1);
      if (last >= 0) I.push(last, n, last + 1, last + 1, n, n + 1); last = n; n += 2;
    }
    const c = document.createElement('canvas'); c.width = 4; c.height = 32; const cx = c.getContext('2d'), gr = cx.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.25, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 4, 32);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
    E.surfM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: .5 });
    E.surf = new THREE.Mesh(g, E.surfM); E.surf.renderOrder = 7; E.surf.frustumCulled = false; scene.add(E.surf);
  }
  /* harbours */
  const pm = G.std ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: .04 }) : new THREE.MeshLambertMaterial({ vertexColors: true }); pm.userData.envK = .55; E.propMat = pm;
  const HL = [], LT = []; E.port = {};
  for (const side of ['bull', 'bear']) { const h = harbour(side, hgt); HL.push(...h.L); LT.push(...h.Lt); E.port[side] = h; }
  /* forward operating bases round the two headquarters; revetments at every gun position (the same coordinates battle.js gives its artillery) */
  E.booms = []; E.sheds = [];
  for (const side of ['bull', 'bear']) { const f = fob(side, hgt); HL.push(...f.L); LT.push(...f.Lt); if (f.boom) E.booms.push(f.boom); if (f.shed) E.sheds.push(f.shed); const m = side === 'bull' ? -1 : 1; for (const [gx, gz] of GUNS_AT) HL.push(...revetment(gx * m, gz, -m, hgt)); }
  const hm = new THREE.Mesh(G.merge(HL), pm); hm.castShadow = !lite; hm.receiveShadow = !!G.std; scene.add(hm);
  for (const b of E.booms) { const g = new THREE.Mesh(G.merge(b.L), pm); g.position.set(b.x, b.y, b.z); g.castShadow = !lite; scene.add(g); b.g = g; }   // gate booms pivot on their posts
  for (const d of E.sheds) { const g = new THREE.Mesh(G.merge(d.L), pm); g.position.set(d.x, d.y, d.z); g.castShadow = !lite; scene.add(g); d.g = g; }   // shed doors roll up into their drums
  E.lmat = new THREE.MeshBasicMaterial({ vertexColors: true }); scene.add(new THREE.Mesh(G.merge(LT), E.lmat));
  /* fleets. Each navy's destroyer and frigate steam one patrol loop half a lap apart, so they keep their distance for good; the patrol
     boat circles the water off its harbour; the carrier lies further out and the submarine beyond it. The loops were laid out so that
     no hull ever comes within a few metres of another, of the pier or of water too shallow for it (tests/battle_navy.py checks it). */
  const LANE = { bull: { col: [-85, -202, 62, 44], pb: [-138, -131, 26, 18] }, bear: { col: [85, -202, 62, 44], pb: [141, -131, 20, 16] } };
  for (const side of ['bull', 'bear']) {
    const m = side === 'bull' ? -1 : 1, d = K.warship(side, true), f = K.warship(side, false), s = K.submarine(side), Ln = LANE[side], w = .032 * m, p0 = m < 0 ? .6 : 2.6;
    [d, f, s].forEach(o => scene.add(o));
    E.ships.push({ g: d, side, kind: 'dd', cx: Ln.col[0], cz: Ln.col[1], rx: Ln.col[2], rz: Ln.col[3], w, ph: p0, bob: 1.7 * m, aim: null, ta: 0 });
    E.ships.push({ g: f, side, kind: 'ff', cx: Ln.col[0], cz: Ln.col[1], rx: Ln.col[2], rz: Ln.col[3], w, ph: p0 + Math.PI, bob: 4.1 * m, aim: null, ta: 0 });
    const pb = K.warship(side, false); pb.scale.setScalar(.44); scene.add(pb); E.ships.push({ g: pb, side, kind: 'pb', cx: Ln.pb[0], cz: Ln.pb[1], rx: Ln.pb[2], rz: Ln.pb[3], w: -.09 * m, ph: m < 0 ? 1.2 : 4.6, bob: 2.9 * m, aim: null, ta: 0 });
    s.position.set(35 * m, SEA - 7.5, -330); s.rotation.y = m < 0 ? -.35 : Math.PI + .35;
    E.subs[side] = { g: s, side, depth: -7.5, want: -7.5, until: 0, peek: 30 + Math.random() * 60 };
  }
  /* radar stations */
  E.radars = [];
  for (const side of ['bull', 'bear']) {
    const [x, z] = RADAR_AT[side], r = radarStation(side), y = hgt(x, z) - .02, rot = side === 'bull' ? 0 : Math.PI; if (window.NAV) NAV.add(NAV.box(x, z, 2.7, 2.0, rot, 'radar'));
    const base = new THREE.Mesh(G.merge(moved(r.base, x, y, z, rot)), pm); base.castShadow = !lite; scene.add(base);
    const ant = new THREE.Mesh(G.merge(r.ant), pm); ant.position.set(x + (side === 'bull' ? 1.2 : -1.2), y + 2.9, z); ant.castShadow = !lite; ant.userData.side = side; scene.add(ant); E.radars.push(ant);
  }
  /* satellites: one per army on a slow circle high above; a scan beam and a scanner bar on the ground while one of them is taking pictures */
  E.sats = {};
  for (const side of ['bull', 'bear']) { const g = K.satellite(side); scene.add(g); E.sats[side] = { g, side, ph: side === 'bull' ? 2.4 : -.6, w: side === 'bull' ? .017 : -.017 }; }
  const bm = K4 && K4.beamMaterial ? K4.beamMaterial(0xbfe9ff, false) : new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: .12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const bg = new THREE.CylinderGeometry(.5, 9, 1, 16, 1, true); bg.translate(0, -.5, 0);
  E.beam = new THREE.Mesh(bg, bm); E.beam.frustumCulled = false; E.beam.renderOrder = 6; E.beam.visible = false; scene.add(E.beam); E.beamMat = bm;
  { const c = document.createElement('canvas'); c.width = 64; c.height = 4; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(150,225,255,0)'); gr.addColorStop(.5, 'rgba(210,245,255,.95)'); gr.addColorStop(1, 'rgba(150,225,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 4);
    E.bar = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 92), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); E.bar.rotation.x = -Math.PI / 2; E.bar.position.y = .5; E.bar.renderOrder = 4; E.bar.visible = false; scene.add(E.bar); }
  E.scan = null; E.marks = [];
  for (let i = 0; i < 4; i++) { const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.3, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 4; scene.add(ring);
    const pole = new THREE.Mesh(new THREE.PlaneGeometry(.16, 8), ring.material); pole.visible = false; pole.renderOrder = 4; scene.add(pole); E.marks.push({ ring, pole, lbl: null, until: 0 }); }
  /* FPV drones */
  E.fpv = []; const fg = K.fpvGeo(); for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(fg, pm); m.scale.setScalar(2.4); m.visible = false; scene.add(m); E.fpv.push({ m, on: false }); }
  E.lorry = { bull: { ph: 20, st: 0 }, bear: { ph: 55, st: 0 } };
  E.tick = envTick; E.mood = envMood;
  envTick.call(E, 0, 0);
  return E;
};
function envTick(dt, t) {
  const E = this; E.t = t;
  if (E.seaMat.uniforms.uTime) E.seaMat.uniforms.uTime.value = t;
  E.surf.position.z = Math.sin(t * .55) * .45; E.surfM.opacity = (.34 + .16 * Math.sin(t * .55 + 1.2)) * (1 - E.night * .5);
  const now = typeof vt === 'function' ? vt() : 0;
  for (let i = Q.length - 1; i >= 0; i--) if (Q[i].t <= now) { const q = Q.splice(i, 1)[0]; try { q.fn(); } catch (e) { console.error(e); } }
  for (const s of E.ships) {
    s.ph += s.w * dt; const c = Math.cos(s.ph), n = Math.sin(s.ph), vx = -n * s.rx * s.w, vz = c * s.rz * s.w, hd = Math.atan2(-vz, vx);
    s.g.position.set(s.cx + c * s.rx, SEA + Math.sin(t * .9 + s.bob) * .1, s.cz + n * s.rz);
    s.g.rotation.set(Math.sin(t * .55 + s.bob) * .014, hd, Math.sin(t * .8 + s.bob * 2) * .01); s.hd = hd;
    const U = s.g.userData; U.rad.rotation.y += dt * 1.7;
    let want = 0; if (s.aim && t < s.aim.until) { want = Math.atan2(-(s.aim.z - s.g.position.z), s.aim.x - s.g.position.x) - hd; while (want > Math.PI) want -= TAU; while (want < -Math.PI) want += TAU; }
    let dA = want - s.ta; while (dA > Math.PI) dA -= TAU; while (dA < -Math.PI) dA += TAU; s.ta += dA * Math.min(1, dt * 2.2); U.tur.rotation.y = s.ta;
  }
  /* each radar station sweeps until something of the enemy's is in the air, then holds it (the SAM site fires on its track) */
  for (const r of E.radars) { const tp = typeof THREATS !== 'undefined' ? THREATS.nearest(r.userData.side, r.position.x, r.position.z, 320) : null;
    if (!tp) { r.rotation.y += dt * 1.6; r.userData.lock = 0; continue; }
    const want = Math.atan2(-(tp.z - r.position.z), tp.x - r.position.x); let d = want - r.rotation.y; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    r.rotation.y += cl(d, -dt * 4, dt * 4); r.userData.lock = Math.abs(d) < .1 ? 1 : 0; }
  /* each front gate's boom rises while anyone of its army is coming through, and drops again behind the last of them */
  if (E.booms && typeof ARMY !== 'undefined' && ARMY.sides) for (const b of E.booms) {
    const A = ARMY.sides[b.side], at = (x, z) => Math.abs(x - b.gx) < 9 && Math.abs(z - b.gz) < 7.5;
    let near = !!A && (A.sold.some(o => at(o.x, o.z)) || A.veh.some(o => at(o.x, o.z)));
    if (!near && ARMY.trucks) near = ARMY.trucks.some(t => t.on && t.side === b.side && at(t.g.position.x, t.g.position.z));
    if (!near && window.GFX6 && GFX6.RB.sides[b.side]) { const S = GFX6.RB.sides[b.side]; near = S.bots.some(o => at(o.x, o.z)) || S.dogs.some(o => at(o.x, o.z)); }
    b.open += ((near ? 1 : 0) - b.open) * Math.min(1, dt * 3.2); b.g.rotation.x = -b.open * Math.PI * .47;
  }
  /* each motor pool's roller door, as far open as battle.js has it */
  if (E.sheds && typeof ARMY !== 'undefined' && ARMY.sides) for (const d of E.sheds) { const A = ARMY.sides[d.side], o = A && A.shed ? A.shed.open : 0; d.g.scale.y = Math.max(.001, 1 - o); d.g.visible = o < .999; }
  /* a supply lorry shuttles between the rear road and each base's back gate */
  if (typeof ARMY !== 'undefined' && ARMY.vmat) for (const k in E.lorry) {
    const l = E.lorry[k], m = k === 'bull' ? -1 : 1;
    if (!l.g) { l.g = G.truck(ARMY.vmat[k]); l.g.scale.setScalar(1.4); E.scene.add(l.g); l.x = 118 * m; }
    l.ph -= dt;
    if (l.st === 0 && l.ph <= 0) { l.st = 1; } else if (l.st === 2 && l.ph <= 0) { l.st = 3; }
    const tgt = l.st === 1 ? 100.5 * m : l.st === 3 ? 122 * m : l.x, d = tgt - l.x;
    if (Math.abs(d) > .1) { l.x += Math.sign(d) * Math.min(Math.abs(d), dt * 6.5); l.g.rotation.y = d * m < 0 ? (m < 0 ? 0 : Math.PI) : (m < 0 ? Math.PI : 0); }
    else if (l.st === 1) { l.st = 2; l.ph = 14 + Math.random() * 10; } else if (l.st === 3) { l.st = 0; l.ph = 45 + Math.random() * 50; }
    const x = cl(l.x, -91.5, 91.5), z = 2 * Math.sin(x * .035) + (Math.abs(l.x) > 91.5 ? (Math.abs(l.x) - 91.5) * .15 : 0); l.g.position.set(l.x, E.hgt(l.x, z) + .05, z);
  }
  for (const k in E.sats) { const s = E.sats[k]; s.ph += s.w * dt; s.g.position.set(Math.cos(s.ph) * 210, 150 + Math.sin(s.ph * 3) * 4, -30 + Math.sin(s.ph) * 150); s.g.rotation.y = -s.ph + (s.w > 0 ? Math.PI : 0); }
  if (E.scan) {
    const sc = E.scan, f = (t - sc.t0) / sc.dur;
    if (f >= 1) { E.scan = null; E.beam.visible = E.bar.visible = false; if (sc.done) try { sc.done(); } catch (e) { console.error(e); } }
    else {
      const x = mix(sc.x0, sc.x1, f), a = Math.min(1, f * 8) * Math.min(1, (1 - f) * 8), sp = E.sats[sc.side].g.position;
      E.bar.visible = true; E.bar.position.x = x; E.bar.position.z = -2; E.bar.material.opacity = a;
      E.beam.visible = true; E.beam.position.copy(sp); _d.set(x - sp.x, .5 - sp.y, -2 - sp.z); const len = _d.length(); E.beam.scale.set(1, len, 1); E.beam.quaternion.setFromUnitVectors(_down, _d.normalize());
      if (E.beamMat.uniforms) { E.beamMat.uniforms.uInt.value = .5 * a; E.beamMat.uniforms.uTime.value = t; }
      for (const tg of sc.targets) if (!tg.hit && (sc.x1 > sc.x0 ? x >= tg.x : x <= tg.x)) { tg.hit = true; K.mark(tg.x, tg.z || 0, tg.col, tg.txt); if (sc.onTarget) try { sc.onTarget(tg); } catch (e) { console.error(e); } }
    }
  }
  for (const mk of E.marks) { if (!mk.until) continue; const r = mk.until - t; if (r <= 0) { mk.until = 0; mk.ring.visible = mk.pole.visible = false; if (mk.lbl) mk.lbl.visible = false; continue; }
    const a = Math.min(1, r / 1.5) * Math.min(1, (mk.life - r) * 3); mk.ring.material.opacity = a * (.55 + .3 * Math.sin(t * 5)); mk.ring.scale.setScalar(1 + .12 * Math.sin(t * 3)); if (mk.lbl) mk.lbl.material.opacity = a; if (typeof cam !== 'undefined') mk.pole.quaternion.copy(cam.quaternion); }
  for (const d of E.fpv) { if (!d.on) continue; const f = (t - d.t0) / d.dur;
    if (f >= 1) { d.on = false; d.m.visible = false; if (typeof FX !== 'undefined') FX.explode(d.x1, d.z1, .75, 0xffc070); continue; }
    const e = f * f * (3 - 2 * f), w = (1 - f) * 2.2, x = mix(d.x0, d.x1, e) + Math.sin(t * 5 + d.ph) * w * .4, z = mix(d.z0, d.z1, e) + Math.sin(t * 3.3 + d.ph * 2) * w, gy = typeof ARMY !== 'undefined' ? ARMY.gy(x, z) : 0;
    const y = gy + mix(d.y0, 1.2, sm(.72, 1, f)) + Math.sin(t * 7 + d.ph) * .5 * (1 - f);
    d.m.position.set(x, y, z); d.m.rotation.set(Math.sin(t * 6 + d.ph) * .2, Math.atan2(-(d.z1 - d.z0), d.x1 - d.x0), -.35 - .5 * sm(.72, 1, f)); }
  for (const k in E.subs) {
    const s = E.subs[k];
    if (s.until && t > s.until) { s.until = 0; s.want = -7.5; }
    if (!s.until) { s.peek -= dt; if (s.peek <= 0) { if (s.want < -5) { s.want = -3.4; s.peek = 14 + Math.random() * 10; } else { s.want = -7.5; s.peek = 70 + Math.random() * 90; } } }   // now and then the sail breaks the surface for a look round
    const d0 = s.depth; s.depth += cl(s.want - s.depth, -dt * 1.5, dt * 2.4);
    s.g.position.y = SEA + s.depth + Math.sin(t * .7 + (k === 'bull' ? 0 : 2)) * .06; s.g.rotation.z = cl((s.depth - d0) / Math.max(dt, .001) * .035, -.12, .12) * (k === 'bull' ? 1 : 1);
    if (Math.abs(s.depth - d0) > .002 && s.depth > -5.5 && typeof FX !== 'undefined' && FX.spawn && PREF.layers.fx && Math.random() < .5) { const p = s.g.position; FX.spawn(4, p.x + rr(-14, 14), SEA + .2, p.z + rr(-3, 3), rr(-1, 1), rr(.6, 2), rr(-1, 1), 1.4 + Math.random(), 4); }
  }
}
function envMood(p, storm) {
  const E = this, Lc = h => G.lin(h), u = E.seaMat.uniforms;
  const night = cl(p.stars * 1.1 + storm * .55 + (p.el < 10 ? .25 : 0), 0, 1); E.night = night;
  u.uSky.value.copy(Lc(p.top)); u.uHor.value.copy(Lc(p.hor)).lerp(Lc(0x6b7381), storm * .7); u.uSunCol.value.copy(Lc(p.sun)).multiplyScalar(p.si * .55 * (1 - storm * .7)); u.uGlint.value = 1 - storm * .8;
  u.uDeep.value.copy(Lc(0x14323a)).lerp(Lc(p.hgnd), .3).multiplyScalar(mix(1, .3, night));
  const sd = typeof WORLD !== 'undefined' && WORLD.sunDir; if (sd) { if (u.uSunDir) u.uSunDir.value.copy(sd); if (u.uSunXZ) u.uSunXZ.value.set(sd.x, sd.z).normalize(); }
  if (_wake) _wake.opacity = mix(.5, .25, night);
  if (E.lmat) E.lmat.color.setScalar(mix(.16, 2.4, night));
}
/* two more synthesised sounds on battle.js's audio buses */
if (window.GFX4 && GFX4.SFX) {
  const rel = (A, end) => setTimeout(() => { A.voices = Math.max(0, A.voices - 1); }, Math.max(0, (end - A.ctx.currentTime) * 1000) + 60);
  GFX4.SFX.scan = function (A, o) {            // short data chirps
    const C = A.ctx, t0 = C.currentTime, v = o.vol == null ? .5 : o.vol, g = A.out(o, 'voice');
    for (let i = 0; i < 6; i++) { const s = C.createOscillator(), k = C.createGain(), tt = t0 + i * .11; s.type = 'square'; s.frequency.value = [1900, 2500, 2100, 2900, 2300, 3100][i]; s.connect(k).connect(g); k.gain.setValueAtTime(.0001, tt); k.gain.linearRampToValueAtTime(v * .12, tt + .008); k.gain.exponentialRampToValueAtTime(.0001, tt + .07); s.start(tt); s.stop(tt + .08); }
    rel(A, t0 + .9);
  };
  GFX4.SFX.sonar = function (A, o) {           // a ping with a long tail
    const C = A.ctx, t0 = C.currentTime, v = o.vol == null ? .5 : o.vol, g = A.out(o, 'sfx'), s = C.createOscillator();
    s.type = 'sine'; s.frequency.setValueAtTime(1180, t0); s.frequency.exponentialRampToValueAtTime(1120, t0 + 1.6); s.connect(g); A.env(g, t0, .01, v * .5, 1.5, null, 0, t0 + 1.8); s.start(t0); s.stop(t0 + 1.85); rel(A, t0 + 1.9);
  };
}
/* ------------------------------------------------------------------ reconnaissance pass: the side's satellite sweeps a scanner bar across the field; every target it crosses gets a marker */
K.scan = function (side, targets, done, onTarget) {
  const E = K.env; if (!E || E.scan) return false;
  const dir = side === 'bull' ? 1 : -1;
  E.scan = { side, t0: E.t, dur: 7.5, x0: -78 * dir, x1: 78 * dir, targets: (targets || []).map(t => Object.assign({}, t)), done, onTarget };
  return true;
};
K.mark = function (x, z, col, txt) {
  const E = K.env; if (!E) return; const mk = E.marks.find(m => !m.until) || E.marks[0], y = (typeof ARMY !== 'undefined' ? ARMY.gy(x, z) : 0);
  mk.life = 15; mk.until = E.t + mk.life; mk.ring.visible = mk.pole.visible = true; mk.ring.position.set(x, y + .5, z); mk.ring.material.color.set(col); mk.pole.material = mk.ring.material; mk.pole.position.set(x, y + 4.5, z);
  if (typeof makeLabel === 'function') { if (!mk.lbl) { mk.lbl = makeLabel(txt, '#ffffff', 3.4); E.scene.add(mk.lbl); } else relabel(mk.lbl, txt, '#ffffff'); mk.lbl.visible = true; mk.lbl.position.set(x, y + 10.2, z); mk.lbl.renderOrder = 11; }
};
/* a small attack drone flies in low from its army's rear and dives on the point */
K.fpv = function (att, tx, tz) {
  const E = K.env; if (!E) return false; const d = E.fpv.find(d => !d.on); if (!d) return false;
  const dir = att === 'bull' ? -1 : 1; d.on = true; d.t0 = E.t; d.dur = 2.6 + Math.random() * .8; d.x0 = dir * (52 + Math.random() * 16); d.z0 = cl(tz + rr(-22, 22), -40, 40); d.y0 = 7 + Math.random() * 5; d.x1 = tx; d.z1 = tz; d.ph = Math.random() * 6.28; d.m.visible = true;
  return true;
};
/* ------------------------------------------------------------------ naval actions (each one is called by a real market event, never on a timer) */
K.naval = {
  ship(side, kind) { return K.env ? K.env.ships.find(s => s.side === side && s.kind === kind) : null; },
  /* deck-gun salvo: shells that arc in from the sea. The destroyer's gun by default; kind 'ff' is the frigate's lighter one */
  fire(side, tx, tz, usd, n, kind) {
    const E = K.env, ff = kind === 'ff', s = this.ship(side, ff ? 'ff' : 'dd'); if (!E || !s || typeof FX === 'undefined') return false;
    s.aim = { x: tx, z: tz, until: E.t + 7 };
    const pb = !ff && this.ship(side, 'pb');                                   // the patrol boat's gun joins the destroyer's
    if (pb) { pb.aim = { x: tx, z: tz, until: E.t + 7 }; for (let i = 0; i < 2; i++) K.after(1500 + i * 600, () => { const U = pb.g.userData, tip = U.gunTip.clone(); pb.g.updateMatrixWorld(true); U.tur.localToWorld(tip);
      FX.shoot({ x0: tip.x, y0: tip.y, z0: tip.z, x1: tx + rr(-8, 8), z1: tz + rr(-8, 8), h: 22 + Math.random() * 6, dur: 2100 + Math.random() * 300, sz: 1.2, col: 0xffd27a, kind: 'shell', usd: usd * .3, side, trail: 1 });
      FX.muzzle(tip.x, tip.y, tip.z, 3.2); FX.smoke(tip.x, tip.y, tip.z, E.lite ? 2 : 4, 2.6); AUDIO.play('navgun', { x: pb.g.position.x, z: pb.g.position.z, vol: .6 }); }); }
    for (let i = 0; i < (n || 2); i++) K.after(900 + i * (ff ? 430 : 520), () => {
      const U = s.g.userData, tip = U.gunTip.clone(); s.g.updateMatrixWorld(true); U.tur.localToWorld(tip);
      FX.shoot({ x0: tip.x, y0: tip.y, z0: tip.z, x1: tx + rr(-7, 7), z1: tz + rr(-7, 7), h: (ff ? 24 : 30) + Math.random() * 8, dur: (ff ? 2000 : 2300) + Math.random() * 400, sz: ff ? 1.45 : 1.9, col: 0xffd27a, kind: 'shell', usd, side, trail: 1 });
      FX.muzzle(tip.x, tip.y, tip.z, ff ? 4.4 : 6); FX.smoke(tip.x, tip.y, tip.z, E.lite ? 3 : (ff ? 6 : 8), ff ? 3.6 : 4.5); AUDIO.play('navgun', { x: s.g.position.x, z: s.g.position.z, vol: ff ? .8 : 1, big: !ff });
    });
    return true;
  },
  /* cruise missiles out of the destroyer's vertical cells: up, over, then low across the water and the land */
  cruise(side, tx, tz, n) {
    const E = K.env, s = this.ship(side, 'dd'), A4 = window.GFX4 && GFX4.air; if (!E || !s || !A4 || !A4.ready) return false;
    for (let i = 0; i < n; i++) K.after(i * 430, () => {
      const p0 = s.g.userData.vls.clone(); p0.z += i % 2 ? .7 : -.7; p0.x += ((i >> 1) % 2 ? .9 : -.9); s.g.updateMatrixWorld(true); s.g.localToWorld(p0);
      const p1 = new THREE.Vector3(cl(tx + rr(-10, 10), -72, 72), 0, cl(tz + rr(-16, 16), -36, 36)); p1.y = ARMY.gy(p1.x, p1.z);
      const m = A4.spawn('C', side, p0, p1, Math.hypot(p1.x - p0.x, p1.z - p0.z) / 78, 0); if (!m) return; m.boost = 1;
      FX.smoke(p0.x, p0.y, p0.z, E.lite ? 5 : 10, 5, 0); FX.muzzle(p0.x, p0.y + 1, p0.z, 4.5); AUDIO.play('missile', { x: p0.x, z: p0.z, vol: .8, small: true });
    });
    return true;
  },
  /* the submarine surfaces, fires from its tubes and goes down again */
  sub(side, tx, tz, n, usd) {
    const E = K.env, s = E && E.subs[side], A4 = window.GFX4 && GFX4.air; if (!s || !A4 || !A4.ready) return false;
    s.want = 0; s.until = E.t + 15 + n;
    for (let i = 0; i < n; i++) K.after(4200 + i * 950, () => {
      const p0 = s.g.userData.tubes.clone(); p0.x -= i * 1.8; s.g.updateMatrixWorld(true); s.g.localToWorld(p0);
      const p1 = new THREE.Vector3(cl(tx + rr(-9, 9), -72, 72), 0, cl(tz + rr(-14, 14), -36, 36)); p1.y = ARMY.gy(p1.x, p1.z);
      const m = A4.spawn('B', side, p0, p1, 6.2 + Math.random() * .6, 130 + Math.random() * 30); if (!m) return;
      FX.smoke(p0.x, p0.y, p0.z, E.lite ? 8 : 18, 7, 0); FX.muzzle(p0.x, p0.y + 2, p0.z, 6);
      for (let k = 0; k < (E.lite ? 10 : 24); k++) FX.spawn(4, p0.x + rr(-2.5, 2.5), SEA + .3, p0.z + rr(-2.5, 2.5), rr(-3, 3), rr(5, 11), rr(-3, 3), 1.2 + Math.random(), 3.2);
      AUDIO.play('missile', { x: p0.x, z: p0.z, vol: 1 });
    });
    return true;
  }
};

})();
