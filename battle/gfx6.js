/* entekhab.net — «نبرد من» machines and carrier aviation (three.js r128; loaded after gfx5.js and before battle.js)
   Machines: a humanoid robot (the infantry skeleton with its own body) and a four-legged robot dog (its own skeleton and gait),
     drawn instanced with the infantry material and bone texture. Each army keeps one team. It stands guard inside the base and
     goes out to fire only for a sweep of the order book (battle.js detects it); the team is not liquidity and is never counted.
   Carrier aviation: an aircraft carrier per army out in the bay, with its ready jets on the catapults and queued behind them.
     Strike jets are shot off, fly the attack run over the field and come back to an arrested landing and a spot on deck; the
     strike helicopters lift from its quarter; the frigate's cells can answer an incoming missile. Between strikes a single jet
     flies a circuit over the bay and lands: that one never drops anything.
   Graphics helpers only; battle.js objects (scene, FX, AUDIO, ARMY, WORLD, DIRECTOR …) are read at run time. */
(function () {
'use strict';
const G = window.GFX, K5 = window.GFX5, K = window.GFX6 = {};
if (!G || !K5) return;
const TAU = Math.PI * 2;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rr = (a, b) => a + Math.random() * (b - a);
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const { loft, sbox, tube, ball, rodX, mergeI } = K5;
const RIG = K5.rig, { HIP, SHO, ELB, KNEE, WP, ROWT, rot, mul, put } = RIG;
const cylZ = (r, len, seg, x, y, z) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };
const METAL = 2, ACC = 4, DARK = 6, LENS = 7, PLATE = 9, EYE = 10;
const tag = L => (g, bone, mat) => { const n = g.attributes.position.count; g.setAttribute('aPM', new THREE.BufferAttribute(new Float32Array(n).fill(bone + mat * 32), 1)); L.push(g); };

/* ================================================================== humanoid robot
   Same joints as the soldier (so the same posing and arm IK drive it), its own body: armour shells over exposed joints,
   a sensor head with a lit visor, a power pack, a heavier rifle with a drum. Role 4 in GFX5.pose / GFX5.bones. */
K.robotGeo = function (lod) {
  const hi = !lod, L = [], add = tag(L), TS = hi ? 8 : 5, LS = hi ? 10 : 6, JS = hi ? 8 : 6;
  [[.105, 3, 4], [-.105, 5, 6]].forEach(([z, th, sh]) => {
    const s = Math.sign(z);
    add(tube(.088, .066, .95, .56, TS, 0, z), th, PLATE);
    add(sbox(.05, .24, .035, 0, .75, z + s * .085), th, DARK);
    add(cylZ(.062, .15, JS, .008, KNEE, z), sh, METAL);
    add(tube(.062, .046, KNEE - .03, .13, TS, .004, z), sh, PLATE);
    add(sbox(.035, .3, .09, .058, .31, z), sh, PLATE);
    if (hi) add(tube(.014, .014, .44, .12, 5, -.062, z), sh, METAL);
    add(sbox(.27, .075, .112, .075, .04, z), sh, DARK);
    if (hi) add(sbox(.09, .05, .1, -.08, .05, z), sh, METAL);
  });
  add(loft([[.86, .085, .135, 0], [.94, .1, .155, 0], [1.02, .088, .14, 0]], LS, true, true), 0, DARK);
  [.165, -.165].forEach(z => add(cylZ(.066, .06, JS, 0, .935, z), 0, METAL));
  add(sbox(.1, .09, .2, .07, .95, 0), 0, PLATE);
  add(tube(.07, .082, 1.14, 1.0, TS, 0, 0), 1, METAL);
  add(loft(hi ? [[1.1, .1, .15, 0], [1.2, .13, .195, .008], [1.36, .142, .218, .01], [1.46, .118, .205, .004], [1.52, .07, .11, 0]]
              : [[1.1, .1, .15, 0], [1.25, .135, .2, .008], [1.44, .125, .21, .004], [1.52, .07, .11, 0]], LS, true), 1, PLATE);
  add(sbox(.03, .09, .09, .142, 1.33, 0), 1, EYE);
  if (hi) { [.1, -.1].forEach(z => add(sbox(.035, .17, .07, .13, 1.3, z), 1, DARK)); add(sbox(.05, .05, .26, .12, 1.17, 0), 1, DARK); }
  add(sbox(.13, .3, .27, -.2, 1.3, 0), 1, DARK);
  if (hi) [.09, -.09].forEach(z => add(tube(.03, .03, 1.5, 1.42, 6, -.2, z), 1, METAL));
  { const a = new THREE.CylinderGeometry(.005, .007, .5, hi ? 4 : 3, 1, true); a.translate(-.23, 1.72, .1); add(a, 1, METAL); }
  add(tube(.036, .042, 1.61, 1.5, hi ? 8 : 5, .004, 0), 2, METAL);
  add(loft(hi ? [[1.6, .075, .078, .004], [1.65, .1, .094, .008], [1.735, .1, .094, .004], [1.785, .066, .068, -.008]]
              : [[1.6, .075, .078, .004], [1.68, .1, .094, .008], [1.785, .066, .068, -.008]], hi ? 10 : 7, true), 2, PLATE);
  add(sbox(.03, .04, .16, .097, 1.7, 0), 2, EYE);
  [.096, -.096].forEach(z => add(cylZ(.032, .022, 6, -.005, 1.69, z), 2, DARK));
  if (hi) add(sbox(.11, .05, .014, -.03, 1.8, 0), 2, PLATE);
  [[.215, 7, 8], [-.215, 9, 10]].forEach(([z, up, fo]) => {
    const s = Math.sign(z);
    add(ball(.072, hi ? 8 : 6, hi ? 5 : 4, 0, SHO, z), up, METAL);
    add(sbox(.16, .1, .12, 0, SHO + .045, z + s * .03), up, PLATE);
    add(tube(.056, .048, SHO - .03, ELB + .03, TS, 0, z), up, PLATE);
    add(sbox(.078, .05, .014, 0, 1.36, z + s * .056), up, ACC);
    add(cylZ(.047, .12, 6, 0, ELB, z), fo, METAL);
    add(tube(.05, .042, ELB - .02, .94, TS, 0, z), fo, PLATE);
    if (hi) add(sbox(.07, .15, .022, 0, 1.06, z + s * .05), fo, DARK);
    add(sbox(.075, .11, .055, .005, .875, z), fo, DARK);
  });
  const y = WP[1], z = -.07;
  add(sbox(.34, .09, .055, .17, y, z), 11, METAL); add(sbox(.3, .072, .062, .46, y + .004, z), 11, DARK);
  add(rodX(.016, .016, .6, .82, hi ? 6 : 4, y + .004, z), 11, METAL);
  if (hi) add(rodX(.024, .024, .8, .86, 6, y + .004, z, true), 11, METAL);
  add(cylZ(.062, .05, JS, .2, y - .1, z), 11, METAL);
  add(sbox(.04, .1, .034, .062, y - .078, z, -.28), 11, METAL);
  add(sbox(.2, .062, .042, -.09, y - .004, z), 11, DARK);
  add(sbox(.11, .05, .045, .2, y + .068, z), 11, DARK);
  if (hi) add(sbox(.02, .02, .03, .27, y + .07, z), 11, EYE);
  const g = mergeI(L, ['aPM']); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .9, 0), 4); return g;
};

/* ================================================================== robot dog
   Faces +X, Y up, 1 unit = 1 m (0.72 m to the top rail). Bones: 0 body · 1 head · 2/3 front-left thigh/shank · 4/5 front-right ·
   6/7 rear-left · 8/9 rear-right · 10 weapon station · 11 aerial. Legs are straight down in the bind pose; the knees fold backwards. */
const DHX = .34, DHZ = .15, DHH = .5, DKY = .25, DL1 = .25, DL2 = .28;
K.dogGeo = function (lod) {
  const hi = !lod, L = [], add = tag(L), JS = hi ? 8 : 6;
  add(sbox(.84, .19, .27, 0, .56, 0), 0, PLATE);
  add(sbox(.6, .05, .16, 0, .675, 0), 0, DARK);
  add(sbox(.5, .06, .2, 0, .45, 0), 0, DARK);
  [DHX, -DHX].forEach(x => add(sbox(.17, .17, .36, x, .52, 0), 0, METAL));
  [.137, -.137].forEach(z => add(sbox(.34, .045, .012, 0, .58, z), 0, ACC));
  add(sbox(.012, .035, .12, -.425, .57, 0), 0, EYE);
  if (hi) add(sbox(.2, .03, .2, -.2, .705, 0), 0, DARK);
  add(cylZ(.05, .2, JS, .43, .55, 0), 1, METAL);
  add(sbox(.17, .13, .21, .52, .565, 0), 1, PLATE);
  add(sbox(.015, .04, .16, .607, .58, 0), 1, EYE);
  if (hi) { [.07, -.07].forEach(z => add(sbox(.016, .03, .03, .607, .535, z), 1, LENS)); add(sbox(.1, .02, .16, .52, .64, 0), 1, DARK); }
  [[DHX, DHZ, 2, 3], [DHX, -DHZ, 4, 5], [-DHX, DHZ, 6, 7], [-DHX, -DHZ, 8, 9]].forEach(([x, z, th, sh]) => {
    const zz = z + Math.sign(z) * .06;
    add(cylZ(.056, .07, JS, x, DHH, zz), th, METAL);
    add(sbox(.075, DL1 + .04, .05, x, (DHH + DKY) / 2, zz), th, PLATE);
    add(cylZ(.036, .07, 6, x, DKY, zz), sh, METAL);
    add(tube(.024, .018, DKY, 0, hi ? 6 : 4, x, zz), sh, DARK);
    add(ball(.036, 6, 4, x, -.004, zz), sh, DARK);
  });
  add(tube(.05, .06, .74, .68, JS, .02, 0), 10, DARK);
  add(sbox(.22, .085, .11, .06, .775, 0), 10, METAL);
  add(rodX(.015, .013, .16, .52, hi ? 6 : 4, .78, 0), 10, METAL);
  add(sbox(.06, .05, .05, -.01, .84, 0), 10, DARK);
  add(sbox(.012, .03, .035, .022, .845, 0), 10, EYE);
  if (hi) add(sbox(.11, .075, .065, -.07, .765, .09), 10, DARK);
  { const a = new THREE.CylinderGeometry(.004, .006, .34, 3, 1, true); a.translate(-.36, .84, .08); add(a, 11, METAL); }
  const g = mergeI(L, ['aPM']); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .5, 0), 3); return g;
};
const _B = new Float32Array(6), _t1 = new Float32Array(6), _t2 = new Float32Array(6), _t3 = new Float32Array(6), _ik = [0, 0];
function legIK(px, py) {                     // foot target in the body frame, from the hip → thigh and knee angles
  const d = cl(Math.hypot(px, py), .1, DL1 + DL2 - .003), th = Math.atan2(px, -py);
  _ik[0] = th - Math.acos(cl((DL1 * DL1 + d * d - DL2 * DL2) / (2 * DL1 * d), -1, 1));
  _ik[1] = Math.PI - Math.acos(cl((DL1 * DL1 + DL2 * DL2 - d * d) / (2 * DL1 * DL2), -1, 1));
}
const OFF_TROT = [0, .5, .5, 0], OFF_RUN = [0, .12, .52, .64];
/* the dog's row of bone matrices from its state: sitting, standing, braced to fire, trotting or running (t in ms) */
K.dogBones = function (d, t, dt, T, row) {
  const to = row * ROWT * 4, q = d.q || (d.q = new Float32Array([0, .44, 0, 0, 0]));
  let bp = 0, bh = .44, ga = 0, gp = 0, hp = 0, k = 9;
  if (d.mv) { const run = d.sp >= 12; ga = 1; d.fq = run ? 3.3 : 2.1; d.S = run ? .46 : .27; d.lift = run ? .13 : .08; d.off = run ? OFF_RUN : OFF_TROT; bh = run ? .41 : .44; bp = run ? -.07 : 0; hp = run ? .1 : 0; k = 12; }
  else if (d.st === 2) { bh = .37; bp = -.05; hp = .05; k = 14; }
  else if (d.sit) { bp = .43; bh = .17; hp = -.28; k = 5; }
  const a = 1 - Math.exp(-dt * k); q[0] += (bp - q[0]) * a; q[1] += (bh - q[1]) * a; q[2] += (ga - q[2]) * a; q[3] += (gp - q[3]) * a; q[4] += (hp - q[4]) * a;
  if (q[2] > .02) d.ph = (d.ph || 0) + dt * (d.fq || 2.1);
  const rec = d.shot ? Math.exp(-Math.max(0, t - d.shot) / 1000 * 16) : 0, c = Math.cos(q[0]), s = Math.sin(q[0]);
  rot(_B, q[0], -DHX, DHH); _B[5] += q[1] - DHH + Math.abs(Math.sin((d.ph || 0) * TAU)) * .03 * q[2]; _B[4] -= rec * .025;
  put(T, to, _B);
  mul(_t2, _B, rot(_t1, q[4] - q[0] * .85 + Math.sin(t * .0011 + d.sd * 20) * .05 * (1 - q[2]), .43, .55)); put(T, to + 12, _t2);
  const off = d.off || OFF_TROT, S = d.S || .27, lift = d.lift || .08, sitK = cl(q[0] / .43, 0, 1);
  for (let i = 0; i < 4; i++) {
    const hx = i < 2 ? DHX : -DHX, hipX = _B[0] * hx + _B[2] * DHH + _B[4], hipY = _B[1] * hx + _B[3] * DHH + _B[5];
    let fx = hx + (i >= 2 ? .1 * sitK : .02 * sitK), fy = 0;
    if (q[2] > .02) { const p = ((d.ph || 0) + off[i]) % 1, duty = .55; if (p < duty) fx += (S / 2 - S * p / duty) * q[2]; else { const u = (p - duty) / (1 - duty), e = u * u * (3 - 2 * u); fx += (-S / 2 + S * e) * q[2]; fy += lift * Math.sin(Math.PI * u) * q[2]; } }
    const vx = fx - hipX, vy = fy - hipY; legIK(c * vx + s * vy, -s * vx + c * vy);
    mul(_t2, _B, rot(_t1, _ik[0], hx, DHH)); put(T, to + 12 * (2 + 2 * i), _t2); mul(_t3, _t2, rot(_t1, _ik[1], hx, DKY)); put(T, to + 12 * (3 + 2 * i), _t3);
  }
  mul(_t2, _B, rot(_t1, q[3] + rec * .09, 0, .7)); put(T, to + 120, _t2);
  mul(_t2, _B, rot(_t1, Math.sin(t * .004 + d.sd * 9) * .05 * (1 + q[2] * 2.5), -.36, .68)); put(T, to + 132, _t2);
  T[to + 144] = d.sd; T[to + 145] = 0;
};

/* ================================================================== the machine teams
   Four humanoids and four dogs an army. In the base they stand by just inside the front gate (the dogs sit); a sweep of the
   order book on their side sends them out through the gate to a position behind their own line, where they fire the volleys
   the sweep called for; with no further sweep for a while they go home. */
const RB = K.RB = { H: 4, D: 4, sides: {}, hold: 40000, ready: false };
RB.rows = 2 * (RB.H + RB.D);
const SCB = 1.86, SCD = 1.72;                  // world scale: a robot stands a little taller than a soldier (1.7)
const home = (S, dog, i) => { const d = S.dir, gz = gateZ(d * GATE); return dog ? [d * (65.1 + (i % 2) * 1.9), gz - 5.3 - (i >> 1) * 2.3] : [d * (69.0 + (i % 2) * 2.3), gz - 5.5 - (i >> 1) * 2.6]; };
RB.init = function () {
  const soft = !G.std, lod = soft ? 1 : 0; this.hgeo = K.robotGeo(lod); this.dgeo = K.dogGeo(lod);
  for (const key of ['bull', 'bear']) {
    const A = ARMY.sides[key]; if (!A || !A.smat) return;
    const mk = (g0, cap) => { const g = g0.clone(), row = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); row.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aRow', row);
      const m = new THREE.InstancedMesh(g, A.smat.mat, cap); m.customDepthMaterial = A.smat.depth; m.castShadow = true; m.receiveShadow = !!G.std; m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
    const S = { key, dir: A.dir, hm: mk(this.hgeo, this.H), dm: mk(this.dgeo, this.D), row0: ARMY.MAX * 2 + (key === 'bull' ? 0 : this.H + this.D), bots: [], dogs: [], state: 'base', last: 0, shots: 0, px: 0, zc: 0, sh: soft && ARMY.shadowMesh ? ARMY.shadowMesh(this.H + this.D) : null };
    const face = A.dir < 0 ? 0 : Math.PI;
    for (let i = 0; i < this.H; i++) { const p = home(S, false, i), sd = (.21 + i * .233) % 1; S.bots.push({ i, role: 4, st: ST.IDLE, t0: 0, x: p[0], z: p[1], y: 0, tx: p[0], tz: p[1], x0: p[0], z0: p[1], mv: 0, legs: null, sp: 10.5, dur: 1, sd, rank: 0, stn: 0, yaw: 0, ry: face, aimT: 0, aimY: 0, shot: 0, cv: 0, gyT: 0, next: 0 }); }
    for (let i = 0; i < this.D; i++) { const p = home(S, true, i), sd = (.57 + i * .191) % 1; S.dogs.push({ i, x: p[0], z: p[1], y: 0, tx: p[0], tz: p[1], x0: p[0], z0: p[1], mv: 0, legs: null, sp: 17, dur: 1, sd, ry: face, aimT: 0, aimY: 0, shot: 0, st: 0, sit: true, gyT: 0, next: 0, ph: sd }); }
    this.sides[key] = S;
  }
  this.ready = true;
};
const legTo = (o, p, t) => { o.x0 = o.x; o.z0 = o.z; o.tx = p[0]; o.tz = p[1]; o.t0 = t; o.dur = Math.max(.25, Math.hypot(o.tx - o.x, o.tz - o.z) / o.sp); o.mv = 1; };
const routeTo = (o, pts, t) => { o.legs = pts.slice(1); legTo(o, pts[0], t); };
const inBase = (S, o) => Math.abs(o.x) > GATE - .5;
function go(S, o, dest, t, sp) {              // to a point, through the gate whenever the wall lies between
  const d = S.dir, gz = gateZ(d * GATE), from = inBase(S, o), to = Math.abs(dest[0]) > GATE - .5, pts = [];
  o.sp = sp;
  if (from && !to) pts.push([d * (GATE + 2.4), gz + rr(-1.6, 1.6)], [d * (GATE - 3), gz + rr(-2, 2)]);
  else if (!from && to) pts.push([d * (GATE - 3), gz + rr(-2, 2)], [d * (GATE + 2.4), gz + rr(-1.6, 1.6)]);
  pts.push(dest); routeTo(o, pts, t);
}
/* a clear stretch of the lane behind the line: the candidate with the fewest soldiers standing on it */
function clearZ(S, px) {
  const A = ARMY.sides[S.key]; let best = 0, bn = 1e9;
  for (let k = 0; k < 7; k++) { const z = rr(-27, 27), n = ARMY.near(A, px, z, 9).length + Math.abs(z) * .01; if (n < bn) { bn = n; best = z; } }
  return best;
}
function spots(S, px, zc) {
  const d = S.dir, H = RB.H, D = RB.D;
  return { h: i => [cl(px + d * (i % 2) * 1.9, -XMAX + 1, XMAX - 1), cl(zc + (i - (H - 1) / 2) * 3.3, -36, 36)], g: i => [cl(px - d * (3.6 + (i % 2) * 1.3), -XMAX + 1, XMAX - 1), cl(zc + (i - (D - 1) / 2) * 5.2 + 1.4, -36, 36)] };
}
RB.deploy = function (S, px, zc, t) {
  const P = spots(S, px, zc); S.px = px; S.zc = zc; S.state = 'out';
  S.bots.forEach((b, i) => { go(S, b, P.h(i), t + i * 90, 10.5); b.st = ST.RUN; b.t0 = t; b.stn = K5.stance(4, b.sd); });
  S.dogs.forEach((g, i) => { g.sit = false; g.st = 0; go(S, g, P.g(i), t + i * 60, 17); });
};
RB.recall = function (S, t) {
  S.state = 'back'; S.shots = 0;
  S.bots.forEach((b, i) => { go(S, b, home(S, false, i), t + i * 120, 7.2); b.st = ST.RUN; b.t0 = t; });
  S.dogs.forEach((g, i) => { g.st = 0; go(S, g, home(S, true, i), t + i * 80, 12.5); });
};
/* a sweep of the book on this army's side: n price levels taken in one go, worth usd, with the front at fx. True when the team sets out. */
RB.sweep = function (side, fx, usd, n) {
  const S = this.sides[side]; if (!this.ready || !S) return false;
  const t = vt(), px = cl(fx + S.dir * 8.5, -XMAX + 3, XMAX - 3);
  S.last = t; S.shots = Math.min(16, S.shots + cl(Math.round(n * .7 + (usd >= 5e5 ? 3 : usd >= 1.5e5 ? 1 : 0)), 2, 9));
  if (S.state !== 'out' || Math.abs(px - S.px) > 13) { this.deploy(S, px, S.state === 'out' ? S.zc : clearZ(S, px), t); return true; }
  return false;
};
RB.clear = function () {
  for (const k in this.sides) { const S = this.sides[k], face = S.dir < 0 ? 0 : Math.PI; S.state = 'base'; S.shots = 0;
    S.bots.forEach((b, i) => { const p = home(S, false, i); b.x = p[0]; b.z = p[1]; b.mv = 0; b.legs = null; b.st = ST.IDLE; b.ry = face; b.gyT = 0; b.q = null; });
    S.dogs.forEach((g, i) => { const p = home(S, true, i); g.x = p[0]; g.z = p[1]; g.mv = 0; g.legs = null; g.st = 0; g.sit = true; g.ry = face; g.gyT = 0; }); }
};
function stepMove(o, t) {
  if (!o.mv) return false;
  if (t < o.t0) return true;                   // staggered start
  const f = cl((t - o.t0) / 1000 / o.dur, 0, 1), e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
  o.x = o.x0 + (o.tx - o.x0) * e; o.z = o.z0 + (o.tz - o.z0) * e; o.gyT = 0;
  if (f >= 1) { if (o.legs && o.legs.length) legTo(o, o.legs.shift(), t); else { o.mv = 0; return false; } }
  return true;
}
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _Q = new Float32Array(20);
function fireFrom(S, o, dog, t) {
  const en = S.key === 'bull' ? 'bear' : 'bull', fx = VIEW.round ? X(VIEW.price || VIEW.round.p0) : 0, e = ARMY.pick(en);
  const x1 = e ? e.x + rr(-.8, .8) : fx - S.dir * rr(2, 6), z1 = e ? e.z + rr(-1.2, 1.2) : o.z + rr(-9, 9);
  const a = Math.atan2(-(z1 - o.z), x1 - o.x); o.aimY = a; o.aimT = t + 1700; o.shot = t;
  const sc = dog ? SCD : SCB, m0 = dog ? .52 : .98, m1 = dog ? .78 : 1.45, mx = o.x + Math.cos(a) * m0 * sc, mz = o.z - Math.sin(a) * m0 * sc, my = o.y + m1 * sc * (dog ? (o.q ? o.q[1] / .44 : 1) : 1);
  if (!dog && o.st !== ST.FIRE) { o.st = ST.FIRE; o.t0 = t; }
  if (dog) o.st = 2;
  if (PREF.layers.fx) {
    const col = S.key === 'bull' ? 0x7dffd0 : 0xffb38a, n = dog ? 4 : 3;
    for (let k = 0; k < n; k++) K5.after(k * (dog ? 70 : 95), () => { FX.shoot({ x0: mx, y0: my, z0: mz, x1: x1 + rr(-.7, .7), z1: z1 + rr(-.7, .7), h: .5, dur: 170 + Math.hypot(x1 - mx, z1 - mz) * 5.5, sz: .62, col, kind: 'tracer', usd: 0, side: S.key }); FX.muzzle(mx, my, mz, dog ? .8 : 1.05); });
  }
  AUDIO.play(dog ? 'dogfire' : 'rgun', { x: o.x, z: o.z, vol: dog ? .34 : .42 });
}
RB.tick = function (dt) {
  if (!this.ready) return;
  const t = vt(), BT = ARMY.boneTex.image.data, fx = VIEW.round ? X(VIEW.price || VIEW.round.p0) : 0;
  for (const k in this.sides) {
    const S = this.sides[k], base = S.dir < 0 ? 0 : Math.PI; let moving = 0, n = 0;
    /* go home when nothing has called for a while or the market has gone quiet; follow the line when it has moved away */
    if (S.state === 'out') {
      if (t - S.last > this.hold || ARMY.rest) this.recall(S, t);
      else if (t - (S.adj || 0) > 2500) { S.adj = t; const px = cl(fx + S.dir * 8.5, -XMAX + 3, XMAX - 3); if (Math.abs(px - S.px) > 6.5 && !S.bots.some(b => b.mv)) { const P = spots(S, px, S.zc); S.px = px; S.bots.forEach((b, i) => { b.sp = 4.2; routeTo(b, [P.h(i)], t); b.st = ST.WALK; b.t0 = t; }); S.dogs.forEach((g, i) => { g.sp = 6; routeTo(g, [P.g(i)], t); }); } }
    }
    for (let i = 0; i < S.bots.length; i++) {
      const b = S.bots[i], mv = stepMove(b, t); if (mv) moving++;
      if (!mv) {
        if (b.st === ST.RUN || b.st === ST.WALK) { b.st = ST.IDLE; b.t0 = t; }
        else if (b.st === ST.FIRE && t - b.shot > 800) { b.st = ST.IDLE; b.t0 = t; }
        if (S.state === 'out' && S.shots > 0 && t > b.next) { b.next = t + 520 + Math.random() * 520; S.shots--; fireFrom(S, b, false, t); }
      }
      if (!(b.gyT > t)) { b.y = ARMY.gy(b.x, b.z); b.gyT = t + 1500; }
      let ty = base; if (mv && t >= b.t0) { const dx = b.tx - b.x0, dz = b.tz - b.z0; if (Math.abs(dx) + Math.abs(dz) > .05) ty = Math.atan2(-dz, dx); } else if (t < b.aimT) ty = b.aimY;
      b.ry += wrap(ty - b.ry) * Math.min(1, dt * 9);
      _p.set(b.x, b.y, b.z); _q4.set(0, Math.sin(b.ry / 2), 0, Math.cos(b.ry / 2)); _s.set(SCB, SCB, SCB); _m4.compose(_p, _q4, _s); _m4.toArray(S.hm.instanceMatrix.array, i * 16); S.hm.geometry.attributes.aRow.array[i] = S.row0 + i;
      K5.pose(b, t, dt, _Q, 0); K5.bones(_Q, 0, 4, BT, S.row0 + i);
      if (S.sh) { _p.y = b.y + .06; _s.set(SCB * 1.3, 1, SCB * 1.3); _m4.compose(_p, _q4, _s); _m4.toArray(S.sh.instanceMatrix.array, n * 16); } n++;
    }
    for (let i = 0; i < S.dogs.length; i++) {
      const g = S.dogs[i], mv = stepMove(g, t); if (mv) moving++;
      if (!mv) {
        if (g.st === 2 && t - g.shot > 650) g.st = 0;
        if (S.state === 'out' && S.shots > 0 && t > g.next) { g.next = t + 640 + Math.random() * 700; S.shots--; fireFrom(S, g, true, t); }
      }
      if (!(g.gyT > t)) { g.y = ARMY.gy(g.x, g.z); g.gyT = t + 1500; }
      let ty = base; if (mv && t >= g.t0) { const dx = g.tx - g.x0, dz = g.tz - g.z0; if (Math.abs(dx) + Math.abs(dz) > .05) ty = Math.atan2(-dz, dx); } else if (t < g.aimT) ty = g.aimY;
      g.ry += wrap(ty - g.ry) * Math.min(1, dt * 10);
      _p.set(g.x, g.y, g.z); _q4.set(0, Math.sin(g.ry / 2), 0, Math.cos(g.ry / 2)); _s.set(SCD, SCD, SCD); _m4.compose(_p, _q4, _s); _m4.toArray(S.dm.instanceMatrix.array, i * 16); S.dm.geometry.attributes.aRow.array[i] = S.row0 + RB.H + i;
      K.dogBones(g, t, dt, BT, S.row0 + RB.H + i);
      if (S.sh) { _p.y = g.y + .06; _s.set(SCD * 1.5, 1, SCD * .9); _m4.compose(_p, _q4, _s); _m4.toArray(S.sh.instanceMatrix.array, n * 16); } n++;
    }
    if (S.state === 'back' && !moving) { S.state = 'base'; S.dogs.forEach(g => { g.sit = true; }); }
    S.hm.count = S.bots.length; S.dm.count = S.dogs.length; S.hm.instanceMatrix.needsUpdate = S.dm.instanceMatrix.needsUpdate = true;
    S.hm.geometry.attributes.aRow.needsUpdate = S.dm.geometry.attributes.aRow.needsUpdate = true;
    if (S.sh) { S.sh.count = n; S.sh.instanceMatrix.needsUpdate = true; }
    if (moving && Math.random() < dt * 2.2) { const o = Math.random() < .5 ? S.bots[(Math.random() * S.bots.length) | 0] : S.dogs[(Math.random() * S.dogs.length) | 0]; if (o.mv) AUDIO.play('servo', { x: o.x, z: o.z, vol: .16 }); }
  }
};

/* ================================================================== aircraft carrier
   Design frame (the group is scaled by CS): bow towards +x, y up from the waterline, starboard = +z (the island stands there,
   the angled strip runs out to port). Aircraft keep their own size, so everything that carries one is laid out in design units. */
const CS = 1.22;                               // 106 design units → a 129 m ship
const DK = 6.6;                                // flight deck above the waterline
const CATS = [[14, 2.6, 50], [14, -4.0, 50]];  // catapults: x of the shuttle at rest, z, x at the bow
const LAND = { ax: -50, az: 1.5, bx: 14, bz: -11.5 };   // the angled strip, stern to bow
const LYAW = Math.atan2(-(LAND.bz - LAND.az), LAND.bx - LAND.ax);
const SPOT = [[14, 2.6], [14, -4.0], [4.5, 2.6], [4.5, -4.0], [-5, 2.6]];   // ready jets: on the two catapults, then queued behind them
const AHEAD = [-1, -1, 0, 1, 2];               // the spot in front of each
const PARK = [[22, 8.9, 1.61], [29.5, 8.9, 1.54], [37, 8.8, 1.59], [-26, 8.9, 1.52], [-46, -7.3, .03]];   // airframes that stay on deck: x, z, heading
const HPAD = [[-45, 7.6], [-33, 7.6]];         // helicopter spots on the starboard quarter
const JH = 1.02, HH = .99;                     // airframe datum above the deck (world units): a jet on its wheels, a helicopter on its skids
const IX = -12, IZ = 8.2;                      // the island
const HOLD = {};                               // marks a spot kept clear behind a raised blast deflector
const _d = new THREE.Object3D(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
function join(list) {                          // non-indexed geometries with the same attributes → one
  const out = new THREE.BufferGeometry();
  for (const n of Object.keys(list[0].attributes)) {
    const sz = list[0].attributes[n].itemSize; let len = 0; list.forEach(g => { len += g.attributes[n].array.length; });
    const A = new Float32Array(len); let o = 0; list.forEach(g => { A.set(g.attributes[n].array, o); o += g.attributes[n].array.length; });
    out.setAttribute(n, new THREE.BufferAttribute(A, sz));
  }
  return out;
}
let _jg = null, _hg = null, _gg = null;
const jetGeo = mat => _jg || (_jg = G.jet(mat).children[0].geometry);
function heliGeo(mat) {                        // a helicopter at rest in one piece: airframe, rotor and tail rotor
  if (_hg) return _hg;
  const h = G.heli(mat), U = h.userData, at = (g, x, y, z, ry) => { const c = g.clone(); if (ry) c.rotateY(ry); c.translate(x, y, z); return c; };
  return (_hg = join([h.children[0].geometry, at(U.rotor.children[0].geometry, U.rotor.position.x, U.rotor.position.y, U.rotor.position.z, .5), at(U.tr.children[0].geometry, U.tr.position.x, U.tr.position.y, U.tr.position.z, 0)]));
}
function gearGeo() {                           // a jet's undercarriage, in the airframe's own frame
  if (_gg) return _gg; const { B, prim } = K5.kit, L = [];
  [[1.9, 0], [-1.2, 1.1], [-1.2, -1.1]].forEach(([x, z]) => { L.push(B(.09, .5, .09, x, -.72, z, 0x8d9396)); const w = new THREE.CylinderGeometry(.17, .17, .13, 8); w.rotateX(Math.PI / 2); w.translate(x, -.85, z); L.push(prim(w, 0x121416)); });
  return (_gg = G.merge(L));
}
K.carrier = function (side) {
  const { B, CY, prim } = K5.kit, P = K5.ship.NAVY[side], L = [], Lt = [], g = new THREE.Group(), SM = K5.ship.shipMat();
  const st = [[-52, 8.4, 7.0, 5.7], [-47, 9.2, 8.2, 5.7], [-18, 9.4, 8.6, 5.7], [22, 9.2, 8.3, 5.7], [38, 7.4, 5.4, 5.8], [47, 4.0, 2.2, 5.9], [53.5, .25, .1, 6.0]];
  L.push(K5.ship.hullGeo(st, P.hull, P.boot, P.deck));
  const out = [[53, 4.6], [50.5, 8], [34, 10.2], [-50, 10.2], [-53, 8.2], [-53, -8.2], [-50, -10.2], [-40, -10.2], [-33, -15], [16, -15], [25, -10.2], [34, -10.2], [50.5, -8], [53, -4.6]];
  const sh = new THREE.Shape(); out.forEach(([x, z], i) => { if (i) sh.lineTo(x, -z); else sh.moveTo(x, -z); });
  const slab = new THREE.ExtrudeGeometry(sh, { depth: .8, bevelEnabled: false, curveSegments: 1 }); slab.rotateX(-Math.PI / 2); slab.translate(0, DK - .8, 0); L.push(prim(slab, 0x3a3f42));
  L.push(B(47, 1.7, 5.4, -9, DK - 1.65, -12, P.hull), B(24, 1.7, 2.2, IX, DK - 1.65, 9.7, P.hull));
  /* deck markings: catapult tracks and the wells of the blast deflectors, the landing strip, lift outlines */
  const Y = DK + .025, WH = 0xdedcd3, YL = 0xd9b21c;
  CATS.forEach(([x0, z, x1]) => { L.push(B(x1 - x0 + 1.6, .05, .34, (x0 + x1) / 2 - .8, Y, z, 0x9aa1a3), B(3.1, .04, 4.7, x0 - 5.1, DK + .02, z, 0x25292b)); });
  { const dx = LAND.bx - LAND.ax, dz = LAND.bz - LAND.az, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const strip = (w, l, f, off, hex) => { const b = new THREE.BoxGeometry(l, .05, w); b.rotateY(LYAW); b.translate(LAND.ax + dx * f - uz * off, Y, LAND.az + dz * f + ux * off); L.push(prim(b, hex)); };
    for (let i = 0; i < 9; i++) strip(.42, 3.6, .08 + i * .1, 0, WH);
    strip(.3, len * .9, .5, 4.5, WH); strip(.3, len * .9, .5, -4.5, WH); strip(.3, len * .86, .5, 5.4, YL);
    for (let i = 0; i < 4; i++) strip(9.2, .14, .16 + i * .05, 0, 0x1c1f21);          // arrester wires lie across the strip
  }
  L.push(B(9.4, .04, 5.6, 4, DK + .02, 7.3, 0x303437), B(9.4, .04, 5.6, -26, DK + .02, 7.3, 0x303437), B(8, .04, 5, -42, DK + .02, -7.6, 0x303437));
  L.push(B(100, .05, .22, -1, Y, 9.9, YL), B(1.7, .8, 1.1, -17, DK + .4, 5.6, 0xd9a514), B(1.7, .8, 1.1, -8.6, DK + .4, 5.75, 0xd9a514));
  HPAD.forEach(([x, z]) => { const r = new THREE.RingGeometry(2.5, 2.8, 20); r.rotateX(-Math.PI / 2); r.translate(x, Y + .01, z); L.push(prim(r, WH), B(1.9, .05, .3, x, Y + .01, z, WH), B(.3, .05, 1.5, x - .8, Y + .01, z, WH), B(.3, .05, 1.5, x + .8, Y + .01, z, WH)); });
  /* island: bridge levels, window bands, funnel, mast and domes */
  L.push(B(17, 4.6, 3.6, IX, DK + 2.3, IZ, P.sup), B(11, 2.0, 4.0, IX + 1.5, DK + 5.6, IZ, P.sup), B(11.1, .62, 4.1, IX + 1.5, DK + 5.95, IZ, 0x10161b));
  L.push(B(6, 1.6, 3.2, IX + 2.5, DK + 7.4, IZ, P.sup), B(6.05, .34, 3.25, IX + 2.5, DK + 6.95, IZ, P.band), B(6.1, .5, 3.3, IX + 2.5, DK + 7.75, IZ, 0x10161b));
  L.push(CY(.95, 1.3, 3.0, 6, IX - 5.4, DK + 6.1, IZ + .1, P.sup), CY(1.0, 1.0, .3, 6, IX - 5.4, DK + 7.7, IZ + .1, 0x16181a));
  L.push(CY(.16, .32, 7.2, 5, IX + 3.2, DK + 11.8, IZ, P.dark), B(.14, .14, 4.8, IX + 3.2, DK + 13, IZ, P.dark), CY(.05, .05, 3, 4, IX + 3.2, DK + 16.6, IZ, P.dark));
  L.push(prim(G.T(new THREE.SphereGeometry(1.0, 10, 6), IX - 2.4, DK + 9.4, IZ), 0xe6e7e2), prim(G.T(new THREE.SphereGeometry(.6, 8, 5), IX + 6.6, DK + 8.9, IZ), 0xe6e7e2));
  [[44, 9.3], [44, -9.3], [-50.5, 9.2], [-50.5, -9.2]].forEach(([x, z]) => L.push(B(2.3, .5, 2.3, x, DK - 2.1, z, P.hull), CY(.5, .65, 1.0, 8, x, DK - 1.35, z, 0xdadcd8), prim(G.T(new THREE.SphereGeometry(.55, 8, 5, 0, TAU, 0, Math.PI / 2), x, DK - .85, z), 0xe6e7e2)));
  L.push(CY(.05, .05, 3.2, 4, -52.6, DK + 1.6, 0, 0xcfd2d0), prim(G.T(new THREE.PlaneGeometry(2.6, 1.6), -51.2, DK + 2.4, 0), P.band));
  const body = new THREE.Mesh(G.merge(L), SM); body.castShadow = !!G.std; g.add(body);
  /* lights: deck edge, strip centre line, island windows (lit at night through the environment's light material) */
  for (let x = -48; x <= 48; x += 8) Lt.push(B(.3, .12, .3, x, DK + .06, 10, 0xfff0cc), B(.3, .12, .3, x, DK + .06, x > -36 && x < 20 ? -14.8 : -10, 0xfff0cc));
  for (let i = 0; i < 7; i++) Lt.push(B(.3, .1, .3, LAND.ax + (LAND.bx - LAND.ax) * (.1 + i * .13), DK + .05, LAND.az + (LAND.bz - LAND.az) * (.1 + i * .13), 0xb7ffd0));
  Lt.push(B(11.15, .3, 4.15, IX + 1.5, DK + 5.95, IZ, 0xffe9b8));
  const env = K5.env; if (env && env.lmat) g.add(new THREE.Mesh(G.merge(Lt), env.lmat));
  const rad = new THREE.Mesh(G.merge([B(4.6, .5, .5, 0, 0, 0, P.dark), CY(.18, .22, .6, 6, 0, -.4, 0, P.dark)]), SM); rad.position.set(IX + 3.2, DK + 10.4, IZ); g.add(rad);
  /* blast deflectors: two panels hinged at their forward edge; they lie flush until a jet is on the catapult */
  const jb = new THREE.BoxGeometry(2.8, .1, 4.4); jb.translate(-1.4, 0, 0);
  const jbd = new THREE.InstancedMesh(prim(jb, 0x565c5f), SM, 2); jbd.frustumCulled = false; g.add(jbd);
  const U = { side, cv: true, rad, jbd, len: 106 * CS };
  /* aircraft on deck are instances of the armies' own airframes: the ones that stay, the ready jets and the helicopters at rest */
  if (typeof ARMY !== 'undefined' && ARMY.vmat && ARMY.vmat[side]) {
    const mat = ARMY.vmat[side], cap = PARK.length + SPOT.length;
    U.im = new THREE.InstancedMesh(jetGeo(mat), mat, cap); U.gm = new THREE.InstancedMesh(gearGeo(), SM, cap); U.hm = new THREE.InstancedMesh(heliGeo(mat), mat, HPAD.length);
    [U.im, U.gm, U.hm].forEach(m => { m.castShadow = !!G.std; m.frustumCulled = false; m.count = 0; g.add(m); });
  }
  g.userData = U; g.scale.setScalar(CS);
  return g;
};
const CV = K.cv = {};
/* a point on the flight deck (design x, z; h = height above the deck in world units) in the world */
function deck(c, x, z, h, out) { out = out || new THREE.Vector3(); out.set(x, DK, z); c.g.localToWorld(out); out.y += h || 0; return out; }

/* ================================================================== deck handling
   Each carrier keeps five ready jets: one on each catapult and three queued behind them. They are drawn as instances while they
   stand or taxi; a jet of battle.js's own pool (FX.air) takes over from the moment the catapult fires until it is back on a spot. */
function resetDeck(c) {
  c.rd = SPOT.map((p, i) => ({ x: p[0], z: p[1], yaw: 0, i, mv: null, jet: null })); c.sp = c.rd.slice();
  c.free = []; c.catT = [0, 0]; c.landT = 0; c.jb = [null, null]; c.ja = [-1, -1]; c.hs = [-1, -1]; c.dirty = true;
}
function writeDeck(c) {
  const U = c.g.userData; if (!U.im) return; let n = 0;
  const put = (x, z, yaw) => { _d.position.set(x, DK + JH / CS, z); _d.rotation.set(0, yaw, 0); _d.scale.setScalar(1 / CS); _d.updateMatrix(); U.im.setMatrixAt(n, _d.matrix); U.gm.setMatrixAt(n, _d.matrix); n++; };
  PARK.forEach(p => put(p[0], p[1], p[2])); c.rd.forEach(r => put(r.x, r.z, r.yaw));
  U.im.count = U.gm.count = n; U.im.instanceMatrix.needsUpdate = U.gm.instanceMatrix.needsUpdate = true;
}
function deckTick(c, t, dt) {
  const U = c.g.userData;
  for (let i = c.free.length - 1; i >= 0; i--) if (t >= c.free[i][1]) { if (c.sp[c.free[i][0]] === HOLD) c.sp[c.free[i][0]] = null; c.free.splice(i, 1); }
  for (const r of c.rd) {
    if (r.mv) { const f = cl((t - r.mv.t0) / r.mv.dur, 0, 1), e = f * f * (3 - 2 * f); r.x = mix(r.mv.x0, r.mv.x1, e); r.z = mix(r.mv.z0, r.mv.z1, e); c.dirty = true; if (f >= 1) r.mv = null; }
    else { const ah = AHEAD[r.i]; if (ah >= 0 && !c.sp[ah]) { c.sp[r.i] = null; r.i = ah; c.sp[ah] = r; r.mv = { x0: r.x, z0: r.z, x1: SPOT[ah][0], z1: SPOT[ah][1], t0: t + 120, dur: 1150 }; } }   // close up on the catapult
  }
  if (c.dirty) { c.dirty = false; writeDeck(c); }
  /* blast deflectors rise behind a jet on the catapult */
  for (let i = 0; i < 2; i++) {
    const want = c.jb[i] && t >= c.jb[i][0] && t < c.jb[i][1] ? 1 : 0, a = c.ja[i] < 0 ? want : c.ja[i] + (want - c.ja[i]) * Math.min(1, dt * 7);
    if (Math.abs(a - c.ja[i]) > 1e-3) { c.ja[i] = a; _d.position.set(CATS[i][0] - 3.7, DK + .07, CATS[i][1]); _d.rotation.set(0, 0, -a * .95); _d.scale.setScalar(1); _d.updateMatrix(); U.jbd.setMatrixAt(i, _d.matrix); U.jbd.instanceMatrix.needsUpdate = true; }
  }
  /* helicopters at rest stand on their spots; one that is flying is battle.js's own */
  if (U.hm && typeof FX !== 'undefined') {
    let ch = false; for (const a of FX.air) { if (a.k !== 'heli' || a.side !== c.side || a.hp == null) continue; const on = a.on ? 1 : 0; if (c.hs[a.hp] !== on) { c.hs[a.hp] = on; ch = true; } }
    if (ch) { HPAD.forEach((p, i) => { _d.position.set(p[0], DK + HH / CS, p[1]); _d.rotation.set(0, 0, 0); _d.scale.setScalar(c.hs[i] === 1 ? 1e-4 : 1 / CS); _d.updateMatrix(); U.hm.setMatrixAt(i, _d.matrix); }); U.hm.count = HPAD.length; U.hm.instanceMatrix.needsUpdate = true; }
  }
}
/* where a strike helicopter stands on its carrier: position and heading in the world */
K.heliPad = function (side, a) { const c = CV[side]; if (!c || !a || a.hp == null) return null; const p = deck(c, HPAD[a.hp][0], HPAD[a.hp][1], HH); return { x: p.x, y: p.y, z: p.z, yaw: c.g.rotation.y }; };
/* where a ship-borne interceptor leaves from: the frigate's forward cells */
K.shipSAM = function (side) { const E = K5.env, s = E && E.ships.find(x => x.side === side && x.kind === 'ff'); if (!s) return null; s.g.updateMatrixWorld(true); return s.g.localToWorld(s.g.userData.vls.clone()); };

/* ================================================================== sorties */
const SO = [];
function crPos(P, i, u, out) {                 // uniform Catmull-Rom on the span P[i] → P[i+1]
  const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)], u2 = u * u, u3 = u2 * u;
  const f = (pa, pb, pc, pd) => .5 * ((2 * pb) + (-pa + pc) * u + (2 * pa - 5 * pb + 4 * pc - pd) * u2 + (-pa + 3 * pb - 3 * pc + pd) * u3);
  return out.set(f(a.x, b.x, c.x, d.x), f(a.y, b.y, c.y, d.y), f(a.z, b.z, c.z, d.z));
}
/* the flight from the bow back to a wire. A strike crosses its target and comes home round the army's rear; a patrol breaks over
   the bay. hold = { n, r }: turns of the marshal circle to fly before the approach, when the strip is still in use. */
function plan(c, cat, tgt, patrol, hold) {
  const m = c.side === 'bull' ? -1 : 1, P = [], V = [];
  const p0 = deck(c, CATS[cat][0], CATS[cat][1], JH), p1 = deck(c, CATS[cat][2] + 3, CATS[cat][1], JH + .15), F = p1.clone().sub(p0).setY(0).normalize();
  const td = deck(c, mix(LAND.ax, LAND.bx, .2), mix(LAND.az, LAND.bz, .2), JH), fw = deck(c, LAND.bx, LAND.bz, JH).sub(td).setY(0).normalize();
  const nS = new THREE.Vector3(-fw.z, 0, fw.x); if (nS.z < 0) nS.negate();          // across the approach, towards the shore
  const add = (x, y, z, v) => { P.push(new THREE.Vector3(x, y, z)); V.push(v); };
  add(p0.x - F.x * 22, p0.y, p0.z - F.z * 22, 60); add(p1.x, p1.y, p1.z, 62);
  const bx = p1.x + F.x * 46, bz = p1.z + F.z * 46; add(bx, p1.y + 12, bz, 88);
  let iRun = -9;
  if (patrol) { add(bx + F.x * 62 + m * 22, 30, bz + F.z * 62, 112); add(m * 55, 34, -118, 116); add(m * 165, 36, -140, 118); add(m * 262, 35, -212, 116); }
  else {
    const dx = tgt.x - bx, dz = tgt.z - bz, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    add(mix(bx, tgt.x, .4) + m * 5, 30, mix(bz, tgt.z, .4), 122);
    iRun = P.length; add(tgt.x - ux * 62, 27, tgt.z - uz * 62, 150); add(tgt.x, 27, tgt.z, 158); add(tgt.x + ux * 58, 31, tgt.z + uz * 58, 150);
    add(m * 104, 37, 42, 136); add(m * 212, 36, -68, 132);
  }
  const ax = td.x - fw.x * 150, ay = td.y + 27, az = td.z - fw.z * 150;
  add(ax - fw.x * 55 + nS.x * 85, ay + 5, az - fw.z * 55 + nS.z * 85, 118); add(ax, ay, az, 108);
  if (hold) {
    const cx = ax - nS.x * hold.r, cz = az - nS.z * hold.r;
    for (let k = 1; k < hold.n * 8; k++) { const th = -TAU * hold.n + k * Math.PI / 4, co = Math.cos(th) * hold.r, si = Math.sin(th) * hold.r; add(cx + nS.x * co + fw.x * si, ay + 3, cz + nS.z * co + fw.z * si, 104); }
    add(ax, ay, az, 104);
  }
  add(td.x - fw.x * 92, td.y + 14.5, td.z - fw.z * 92, 92); add(td.x - fw.x * 34, td.y + 4.4, td.z - fw.z * 34, 74);
  add(td.x, td.y, td.z, 60); add(td.x + fw.x * 30, td.y, td.z + fw.z * 30, 60);
  const T = [0]; for (let i = 1; i < P.length; i++) T.push(T[i - 1] + P[i].distanceTo(P[i - 1]) / ((V[i] + V[i - 1]) / 2));
  return { P, T, iRun, last: P.length - 2 };   // iRun: the run-in point; last: touchdown
}
/* claim the ready jet nearest a catapult and an aircraft of the pool to fly as it */
function take(c, patrol, tgt, usd, delay) {
  const r = c.rd.filter(x => !x.jet).sort((p, q) => p.i - q.i)[0]; if (!r) return false;
  const a = FX.pick('jet', c.side); if (!a) return false;
  a.on = true; a.att = c.side; a.dir = c.side === 'bull' ? -1 : 1; a.dropped = !!patrol; a.usd = usd || 0; a.nuke = false; a.g.visible = false; a.g.rotation.order = 'YZX';
  const ud = a.g.userData; if (!ud.gear) { ud.gear = new THREE.Mesh(gearGeo(), K5.ship.shipMat()); a.g.add(ud.gear); }
  a.so = { cv: c, r, ph: -1, t0: vt() + (delay || 0), tgt, patrol: !!patrol, bank: 0, yaw: null }; r.jet = a; SO.push(a); return true;
}
/* n jets off the attacker's carrier for a strike on (tx, tz); returns how many were sent */
K.sortie = function (att, tx, tz, n, usd) {
  const c = CV[att]; if (!c || typeof FX === 'undefined' || !PREF.layers.fx) return 0; let k = 0;
  for (let i = 0; i < n; i++) { if (!take(c, false, new THREE.Vector3(cl(tx + rr(-5, 5), -72, 72), 0, cl(tz + rr(-9, 9), -36, 36)), usd, 200 + k * 450)) break; k++; }
  if (k) c.busy = vt() + 32000;
  return k;
};
K.patrol = function (side) { const c = CV[side]; return !!c && typeof FX !== 'undefined' && take(c, true, null, 0, 300); };
function release(a) { a.on = false; a.g.visible = false; a.so = null; a.g.rotation.order = 'XYZ'; a.g.rotation.set(0, 0, 0); }
function freeSpot(c) {                         // the free spot nearest the catapults with nothing standing or arriving behind it
  for (let j = 0; j < SPOT.length; j++) { if (c.sp[j]) continue; let ok = true; for (let b = j, n; ok && (n = AHEAD.indexOf(b)) >= 0; b = n) if (c.sp[n]) ok = false; if (ok) return j; }
  return -1;
}
function sortieTick(dt, t) {
  for (let i = SO.length - 1; i >= 0; i--) {
    const a = SO[i], s = a.so; if (!s || !a.on) { SO.splice(i, 1); continue; }
    const c = s.cv, ud = a.g.userData, yw0 = c.g.rotation.y; let glow = 0, gear = true;
    if (s.ph === -1) {                          // still an airframe on deck: wait for its turn on a catapult
      const r = s.r; if (!(r.i <= 1 && !r.mv && t >= c.catT[r.i] && t >= s.t0)) continue;
      s.ph = 0; s.cat = r.i; s.tS = t + 650; c.catT[r.i] = s.tS + 2500; c.jb[r.i] = [t, s.tS + 1250];
      c.rd.splice(c.rd.indexOf(r), 1); c.sp[r.i] = HOLD; c.free.push([r.i, s.tS + 1250]); c.dirty = true; r.jet = null; s.r = null;
    }
    a.g.visible = true;
    if (s.ph === 0) {                           // engines up behind the raised deflector, then the shot
      const cc = CATS[s.cat], el = (t - s.tS) / 1000, f = cl(el / 1.5, 0, 1), x = cc[0] + (cc[2] + 3 - cc[0]) * f * f;
      deck(c, x, cc[1], JH + .15 * f, a.g.position); a.g.rotation.set(0, yw0, 0); glow = el < 0 ? .2 + .8 * sm(-.65, 0, el) : 1;
      if (el >= 0 && !s.snd) { s.snd = true; AUDIO.play('catapult', { x: a.g.position.x, z: a.g.position.z, vol: .8 }); AUDIO.play('jetcat', { x: a.g.position.x, z: a.g.position.z, vol: .9, follow: a }); }
      if (el >= 0 && f < 1 && PREF.layers.fx && Math.random() < .85) { deck(c, x - 3 - Math.random() * 7, cc[1] + rr(-.3, .3), .2, _w); FX.spawn(4, _w.x, _w.y, _w.z, rr(-.7, .7), rr(.5, 1.7), rr(-.7, .7), 1 + Math.random(), 2.5); }
      if (f >= 1) {
        let pl = plan(c, s.cat, s.tgt, s.patrol, null); const tf = t - pl.T[1] * 1000, tl = tf + pl.T[pl.last] * 1000;
        if (tl < c.landT + 4500) { const D = Math.max(3.6, (c.landT + 4500 - tl) / 1000), n = Math.ceil(D / 7); pl = plan(c, s.cat, s.tgt, s.patrol, { n, r: 104 * (D / n) / TAU }); }
        s.pl = pl; s.tf = tf; s.k = 1; s.ph = 1; c.landT = tf + pl.T[pl.last] * 1000;
      }
    } else if (s.ph === 1) {                    // flying the plan
      const pl = s.pl, tt = (t - s.tf) / 1000; let k = s.k; while (k < pl.last && tt > pl.T[k + 1]) k++; s.k = k;
      if (tt >= pl.T[pl.last]) { s.ph = 2; s.t2 = t; AUDIO.play('trap', { x: a.g.position.x, z: a.g.position.z, vol: .7 }); continue; }
      const u = cl((tt - pl.T[k]) / (pl.T[k + 1] - pl.T[k]), 0, 1); crPos(pl.P, k, u, a.g.position); crPos(pl.P, k, Math.min(1, u + .04), _w); _w.sub(a.g.position);
      if (k >= pl.last - 1) { const w = sm(.35, 1, u); a.g.position.lerp(deck(c, mix(LAND.ax, LAND.bx, .2), mix(LAND.az, LAND.bz, .2), JH, _v), w * w); }   // the deck has moved a little since the plan was made
      const hl = Math.hypot(_w.x, _w.z) || 1e-6, yaw = Math.atan2(-_w.z, _w.x), dy = wrap(yaw - (s.yaw == null ? yaw : s.yaw)); s.yaw = yaw;
      s.bank += (cl(-dy / Math.max(dt, .001) * 1.15, -1.25, 1.25) - s.bank) * Math.min(1, dt * 3.2);
      a.g.rotation.set(s.bank, yaw, Math.atan2(_w.y, hl));
      gear = (k === 1 && u < .5) || k >= pl.last - 2;
      glow = k <= 2 || (k >= pl.iRun - 1 && k <= pl.iRun + 1) ? 1 : k >= pl.last - 2 ? .3 : .6;
      if (!a.dropped && k >= pl.iRun - 1) { const dx = s.tgt.x - a.g.position.x, dz = s.tgt.z - a.g.position.z; if (Math.hypot(dx, dz) < a.g.position.y * .95) { a.dropped = true; FX.bomb(a.g.position.x, a.g.position.y - 1, a.g.position.z, s.tgt.x + rr(-3, 3), s.tgt.z + rr(-3, 3), 'bomb', a.usd, a.att); AUDIO.play('whistle', { x: s.tgt.x, z: s.tgt.z, vol: .6 }); } }
      if (!s.s1 && !s.patrol && k >= pl.iRun - 1) { s.s1 = true; AUDIO.play('jet', { x: a.g.position.x, z: a.g.position.z, vol: 1, dur: 3.4, follow: a }); }
      if (!s.s2 && k >= pl.last - 3) { s.s2 = true; AUDIO.play('jetland', { x: a.g.position.x, z: a.g.position.z, vol: .7, follow: a }); }
      if (PREF.layers.fx && k > 1 && k < pl.last - 1 && Math.random() < .6) FX.spawn(4, a.g.position.x - _w.x / hl * 3.6, a.g.position.y, a.g.position.z - _w.z / hl * 3.6, 0, 0, 0, 1.2, 1.4);
    } else if (s.ph === 2) {                    // caught a wire: run out, then wait for a clear way to a spot
      const e2 = (t - s.t2) / 1000, f = cl(e2 / 1.15, 0, 1), e = 1 - (1 - f) * (1 - f), fr = .2 + .36 * e, lx = mix(LAND.ax, LAND.bx, fr), lz = mix(LAND.az, LAND.bz, fr);
      deck(c, lx, lz, JH, a.g.position); a.g.rotation.set(0, yw0 + LYAW, -.045 * (1 - f)); glow = .1;
      if (e2 > 1.8) {
        const j = freeSpot(c);
        if (j >= 0) { c.sp[j] = a; s.ph = 3; s.t3 = t; s.j = j; s.x0 = lx; s.z0 = lz; s.qx = Math.max(lx + 2, SPOT[j][0] - 8); s.qz = SPOT[j][1]; s.yw = LYAW; s.dur = Math.max(1.4, (Math.hypot(s.qx - lx, s.qz - lz) + Math.hypot(SPOT[j][0] - s.qx, SPOT[j][1] - s.qz)) / 7.5); }
        else if (e2 > 14) { release(a); SO.splice(i, 1); continue; }
      }
    } else {                                    // taxi clear of the strip and up to the spot
      const f = cl((t - s.t3) / 1000 / s.dur, 0, 1), e = f * f * (3 - 2 * f), q = 1 - e, sp = SPOT[s.j];
      const x = q * q * s.x0 + 2 * q * e * s.qx + e * e * sp[0], z = q * q * s.z0 + 2 * q * e * s.qz + e * e * sp[1];
      const dx = 2 * q * (s.qx - s.x0) + 2 * e * (sp[0] - s.qx), dz = 2 * q * (s.qz - s.z0) + 2 * e * (sp[1] - s.qz);
      s.yw += wrap((f > .9 ? 0 : Math.atan2(-dz, dx)) - s.yw) * Math.min(1, dt * 5);
      deck(c, x, z, JH, a.g.position); a.g.rotation.set(0, yw0 + s.yw, 0); glow = .05;
      if (f >= 1) { const r = { x: sp[0], z: sp[1], yaw: 0, i: s.j, mv: null, jet: null }; c.rd.push(r); c.sp[s.j] = r; c.dirty = true; release(a); SO.splice(i, 1); continue; }
    }
    a.wx = a.g.position.x; a.wz = a.g.position.z;
    if (ud.gear) ud.gear.visible = gear;
    if (ud.ab) ud.ab.material.opacity = glow * (.75 + Math.random() * .25);
    if (ud.nav) { const blink = Math.sin(t * .009) > .55; ud.nav.forEach((sp, j) => { sp.material.opacity = j === 2 ? (blink ? 1 : .1) : .85; }); }
  }
}

/* ================================================================== build and run */
K.boot = function () {
  const E = K5.env; if (!E || typeof ARMY === 'undefined') return;
  try {
    for (const side of ['bull', 'bear']) {
      const m = side === 'bull' ? -1 : 1, g = K.carrier(side); g.position.set(m * 105, K5.SEA, -268); g.rotation.y = side === 'bull' ? -.55 : Math.PI + .55; scene.add(g);
      const c = CV[side] = { g, side, bob: m * 2.3, next: 30 + Math.random() * 40 + (m > 0 ? 35 : 0), busy: 0 }; resetDeck(c);
      let hp = 0; if (typeof FX !== 'undefined') for (const a of FX.air) if (a.k === 'heli' && a.side === side) a.hp = hp++ % HPAD.length;
    }
  } catch (e) { console.error(e); }
  try { RB.init(); } catch (e) { console.error(e); }
};
K.tick = function (dt, t) {
  const now = typeof vt === 'function' ? vt() : 0;
  for (const k in CV) {
    const c = CV[k]; c.g.position.y = K5.SEA + Math.sin(t * .6 + c.bob) * .07; c.g.rotation.x = Math.sin(t * .42 + c.bob) * .005; c.g.rotation.z = Math.sin(t * .5 + c.bob * 2) * .0035;
    c.g.userData.rad.rotation.y += dt * 1.3; c.g.updateMatrixWorld(true);
    deckTick(c, now, dt);
    /* now and then one jet goes round the bay and lands again: deck life, never a strike */
    c.next -= dt;
    if (c.next <= 0) { c.next = 60 + Math.random() * 70; if (now > c.busy && !document.hidden && PREF.layers.fx && !SO.some(a => a.so && a.so.cv === c)) K.patrol(k); }
  }
  sortieTick(dt, now);
  RB.tick(dt);
};
K.clear = function () { for (let i = SO.length - 1; i >= 0; i--) { if (SO[i].so) release(SO[i]); } SO.length = 0; for (const k in CV) resetDeck(CV[k]); RB.clear(); };
})();
