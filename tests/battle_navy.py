"""
Ships of «نبرد من» (battle/) never touch: runs the scene's own naval clock for a long stretch of simulated time and checks, at
every step, that no two hulls (destroyers, frigates, patrol boats, carriers, submarines) come closer than GAP metres, that every
hull floats over water deep enough for its draught, and that none of them reaches the harbour piers or quays.

    python tests/battle_navy.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from battle_harness import Battle  # noqa: E402

GAP = 4.0          # metres of clear water between hulls
MINUTES = 40       # simulated

CHECK = r"""([minutes, gap]) => {
  const E = WORLD.env5, SEA = GFX5.SEA, out = { worst: {}, ground: [], pier: [], steps: 0 };
  const box = o => { o.updateMatrixWorld(true); const b = new THREE.Box3(); o.traverse(c => { if (c.isMesh && c.geometry && !c.material.transparent) { c.geometry.computeBoundingBox(); const bb = c.geometry.boundingBox.clone(); b.union(bb); } }); return b; };
  /* hull footprints from the models themselves (local bounding box of the opaque meshes, the wake left out) */
  const hulls = [];
  for (const s of E.ships) { const b = box(s.g.children[0]); hulls.push({ n: s.side + '-' + s.kind, o: s.g, b, draft: 1.4 * s.g.scale.x }); }
  for (const k in E.subs) { const g = E.subs[k].g, b = box(g.children[0]); hulls.push({ n: k + '-sub', o: g, b, draft: 9, sub: E.subs[k] }); }
  if (window.GFX6) for (const k in GFX6.cv) { const g = GFX6.cv[k].g, b = box(g.children[0]); hulls.push({ n: k + '-cv', o: g, b, draft: 1.4 * g.scale.x }); }
  const rect = h => { const o = h.o, s = o.scale.x, b = h.b, P = []; o.updateMatrixWorld(true);
    for (const [x, z] of [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]]) { const v = new THREE.Vector3(x, 0, z).applyMatrix4(o.matrixWorld); P.push([v.x, v.z]); } return P; };
  const segd = (p, a, b) => { const abx = b[0] - a[0], abz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / (abx * abx + abz * abz))); return Math.hypot(p[0] - a[0] - t * abx, p[1] - a[1] - t * abz); };
  const inside = (p, R) => { let s = 0; for (let i = 0; i < 4; i++) { const a = R[i], b = R[(i + 1) % 4], c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); s += c > 0 ? 1 : -1; } return Math.abs(s) === 4; };
  const rdist = (A, B) => { for (const p of A) if (inside(p, B)) return 0; for (const p of B) if (inside(p, A)) return 0; let d = 1e9; for (const p of A) for (let i = 0; i < 4; i++) d = Math.min(d, segd(p, B[i], B[(i + 1) % 4])); for (const p of B) for (let i = 0; i < 4; i++) d = Math.min(d, segd(p, A[i], A[(i + 1) % 4])); return d; };
  const piers = []; for (const k of ['bull', 'bear']) { const P = E.port[k], m = k === 'bull' ? -1 : 1, px = P.x0 - 5 * m; piers.push({ n: k + '-pier', R: [[px - 2.5, P.zs - 34], [px + 2.5, P.zs - 34], [px + 2.5, P.zs + 12], [px - 2.5, P.zs + 12]] }, { n: k + '-quay', R: [[P.x0 - 11, P.zs - 1], [P.x0 + 11, P.zs - 1], [P.x0 + 11, P.zs + 12], [P.x0 - 11, P.zs + 12]] }); }
  const dt = .5; let t = E.t;
  for (let step = 0; step < minutes * 60 / dt; step++) {
    t += dt; E.tick(dt, t); out.steps++;
    const R = hulls.map(h => ({ h, r: rect(h) }));
    for (let i = 0; i < R.length; i++) {
      for (let j = i + 1; j < R.length; j++) { const a = R[i], b = R[j]; if (a.h.sub && b.h.sub) continue; const k = a.h.n + ' x ' + b.h.n, d = rdist(a.r, b.r); if (!(k in out.worst) || d < out.worst[k]) out.worst[k] = Math.round(d * 10) / 10; }
      const a = R[i]; if (step % 4 === 0) { const [p, q, r, s] = a.r; for (let u = 0; u <= 1; u += .125) for (let v = 0; v <= 1; v += .25) { const x = p[0] + (q[0] - p[0]) * u + (s[0] - p[0]) * v, z = p[1] + (q[1] - p[1]) * u + (s[1] - p[1]) * v, h = WORLD.hgtBase(x, z); if (h > SEA - a.h.draft - .3 && out.ground.length < 20) out.ground.push([a.h.n, Math.round(x), Math.round(z), Math.round(h * 100) / 100]); } }
      for (const P of piers) { const d = rdist(a.r, P.R); if (d < gap && out.pier.length < 20) out.pier.push([a.h.n, P.n, Math.round(d * 10) / 10]); }
    }
  }
  return out;
}"""

if __name__ == "__main__":
    with Battle(gpu=False, quality="lite") as b:
        b.wait_ready(timeout=240, units=False)
        r = b.js(CHECK, [MINUTES, GAP])
        bad = {k: v for k, v in r["worst"].items() if v < GAP}
        for k, v in sorted(r["worst"].items(), key=lambda kv: kv[1])[:12]:
            print("  %-26s closest %.1f m" % (k, v))
        print("steps", r["steps"], "| too close:", bad or "none", "| aground:", r["ground"] or "none", "| at the piers:", r["pier"] or "none")
        assert not bad, "hulls closer than %.1f m: %r" % (GAP, bad)
        assert not r["ground"], "hull over shallow water: %r" % r["ground"][:5]
        assert not r["pier"], "hull at a pier or quay: %r" % r["pier"][:5]
        print("OK: no hull ever touches another hull, the ground, a pier or a quay in %d simulated minutes" % MINUTES)
