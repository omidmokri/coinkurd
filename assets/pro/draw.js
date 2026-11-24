/* entekhab.net — /market/ drawing tools.
   A drawing is { id, k: tool, pts: [{ t: unix seconds, p: price }], s: style, lk: locked, hd: hidden }.
   Anchors are stored by TIME and PRICE (not by bar index), so a line drawn on 1h shows in the same place on 4h or 5m,
   and points to the right of the last candle (the future) keep their place as new candles arrive.
   Everything is painted by one Lightweight Charts primitive per chart (so drawings follow zoom/scroll for free);
   pointer handling sits on the chart element in the capture phase and only keeps an event from the chart when it
   creates, selects or drags a drawing. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  var TOOLS = {
    trend: { n: 2 }, ray: { n: 2 }, ext: { n: 2 }, hline: { n: 1 }, hray: { n: 1 }, vline: { n: 1 }, arrow: { n: 2 },
    channel: { n: 3 }, rect: { n: 2 }, circle: { n: 2 }, fib: { n: 2 }, fibext: { n: 3 }, gann: { n: 2 }, pitch: { n: 3 },
    text: { n: 1 }, measure: { n: 2 }, long: { n: 1 }, short: { n: 1 }, brush: { n: -1 },
    /* n: anchors to click; -1 a free-hand stroke; -2 click point after point, click the last point again to finish */
    info: { n: 2 }, angle: { n: 2 }, cross: { n: 1 }, regress: { n: 2 }, flat: { n: 3 }, disjoint: { n: 4 },
    schiff: { n: 3 }, mschiff: { n: 3 }, inside: { n: 3 },
    fibch: { n: 3 }, fibtz: { n: 2 }, fibfan: { n: 2 }, fibtime: { n: 3 }, fibcirc: { n: 2 }, fibspiral: { n: 2 }, fibarc: { n: 2 }, fibwedge: { n: 3 }, pitchfan: { n: 3 },
    gannbox: { n: 2 }, gannsq: { n: 2 },
    xabcd: { n: 5 }, cypher: { n: 5 }, hs: { n: 7 }, abcd: { n: 4 }, tri: { n: 4 }, drives: { n: 6 },
    ewimp: { n: 6 }, ewcor: { n: 4 }, ewtri: { n: 6 }, ewdbl: { n: 4 }, ewtrp: { n: 6 }, cyclic: { n: 2 }, tcycle: { n: 2 }, sine: { n: 2 },
    forecast: { n: 2 }, proj: { n: 3 }, avwap: { n: 1 }, vrp: { n: 2 }, prange: { n: 2 }, drange: { n: 2 },
    hl: { n: -1 }, arrowmk: { n: 2 }, arrowup: { n: 1 }, arrowdn: { n: 1 }, rrect: { n: 3 }, path: { n: -2 }, circ: { n: 2 }, poly: { n: -2 }, tri3: { n: 3 }, arc: { n: 3 }, curve: { n: 3 }, dcurve: { n: 3 },
    note: { n: 1 }, signpost: { n: 1 }, callout: { n: 2 }, comment: { n: 1 }, plabel: { n: 1 }, pnote: { n: 2 }, flag: { n: 1 }, emoji: { n: 1 },
    zoom: { n: 2, tmp: 1 }
  };
  /* tools whose words the visitor types (double click edits them) */
  var TEXTY = { text: 1, rect: 1, hline: 1, hray: 1, note: 1, signpost: 1, callout: 1, comment: 1, plabel: 1, pnote: 1, flag: 1, arrowup: 1, arrowdn: 1 };
  var ASKTEXT = { text: 1, note: 1, callout: 1, comment: 1, signpost: 1 };
  var FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618];
  var FIBX = [0, 0.382, 0.618, 1, 1.272, 1.618, 2, 2.618];
  var FIBC = ['#9ca3af', '#f87171', '#fb923c', '#facc15', '#34d399', '#22d3ee', '#9ca3af', '#a78bfa', '#60a5fa', '#f472b6'];
  var GANN = [[8, '8/1'], [4, '4/1'], [3, '3/1'], [2, '2/1'], [1, '1/1'], [1 / 2, '1/2'], [1 / 3, '1/3'], [1 / 4, '1/4'], [1 / 8, '1/8']];
  var DEF = { c: '#f7931a', w: 2, d: 0 };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  /* ---------------------------------------------------------------- time <-> logical index (works left of the data and in the future) */
  function t2l(bars, t, sec) {
    var n = bars.length; if (!n) return null;
    if (t <= bars[0].t) return (t - bars[0].t) / sec;
    var last = bars[n - 1].t; if (t >= last) return n - 1 + (t - last) / sec;
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (bars[m].t <= t) lo = m; else hi = m; }
    return lo + (t - bars[lo].t) / (bars[hi].t - bars[lo].t);
  }
  function l2t(bars, lg, sec) {
    var n = bars.length; if (!n) return null;
    if (lg <= 0) return bars[0].t + lg * sec;
    if (lg >= n - 1) return bars[n - 1].t + (lg - (n - 1)) * sec;
    var i = Math.floor(lg); return bars[i].t + (lg - i) * (bars[i + 1].t - bars[i].t);
  }

  /* ---------------------------------------------------------------- geometry helpers (pixels) */
  function dseg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, u = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
    u = Math.max(0, Math.min(1, u)); var x = ax + u * dx, y = ay + u * dy; return Math.hypot(px - x, py - y);
  }
  /* extend A→B to the frame [0,W]x[0,H]: returns the far point (and the near one when both ways) */
  function toEdge(ax, ay, bx, by, W, H) {
    var dx = bx - ax, dy = by - ay, ts = [], far = 1;
    if (dx) ts.push((0 - ax) / dx, (W - ax) / dx);
    if (dy) ts.push((0 - ay) / dy, (H - ay) / dy);
    /* the exit point: the farthest crossing of the frame's border that is still on the frame */
    ts.forEach(function (t) { if (t > far) { var x = ax + t * dx, y = ay + t * dy; if (x >= -1 && x <= W + 1 && y >= -1 && y <= H + 1) far = t; } });
    return [ax + far * dx, ay + far * dy];
  }
  function dash(ctx, d) { ctx.setLineDash(d === 1 ? [6, 4] : d === 2 ? [2, 3] : []); }
  function rgba(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex;
    var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function label(ctx, txt, x, y, bg, fg, align) {
    ctx.font = '600 11px Vazirmatn, Tahoma, sans-serif';
    var w = ctx.measureText(txt).width + 10, h = 18, x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    ctx.fillStyle = bg; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y - h / 2, w, h, 4); else ctx.rect(x0, y - h / 2, w, h); ctx.fill();
    ctx.fillStyle = fg || '#0b0b0c'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(txt, x0 + 5, y + 0.5);
    return w;
  }
  function pct(a, b) { return a ? ((b / a - 1) * 100) : 0; }
  function iso(t) { return '\u2066' + t + '\u2069'; }          /* a left-to-right island (numbers, %, +) inside any text */

  /* ================================================================ the rest of TradingView's left toolbar.
     Each of these builds a list of plain drawing operations (g.ops) from its anchors; one painter and one
     hit-tester serve them all, so a new tool is just its geometry. */
  var LV = {
    fibch: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618], fibtz: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
    fibfan: [0.25, 0.382, 0.5, 0.618, 0.75, 1], fibtime: [0, 0.382, 0.5, 0.618, 1, 1.382, 1.618, 2, 2.382, 2.618, 3, 3.618, 4.236],
    fibcirc: [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618], fibarc: [0.236, 0.382, 0.5, 0.618, 0.786, 1], fibwedge: [0.236, 0.382, 0.5, 0.618, 0.786, 1],
    pitchfan: [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1], gannbox: [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1]
  };
  var LAB = { ewimp: ['0', '1', '2', '3', '4', '5'], ewcor: ['0', 'A', 'B', 'C'], ewtri: ['0', 'A', 'B', 'C', 'D', 'E'], ewdbl: ['0', 'W', 'X', 'Y'], ewtrp: ['0', 'W', 'X', 'Y', 'X', 'Z'],
    xabcd: ['X', 'A', 'B', 'C', 'D'], cypher: ['X', 'A', 'B', 'C', 'D'], abcd: ['A', 'B', 'C', 'D'], tri: ['A', 'B', 'C', 'D'], drives: ['0', '1', 'A', '2', 'B', '3'], hs: ['', 'LS', '', 'H', '', 'RS', ''] };
  function lvOf(k, s) { return s.lv && s.lv.length ? s.lv : LV[k]; }
  function sample(f, n) { var out = []; for (var i = 0; i <= n; i++) { var q = f(i / n); if (q && isFinite(q[0]) && isFinite(q[1])) out.push(q); } return out; }
  function ell(cx, cy, rx, ry, a0, a1) { return sample(function (u) { var a = a0 + (a1 - a0) * u; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; }, 72); }
  function isTop(P, i) {                                    /* is this anchor a peak (label above it) */
    var y = P[i].y, pv = P[i - 1], nx = P[i + 1];
    if (pv && nx) return y <= pv.y && y <= nx.y ? true : y >= pv.y && y >= nx.y ? false : y < (pv.y + nx.y) / 2;
    var o = pv || nx; return o ? y < o.y : true;
  }
  function tfCat(sec) { return sec < 60 ? 'S' : sec < 3600 ? 'm' : sec < 86400 ? 'h' : sec < 604800 ? 'D' : sec < 2592000 ? 'W' : 'M'; }

  var GEO = {}, P_ = P;
  P.big = P.big || function (v) { var a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v)); };
  function L(g, x0, y0, x1, y1, o) { var op = { t: 'l', p: [x0, y0, x1, y1] }; if (o) for (var k in o) op[k] = o[k]; g.ops.push(op); return op; }
  function PL(g, pts, o) { var op = { t: 'pl', p: pts }; if (o) for (var k in o) op[k] = o[k]; g.ops.push(op); return op; }
  function LAB_(g, s, x, y, o) { var op = { t: 'lab', s: s, x: x, y: y }; if (o) for (var k in o) op[k] = o[k]; g.ops.push(op); return op; }
  function RAY(g, A, B, mode, W, H, o) {
    if (!A || !B || A.y == null || B.y == null) return;
    var E = mode ? toEdge(A.x, A.y, B.x, B.y, W, H) : [B.x, B.y], S = mode === 2 ? toEdge(B.x, B.y, A.x, A.y, W, H) : [A.x, A.y];
    return L(g, S[0], S[1], E[0], E[1], o);
  }
  function ok(p) { return p && p.x != null && p.y != null; }

  /* ---- lines */
  GEO.info = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; RAY(g, a, b, s.r ? 1 : 0, W, H);
    var p0 = d.pts[0], p1 = d.pts[1], bars = D.o.bars(), sec = D.o.sec(), nb = Math.round(t2l(bars, p1.t, sec) - t2l(bars, p0.t, sec));
    var ang = Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI, up = p1.p >= p0.p;
    LAB_(g, iso((up ? '+' : '') + D.o.fmt(p1.p - p0.p) + ' (' + (up ? '+' : '') + pct(p0.p, p1.p).toFixed(2) + '%)') + ' · ' + iso(String(Math.abs(nb))) + ' ' + D.o.T('bars') + ' · ' + iso(P_.dur(p1.t - p0.t)) + ' · ' + iso(ang.toFixed(1) + '°'),
      b.x + 8, b.y, { align: 'left' });
  };
  GEO.angle = function (D, d, g, P, W, H) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; L(g, a.x, a.y, b.x, b.y);
    var r = Math.max(24, Math.min(70, Math.hypot(b.x - a.x, b.y - a.y) * 0.4)), dir = b.x >= a.x ? 1 : -1, ang = Math.atan2(b.y - a.y, b.x - a.x);
    L(g, a.x, a.y, a.x + dir * r * 1.4, a.y, { d: 1, ga: 0.7 });
    var base = dir > 0 ? 0 : Math.PI; PL(g, ell(a.x, a.y, r, r, Math.min(base, ang), Math.max(base, ang)), { ga: 0.8 });
    var deg = Math.atan2(a.y - b.y, Math.abs(b.x - a.x)) * 180 / Math.PI;
    LAB_(g, iso(deg.toFixed(1) + '°'), a.x + dir * (r + 8), a.y + (b.y < a.y ? -12 : 12), { align: dir > 0 ? 'left' : 'right' });
  };
  GEO.cross = function (D, d, g, P, W, H) { var a = P[0]; if (!ok(a)) return; L(g, 0, a.y, W, a.y); L(g, a.x, 0, a.x, H); };

  /* ---- channels */
  GEO.regress = function (D, d, g, P, W, H, s) {
    var bars = D.o.bars(), t0 = Math.min(d.pts[0].t, d.pts[1].t), t1 = Math.max(d.pts[0].t, d.pts[1].t), xs = [], ys = [], i;
    for (i = 0; i < bars.length; i++) if (bars[i].t >= t0 && bars[i].t <= t1) { xs.push(i); ys.push(bars[i].c); }
    var n = xs.length; if (n < 2) { if (ok(P[0]) && ok(P[1])) L(g, P[0].x, P[0].y, P[1].x, P[1].y, { d: 1 }); return; }
    var mx = 0, my = 0; for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
    var sxy = 0, sxx = 0; for (i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    var m = sxx ? sxy / sxx : 0, c = my - m * mx, sd = 0; for (i = 0; i < n; i++) { var e = ys[i] - (m * xs[i] + c); sd += e * e; } sd = Math.sqrt(sd / n);
    var dv = s.dv || 2, ts = D.o.chart.timeScale(), x0 = ts.logicalToCoordinate(xs[0]), x1 = ts.logicalToCoordinate(xs[n - 1]), se = D.o.series;
    function ln(off) { var A = { x: x0, y: se.priceToCoordinate(m * xs[0] + c + off) }, B = { x: x1, y: se.priceToCoordinate(m * xs[n - 1] + c + off) }; return [A, B]; }
    var U = ln(dv * sd), M = ln(0), Lo = ln(-dv * sd);
    if (!ok(U[0]) || !ok(Lo[1]) || x0 == null || x1 == null) return;
    var mode = s.r ? 1 : 0, u = RAY(g, U[0], U[1], mode, W, H), lo = RAY(g, Lo[0], Lo[1], mode, W, H); RAY(g, M[0], M[1], mode, W, H, { d: 1 });
    if (u && lo) g.ops.unshift({ t: 'pl', p: [[u.p[0], u.p[1]], [u.p[2], u.p[3]], [lo.p[2], lo.p[3]], [lo.p[0], lo.p[1]]], fill: 0.07, nostroke: 1 });
    LAB_(g, iso('σ ' + D.o.fmt(sd) + ' · ×' + dv), x1 + 6, U[1].y, { align: 'left' });
  };
  GEO.flat = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1], c = P[2]; if (!ok(a) || !ok(b)) return; var m = s.r ? 1 : 0; RAY(g, a, b, m, W, H); if (!ok(c)) return;
    var xe = m ? W : b.x; L(g, a.x, c.y, xe, c.y);
    var top = RAY({ ops: [] }, a, b, m, W, H) || { p: [a.x, a.y, b.x, b.y] };
    g.ops.unshift({ t: 'pl', p: [[top.p[0], top.p[1]], [top.p[2], top.p[3]], [xe, c.y], [a.x, c.y]], fill: 0.08, nostroke: 1 });
  };
  GEO.disjoint = function (D, d, g, P, W, H) {
    var a = P[0], b = P[1], c = P[2], e = P[3]; if (!ok(a) || !ok(b)) return; L(g, a.x, a.y, b.x, b.y); if (!ok(c)) return;
    if (ok(e)) { L(g, c.x, c.y, e.x, e.y); g.ops.unshift({ t: 'pl', p: [[a.x, a.y], [b.x, b.y], [e.x, e.y], [c.x, c.y]], fill: 0.08, nostroke: 1 }); }
  };

  /* ---- pitchforks: Andrews (in pitch above), Schiff, modified Schiff, inside */
  function fork(D, d, g, W, H, O) {
    var a = d.pts[1], b = d.pts[2], M = { t: (a.t + b.t) / 2, p: (a.p + b.p) / 2 }, o = D.toPx(O), m = D.toPx(M), pa = D.toPx(a), pb = D.toPx(b);
    if (!ok(o) || !ok(m) || !ok(pa) || !ok(pb)) return;
    var dT = M.t - O.t, dP = M.p - O.p, u1 = D.toPx({ t: a.t + dT, p: a.p + dP }), u2 = D.toPx({ t: b.t + dT, p: b.p + dP });
    var l0 = RAY(g, o, m, 1, W, H), l1 = RAY(g, pa, u1, 1, W, H), l2 = RAY(g, pb, u2, 1, W, H); L(g, pa.x, pa.y, pb.x, pb.y);
    if (ok(D.toPx(d.pts[0])) && (O.t !== d.pts[0].t || O.p !== d.pts[0].p)) { var p0 = D.toPx(d.pts[0]); L(g, p0.x, p0.y, o.x, o.y, { d: 1, ga: 0.6 }); }
    if (l1 && l2) g.ops.unshift({ t: 'pl', p: [[l1.p[0], l1.p[1]], [l1.p[2], l1.p[3]], [l2.p[2], l2.p[3]], [l2.p[0], l2.p[1]]], fill: 0.07, nostroke: 1 });
    return l0;
  }
  GEO.schiff = function (D, d, g, P, W, H) { if (d.pts.length < 3) return; fork(D, d, g, W, H, { t: d.pts[0].t, p: (d.pts[0].p + d.pts[1].p) / 2 }); };
  GEO.mschiff = function (D, d, g, P, W, H) { if (d.pts.length < 3) return; fork(D, d, g, W, H, { t: (d.pts[0].t + d.pts[1].t) / 2, p: (d.pts[0].p + d.pts[1].p) / 2 }); };
  GEO.inside = function (D, d, g, P, W, H) {
    if (d.pts.length < 3) return; var A = d.pts[0], B = d.pts[1], C = d.pts[2], M = { t: (B.t + C.t) / 2, p: (B.p + C.p) / 2 };
    var o = D.toPx(A), m = D.toPx(M); if (!ok(o) || !ok(m)) return; RAY(g, o, m, 1, W, H);
    var dT = M.t - A.t, dP = M.p - A.p, b1 = { t: (A.t + B.t) / 2, p: (A.p + B.p) / 2 }, c1 = { t: (A.t + C.t) / 2, p: (A.p + C.p) / 2 };
    var l1 = RAY(g, D.toPx(b1), D.toPx({ t: b1.t + dT, p: b1.p + dP }), 1, W, H), l2 = RAY(g, D.toPx(c1), D.toPx({ t: c1.t + dT, p: c1.p + dP }), 1, W, H);
    var pb = D.toPx(B), pc = D.toPx(C); if (ok(pb) && ok(pc)) { L(g, o.x, o.y, pb.x, pb.y, { d: 1, ga: 0.6 }); L(g, o.x, o.y, pc.x, pc.y, { d: 1, ga: 0.6 }); L(g, pb.x, pb.y, pc.x, pc.y, { d: 1, ga: 0.6 }); }
    if (l1 && l2) g.ops.unshift({ t: 'pl', p: [[l1.p[0], l1.p[1]], [l1.p[2], l1.p[3]], [l2.p[2], l2.p[3]], [l2.p[0], l2.p[1]]], fill: 0.07, nostroke: 1 });
  };

  /* ---- Fibonacci and Gann */
  GEO.fibch = function (D, d, g, P, W, H, s) {
    if (d.pts.length < 3) return; var A = d.pts[0], B = d.pts[1], C = d.pts[2], tB = B.t - A.t, at = tB ? A.p + (B.p - A.p) * (C.t - A.t) / tB : A.p, off = C.p - at, prev = null;
    lvOf('fibch', s).forEach(function (r, i) {
      var l = RAY(g, D.toPx({ t: A.t, p: A.p + off * r }), D.toPx({ t: B.t, p: B.p + off * r }), s.r ? 1 : 0, W, H, { c: FIBC[i % FIBC.length], w: 1 });
      if (!l) return; LAB_(g, iso(String(r)), l.p[0] - 4, l.p[1], { align: 'right', bg: rgba(FIBC[i % FIBC.length], 0.85) });
      if (prev) g.ops.unshift({ t: 'pl', p: [[prev.p[0], prev.p[1]], [prev.p[2], prev.p[3]], [l.p[2], l.p[3]], [l.p[0], l.p[1]]], fill: 0.05, c: FIBC[i % FIBC.length], nostroke: 1 });
      prev = l;
    });
  };
  function vlines(D, g, H, t0, dt, lv, top) {
    lv.forEach(function (r, i) { var q = D.toPx({ t: Math.round(t0 + dt * r), p: null }); if (!q || q.x == null) return; var c = FIBC[i % FIBC.length]; L(g, q.x, 0, q.x, H, { c: c, w: 1 }); LAB_(g, iso(String(r)), q.x + 3, top, { align: 'left', bg: rgba(c, 0.85) }); });
  }
  GEO.fibtz = function (D, d, g, P, W, H, s) { var dt = d.pts[1].t - d.pts[0].t || D.o.sec(); vlines(D, g, H, d.pts[0].t, dt, lvOf('fibtz', s), 14); };
  GEO.fibtime = function (D, d, g, P, W, H, s) {
    if (d.pts.length < 3) { if (ok(P[0]) && ok(P[1])) L(g, P[0].x, P[0].y, P[1].x, P[1].y, { d: 1 }); return; }
    var dt = d.pts[1].t - d.pts[0].t || D.o.sec(); vlines(D, g, H, d.pts[2].t, dt, lvOf('fibtime', s), 14);
    if (ok(P[0]) && ok(P[1]) && ok(P[2])) PL(g, [[P[0].x, P[0].y], [P[1].x, P[1].y], [P[2].x, P[2].y]], { d: 1, ga: 0.7 });
  };
  GEO.fibfan = function (D, d, g, P, W, H, s) {
    var a = P[0], A = d.pts[0], B = d.pts[1]; if (!ok(a) || !ok(P[1])) return; var b = P[1];
    g.ops.push({ t: 'pl', p: [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]], close: 1, w: 1, ga: 0.35 });
    lvOf('fibfan', s).forEach(function (r, i) {
      var c = FIBC[(i + 1) % FIBC.length], q1 = D.toPx({ t: B.t, p: A.p + (B.p - A.p) * r }), q2 = D.toPx({ t: Math.round(A.t + (B.t - A.t) * r), p: B.p });
      RAY(g, a, q1, 1, W, H, { c: c, w: 1 }); if (r !== 1) RAY(g, a, q2, 1, W, H, { c: c, w: 1, d: 2 });
      if (ok(q1)) LAB_(g, iso(String(r)), b.x + 4, q1.y, { align: 'left', bg: rgba(c, 0.85) });
    });
  };
  GEO.fibcirc = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var R = Math.hypot(b.x - a.x, b.y - a.y); L(g, a.x, a.y, b.x, b.y, { d: 1, ga: 0.6 });
    lvOf('fibcirc', s).forEach(function (r, i) { var c = FIBC[i % FIBC.length]; PL(g, ell(a.x, a.y, R * r, R * r, 0, Math.PI * 2), { c: c, w: 1 }); LAB_(g, iso(String(r)), a.x + R * r + 2, a.y, { align: 'left', bg: rgba(c, 0.85) }); });
  };
  GEO.fibarc = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var R = Math.hypot(b.x - a.x, b.y - a.y), th = Math.atan2(a.y - b.y, a.x - b.x);
    L(g, a.x, a.y, b.x, b.y, { d: 1, ga: 0.6 });
    lvOf('fibarc', s).forEach(function (r, i) { var c = FIBC[i % FIBC.length]; PL(g, ell(b.x, b.y, R * r, R * r, th - Math.PI / 2, th + Math.PI / 2), { c: c, w: 1 }); LAB_(g, iso(String(r)), b.x + R * r * Math.cos(th), b.y + R * r * Math.sin(th), { align: 'center', bg: rgba(c, 0.85) }); });
  };
  GEO.fibwedge = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1], c = P[2]; if (!ok(a) || !ok(b)) return; L(g, a.x, a.y, b.x, b.y); if (!ok(c)) return;
    var R = Math.hypot(b.x - a.x, b.y - a.y), t1 = Math.atan2(b.y - a.y, b.x - a.x), t2 = Math.atan2(c.y - a.y, c.x - a.x);
    if (t2 - t1 > Math.PI) t2 -= 2 * Math.PI; if (t1 - t2 > Math.PI) t2 += 2 * Math.PI;
    L(g, a.x, a.y, a.x + R * Math.cos(t2), a.y + R * Math.sin(t2));
    lvOf('fibwedge', s).forEach(function (r, i) { var col = FIBC[i % FIBC.length]; PL(g, ell(a.x, a.y, R * r, R * r, t1, t2), { c: col, w: 1 }); LAB_(g, iso(String(r)), a.x + R * r * Math.cos(t1), a.y + R * r * Math.sin(t1), { align: 'center', bg: rgba(col, 0.85) }); });
  };
  GEO.fibspiral = function (D, d, g, P, W, H) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var R = Math.hypot(b.x - a.x, b.y - a.y); if (R < 1) return;
    var th0 = Math.atan2(b.y - a.y, b.x - a.x), phi = 1.6180339887, lim = 3 * Math.max(W, H), pts = [];
    for (var k = -720; k <= 720; k++) { var th = k * Math.PI / 90, r = R * Math.pow(phi, th / (Math.PI / 2)); if (r < 0.5) continue; if (r > lim) break; pts.push([a.x + r * Math.cos(th0 - th), a.y + r * Math.sin(th0 - th)]); }
    PL(g, pts); L(g, a.x, a.y, b.x, b.y, { d: 1, ga: 0.6 });
  };
  GEO.pitchfan = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1], c = P[2]; if (!ok(a) || !ok(b)) return; L(g, a.x, a.y, b.x, b.y, { d: 1, ga: 0.6 }); if (!ok(c)) return; L(g, b.x, b.y, c.x, c.y, { d: 1, ga: 0.6 });
    lvOf('pitchfan', s).forEach(function (r, i) { var q = { x: b.x + (c.x - b.x) * r, y: b.y + (c.y - b.y) * r }, col = FIBC[i % FIBC.length]; RAY(g, a, q, 1, W, H, { c: col, w: 1 }); LAB_(g, iso(String(r)), q.x + 4, q.y, { align: 'left', bg: rgba(col, 0.85) }); });
  };
  GEO.gannbox = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var lv = lvOf('gannbox', s);
    lv.forEach(function (r, i) {
      var c = FIBC[i % FIBC.length], x = a.x + (b.x - a.x) * r, y = a.y + (b.y - a.y) * r;
      L(g, x, a.y, x, b.y, { c: c, w: 1 }); L(g, a.x, y, b.x, y, { c: c, w: 1 });
      LAB_(g, iso(String(r)), x, Math.min(a.y, b.y) - 10, { align: 'center', bg: rgba(c, 0.85) }); LAB_(g, iso(String(r)), Math.min(a.x, b.x) - 4, y, { align: 'right', bg: rgba(c, 0.85) });
    });
    L(g, a.x, a.y, b.x, b.y, { d: 1, ga: 0.7 }); L(g, a.x, b.y, b.x, a.y, { d: 1, ga: 0.7 });
    g.ops.unshift({ t: 'pl', p: [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]], fill: 0.05, nostroke: 1 });
  };
  GEO.gannsq = function (D, d, g, P, W, H) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var dx = b.x - a.x, dy = b.y - a.y, sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1, i;
    for (i = 0; i <= 4; i++) { var c = FIBC[i % FIBC.length]; L(g, a.x + dx * i / 4, a.y, a.x + dx * i / 4, b.y, { c: c, w: 1, ga: 0.8 }); L(g, a.x, a.y + dy * i / 4, b.x, a.y + dy * i / 4, { c: c, w: 1, ga: 0.8 }); }
    L(g, a.x, a.y, b.x, b.y); L(g, a.x, b.y, b.x, a.y);
    for (i = 1; i <= 3; i++) { L(g, a.x, a.y, b.x, a.y + dy * i / 4, { w: 1, ga: 0.6, d: 2 }); L(g, a.x, a.y, a.x + dx * i / 4, b.y, { w: 1, ga: 0.6, d: 2 }); }
    for (i = 1; i <= 4; i++) { var rx = Math.abs(dx) * i / 4, ry = Math.abs(dy) * i / 4; PL(g, sample(function (u) { var t = u * Math.PI / 2; return [a.x + sx * rx * Math.cos(t), a.y + sy * ry * Math.sin(t)]; }, 40), { w: 1, ga: 0.5 }); }
    g.ops.unshift({ t: 'pl', p: [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]], fill: 0.05, nostroke: 1 });
  };

  /* ---- chart patterns and Elliott waves: a zigzag through the anchors, with letters and the ratios between legs */
  function zig(D, d, g, P, names, circled) {
    var pts = P.filter(ok); if (pts.length < 2) return; PL(g, pts.map(function (p) { return [p.x, p.y]; }));
    P.forEach(function (p, i) { if (!ok(p) || !names[i]) return; var up = isTop(P, i); g.ops.push({ t: circled ? 'circ' : 'lab', s: names[i], x: p.x, y: p.y + (up ? -16 : 16), align: 'center' }); });
  }
  function ratio(d, i, j, k, l) { var A = d.pts[i], B = d.pts[j], C = d.pts[k], E = d.pts[l]; if (!A || !B || !C || !E) return null; var q = Math.abs(A.p - B.p); return q ? Math.abs(C.p - E.p) / q : null; }
  function rline(g, P, i, j, r) { if (!ok(P[i]) || !ok(P[j]) || r == null) return; L(g, P[i].x, P[i].y, P[j].x, P[j].y, { d: 1, ga: 0.7, w: 1 }); LAB_(g, iso(r.toFixed(3)), (P[i].x + P[j].x) / 2, (P[i].y + P[j].y) / 2, { align: 'center', bg: '#2a2a2f', fg: '#e5e7eb' }); }
  function harmonic(D, d, g, P) {
    if (ok(P[0]) && ok(P[1]) && ok(P[2])) g.ops.unshift({ t: 'pl', p: [[P[0].x, P[0].y], [P[1].x, P[1].y], [P[2].x, P[2].y]], fill: 0.12, nostroke: 1 });
    if (ok(P[2]) && ok(P[3]) && ok(P[4])) g.ops.unshift({ t: 'pl', p: [[P[2].x, P[2].y], [P[3].x, P[3].y], [P[4].x, P[4].y]], fill: 0.12, nostroke: 1 });
    zig(D, d, g, P, LAB[d.k]);
    rline(g, P, 0, 2, ratio(d, 0, 1, 1, 2)); rline(g, P, 1, 3, ratio(d, 1, 2, 2, 3)); rline(g, P, 2, 4, ratio(d, 2, 3, 3, 4)); rline(g, P, 0, 4, ratio(d, 0, 1, 1, 4));
  }
  GEO.xabcd = harmonic; GEO.cypher = harmonic;
  GEO.abcd = function (D, d, g, P) { zig(D, d, g, P, LAB.abcd); rline(g, P, 0, 2, ratio(d, 0, 1, 1, 2)); rline(g, P, 1, 3, ratio(d, 1, 2, 2, 3)); };
  GEO.tri = function (D, d, g, P, W, H) {
    zig(D, d, g, P, LAB.tri);
    if (ok(P[0]) && ok(P[2])) RAY(g, P[0], P[2], 1, W, H, { d: 1, ga: 0.8 }); if (ok(P[1]) && ok(P[3])) RAY(g, P[1], P[3], 1, W, H, { d: 1, ga: 0.8 });
    if (P.length >= 4 && P.every(ok)) g.ops.unshift({ t: 'pl', p: P.map(function (p) { return [p.x, p.y]; }), fill: 0.1, nostroke: 1 });
  };
  GEO.drives = function (D, d, g, P) { zig(D, d, g, P, LAB.drives); rline(g, P, 1, 3, ratio(d, 1, 2, 2, 3)); rline(g, P, 3, 5, ratio(d, 3, 4, 4, 5)); };
  GEO.hs = function (D, d, g, P, W, H) {
    if (P.every(ok) && P.length >= 7) g.ops.unshift({ t: 'pl', p: P.slice(2, 5).map(function (p) { return [p.x, p.y]; }), fill: 0.12, nostroke: 1 });
    zig(D, d, g, P, LAB.hs); if (ok(P[2]) && ok(P[4])) RAY(g, P[2], P[4], 2, W, H, { d: 1 });
    if (ok(P[2]) && ok(P[4])) LAB_(g, D.o.T('neckline'), P[4].x + 6, P[4].y + 12, { align: 'left', bg: '#2a2a2f', fg: '#e5e7eb' });
  };
  ['ewimp', 'ewcor', 'ewtri', 'ewdbl', 'ewtrp'].forEach(function (k) { GEO[k] = function (D, d, g, P) { zig(D, d, g, P, LAB[k], true); }; });
  GEO.cyclic = function (D, d, g, P, W, H) {
    var dt = Math.abs(d.pts[1].t - d.pts[0].t) || D.o.sec();
    for (var k = 0; k < 400; k++) { var q = D.toPx({ t: d.pts[0].t + dt * k, p: null }); if (!q || q.x == null) break; if (q.x > W + 2) break; L(g, q.x, 0, q.x, H, { w: 1, ga: k ? 0.8 : 1 }); }
  };
  GEO.tcycle = function (D, d, g, P, W, H) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var dt = Math.abs(d.pts[1].t - d.pts[0].t) || D.o.sec(), hgt = Math.max(8, Math.abs(b.y - a.y)), up = b.y <= a.y;
    for (var k = 0; k < 200; k++) {
      var q0 = D.toPx({ t: d.pts[0].t + dt * k, p: null }), q1 = D.toPx({ t: d.pts[0].t + dt * (k + 1), p: null }); if (!q0 || !q1 || q0.x == null || q1.x == null) break; if (q0.x > W) break;
      var cx = (q0.x + q1.x) / 2, rx = Math.abs(q1.x - q0.x) / 2; PL(g, ell(cx, a.y, rx, hgt, up ? Math.PI : 0, up ? 2 * Math.PI : Math.PI), { fill: 0.06 });
    }
    L(g, a.x, a.y, W, a.y, { d: 2, ga: 0.6, w: 1 });
  };
  GEO.sine = function (D, d, g, P, W, H) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var half = b.x - a.x; if (Math.abs(half) < 2) return;
    var mid = (a.y + b.y) / 2, amp = (a.y - b.y) / 2, pts = [];
    for (var x = 0; x <= W; x += 3) pts.push([x, mid + amp * Math.cos(Math.PI * (x - a.x) / half)]);
    PL(g, pts);
  };

  /* ---- forecasting, volume and measuring */
  GEO.forecast = function (D, d, g, P) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var p0 = d.pts[0], p1 = d.pts[1], up = p1.p >= p0.p, col = up ? '#34d399' : '#ff5a4d';
    L(g, a.x, a.y, b.x, b.y, { d: 1, c: col }); PL(g, ell(b.x, b.y, 5, 5, 0, Math.PI * 2), { c: col, fill: 0.5 }); PL(g, ell(a.x, a.y, 4, 4, 0, Math.PI * 2), { c: col });
    LAB_(g, D.o.T('t_forecast') + ' ' + iso((up ? '+' : '') + pct(p0.p, p1.p).toFixed(2) + '% · ' + D.o.fmt(p1.p) + ' · ' + P_.dur(p1.t - p0.t)), b.x + 8, b.y, { align: 'left', bg: col });
  };
  GEO.proj = function (D, d, g, P) {
    var a = P[0], b = P[1], c = P[2]; if (!ok(a) || !ok(b)) return; if (!ok(c)) { L(g, a.x, a.y, b.x, b.y); return; }
    g.ops.push({ t: 'pl', p: [[a.x, a.y], [b.x, b.y], [c.x, c.y]], fill: 0.1 });
    var r = ratio(d, 0, 1, 1, 2); if (r != null) LAB_(g, iso(r.toFixed(3) + ' · ' + (d.pts[2].p >= d.pts[1].p ? '+' : '') + pct(d.pts[1].p, d.pts[2].p).toFixed(2) + '%'), c.x + 8, c.y, { align: 'left' });
  };
  GEO.avwap = function (D, d, g, P, W) {
    var bars = D.o.bars(), ts = D.o.chart.timeScale(), se = D.o.series, t0 = d.pts[0].t, i0 = -1, i;
    for (i = 0; i < bars.length; i++) if (bars[i].t >= t0) { i0 = i; break; }
    if (i0 < 0) return; var pv = 0, vv = 0, pts = [], last = null, any = false;
    for (i = i0; i < bars.length; i++) {
      var b = bars[i], v = b.v || 0, tp = (b.h + b.l + b.c) / 3; pv += tp * (v || 1e-12); vv += (v || 1e-12); if (v) any = true;
      var x = ts.logicalToCoordinate(i), y = se.priceToCoordinate(pv / vv); if (x == null || y == null) continue; if (x < -20) continue; pts.push([x, y]); last = pv / vv; if (x > W + 20) break;
    }
    if (pts.length) PL(g, pts); if (ok(P[0])) PL(g, ell(P[0].x, P[0].y, 4, 4, 0, Math.PI * 2), { fill: 0.8 });
    if (last != null && pts.length) LAB_(g, 'AVWAP ' + iso(D.o.fmt(last)) + (any ? '' : ' · ' + D.o.T('noVol')), pts[pts.length - 1][0] + 6, pts[pts.length - 1][1], { align: 'left' });
  };
  GEO.vrp = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var bars = D.o.bars(), t0 = Math.min(d.pts[0].t, d.pts[1].t), t1 = Math.max(d.pts[0].t, d.pts[1].t), sel = [], i;
    for (i = 0; i < bars.length; i++) if (bars[i].t >= t0 && bars[i].t <= t1) sel.push(bars[i]);
    var x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    L(g, x0, 0, x0, H, { d: 2, w: 1, ga: 0.5, c: '#9ca3af' }); L(g, x1, 0, x1, H, { d: 2, w: 1, ga: 0.5, c: '#9ca3af' });
    if (!sel.length) return; var hi = -Infinity, lo = Infinity, tot = 0; sel.forEach(function (q) { if (q.h > hi) hi = q.h; if (q.l < lo) lo = q.l; tot += q.v || 0; });
    if (!(hi > lo)) return; var N = Math.max(6, Math.min(80, s.rows || 24)), up = new Array(N).fill(0), dn = new Array(N).fill(0), st = (hi - lo) / N;
    sel.forEach(function (q) {
      var v = q.v || 0; if (!v) return; var j0 = Math.max(0, Math.min(N - 1, Math.floor((q.l - lo) / st))), j1 = Math.max(0, Math.min(N - 1, Math.floor((q.h - lo) / st))), per = v / (j1 - j0 + 1);
      for (var j = j0; j <= j1; j++) { if (q.c >= q.o) up[j] += per; else dn[j] += per; }
    });
    if (!tot) { LAB_(g, D.o.T('noVol'), x0 + 4, a.y, { align: 'left' }); return; }
    var mx = 0, poc = 0; for (i = 0; i < N; i++) if (up[i] + dn[i] > mx) { mx = up[i] + dn[i]; poc = i; }
    var va = up[poc] + dn[poc], lo_i = poc, hi_i = poc; while (va < tot * 0.7 && (lo_i > 0 || hi_i < N - 1)) { var u = hi_i < N - 1 ? up[hi_i + 1] + dn[hi_i + 1] : -1, dd = lo_i > 0 ? up[lo_i - 1] + dn[lo_i - 1] : -1; if (u >= dd) { hi_i++; va += u; } else { lo_i--; va += dd; } }
    var maxW = Math.max(40, (x1 - x0) * 0.45), se = D.o.series;
    for (i = 0; i < N; i++) {
      var yA = se.priceToCoordinate(lo + st * i), yB = se.priceToCoordinate(lo + st * (i + 1)); if (yA == null || yB == null) continue;
      var y = Math.min(yA, yB) + 0.5, hgt = Math.max(1, Math.abs(yA - yB) - 1), wu = maxW * up[i] / mx, wd = maxW * dn[i] / mx, inVA = i >= lo_i && i <= hi_i;
      g.ops.push({ t: 'r', x: x0, y: y, w: wu, h: hgt, c: '#34d399', a: inVA ? 0.45 : 0.22 }); g.ops.push({ t: 'r', x: x0 + wu, y: y, w: wd, h: hgt, c: '#ff5a4d', a: inVA ? 0.45 : 0.22 });
    }
    var yp = se.priceToCoordinate(lo + st * (poc + 0.5)), yh = se.priceToCoordinate(lo + st * (hi_i + 1)), yl = se.priceToCoordinate(lo + st * lo_i);
    if (yp != null) { L(g, x0, yp, x1, yp, { c: '#facc15', w: 1.5, d: 0 }); LAB_(g, 'POC ' + iso(D.o.fmt(lo + st * (poc + 0.5))), x1 + 4, yp, { align: 'left', bg: '#facc15' }); }
    if (yh != null) L(g, x0, yh, x1, yh, { c: '#60a5fa', w: 1, d: 1 }); if (yl != null) L(g, x0, yl, x1, yl, { c: '#60a5fa', w: 1, d: 1 });
  };
  GEO.prange = function (D, d, g, P) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var p0 = d.pts[0], p1 = d.pts[1], up = p1.p >= p0.p, c = up ? '#38bdf8' : '#ff5a4d', xm = (a.x + b.x) / 2;
    g.ops.push({ t: 'r', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), c: c, a: 0.14 });
    L(g, Math.min(a.x, b.x), a.y, Math.max(a.x, b.x), a.y, { c: c, w: 1 }); L(g, Math.min(a.x, b.x), b.y, Math.max(a.x, b.x), b.y, { c: c, w: 1 }); L(g, xm, a.y, xm, b.y, { c: c, w: 1.5 });
    LAB_(g, iso((up ? '+' : '') + D.o.fmt(p1.p - p0.p) + ' (' + (up ? '+' : '') + pct(p0.p, p1.p).toFixed(2) + '%)'), xm, up ? Math.min(a.y, b.y) - 13 : Math.max(a.y, b.y) + 13, { align: 'center', bg: c });
  };
  GEO.drange = function (D, d, g, P) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var bars = D.o.bars(), sec = D.o.sec(), p0 = d.pts[0], p1 = d.pts[1], c = '#38bdf8', ym = (a.y + b.y) / 2;
    var nb = Math.round(t2l(bars, p1.t, sec) - t2l(bars, p0.t, sec)), vol = 0, t0 = Math.min(p0.t, p1.t), t1 = Math.max(p0.t, p1.t); bars.forEach(function (q) { if (q.t >= t0 && q.t <= t1) vol += q.v || 0; });
    g.ops.push({ t: 'r', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), c: c, a: 0.14 });
    L(g, a.x, Math.min(a.y, b.y), a.x, Math.max(a.y, b.y), { c: c, w: 1 }); L(g, b.x, Math.min(a.y, b.y), b.x, Math.max(a.y, b.y), { c: c, w: 1 }); L(g, a.x, ym, b.x, ym, { c: c, w: 1.5 });
    LAB_(g, iso(String(Math.abs(nb))) + ' ' + D.o.T('bars') + ' · ' + iso(P_.dur(p1.t - p0.t)) + (vol ? ' · ' + D.o.T('vol') + ' ' + iso(P_.big(vol)) : ''), (a.x + b.x) / 2, Math.max(a.y, b.y) + 13, { align: 'center', bg: c });
  };
  GEO.zoom = function (D, d, g, P) { var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; g.ops.push({ t: 'r', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), c: '#38bdf8', a: 0.12, stroke: 1 }); };

  /* ---- brushes, arrows and shapes */
  GEO.hl = function (D, d, g, P, W, H, s) { var pts = P.filter(ok).map(function (p) { return [p.x, p.y]; }); if (pts.length > 1) PL(g, pts, { w: Math.max(10, (s.w || 2) * 5), ga: 0.35, cap: 1 }); };
  GEO.arrowmk = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var dx = b.x - a.x, dy = b.y - a.y, Ln = Math.hypot(dx, dy); if (Ln < 2) return;
    var ux = dx / Ln, uy = dy / Ln, nx = -uy, ny = ux, sw = 3 + (s.w || 2), hw = sw * 2.6, hl = Math.min(Ln * 0.5, hw * 1.8), bx = b.x - ux * hl, by = b.y - uy * hl;
    PL(g, [[a.x + nx * sw, a.y + ny * sw], [bx + nx * sw, by + ny * sw], [bx + nx * hw, by + ny * hw], [b.x, b.y], [bx - nx * hw, by - ny * hw], [bx - nx * sw, by - ny * sw], [a.x - nx * sw, a.y - ny * sw]], { close: 1, fill: 0.85, w: 1 });
  };
  function mark(g, a, upw, s, T) {
    var x = a.x, y = a.y, z = 7 + (s.w || 2) * 2, dir = upw ? 1 : -1;
    PL(g, [[x, y], [x + z, y + dir * z], [x + z * 0.4, y + dir * z], [x + z * 0.4, y + dir * z * 2.2], [x - z * 0.4, y + dir * z * 2.2], [x - z * 0.4, y + dir * z], [x - z, y + dir * z]], { close: 1, fill: 0.9, w: 1 });
    if (s.x) LAB_(g, s.x, x, y + dir * (z * 2.2 + 12), { align: 'center', fg: s.tc || '#0b0b0c' });
  }
  GEO.arrowup = function (D, d, g, P, W, H, s) { if (ok(P[0])) mark(g, P[0], true, s); };
  GEO.arrowdn = function (D, d, g, P, W, H, s) { if (ok(P[0])) mark(g, P[0], false, s); };
  GEO.rrect = function (D, d, g, P) {
    var a = P[0], b = P[1], c = P[2]; if (!ok(a) || !ok(b)) return; if (!ok(c)) { L(g, a.x, a.y, b.x, b.y); return; }
    var dx = b.x - a.x, dy = b.y - a.y, Ln = Math.hypot(dx, dy) || 1, nx = -dy / Ln, ny = dx / Ln, h = (c.x - a.x) * nx + (c.y - a.y) * ny;
    PL(g, [[a.x, a.y], [b.x, b.y], [b.x + nx * h, b.y + ny * h], [a.x + nx * h, a.y + ny * h]], { close: 1, fill: 0.12 });
  };
  GEO.circ = function (D, d, g, P) { var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; var R = Math.hypot(b.x - a.x, b.y - a.y); PL(g, ell(a.x, a.y, R, R, 0, Math.PI * 2), { fill: 0.1 }); };
  GEO.path = function (D, d, g, P) {
    var pts = P.filter(ok).map(function (p) { return [p.x, p.y]; }); if (pts.length < 2) return; PL(g, pts);
    var A = pts[pts.length - 2], B = pts[pts.length - 1], ang = Math.atan2(B[1] - A[1], B[0] - A[0]), z = 12;
    PL(g, [[B[0], B[1]], [B[0] - z * Math.cos(ang - 0.4), B[1] - z * Math.sin(ang - 0.4)], [B[0] - z * Math.cos(ang + 0.4), B[1] - z * Math.sin(ang + 0.4)]], { close: 1, fill: 1, w: 1 });
  };
  GEO.poly = function (D, d, g, P) { var pts = P.filter(ok).map(function (p) { return [p.x, p.y]; }); if (pts.length < 2) return; PL(g, pts, { close: pts.length > 2 ? 1 : 0, fill: pts.length > 2 ? 0.12 : 0 }); };
  GEO.tri3 = GEO.poly;
  function quad(A, C, B) { return sample(function (u) { var v = 1 - u; return [v * v * A.x + 2 * v * u * C.x + u * u * B.x, v * v * A.y + 2 * v * u * C.y + u * u * B.y]; }, 60); }
  GEO.curve = function (D, d, g, P) { var a = P[0], b = P[1], c = P[2]; if (!ok(a) || !ok(b)) return; if (!ok(c)) { L(g, a.x, a.y, b.x, b.y); return; } PL(g, quad(a, c, b)); L(g, a.x, a.y, c.x, c.y, { d: 2, ga: 0.35, w: 1 }); L(g, b.x, b.y, c.x, c.y, { d: 2, ga: 0.35, w: 1 }); };
  GEO.arc = function (D, d, g, P) { var a = P[0], b = P[1], c = P[2]; if (!ok(a) || !ok(b)) return; if (!ok(c)) { L(g, a.x, a.y, b.x, b.y); return; } PL(g, quad(a, { x: 2 * c.x - (a.x + b.x) / 2, y: 2 * c.y - (a.y + b.y) / 2 }, b), { fill: 0.1 }); };
  GEO.dcurve = function (D, d, g, P) {
    var a = P[0], b = P[1], c = P[2]; if (!ok(a) || !ok(b)) return; if (!ok(c)) { L(g, a.x, a.y, b.x, b.y); return; }
    var c2 = { x: a.x + b.x - c.x, y: a.y + b.y - c.y };
    PL(g, sample(function (u) { var v = 1 - u; return [v * v * v * a.x + 3 * v * v * u * c.x + 3 * v * u * u * c2.x + u * u * u * b.x, v * v * v * a.y + 3 * v * v * u * c.y + 3 * v * u * u * c2.y + u * u * u * b.y]; }, 80));
  };

  /* ---- notes, labels and marks */
  GEO.note = function (D, d, g, P, W, H, s) {
    var a = P[0]; if (!ok(a)) return; PL(g, ell(a.x, a.y - 10, 8, 8, 0, Math.PI * 2), { fill: 0.95 }); L(g, a.x, a.y - 2, a.x, a.y, { w: 2 });
    g.ops.push({ t: 'txt', s: 'i', x: a.x, y: a.y - 10, c: '#0b0b0c', fs: 11, align: 'center' });
    LAB_(g, s.x || D.o.T('t_note'), a.x + 12, a.y - 10, { align: 'left', bg: '#1f1f24', fg: s.tc || '#e5e7eb', border: 1, fs: s.fs });
  };
  GEO.signpost = function (D, d, g, P, W, H, s) {
    var a = P[0]; if (!ok(a)) return; var top = a.y - 46; L(g, a.x, a.y, a.x, top + 9, { w: 1.5 }); PL(g, ell(a.x, a.y, 3, 3, 0, Math.PI * 2), { fill: 1 });
    LAB_(g, s.x || D.o.T('t_signpost'), a.x, top, { align: 'center', fg: s.tc, fs: s.fs });
  };
  GEO.callout = function (D, d, g, P, W, H, s) { var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; L(g, a.x, a.y, b.x, b.y, { w: 1.5 }); PL(g, ell(a.x, a.y, 3, 3, 0, Math.PI * 2), { fill: 1 }); LAB_(g, s.x || D.o.T('t_callout'), b.x, b.y, { align: 'center', fg: s.tc, fs: s.fs, big: 1 }); };
  GEO.comment = function (D, d, g, P, W, H, s) {
    var a = P[0]; if (!ok(a)) return; PL(g, [[a.x, a.y], [a.x + 6, a.y - 12], [a.x + 16, a.y - 12]], { close: 1, fill: 0.95, w: 1 });
    LAB_(g, s.x || D.o.T('t_comment'), a.x, a.y - 24, { align: 'left', fg: s.tc, fs: s.fs, big: 1 });
  };
  GEO.plabel = function (D, d, g, P, W, H, s) {
    var a = P[0]; if (!ok(a)) return; PL(g, [[a.x, a.y], [a.x + 8, a.y - 9], [a.x + 8, a.y + 9]], { close: 1, fill: 0.95, w: 1 });
    LAB_(g, s.x || iso(D.o.fmt(d.pts[0].p)), a.x + 8, a.y, { align: 'left', fg: s.tc, fs: s.fs, sq: 1 });
  };
  GEO.pnote = function (D, d, g, P, W, H, s) {
    var a = P[0], b = P[1]; if (!ok(a) || !ok(b)) return; L(g, a.x, a.y, b.x, b.y, { w: 1 }); PL(g, ell(a.x, a.y, 3.5, 3.5, 0, Math.PI * 2), { fill: 1 });
    LAB_(g, (s.x ? s.x + ' · ' : '') + iso(D.o.fmt(d.pts[0].p)), b.x, b.y, { align: 'center', fg: s.tc, fs: s.fs });
  };
  GEO.flag = function (D, d, g, P, W, H, s) {
    var a = P[0]; if (!ok(a)) return; L(g, a.x, a.y, a.x, a.y - 26, { w: 2 }); PL(g, [[a.x, a.y - 26], [a.x + 16, a.y - 21], [a.x, a.y - 16]], { close: 1, fill: 0.95, w: 1 });
    if (s.x) LAB_(g, s.x, a.x + 4, a.y - 36, { align: 'left', fg: s.tc, fs: s.fs });
  };
  GEO.emoji = function (D, d, g, P, W, H, s) { var a = P[0]; if (!ok(a)) return; g.ops.push({ t: 'txt', s: s.x || '⭐', x: a.x, y: a.y, fs: s.fs || 26, align: 'center', emo: 1 }); };

  /* ---- volume profiles as indicators: the visible range (at the right edge) and one per day */
  function profOf(sel, N) {
    var hi = -Infinity, lo = Infinity, tot = 0, i; sel.forEach(function (q) { if (q.h > hi) hi = q.h; if (q.l < lo) lo = q.l; tot += q.v || 0; });
    if (!(hi > lo) || !tot) return null; var up = new Array(N).fill(0), dn = new Array(N).fill(0), st = (hi - lo) / N;
    sel.forEach(function (q) { var v = q.v || 0; if (!v) return; var j0 = Math.max(0, Math.min(N - 1, Math.floor((q.l - lo) / st))), j1 = Math.max(0, Math.min(N - 1, Math.floor((q.h - lo) / st))), per = v / (j1 - j0 + 1); for (var j = j0; j <= j1; j++) { if (q.c >= q.o) up[j] += per; else dn[j] += per; } });
    var mx = 0, poc = 0; for (i = 0; i < N; i++) if (up[i] + dn[i] > mx) { mx = up[i] + dn[i]; poc = i; }
    var va = mx, a = poc, b = poc; while (va < tot * 0.7 && (a > 0 || b < N - 1)) { var u = b < N - 1 ? up[b + 1] + dn[b + 1] : -1, d = a > 0 ? up[a - 1] + dn[a - 1] : -1; if (u >= d) { b++; va += u; } else { a--; va += d; } }
    return { lo: lo, st: st, up: up, dn: dn, mx: mx, poc: poc, a: a, b: b, N: N };
  }
  function paintProf(ctx, se, pr, x0, maxW, right, xEnd) {
    for (var i = 0; i < pr.N; i++) {
      var yA = se.priceToCoordinate(pr.lo + pr.st * i), yB = se.priceToCoordinate(pr.lo + pr.st * (i + 1)); if (yA == null || yB == null) continue;
      var y = Math.min(yA, yB) + 0.5, hg = Math.max(1, Math.abs(yA - yB) - 1), wu = maxW * pr.up[i] / pr.mx, wd = maxW * pr.dn[i] / pr.mx, al = i >= pr.a && i <= pr.b ? 0.42 : 0.2;
      ctx.fillStyle = 'rgba(52,211,153,' + al + ')'; ctx.fillRect(right ? x0 - wu : x0, y, wu, hg);
      ctx.fillStyle = 'rgba(255,90,77,' + al + ')'; ctx.fillRect(right ? x0 - wu - wd : x0 + wu, y, wd, hg);
    }
    var yp = se.priceToCoordinate(pr.lo + pr.st * (pr.poc + 0.5)); if (yp != null) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.2; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(right ? x0 - maxW : x0, yp); ctx.lineTo(xEnd, yp); ctx.stroke(); }
  }
  Drawer.prototype.paintProfiles = function (ctx, W, H) {
    var L = this.o.profiles ? this.o.profiles() : null; if (!L || !L.length) return;
    var bars = this.o.bars(), ts = this.o.chart.timeScale(), se = this.o.series, r = ts.getVisibleLogicalRange(); if (!r || !bars.length) return;
    var i0 = Math.max(0, Math.ceil(r.from)), i1 = Math.min(bars.length - 1, Math.floor(r.to)); if (i1 <= i0) return;
    L.forEach(function (c) {
      if (c.mode === 'vis') { var pr = profOf(bars.slice(i0, i1 + 1), c.rows); if (pr) paintProf(ctx, se, pr, W, W * 0.22, true, W); return; }
      var groups = [], cur = null, long = bars.length > 1 && bars[1].t - bars[0].t >= 86400;
      for (var i = i0; i <= i1; i++) { var d = new Date(bars[i].t * 1000), key = long ? d.getUTCFullYear() * 12 + d.getUTCMonth() : Math.floor(bars[i].t / 86400); if (!cur || cur.k !== key) { cur = { k: key, a: i, b: i }; groups.push(cur); } else cur.b = i; }
      groups.slice(-40).forEach(function (g) {
        if (g.b - g.a < 2) return; var pr = profOf(bars.slice(g.a, g.b + 1), c.rows); if (!pr) return;
        var xa = ts.logicalToCoordinate(g.a), xb = ts.logicalToCoordinate(g.b); if (xa == null || xb == null) return;
        ctx.strokeStyle = 'rgba(156,163,175,.25)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(xa, 0); ctx.lineTo(xa, H); ctx.stroke();
        paintProf(ctx, se, pr, xa, (xb - xa) * 0.7, false, xb);
      });
    });
  };

  /* one painter for every op */
  function runOps(ctx, g, col, lw, dsh, s) {
    g.ops.forEach(function (op) {
      ctx.save(); var c = op.c || col; ctx.strokeStyle = c; ctx.lineWidth = op.w || lw; dash(ctx, op.d != null ? op.d : dsh); if (op.ga != null) ctx.globalAlpha = op.ga;
      if (op.t === 'l') { ctx.beginPath(); ctx.moveTo(op.p[0], op.p[1]); ctx.lineTo(op.p[2], op.p[3]); ctx.stroke(); }
      else if (op.t === 'pl') {
        if (op.cap) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
        ctx.beginPath(); op.p.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); if (op.close) ctx.closePath();
        if (op.fill) { var fo = s.fo != null && op.fill < 0.5 ? s.fo : op.fill; if (s.f !== false || op.fill >= 0.5) { ctx.fillStyle = rgba(c, fo); ctx.fill(); } }
        if (!op.nostroke) ctx.stroke();
      }
      else if (op.t === 'r') { ctx.fillStyle = rgba(c, op.a); ctx.fillRect(op.x, op.y, op.w, op.h); if (op.stroke) { ctx.setLineDash([]); ctx.lineWidth = 1; ctx.strokeRect(op.x, op.y, op.w, op.h); } }
      else if (op.t === 'lab' || op.t === 'circ') {
        ctx.setLineDash([]); var fs = op.fs || 11; ctx.font = '600 ' + fs + 'px Vazirmatn, Tahoma, sans-serif';
        if (op.t === 'circ') {
          var rr = 9; ctx.fillStyle = '#0b0b0c'; ctx.beginPath(); ctx.arc(op.x, op.y, rr, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = c; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(op.s, op.x, op.y + 0.5); op.box = [op.x - rr, op.y - rr, rr * 2, rr * 2];
        } else {
          var pad = op.big ? 8 : 5, h = Math.max(18, fs + (op.big ? 12 : 7)), w = ctx.measureText(op.s).width + pad * 2, x0 = op.align === 'right' ? op.x - w : op.align === 'center' ? op.x - w / 2 : op.x;
          ctx.fillStyle = op.bg || rgba(c, 0.92); ctx.beginPath(); if (ctx.roundRect && !op.sq) ctx.roundRect(x0, op.y - h / 2, w, h, 4); else ctx.rect(x0, op.y - h / 2, w, h); ctx.fill();
          if (op.border) { ctx.lineWidth = 1; ctx.strokeStyle = c; ctx.stroke(); }
          ctx.fillStyle = op.fg || '#0b0b0c'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(op.s, x0 + pad, op.y + 0.5); op.box = [x0, op.y - h / 2, w, h];
        }
      }
      else if (op.t === 'txt') {
        var f2 = op.fs || 12; ctx.font = (op.emo ? '' : '700 ') + f2 + 'px ' + (op.emo ? '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif' : 'Vazirmatn, Tahoma, sans-serif');
        ctx.fillStyle = op.c || col; ctx.textAlign = op.align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(op.s, op.x, op.y);
        var tw = ctx.measureText(op.s).width; op.box = [op.align === 'center' ? op.x - tw / 2 : op.x, op.y - f2 / 2 - 2, tw, f2 + 4];
      }
      ctx.restore();
    });
  }
  function hitOps(g, x, y, tol) {
    for (var i = g.ops.length - 1; i >= 0; i--) {
      var op = g.ops[i];
      if (op.t === 'l') { if (dseg(x, y, op.p[0], op.p[1], op.p[2], op.p[3]) <= tol) return true; }
      else if (op.t === 'pl') {
        for (var j = 1; j < op.p.length; j++) if (dseg(x, y, op.p[j - 1][0], op.p[j - 1][1], op.p[j][0], op.p[j][1]) <= tol + (op.cap ? op.w / 2 || 0 : 0)) return true;
        if (op.close && op.p.length > 1 && dseg(x, y, op.p[op.p.length - 1][0], op.p[op.p.length - 1][1], op.p[0][0], op.p[0][1]) <= tol) return true;
        if (op.fill && op.p.length > 2 && inPoly(x, y, op.p)) return true;
      }
      else if (op.t === 'r') { if (x >= op.x - tol && x <= op.x + op.w + tol && y >= op.y && y <= op.y + op.h) return true; }
      else if (op.box) { var b = op.box; if (x >= b[0] - 2 && x <= b[0] + b[2] + 2 && y >= b[1] - 2 && y <= b[1] + b[3] + 2) return true; }
    }
    return false;
  }

  /* ---------------------------------------------------------------- the controller of one chart */
  function Drawer(o) {
    this.o = o;                          /* { chart, series, el, bars(), sec(), sym(), list(sym) -> array, changed(sym, why), fmt(p), T(key), touch } */
    this.tool = null; this.cur = null; this.sel = null; this.hover = null; this.drag = null; this.keep = false; this.magnet = false;
    this.req = function () { };
    var self = this;
    this.prim = {
      attached: function (p) { self.req = p.requestUpdate; },
      detached: function () { self.req = function () { }; },
      updateAllViews: function () { },
      paneViews: function () {
        return [{ zOrder: function () { return 'top'; }, renderer: function () {
          return { draw: function (target) { target.useMediaCoordinateSpace(function (s) { try { self.paint(s.context, s.mediaSize.width, s.mediaSize.height); } catch (e) { if (window.console) console.error(e); } }); } };
        } }];
      },
      priceAxisViews: function () { return self.axisViews(); }
    };
    this._ev = {};
    ['pointerdown', 'mousedown', 'touchstart'].forEach(function (n) { self._ev[n] = function (e) { self.down(e, n); }; o.el.addEventListener(n, self._ev[n], { capture: true, passive: false }); });
    ['pointermove', 'mousemove', 'touchmove'].forEach(function (n) { self._ev[n] = function (e) { self.move(e, n); }; o.el.addEventListener(n, self._ev[n], { capture: true, passive: false }); });
    ['pointerup', 'mouseup', 'touchend', 'pointercancel', 'touchcancel'].forEach(function (n) { self._ev[n] = function (e) { self.up(e, n); }; window.addEventListener(n, self._ev[n], { capture: true, passive: false }); });
    this._ev.dbl = function (e) { self.dbl(e); }; o.el.addEventListener('dblclick', this._ev.dbl, true);
    o.series.attachPrimitive(this.prim);
  }
  Drawer.prototype.destroy = function () {
    var o = this.o, self = this;
    ['pointerdown', 'mousedown', 'touchstart', 'pointermove', 'mousemove', 'touchmove'].forEach(function (n) { o.el.removeEventListener(n, self._ev[n], true); });
    ['pointerup', 'mouseup', 'touchend', 'pointercancel', 'touchcancel'].forEach(function (n) { window.removeEventListener(n, self._ev[n], true); });
    o.el.removeEventListener('dblclick', this._ev.dbl, true);
    try { o.series.detachPrimitive(this.prim); } catch (e) { }
  };
  Drawer.prototype.list = function () { return this.o.list(this.o.sym()) || []; };
  Drawer.prototype.update = function () { this.req(); };
  Drawer.prototype.setTool = function (k) { this.tool = TOOLS[k] ? k : null; this.cur = null; this.o.el.style.cursor = this.tool ? 'crosshair' : ''; if (this.tool) this.select(null); this.req(); };

  /* pane geometry: the price pane is the top-left part of the chart element */
  Drawer.prototype.pane = function () {
    var ch = this.o.chart, ps = ch.panes()[0], h = ps ? ps.getHeight() : 0, w = ch.timeScale().width();
    return { w: w, h: h };
  };
  Drawer.prototype.local = function (e) {
    var r = this.o.el.getBoundingClientRect(), pt = e.touches && e.touches.length ? e.touches[0] : (e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : e);
    return { x: pt.clientX - r.left, y: pt.clientY - r.top };
  };
  Drawer.prototype.toData = function (x, y, snap) {
    var o = this.o, bars = o.bars(), sec = o.sec(), lg = o.chart.timeScale().coordinateToLogical(x); if (lg == null || !bars.length) return null;
    if (snap !== false) lg = Math.round(lg);
    var p = o.series.coordinateToPrice(y); if (p == null) return null;
    if (this.magnet && snap !== false) {
      var i = Math.max(0, Math.min(bars.length - 1, lg)), b = bars[i];
      if (b && lg >= 0 && lg <= bars.length - 1) {
        var best = null, bd = 1e9;
        [b.o, b.h, b.l, b.c].forEach(function (v) { var yy = o.series.priceToCoordinate(v); if (yy != null && Math.abs(yy - y) < bd) { bd = Math.abs(yy - y); best = v; } });
        if (best != null && bd < (this.magnet === 2 ? 1e9 : 60)) p = best;
      }
    }
    return { t: Math.round(l2t(bars, lg, sec)), p: p };
  };
  Drawer.prototype.toPx = function (pt) {
    var o = this.o, lg = t2l(o.bars(), pt.t, o.sec()); if (lg == null) return null;
    var x = o.chart.timeScale().logicalToCoordinate(lg), y = pt.p == null ? null : o.series.priceToCoordinate(pt.p);
    return { x: x, y: y };
  };

  /* ---------------------------------------------------------------- derived geometry of a drawing (data space → pixels) */
  Drawer.prototype.geo = function (d, W, H) {
    var self = this, px = d.pts.map(function (p) { return self.toPx(p); }), g = { px: px, lines: [], polys: [], texts: [] };
    if (px.some(function (p) { return !p || p.x == null; })) return null;
    var k = d.k, s = d.s || DEF, a = px[0], b = px[1], c = px[2];
    if (GEO[k]) { g.ops = []; GEO[k](this, d, g, px, W, H, s); return g; }
    function seg(A, B, mode) {                     /* mode: 0 segment, 1 ray A→B, 2 both ways */
      if (A.y == null || B.y == null) return;
      var E = mode ? toEdge(A.x, A.y, B.x, B.y, W, H) : [B.x, B.y], S = mode === 2 ? toEdge(B.x, B.y, A.x, A.y, W, H) : [A.x, A.y];
      g.lines.push([S[0], S[1], E[0], E[1]]);
    }
    if (k === 'trend' || k === 'arrow') { if (s.l && !s.r) seg(b, a, 1); else seg(a, b, (s.l && s.r) ? 2 : s.r ? 1 : 0); }
    else if (k === 'ray') seg(a, b, 1);
    else if (k === 'ext') seg(a, b, 2);
    else if (k === 'hline') { if (a.y != null) g.lines.push([0, a.y, W, a.y]); }
    else if (k === 'hray') { if (a.y != null) g.lines.push([a.x, a.y, W, a.y]); }
    else if (k === 'vline') g.lines.push([a.x, 0, a.x, H]);
    else if (k === 'channel' && c) {
      var tB = d.pts[1].t - d.pts[0].t, at = tB ? d.pts[0].p + (d.pts[1].p - d.pts[0].p) * (d.pts[2].t - d.pts[0].t) / tB : d.pts[0].p, off = d.pts[2].p - at;
      var A2 = this.toPx({ t: d.pts[0].t, p: d.pts[0].p + off }), B2 = this.toPx({ t: d.pts[1].t, p: d.pts[1].p + off }),
        Am = this.toPx({ t: d.pts[0].t, p: d.pts[0].p + off / 2 }), Bm = this.toPx({ t: d.pts[1].t, p: d.pts[1].p + off / 2 });
      var md = s.r ? 1 : 0;
      seg(a, b, md); seg(A2, B2, md); g.mid = []; if (Am.y != null && Bm.y != null) { var E = md ? toEdge(Am.x, Am.y, Bm.x, Bm.y, W, H) : [Bm.x, Bm.y]; g.mid.push([Am.x, Am.y, E[0], E[1]]); }
      if (g.lines.length === 2) g.polys.push([[g.lines[0][0], g.lines[0][1]], [g.lines[0][2], g.lines[0][3]], [g.lines[1][2], g.lines[1][3]], [g.lines[1][0], g.lines[1][1]]]);
    }
    else if (k === 'rect' || k === 'measure' || k === 'circle') { g.box = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)]; }
    else if (k === 'fib' || k === 'fibext') {
      var p0 = d.pts[0].p, p1 = d.pts[1].p, base = k === 'fib' || !d.pts[2] ? p1 : d.pts[2].p, rng = p1 - p0, lv = (s.lv && s.lv.length ? s.lv : (k === 'fib' ? FIB : FIBX));
      var x0 = k === 'fib' ? Math.min(a.x, b.x) : (c ? c.x : b.x), x1 = s.r ? W : (k === 'fib' ? Math.max(a.x, b.x) : (c ? c.x + Math.abs(b.x - a.x) : b.x));
      g.levels = lv.map(function (r, i) {
        var price = k === 'fib' ? p1 - rng * r : base + rng * r, y = self.o.series.priceToCoordinate(price);
        return { r: r, p: price, y: y, x0: x0, x1: x1, c: FIBC[i % FIBC.length] };
      }).filter(function (L) { return L.y != null; });
      if (k === 'fibext') { seg(a, b, 0); if (c) seg(b, c, 0); g.trend = true; }
      else seg(a, b, 0);
    }
    else if (k === 'gann') {
      var dt = d.pts[1].t - d.pts[0].t || this.o.sec(), dp = d.pts[1].p - d.pts[0].p;
      g.fan = GANN.map(function (G) { var q = self.toPx({ t: d.pts[0].t + dt, p: d.pts[0].p + dp * G[0] }); if (!q || q.y == null || a.y == null) return null; var E = toEdge(a.x, a.y, q.x, q.y, W, H); return { x0: a.x, y0: a.y, x1: E[0], y1: E[1], q: q, n: G[1] }; }).filter(Boolean);
    }
    else if (k === 'pitch' && c) {
      var M = { t: (d.pts[1].t + d.pts[2].t) / 2, p: (d.pts[1].p + d.pts[2].p) / 2 }, mp = this.toPx(M);
      var dT = M.t - d.pts[0].t, dP = M.p - d.pts[0].p;
      var u1 = this.toPx({ t: d.pts[1].t + dT, p: d.pts[1].p + dP }), u2 = this.toPx({ t: d.pts[2].t + dT, p: d.pts[2].p + dP });
      if (mp && mp.y != null) seg(a, mp, 1);
      if (u1 && u1.y != null && b.y != null) seg(b, u1, 1);
      if (u2 && u2.y != null && c.y != null) seg(c, u2, 1);
      if (b.y != null && c.y != null) g.lines.push([b.x, b.y, c.x, c.y]);
      if (g.lines.length >= 3) g.polys.push([[g.lines[1][0], g.lines[1][1]], [g.lines[1][2], g.lines[1][3]], [g.lines[2][2], g.lines[2][3]], [g.lines[2][0], g.lines[2][1]]]);
    }
    else if (k === 'long' || k === 'short') {
      var e = d.pts[0], tg = d.pts[1], st = d.pts[2], xe = this.toPx({ t: tg.t, p: e.p });
      var ye = a.y, yt = this.o.series.priceToCoordinate(tg.p), ys = this.o.series.priceToCoordinate(st.p);
      if (ye != null && yt != null && ys != null && xe) g.pos = { x0: a.x, x1: xe.x, ye: ye, yt: yt, ys: ys };
    }
    else if (k === 'brush') {
      g.path = px;
    }
    return g;
  };

  /* ---------------------------------------------------------------- painting */
  Drawer.prototype.paint = function (ctx, W, H) {
    var self = this, L = this.list();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    try { this.paintProfiles(ctx, W, H); } catch (e) { }
    var cat = tfCat(this.o.sec());
    L.forEach(function (d) { if (d.hd || (d.s && d.s.hv && d.s.hv.indexOf(cat) >= 0)) { d._g = null; return; } self.paintOne(ctx, d, W, H, self.sel === d.id, self.hover === d.id); });
    if (this.cur) this.paintOne(ctx, this.cur, W, H, true, false);
    ctx.restore();
  };
  Drawer.prototype.paintOne = function (ctx, d, W, H, selected, hovered) {
    var g = this.geo(d, W, H); if (!g) return;
    var s = d.s || DEF, col = s.c || DEF.c, lw = (s.w || 2) + (hovered ? 0.6 : 0), fmt = this.o.fmt, T = this.o.T, k = d.k;
    ctx.lineWidth = lw; ctx.strokeStyle = col; dash(ctx, s.d);
    if (g.ops) runOps(ctx, g, col, lw, s.d, s);
    g.polys.forEach(function (pl) { ctx.fillStyle = rgba(col, 0.07); ctx.beginPath(); pl.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); });
    g.lines.forEach(function (l) { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); });
    if (g.mid) { ctx.save(); ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.7; g.mid.forEach(function (l) { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); }); ctx.restore(); }
    if (k === 'arrow' && g.lines.length) {
      var l = g.lines[0], ang = Math.atan2(l[3] - l[1], l[2] - l[0]), hx = l[2], hy = l[3], sz = 10 + lw * 2;
      ctx.setLineDash([]); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - sz * Math.cos(ang - 0.4), hy - sz * Math.sin(ang - 0.4)); ctx.lineTo(hx - sz * Math.cos(ang + 0.4), hy - sz * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
    }
    if (k === 'hline' || k === 'hray') {
      var y = g.px[0].y; if (y != null && s.x) { ctx.setLineDash([]); label(ctx, s.x, k === 'hray' ? g.px[0].x + 4 : 8, y - 12, rgba(col, 0.9), '#0b0b0c'); }
    }
    if (g.box) {
      var bx = g.box;
      if (k === 'circle') {
        ctx.beginPath(); ctx.ellipse(bx[0] + bx[2] / 2, bx[1] + bx[3] / 2, bx[2] / 2, bx[3] / 2, 0, 0, Math.PI * 2);
        if (s.f !== false) { ctx.fillStyle = rgba(col, 0.1); ctx.fill(); } ctx.stroke();
      } else if (k === 'rect') {
        if (s.f !== false) { ctx.fillStyle = rgba(col, 0.12); ctx.fillRect(bx[0], bx[1], bx[2], bx[3]); }
        ctx.strokeRect(bx[0], bx[1], bx[2], bx[3]);
        if (s.x) { ctx.setLineDash([]); ctx.fillStyle = col; ctx.font = '600 12px Vazirmatn, Tahoma, sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(s.x, bx[0] + 5, bx[1] + 4); }
      } else {                                         /* measure */
        var p0 = d.pts[0], p1 = d.pts[1], up = p1.p >= p0.p, mc = up ? '#38bdf8' : '#ff5a4d', bars = this.o.bars(), sec = this.o.sec();
        var nb = Math.round(t2l(bars, p1.t, sec) - t2l(bars, p0.t, sec)), dur = Math.abs(p1.t - p0.t);
        ctx.fillStyle = rgba(mc, 0.16); ctx.fillRect(bx[0], bx[1], bx[2], bx[3]);
        ctx.setLineDash([]); ctx.strokeStyle = mc; ctx.lineWidth = 1.5;
        var xm = bx[0] + bx[2] / 2, ya = g.px[0].y, yb = g.px[1].y;
        ctx.beginPath(); ctx.moveTo(xm, ya); ctx.lineTo(xm, yb); ctx.stroke();
        var txt = iso((up ? '+' : '') + fmt(p1.p - p0.p) + ' (' + (up ? '+' : '') + pct(p0.p, p1.p).toFixed(2) + '%)') + ' · ' + iso(String(Math.abs(nb))) + ' ' + T('bars') + ' · ' + iso(P.dur(dur));
        label(ctx, txt, xm, (up ? bx[1] - 14 : bx[1] + bx[3] + 14), mc, '#0b0b0c', 'center');
      }
    }
    if (g.levels) {
      var lv = g.levels; ctx.setLineDash([]);
      for (var i = 0; i < lv.length - 1; i++) { var A = lv[i], B = lv[i + 1]; ctx.fillStyle = rgba(A.c, 0.06); ctx.fillRect(A.x0, Math.min(A.y, B.y), A.x1 - A.x0, Math.abs(B.y - A.y)); }
      ctx.lineWidth = 1;
      lv.forEach(function (L) {
        ctx.strokeStyle = L.c; ctx.beginPath(); ctx.moveTo(L.x0, L.y); ctx.lineTo(L.x1, L.y); ctx.stroke();
        ctx.font = '600 11px Vazirmatn, Tahoma, sans-serif'; ctx.fillStyle = L.c; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
        ctx.fillText(iso(L.r + ' (' + fmt(L.p) + ')'), L.x0 + 3, L.y - 2);
      });
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.6;
      g.lines.forEach(function (l) { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
    if (g.fan) {
      ctx.setLineDash([]); ctx.lineWidth = 1;
      g.fan.forEach(function (f, i) {
        var c2 = FIBC[(i + 1) % FIBC.length]; ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
        ctx.fillStyle = c2; ctx.font = '600 10px Vazirmatn, Tahoma, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(f.n, f.q.x + 4, f.q.y);
      });
    }
    if (g.pos) {
      var q = g.pos, x0 = Math.min(q.x0, q.x1), w = Math.abs(q.x1 - q.x0) || 60, en = d.pts[0].p, tg = d.pts[1].p, sl = d.pts[2].p;
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(52,211,153,.18)'; ctx.fillRect(x0, Math.min(q.ye, q.yt), w, Math.abs(q.yt - q.ye));
      ctx.fillStyle = 'rgba(255,90,77,.18)'; ctx.fillRect(x0, Math.min(q.ye, q.ys), w, Math.abs(q.ys - q.ye));
      ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, q.ye); ctx.lineTo(x0 + w, q.ye); ctx.stroke();
      var rr = Math.abs(en - sl) ? Math.abs(tg - en) / Math.abs(en - sl) : 0;
      label(ctx, T('target') + ' ' + iso(fmt(tg) + ' (' + (pct(en, tg) >= 0 ? '+' : '') + pct(en, tg).toFixed(2) + '%)'), x0 + w / 2, q.yt + (q.yt < q.ye ? -12 : 12), '#34d399', '#06281b', 'center');
      label(ctx, T('stop') + ' ' + iso(fmt(sl) + ' (' + (pct(en, sl) >= 0 ? '+' : '') + pct(en, sl).toFixed(2) + '%)'), x0 + w / 2, q.ys + (q.ys > q.ye ? 12 : -12), '#ff5a4d', '#2b0703', 'center');
      label(ctx, (k === 'long' ? T('long') : T('short')) + ' · ' + iso('R:R ' + rr.toFixed(2)), x0 + w / 2, q.ye, '#e5e7eb', '#111', 'center');
    }
    if (k === 'text' && g.px[0].y != null) {
      var tx = s.x || T('textPh'), fs = s.fs || 14; ctx.setLineDash([]);
      ctx.font = '600 ' + fs + 'px Vazirmatn, Tahoma, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var tw = ctx.measureText(tx).width; g.tbox = [g.px[0].x - 4, g.px[0].y - fs, tw + 8, fs * 2];
      ctx.fillStyle = 'rgba(11,11,12,.72)'; ctx.fillRect(g.tbox[0], g.tbox[1], g.tbox[2], g.tbox[3]);
      ctx.fillStyle = col; ctx.fillText(tx, g.px[0].x, g.px[0].y);
    }
    if (g.path && g.path.length > 1) {
      ctx.setLineDash([]); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
      g.path.forEach(function (p, i) { if (p.y == null) return; if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
    }
    if (selected && k !== 'brush') {
      ctx.setLineDash([]);
      g.px.forEach(function (p) { if (p.y == null && k !== 'vline') return; var yy = p.y == null ? H / 2 : p.y; ctx.fillStyle = '#0b0b0c'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, yy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      if (g.pos) { var Q = g.pos, xr = Math.max(Q.x0, Q.x1); [[xr, Q.yt], [xr, Q.ys], [xr, Q.ye]].forEach(function (p) { ctx.fillStyle = '#0b0b0c'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }); }
    }
    d._g = g;
  };
  Drawer.prototype.axisViews = function () {
    var self = this, out = [], L = this.list(), s = this.o.series;
    L.forEach(function (d) {
      if (d.hd) return;
      var want = (d.k === 'hline' || d.k === 'hray') ? [d.pts[0].p] : self.sel === d.id ? d.pts.map(function (p) { return p.p; }) : [];
      want.forEach(function (p) {
        if (p == null) return; var col = (d.s && d.s.c) || DEF.c;
        out.push({ coordinate: function () { var y = s.priceToCoordinate(p); return y == null ? -100 : y; }, text: function () { return self.o.fmt(p); },
          textColor: function () { return '#0b0b0c'; }, backColor: function () { return col; }, visible: function () { return true; }, tickVisible: function () { return true; } });
      });
    });
    return out;
  };

  /* ---------------------------------------------------------------- hit testing */
  Drawer.prototype.hit = function (x, y) {
    var L = this.list(), tol = this.o.touch() ? 12 : 6;
    for (var i = L.length - 1; i >= 0; i--) {
      var d = L[i], g = d._g; if (d.hd || !g) continue;
      if (this.sel === d.id) {
        for (var j = 0; j < g.px.length; j++) { var p = g.px[j]; if (p && Math.hypot(x - p.x, y - (p.y == null ? y : p.y)) <= tol + 3) return { d: d, part: j }; }
        if (g.pos) { var Q = g.pos, xr = Math.max(Q.x0, Q.x1); if (Math.hypot(x - xr, y - Q.yt) <= tol + 3) return { d: d, part: 'tg' }; if (Math.hypot(x - xr, y - Q.ys) <= tol + 3) return { d: d, part: 'sl' }; if (Math.hypot(x - xr, y - Q.ye) <= tol + 3) return { d: d, part: 'end' }; }
      }
      var near = false;
      g.lines.forEach(function (l) { if (dseg(x, y, l[0], l[1], l[2], l[3]) <= tol) near = true; });
      if (!near && g.fan) g.fan.forEach(function (f) { if (dseg(x, y, f.x0, f.y0, f.x1, f.y1) <= tol) near = true; });
      if (!near && g.levels) g.levels.forEach(function (Lv) { if (x >= Lv.x0 - tol && x <= Lv.x1 + tol && Math.abs(y - Lv.y) <= tol) near = true; });
      if (!near && g.box) { var b = g.box; near = x >= b[0] - tol && x <= b[0] + b[2] + tol && y >= b[1] - tol && y <= b[1] + b[3] + tol; }
      if (!near && g.tbox) { var tb = g.tbox; near = x >= tb[0] && x <= tb[0] + tb[2] && y >= tb[1] && y <= tb[1] + tb[3]; }
      if (!near && g.pos) { var q = g.pos, x0 = Math.min(q.x0, q.x1), x1 = Math.max(q.x0, q.x1), y0 = Math.min(q.yt, q.ys), y1 = Math.max(q.yt, q.ys); near = x >= x0 && x <= x1 && y >= y0 && y <= y1; }
      if (!near && g.path) for (var m = 1; m < g.path.length; m++) { var a = g.path[m - 1], c = g.path[m]; if (a.y != null && c.y != null && dseg(x, y, a.x, a.y, c.x, c.y) <= tol) { near = true; break; } }
      if (!near && g.ops) near = hitOps(g, x, y, tol);
      if (!near && g.polys.length) g.polys.forEach(function (pl) { if (inPoly(x, y, pl)) near = true; });
      if (near) return { d: d, part: 'body' };
    }
    return null;
  };
  function inPoly(x, y, pl) { var c = false; for (var i = 0, j = pl.length - 1; i < pl.length; j = i++) { var a = pl[i], b = pl[j]; if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) c = !c; } return c; }

  /* ---------------------------------------------------------------- pointer handling */
  function stop(e) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }
  Drawer.prototype.inPane = function (q) { var pn = this.pane(); return q.x >= 0 && q.y >= 0 && q.x <= pn.w && q.y <= pn.h; };
  Drawer.prototype.select = function (id) { if (this.sel !== id) { this.sel = id; this.o.selected && this.o.selected(id ? this.find(id) : null); this.req(); } };
  Drawer.prototype.find = function (id) { var L = this.list(); for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; };
  Drawer.prototype.lockChart = function (on) { this.o.chart.applyOptions({ handleScroll: !on, handleScale: !on }); };
  Drawer.prototype.down = function (e, n) {
    if (this.o.blocked && this.o.blocked()) return;
    if (n !== 'pointerdown') { if (this._eat) stop(e); return; }
    if (e.button != null && e.button !== 0) return;
    var q = this.local(e); this._eat = false;
    if (!this.inPane(q)) return;
    if (this.tool) {
      var pt = this.toData(q.x, q.y); if (!pt) return;
      this._eat = true; stop(e); this.lockChart(true);
      var k = this.tool, need = TOOLS[k].n;
      if (need === -1) { this.cur = { id: uid(), k: k, pts: [pt], s: this.style(k) }; this._brush = true; this.req(); return; }
      if (need === -2 && this.cur) {                                       /* click on the last point again (or a double click) ends it */
        var P2 = this.cur.pts, fixed = P2[P2.length - 2], fp = fixed && this.toPx(fixed);
        if (fp && fp.y != null && Math.hypot(fp.x - q.x, fp.y - q.y) <= 8) { P2.pop(); this._eat = false; this.lockChart(false); if (P2.length >= (k === 'poly' ? 3 : 2)) return this.finish(); this.cur = null; this.req(); return; }
        P2[P2.length - 1] = pt; if (P2.length >= 60) return this.finish(); P2.push({ t: pt.t, p: pt.p }); this.req(); return;
      }
      if (!this.cur) {
        this.cur = { id: uid(), k: k, pts: [pt], s: this.style(k) };
        if (k === 'long' || k === 'short') {
          var sgn = k === 'long' ? 1 : -1, span = 24 * this.o.sec();
          this.cur.pts = [pt, { t: pt.t + span, p: pt.p * (1 + sgn * 0.02) }, { t: pt.t + span, p: pt.p * (1 - sgn * 0.01) }];
          return this.finish();
        }
        if (need === 1) return this.finish();
        this.cur.pts.push({ t: pt.t, p: pt.p });
        this._downAt = q;
      } else {
        this.cur.pts[this.cur.pts.length - 1] = pt;
        if (this.cur.pts.length >= need) return this.finish();
        this.cur.pts.push({ t: pt.t, p: pt.p });
      }
      this.req(); return;
    }
    var h = this.hit(q.x, q.y);
    if (!h) { if (this.sel) this.select(null); return; }
    if (this.eraser) { this._eat = true; stop(e); if (!h.d.lk && this.o.erase) this.o.erase(h.d.id); return; }
    this.select(h.d.id);
    if (h.d.lk) { this._eat = true; stop(e); return; }
    this._eat = true; stop(e); this.lockChart(true);
    var start = this.toData(q.x, q.y, false);
    this.drag = { d: h.d, part: h.part, from: start, orig: JSON.parse(JSON.stringify(h.d.pts)), q: q, moved: false };
    this.o.el.style.cursor = 'grabbing';
  };
  Drawer.prototype.move = function (e, n) {
    if (n !== 'pointermove') { if (this._eat) stop(e); return; }
    var q = this.local(e);
    if (this.cur && this.tool) {
      stop(e);
      if (this._brush) { var bp = this.toData(q.x, q.y, false); if (bp) { var lp = this.cur.pts[this.cur.pts.length - 1], lpx = this.toPx(lp); if (!lpx || Math.hypot(lpx.x - q.x, lpx.y - q.y) > 3) this.cur.pts.push(bp); } this.req(); return; }
      var pt = this.toData(q.x, q.y); if (pt) { this.cur.pts[this.cur.pts.length - 1] = pt; this.req(); }
      return;
    }
    if (this.drag) {
      stop(e);
      var D = this.drag, d = D.d, now = this.toData(q.x, q.y, false); if (!now || !D.from) return;
      if (Math.hypot(q.x - D.q.x, q.y - D.q.y) > 2) D.moved = true;
      var bars = this.o.bars(), sec = this.o.sec();
      if (D.part === 'body') {
        var dl = Math.round(t2l(bars, now.t, sec) - t2l(bars, D.from.t, sec)), dp = now.p - D.from.p;
        d.pts = D.orig.map(function (p) { return { t: Math.round(l2t(bars, t2l(bars, p.t, sec) + dl, sec)), p: p.p == null ? null : p.p + dp }; });
      } else if (D.part === 'tg') { d.pts[1].p = now.p; }
      else if (D.part === 'sl') { d.pts[2].p = now.p; }
      else if (D.part === 'end') { var te = this.toData(q.x, q.y); if (te && te.t > d.pts[0].t) { d.pts[1].t = te.t; d.pts[2].t = te.t; } }
      else {
        var np = this.toData(q.x, q.y); if (!np) return;
        if (d.k === 'long' || d.k === 'short') { var dp2 = np.p - D.orig[0].p, dt2 = np.t - D.orig[0].t; d.pts = D.orig.map(function (p) { return { t: p.t + dt2, p: p.p + dp2 }; }); }
        else d.pts[D.part] = np;
      }
      this.req(); return;
    }
    if (e.buttons) return;
    if (!this.inPane(q)) { if (this.hover) { this.hover = null; this.req(); } return; }
    var h = this.tool ? null : this.hit(q.x, q.y), id = h ? h.d.id : null;
    if (id !== this.hover) { this.hover = id; this.o.el.style.cursor = this.tool ? 'crosshair' : id ? (h.d.lk ? 'not-allowed' : 'pointer') : ''; this.req(); }
  };
  Drawer.prototype.up = function (e) {
    if (!this._eat) return;
    var q = this.local(e);
    if (this._brush && this.cur) { this._brush = false; this._eat = false; this.lockChart(false); if (this.cur.pts.length > 1) this.finish(); else { this.cur = null; this.req(); } return; }
    if (this.cur && this._downAt && this.cur.pts.length === 2 && TOOLS[this.cur.k].n > 0 && Math.hypot(q.x - this._downAt.x, q.y - this._downAt.y) > 6) {
      var pt = this.toData(q.x, q.y); this._downAt = null;
      if (pt) { this.cur.pts[1] = pt; if (TOOLS[this.cur.k].n === 2) { this._eat = false; this.lockChart(false); return this.finish(); } this.cur.pts.push({ t: pt.t, p: pt.p }); }
    }
    this._downAt = null;
    if (this.drag) {
      var D = this.drag; this.drag = null; this.o.el.style.cursor = '';
      if (D.moved) this.o.changed(this.o.sym(), 'move', D.orig, D.d);
    }
    this._eat = false; this.lockChart(false);
  };
  Drawer.prototype.dbl = function (e) {
    var q = this.local(e), h = this.hit(q.x, q.y);
    if (!h) return; stop(e);
    if (ASKTEXT[h.d.k] && this.o.editText) this.o.editText(h.d); else if (this.o.settings) this.o.settings(h.d);
  };
  Drawer.prototype.style = function (k) {
    var st = (this.o.styleFor && this.o.styleFor(k)) || {};
    var s = { c: st.c || (k === 'measure' ? '#38bdf8' : k === 'fib' || k === 'fibext' ? '#9ca3af' : DEF.c), w: st.w || (k === 'brush' ? 2 : DEF.w), d: st.d || 0 };
    if (k === 'text') s.x = '';
    if (k === 'emoji') { s.x = (this.o.emoji && this.o.emoji()) || '\u2B50'; s.fs = 26; }
    if (k === 'arrowup') s.c = st.c || '#34d399'; if (k === 'arrowdn') s.c = st.c || '#ff5a4d';
    return s;
  };
  Drawer.prototype.finish = function () {
    var d = this.cur; this.cur = null;
    if (!d) return;
    if (TOOLS[d.k].tmp) { if (this.o.zoom) this.o.zoom(d); this.setTool(null); this.o.toolDone && this.o.toolDone(); return; }
    this.o.changed(this.o.sym(), 'add', null, d);
    if (!this.keep) this.setTool(null); else this.req();
    this.select(d.id);
    if (ASKTEXT[d.k]) this.o.editText && this.o.editText(d);
    if (!this.keep) this.o.toolDone && this.o.toolDone();
  };
  Drawer.prototype.cancel = function () { this.cur = null; this._brush = false; this.req(); };

  P.Drawer = Drawer; P.TOOLS = TOOLS; P.TEXTY = TEXTY; P.LV = LV; P.FIB = FIB; P.FIBX = FIBX; P.t2l = t2l; P.l2t = l2t;
  P.dur = function (s) { s = Math.abs(s); var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m ? m + 'm' : Math.round(s) + 's'; };
  P.uid = uid;
})();
