/* Geometry audit for the «نبرد من» scene (tests only).
   Every procedural model is a list of primitives merged into one mesh. This script records each list as it is merged
   and, on request, finds the parts that touch nothing: a primitive (or a group of primitives) that is neither connected
   to the rest of its model nor resting on the ground is floating in the air. Contact is exact up to EPS: a vertex on or
   inside the other part, or an edge that passes through one of its faces. */
(() => {
  'use strict';
  const REC = window.__MERGES = [];
  let busy = false;
  const wrap = f => function (list) {
    const out = f.apply(this, arguments);
    if (!busy && Array.isArray(list) && list.length > 1) {
      const st = (new Error().stack || '').split('\n').slice(2, 6).map(s => s.trim().replace(/https?:\/\/[^/]+/, '')).join(' | ');
      REC.push({ list, st, n: list.length });
    }
    return out;
  };
  let _G;
  Object.defineProperty(window, 'GFX', { configurable: true, get() { return _G; }, set(v) {
    _G = v; let m; Object.defineProperty(v, 'merge', { configurable: true, enumerable: true, get() { return m; }, set(f) { m = wrap(f); } });
  } });

  const EPS = 0.03;
  /* triangle soup of a primitive: Float32Array of 9 numbers a triangle */
  function tris(g) {
    const p = g.attributes.position, idx = g.index; const n = idx ? idx.count : p.count, T = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = idx ? idx.getX(i) : i; T[i * 3] = p.getX(k); T[i * 3 + 1] = p.getY(k); T[i * 3 + 2] = p.getZ(k); }
    return T;
  }
  function box(T) { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (let i = 0; i < T.length; i += 3) for (let a = 0; a < 3; a++) { const v = T[i + a]; if (v < b[a]) b[a] = v; if (v > b[a + 3]) b[a + 3] = v; } return b; }
  const over = (a, b, e) => a[0] - e <= b[3] && b[0] - e <= a[3] && a[1] - e <= b[4] && b[1] - e <= a[4] && a[2] - e <= b[5] && b[2] - e <= a[5];
  /* squared distance point → triangle (Ericson, Real-Time Collision Detection 5.1.5) */
  function pt(px, py, pz, T, o) {
    const ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
    const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    let qx, qy, qz;
    if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
    else {
      const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
      if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; }
      else {
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; }
        else {
          const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
          if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; }
          else {
            const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; }
            else {
              const va = d3 * d6 - d5 * d4;
              if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); qx = bx + w * (cx - bx); qy = by + w * (cy - by); qz = bz + w * (cz - bz); }
              else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
            }
          }
        }
      }
    }
    const dx = px - qx, dy = py - qy, dz = pz - qz; return dx * dx + dy * dy + dz * dz;
  }
  /* segment p→q against triangle (Möller–Trumbore), t in [0,1] */
  function seg(px, py, pz, qx, qy, qz, T, o) {
    const ax = T[o], ay = T[o + 1], az = T[o + 2], e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az, e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
    const dx = qx - px, dy = qy - py, dz = qz - pz, hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x, a = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(a) < 1e-12) return false;
    const f = 1 / a, sx = px - ax, sy = py - ay, sz = pz - az, u = f * (sx * hx + sy * hy + sz * hz); if (u < 0 || u > 1) return false;
    const qx2 = sy * e1z - sz * e1y, qy2 = sz * e1x - sx * e1z, qz2 = sx * e1y - sy * e1x, v = f * (dx * qx2 + dy * qy2 + dz * qz2); if (v < 0 || u + v > 1) return false;
    const t = f * (e2x * qx2 + e2y * qy2 + e2z * qz2); return t >= 0 && t <= 1;
  }
  /* point inside a closed part: odd number of crossings along +x (slightly skewed to dodge edges) */
  function inside(px, py, pz, B) {
    const T = B.T; let n = 0; const qx = px + 1e4, qy = py + 1.37, qz = pz + 2.11;
    for (let o = 0; o < T.length; o += 9) if (seg(px, py, pz, qx, qy, qz, T, o)) n++;
    return n % 2 === 1;
  }
  function touch(A, B) {
    const e2 = EPS * EPS, TA = A.T, TB = B.T;
    for (let i = 0; i < TA.length; i += 3) { const x = TA[i], y = TA[i + 1], z = TA[i + 2]; if (x < B.b[0] - EPS || x > B.b[3] + EPS || y < B.b[1] - EPS || y > B.b[4] + EPS || z < B.b[2] - EPS || z > B.b[5] + EPS) continue; for (let o = 0; o < TB.length; o += 9) if (pt(x, y, z, TB, o) < e2) return true; }
    for (let i = 0; i < TB.length; i += 3) { const x = TB[i], y = TB[i + 1], z = TB[i + 2]; if (x < A.b[0] - EPS || x > A.b[3] + EPS || y < A.b[1] - EPS || y > A.b[4] + EPS || z < A.b[2] - EPS || z > A.b[5] + EPS) continue; for (let o = 0; o < TA.length; o += 9) if (pt(x, y, z, TA, o) < e2) return true; }
    const ed = (X, Y) => { for (let o = 0; o < X.T.length; o += 9) for (let k = 0; k < 3; k++) { const a = o + k * 3, b = o + ((k + 1) % 3) * 3, T = X.T; const x0 = T[a], y0 = T[a + 1], z0 = T[a + 2], x1 = T[b], y1 = T[b + 1], z1 = T[b + 2];
      if (Math.max(x0, x1) < Y.b[0] || Math.min(x0, x1) > Y.b[3] || Math.max(y0, y1) < Y.b[1] || Math.min(y0, y1) > Y.b[4] || Math.max(z0, z1) < Y.b[2] || Math.min(z0, z1) > Y.b[5]) continue;
      for (let q = 0; q < Y.T.length; q += 9) if (seg(x0, y0, z0, x1, y1, z1, Y.T, q)) return true; } return false; };
    if (ed(A, B) || ed(B, A)) return true;
    if (inside(TA[0], TA[1], TA[2], B) || inside(TB[0], TB[1], TB[2], A)) return true;
    return false;
  }

  /* the same test on a finished mesh: its triangles are welded into pieces (a piece = triangles that share vertices) */
  window.__auditGeom = function (geom, opt) {
    opt = opt || {};
    const p = geom.attributes.position, idx = geom.index, nt = (idx ? idx.count : p.count) / 3;
    if (nt > (opt.max || 30000)) return { skip: nt };
    const key = new Map(), vid = new Int32Array(nt * 3);
    for (let t = 0; t < nt * 3; t++) { const k = idx ? idx.getX(t) : t; const kk = Math.round(p.getX(k) * 1e4) + ',' + Math.round(p.getY(k) * 1e4) + ',' + Math.round(p.getZ(k) * 1e4); let id = key.get(kk); if (id == null) { id = key.size; key.set(kk, id); } vid[t] = id; }
    const par = new Int32Array(key.size).map((_, i) => i);
    for (let t = 0; t < nt; t++) { const a = find(par, vid[t * 3]), b = find(par, vid[t * 3 + 1]), c = find(par, vid[t * 3 + 2]); par[b] = a; par[find(par, c)] = a; }
    const groups = new Map();
    for (let t = 0; t < nt; t++) { const r = find(par, vid[t * 3]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); }
    const P = []; let gmin = 1e9;
    for (const tl of groups.values()) { const T = new Float32Array(tl.length * 9); tl.forEach((t, j) => { for (let v = 0; v < 3; v++) { const k = idx ? idx.getX(t * 3 + v) : t * 3 + v; T[j * 9 + v * 3] = p.getX(k); T[j * 9 + v * 3 + 1] = p.getY(k); T[j * 9 + v * 3 + 2] = p.getZ(k); } }); const b = box(T); gmin = Math.min(gmin, b[1]); P.push({ i: P.length, T, b, nt: tl.length }); }
    const floor = opt.floor != null ? opt.floor : gmin;
    const rec = { list: null };
    const par2 = P.map((_, i) => i), ord = P.map((_, i) => i).sort((a, b) => P[a].b[0] - P[b].b[0]);
    for (let s = 0; s < ord.length; s++) { const A = P[ord[s]]; for (let r = s + 1; r < ord.length; r++) { const B = P[ord[r]]; if (B.b[0] - EPS > A.b[3]) break; if (!over(A.b, B.b, EPS)) continue; const ra = find(par2, A.i), rb = find(par2, B.i); if (ra === rb) continue; if (touch(A, B)) par2[ra] = rb; } }
    const comp = new Map(); P.forEach(q => { const r = find(par2, q.i); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(q); });
    const out = [];
    for (const parts of comp.values()) { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; let n = 0; for (const q of parts) { n += q.nt; for (let a = 0; a < 3; a++) { b[a] = Math.min(b[a], q.b[a]); b[a + 3] = Math.max(b[a + 3], q.b[a + 3]); } } out.push({ n: parts.length, nt: n, b: b.map(v => Math.round(v * 100) / 100), ground: opt.air ? false : b[1] <= floor + EPS }); }
    out.sort((a, b) => b.nt - a.nt); void rec;
    return { pieces: P.length, comps: out.length, main: out[0], bad: out.slice(1).filter(x => !x.ground) };
  };

  function find(par, i) { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }
  /* components of one merged list; world: the list is in world space and the terrain counts as support */
  window.__components = function (rec, opt) {
    opt = opt || {};
    const P = rec.list.map((g, i) => { const T = tris(g); const c = g.attributes.color; return { i, T, b: box(T), col: c ? [c.getX(0), c.getY(0), c.getZ(0)].map(v => Math.round(v * 255)) : null, nt: T.length / 9 }; });
    const par = P.map((_, i) => i);
    const ord = P.map((_, i) => i).sort((a, b) => P[a].b[0] - P[b].b[0]);
    for (let s = 0; s < ord.length; s++) { const A = P[ord[s]]; for (let r = s + 1; r < ord.length; r++) { const B = P[ord[r]]; if (B.b[0] - EPS > A.b[3]) break; if (!over(A.b, B.b, EPS)) continue; const ra = find(par, A.i), rb = find(par, B.i); if (ra === rb) continue; if (touch(A, B)) par[ra] = rb; } }
    const comp = new Map(); P.forEach(p => { const r = find(par, p.i); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(p); });
    const out = [];
    for (const parts of comp.values()) {
      const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; let nt = 0; for (const p of parts) { nt += p.nt; for (let a = 0; a < 3; a++) { b[a] = Math.min(b[a], p.b[a]); b[a + 3] = Math.max(b[a + 3], p.b[a + 3]); } }
      let gnd = opt.ground ? opt.ground(parts, b) : (b[1] <= (opt.floor == null ? 0 : opt.floor) + EPS);
      out.push({ n: parts.length, nt, b: b.map(v => Math.round(v * 100) / 100), ground: gnd, cols: [...new Set(parts.map(p => p.col && p.col.join(',')))].slice(0, 4), idx: parts.map(p => p.i).slice(0, 12) });
    }
    out.sort((a, b) => b.nt - a.nt);
    return out;
  };
})();
