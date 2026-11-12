/* entekhab.net — the market map: liquidity (/liquidity/).
   1. Live order-book heatmap (Bookmap-style) of one coin: the Binance book is kept in the browser the way Binance
      documents it (a REST snapshot + the diff stream, checked by update ids; a gap re-syncs it). Every second the resting
      dollars are summed into price bands around the price and drawn as a column: bright bands are big resting orders.
      Trades are the dots (green = aggressive buys, red = aggressive sells; area ∝ dollars). History starts when you open it.
   2. Depth within ±2 %, spread, imbalance and the biggest walls, from the same live book.
   3. Liquidations on Binance futures as they happen (the public force-order stream) and since the page opened.
   4. Market liquidity: spread, top of book and ±1 % / ±2 % depth of the largest coins (data/mm_flow.json, CI).
   Sockets run only while this page is on screen; Data Saver reads the book every 30 s instead. Not financial advice. */
(function () {
  'use strict';
  var MM = window.MM, d = document, S = MM.S, D = MM.D, T = MM.T, esc = MM.esc, h = MM.h, $ = MM.$;
  var V = MM.views.liq = {};
  var st = null;
  var FSTREAM = 'wss://fstream.binance.com/ws/!forceOrder@arr';
  var HEAT = [[0, 11, 11, 12, 0], [0.12, 12, 37, 69, 0.85], [0.35, 17, 112, 170, 0.95], [0.6, 34, 211, 238, 1], [0.82, 250, 204, 21, 1], [1, 255, 247, 214, 1]];
  function heat(x) {
    for (var i = 1; i < HEAT.length; i++) if (x <= HEAT[i][0]) {
      var a = HEAT[i - 1], b = HEAT[i], t = (x - a[0]) / (b[0] - a[0]);
      return 'rgba(' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ',' + Math.round(a[3] + (b[3] - a[3]) * t) + ',' + (a[4] + (b[4] - a[4]) * t).toFixed(2) + ')';
    }
    return 'rgb(255,247,214)';
  }

  /* ---------------------------------------------------------------- the local book */
  function Book(sym, onReady, onCol, onTrade, onErr) {
    var B = { sym: sym, bids: new Map(), asks: new Map(), last: 0, ready: false, buf: [], ws: null, cols: [], dead: false, bytes: 0, trades: [] };
    function apply(side, rows) { for (var i = 0; i < rows.length; i++) { var p = rows[i][0], q = +rows[i][1]; if (q === 0) side.delete(p); else side.set(p, q); } }
    function event(u) {
      if (!B.ready) { B.buf.push(u); return; }
      if (u.u <= B.last) return;
      if (u.U > B.last + 1) { resync(); return; }          /* a gap: start again from a snapshot */
      apply(B.bids, u.b); apply(B.asks, u.a); B.last = u.u;
      sample();
    }
    function snapshot() {
      /* the two deepest books need 5000 levels to reach about ±1 %; the rest are covered by 1000 */
      return MM.getJSON(MM.API + 'depth?symbol=' + sym + '&limit=' + (/^(BTC|ETH)USDT$/.test(sym) ? 5000 : 1000), 20000).then(function (s) {
        if (B.dead) return;
        B.bids = new Map(); B.asks = new Map();
        apply(B.bids, s.bids); apply(B.asks, s.asks); B.last = s.lastUpdateId;
        var pend = B.buf.filter(function (u) { return u.u > B.last; }); B.buf = [];
        if (pend.length && pend[0].U > B.last + 1) { setTimeout(resync, 800); return; }
        B.ready = true;
        pend.forEach(event);
        sample(); onReady && onReady();
      });
    }
    function resync() { if (B.dead) return; B.ready = false; B.buf = []; snapshot().catch(function (e) { onErr && onErr(e); }); }
    B.mid = function () {
      var bb = -Infinity, aa = Infinity;
      B.bids.forEach(function (q, p) { p = +p; if (p > bb) bb = p; }); B.asks.forEach(function (q, p) { p = +p; if (p < aa) aa = p; });
      return isFinite(bb) && isFinite(aa) ? { b: bb, a: aa, m: (bb + aa) / 2 } : null;
    };
    /* one column: dollars resting in each band of `step` around the price */
    var lastT = 0;
    function sample(force) {
      var now = Date.now(); if (!force && now - lastT < 950) return; lastT = now;
      var md = B.mid(); if (!md) return;
      var step = md.m * 0.0002, n = 60, lo = md.m - step * n, vals = new Float32Array(n * 2);
      B.bids.forEach(function (q, p) { var i = Math.floor((+p - lo) / step); if (i >= 0 && i < n * 2) vals[i] += +p * q; });
      B.asks.forEach(function (q, p) { var i = Math.floor((+p - lo) / step); if (i >= 0 && i < n * 2) vals[i] += +p * q; });
      var tb = 0, ts = 0; B.trades.forEach(function (t) { if (t.b) tb += t.u; else ts += t.u; }); B.trades = [];
      var col = { t: now, m: md.m, b: md.b, a: md.a, lo: lo, step: step, v: vals, tb: tb, ts: ts };
      B.cols.push(col); if (B.cols.length > 900) B.cols.shift();
      onCol && onCol(col);
    }
    B.sample = sample;
    B.open = function (live) {
      if (!live) { var poll = function () { if (B.dead) return; snapshot().then(function () { B.ready = false; }, function (e) { onErr && onErr(e); }); }; poll(); B.timer = setInterval(poll, 30000); return; }
      try { B.ws = new WebSocket(MM.WS + '?streams=' + sym.toLowerCase() + '@depth@1000ms/' + sym.toLowerCase() + '@aggTrade'); } catch (e) { onErr && onErr(e); return; }
      var me = B.ws;
      B.ws.onopen = function () { if (!B.dead) snapshot().catch(function (e) { onErr && onErr(e); }); };
      B.ws.onmessage = function (e) {
        if (me !== B.ws || B.dead) return;
        B.bytes += e.data.length;
        var m; try { m = JSON.parse(e.data); } catch (er) { return; }
        var x = m && m.data; if (!x) return;
        if (x.e === 'depthUpdate') event(x);
        else if (x.e === 'aggTrade') { var t = { p: +x.p, u: +x.p * +x.q, b: !x.m, T: x.T }; B.trades.push(t); onTrade && onTrade(t); }
      };
      B.ws.onclose = function () { if (!B.dead && me === B.ws) { B.ready = false; setTimeout(function () { if (!B.dead) B.open(true); }, 3000); } };
      B.ws.onerror = function () { onErr && onErr(new Error('socket')); };
    };
    B.close = function () { B.dead = true; clearInterval(B.timer); if (B.ws) { try { B.ws.close(); } catch (e) { } } B.ws = null; };
    B.snap = function () {
      var bids = [], asks = [];
      B.bids.forEach(function (q, p) { bids.push([+p, q]); }); B.asks.forEach(function (q, p) { asks.push([+p, q]); });
      bids.sort(function (a, b) { return b[0] - a[0]; }); asks.sort(function (a, b) { return a[0] - b[0]; });
      return { bids: bids, asks: asks };
    };
    return B;
  }

  /* ---------------------------------------------------------------- heatmap canvas */
  function drawHeat() {
    st.raf = 0;
    var cv = st.cv, x = st.cx, dpr = st.dpr, W = st.w, H = st.h, B = st.book;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, W, H);
    var cols = B ? B.cols : [];
    var axisW = 74, plotW = W - axisW, n = Math.max(120, Math.min(600, Math.floor(plotW / 2)));
    var view = cols.slice(-n);
    /* a fresh page has only a few seconds of history: draw them wide (up to 6 px a second) and compress as it grows */
    var cw = Math.max(plotW / n, Math.min(6, plotW / Math.max(1, view.length)));
    if (!view.length) { x.fillStyle = '#9a9a94'; x.font = '600 13px Vazirmatn,sans-serif'; x.textAlign = 'center'; x.direction = MM.rtl() ? 'rtl' : 'ltr'; x.fillText(T(st.err ? 'noReach' : 'bookWait'), W / 2, H / 2); return; }
    var lastc = view[view.length - 1], mid = lastc.m;
    if (!st.center || Math.abs(mid / st.center - 1) > 0.006) st.center = mid;      /* re-centre when the price walks off */
    var span = mid * 0.0105, top = st.center + span, bot = st.center - span, Y = function (p) { return (top - p) / (top - bot) * H; };
    /* normalise by a high percentile of what is on screen, so one giant wall does not wash everything out */
    var all = []; view.forEach(function (c) { for (var i = 0; i < c.v.length; i += 3) if (c.v[i] > 0) all.push(c.v[i]); });
    all.sort(function (a, b) { return a - b; });
    var ref = all.length ? all[Math.floor(all.length * 0.985)] : 1, lref = Math.log1p(ref);
    var x0 = plotW - view.length * cw;      /* newest second at the right edge, history grows to the left (as on Bookmap) */
    if (x0 > 0) {
      var gr = x.createLinearGradient(0, 0, x0, 0); gr.addColorStop(0, '#0b0b0c'); gr.addColorStop(1, '#101116'); x.fillStyle = gr; x.fillRect(0, 0, x0, H);
      /* until the history fills the screen, the empty part shows the book as it stands now: a profile of resting
         dollars per band (bids green below the price, asks red above), pointing back from the newest column */
      var maxL = Math.min(x0 - 8, 280);
      if (maxL > 30) {
        for (var q = 0; q < lastc.v.length; q++) {
          var vq = lastc.v[q]; if (!(vq > 0)) continue;
          var pq = lastc.lo + q * lastc.step, ya = Y(pq + lastc.step), yb = Y(pq); if (yb < 0 || ya > H) continue;
          var fq = MM.clamp(Math.log1p(vq) / lref, 0, 1);
          x.fillStyle = pq + lastc.step / 2 < mid ? MM.css([52, 211, 153], 0.12 + 0.4 * fq) : MM.css([255, 90, 77], 0.12 + 0.4 * fq);
          x.fillRect(x0 - fq * maxL, ya, fq * maxL, Math.max(1, yb - ya - 0.5));
        }
      }
      if (x0 > 220) { x.fillStyle = 'rgba(236,235,230,.5)'; x.font = '500 12px Vazirmatn,"Space Grotesk",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = MM.rtl() ? 'rtl' : 'ltr'; x.fillText(T('bookGrow'), x0 / 2, 18); }
    }
    view.forEach(function (c, k) {
      var X = x0 + k * cw, nb = c.v.length;
      for (var i = 0; i < nb; i++) {
        var v = c.v[i]; if (!(v > 0)) continue;
        var p0 = c.lo + i * c.step, y1 = Y(p0), y0 = Y(p0 + c.step);
        if (y1 < 0 || y0 > H) continue;
        x.fillStyle = heat(MM.clamp(Math.log1p(v) / lref, 0, 1));
        x.fillRect(X, y0, cw + 0.6, Math.max(1, y1 - y0 + 0.6));
      }
    });
    /* price line and trades */
    x.lineWidth = 1.6; x.strokeStyle = '#f7931a'; x.beginPath();
    view.forEach(function (c, k) { var X = x0 + k * cw + cw / 2, yy = Y(c.m); if (k) x.lineTo(X, yy); else x.moveTo(X, yy); }); x.stroke();
    var tmax = 1; view.forEach(function (c) { tmax = Math.max(tmax, c.tb, c.ts); });
    view.forEach(function (c, k) {
      var X = x0 + k * cw + cw / 2, yy = Y(c.m);
      if (c.tb > 0) { x.fillStyle = MM.css([52, 211, 153], 0.75); x.beginPath(); x.arc(X, yy - 1, 1.5 + 9 * Math.sqrt(c.tb / tmax), 0, 6.283); x.fill(); }
      if (c.ts > 0) { x.fillStyle = MM.css([255, 90, 77], 0.75); x.beginPath(); x.arc(X, yy + 1, 1.5 + 9 * Math.sqrt(c.ts / tmax), 0, 6.283); x.fill(); }
    });
    /* price axis */
    x.fillStyle = '#0e0e10'; x.fillRect(plotW, 0, axisW, H);
    x.font = '500 10.5px "Space Grotesk",sans-serif'; x.fillStyle = '#9a9a94'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.direction = 'ltr';
    for (var j = 1; j < 8; j++) { var p = bot + (top - bot) * j / 8, yy = Y(p); x.fillRect(plotW, yy, 4, 1); x.fillText(MM.fmtP(p).slice(1), plotW + 7, yy); }
    var ym = Y(mid); x.fillStyle = '#f7931a'; x.fillRect(plotW, ym - 9, axisW, 18); x.fillStyle = '#111'; x.font = '700 10.5px "Space Grotesk",sans-serif'; x.fillText(MM.fmtP(mid).slice(1), plotW + 6, ym);
    /* time hint */
    var ago = T('secAgo', { n: MM.loc(Math.round((lastc.t - view[0].t) / 1000)) });
    x.fillStyle = 'rgba(236,235,230,.55)'; x.font = '500 10.5px "Space Grotesk",Vazirmatn,sans-serif'; x.textAlign = 'left'; x.direction = 'ltr';
    var aw = x.measureText('← ').width, tw = aw + x.measureText(ago).width;
    var tx = x0 > tw + 16 ? x0 - tw - 8 : 6;      /* label the oldest column: just left of it, or at the edge once the screen is full */
    x.fillText('←', tx, H - 9); tx += aw;
    x.direction = MM.rtl() ? 'rtl' : 'ltr'; x.fillText(ago, tx, H - 9); x.direction = 'ltr';
  }
  function kick() { if (st && !st.raf) st.raf = requestAnimationFrame(drawHeat); }
  function sizeHeat() {
    var r = st.hbox.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.w = Math.max(240, Math.floor(r.width)); st.h = Math.max(220, Math.floor(r.height)); st.dpr = dpr;
    st.cv.width = Math.round(st.w * dpr); st.cv.height = Math.round(st.h * dpr); st.cv.style.width = st.w + 'px'; st.cv.style.height = st.h + 'px';
    kick();
  }

  /* ---------------------------------------------------------------- depth panel (numbers from the live book) */
  var lastDepth = 0;
  function depth() {
    var now = Date.now(); if (now - lastDepth < 2000 || !st.book) return; lastDepth = now;
    var box = d.getElementById('mm-depth'); if (!box || !MM.panel) return;
    var s = MM.panel.bookStats(st.book.snap()); if (!s) return;
    MM.panel.drawBook({ bids: s.bids.map(function (x) { return [x[0], x[1]]; }), asks: s.asks.map(function (x) { return [x[0], x[1]]; }) });
    var u = d.getElementById('mm-liq-used'); if (u && st.book.bytes) u.textContent = T('dataUsed', { v: MM.loc((st.book.bytes / 1048576).toFixed(1)) });
  }

  /* ---------------------------------------------------------------- liquidations stream */
  function liqStart() {
    if (st.lws || MM.saver() || !('WebSocket' in window)) return;
    var L = st.liq = st.liq || { long: 0, short: 0, n: 0, by: {}, list: [], since: Date.now() };
    try { st.lws = new WebSocket(FSTREAM); } catch (e) { return; }
    var me = st.lws;
    st.lws.onmessage = function (e) {
      if (!st || me !== st.lws) return;
      var m; try { m = JSON.parse(e.data); } catch (er) { return; }
      var o = m && m.o; if (!o) return;
      var usd = +(o.ap || o.p) * +(o.z || o.q), sym = String(o.s || '').replace(/USDT$|USDC$|BUSD$/, ''), longLiq = o.S === 'SELL';
      if (!(usd > 0)) return;
      if (longLiq) L.long += usd; else L.short += usd; L.n++;
      var b = L.by[sym] = L.by[sym] || { l: 0, s: 0 }; if (longLiq) b.l += usd; else b.s += usd;
      L.list.unshift({ s: sym, u: usd, long: longLiq, p: +(o.ap || o.p), t: o.T || m.E }); L.list.length = Math.min(L.list.length, 30);
      liqDraw();
    };
    st.lws.onclose = function () { if (st && me === st.lws) { st.lws = null; setTimeout(function () { if (st && !d.hidden) liqStart(); }, 5000); } };
  }
  function liqStop() { if (st && st.lws) { var w = st.lws; st.lws = null; try { w.close(); } catch (e) { } } }
  var liqT = 0;
  function liqDraw() {
    var now = Date.now(); if (now - liqT < 500) { if (!st.liqLater) st.liqLater = setTimeout(function () { if (st) { st.liqLater = 0; liqDraw(); } }, 520); return; } liqT = now;
    var box = d.getElementById('mm-liqs'); if (!box || !st.liq) return;
    var L = st.liq, tot = L.long + L.short;
    var top = Object.keys(L.by).map(function (k) { return { s: k, v: L.by[k].l + L.by[k].s, l: L.by[k].l, sh: L.by[k].s }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    var mx = top.length ? top[0].v : 1;
    box.innerHTML = '<div class="mm-kpis sm"><div class="mm-kpi dn"><small>' + esc(T('liqLong')) + '</small><b class="mm-n">' + MM.fmtUsd(L.long) + '</b></div><div class="mm-kpi up"><small>' + esc(T('liqShort')) + '</small><b class="mm-n">' + MM.fmtUsd(L.short) + '</b></div>' +
      '<div class="mm-kpi"><small>' + esc(T('liqN')) + '</small><b class="mm-n">' + MM.loc(L.n) + '</b><span>' + esc(T('since', { t: MM.ago(L.since) })) + '</span></div></div>' +
      (tot ? '<i class="mm-brbar big"><i style="width:' + (L.long / tot * 100).toFixed(1) + '%;background:' + MM.dnc() + '"></i></i>' : '') +
      '<div class="mm-two"><ol class="mm-lead">' + (top.map(function (r) {
        return '<li><span class="mm-lb">' + (D.by[r.s] ? MM.logo(r.s, 18) : '') + '<b>' + esc(r.s) + '</b></span><span class="mm-lbar"><i style="width:' + (r.l / mx * 100).toFixed(1) + '%;background:' + MM.dnc() + '"></i><i style="width:' + (r.sh / mx * 100).toFixed(1) + '%;background:' + MM.upc() + '"></i></span><span class="mm-n">' + MM.fmtUsd(r.v) + '</span></li>';
      }).join('') || '<li class="mm-empty">' + esc(T('liqWait')) + '</li>') + '</ol>' +
      '<ol class="mm-trl">' + L.list.slice(0, 12).map(function (x) {
        return '<li class="' + (x.long ? 'dn' : 'up') + '"><span>' + esc(T(x.long ? 'liqL1' : 'liqS1')) + '</span><b>' + esc(x.s) + '</b><b class="mm-n">' + MM.fmtUsd(x.u) + '</b><small class="mm-n">' + MM.fmtP(x.p) + '</small><small class="mm-n">' + new Date(x.t).toTimeString().slice(0, 8) + '</small></li>';
      }).join('') + '</ol></div>';
  }

  /* ---------------------------------------------------------------- market liquidity table (CI) */
  var sortK = 'd2', sortDir = -1;
  function table() {
    var box = d.getElementById('mm-ltab'); if (!box) return;
    var f = D.flow && D.flow.f; if (!f) { box.innerHTML = '<p class="mm-p-note">' + esc(T('noData')) + '</p>'; return; }
    var rows = D.coins.filter(function (c) { return f[c.s] && (f[c.s].bk || f[c.s].dp) && c.sec !== 'stable' && c.sec !== 'wrapped'; }).map(function (c) {
      var x = f[c.s], bk = x.bk, dp = x.dp;
      return { c: c, sp: bk ? bk[0] : null, tob: bk ? bk[1] + bk[2] : null, d1: dp ? dp.b1 + dp.a1 : null, d2: dp ? dp.b2 + dp.a2 : null, im: dp && dp.b2 + dp.a2 ? (dp.b2 - dp.a2) / (dp.b2 + dp.a2) * 100 : null, rng: dp ? dp.rng : null, t: dp ? dp.t : null, to: c.v && c.mc ? c.v / c.mc * 100 : null };
    });
    rows.sort(function (a, b) { var x = a[sortK], y = b[sortK]; if (x == null) return 1; if (y == null) return -1; return (x - y) * sortDir; });
    var th = function (k, lbl) { return '<th><button type="button" data-sort="' + k + '" class="' + (sortK === k ? 'on' : '') + '">' + esc(lbl) + (sortK === k ? (sortDir < 0 ? ' ↓' : ' ↑') : '') + '</button></th>'; };
    box.innerHTML = '<div class="mm-tw"><table class="mm-ft mm-sort"><thead><tr><th>' + esc(T('coin')) + '</th>' + th('sp', T('spread')) + th('tob', T('tob')) + th('d1', '±1%') + th('d2', '±2%') + th('im', T('imb2')) + th('to', T('turnover')) + '</tr></thead><tbody>' +
      rows.slice(0, 60).map(function (r) {
        var part = r.rng != null && r.rng < 2;
        return '<tr><td><button type="button" class="mm-lnk" data-pick="' + r.c.s + '">' + MM.logo(r.c.s, 18) + esc(r.c.s) + '</button></td><td class="mm-n">' + (r.sp == null ? '—' : r.sp.toFixed(2) + ' bps') + '</td><td class="mm-n">' + MM.fmtUsd(r.tob) + '</td>' +
          '<td class="mm-n">' + MM.fmtUsd(r.d1) + (r.rng != null && r.rng < 1 ? '+' : '') + '</td><td class="mm-n">' + MM.fmtUsd(r.d2) + (part ? '+' : '') + '</td><td class="mm-n ' + MM.cls(r.im) + '">' + MM.fmtPct(r.im, 0) + '</td><td class="mm-n">' + (r.to == null ? '—' : r.to.toFixed(1) + '%') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="mm-p-note">' + esc(T('ltabNote', { t: MM.fmtDate(D.flow.t, true) })) + '</p>';
  }

  /* ---------------------------------------------------------------- page */
  function chips() {
    var cur = st.sym, list = D.coins.filter(function (c) { return c.bn && c.sec !== 'stable' && c.sec !== 'wrapped'; }).slice(0, 14);
    if (!list.some(function (c) { return c.s === cur; }) && D.by[cur]) list.unshift(D.by[cur]);
    return list.map(function (c) { return '<button type="button" class="mm-chip' + (c.s === cur ? ' on' : '') + '" data-pick="' + c.s + '">' + MM.logo(c.s, 16) + esc(c.s) + '</button>'; }).join('');
  }
  function pick(s) {
    var c = D.by[s]; if (!c || !c.bn) return;
    st.sym = s; MM.store.set('ek_mm_liq', s);
    var cb = d.getElementById('mm-lchips'); if (cb) cb.innerHTML = chips();
    var tt = d.getElementById('mm-lhead'); if (tt) tt.innerHTML = MM.logo(s, 26) + '<b>' + esc(c.n) + '</b><small>' + esc(c.s) + '/USDT · Binance</small>';
    if (st.book) st.book.close();
    st.center = 0; st.err = null; lastDepth = 0;
    var live = !MM.saver() && 'WebSocket' in window;
    st.book = Book(c.bn, function () { kick(); depth(); }, function () { kick(); depth(); }, null, function () { st && (st.err = 1); kick(); });
    st.book.open(live);
    var note = d.getElementById('mm-lmode'); if (note) note.textContent = T(live ? 'liveBook' : 'saverBook');
    kick();
  }
  V.mount = function (stage) {
    st = { sym: MM.store.get('ek_mm_liq', 'BTC'), raf: 0 };
    st.box = h('<div class="mm-dash mm-liq">' +
      '<section class="mm-card"><div class="mm-ch"><h3 id="mm-lhead"></h3><div class="mm-lfind">' + MM.ic('search') + '<input type="search" id="mm-lq" placeholder="' + esc(T('find')) + '" autocomplete="off"></div></div>' +
      '<div class="mm-chips" id="mm-lchips"></div>' +
      '<div class="mm-ltop"><div><h4>' + esc(T('heatT')) + '</h4><p class="mm-sub">' + esc(T('heatSub')) + '</p></div><span class="mm-p-note" id="mm-lmode"></span><span class="mm-p-note" id="mm-liq-used"></span></div>' +
      '<div class="mm-heat" id="mm-heat"><canvas role="img" aria-label="' + esc(T('heatT')) + '"></canvas></div>' +
      '<div class="mm-lgd"><span><i class="mm-hg"></i>' + esc(T('heatLeg')) + '</span><span><i style="background:#f7931a"></i>' + esc(T('priceLine')) + '</span><span><i style="background:' + MM.upc() + ';border-radius:50%"></i>' + esc(T('buys')) + '</span><span><i style="background:' + MM.dnc() + ';border-radius:50%"></i>' + esc(T('sells')) + '</span></div></section>' +
      '<div class="mm-two cards"><section class="mm-card"><div class="mm-ch"><h3>' + esc(T('depth2')) + '</h3></div><div id="mm-depth" class="mm-depth"><div class="mm-wait">' + esc(T('loading')) + '</div></div><div id="mm-bk"></div></section>' +
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('liqT')) + '</h3></div><p class="mm-sub">' + esc(T('liqSub')) + '</p><div id="mm-liqs"><div class="mm-wait">' + esc(T(MM.saver() ? 'saverNoLiq' : 'liqWait')) + '</div></div></section></div>' +
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('ltabT')) + '</h3></div><p class="mm-sub">' + esc(T('ltabSub')) + '</p><div id="mm-ltab"><div class="mm-wait">' + esc(T('loading')) + '</div></div></section>' +
      '<section class="mm-card mm-howto"><h3>' + esc(T('howT')) + '</h3><ul>' + ['lhow1', 'lhow2', 'lhow3', 'lhow4'].map(function (k) { return '<li>' + esc(T(k)) + '</li>'; }).join('') + '</ul></section></div>');
    stage.appendChild(st.box);
    st.hbox = d.getElementById('mm-heat'); st.cv = st.hbox.querySelector('canvas'); st.cx = st.cv.getContext('2d', { alpha: false });
    sizeHeat();
    st.ro = new ResizeObserver(MM.debounce(function () { if (st) sizeHeat(); }, 80)); st.ro.observe(st.hbox);
    st.box.addEventListener('click', function (e) {
      var p = e.target.closest('[data-pick]'); if (p) { pick(p.getAttribute('data-pick')); st.hbox.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      var so = e.target.closest('[data-sort]'); if (so) { var k = so.getAttribute('data-sort'); if (k === sortK) sortDir = -sortDir; else { sortK = k; sortDir = k === 'sp' ? 1 : -1; } table(); }
    });
    var q = d.getElementById('mm-lq');
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var c = MM.findCoin(q.value); if (c && c.bn) { pick(c.s); q.value = ''; } else MM.toast(T('noBnCoin')); } });
    st.onVis = function () { if (d.hidden) { if (st.book) st.book.close(); liqStop(); } else { pick(st.sym); liqStart(); } };
    d.addEventListener('visibilitychange', st.onVis);
    Promise.all([MM._boot, MM.loadScript(MM.asset('panel.js'))]).then(function () {
      if (!st) return;
      if (!D.by[st.sym] || !D.by[st.sym].bn) st.sym = 'BTC';
      d.getElementById('mm-lchips').innerHTML = chips();
      pick(st.sym); liqStart();
      MM.loadFlow().then(function () { if (st) table(); }, function () { if (st) table(); });
      MM.getJSON('/data/derivatives.json', 15000).then(function (j) {
        if (!st || st.liq && st.liq.n) return;
        var parts = ['BTC', 'ETH', 'SOL'].map(function (k) { var q = j[k] && j[k].liq; return q ? k + ' ' + MM.fmtUsd((q.long_usd_24h || 0) + (q.short_usd_24h || 0)) : null; }).filter(Boolean);
        var box = d.getElementById('mm-liqs'); if (box && parts.length && !(st.liq && st.liq.n)) box.insertAdjacentHTML('beforeend', '<p class="mm-p-note">' + esc(T('liq24', { v: parts.join(' · ') })) + '</p>');
      }, function () { });
    });
  };
  V.resize = function () { if (st) sizeHeat(); };
  V.canvas = function () { if (!st) return null; drawHeat(); return st.cv; };
  V.unmount = function () {
    if (!st) return;
    if (st.book) st.book.close(); liqStop(); clearTimeout(st.liqLater);
    if (st.ro) st.ro.disconnect(); if (st.raf) cancelAnimationFrame(st.raf);
    d.removeEventListener('visibilitychange', st.onVis);
    st = null;
  };
})();
