/* entekhab.net — candlestick chart of interface v3 ("Nexus"). Canvas 2D, no library (a few KB instead of a 160 KB chart library).
   Where the numbers come from, in this order — and the chart says which one it is using:
     1. Binance public market data: REST for history, a WebSocket for the candle that is still forming   -> "live"
     2. OKX public REST, asked again every 20 seconds                                                    -> "refreshed"
     3. the site's own snapshot data/candles/<SYM>_<tf>.json (BTC, ETH; CI, every 15 min)                       -> "delayed", with its time
   Nothing is ever invented: when all three fail the chart says so and stays empty.
   nxChart(box, { sym:'BTC', tf:'1h', mini:false, onState, onData }) -> { setTF, setSym, destroy } */
(function () {
  'use strict';
  var TF = { '15m': { s: 900, okx: '15m' }, '1h': { s: 3600, okx: '1H' }, '4h': { s: 14400, okx: '4H' }, '1d': { s: 86400, okx: '1Dutc' }, '1w': { s: 604800, okx: '1Wutc' } };
  var UP = '#34d399', DN = '#ff5a4d', RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function getJSON(url, ms) {
    var c = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); }, ms || 7000);
    return fetch(url, c ? { signal: c.signal } : {}).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); }, function (e) { clearTimeout(t); throw e; });
  }
  function fmtP(p) { return p == null ? '—' : p.toLocaleString('en-US', p >= 1000 ? { maximumFractionDigits: 0 } : p >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 5 }); }
  function fmtV(v) { return v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toFixed(2); }

  /* ---- one feed per symbol+timeframe, shared by every chart that shows it */
  var feeds = {};
  function feed(sym, tf) {
    var key = sym + '|' + tf; if (feeds[key]) return feeds[key];
    var F = feeds[key] = { key: key, sym: sym, tf: tf, d: [], state: 'load', at: null, subs: [], ws: null, timer: null, dead: false, tries: 0 };
    function tell() { F.subs.slice().forEach(function (f) { try { f(F); } catch (e) { if (window.console) console.error(e); } }); }
    function put(rows) { F.d = rows.filter(function (r) { return r && r[0] > 0 && r[4] > 0; }).sort(function (a, b) { return a[0] - b[0]; }); }
    function merge(r) {
      var n = F.d.length, l = n ? F.d[n - 1] : null;
      if (l && l[0] === r[0]) F.d[n - 1] = r; else if (!l || r[0] > l[0]) { F.d.push(r); if (F.d.length > 620) F.d.shift(); } else return;
      tell();
    }
    function binance() {
      return getJSON('https://data-api.binance.vision/api/v3/klines?symbol=' + sym + 'USDT&interval=' + tf + '&limit=500').then(function (a) {
        if (!Array.isArray(a) || !a.length) throw new Error('empty');
        put(a.map(function (k) { return [Math.floor(k[0] / 1000), +k[1], +k[2], +k[3], +k[4], +k[5]]; }));
      });
    }
    function okx(limit) {
      return getJSON('https://www.okx.com/api/v5/market/candles?instId=' + sym + '-USDT&bar=' + TF[tf].okx + '&limit=' + (limit || 300)).then(function (j) {
        if (!j || !j.data || !j.data.length) throw new Error('empty');
        return j.data.map(function (k) { return [Math.floor(k[0] / 1000), +k[1], +k[2], +k[3], +k[4], +k[5]]; });
      });
    }
    function site() {
      return getJSON('/data/candles/' + sym + '_' + tf + '.json?v=' + Math.floor(Date.now() / 3e5)).then(function (j) {
        var a = j && j.s && j.s[sym] && j.s[sym][tf]; if (!a || !a.length) throw new Error('none');
        put(a); F.at = j.t || null;
      });
    }
    function stream() {
      if (F.dead || !('WebSocket' in window)) return poll('binance');
      try { F.ws = new WebSocket('wss://data-stream.binance.vision/ws/' + sym.toLowerCase() + 'usdt@kline_' + tf); } catch (e) { return poll('binance'); }
      var opened = false;
      F.ws.onopen = function () { opened = true; F.tries = 0; F.state = 'live'; tell(); };
      F.ws.onmessage = function (ev) {
        var k; try { k = JSON.parse(ev.data).k; } catch (e) { return; }
        if (k) merge([Math.floor(k.t / 1000), +k.o, +k.h, +k.l, +k.c, +k.v]);
      };
      F.ws.onclose = function () {
        F.ws = null; if (F.dead) return;
        if (!opened || ++F.tries > 4) { poll('binance'); return; }
        F.state = 'wait'; tell(); F.timer = setTimeout(function () { if (!document.hidden) stream(); else F.resume = stream; }, 2000 * F.tries);
      };
    }
    function poll(src) {   /* no socket: ask again every 20 seconds (only while the tab is visible) */
      if (F.dead) return; F.state = 'poll'; F.src = src; tell();
      F.timer = setInterval(function () {
        if (document.hidden || F.dead) return;
        (src === 'okx' ? okx(2) : getJSON('https://data-api.binance.vision/api/v3/klines?symbol=' + sym + 'USDT&interval=' + tf + '&limit=2').then(function (a) {
          return a.map(function (k) { return [Math.floor(k[0] / 1000), +k[1], +k[2], +k[3], +k[4], +k[5]]; });
        })).then(function (rows) { rows.sort(function (a, b) { return a[0] - b[0]; }).forEach(merge); }, function () { });
      }, 20000);
    }
    F.start = function () {
      binance().then(function () { F.src = 'binance'; F.state = 'wait'; tell(); stream(); }, function () {
        return okx().then(function (rows) { put(rows); tell(); poll('okx'); }, function () {
          return site().then(function () {
            F.state = 'snap'; F.src = 'site'; tell();      /* the snapshot is rewritten every 15 minutes: read it again every 5 */
            F.timer = setInterval(function () { if (!document.hidden && !F.dead) site().then(tell, function () { }); }, 300000);
          }, function () { F.state = 'fail'; tell(); });
        });
      });
    };
    F.stop = function () { F.dead = true; clearTimeout(F.timer); clearInterval(F.timer); if (F.ws) { try { F.ws.onclose = null; F.ws.close(); } catch (e) { } } delete feeds[key]; };
    F.start();
    return F;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    Object.keys(feeds).forEach(function (k) { var F = feeds[k]; if (F.resume) { var r = F.resume; F.resume = null; r(); } });
  });

  function nxChart(box, o) {
    o = o || {};
    var mini = !!o.mini, sym = o.sym || 'BTC', tf = o.tf || '1h', F = null, dead = false, frozen = null;
    var cv = document.createElement('canvas'), g = cv.getContext('2d');
    cv.className = 'nxc-cv'; cv.setAttribute('role', 'img'); if (!mini) cv.tabIndex = 0;
    box.appendChild(cv); box.setAttribute('dir', 'ltr');
    var W = 0, H = 0, dpr = 1, n = mini ? (o.n || 44) : (o.n || 96), off = 0, hover = null, grow = 1, growT = 0, raf = 0, lastLen = 0, lastKey = '';
    var AX = mini ? 0 : 64, AY = mini ? 0 : 22, PADT = mini ? 4 : 10;
    function size() { var r = box.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2); W = Math.max(40, Math.floor(r.width)); H = Math.max(30, Math.floor(r.height)); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    function view() {
      var d = F ? F.d : (frozen || []), len = d.length; n = Math.max(mini ? 12 : 20, Math.min(n, Math.max(20, len)));
      off = Math.max(0, Math.min(off, Math.max(0, len - Math.floor(n / 2))));
      var end = len - Math.round(off), start = Math.max(0, end - n);
      return { d: d, start: start, end: end, pw: W - AX, ph: H - AY - PADT, cw: (W - AX - (mini ? 2 : 10)) / n };
    }
    function draw() {
      raf = 0; if (dead) return;
      var v = view(), d = v.d, i, c, x, lo = Infinity, hi = -Infinity, vmax = 0;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      if (!d.length) return;
      for (i = v.start; i < v.end; i++) { c = d[i]; if (c[3] < lo) lo = c[3]; if (c[2] > hi) hi = c[2]; if (c[5] > vmax) vmax = c[5]; }
      if (!(hi > lo)) { hi = lo * 1.001 + 1e-9; lo = lo * .999; }
      var pad = (hi - lo) * (mini ? .1 : .07); lo -= pad; hi += pad;
      var volH = mini ? 0 : v.ph * .16, ph = v.ph - volH - (mini ? 0 : 6);
      function Y(p) { return PADT + (hi - p) / (hi - lo) * ph; }
      function X(i) { return (i - v.start + .5) * v.cw + (mini ? 1 : 4); }
      g.font = '11px "Space Grotesk",system-ui,sans-serif'; g.textBaseline = 'middle';
      if (!mini) {
        var step = nice((hi - lo) / 5), p0 = Math.ceil(lo / step) * step, p;
        g.strokeStyle = 'rgba(255,255,255,.06)'; g.fillStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.textAlign = 'left';
        for (p = p0; p < hi; p += step) { var y = Math.round(Y(p)) + .5; g.beginPath(); g.moveTo(0, y); g.lineTo(v.pw, y); g.stroke(); g.fillText(fmtP(p), v.pw + 8, y); }
        g.textAlign = 'center'; var every = Math.max(1, Math.round(96 / v.cw)), lastDay = '';
        for (i = v.start; i < v.end; i++) {
          if ((i - v.start) % every) continue; var dt = new Date(d[i][0] * 1000), lab, day = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          lab = TF[tf].s >= 86400 ? (TF[tf].s > 86400 ? dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : day) : (day !== lastDay && lastDay ? day : ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2));
          lastDay = day; if (X(i) > 20 && X(i) < v.pw - 14) g.fillText(lab, X(i), H - AY / 2);
        }
      }
      var bw = Math.max(1, Math.min(18, Math.floor(v.cw * .7))), e = grow, base = PADT + ph;
      for (i = v.start; i < v.end; i++) {
        c = d[i]; x = X(i); var up = c[4] >= c[1], col = up ? UP : DN, k = RM ? 1 : Math.max(0, Math.min(1, e * 1.6 - (i - v.start) / (v.end - v.start) * .6));
        k = 1 - Math.pow(1 - k, 3);
        var yo = Y(c[1]), yc = Y(c[4]), yh = Y(c[2]), yl = Y(c[3]);
        if (k < 1) { var m = base; yo = m + (yo - m) * k; yc = m + (yc - m) * k; yh = m + (yh - m) * k; yl = m + (yl - m) * k; }
        g.fillStyle = col; g.globalAlpha = mini ? .95 : 1;
        g.fillRect(Math.round(x) - .5, yh, 1, Math.max(1, yl - yh));
        var top = Math.min(yo, yc), hh = Math.max(1, Math.abs(yc - yo));
        g.fillRect(Math.round(x - bw / 2), top, bw, hh);
        if (volH) { g.globalAlpha = .28; var vh = c[5] / (vmax || 1) * volH * k; g.fillRect(Math.round(x - bw / 2), PADT + v.ph - vh, bw, vh); }
      }
      g.globalAlpha = 1;
      var last = d[d.length - 1], ly = Math.round(Y(last[4])) + .5;
      if (ly > PADT && ly < base + 2 && v.end >= d.length - 1) {
        g.strokeStyle = 'rgba(247,147,26,.9)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(0, ly); g.lineTo(v.pw, ly); g.stroke(); g.setLineDash([]);
        if (!mini) { g.fillStyle = '#f7931a'; rr(v.pw + 3, ly - 9, AX - 6, 18, 4); g.fill(); g.fillStyle = '#000'; g.textAlign = 'left'; g.font = '700 11px "Space Grotesk",system-ui,sans-serif'; g.fillText(fmtP(last[4]), v.pw + 8, ly + .5); }
      }
      if (hover != null && !mini) {
        var hi_ = Math.max(v.start, Math.min(v.end - 1, hover.i)), hx = Math.round(X(hi_)) + .5;
        g.strokeStyle = 'rgba(255,255,255,.28)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(hx, PADT); g.lineTo(hx, PADT + v.ph); g.moveTo(0, hover.y + .5); g.lineTo(v.pw, hover.y + .5); g.stroke(); g.setLineDash([]);
        if (hover.y < base) { var hp = hi - (hover.y - PADT) / ph * (hi - lo); g.fillStyle = '#2a2a2f'; rr(v.pw + 3, hover.y - 9, AX - 6, 18, 4); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = '11px "Space Grotesk",system-ui,sans-serif'; g.fillText(fmtP(hp), v.pw + 8, hover.y + .5); }
        if (o.onHover) o.onHover(d[hi_], hi_ > 0 ? d[hi_ - 1] : null);
      }
      if (grow < 1) { grow = Math.min(1, (performance.now() - growT) / 700); raf = requestAnimationFrame(draw); }
    }
    function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
    function nice(x) { var e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; }
    function ask() { if (!raf && !dead) raf = requestAnimationFrame(draw); }
    function onFeed(f) {
      if (dead || f !== F) return;
      if (f.key !== lastKey || (!lastLen && f.d.length)) { lastKey = f.key; grow = RM ? 1 : 0; growT = performance.now(); }
      lastLen = f.d.length;
      var d = f.d, l = d[d.length - 1];
      if (l) cv.setAttribute('aria-label', sym + '/USDT ' + tf + ' — last ' + fmtP(l[4]) + ', high ' + fmtP(l[2]) + ', low ' + fmtP(l[3]));
      if (o.onState) o.onState(f.state, f);
      if (o.onData && l) o.onData(l, d.length > 1 ? d[d.length - 2] : null, f);
      if (hover == null && o.onHover && l) o.onHover(l, d.length > 1 ? d[d.length - 2] : null);
      ask();
      /* a still picture (the stage backdrop): once the candles are in, let go of the feed so nothing redraws it */
      if (o.once && d.length && F) { var G = F; F = null; setTimeout(function () { G.subs = G.subs.filter(function (x) { return x !== onFeed; }); if (!G.subs.length) G.stop(); }, 0); frozen = d; }
    }
    function attach() {
      if (F) { F.subs = F.subs.filter(function (x) { return x !== onFeed; }); if (!F.subs.length) F.stop(); }
      F = feed(sym, tf); F.subs.push(onFeed); off = 0; hover = null; onFeed(F);
    }
    /* ---- interaction (full chart only): crosshair, drag to pan, wheel / pinch / keys to zoom */
    var pts = {}, pinch = 0, dragX = null;
    function idxAt(cx) { var v = view(), r = cv.getBoundingClientRect(); return v.start + Math.floor((cx - r.left - 4) / v.cw); }
    function zoom(f, cx) {
      var v = view(), r = cv.getBoundingClientRect(), frac = cx == null ? 1 : Math.max(0, Math.min(1, (cx - r.left) / Math.max(1, v.pw)));
      var old = n, len = F ? F.d.length : 0; n = Math.round(Math.max(20, Math.min(Math.max(20, len), n * f)));
      off = Math.max(0, off + (old - n) * (1 - frac)); ask();
    }
    if (!mini) {
      cv.addEventListener('pointerdown', function (e) { pts[e.pointerId] = e.clientX; var k = Object.keys(pts); if (k.length === 2) pinch = Math.abs(pts[k[0]] - pts[k[1]]); else dragX = e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (x) { } });
      cv.addEventListener('pointermove', function (e) {
        var r = cv.getBoundingClientRect(), k = Object.keys(pts);
        if (pts[e.pointerId] != null) {
          pts[e.pointerId] = e.clientX;
          if (k.length === 2) { var dd = Math.abs(pts[k[0]] - pts[k[1]]); if (pinch && dd) { zoom(pinch / dd, (pts[k[0]] + pts[k[1]]) / 2); pinch = dd; } return; }
          if (dragX != null) { var v = view(); off += (e.clientX - dragX) / v.cw; dragX = e.clientX; }
        }
        hover = { i: idxAt(e.clientX), y: Math.max(0, Math.min(H - AY, e.clientY - r.top)) }; ask();
      });
      var end = function (e) { delete pts[e.pointerId]; dragX = null; pinch = 0; if (e.pointerType !== 'mouse') { hover = null; if (o.onHover && F && F.d.length) o.onHover(F.d[F.d.length - 1], F.d[F.d.length - 2] || null); ask(); } };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      cv.addEventListener('pointerleave', function () { if (dragX == null) { hover = null; if (o.onHover && F && F.d.length) o.onHover(F.d[F.d.length - 1], F.d[F.d.length - 2] || null); ask(); } });
      cv.addEventListener('wheel', function (e) { if (document.activeElement !== cv && !e.ctrlKey) return;   /* the wheel scrolls the page unless the chart was clicked first */
        if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) { off -= e.deltaX / view().cw; ask(); e.preventDefault(); return; } e.preventDefault(); zoom(e.deltaY > 0 ? 1.14 : 1 / 1.14, e.clientX); }, { passive: false });
      cv.addEventListener('dblclick', function () { n = o.n || 96; off = 0; ask(); });
      cv.addEventListener('keydown', function (e) {
        var k = e.key; if (k === 'ArrowLeft') off += 4; else if (k === 'ArrowRight') off -= 4; else if (k === '+' || k === '=') zoom(1 / 1.25); else if (k === '-') zoom(1.25); else if (k === 'Home') off = 0; else return;
        e.preventDefault(); e.stopPropagation(); ask();
      });
    }
    var ro = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(function () { size(); ask(); }); ro.observe(box); } else window.addEventListener('resize', function () { size(); ask(); });
    size(); attach();
    return {
      setTF: function (t) { if (!TF[t] || t === tf) return; tf = t; attach(); },
      setSym: function (s) { if (!s || s === sym) return; sym = s; attach(); },
      zoom: function (f) { zoom(f); },
      get: function () { return { sym: sym, tf: tf, state: F && F.state, at: F && F.at, src: F && F.src }; },
      destroy: function () { dead = true; if (ro) ro.disconnect(); if (F) { F.subs = F.subs.filter(function (x) { return x !== onFeed; }); if (!F.subs.length) F.stop(); } cv.remove(); }
    };
  }
  nxChart.fmtP = fmtP; nxChart.fmtV = fmtV; nxChart.TF = TF;
  window.nxChart = nxChart;
})();
