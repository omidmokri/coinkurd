"""
Nothing in «نبرد من» floats: every procedural model of the scene is checked part by part (tests/battle_audit.js). A part that
touches neither the rest of its model nor the ground (terrain or sea floor) is reported, with where it is and what colour it is.

    python tests/battle_geometry.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from battle_harness import Battle  # noqa: E402

# merged lists recorded while the scene builds: which ones, and what counts as support for them
LISTS = r"""() => {
  const pick = [];
  const lights = r => { let n = 0; for (const g of r.list) { const c = g.attributes.color; if (c && Math.max(c.getX(0), c.getY(0), c.getZ(0)) > .97) n++; } return n > r.list.length * .6; };
  __MERGES.forEach((r, i) => {
    const st = r.st; if (lights(r)) return;
    if (/gfx4\.js[^|]*:\d+:\d+\) \| at Object\.init/.test(st) && /K\.build/.test(st) && r.n > 40) pick.push([i, 'gfx4 structures', 'world']);
    else if (/K\.build \(\/battle\/gfx5/.test(st) && r.n > 100) pick.push([i, 'gfx5 harbour, bases, revetments', 'world']);
    else if (/K\.warship/.test(st) && r.n > 20) pick.push([i, 'warship body', -1.4]);
    else if (/K\.warship/.test(st)) pick.push([i, 'warship turret/radar', null]);
    else if (/K\.submarine/.test(st)) pick.push([i, 'submarine', null]);
    else if (/K\.satellite/.test(st)) pick.push([i, 'satellite', null]);
    else if (/K\.carrier/.test(st) && r.n > 40) pick.push([i, 'carrier body', -1.4]);
    else if (/K\.build \(\/battle\/gfx5/.test(st) && r.n <= 6) pick.push([i, 'radar station base', 'world']);
    else if (/K\.build \(\/battle\/gfx5/.test(st) && r.n > 6 && r.n < 30) pick.push([i, 'radar antenna', null]);
    else if (/fortBuild/.test(st)) pick.push([i, 'field works', 0]);
    else if (/A4\.init/.test(st) && r.n === 5) pick.push([i, 'recon drone', null]);
  });
  return pick;
}"""

RUN = r"""([i, mode]) => {
  const rec = __MERGES[i], SEA = GFX5.SEA;
  const opt = mode === 'world' ? { ground: (parts, b) => { let h = -1e9; for (const x of [b[0], (b[0] + b[3]) / 2, b[3]]) for (const z of [b[2], (b[2] + b[5]) / 2, b[5]]) h = Math.max(h, WORLD.hgt(x, z)); return b[1] <= Math.max(h, SEA) + .06; } } : mode === null ? { ground: () => false } : { floor: mode };
  const c = __components(rec, opt); return { n: c.length, bad: c.slice(1).filter(x => !x.ground) };
}"""

MESHES = r"""() => {
  const out = [], seen = new Set(), named = [];
  const add = (name, g, opt) => { if (!g || seen.has(g.uuid)) return; seen.add(g.uuid); named.push([name, g, opt || {}]); };
  add('MBT hull', ARMY.tkGeo.hh); add('MBT turret', ARMY.tkGeo.ht, { air: true }); add('IFV hull', ARMY.tkGeo.lh); add('IFV turret', ARMY.tkGeo.lt, { air: true });
  const grp = (name, g, opt) => g.traverse(o => { if (o.isMesh && o.geometry && !o.material.transparent) add(name, o.geometry, opt); });
  grp('HQ', WORLD.baseB, { floor: 0 }); grp('howitzer', ARMY.guns.bull[0]); grp('rocket launcher', ARMY.rkts.bull[0]); grp('truck', ARMY.trucks[0].g);
  for (const a of FX.air) grp(a.k, a.g, { air: true });
  WORLD.obst.forEach((m, i) => add(i ? 'barbed wire' : 'hedgehog', m.geometry));
  add('HESCO', ARMY.hesco.geometry); add('sandbags', ARMY.empl.geometry); add('pennant', ARMY.penn.geometry); add('bunker', ARMY.bunkers[0].geometry);
  if (window.GFX6) { add('robot', GFX6.RB.hgeo); add('robot dog', GFX6.RB.dgeo); }
  scene.children.forEach(o => { if (o.isInstancedMesh && o.geometry && o.geometry.attributes.position.count < 60000 && !o.material.transparent) add('instanced #' + o.id, o.geometry); });
  for (const [name, g, opt] of named) { const r = __auditGeom(g, opt); out.push({ name, pieces: r.pieces, bad: r.bad || [] }); }
  return out;
}"""

if __name__ == "__main__":
    with Battle(gpu=True, quality="high", audit=True) as b:
        b.wait_ready(timeout=240, units=False)
        fails = []
        for i, name, mode in b.js(LISTS):
            r = b.js(RUN, [i, mode])
            print("%-34s parts=%-4s floating=%d" % (name, "", len(r["bad"])))
            for x in r["bad"]:
                print("      box", x["b"], "colours", x["cols"])
                fails.append((name, x["b"]))
        for r in b.js(MESHES):
            if r["bad"]:
                print("%-34s floating=%d" % (r["name"], len(r["bad"])))
                for x in r["bad"]:
                    print("      box", x["b"])
                    fails.append((r["name"], x["b"]))
        print("errors:", b.errors()[:3])
        assert not fails, "%d floating parts" % len(fails)
        print("OK: every part of every model touches its model or the ground")
