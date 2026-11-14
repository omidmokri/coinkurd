/* entekhab.net — the Observatory: OB.TS, a time-series chart on canvas.
   Stacked panes over ONE time axis (never two value scales in one pane: a second measure gets its own pane).
   Series: line · area · step · bars · candle. One crosshair, one read-out for every series; drag to pan,
   Ctrl + wheel / pinch / buttons to zoom; a legend with switches when a pane has more than one series; PNG.

   new OB.TS(stage).set({ daily: bool, view: [t0, t1] | null, panes: [ {
       weight: 2, log: false, zero: false, title: 'text', fmt: function (v) → string, min, max,
       zones: [{ y0, y1, color }], marks: [{ y, color, label }],
       series: [{ name, type, color, neg (colour of negative bars), data: [[t, v], …] | candles [[t, o, h, l, c], …], width, hide,
                  dim: { t: 1 } (bars drawn pale), fmt }] } ], dimNote: 'what a pale bar means' (a line in the read-out) }) */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, clamp = OB.clamp, d = document, w = window;
  var DAY = 864e5, FONT = '11px "Space Grotesk", system-ui, sans-serif';

  function lastLE(a, t) {               /* index of the last row whose time is ≤ t, −1 when none */
    var lo = 0, hi = a.length - 1, r = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (a[m][0] <= t) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  }
  function nice(span, n) { var raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
  /* a compact number for axes and read-outs: 1.25B, 340K, 0.0123 */
  function compact(v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e12) return s + (a / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e8 ? 1 : 2) + 'M';
    if (a >= 1e4) return s + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K';
    if (a >= 100) return s + a.toFixed(0);
    if (a >= 1) return s + a.toFixed(2);
    if (a === 0) return '0';
    return s + a.toPrecision(3);
  }
  OB.compact = compact;
  var TSTEPS = [300e3, 900e3, 1800e3, 3600e3, 2 * 3600e3, 4 * 3600e3, 6 * 3600e3, 12 * 3600e3, DAY, 2 * DAY, 7 * DAY, 14 * DAY];
  var FM = {};
  function fmtMonth(t) {
    var k = 'm' + OB.lang();
    if (!FM[k]) { try { FM[k] = OB.lang() === 'fa' ? new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { month: 'short', year: '2-digit' }) : new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }); } catch (e) { FM[k] = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }); } }
    return FM[k].format(new Date(t));
  }
  function fmtYear(t) {
    var k = 'y' + OB.lang();
    if (!FM[k]) { try { FM[k] = OB.lang() === 'fa' ? new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric' }) : new Intl.DateTimeFormat('en-GB', { year: 'numeric' }); } catch (e) { FM[k] = new Intl.DateTimeFormat('en-GB', { year: 'numeric' }); } }
    return FM[k].format(new Date(t));
  }

  function TS(stage) {
    var self = this;
    this.stage = stage;
    stage.innerHTML = '<div class="ob-ts-top"><div class="ob-ts-lgd"></div>' +
      '<div class="ob-zoom ob-zoom-s"><button type="button" data-z="in" aria-label="' + esc(T('zoom_in')) + '" title="' + esc(T('zoom_in')) + '">+</button><button type="button" data-z="out" aria-label="' + esc(T('zoom_out')) + '" title="' + esc(T('zoom_out')) + '">−</button><button type="button" data-z="reset" aria-label="' + esc(T('reset')) + '" title="' + esc(T('reset')) + '">⟲</button></div></div>' +
      '<div class="ob-ts-w"><canvas class="ob-cv" tabindex="0" role="img"></canvas><div class="ob-tip" hidden></div></div>';
    this.wrap = stage.querySelector('.ob-ts-w'); this.cv = stage.querySelector('canvas'); this.ctx = this.cv.getContext('2d');
    this.tip = stage.querySelector('.ob-tip'); this.lg = stage.querySelector('.ob-ts-lgd');
    this.P = []; this.v = null; this.hover = null; this.raf = 0; this.daily = false;
    this.onResize = function () { self.size(); self.draw(); };
    OB.on('resize', this.onResize);
    if (w.ResizeObserver) { this.ro = new ResizeObserver(OB.debounce(this.onResize, 60)); this.ro.observe(this.wrap); }
    this.bind(); this.size();
  }
  TS.prototype.destroy = function () { if (this.ro) this.ro.disconnect(); OB.off('resize', this.onResize); this.dead = true; };
  TS.prototype.size = function () {
    var r = this.wrap.getBoundingClientRect(), dpr = Math.min(2.5, w.devicePixelRatio || 1);
    this.W = Math.max(260, Math.floor(r.width)); this.H = Math.max(200, Math.floor(r.height)); this.dpr = dpr;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
  };
  TS.prototype.set = function (o) {
    this.P = (o.panes || []).filter(function (p) { return p && p.series && p.series.length; });
    this.daily = !!o.daily; this.label = o.label || ''; this.dimNote = o.dimNote || '';
    var t0 = Infinity, t1 = -Infinity, gap = Infinity;
    this.P.forEach(function (p) {
      p.series.forEach(function (s) {
        var a = s.data || []; if (!a.length) return;
        if (a[0][0] < t0) t0 = a[0][0]; if (a[a.length - 1][0] > t1) t1 = a[a.length - 1][0];
        if (a.length > 2) { var g = (a[a.length - 1][0] - a[0][0]) / (a.length - 1); if (g > 0 && g < gap) gap = g; }
      });
    });
    this.t0 = t0; this.t1 = t1; this.gap = isFinite(gap) ? gap : DAY;
    var keep = o.keepView && this.v && isFinite(t0);
    if (!keep) this.full = o.view && isFinite(o.view[0]) ? { x0: o.view[0], x1: o.view[1] } : null;
    if (!keep) this.resetView();
    this.legend(); this.cv.setAttribute('aria-label', this.label); this.draw();
  };
  TS.prototype.resetView = function () {
    if (!isFinite(this.t0)) { this.v = null; return; }
    var span = this.t1 - this.t0 || DAY;
    this.v = this.full ? { x0: this.full.x0, x1: this.full.x1 } : { x0: this.t0, x1: this.t1 + span * 0.02 };
  };
  TS.prototype.schedule = function () { var s = this; if (s.raf) return; s.raf = requestAnimationFrame(function () { s.raf = 0; s.draw(); }); };
  /* the legend: one entry per series of a pane that has several; a click hides or shows the series */
  TS.prototype.legend = function () {
    var self = this, h = '', n = 0;
    this.P.forEach(function (p, pi) {
      if (p.series.length < 2) return;
      p.series.forEach(function (s, si) {
        n++;
        h += '<button type="button" class="ob-lk' + (s.hide ? ' off' : '') + '" data-p="' + pi + '" data-s="' + si + '" aria-pressed="' + (s.hide ? 'false' : 'true') + '"><i class="' + (s.type === 'bars' || s.type === 'area' ? 'box' : 'ln') + '" style="background:' + esc(s.color) + '"></i><span></span></button>';
      });
    });
    this.lg.innerHTML = h;
    [].forEach.call(this.lg.querySelectorAll('.ob-lk'), function (b) { b.querySelector('span').textContent = self.P[+b.getAttribute('data-p')].series[+b.getAttribute('data-s')].name; });
  };
  TS.prototype.layout = function () {
    var ctx = this.ctx, P = this.P, self = this, v = this.v;
    ctx.font = FONT;
    var axis = 46;
    P.forEach(function (p) {
      p._dom = self.domain(p);
      var f = p.fmt || compact, a = ctx.measureText(f(p._dom[1])).width, b = ctx.measureText(f(p._dom[0])).width;
      axis = Math.max(axis, Math.ceil(Math.max(a, b)) + 18);
    });
    var L = 8, Tp = 8, B = 24, gap = 12, tot = 0;
    P.forEach(function (p) { tot += p.weight || 1; });
    var avail = this.H - Tp - B - gap * Math.max(0, P.length - 1), y = Tp;
    P.forEach(function (p) { p._y = y; p._h = Math.max(30, avail * (p.weight || 1) / tot); y += p._h + gap; });
    return { L: L, R: axis, T: Tp, B: B, plotW: this.W - L - axis };
  };
  /* the value range of a pane over the visible time range (all its shown series), padded */
  TS.prototype.domain = function (p) {
    var v = this.v, lo = Infinity, hi = -Infinity;
    p.series.forEach(function (s) {
      if (s.hide) return;
      var a = s.data || [], i0 = Math.max(0, lastLE(a, v.x0)), i1 = Math.min(a.length - 1, lastLE(a, v.x1) + 1), i, x;
      for (i = i0; i <= i1; i++) {
        x = a[i];
        if (s.type === 'candle') { if (x[3] < lo) lo = x[3]; if (x[2] > hi) hi = x[2]; }
        else if (x[1] != null && isFinite(x[1]) && (!p.log || x[1] > 0)) { if (x[1] < lo) lo = x[1]; if (x[1] > hi) hi = x[1]; }
      }
    });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    var bars = p.series.some(function (s) { return s.type === 'bars' && !s.hide; });
    if (p.zero || bars) { if (lo > 0) lo = 0; if (hi < 0) hi = 0; }
    if (p.min != null) lo = p.min; if (p.max != null) hi = p.max;
    if (p.log) { if (!(hi > 0)) hi = 1; if (!(lo > 0)) lo = hi / 10; lo = Math.log10(lo); hi = Math.log10(hi); }
    /* 7 % of air above and below; none past an end the pane fixed, nor past the zero that bars stand on
       (a zero that lines were merely stretched to keeps its air, so its grid line and label are seen) */
    var pad = (hi - lo) * 0.07 || Math.abs(hi) * 0.05 || 1;
    var fixLo = !p.log && (p.min != null || (bars && lo === 0)), fixHi = !p.log && (p.max != null || (bars && hi === 0));
    return [fixLo ? lo : lo - pad, fixHi ? hi : hi + pad];
  };

  TS.prototype.draw = function (target) {
    if (this.dead) return;
    var ctx = target ? target.ctx : this.ctx, dpr = target ? target.dpr : this.dpr, W = this.W, H = this.H, P = this.P, v = this.v, self = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, target ? (target.oy || 0) * dpr : 0);
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, W, H);
    if (!v || !P.length) return;
    var saveCtx = this.ctx; this.ctx = ctx; var G = this.layout(); this.ctx = saveCtx; this._G = G;
    var x0 = G.L, pw = G.plotW, xs = pw / (v.x1 - v.x0);
    function X(t) { return x0 + (t - v.x0) * xs; }
    this._X = X;
    /* time ticks */
    var spanMs = v.x1 - v.x0, want = spanMs / Math.max(2, Math.floor(pw / 96)), step = null, i, mode = 't';
    for (i = 0; i < TSTEPS.length; i++) if (TSTEPS[i] >= want) { step = TSTEPS[i]; break; }
    var ticks = [], tz = new Date().getTimezoneOffset() * 60000, t;
    if (step) { for (t = Math.ceil((v.x0 - tz) / step) * step + tz; t <= v.x1; t += step) ticks.push(t); mode = step >= DAY ? 'd' : 't'; }
    else {                                               /* months or years */
      var months = want / (30.44 * DAY), ms = months <= 1 ? 1 : months <= 2 ? 2 : months <= 3 ? 3 : months <= 6 ? 6 : 12 * Math.ceil(months / 12), dt = new Date(v.x0);
      var y = dt.getUTCFullYear(), m = dt.getUTCMonth();
      if (ms >= 12) { m = 0; y = Math.ceil(y / (ms / 12)) * (ms / 12); } else m = Math.ceil(m / ms) * ms;
      for (var k = 0; k < 400; k++) { t = Date.UTC(y, m + k * ms, 1); if (t > v.x1) break; if (t >= v.x0) ticks.push(t); }
      mode = ms >= 12 ? 'y' : 'm';
    }
    P.forEach(function (p) {
      var py = p._y, ph = p._h, dom = p._dom, f = p.fmt || compact;
      function Y(val) { var q = p.log ? Math.log10(val) : val; return py + (dom[1] - q) / (dom[1] - dom[0]) * ph; }
      p._Y = Y;
      ctx.fillStyle = '#0d0d11'; ctx.fillRect(x0, py, pw, ph);
      /* zones (a band of values with a meaning) */
      (p.zones || []).forEach(function (z) {
        var a = Y(Math.max(z.y0, p.log ? 1e-12 : -Infinity)), b = Y(z.y1), top = clamp(Math.min(a, b), py, py + ph), bot = clamp(Math.max(a, b), py, py + ph);
        if (z.y1 === Infinity) top = py; if (z.y0 === -Infinity) bot = py + ph;
        if (bot > top) { ctx.fillStyle = z.color; ctx.fillRect(x0, top, pw, bot - top); }
      });
      /* grid and value axis */
      ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1; ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#b9b9b3';
      var vals = [];
      if (p.log) { for (var e = Math.floor(dom[0]); e <= Math.ceil(dom[1]); e++) [1, 2, 5].forEach(function (mm) { var val = mm * Math.pow(10, e), q = Math.log10(val); if (q >= dom[0] && q <= dom[1]) vals.push(val); }); if (vals.length > ph / 22) vals = vals.filter(function (x) { return /^1/.test(x.toExponential()); }); }
      else { var st = nice(dom[1] - dom[0], Math.max(2, Math.floor(ph / 48))); for (var val = Math.ceil(dom[0] / st) * st; val <= dom[1] + st * 1e-9; val += st) vals.push(Math.abs(val) < st * 1e-9 ? 0 : val); }
      ctx.beginPath();
      vals.forEach(function (val) { var yy = Math.round(Y(val)) + 0.5; if (yy < py + 2 || yy > py + ph - 2) return; ctx.moveTo(x0, yy); ctx.lineTo(x0 + pw, yy); ctx.fillText(f(val), x0 + pw + 8, yy); });
      ctx.stroke();
      ctx.beginPath(); ticks.forEach(function (tt) { var tx = Math.round(X(tt)) + 0.5; if (tx > x0 && tx < x0 + pw) { ctx.moveTo(tx, py); ctx.lineTo(tx, py + ph); } }); ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(x0, py, pw, ph); ctx.clip();
      /* marks: a level worth naming */
      (p.marks || []).forEach(function (mk) { var yy = Math.round(Y(mk.y)) + 0.5; if (yy < py || yy > py + ph) return; ctx.strokeStyle = mk.color || 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + pw, yy); ctx.stroke(); });
      var zeroY = clamp(Y(p.log ? Math.pow(10, dom[0]) : 0), py, py + ph);
      p.series.forEach(function (s) {
        if (s.hide) return;
        var a = s.data || []; if (!a.length) return;
        var i0 = Math.max(0, lastLE(a, v.x0)), i1 = Math.min(a.length - 1, lastLE(a, v.x1) + 1), n = i1 - i0 + 1, j, xx, yy;
        if (s.type === 'candle') {
          var cw = Math.max(1, Math.min(14, self.gap * xs * 0.66)), thin = self.gap * xs < 3;
          for (j = i0; j <= i1; j++) {
            var c = a[j], cx = X(c[0] + self.gap / 2), up = c[4] >= c[1];
            ctx.strokeStyle = up ? '#34d399' : '#ff5a4d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, Y(c[2])); ctx.lineTo(cx, Y(c[3])); ctx.stroke();
            if (!thin) { var tp = Math.min(Y(c[1]), Y(c[4])), hh = Math.max(1, Math.abs(Y(c[4]) - Y(c[1]))); ctx.fillStyle = up ? '#34d399' : '#ff5a4d'; ctx.fillRect(cx - cw / 2, tp, cw, hh); }
          }
          return;
        }
        if (s.type === 'bars') {
          var bw = Math.max(1, Math.min(18, self.gap * xs * 0.72));
          for (j = i0; j <= i1; j++) {
            if (a[j][1] == null || !isFinite(a[j][1])) continue;
            yy = Y(a[j][1]); xx = X(a[j][0] + (s.center === false ? 0 : self.gap / 2));
            if (s.dim && s.dim[a[j][0]]) ctx.globalAlpha = 0.36;                 /* a bar the page marks as incomplete is drawn pale */
            ctx.fillStyle = a[j][1] < 0 && s.neg ? s.neg : s.color; ctx.fillRect(xx - bw / 2, Math.min(yy, zeroY), bw, Math.max(1, Math.abs(yy - zeroY)));
            ctx.globalAlpha = 1;
          }
          return;
        }
        /* line, step, area — thinned to the lowest and highest value of every pixel column when the points are denser than the pixels */
        ctx.beginPath();
        var started = false, perPx = n / pw, lastX = null, mn = 0, mx = 0, lastY = 0, firstX = null, endX = null;
        function to(px, pyv) { if (!started) { ctx.moveTo(px, pyv); started = true; firstX = px; } else if (s.type === 'step') { ctx.lineTo(px, lastY); ctx.lineTo(px, pyv); } else ctx.lineTo(px, pyv); lastY = pyv; endX = px; }
        for (j = i0; j <= i1; j++) {
          var val = a[j][1];
          if (val == null || !isFinite(val) || (p.log && !(val > 0))) { started = false; lastX = null; continue; }
          xx = X(a[j][0]); yy = Y(val);
          if (perPx > 2) {
            var col = Math.round(xx);
            if (col !== lastX) { if (lastX != null) { to(lastX, mn); if (mx !== mn) to(lastX, mx); } lastX = col; mn = mx = yy; } else { if (yy < mn) mn = yy; if (yy > mx) mx = yy; }
          } else to(xx, yy);
        }
        if (perPx > 2 && lastX != null) { to(lastX, mn); if (mx !== mn) to(lastX, mx); }
        if (s.type === 'step' && endX != null) ctx.lineTo(Math.min(x0 + pw, endX + self.gap * xs), lastY);
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.8; ctx.lineJoin = 'round'; ctx.stroke();
        if (s.type === 'area' && endX != null) { ctx.lineTo(endX, zeroY); ctx.lineTo(firstX, zeroY); ctx.closePath(); ctx.globalAlpha = 0.14; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = 1; }
      });
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, py + 0.5, pw - 1, ph - 1);
      /* marks' labels and the pane's title */
      ctx.font = '10.5px Vazirmatn, system-ui, sans-serif'; ctx.textBaseline = 'bottom';
      (p.marks || []).forEach(function (mk) { var yy = Y(mk.y); if (!mk.label || yy < py + 12 || yy > py + ph) return; ctx.fillStyle = mk.color || '#9a9a94'; ctx.direction = OB.rtl() ? 'rtl' : 'ltr'; ctx.textAlign = 'right'; ctx.fillText(mk.label, x0 + pw - 6, yy - 2); ctx.direction = 'ltr'; });
      if (p.title) { ctx.font = '600 11.5px Vazirmatn, "Space Grotesk", system-ui, sans-serif'; ctx.fillStyle = '#e8e8e3'; ctx.textBaseline = 'top'; ctx.direction = OB.rtl() ? 'rtl' : 'ltr'; ctx.textAlign = OB.rtl() ? 'right' : 'left'; ctx.fillText(p.title, OB.rtl() ? x0 + pw - 8 : x0 + 8, py + 6); ctx.direction = 'ltr'; }
    });
    /* time axis under the last pane */
    var last = P[P.length - 1], ay = last._y + last._h;
    ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ticks.forEach(function (tt) {
      var tx = X(tt); if (tx < x0 + 18 || tx > x0 + pw - 18) return;
      var dt = new Date(tt), mid = mode === 't' && dt.getHours() === 0 && dt.getMinutes() === 0;
      ctx.fillStyle = mid || (mode === 'm' && dt.getUTCMonth() === 0) ? '#e8e8e3' : '#9a9a94';
      ctx.fillText(mode === 'y' ? fmtYear(tt) : mode === 'm' ? fmtMonth(tt) : mode === 'd' || mid ? OB.axisDay(tt) : OB.axisTime(tt), tx, ay + 6);
    });
    if (!target) this.cross(ctx);
  };

  TS.prototype.cross = function (ctx) {
    var h = this.hover, G = this._G, P = this.P, v = this.v, tip = this.tip; if (!h || !G || !P.length) { tip.hidden = true; return; }
    var first = P[0], last = P[P.length - 1], top = first._y, bot = last._y + last._h;
    if (h.x < G.L || h.x > G.L + G.plotW || h.y < top || h.y > bot) { tip.hidden = true; return; }
    var t = v.x0 + (h.x - G.L) / G.plotW * (v.x1 - v.x0), near = null, self = this;
    /* snap to the first series that has a point there: a candle or a bar stands in the middle of its interval, so the pointer
       is inside the interval that began last; a line's point is the nearest one */
    var mid = false;
    P.some(function (p) { return p.series.some(function (s) {
      var a = s.data || [], m = s.type === 'candle' || (s.type === 'bars' && s.center !== false), i = lastLE(a, t + (m ? 0 : self.gap / 2));
      if (i >= 0) { near = a[i][0]; mid = m; return true; } return false;
    }); });
    if (near == null) { tip.hidden = true; return; }
    var cx = Math.round(this._X(near + (mid ? this.gap / 2 : 0))) + 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bot); ctx.stroke();
    var box = d.createElement('div'), hd = d.createElement('div'); hd.className = 'ob-tip-t'; hd.textContent = OB.fmtDate(near, !this.daily); box.appendChild(hd);
    var any = false, pale = false;
    P.forEach(function (p) {
      p.series.forEach(function (s) {
        if (s.hide) return;
        var a = s.data || [], i = lastLE(a, near + (self.daily ? 0 : self.gap * 0.5)); if (i < 0 || near - a[i][0] > self.gap * 3) return;
        if (s.dim && s.dim[a[i][0]]) pale = true;
        var val = s.type === 'candle' ? a[i][4] : a[i][1]; if (val == null || !isFinite(val)) return;
        var row = d.createElement('div'); row.className = 'ob-tip-r';
        var key = d.createElement('i'); key.className = 'ob-key'; key.style.background = s.type === 'bars' && val < 0 && s.neg ? s.neg : s.color;
        var nm = d.createElement('span'); nm.textContent = s.name;
        var b = d.createElement('b'); b.className = 'ob-n'; b.textContent = (s.fmt || p.fmt || compact)(val);
        row.appendChild(key); row.appendChild(nm); row.appendChild(b); box.appendChild(row); any = true;
        var yy = p._Y(val); if (yy >= p._y && yy <= p._y + p._h && s.type !== 'bars' && s.type !== 'candle') { ctx.beginPath(); ctx.arc(cx, yy, 3.5, 0, 6.2832); ctx.fillStyle = s.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#0a0a0c'; ctx.stroke(); }
      });
    });
    if (!any) { tip.hidden = true; return; }
    if (pale && this.dimNote) { var nt = d.createElement('div'); nt.className = 'ob-tip-n'; nt.textContent = this.dimNote; box.appendChild(nt); }
    tip.innerHTML = ''; tip.appendChild(box); tip.hidden = false; tip.setAttribute('dir', OB.rtl() ? 'rtl' : 'ltr');
    var tw = tip.offsetWidth, th = tip.offsetHeight, lx = h.x + 16, ly = h.y + 16;
    if (lx + tw > this.W - 6) lx = h.x - tw - 16; if (lx < 4) lx = 4;
    if (ly + th > this.H - 6) ly = h.y - th - 16; if (ly < 4) ly = 4;
    tip.style.left = lx + 'px'; tip.style.top = ly + 'px';
  };

  TS.prototype.zoom = function (f, at) {
    var v = this.v; if (!v) return;
    var span = v.x1 - v.x0, full = (this.t1 - this.t0) * 1.15 || DAY, ns = clamp(span * f, this.gap * 12, full), c = at == null ? (v.x0 + v.x1) / 2 : at, k = (c - v.x0) / span;
    v.x0 = c - ns * k; v.x1 = v.x0 + ns; this.fit(); this.schedule();
  };
  TS.prototype.fit = function () {
    var v = this.v, sp = v.x1 - v.x0, lo = this.t0 - sp * 0.1, hi = this.t1 + sp * 0.2;
    if (v.x0 < lo) { v.x0 = lo; v.x1 = lo + sp; } if (v.x1 > hi) { v.x1 = hi; v.x0 = hi - sp; }
  };
  TS.prototype.bind = function () {
    var self = this, cv = this.cv, pts = {}, drag = null, pinch = null;
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function tAt(x) { var G = self._G, v = self.v; return v.x0 + (x - G.L) / G.plotW * (v.x1 - v.x0); }
    cv.addEventListener('pointerdown', function (e) {
      if (!self.v || !self._G) return;
      var p = pos(e); pts[e.pointerId] = p; try { cv.setPointerCapture(e.pointerId); } catch (er) { }
      var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.abs(a.x - b.x) || 1, span: self.v.x1 - self.v.x0, c: tAt((a.x + b.x) / 2) }; drag = null; return; }
      drag = { x: p.x, v: { x0: self.v.x0, x1: self.v.x1 }, touch: e.pointerType === 'touch', moved: false };
    });
    cv.addEventListener('pointermove', function (e) {
      if (!self.v || !self._G) return;
      var p = pos(e), G = self._G, v = self.v;
      if (pts[e.pointerId]) pts[e.pointerId] = p;
      if (pinch) {
        var ids = Object.keys(pts); if (ids.length < 2) return;
        var a = pts[ids[0]], b = pts[ids[1]], dd = Math.abs(a.x - b.x) || 1, ns = clamp(pinch.span * pinch.d / dd, self.gap * 12, (self.t1 - self.t0) * 1.15 || DAY), k = ((a.x + b.x) / 2 - G.L) / G.plotW;
        v.x0 = pinch.c - ns * k; v.x1 = v.x0 + ns; self.fit(); self.hover = null; self.schedule(); return;
      }
      if (drag) {
        var dx = p.x - drag.x; if (Math.abs(dx) > 3) drag.moved = true;
        var sx = (drag.v.x1 - drag.v.x0) / G.plotW; v.x0 = drag.v.x0 - dx * sx; v.x1 = drag.v.x1 - dx * sx; self.fit();
        self.hover = drag.touch ? null : p; self.schedule(); return;
      }
      self.hover = p; self.schedule();
    });
    function up(e) { var tap = drag && drag.touch && !drag.moved, p = pts[e.pointerId]; delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; if (tap && p) { self.hover = p; self.schedule(); } drag = null; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch' && !drag) { self.hover = null; self.schedule(); } });
    cv.addEventListener('wheel', function (e) {
      if (!self.v || !self._G) return;
      var fs = d.getElementById('ob').classList.contains('ob-fs');
      if (!(e.ctrlKey || e.metaKey || fs || d.activeElement === cv)) { if (!TS.hinted) { TS.hinted = true; OB.toast(T('wheel_hint'), 2600); } return; }
      e.preventDefault(); self.zoom(Math.exp(clamp(e.deltaY, -120, 120) / 320), tAt(pos(e).x));
    }, { passive: false });
    cv.addEventListener('dblclick', function () { if (self.v) { self.resetView(); self.draw(); } });
    cv.addEventListener('keydown', function (e) {
      if (!self.v) return; var v = self.v, sp = v.x1 - v.x0, k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') { var m = sp * 0.12 * (k === 'ArrowLeft' ? -1 : 1); v.x0 += m; v.x1 += m; self.fit(); }
      else if (k === '+' || k === '=') self.zoom(0.8); else if (k === '-' || k === '_') self.zoom(1.25); else if (k === '0' || k === 'Home') self.resetView(); else return;
      e.preventDefault(); self.schedule();
    });
    this.stage.addEventListener('click', function (e) {
      var b = e.target.closest('.ob-zoom button');
      if (b && self.v) { var z = b.getAttribute('data-z'); if (z === 'in') self.zoom(0.7); else if (z === 'out') self.zoom(1.4); else { self.resetView(); self.draw(); } return; }
      var k = e.target.closest('.ob-lk'); if (!k) return;
      var s = self.P[+k.getAttribute('data-p')].series[+k.getAttribute('data-s')], p = self.P[+k.getAttribute('data-p')];
      if (!s.hide && p.series.filter(function (x) { return !x.hide; }).length === 1) return;        /* a pane keeps at least one series */
      s.hide = !s.hide; k.classList.toggle('off', !!s.hide); k.setAttribute('aria-pressed', s.hide ? 'false' : 'true'); self.draw();
    });
  };
  /* the chart as a PNG with a title line and the site's name */
  TS.prototype.png = function (title, sub, file) {
    if (!this.v) return;
    var dpr = 2, head = 46, c = d.createElement('canvas'); c.width = this.W * dpr; c.height = (this.H + head) * dpr;
    var ctx = c.getContext('2d'); ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, c.width, c.height);
    var keep = this.hover; this.hover = null; this.draw({ ctx: ctx, dpr: dpr, oy: head }); this.hover = keep;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f2f2ee'; ctx.font = '700 16px "Space Grotesk", Vazirmatn, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(title || '', 14, 17);
    ctx.fillStyle = '#9a9a94'; ctx.font = '11px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(sub || '', 14, 35);
    ctx.fillStyle = '#f7931a'; ctx.font = '700 15px "Space Grotesk", system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('entekhab.net', this.W - 14, 23);
    this.draw();
    c.toBlob(function (b) { if (!b) return; var u = URL.createObjectURL(b), a = d.createElement('a'); a.href = u; a.download = file || 'entekhab-chart.png'; d.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }, 'image/png');
  };
  OB.TS = TS; OB.TS.lastLE = lastLE;
})();
