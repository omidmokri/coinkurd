"""
Nothing on the ground of «نبرد من» (battle/) passes through anything solid: runs the scene on a synthetic market with walls,
whale prints, sweeps (the machines) and liquidation strikes for a few minutes and checks five times a second that

  * no vehicle or lorry overlaps a structure, wire, hedgehog, wreck, wall, bunker, sandbag or another hull (exact shapes, 10 cm tolerance),
  * no soldier, robot or robot dog stands or walks inside any of those, or inside a vehicle,
  * everyone stands on the ground (not above or below it).

A unit caught inside something counts only if it is still inside a moment later (the world changes under them: a wall goes up
where a squad stands, and they step out of it).

    python tests/battle_ground.py [seconds]
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from battle_harness import Battle  # noqa: E402

SECONDS = int(sys.argv[1]) if len(sys.argv) > 1 else 150

WATCH = r"""() => {
  const W = window.__GW = { n: 0, bad: {}, ex: {}, max: {}, units: [0, 0, 0, 0] };
  const seen = new Map();                         // object -> first time caught inside something
  const flag = (key, o, info, t) => { const f = seen.get(o); if (f == null || f.k !== key) { seen.set(o, { k: key, t }); return; } if (t - f.t < 1100) return;
    W.bad[key] = (W.bad[key] || 0) + 1; if (!W.ex[key] || W.ex[key].length < 6) (W.ex[key] = W.ex[key] || []).push(info); seen.set(o, { k: key, t: t + 1e9 }); };
  const ok = o => { const f = seen.get(o); if (f && f.t < 1e12) seen.delete(o); };
  const worksHit = (x, z, pad) => ARMY.works.some(sh => NAV.inShape(sh, x, z, pad));
  /* exact geometry, not the navigation grid: how far a point is outside a hull (negative: inside), and whether a hull reaches more than
     TOL into a shape (box: separating axes; circle: centre to hull; capsule: its axis sampled every 5 cm) */
  const TOL = .1;
  const ptHull = (px, pz, x, z, h, hx, hz) => { const dx = px - x, dz = pz - z, c = Math.cos(h), s = Math.sin(h), lx = Math.abs(dx * c - dz * s), lz = Math.abs(dx * s + dz * c), qx = lx - hx, qz = lz - hz;
    return qx > 0 || qz > 0 ? Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) : Math.max(qx, qz); };
  const hullIn = (sh, x, z, h, hx, hz) => {
    if (sh.t === 'b') return NAV.obb(x, z, h, hx - TOL, hz - TOL, sh.x, sh.z, sh.rot, sh.hx, sh.hz, 0);
    if (sh.t === 'c') return ptHull(sh.x, sh.z, x, z, h, hx, hz) < sh.r - TOL;
    const L = Math.hypot(sh.bx - sh.ax, sh.bz - sh.az), n = Math.max(1, Math.ceil(L / .05));
    for (let i = 0; i <= n; i++) if (ptHull(sh.ax + (sh.bx - sh.ax) * i / n, sh.az + (sh.bz - sh.az) * i / n, x, z, h, hx, hz) < sh.r - TOL) return true;
    return false; };
  const hullHit = (list, v, B) => { const R = Math.hypot(B[0], B[1]) + .5; for (const sh of list) { const b = NAV.bounds(sh); if (b[0] > v.x + R || b[2] < v.x - R || b[1] > v.z + R || b[3] < v.z - R) continue; if (hullIn(sh, v.x, v.z, v.hd, B[0], B[1])) return sh; } return null; };
  setInterval(() => {
    if (!ARMY.navOn) return; const t = vt(); W.n++;
    const movers = ARMY.movers(); let nv = 0, ns = 0, nb = 0;
    for (const v of movers) {
      if (v.dead) continue; nv++; const B = ARMY.VB[v.tier];
      const sh = hullHit(NAV.statics, v, B), wk = hullHit(ARMY.works, v, B);
      let vv = null; for (const o of movers) { if (o === v || o.dead && v.dead) continue; const b = ARMY.VB[o.tier]; if (NAV.obb(v.x, v.z, v.hd, B[0], B[1], o.x, o.z, o.hd, b[0], b[1], -TOL / 2)) { vv = o; break; } }
      if (sh) flag('vehicle in a structure or obstacle', v, [Math.round(v.x * 10) / 10, Math.round(v.z * 10) / 10, v.tier, v.mv, Math.round(v.hd * 100) / 100, v.ops && v.ops[v.oi] ? v.ops[v.oi].k : '-', v.oi, v.ops ? v.ops.length : 0, [sh.tag, sh.t, Math.round((sh.x != null ? sh.x : sh.ax) * 10) / 10, Math.round((sh.z != null ? sh.z : sh.az) * 10) / 10]], t);
      else if (wk) flag('vehicle in field works', v, [Math.round(v.x * 10) / 10, Math.round(v.z * 10) / 10, v.tier, v.mv], t);
      else if (vv) flag('vehicle overlapping another', v, [Math.round(v.x * 10) / 10, Math.round(v.z * 10) / 10, v.tier, v.mv, v.ops && v.ops[v.oi] ? v.ops[v.oi].k : '-', Math.round(vv.x * 10) / 10, Math.round(vv.z * 10) / 10, vv.tier, vv.mv, vv.dead ? 'wreck' : vv.ops && vv.ops[vv.oi] ? vv.ops[vv.oi].k : '-'], t);
      else ok(v);
      const gy = ARMY.gy(v.x, v.z); if (!v.mv && Math.abs(v.y - gy) > .6) flag('vehicle off the ground', v, [v.x, v.z, v.y, gy], t);
    }
    for (const k in ARMY.sides) for (const s of ARMY.sides[k].sold) {
      if (s.held || s.st === ST.DIE) continue; ns++;
      const c = NAV.clear(s.x, s.z, true);
      if (c < -.12) flag('soldier in a structure or obstacle', s, [Math.round(s.x * 10) / 10, Math.round(s.z * 10) / 10, s.mv, Math.round(c * 100) / 100], t);
      else if (worksHit(s.x, s.z, -.15)) flag('soldier in field works', s, [Math.round(s.x * 10) / 10, Math.round(s.z * 10) / 10, s.mv], t);
      else if (ARMY.inMover(s.x, s.z, -.15)) flag('soldier inside a vehicle', s, [Math.round(s.x * 10) / 10, Math.round(s.z * 10) / 10, s.mv], t);
      else ok(s);
      if (!s.mv && t - (s.t0 || 0) > 3000 && Math.abs(s.y - ARMY.gy(s.x, s.z)) > .35) flag('soldier off the ground', s, [s.x, s.z, s.y, ARMY.gy(s.x, s.z)], t);
    }
    if (window.GFX6 && GFX6.RB.ready) for (const k in GFX6.RB.sides) { const S = GFX6.RB.sides[k]; for (const o of S.bots.concat(S.dogs)) { nb++;
      if (NAV.clear(o.x, o.z, true) < -.12) flag('machine in a structure or obstacle', o, [Math.round(o.x * 10) / 10, Math.round(o.z * 10) / 10, o.mv], t);
      else if (ARMY.inMover(o.x, o.z, -.15)) flag('machine inside a vehicle', o, [Math.round(o.x * 10) / 10, Math.round(o.z * 10) / 10, o.mv], t);
      else ok(o); } }
    for (const v of movers) { if (v.dead) continue; const k = v.id || v.g && v.g.uuid; if (!k) continue; const st = W.st || (W.st = {});        // hulls that should move but stand still
      if (v.mv && !v.spd) { const e = st[k] || (st[k] = { t0: t, x: v.x, z: v.z }); if (Math.hypot(v.x - e.x, v.z - e.z) > .5) { e.t0 = t; e.x = v.x; e.z = v.z; }
        const d = (t - e.t0) / 1000; W.maxStill = Math.max(W.maxStill || 0, d); if (d > 10 && !e.rep) { e.rep = 1; (W.stuck = W.stuck || []).push([Math.round(v.x), Math.round(v.z), v.tier, v.mv, v.ops ? v.ops.length : -1, v.retry ? 'noroute' : v.stand ? 'bay' : v.gt && !v.gt.G.users.has(v) ? 'gate' : v.blk ? 'hull' : v.solid ? 'solid' : 'other']); } }
      else delete st[k]; }
    W.units[0] = Math.max(W.units[0], nv); W.units[1] = Math.max(W.units[1], ns); W.units[2] = Math.max(W.units[2], nb);
    W.units[3] = Math.max(W.units[3], ARMY.trucks.filter(x => x.on && !x.hold).length);
  }, 200);
  return true;
}"""

if __name__ == "__main__":
    with Battle(gpu=False, quality="lite", w=900, h=540) as b:
        b.wait_ready(timeout=240, units=False)
        b.js(WATCH)
        b.js("() => { window.__cam = { p: [0, 160, 40], t: [0, 0, -5], fov: 50 }; }")    # a fixed high camera: cheap frames
        t0 = time.time(); k = 0
        script = [
            "FAKE.wall(FAKE.px - 60, 3.0e7)", "FAKE.wall(FAKE.px + 70, 3.2e7)", "FAKE.sweep(6, 9e5, false)", "FAKE.liq(4e4, 'long')",
            "FAKE.trade(1.4e6, false)", "FAKE.wall(FAKE.px - 140, 2.6e7)", "FAKE.sweep(7, 1.2e6, true)", "FAKE.liq(3e5, 'short')",
            "FAKE.move(-25)", "FAKE.wall(FAKE.px + 150, 2.8e7)", "FAKE.trade(6e5, true)", "FAKE.liq(8e4, 'long')",
            "FAKE.move(30)", "FAKE.pull(FAKE.px + 70)", "FAKE.sweep(5, 7e5, false)", "FAKE.liq(1.2e6, 'long')",
        ]
        while time.time() - t0 < SECONDS:
            b.js("() => { %s }" % script[k % len(script)]); k += 1
            time.sleep(6)
        r = b.js("() => window.__GW")
        errs = [e for e in b.errors() if 'TUNNEL' not in e[1]]
        print("checks:", r["n"], "| most at once: vehicles %d, soldiers %d, machines %d, lorries %d" % tuple(r["units"]))
        for key, n in sorted(r["bad"].items(), key=lambda kv: -kv[1]):
            print("  %-40s %d   e.g. %s" % (key, n, json.dumps(r["ex"].get(key, [])[:3])))
        print("standing still over 10 s while under way:", json.dumps(r.get("stuck", [])[:12]), "| longest: %.0f s" % (r.get("maxStill") or 0))
        print("page errors:", errs[:5])
        assert not errs, "script errors on the page"
        assert r["units"][0] > 0 and r["units"][1] > 20, "the run never fielded vehicles and infantry"
        assert not r["bad"], "units passing through solid things"
        print("OK: nobody went through anything in %d s" % SECONDS)
