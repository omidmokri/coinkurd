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
    text: { n: 1 }, measure: { n: 2 }, long: { n: 1 }, short: { n: 1 }, brush: { n: -1 }
  };
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
        if (best != null && bd < 60) p = best;
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
      var p0 = d.pts[0].p, p1 = d.pts[1].p, base = k === 'fib' ? p1 : d.pts[2].p, rng = p1 - p0, lv = (s.lv && s.lv.length ? s.lv : (k === 'fib' ? FIB : FIBX));
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
    L.forEach(function (d) { if (!d.hd) self.paintOne(ctx, d, W, H, self.sel === d.id, self.hover === d.id); });
    if (this.cur) this.paintOne(ctx, this.cur, W, H, true, false);
    ctx.restore();
  };
  Drawer.prototype.paintOne = function (ctx, d, W, H, selected, hovered) {
    var g = this.geo(d, W, H); if (!g) return;
    var s = d.s || DEF, col = s.c || DEF.c, lw = (s.w || 2) + (hovered ? 0.6 : 0), fmt = this.o.fmt, T = this.o.T, k = d.k;
    ctx.lineWidth = lw; ctx.strokeStyle = col; dash(ctx, s.d);
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
      if (k === 'brush') { this.cur = { id: uid(), k: k, pts: [pt], s: this.style(k) }; this._brush = true; this.req(); return; }
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
    if (this.cur && this._downAt && this.cur.pts.length === 2 && Math.hypot(q.x - this._downAt.x, q.y - this._downAt.y) > 6) {
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
    if (h && (h.d.k === 'text' || h.d.k === 'rect' || h.d.k === 'hline' || h.d.k === 'hray')) { stop(e); this.o.editText && this.o.editText(h.d); }
  };
  Drawer.prototype.style = function (k) {
    var st = (this.o.styleFor && this.o.styleFor(k)) || {};
    var s = { c: st.c || (k === 'measure' ? '#38bdf8' : k === 'fib' || k === 'fibext' ? '#9ca3af' : DEF.c), w: st.w || (k === 'brush' ? 2 : DEF.w), d: st.d || 0 };
    if (k === 'text') s.x = '';
    return s;
  };
  Drawer.prototype.finish = function () {
    var d = this.cur; this.cur = null;
    if (!d) return;
    this.o.changed(this.o.sym(), 'add', null, d);
    if (!this.keep) this.setTool(null); else this.req();
    this.select(d.id);
    if (d.k === 'text') this.o.editText && this.o.editText(d);
  };
  Drawer.prototype.cancel = function () { this.cur = null; this._brush = false; this.req(); };

  P.Drawer = Drawer; P.TOOLS = TOOLS; P.t2l = t2l; P.l2t = l2t;
  P.dur = function (s) { s = Math.abs(s); var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m ? m + 'm' : Math.round(s) + 's'; };
  P.uid = uid;
})();
