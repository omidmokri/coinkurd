/* entekhab.net — «نبرد من» sound design (Web Audio, synthesised in the browser: no sound files are downloaded)
   Loaded after gfx4.js and before battle.js. Each design registers in GFX4.SFX, which AUDIO.play consults before its own.
   Every sound is built in layers the way a film mix is: a transient that says what it is, a body that says how big it is,
   a low end you feel rather than hear, and a tail that says where it is. Distance darkens a sound (air absorption), sends more of
   it into the room and, for the big booms, holds it back a moment (sound is slower than light). Engines that move (jets,
   helicopters, the bomber) are followed every frame: their pitch bends as they come and go (Doppler) and their highs fade with range.
   The same functions render offline (an OfflineAudioContext stand-in for AUDIO), which is how the promotional video gets its sound. */
(function () {
'use strict';
const K4 = window.GFX4; if (!K4) return;
const SFX = K4.SFX || (K4.SFX = {});
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const rr = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ building blocks */
const airHz = K4.airHz = d => cl(20000 * Math.pow(.5, d / 95), 650, 20000);        // how much of the top end survives the distance
const boomLag = d => Math.min(.32, d / 950);                                        // the flash first, the boom a beat later
function pinkBuf(A) {                                  // pink noise (Kellet's filter), cached with the engine's other noise
  const nz = A.nz || (A.nz = {}); if (nz.pink) return nz.pink;
  const C = A.ctx, n = Math.floor(C.sampleRate * 3), b = C.createBuffer(1, n, C.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856;
    b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
  }
  return (nz.pink = b);
}
function nsrc(A, kind, rate) { const s = A.ctx.createBufferSource(); s.buffer = kind === 'pink' ? pinkBuf(A) : A.noise(kind || 'white'); s.loop = true; if (rate) s.playbackRate.value = rate; return s; }
const run = (s, t0, t1) => { s.start(t0, Math.random() * 1.7); s.stop(t1); };        // a fresh stretch of noise every time: no two shots alike
const flt = (C, type, f, q) => { const b = C.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };
const amp = (C, v) => { const g = C.createGain(); g.gain.value = v == null ? 1 : v; return g; };
const osc = (C, type, f) => { const o = C.createOscillator(); o.type = type; o.frequency.value = f; return o; };
function hit(p, t, a, peak, dec) { p.setValueAtTime(.0001, t); p.linearRampToValueAtTime(Math.max(.0002, peak), t + a); p.exponentialRampToValueAtTime(.0001, t + a + dec); }
function swell(p, t, a, peak, hold, rel) { p.setValueAtTime(.0001, t); p.linearRampToValueAtTime(Math.max(.0002, peak), t + a); p.setValueAtTime(Math.max(.0002, peak), t + a + hold); p.exponentialRampToValueAtTime(.0001, t + a + hold + rel); }
function sweep(p, t, f0, f1, d) { p.setValueAtTime(f0, t); p.exponentialRampToValueAtTime(f1, t + d); }
function echo(C, from, to, dt, f, g) { const d = C.createDelay(2); d.delayTime.value = dt; const l = flt(C, 'lowpass', f, .5), k = amp(C, g); from.connect(d).connect(l).connect(k).connect(to); }
const done = (A, end) => { if (A.offline) return; setTimeout(() => { A.voices = Math.max(0, A.voices - 1); }, Math.max(0, (end - A.ctx.currentTime) * 1000) + 60); };
const duck = (A, a, dur) => { if (A.duck) A.duck(a, dur); };
function dist(A, o) { if (o.x === undefined) return 0; const p = A.lpos; if (!p) return 60; const dx = o.x - p.x, dy = (o.y || 2) - p.y, dz = (o.z || 0) - p.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
/* where a sound comes out: g (its input) → air absorption → a 3-D panner → the bus, with a distance-dependent send into the room.
   A moving source (o.follow) is registered with the engine, which then moves the panner, the filter and the Doppler shift each frame. */
function spot(A, o, bus) {
  const C = A.ctx, g = amp(C, 1), lp = flt(C, 'lowpass', 20000, .5), d = dist(A, o); lp.frequency.value = airHz(d); g.connect(lp);
  let rec = null; const B = A.bus[bus || 'sfx'];
  if (o.x !== undefined) {
    const p = C.createPanner(); p.panningModel = A.hrtf === false ? 'equalpower' : 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 22; p.maxDistance = 600; p.rolloffFactor = 1.1;
    if (p.positionX) { p.positionX.value = o.x; p.positionY.value = o.y || 2; p.positionZ.value = o.z || 0; } else p.setPosition(o.x, o.y || 2, o.z || 0);
    lp.connect(p).connect(B);
    if (A.rev && d > 45) { const w = amp(C, Math.min(.5, (d - 45) / 420)); lp.connect(w).connect(A.rev); }
    if (o.follow && A.follow) { rec = { p, o: o.follow, until: C.currentTime + (o.delay || 0) + (o.dur || 5) + .5, lp, dp: [], d0: d, t: C.currentTime }; A.follow.push(rec); }
  } else lp.connect(B);
  return { g, lp, rec, d };
}
const t0of = (A, o) => A.ctx.currentTime + (o.delay || 0);
K4.spot = spot;                                          // for an offline stand-in of AUDIO (the video's soundtrack)
let _pulse = null;                                       // a soft pulse train (rotor blades, propellers): a few cosine partials in phase
function pulseWave(C) { if (_pulse && _pulse.c === C) return _pulse.w; const n = 7, re = new Float32Array(n + 1), im = new Float32Array(n + 1); for (let k = 1; k <= n; k++) re[k] = 1 - (k - 1) / (n + 1); const w = C.createPeriodicWave(re, im); _pulse = { c: C, w }; return w; }

/* ------------------------------------------------------------------ small arms: rifle, machine gun, the robots' rifles, the dogs' guns */
function gunCore(A, o, P) {
  const C = A.ctx, v = o.vol == null ? .45 : o.vol, n = Math.max(1, o.burst | 0), rate = o.rate || 11, t0 = t0of(A, o) + Math.random() * .008;
  const O = spot(A, o, 'sfx'), out = O.g, span = (n - 1) / rate, end = t0 + span + .45;
  const s = nsrc(A, 'white'), hp = flt(C, 'highpass', P.crack || 2600, .7), bp = flt(C, 'bandpass', (P.bp || 950) * rr(.88, 1.15), .9), gc = amp(C, 0), gb = amp(C, 0);
  s.connect(hp).connect(gc).connect(out); s.connect(bp).connect(gb).connect(out);
  const th = osc(C, 'sine', 140), gt = amp(C, 0); th.connect(gt).connect(out);
  let tg = null, tgo = null; if (P.ting) { tg = amp(C, 0); tg.connect(out); tgo = [osc(C, 'sine', 2930 * rr(.98, 1.02)), osc(C, 'sine', 4710 * rr(.98, 1.02))]; tgo.forEach(x => x.connect(tg)); }
  for (let i = 0; i < n; i++) {
    const t = t0 + i / rate + (i ? rr(-.005, .005) : 0), k = i ? rr(.8, 1) : 1;
    hit(gc.gain, t, .0006, v * .95 * k, .022); hit(gb.gain, t, .001, v * .78 * k, .066);
    th.frequency.setValueAtTime(150, t); th.frequency.exponentialRampToValueAtTime(52, t + .06); hit(gt.gain, t, .001, v * (P.thump || .55) * k, .06);
    if (tg) hit(tg.gain, t + .004, .001, v * .07 * k, .045);
  }
  echo(C, out, O.lp, rr(.08, .17), 1300, .26);                                     // the shot comes back off the hills
  run(s, t0, end); th.start(t0); th.stop(end); if (tgo) tgo.forEach(x => { x.start(t0); x.stop(end); });
  if (P.whir) {                                                                     // the machine settles its weapon
    const w = osc(C, 'sine', 1300), gw = amp(C, 0), tw = t0 + span + .08; w.connect(gw).connect(out); sweep(w.frequency, tw, 1300, 2300, .22); hit(gw.gain, tw, .03, v * .05, .2); w.start(tw); w.stop(tw + .3);
  }
  done(A, end + .2);
}
SFX.gun = (A, o) => gunCore(A, o, {});
SFX.rgun = (A, o) => gunCore(A, Object.assign({}, o, { burst: o.burst || 3, rate: 12.5 }), { bp: 720, crack: 2200, thump: .75, ting: true, whir: true });
SFX.dogfire = (A, o) => gunCore(A, Object.assign({}, o, { burst: o.burst || 4, rate: 16 }), { bp: 1500, crack: 3000, thump: .35, whir: true });

/* ------------------------------------------------------------------ servos: a robot or a dog on the move */
SFX.servo = function (A, o) {
  const C = A.ctx, v = o.vol == null ? .2 : o.vol, t0 = t0of(A, o) + Math.random() * .04, d = rr(.3, .55), O = spot(A, o, 'sfx'), out = O.g;
  const m = osc(C, 'sawtooth', rr(280, 360)), bp = flt(C, 'bandpass', 800, 5), g = amp(C, 0), f0 = m.frequency.value; m.connect(bp).connect(g).connect(out);
  m.frequency.setValueAtTime(f0, t0); m.frequency.linearRampToValueAtTime(f0 * 2.4, t0 + d * .45); m.frequency.linearRampToValueAtTime(f0 * 1.7, t0 + d);
  bp.frequency.setValueAtTime(700, t0); bp.frequency.linearRampToValueAtTime(1900, t0 + d * .5); bp.frequency.linearRampToValueAtTime(1300, t0 + d);
  swell(g.gain, t0, .04, v * 1.3, Math.max(.01, d - .1), .06);
  const ch = osc(C, 'square', rr(58, 90)), cd = amp(C, v * .75); ch.connect(cd).connect(g.gain);            // gear chatter
  const s = nsrc(A, 'white'), hp = flt(C, 'highpass', 4200, .6), gh = amp(C, 0); s.connect(hp).connect(gh).connect(out); hit(gh.gain, t0 + d - .02, .01, v * .4, .16);   // a breath of air from the actuator
  m.start(t0); m.stop(t0 + d + .02); ch.start(t0); ch.stop(t0 + d); run(s, t0 + d - .03, t0 + d + .25); done(A, t0 + d + .3);
};

/* ------------------------------------------------------------------ guns: tank, artillery, deck guns */
SFX.tank = function (A, o) {
  const C = A.ctx, v = o.vol == null ? .6 : o.vol, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o) + boomLag(O.d) * .5;
  const s = nsrc(A, 'white'), hp = flt(C, 'highpass', 1800, .7), g1 = amp(C, 0); s.connect(hp).connect(g1).connect(out); hit(g1.gain, t0, .0008, v * .9, .045);
  const lp = flt(C, 'lowpass', 1400, .9), g2 = amp(C, 0); s.connect(lp).connect(g2).connect(out); sweep(lp.frequency, t0, 1400, 110, .5); hit(g2.gain, t0, .003, v, .55);
  const b = osc(C, 'sine', 62), g3 = amp(C, 0); b.connect(g3).connect(out); sweep(b.frequency, t0, 62, 27, .5); hit(g3.gain, t0, .004, v * 1.1, .55);
  const t2 = t0 + rr(.3, .4), gm = amp(C, 0), ms = [433, 1187, 2641].map(f => { const m = osc(C, 'sine', f * rr(.99, 1.01)); m.connect(gm); return m; }); gm.connect(out); hit(gm.gain, t2, .001, v * .09, .16);   // the breech: case out, round in
  echo(C, out, O.lp, .22, 750, .3);
  run(s, t0, t0 + .9); b.start(t0); b.stop(t0 + .7); ms.forEach(m => { m.start(t2); m.stop(t2 + .25); }); done(A, t0 + 1);
};
function cannonCore(A, o, P) {
  const C = A.ctx, v = o.vol == null ? .8 : o.vol, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o) + boomLag(O.d), roll = P.roll || 2.6;
  const s = nsrc(A, 'white'), hp = flt(C, 'highpass', 1300, .7), g1 = amp(C, 0); s.connect(hp).connect(g1).connect(out); hit(g1.gain, t0, .0008, v * (P.crack || .8), .06);
  const lp = flt(C, 'lowpass', 900, .8), g2 = amp(C, 0); s.connect(lp).connect(g2).connect(out); sweep(lp.frequency, t0, 900, 70, .9); hit(g2.gain, t0, .004, v * 1.05, .95);
  const b = osc(C, 'sine', P.sub || 50), g3 = amp(C, 0); b.connect(g3).connect(out); sweep(b.frequency, t0, P.sub || 50, 23, .9); hit(g3.gain, t0, .005, v * 1.25, .95);
  const r = nsrc(A, 'brown'), rl = flt(C, 'lowpass', 240, .6), g4 = amp(C, 0); r.connect(rl).connect(g4).connect(out);   // the roll of it round the valley
  g4.gain.setValueAtTime(.0001, t0); g4.gain.linearRampToValueAtTime(v * .42, t0 + .18); g4.gain.exponentialRampToValueAtTime(.0001, t0 + roll);
  echo(C, out, O.lp, .37, 520, .3); echo(C, out, O.lp, .86, 380, .18);
  if (P.whoosh) {                                                                    // the shell leaving the muzzle, out over the water
    const w = nsrc(A, 'white'), wb = flt(C, 'bandpass', 3000, 2), gw = amp(C, 0); w.connect(wb).connect(gw).connect(out); sweep(wb.frequency, t0 + .05, 3000, 700, .6); hit(gw.gain, t0 + .05, .02, v * .16, .6); run(w, t0 + .05, t0 + .75);
  }
  run(s, t0, t0 + 1.2); run(r, t0, t0 + roll + .1); b.start(t0); b.stop(t0 + 1);
  if (v > .7) duck(A, .16, .35);
  done(A, t0 + roll + .2);
}
SFX.cannon = (A, o) => cannonCore(A, o, { sub: 50, roll: 2.6, crack: .8 });
SFX.navgun = (A, o) => { const big = o.big !== false; cannonCore(A, o, { sub: big ? 44 : 53, roll: big ? 3.2 : 2.3, crack: big ? 1 : .85, whoosh: true }); };

/* ------------------------------------------------------------------ explosions */
function blast(A, o, sz, nuke) {
  const C = A.ctx, v = Math.min(1.4, (o.vol == null ? .8 : o.vol) * (nuke ? 1.4 : .75 + sz * .18)), O = spot(A, o, 'sfx'), out = O.g;
  const t0 = t0of(A, o) + (nuke ? .3 : boomLag(O.d)), d = nuke ? 4.2 : .9 + sz * .38, tail = nuke ? 4.2 : 1.6 + sz * .4;
  const s = nsrc(A, 'white');
  const hp = flt(C, 'highpass', 900, .7), g1 = amp(C, 0); s.connect(hp).connect(g1).connect(out); hit(g1.gain, t0, .0008, v * .9, .03 + sz * .012);          // the pressure front
  const lp = flt(C, 'lowpass', 2600, .7), g2 = amp(C, 0); s.connect(lp).connect(g2).connect(out); sweep(lp.frequency, t0, 2600, nuke ? 30 : 65, d); hit(g2.gain, t0, .004, v, d);   // fire and gas, bright to dark
  const f0 = nuke ? 34 : 56, b = osc(C, 'sine', f0), g3 = amp(C, 0); b.connect(g3).connect(out); sweep(b.frequency, t0, f0, nuke ? 16 : 21, d * .8); hit(g3.gain, t0, .006, v * (nuke ? 1.3 : .95), d * .75);   // what you feel
  if (sz >= 1) {                                                                     // debris and crackle, thinning out
    const cs = nsrc(A, 'white'), cb = flt(C, 'bandpass', rr(3000, 4500), 1.4), gc = amp(C, 0); cs.connect(cb).connect(gc).connect(out); gc.gain.setValueAtTime(0, t0);
    const N = Math.round(10 + sz * 9), T = [];
    for (let i = 0; i < N; i++) T.push(t0 + .06 + Math.pow(Math.random(), 1.6) * d * .9);
    T.sort((a, c) => a - c).forEach((tt, i) => { if (i && tt - T[i - 1] < .016) return; gc.gain.setValueAtTime(Math.max(0, v * rr(.12, .34) * (1 - (tt - t0) / (d * 1.1))), tt); gc.gain.setValueAtTime(0, tt + rr(.004, .013)); });
    run(cs, t0, t0 + d);
  }
  const r = nsrc(A, 'brown'), rl = flt(C, 'lowpass', nuke ? 140 : 200, .6), g4 = amp(C, 0); r.connect(rl).connect(g4).connect(out);   // the long rumble
  g4.gain.setValueAtTime(.0001, t0); g4.gain.linearRampToValueAtTime(v * (nuke ? .9 : .38), t0 + (nuke ? .5 : .12)); g4.gain.exponentialRampToValueAtTime(.0001, t0 + tail);
  if (sz >= 1.6 || nuke) echo(C, out, O.lp, .42, 450, .25);
  run(s, t0, t0 + d + .1); run(r, t0, t0 + tail + .1); b.start(t0); b.stop(t0 + d);
  duck(A, nuke ? .72 : Math.min(.45, .12 * sz), nuke ? 2.2 : .45);
  if (nuke && !A.offline) {                                                          // the ears ring and the world goes dull for a moment
    if (A.mf) { const f = A.mf.frequency; f.cancelScheduledValues(t0 - .3); f.setValueAtTime(20000, t0 - .3); f.setValueAtTime(380, t0); f.exponentialRampToValueAtTime(20000, t0 + 2.6); }
    const rg = amp(C, 0), ro = osc(C, 'sine', 3200); ro.connect(rg).connect(A.bus.sfx); hit(rg.gain, t0, .02, v * .09, 2.5); ro.start(t0); ro.stop(t0 + 2.6);
  }
  done(A, t0 + tail + .2);
}
SFX.explosion = (A, o) => blast(A, o, o.size || 1, false);
SFX.nuke = (A, o) => blast(A, o, 7, true);

/* ------------------------------------------------------------------ rockets, bombs, the sonic boom */
SFX.rocket = function (A, o) {
  const C = A.ctx, v = o.vol == null ? .55 : o.vol, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o);
  const p = osc(C, 'sine', 260), gp = amp(C, 0); p.connect(gp).connect(out); sweep(p.frequency, t0, 260, 70, .08); hit(gp.gain, t0, .001, v * .6, .09);          // ignition
  const s = nsrc(A, 'white', 1.2), bp = flt(C, 'bandpass', 2200, 1.1), g = amp(C, 0); s.connect(bp).connect(g).connect(out); sweep(bp.frequency, t0, 2200, 420, 1.15);   // the motor, going away
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(v * .7, t0 + .03); g.gain.exponentialRampToValueAtTime(v * .25, t0 + .5); g.gain.exponentialRampToValueAtTime(.0001, t0 + 1.2);
  const cs = nsrc(A, 'white'), cb = flt(C, 'highpass', 3500, .7), gc = amp(C, 0); cs.connect(cb).connect(gc).connect(out); gc.gain.setValueAtTime(0, t0);
  for (let tt = t0 + .02; tt < t0 + .9; tt += rr(.012, .04)) { gc.gain.setValueAtTime(v * .25 * Math.random() * (1 - (tt - t0) / .95), tt); gc.gain.setValueAtTime(0, tt + .004); }
  run(s, t0, t0 + 1.25); run(cs, t0, t0 + .95); p.start(t0); p.stop(t0 + .12); done(A, t0 + 1.3);
};
SFX.whistle = function (A, o) {
  const C = A.ctx, v = o.vol == null ? .45 : o.vol, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o), d = 1.05;
  const s = osc(C, 'sine', 2500), g = amp(C, 0); s.connect(g).connect(out); sweep(s.frequency, t0, 2500, 430, d); swell(g.gain, t0, .08, v * .3, d - .25, .17);
  const vb = osc(C, 'sine', 7), vd = amp(C, 22); vb.connect(vd).connect(s.frequency);
  const n = nsrc(A, 'white'), bp = flt(C, 'bandpass', 2500, 4), gn = amp(C, 0); n.connect(bp).connect(gn).connect(out); sweep(bp.frequency, t0, 2500, 430, d); swell(gn.gain, t0, .1, v * .22, d - .25, .15);
  s.start(t0); s.stop(t0 + d + .02); vb.start(t0); vb.stop(t0 + d); run(n, t0, t0 + d + .02); done(A, t0 + d + .05);
};
SFX.boom = function (A, o) {
  const C = A.ctx, v = o.vol == null ? .9 : o.vol, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o);
  for (const d of [0, .11]) { const s = nsrc(A, 'white'), lp = flt(C, 'lowpass', 2200, .6), g = amp(C, 0); s.connect(lp).connect(g).connect(out); hit(g.gain, t0 + d, .0008, v * (d ? .8 : 1), .16); sweep(lp.frequency, t0 + d, 2200, 300, .18); run(s, t0 + d, t0 + d + .2); }
  const b = osc(C, 'sine', 64), gb = amp(C, 0); b.connect(gb).connect(out); sweep(b.frequency, t0, 64, 28, .6); hit(gb.gain, t0, .004, v * .9, .6); b.start(t0); b.stop(t0 + .65);
  const r = nsrc(A, 'brown'), rl = flt(C, 'lowpass', 180, .6), gr = amp(C, 0); r.connect(rl).connect(gr).connect(out); gr.gain.setValueAtTime(.0001, t0); gr.gain.linearRampToValueAtTime(v * .3, t0 + .15); gr.gain.exponentialRampToValueAtTime(.0001, t0 + 1.8); run(r, t0, t0 + 1.9);
  duck(A, .25, .4); done(A, t0 + 1.9);
};

/* ------------------------------------------------------------------ engines that fly */
function jetCore(A, o, P) {
  const C = A.ctx, v = o.vol == null ? .9 : o.vol, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o), D = P.dur, t1 = t0 + D, rec = O.rec;
  const env = amp(C, 0); env.connect(out); const e = env.gain;
  if (P.shape === 'launch') { e.setValueAtTime(.0001, t0); e.linearRampToValueAtTime(v, t0 + .12); e.exponentialRampToValueAtTime(v * .3, t1 - .5); e.exponentialRampToValueAtTime(.0001, t1); }
  else if (P.shape === 'land') { e.setValueAtTime(.0001, t0); e.linearRampToValueAtTime(v * .55, t0 + 1); e.setValueAtTime(v * .55, t1 - 1.6); e.linearRampToValueAtTime(v * .9, t1 - .9); e.exponentialRampToValueAtTime(.0001, t1); }
  else { e.setValueAtTime(.0001, t0); e.linearRampToValueAtTime(v, t0 + D * .42); e.exponentialRampToValueAtTime(v * .35, t0 + D * .8); e.exponentialRampToValueAtTime(.0001, t1); }
  const s = nsrc(A, 'white'), lp = flt(C, 'lowpass', P.roarHz || 3800, .6), gr = amp(C, .5 * P.roar); s.connect(lp).connect(gr).connect(env);   // roar
  const pk = nsrc(A, 'pink'), lp2 = flt(C, 'lowpass', 520, .7), gk = amp(C, 1.1 * P.roar); pk.connect(lp2).connect(gk).connect(env);          // rumble
  const w = osc(C, 'sine', (P.whineHz || 2350) * rr(.96, 1.05)), gw = amp(C, .045 * P.whine); w.connect(gw).connect(env);                     // turbine whine
  const w2 = osc(C, 'triangle', w.frequency.value * 1.34), gw2 = amp(C, .016 * P.whine); w2.connect(gw2).connect(env);
  const vb = osc(C, 'sine', 4.6), vd = amp(C, 9); vb.connect(vd); vd.connect(w.detune); vd.connect(w2.detune);
  if (P.spool) { sweep(w.frequency, t0, w.frequency.value * .7, w.frequency.value * 1.1, D * .5); }
  const nodes = [s, pk, w, w2, vb];
  if (P.burner) {                                                                    // afterburner crackle
    const cs = nsrc(A, 'white'), cb = flt(C, 'bandpass', 1700, .9), gc = amp(C, 0); cs.connect(cb).connect(gc).connect(env); gc.gain.setValueAtTime(0, t0);
    for (let tt = t0 + .01; tt < t1 - .2; tt += rr(.012, .05) / P.burner) { gc.gain.setValueAtTime(rr(.15, .5) * P.burner, tt); gc.gain.setValueAtTime(0, tt + rr(.004, .01)); }
    nodes.push(cs); if (rec) rec.dp.push(cb.detune);
  }
  if (rec) rec.dp.push(s.detune, pk.detune, lp.detune, lp2.detune, w.detune, w2.detune);
  nodes.forEach(n => { if (n.buffer) run(n, t0, t1); else { n.start(t0); n.stop(t1); } });
  done(A, t1 + .05);
}
SFX.jet = (A, o) => jetCore(A, o, { dur: o.dur || 3.4, roar: 1, whine: .8, burner: .5, shape: 'flyby' });
SFX.jetcat = (A, o) => jetCore(A, Object.assign({ dur: 6.5 }, o), { dur: o.dur || 6.5, roar: 1.25, whine: 1, burner: 1, shape: 'launch', roarHz: 4600 });
SFX.jetland = (A, o) => jetCore(A, Object.assign({ dur: 5.5 }, o), { dur: o.dur || 5.5, roar: .65, whine: 1.15, burner: 0, shape: 'land', roarHz: 2400, whineHz: 1900, spool: true });
SFX.bomber = function (A, o) {
  const C = A.ctx, v = o.vol == null ? .9 : o.vol, D = o.dur || 6, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o), t1 = t0 + D, rec = O.rec;
  const env = amp(C, 0); env.connect(out); swell(env.gain, t0, D * .35, v, D * .3, D * .35 - .05);
  const lp = flt(C, 'lowpass', 380, .8); lp.connect(env); const os = [52, 53.1, 55.4, 56.2].map(f => { const x = osc(C, 'sawtooth', f), g = amp(C, .18); x.connect(g).connect(lp); return x; });
  const r = nsrc(A, 'brown'), rl = flt(C, 'lowpass', 220, .6), gr = amp(C, .9); r.connect(rl).connect(gr).connect(env);
  const s = nsrc(A, 'white'), sl = flt(C, 'lowpass', 1600, .5), gs = amp(C, .12); s.connect(sl).connect(gs).connect(env);
  if (rec) rec.dp.push(lp.detune, rl.detune, sl.detune, s.detune, ...os.map(x => x.detune));
  os.forEach(x => { x.start(t0); x.stop(t1); }); run(r, t0, t1); run(s, t0, t1); done(A, t1);
};
SFX.heli = function (A, o) {
  const C = A.ctx, v = o.vol == null ? .8 : o.vol, D = o.dur || 6, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o), t1 = t0 + D, rec = O.rec;
  const env = amp(C, 0); env.connect(out); swell(env.gain, t0, .9, v, Math.max(.1, D - 1.8), .9);
  const fs = rr(10.4, 11.8), pw = pulseWave(C);
  const s = nsrc(A, 'white'), bp = flt(C, 'bandpass', 520, .8), gs = amp(C, .05); s.connect(bp).connect(gs).connect(env);                  // blade slap
  const l1 = C.createOscillator(); l1.setPeriodicWave(pw); l1.frequency.value = fs; const d1 = amp(C, .55); l1.connect(d1).connect(gs.gain);
  const h = osc(C, 'triangle', 43), gh = amp(C, .2); h.connect(gh).connect(env);                                                                   // the rotor's weight
  const l2 = C.createOscillator(); l2.setPeriodicWave(pw); l2.frequency.value = fs; const d2 = amp(C, .2); l2.connect(d2).connect(gh.gain);
  const w = osc(C, 'sine', rr(1620, 1760)), gw = amp(C, .03); w.connect(gw).connect(env); const w2 = osc(C, 'sine', w.frequency.value * 2.01), gw2 = amp(C, .01); w2.connect(gw2).connect(env);   // turbine
  const tr = nsrc(A, 'white'), tb = flt(C, 'bandpass', 1250, 2.2), gt = amp(C, .05); tr.connect(tb).connect(gt).connect(env);            // tail rotor buzz
  const tl = osc(C, 'sawtooth', fs * 3.1), td = amp(C, .05); tl.connect(td).connect(gt.gain);
  if (rec) rec.dp.push(s.detune, bp.detune, l1.detune, l2.detune, h.detune, w.detune, w2.detune, tr.detune, tb.detune, tl.detune);
  [l1, l2, h, w, w2, tl].forEach(x => { x.start(t0); x.stop(t1); }); run(s, t0, t1); run(tr, t0, t1); done(A, t1);
};
SFX.engine = function (A, o) {                                                      // the supply lorry's diesel
  const C = A.ctx, v = o.vol == null ? .5 : o.vol, D = o.dur || 6, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o), t1 = t0 + D;
  const env = amp(C, 0); env.connect(out); swell(env.gain, t0, .7, v * .7, Math.max(.1, D - 1.5), .8);
  const lp = flt(C, 'lowpass', 340, .9); lp.connect(env); const a = osc(C, 'sawtooth', 38), b = osc(C, 'sawtooth', 76.4), ga = amp(C, .5), gb = amp(C, .22); a.connect(ga).connect(lp); b.connect(gb).connect(lp);
  const fire = osc(C, 'square', 19), fd = amp(C, .25); fire.connect(fd).connect(env.gain);
  const s = nsrc(A, 'brown'), sl = flt(C, 'lowpass', 500, .6), gs = amp(C, .5); s.connect(sl).connect(gs).connect(env);
  [a, b, fire].forEach(x => { x.start(t0); x.stop(t1); }); run(s, t0, t1); done(A, t1);
};

/* ------------------------------------------------------------------ the carrier's deck */
SFX.catapult = function (A, o) {
  const C = A.ctx, v = o.vol == null ? .8 : o.vol, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o), tb = t0 + 1.45;
  const s = nsrc(A, 'white'), bp = flt(C, 'bandpass', 700, 1.6), g = amp(C, 0); s.connect(bp).connect(g).connect(out); sweep(bp.frequency, t0, 700, 3400, 1.4);   // the shuttle runs the track
  g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(v * .5, t0 + .08); g.gain.setValueAtTime(v * .5, t0 + 1.3); g.gain.exponentialRampToValueAtTime(.0001, t0 + 1.5);
  const k = osc(C, 'sine', 72), gk = amp(C, 0); k.connect(gk).connect(out); sweep(k.frequency, tb, 72, 34, .35); hit(gk.gain, tb, .002, v * .9, .4);           // the water brake stops it at the bow
  const gm = amp(C, 0), ms = [318, 872, 1463, 2390].map(f => { const m = osc(C, 'sine', f); m.connect(gm); return m; }); gm.connect(out); hit(gm.gain, tb, .001, v * .14, .55);
  const st = nsrc(A, 'white'), hp = flt(C, 'highpass', 2400, .5), gs = amp(C, 0); st.connect(hp).connect(gs).connect(out); swell(gs.gain, tb, .12, v * .32, .05, 1.7);   // steam
  run(s, t0, t0 + 1.55); run(st, tb, tb + 2); k.start(tb); k.stop(tb + .45); ms.forEach(m => { m.start(tb); m.stop(tb + .7); }); done(A, tb + 2);
};
SFX.trap = function (A, o) {
  const C = A.ctx, v = o.vol == null ? .7 : o.vol, O = spot(A, o, 'sfx'), out = O.g, t0 = t0of(A, o);
  const k = osc(C, 'sine', 95), gk = amp(C, 0); k.connect(gk).connect(out); sweep(k.frequency, t0, 95, 38, .25); hit(gk.gain, t0, .002, v * .9, .3);           // touchdown
  const s = nsrc(A, 'white'), lp = flt(C, 'lowpass', 700, .7), g1 = amp(C, 0); s.connect(lp).connect(g1).connect(out); hit(g1.gain, t0, .002, v * .6, .18);
  const ty = flt(C, 'bandpass', 2600, 5), g2 = amp(C, 0); s.connect(ty).connect(g2).connect(out); hit(g2.gain, t0 + .01, .005, v * .35, .12);              // tyres
  const ws = osc(C, 'sawtooth', 260), wb = flt(C, 'bandpass', 900, 3), gw = amp(C, 0); ws.connect(wb).connect(gw).connect(out); sweep(ws.frequency, t0 + .05, 260, 70, .95); hit(gw.gain, t0 + .05, .07, v * .22, .9);   // the wire pays out
  const e = osc(C, 'sine', 1900), ge = amp(C, 0); e.connect(ge).connect(out); e.frequency.setValueAtTime(1900, t0); e.frequency.linearRampToValueAtTime(2500, t0 + .6); e.frequency.exponentialRampToValueAtTime(900, t0 + 2.6); hit(ge.gain, t0, .4, v * .06, 2.3);   // full power on the wire, then wind down
  const r = nsrc(A, 'pink'), rl = flt(C, 'lowpass', 1800, .6), gr = amp(C, 0); r.connect(rl).connect(gr).connect(out); hit(gr.gain, t0, .35, v * .5, 2.25); rl.frequency.setValueAtTime(1800, t0 + .6); rl.frequency.exponentialRampToValueAtTime(300, t0 + 2.6);
  run(s, t0, t0 + .4); run(r, t0, t0 + 2.7); k.start(t0); k.stop(t0 + .3); ws.start(t0 + .05); ws.stop(t0 + 1.1); e.start(t0); e.stop(t0 + 2.7); done(A, t0 + 2.8);
};

/* ------------------------------------------------------------------ ambience: the sea (louder as the camera nears the water) and its gulls */
K4.AMBX = {
  init(A) {
    const C = A.ctx, g = amp(C, 0), sw = amp(C, .55); g.connect(A.bus.amb);
    const s = nsrc(A, 'pink'), lp = flt(C, 'lowpass', 850, .5); s.connect(lp).connect(sw).connect(g); s.start(0, Math.random());
    const l1 = osc(C, 'sine', .071), d1 = amp(C, .3); l1.connect(d1).connect(sw.gain); l1.start();               // swells
    const l2 = osc(C, 'sine', .163), d2 = amp(C, .15); l2.connect(d2).connect(sw.gain); l2.start();
    const h = nsrc(A, 'white'), hb = flt(C, 'bandpass', 2600, .4), hg = amp(C, .05); h.connect(hb).connect(hg).connect(g); h.start(0, Math.random());   // the wash breathes with the swell
    const l3 = osc(C, 'sine', .071), d3 = amp(C, .05); l3.connect(d3).connect(hg.gain); l3.start();
    this.sea = { g }; this.gullT = 0;
  },
  tick(A) {
    const C = A.ctx, p = A.lpos; if (!this.sea || !p) return; const t = C.currentTime;
    const k = cl((-p.z - 30) / 120, 0, 1) * (1 - cl((p.y - 60) / 220, 0, .7)); this.sea.g.gain.setTargetAtTime(.3 * k + .025, t, 1.2);
    const day = typeof WORLD !== 'undefined' && WORLD.cur ? WORLD.cur.stars < .5 : true;
    if (k > .35 && day && A.I < .4 && t > this.gullT && Math.random() < .25) {    // a gull over the water now and then, in a quiet hour
      this.gullT = t + rr(6, 14); const g = spot(A, { x: p.x + rr(-90, 90), y: p.y + rr(10, 30), z: p.z + rr(-120, -20) }, 'amb').g, n = 2 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) { const tt = t + i * rr(.22, .34), o = osc(C, 'sawtooth', 1350), bp = flt(C, 'bandpass', 1900, 4), e = amp(C, 0); o.connect(bp).connect(e).connect(g); o.frequency.setValueAtTime(1350, tt); o.frequency.linearRampToValueAtTime(1750, tt + .05); o.frequency.exponentialRampToValueAtTime(980, tt + .2); hit(e.gain, tt, .02, .05, .18); o.start(tt); o.stop(tt + .22); }
    }
  }
};
})();
