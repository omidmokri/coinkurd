/* entekhab.net — «نبرد من» ground navigation (loaded before battle.js)
   Every solid thing on the ground (structures, walls, wire, anti-tank hedgehogs, wrecks, lamp posts, guns, tents, parked and burnt-out
   vehicles) is a shape on a half-metre grid. A distance field over that grid gives the clearance at any point; routes are A* searches
   that only cross cells with room for the mover (a soldier needs half a metre, a tank two and a half), then pulled straight wherever
   the straight line has the same room. Nothing that moves on the ground is allowed to pass through anything solid. */
(function () {
'use strict';
const N = window.NAV = {};
const CS = .5, X0 = -132, Z0 = -48, W = 528, H = 192;          // x in [-132, 132), z in [-48, 48): the field, both bases, the road behind them
N.CS = CS; N.X0 = X0; N.Z0 = Z0; N.W = W; N.H = H; N.ready = false;
const SZ = W * H, occS = new Uint8Array(SZ), occ = new Uint8Array(SZ), dist = new Float32Array(SZ), distS = new Float32Array(SZ);
const statics = []; let dyn = [], tmp = [];
N.statics = statics;
/* ---- shapes: circle {t:'c',x,z,r} · capsule {t:'s',ax,az,bx,bz,r} · box {t:'b',x,z,hx,hz,rot} (rot as three.js rotateY) */
N.circle = (x, z, r, tag) => ({ t: 'c', x, z, r, tag });
N.capsule = (ax, az, bx, bz, r, tag) => ({ t: 's', ax, az, bx, bz, r, tag });
N.box = (x, z, hx, hz, rot, tag) => ({ t: 'b', x, z, hx, hz, rot: rot || 0, c: Math.cos(rot || 0), s: Math.sin(rot || 0), tag });
N.add = function (sh) { statics.push(sh); return sh; };
function inShape(sh, x, z, pad) {
  pad = pad || 0;
  if (sh.t === 'c') { const dx = x - sh.x, dz = z - sh.z, r = sh.r + pad; return dx * dx + dz * dz <= r * r; }
  if (sh.t === 's') { const abx = sh.bx - sh.ax, abz = sh.bz - sh.az, l2 = abx * abx + abz * abz || 1e-9, t = Math.max(0, Math.min(1, ((x - sh.ax) * abx + (z - sh.az) * abz) / l2)), dx = x - sh.ax - t * abx, dz = z - sh.az - t * abz, r = sh.r + pad; return dx * dx + dz * dz <= r * r; }
  const dx = x - sh.x, dz = z - sh.z, lx = dx * sh.c - dz * sh.s, lz = dx * sh.s + dz * sh.c;           // world → local (inverse of rotateY)
  return Math.abs(lx) <= sh.hx + pad && Math.abs(lz) <= sh.hz + pad;
}
N.inShape = inShape;
function bounds(sh) {
  if (sh.t === 'c') return [sh.x - sh.r, sh.z - sh.r, sh.x + sh.r, sh.z + sh.r];
  if (sh.t === 's') return [Math.min(sh.ax, sh.bx) - sh.r, Math.min(sh.az, sh.bz) - sh.r, Math.max(sh.ax, sh.bx) + sh.r, Math.max(sh.az, sh.bz) + sh.r];
  const ex = Math.abs(sh.hx * sh.c) + Math.abs(sh.hz * sh.s), ez = Math.abs(sh.hx * sh.s) + Math.abs(sh.hz * sh.c); return [sh.x - ex, sh.z - ez, sh.x + ex, sh.z + ez];
}
N.bounds = bounds;
function paint(o, sh) {
  const b = bounds(sh), i0 = Math.max(0, Math.floor((b[0] - X0) / CS)), i1 = Math.min(W - 1, Math.ceil((b[2] - X0) / CS)), j0 = Math.max(0, Math.floor((b[1] - Z0) / CS)), j1 = Math.min(H - 1, Math.ceil((b[3] - Z0) / CS));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inShape(sh, X0 + (i + .5) * CS, Z0 + (j + .5) * CS, CS * .35)) o[j * W + i] = 1;
}
/* exact Euclidean distance transform (Felzenszwalb & Huttenlocher), in metres from each cell centre to the nearest solid cell centre */
const f = new Float64Array(Math.max(W, H)), dd = new Float64Array(Math.max(W, H)), v = new Int32Array(Math.max(W, H)), zz = new Float64Array(Math.max(W, H) + 1), INF = 1e20;
function edt1(n) {
  let k = 0; v[0] = 0; zz[0] = -INF; zz[1] = INF;
  for (let q = 1; q < n; q++) { let s; while (true) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= zz[k]) { k--; if (k < 0) { k = 0; break; } } else break; } k++; v[k] = q; zz[k] = s; zz[k + 1] = INF; }
  k = 0; for (let q = 0; q < n; q++) { while (zz[k + 1] < q) k++; const p = v[k]; dd[q] = (q - p) * (q - p) + f[p]; }
}
function edt(o, out) {
  for (let i = 0; i < W; i++) { for (let j = 0; j < H; j++) f[j] = o[j * W + i] ? 0 : INF; edt1(H); for (let j = 0; j < H; j++) out[j * W + i] = dd[j]; }
  for (let j = 0; j < H; j++) { for (let i = 0; i < W; i++) f[i] = out[j * W + i]; edt1(W); for (let i = 0; i < W; i++) out[j * W + i] = Math.sqrt(dd[i]) * CS; }
}
N.bake = function () { occS.fill(0); for (const sh of statics) paint(occS, sh); edt(occS, distS); N.ready = true; N.rebuild(); };
/* dynamic things (field works, bunkers, standing and wrecked vehicles): replaced as a whole, then the field is rebuilt */
N.setDynamic = function (list) { dyn = list; N.dirty = true; };
N.dynamics = () => dyn;
N.rebuild = function () { occ.set(occS); for (const sh of dyn) paint(occ, sh); edt(occ, dist); N.dirty = false; N.ver = (N.ver || 0) + 1; flows.clear(); };
const cell = (x, z) => { const i = Math.floor((x - X0) / CS), j = Math.floor((z - Z0) / CS); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
N.cell = cell;
/* clearance at a point: metres from the point to the nearest solid thing (cell-centre field less half a cell, so it errs on the safe side) */
N.clear = function (x, z, stat) { const c = cell(x, z); if (c < 0) return 99; return (stat ? distS : dist)[c] - CS * .5; };
N.inside = (x, z) => x > X0 + 1 && x < X0 + W * CS - 1 && z > Z0 + 1 && z < Z0 + H * CS - 1;
/* the straight line from a to b keeps r metres of room all the way */
N.lineClear = function (ax, az, bx, bz, r, stat) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / (CS * .5))), F = stat ? distS : dist;
  for (let k = 0; k <= n; k++) { const t = k / n, c = cell(ax + (bx - ax) * t, az + (bz - az) * t); if (c < 0) continue; if (F[c] - CS * .5 < r) return false; }
  return true;
};
/* an oriented box (a parked or turning vehicle) has margin m of room everywhere along its outline and through its middle */
N.boxClear = function (x, z, hx, hz, hd, m, extra, stat) {
  const c = Math.cos(hd), s = Math.sin(hd);
  for (let u = -1; u <= 1.0001; u += .25) for (let w = -1; w <= 1.0001; w += .5) {
    const lx = u * hx, lz = w * hz, px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
    if (N.clear(px, pz, stat) < m) return false;
    if (extra) for (const sh of extra) if (inShape(sh, px, pz, m)) return false;
  }
  return true;
};
/* a vehicle's hull (an oriented box) keeps m metres from everything solid. Samples every quarter metre: hullEdge the outline only
   (enough for a hull moving on from a pose already clear: nothing can get inside it without crossing its edge), hullClear the whole box.
   The field measures to cell centres; the extra .2 covers the half-cell and the gaps between the samples. */
function hullAt(x, z, hx, hz, hd, m, extra, stat, edge) {
  const c = Math.cos(hd), s = Math.sin(hd), F = stat ? distS : dist, need = m + .2, nu = Math.max(2, Math.ceil(2 * hx / .25)), nw = Math.max(2, Math.ceil(2 * hz / .25));
  for (let a = 0; a <= nu; a++) {
    const lx = -hx + 2 * hx * a / nu, rim = a === 0 || a === nu;
    for (let b = 0; b <= nw; b += edge && !rim ? nw : 1) {
      const lz = -hz + 2 * hz * b / nw, px = x + lx * c + lz * s, pz = z - lx * s + lz * c, k = cell(px, pz);
      if (k >= 0 && F[k] - CS * .5 < need) return false;
      if (extra) for (const sh of extra) if (inShape(sh, px, pz, m)) return false;
    }
  }
  return true;
}
N.hullEdge = (x, z, hx, hz, hd, m, extra, stat) => hullAt(x, z, hx, hz, hd, m, extra, stat, true);
N.hullClear = (x, z, hx, hz, hd, m, extra, stat) => hullAt(x, z, hx, hz, hd, m, extra, stat, false);
/* nearest point within maxR of (x, z) with r of room (and pred(x, z) true when given); spirals out cell by cell */
N.free = function (x, z, r, maxR, pred, stat) {
  if (N.clear(x, z, stat) >= r && (!pred || pred(x, z))) return [x, z];
  const n = Math.ceil((maxR || 12) / CS);
  for (let k = 1; k <= n; k++) {
    let best = null, bd = 1e9;
    for (let a = -k; a <= k; a++) for (const [di, dj] of [[a, -k], [a, k], [-k, a], [k, a]]) {
      const px = x + di * CS, pz = z + dj * CS; if (!N.inside(px, pz)) continue;
      if (N.clear(px, pz, stat) >= r && (!pred || pred(px, pz))) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = [px, pz]; } }
    }
    if (best) return best;
  }
  return null;
};
/* ---- A*: 8-connected grid, cells passable when they have r of room; cost prefers the middle of a passage */
const gS = new Float32Array(SZ), came = new Int32Array(SZ), seen = new Uint32Array(SZ), shut = new Uint32Array(SZ); let stamp = 0;
const heap = { k: new Float32Array(1 << 18), i: new Int32Array(1 << 18), n: 0,
  push(key, id) { let n = this.n++; if (n >= this.k.length) { this.n--; return; } while (n > 0) { const p = (n - 1) >> 1; if (this.k[p] <= key) break; this.k[n] = this.k[p]; this.i[n] = this.i[p]; n = p; } this.k[n] = key; this.i[n] = id; },
  pop() { const top = this.i[0], k = this.k[--this.n], id = this.i[this.n]; let n = 0; while (true) { let c = 2 * n + 1; if (c >= this.n) break; if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++; if (this.k[c] >= k) break; this.k[n] = this.k[c]; this.i[n] = this.i[c]; n = c; } this.k[n] = k; this.i[n] = id; return top; } };
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
function astar(s, g, r, F, block, maxN, wide) {
  stamp++; heap.n = 0; const gi = g % W, gj = (g / W) | 0, need = r + CS * .5;
  const h = c => { const dx = Math.abs(c % W - gi), dz = Math.abs(((c / W) | 0) - gj); return (Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)) * CS; };
  gS[s] = 0; seen[s] = stamp; came[s] = -1; heap.push(h(s), s); let n = 0;
  while (heap.n) {
    const c = heap.pop(); if (shut[c] === stamp) continue; shut[c] = stamp; if (c === g) return true; if (++n > (maxN || 60000)) return false;
    const ci = c % W, cj = (c / W) | 0;
    for (const [di, dj, l] of NB) {
      const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const nc = nj * W + ni;
      if (shut[nc] === stamp) continue;
      const room = F[nc]; if (room < need && nc !== g) continue;
      if (di && dj && (F[cj * W + ni] < need || F[nj * W + ci] < need)) continue;                         // no squeezing diagonally past a corner
      if (block && block[nc]) continue;
      const ng = gS[c] + l * CS * (1 + .9 * Math.max(0, 1.6 - (room - r)) / 1.6 + (wide ? 1.5 * Math.max(0, wide - room) / wide : 0));   // dearer close to things (for a vehicle: anywhere it has no room to turn)
      if (seen[nc] !== stamp || ng < gS[nc]) { seen[nc] = stamp; gS[nc] = ng; came[nc] = c; heap.push(ng + h(nc), nc); }
    }
  }
  return false;
}
const ctr = c => [X0 + (c % W + .5) * CS, Z0 + (((c / W) | 0) + .5) * CS];
/* string pulling: from each corner jump to the farthest later point still in a clear straight line. With turnR (a vehicle), the corner
   is the farthest such point that also has turnR of room round it, so the hull can swing round there, when there is one */
function pull(pts, r, stat, turnR) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]], last = pts.length - 1; let i = 0;
  while (i < last) {
    let far = -1, room = -1;
    for (let j = last; j > i + 1; j--) {
      if (!N.lineClear(pts[i][0], pts[i][1], pts[j][0], pts[j][1], r, stat)) continue;
      if (far < 0) far = j;
      if (!turnR || j === last || N.clear(pts[j][0], pts[j][1], stat) >= turnR) { room = j; break; }
      if (far - j > 90) break;
    }
    const k = room > i ? room : far > i ? far : i + 1; out.push(pts[k]); i = k;
  }
  return out;
}
N.pull = pull;
/* a route for a mover of radius r from (x0, z0) to (x1, z1). The ends are moved to the nearest spot with room if they have none.
   Returns [[x, z], …] (start and end included) or null. opt.stat: static things only; opt.extra: shapes to treat as solid this time;
   opt.turn: room a vehicle needs to turn on the spot (its corners go where it has it, its route keeps to open ground where it can) */
N.path = function (x0, z0, x1, z1, r, opt) {
  opt = opt || {};
  if (!N.ready) return [[x0, z0], [x1, z1]];
  let F = opt.stat ? distS : dist;
  let block = null;
  if (opt.extra && opt.extra.length) { block = N._blk || (N._blk = new Uint8Array(SZ)); block.fill(0); for (const sh of opt.extra) paint(block, Object.assign({}, sh, sh.t === 'c' ? { r: sh.r + r } : sh.t === 's' ? { r: sh.r + r } : { hx: sh.hx + r, hz: sh.hz + r })); }
  const a = N.clear(x0, z0, opt.stat) >= r ? [x0, z0] : (N.free(x0, z0, r, 8) || [x0, z0]);
  const b = N.clear(x1, z1, opt.stat) >= r && !(block && block[cell(x1, z1)]) ? [x1, z1] : N.free(x1, z1, r, opt.endR || 10, block ? (x, z) => !block[cell(x, z)] : null);
  if (!b) return null;
  const s = cell(a[0], a[1]), g = cell(b[0], b[1]); if (s < 0 || g < 0) return [a, b];
  if (s === g || (!block && N.lineClear(a[0], a[1], b[0], b[1], r, opt.stat))) return [[x0, z0], a !== null && (a[0] !== x0 || a[1] !== z0) ? a : null, b].filter(Boolean);
  const ok = astar(s, g, r, F, block, opt.maxN, opt.turn); if (!ok) return null;
  const cells = []; for (let c = g; c !== -1; c = came[c]) cells.push(c); cells.reverse();
  const pts = cells.map(ctr); pts[0] = a; pts[pts.length - 1] = b;
  const P = pull(pts, r, opt.stat, opt.turn);
  if (a[0] !== x0 || a[1] !== z0) P.unshift([x0, z0]);
  return P;
};
/* ---- flow fields: cost to reach one goal from every cell, for many movers heading to the same place (troops falling back) */
const flows = new Map();
N.flow = function (key, gx, gz, r) {
  let fl = flows.get(key); if (fl && fl.ver === N.ver) return fl;
  const C = (fl && fl.C) || new Float32Array(SZ); C.fill(Infinity);
  const need = r + CS * .5, g0 = N.free(gx, gz, r, 10) || [gx, gz], g = cell(g0[0], g0[1]); if (g < 0) return null;
  stamp++; heap.n = 0; C[g] = 0; heap.push(0, g);
  while (heap.n) { const c = heap.pop(); if (shut[c] === stamp) continue; shut[c] = stamp; const ci = c % W, cj = (c / W) | 0;
    for (const [di, dj, l] of NB) { const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const nc = nj * W + ni; if (shut[nc] === stamp || dist[nc] < need) continue; if (di && dj && (dist[cj * W + ni] < need || dist[nj * W + ci] < need)) continue; const ng = C[c] + l * CS * (1 + .9 * Math.max(0, 1.6 - (dist[nc] - r)) / 1.6); if (ng < C[nc]) { C[nc] = ng; heap.push(ng, nc); } } }
  fl = { C, ver: N.ver, g: g0, r }; flows.set(key, fl); return fl;
};
/* route down a flow field from (x, z) to its goal */
N.flowPath = function (fl, x, z) {
  if (!fl) return null; let a = [x, z]; if (N.clear(x, z) < fl.r) a = N.free(x, z, fl.r, 8) || a;
  let c = cell(a[0], a[1]); if (c < 0 || !isFinite(fl.C[c])) return null;
  const pts = [a]; let n = 0;
  while (fl.C[c] > 0 && n++ < 4000) { const ci = c % W, cj = (c / W) | 0; let best = c, bv = fl.C[c]; for (const [di, dj] of NB) { const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const nc = nj * W + ni; if (fl.C[nc] < bv) { bv = fl.C[nc]; best = nc; } } if (best === c) break; c = best; pts.push(ctr(c)); }
  pts.push(fl.g);
  const P = pull(pts, fl.r); if (a[0] !== x || a[1] !== z) P.unshift([x, z]); return P;
};
/* two oriented boxes (x, z, half length, half width, heading as three.js rotateY) overlap, with pad metres of margin each */
N.obb = function (ax, az, ah, ahx, ahz, bx, bz, bh, bhx, bhz, pad) {
  pad = pad || 0; ahx += pad; ahz += pad; bhx += pad; bhz += pad;
  const A = [[Math.cos(ah), -Math.sin(ah)], [Math.sin(ah), Math.cos(ah)]], Bv = [[Math.cos(bh), -Math.sin(bh)], [Math.sin(bh), Math.cos(bh)]], dx = bx - ax, dz = bz - az;
  for (const u of [A[0], A[1], Bv[0], Bv[1]]) {
    const ra = ahx * Math.abs(A[0][0] * u[0] + A[0][1] * u[1]) + ahz * Math.abs(A[1][0] * u[0] + A[1][1] * u[1]);
    const rb = bhx * Math.abs(Bv[0][0] * u[0] + Bv[0][1] * u[1]) + bhz * Math.abs(Bv[1][0] * u[0] + Bv[1][1] * u[1]);
    if (Math.abs(dx * u[0] + dz * u[1]) > ra + rb) return false;
  }
  return true;
};
/* a point inside an oriented box grown by pad */
N.inBox = function (x, z, bx, bz, bh, hx, hz, pad) { const dx = x - bx, dz = z - bz, c = Math.cos(bh), s = Math.sin(bh), lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) <= hx + (pad || 0) && Math.abs(lz) <= hz + (pad || 0); };
/* ---- debugging and tests: which static shapes overlap each other */
N.overlaps = function (pad) {
  const out = [];
  for (let i = 0; i < statics.length; i++) for (let j = i + 1; j < statics.length; j++) {
    const A = statics[i], B = statics[j]; if (A.tag && B.tag && A.tag.split(':')[0] === B.tag.split(':')[0] && A.group && A.group === B.group) continue;
    const a = bounds(A), b = bounds(B); if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) continue;
    let hit = false; for (let x = Math.max(a[0], b[0]); x <= Math.min(a[2], b[2]) && !hit; x += .25) for (let z = Math.max(a[1], b[1]); z <= Math.min(a[3], b[3]) && !hit; z += .25) if (inShape(A, x, z, pad || 0) && inShape(B, x, z, pad || 0)) hit = true;
    if (hit) out.push([A.tag, B.tag, Math.round((a[0] + a[2]) / 2), Math.round((a[1] + a[3]) / 2), Math.round((b[0] + b[2]) / 2), Math.round((b[1] + b[3]) / 2)]);
  }
  return out;
};
})();
