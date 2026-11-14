/* entekhab.net — the Observatory: /charts/options/ — Bitcoin and Ether options on Deribit.
   Data, read in the visitor's browser from Deribit's public API (www.deribit.com, no key):
     get_book_summary_by_currency   every option's open interest, 24-hour volume and mark IV (one request)
     get_volatility_index_data      DVOL, Deribit's 30-day implied-volatility index, as candles (pages back in time)
     get_delivery_prices            the index price at 08:00 UTC of each day, 100 days a page (the price under DVOL)
   Arithmetic: assets/obs/optmath.js (put/call, notional, max pain, at-the-money IV, delta, 25-delta IV, risk reversal,
   butterfly — each defined at its head). Views: open interest by strike and by expiry, DVOL, the smile of one expiry,
   and the term structure (at-the-money and 25-delta IV of every expiry).
   Deribit holds most of the crypto options market but not all of it: CME and the options of other exchanges are not
   here, and the page says so. Max pain is arithmetic on open interest, not a forecast. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, clamp = OB.clamp, d = document, w = window, M = w.OBOpt;
  var DB = 'https://www.deribit.com/api/v2/public/', H = 3600000, DAY = 86400000;
  var INK = '#e8e8e3', ACC = '#f7931a', GRN = '#34d399', RED = '#ff5a4d', FONT = '11px "Space Grotesk", system-ui, sans-serif';
  var MIN_OI = { BTC: 500, ETH: 5000 };                 /* an expiry counts as "the next one" from this open interest on (scripts/lab.py's rule) */
  var DV_R = [{ k: '1m', res: '3600', span: 30 * DAY }, { k: '3m', res: '43200', span: 91 * DAY }, { k: '1y', res: '1D', span: 365 * DAY }, { k: 'all', res: '1D', span: 0 }];
  var DV0 = Date.UTC(2021, 2, 24);                      /* DVOL begins */

  var DEF = { cur: 'BTC', view: 'strike', unit: 'coin', win: 'near', dr: '3m' };
  var S = (function () {
    var s = OB.store.get('ek_obs_op', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search);
    if (/^(BTC|ETH)$/.test(q.get('coin') || '')) o.cur = q.get('coin');
    if (/^(strike|expiry|dvol|smile|term)$/.test(q.get('view') || '')) o.view = q.get('view');
    if (/^(1m|3m|1y|all)$/.test(q.get('range') || '')) o.dr = q.get('range');
    o.exp = /^\d{1,2}[A-Z]{3}\d{2}$/.test(q.get('exp') || '') ? q.get('exp') : 'all';
    return o;
  })();
  var save = OB.debounce(function () { var c = Object.assign({}, S); delete c.exp; OB.store.set('ek_obs_op', c); }, 300);
  var BLU = '#3987e5';
  var V = { el: null, chart: null, kind: null, book: null, term: null, dv: {}, dvNow: null, seq: 0, dseq: 0, loading: false, timer: null, sub: '', at: 0 };

  /* ================================================================ Deribit */
  function rpc(path) { return OB.getJSON(DB + path, 30000).then(function (j) { if (!j || j.result == null) throw new Error('deribit'); return j.result; }); }
  function loadBook(cur) { return rpc('get_book_summary_by_currency?currency=' + cur + '&kind=option').then(function (rows) { if (!Array.isArray(rows)) throw new Error('deribit'); return M.build(rows, Date.now()); }); }
  function dvolPage(cur, t0, t1, res) { return rpc('get_volatility_index_data?currency=' + cur + '&start_timestamp=' + t0 + '&end_timestamp=' + t1 + '&resolution=' + res); }
  /* DVOL candles [t, o, h, l, c] from t0 to now, oldest first: Deribit pages backwards through `continuation` */
  function loadDvol(cur, t0, res) {
    var out = [], pages = 0;
    function step(end) {
      return dvolPage(cur, t0, end, res).then(function (r) {
        var a = (r && r.data) || []; out = a.concat(out); pages++;
        if (r && r.continuation && r.continuation > t0 && a.length && pages < 8) return step(r.continuation);
        var seen = {}, rows = [];
        out.forEach(function (x) { if (x && x.length >= 5 && !seen[x[0]] && x[0] >= t0) { seen[x[0]] = 1; rows.push([+x[0], +x[1], +x[2], +x[3], +x[4]]); } });
        rows.sort(function (a2, b2) { return a2[0] - b2[0]; });
        return rows;
      });
    }
    return step(Date.now());
  }
  /* the index at 08:00 UTC of each day back to t0: [[t, price], …] oldest first (100 days a page) */
  function loadDelivery(cur, t0) {
    var days = Math.ceil((Date.now() - t0) / DAY) + 1, pages = Math.min(30, Math.ceil(days / 100)), tasks = [];
    for (var i = 0; i < pages; i++) (function (off) { tasks.push(function () { return rpc('get_delivery_prices?index_name=' + cur.toLowerCase() + '_usd&count=100&offset=' + off); }); })(i * 100);
    return OB.pool(tasks, 3).then(function (parts) {
      var seen = {}, rows = [];
      parts.forEach(function (p) { ((p && p.data) || []).forEach(function (x) { var t = Date.parse(x.date + 'T08:00:00Z'); if (isFinite(t) && t >= t0 && !seen[t] && x.delivery_price > 0) { seen[t] = 1; rows.push([t, +x.delivery_price]); } }); });
      rows.sort(function (a, b) { return a[0] - b[0]; });
      return rows;
    });
  }

  /* ================================================================ a bar chart over categories (strikes, expiries) */
  function nice(span, n) { var raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
  function Bars(stage) {
    var self = this;
    this.stage = stage;
    stage.innerHTML = '<div class="ob-ts-top"><div class="ob-ts-lgd"></div></div><div class="ob-ts-w ob-bars-w"><canvas class="ob-cv" tabindex="0" role="img"></canvas><div class="ob-tip" hidden></div></div>';
    this.wrap = stage.querySelector('.ob-ts-w'); this.cv = stage.querySelector('canvas'); this.ctx = this.cv.getContext('2d'); this.tip = stage.querySelector('.ob-tip'); this.lg = stage.querySelector('.ob-ts-lgd');
    this.o = null; this.hover = -1;
    this.onResize = function () { self.size(); self.draw(); };
    OB.on('resize', this.onResize);
    if (w.ResizeObserver) { this.ro = new ResizeObserver(OB.debounce(this.onResize, 60)); this.ro.observe(this.wrap); }
    function at(e) { var r = self.cv.getBoundingClientRect(), G = self._G; if (!G || !self.o) return -1; var x = e.clientX - r.left, i = Math.floor((x - G.L) / G.slot); return x < G.L || i < 0 || i >= self.o.cats.length ? -1 : i; }
    this.cv.addEventListener('pointermove', function (e) { var i = at(e); if (i !== self.hover) { self.hover = i; self.draw(); } self.showTip(e); });
    this.cv.addEventListener('pointerdown', function (e) { self.hover = at(e); self.draw(); self.showTip(e); });
    this.cv.addEventListener('pointerleave', function () { self.hover = -1; self.tip.hidden = true; self.draw(); });
    this.cv.addEventListener('keydown', function (e) {
      if (!self.o || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      self.hover = clamp((self.hover < 0 ? 0 : self.hover) + (e.key === 'ArrowLeft' ? -1 : 1), 0, self.o.cats.length - 1); self.draw(); self.showTip(null); e.preventDefault();
    });
    this.size();
  }
  Bars.prototype.destroy = function () { if (this.ro) this.ro.disconnect(); OB.off('resize', this.onResize); this.dead = true; };
  Bars.prototype.size = function () {
    var r = this.wrap.getBoundingClientRect(), dpr = Math.min(2.5, w.devicePixelRatio || 1);
    this.W = Math.max(260, Math.floor(r.width)); this.H = Math.max(200, Math.floor(r.height)); this.dpr = dpr;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr); this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
  };
  /* o: { cats: [label…], series: [{ name, color, data: [v…], line? }], stacked, vmarks: [{ pos, color, label }], fmt(v), label, tip(i) → html }
     A series with line: true is drawn as a line through the middle of each category (a missing value breaks it); when every
     series is a line the value axis starts near the lowest value instead of at zero (implied volatility never nears zero). */
  Bars.prototype.set = function (o) {
    this.o = o; this.hover = -1; this.tip.hidden = true;
    this.lg.innerHTML = o.series.map(function (s) { return '<span class="ob-lk"><i class="' + (s.line ? 'ln' : 'box') + '" style="background:' + esc(s.color) + '"></i><span>' + esc(s.name) + '</span></span>'; }).join('') +
      (o.vmarks || []).map(function (m) { return '<span class="ob-lk"><i class="ln" style="background:' + esc(m.color) + '"></i><span>' + esc(m.label) + '</span></span>'; }).join('');
    this.cv.setAttribute('aria-label', o.label || ''); this.draw();
  };
  Bars.prototype.draw = function (target) {
    if (this.dead) return;
    var ctx = target ? target.ctx : this.ctx, dpr = target ? target.dpr : this.dpr, W = this.W, Hh = this.H, o = this.o;
    ctx.setTransform(dpr, 0, 0, dpr, 0, target ? (target.oy || 0) * dpr : 0);
    ctx.clearRect(0, 0, W, Hh); ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, W, Hh); ctx.direction = 'ltr';        /* every label on this chart is a number or a Latin date */
    if (!o || !o.cats.length) return;
    var n = o.cats.length, ns = o.series.length, fmt = o.fmt || OB.compact, max = 0, min = Infinity, i, k;
    var allLines = o.series.every(function (s2) { return s2.line; });
    for (i = 0; i < n; i++) { var tot = 0; for (k = 0; k < ns; k++) { var v = o.series[k].data[i]; if (v == null || !isFinite(v)) continue; if (v < min) min = v; tot += v > 0 ? v : 0; if ((!o.stacked || o.series[k].line) && v > max) max = v; } if (o.stacked && tot > max) max = tot; }
    if (!(max > 0)) max = 1;
    var lo = 0, top = max * 1.08;
    if (allLines && isFinite(min)) { var pad = Math.max((max - min) * 0.12, Math.abs(max) * 0.02, 0.5); lo = min - pad; top = max + pad; }
    ctx.font = FONT;
    var axis = Math.max(46, Math.ceil(ctx.measureText(fmt(top)).width) + 18), L = 8, Tp = 10, B = 26, pw = W - L - axis, ph = Hh - Tp - B, slot = pw / n;
    this._G = { L: L, slot: slot, T: Tp, ph: ph, pw: pw };
    function Y(v2) { return Tp + ph - (v2 - lo) / (top - lo) * ph; }
    ctx.fillStyle = '#0d0d11'; ctx.fillRect(L, Tp, pw, ph);
    if (this.hover >= 0 && !target) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(L + this.hover * slot, Tp, slot, ph); }
    /* grid and value axis */
    var st = nice(top - lo, Math.max(2, Math.floor(ph / 52)));
    ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#b9b9b3'; ctx.beginPath();
    for (var gv = Math.ceil(lo / st) * st; gv <= top + st * 1e-9; gv += st) { var gy = Math.round(Y(gv)) + 0.5; if (gy < Tp + 2) break; ctx.moveTo(L, gy); ctx.lineTo(L + pw, gy); ctx.fillText(fmt(gv), L + pw + 8, gy); }
    ctx.stroke();
    /* bars */
    var gw = Math.max(1, slot * 0.78), bw = o.stacked ? gw : gw / ns;
    for (i = 0; i < n; i++) {
      var x0 = L + i * slot + (slot - gw) / 2, acc = 0;
      for (k = 0; k < ns; k++) {
        if (o.series[k].line) continue;
        var val = o.series[k].data[i] || 0; if (!(val > 0)) continue;
        ctx.fillStyle = o.series[k].color;
        if (o.stacked) { var y1 = Y(acc + val), y0 = Y(acc); ctx.fillRect(x0, y1, Math.max(1, bw), Math.max(0.5, y0 - y1)); acc += val; }
        else { var yy = Y(val); ctx.fillRect(x0 + k * bw, yy, Math.max(1, bw - (bw > 4 ? 1 : 0)), Math.max(0.5, Tp + ph - yy)); }
      }
    }
    /* lines through the middle of each category */
    o.series.forEach(function (s3) {
      if (!s3.line) return;
      ctx.save(); ctx.strokeStyle = s3.color; ctx.fillStyle = s3.color; ctx.lineWidth = s3.width || 1.8; ctx.setLineDash(s3.dash || []); ctx.beginPath();
      var on = false;
      for (var j = 0; j < n; j++) {
        var v3 = s3.data[j]; if (v3 == null || !isFinite(v3)) { on = false; continue; }
        var x3 = L + (j + 0.5) * slot, y3 = Y(v3);
        if (on) ctx.lineTo(x3, y3); else ctx.moveTo(x3, y3); on = true;
      }
      ctx.stroke(); ctx.setLineDash([]);
      for (var j2 = 0; j2 < n; j2++) { var v4 = s3.data[j2]; if (v4 == null || !isFinite(v4)) continue; ctx.beginPath(); ctx.arc(L + (j2 + 0.5) * slot, Y(v4), n > 40 ? 1.6 : 2.6, 0, 6.2832); ctx.fill(); }
      ctx.restore();
    });
    /* category labels: as many as fit */
    ctx.fillStyle = '#b9b9b3'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var mw = 0; for (i = 0; i < n; i++) mw = Math.max(mw, ctx.measureText(o.cats[i]).width);
    var every = Math.max(1, Math.ceil((mw + 12) / slot));
    for (i = 0; i < n; i += every) ctx.fillText(o.cats[i], L + (i + 0.5) * slot, Tp + ph + 7);
    /* vertical marks (index price, max pain) */
    (o.vmarks || []).forEach(function (m) {
      if (m.pos == null) return;
      var x = Math.round(L + (m.pos + 0.5) * slot) + 0.5;
      ctx.save(); ctx.strokeStyle = m.color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x, Tp); ctx.lineTo(x, Tp + ph); ctx.stroke(); ctx.restore();
    });
  };
  Bars.prototype.showTip = function (e) {
    var o = this.o, G = this._G, i = this.hover, tip = this.tip;
    if (!o || !G || i < 0 || !o.tip) { tip.hidden = true; return; }
    tip.innerHTML = o.tip(i); tip.hidden = false; tip.setAttribute('dir', OB.rtl() ? 'rtl' : 'ltr');
    var cx = G.L + (i + 0.5) * G.slot, tw = tip.offsetWidth, th = tip.offsetHeight, lx = cx + 14, ly = 14;
    if (lx + tw > this.W - 6) lx = cx - 14 - tw;
    if (e) { var r = this.cv.getBoundingClientRect(); ly = clamp(e.clientY - r.top - th - 12, 6, Math.max(6, this.H - th - 6)); }
    tip.style.left = clamp(lx, 4, Math.max(4, this.W - tw - 4)) + 'px'; tip.style.top = ly + 'px';
  };
  Bars.prototype.png = function (title, sub, file) {
    if (!this.o) return;
    var dpr = 2, head = 46, c = d.createElement('canvas'); c.width = this.W * dpr; c.height = (this.H + head) * dpr;
    var ctx = c.getContext('2d'); ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, c.width, c.height);
    this.draw({ ctx: ctx, dpr: dpr, oy: head });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f2f2ee'; ctx.font = '700 16px "Space Grotesk", Vazirmatn, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(title || '', 14, 17);
    ctx.fillStyle = '#9a9a94'; ctx.font = '11px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(sub || '', 14, 35);
    ctx.fillStyle = '#f7931a'; ctx.font = '700 15px "Space Grotesk", system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('entekhab.net', this.W - 14, 23);
    this.draw();
    c.toBlob(function (b) { if (!b) return; var u = URL.createObjectURL(b), a = d.createElement('a'); a.href = u; a.download = file || 'entekhab-chart.png'; d.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }, 'image/png');
  };
  OB.Bars = Bars;

  /* ================================================================ text */
  /* a strike for the axis: 70000 → 70K · 72500 → 72.5K · 1714.29 → 1.71K · 0.55 → 0.55 */
  function kTxt(k) { if (k < 1000) return String(+k.toFixed(4)); var t = (k / 1000).toFixed(2); if (t.indexOf('.') >= 0) t = t.replace(/0+$/, '').replace(/\.$/, ''); return t + 'K'; }
  function px(v) { return v == null ? '—' : '$' + Math.round(v).toLocaleString('en-US'); }
  function f2(v) { return v == null || !isFinite(v) ? '—' : v.toFixed(2); }
  function pct(v, dp) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(dp == null ? 1 : dp) + '%'; }
  var MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function expShort(e) { var t = new Date(e.ts), y = t.getUTCFullYear() !== new Date().getUTCFullYear(); return t.getUTCDate() + ' ' + MN[t.getUTCMonth()] + (y ? ' ' + String(t.getUTCFullYear()).slice(2) : ''); }
  function expLong(e) { return OB.fmtDate(e.ts); }
  function amount(coins) { return S.unit === 'usd' && V.book && V.book.index ? coins * V.book.index : coins; }
  function amtTxt(coins) { return S.unit === 'usd' && V.book && V.book.index ? OB.fmtUsd(coins * V.book.index) : OB.compact(coins) + ' ' + S.cur; }
  function tile(label, value, sub) { return '<div class="ob-tile"><small>' + esc(label) + '</small><b class="ob-n">' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; }
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }
  function nextExp(B) { for (var i = 0; i < B.exps.length; i++) if (B.exps[i].oi > (MIN_OI[S.cur] || 0)) return B.exps[i]; return B.exps.filter(function (e) { return e.oi > 0; })[0] || null; }
  function expByCode(B, code) { for (var i = 0; i < B.exps.length; i++) if (B.exps[i].code === code) return B.exps[i]; return null; }

  /* ================================================================ render */
  function tiles() {
    var B = V.book, h = '', t = B.tot, e = nextExp(B), dn = V.dvNow;
    h += tile(T('ot_oi'), esc(t.notional == null ? OB.compact(t.oi) + ' ' + S.cur : OB.fmtUsd(t.notional)), esc(T('ot_oi_s', { n: OB.ltr(OB.compact(t.oi) + ' ' + S.cur), c: OB.ltr(OB.compact(t.c.oi)), p: OB.ltr(OB.compact(t.p.oi)) })));
    h += tile(T('ot_pc'), f2(t.pcOi), t.pcVol == null ? '' : esc(T('ot_pcv', { v: OB.ltr(f2(t.pcVol)) })));
    h += tile(T('ot_dvol'), dn ? dn.now.toFixed(1) : '—', dn && dn.d1 != null ? esc(T('ot_dvol_s', { v: OB.ltr((dn.d1 > 0 ? '+' : dn.d1 < 0 ? '-' : '') + Math.abs(dn.d1).toFixed(1)) })) : '');
    h += tile(e ? T('ot_mp', { e: expLong(e) }) : T('o_mp'), e && e.maxPain != null ? esc(px(e.maxPain)) : '—', e && e.mpDist != null ? esc(T('ot_mp_s', { p: OB.ltr(pct(e.mpDist)) })) : '');
    var rr = V.term ? M.atDays(V.term, 'rr', 30) : null, atm = V.term ? M.atDays(V.term, 'atm', 30) : null;
    h += tile(T('ot_rr'), esc(rr == null ? '—' : pct(rr, 1)), atm == null ? '' : esc(T('ot_rr_s', { v: OB.ltr(atm.toFixed(1) + '%') })) + (rr == null ? '' : ' · ' + esc(T(rr < 0 ? 'rr_puts' : 'rr_calls'))));
    $('#ob-tiles', V.el).innerHTML = h;
  }
  function termOf(code) { var t = V.term || []; for (var i = 0; i < t.length; i++) if (t[i].code === code) return t[i]; return null; }
  function rrOf(code) { var x = termOf(code); return x && x.rr != null ? pct(x.rr, 1) : '—'; }
  /* the expiry the smile shows: the one asked for, else the next one with real open interest and at least a day left */
  function smileExp(B) {
    var e = S.exp !== 'all' ? expByCode(B, S.exp) : null;
    if (e && termOf(e.code)) return e;
    for (var i = 0; i < B.exps.length; i++) if (B.exps[i].oi > (MIN_OI[S.cur] || 0) && termOf(B.exps[i].code)) return B.exps[i];
    return (V.term && V.term.length) ? expByCode(B, V.term[0].code) : null;
  }
  function table() {
    var B = V.book, rows = B.exps.filter(function (e) { return e.oi > 0; }).map(function (e) {
      return '<tr' + (S.exp === e.code ? ' class="on"' : '') + '><td><button type="button" class="ob-rowc" data-exp="' + esc(e.code) + '"><b>' + esc(expShort(e)) + '</b></button></td><td class="ob-n">' + (e.days < 1 ? e.days.toFixed(1) : Math.round(e.days)) +
        '</td><td class="ob-n">' + esc(OB.compact(e.c.oi)) + '</td><td class="ob-n">' + esc(OB.compact(e.p.oi)) + '</td><td class="ob-n">' + f2(e.pc) + '</td><td class="ob-n">' + esc(e.notional == null ? '—' : OB.fmtUsd(e.notional)) +
        '</td><td class="ob-n">' + esc(px(e.maxPain)) + (e.mpDist == null ? '' : ' <small>' + esc(pct(e.mpDist)) + '</small>') + '</td><td class="ob-n">' + (e.atmIv == null ? '—' : e.atmIv.toFixed(1) + '%') + '</td><td class="ob-n">' + esc(rrOf(e.code)) + '</td></tr>';
    }).join('');
    var tb = $('#ob-tbl', V.el);
    tb.innerHTML = '<h3>' + esc(T('tbl_exp', { coin: S.cur })) + '</h3><p class="ob-note ob-small">' + esc(T('tbl_exp_n')) + '</p><div class="ob-tblw"><table class="ob-grid" id="ob-etbl"><thead><tr><th>' + esc(T('th_exp')) + '</th><th>' + esc(T('th_days')) +
      '</th><th>' + esc(T('calls')) + ' (' + esc(S.cur) + ')</th><th>' + esc(T('puts')) + ' (' + esc(S.cur) + ')</th><th>' + esc(T('th_pc')) + '</th><th>' + esc(T('th_notional')) + '</th><th>' + esc(T('o_mp')) + '</th><th>' + esc(T('th_iv')) + '</th><th>' + esc(T('th_rr')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    tb.hidden = !rows;
  }
  function controls() {
    var B = V.book, h = '';
    if (S.view === 'strike') {
      var opts = '<option value="all">' + esc(T('exp_all')) + '</option>' + (B ? B.exps.filter(function (e) { return e.oi > 0; }).map(function (e) {
        return '<option value="' + esc(e.code) + '"' + (S.exp === e.code ? ' selected' : '') + '>' + esc(expShort(e)) + ' · ' + esc(OB.compact(e.oi)) + '</option>'; }).join('') : '');
      h += '<label class="ob-lbl"><span>' + esc(T('expiry')) + '</span><select class="ob-sel" id="ob-exp">' + opts + '</select></label>' +
        '<label class="ob-lbl"><span>' + esc(T('strikes')) + '</span>' + OB.ui.seg('ob-w', [['near', T('w_near')], ['all', T('w_all')]], S.win) + '</label>';
    }
    if (S.view === 'smile') {
      var se = B ? smileExp(B) : null;
      h += '<label class="ob-lbl"><span>' + esc(T('expiry')) + '</span><select class="ob-sel" id="ob-exp">' + (B && V.term ? V.term.map(function (x) {
        var e2 = expByCode(B, x.code); return e2 ? '<option value="' + esc(e2.code) + '"' + (se && se.code === e2.code ? ' selected' : '') + '>' + esc(expShort(e2)) + ' · ' + esc(T('days_left', { n: OB.loc(Math.round(x.days)) })) + '</option>' : '';
      }).join('') : '') + '</select></label>';
    } else if (S.view === 'strike' || S.view === 'expiry') h += '<label class="ob-lbl"><span>' + esc(T('unit')) + '</span>' + OB.ui.seg('ob-u', [['coin', S.cur], ['usd', T('u_usd')]], S.unit) + '</label>';
    if (S.view === 'dvol') h += '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', DV_R.map(function (r) { return [r.k, T('or_' + r.k)]; }), S.dr, 'ob-rng') + '</label>';
    $('#ob-more', V.el).innerHTML = h;
    var g = $('#ob-gear', V.el); if (g) g.classList.toggle('ob-off', !h);
  }
  function stage(kind) {
    if (V.chart && V.kind === kind) return V.chart;
    if (V.chart) V.chart.destroy();
    V.kind = kind; V.chart = kind === 'ts' ? new OB.TS($('#ob-ts', V.el)) : new Bars($('#ob-ts', V.el));
    return V.chart;
  }
  function stamp() { return new Date(V.at || Date.now()).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
  function drawStrike() {
    var B = V.book, e = S.exp === 'all' ? null : expByCode(B, S.exp);
    if (S.exp !== 'all' && !e) { S.exp = 'all'; controls(); }
    var und = e ? e.und : B.index, all = e ? e.strikes : B.all, st = S.win === 'near' ? M.near(all, und, 0.6, 1.5) : all;
    st = st.filter(function (r) { return r.c.oi > 0 || r.p.oi > 0; });
    var marks = [{ pos: M.slot(st, B.index), color: INK, label: T('o_spot') + ' ' + OB.ltr(px(B.index)) }];
    if (e && e.maxPain != null) marks.push({ pos: M.slot(st, e.maxPain), color: ACC, label: T('o_mp') + ' ' + OB.ltr(px(e.maxPain)) });
    V.sub = (e ? expShort(e) : T('exp_all')) + ' · Deribit · ' + stamp();
    stage('bars').set({ cats: st.map(function (r) { return kTxt(r.k); }), stacked: false, fmt: S.unit === 'usd' ? function (v) { return '$' + OB.compact(v); } : OB.compact,
      series: [{ name: T('calls'), color: GRN, data: st.map(function (r) { return amount(r.c.oi); }) }, { name: T('puts'), color: RED, data: st.map(function (r) { return amount(r.p.oi); }) }],
      vmarks: marks, label: T('aria_opt_k', { coin: S.cur }),
      tip: function (i) {
        var r = st[i];
        return '<div class="ob-tip-t">' + esc(T('th_strike')) + '</div><div class="ob-tip-v"><b class="ob-n">' + esc(px(r.k)) + '</b></div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + GRN + '"></i>' + esc(T('calls')) + '<b class="ob-n">' + esc(amtTxt(r.c.oi)) + '</b></div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + RED + '"></i>' + esc(T('puts')) + '<b class="ob-n">' + esc(amtTxt(r.p.oi)) + '</b></div>' +
          '<div class="ob-tip-r">' + esc(T('th_pc')) + '<b class="ob-n">' + f2(r.c.oi > 0 ? r.p.oi / r.c.oi : null) + '</b></div>';
      } });
  }
  function drawExpiry() {
    var B = V.book, ex = B.exps.filter(function (e) { return e.oi > 0; });
    V.sub = T('ov_expiry') + ' · Deribit · ' + stamp();
    stage('bars').set({ cats: ex.map(expShort), stacked: true, fmt: S.unit === 'usd' ? function (v) { return '$' + OB.compact(v); } : OB.compact,
      series: [{ name: T('calls'), color: GRN, data: ex.map(function (e) { return amount(e.c.oi); }) }, { name: T('puts'), color: RED, data: ex.map(function (e) { return amount(e.p.oi); }) }],
      label: T('aria_opt_e', { coin: S.cur }),
      tip: function (i) {
        var e = ex[i];
        return '<div class="ob-tip-t">' + esc(expLong(e)) + ' · ' + esc(T('days_left', { n: OB.loc(e.days < 1 ? e.days.toFixed(1) : Math.round(e.days)) })) + '</div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + GRN + '"></i>' + esc(T('calls')) + '<b class="ob-n">' + esc(amtTxt(e.c.oi)) + '</b></div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + RED + '"></i>' + esc(T('puts')) + '<b class="ob-n">' + esc(amtTxt(e.p.oi)) + '</b></div>' +
          '<div class="ob-tip-r">' + esc(T('th_pc')) + '<b class="ob-n">' + f2(e.pc) + '</b></div><div class="ob-tip-r">' + esc(T('o_mp')) + '<b class="ob-n">' + esc(px(e.maxPain)) + '</b></div>';
      } });
  }
  function ivTxt(v) { return v == null || !isFinite(v) ? '—' : v.toFixed(1) + '%'; }
  function dTxt(v) { return v == null || !isFinite(v) ? '—' : (v < 0 ? '-' : '') + Math.abs(v).toFixed(2); }
  function drawSmile() {
    var B = V.book, e = smileExp(B);
    if (!e) { stage('bars').set({ cats: [], series: [] }); return; }
    var sm = M.smile(e, V.at).filter(function (x) { return x.k >= e.und * 0.55 && x.k <= e.und * 1.7 && x.otm != null; }), x25 = termOf(e.code) || {};
    var marks = [{ pos: M.slot(sm.map(function (x) { return { k: x.k }; }), e.und), color: INK, label: T('sm_fwd') + ' ' + OB.ltr(px(e.und)) }];
    V.sub = expShort(e) + ' · ' + T('days_left', { n: OB.loc(Math.round(e.days)) }) + ' · Deribit · ' + stamp();
    stage('bars').set({ cats: sm.map(function (x) { return kTxt(x.k); }), fmt: function (v) { return v.toFixed(0) + '%'; }, vmarks: marks, label: T('aria_opt_s', { coin: S.cur }),
      series: [{ name: T('sm_iv'), color: ACC, line: true, data: sm.map(function (x) { return x.otm; }) }],
      tip: function (i) {
        var x = sm[i];
        return '<div class="ob-tip-t">' + esc(T('th_strike')) + ' ' + esc(px(x.k)) + ' · ' + esc(x.k / e.und < 1 ? '-' : '+') + Math.abs((x.k / e.und - 1) * 100).toFixed(1) + '%</div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + GRN + '"></i>' + esc(T('calls')) + '<b class="ob-n">' + esc(ivTxt(x.c)) + ' · Δ ' + esc(dTxt(x.dc)) + '</b></div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + RED + '"></i>' + esc(T('puts')) + '<b class="ob-n">' + esc(ivTxt(x.p)) + ' · Δ ' + esc(dTxt(x.dp)) + '</b></div>';
      } });
    var info = $('#ob-skew', V.el);
    if (info) { info.hidden = false; info.innerHTML = esc(T('sm_line', { atm: OB.ltr(ivTxt(e.atmIv)), c: OB.ltr(ivTxt(x25.c25)), p: OB.ltr(ivTxt(x25.p25)), rr: OB.ltr(x25.rr == null ? '—' : pct(x25.rr, 1)) })); }
  }
  function drawTerm() {
    var B = V.book, tm = (V.term || []).filter(function (x) { return x.atm != null; });
    V.sub = T('ov_term') + ' · Deribit · ' + stamp();
    var cats = tm.map(function (x) { var e = expByCode(B, x.code); return e ? expShort(e) : x.code; });
    stage('bars').set({ cats: cats, fmt: function (v) { return v.toFixed(0) + '%'; }, label: T('aria_opt_t', { coin: S.cur }),
      series: [{ name: T('tm_atm'), color: ACC, line: true, width: 2.2, data: tm.map(function (x) { return x.atm; }) },
        { name: T('tm_p25'), color: RED, line: true, dash: [5, 4], data: tm.map(function (x) { return x.p25; }) },
        { name: T('tm_c25'), color: GRN, line: true, dash: [5, 4], data: tm.map(function (x) { return x.c25; }) }],
      tip: function (i) {
        var x = tm[i];
        return '<div class="ob-tip-t">' + esc(cats[i]) + ' · ' + esc(T('days_left', { n: OB.loc(x.days < 10 ? x.days.toFixed(1) : Math.round(x.days)) })) + '</div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + ACC + '"></i>' + esc(T('tm_atm')) + '<b class="ob-n">' + esc(ivTxt(x.atm)) + '</b></div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + RED + '"></i>' + esc(T('tm_p25')) + '<b class="ob-n">' + esc(ivTxt(x.p25)) + '</b></div>' +
          '<div class="ob-tip-r"><i class="ob-key" style="background:' + GRN + '"></i>' + esc(T('tm_c25')) + '<b class="ob-n">' + esc(ivTxt(x.c25)) + '</b></div>' +
          '<div class="ob-tip-r">' + esc(T('th_rr')) + '<b class="ob-n">' + esc(x.rr == null ? '—' : pct(x.rr, 1)) + '</b></div>' +
          '<div class="ob-tip-r">' + esc(T('tip_fly')) + '<b class="ob-n">' + esc(x.fly == null ? '—' : pct(x.fly, 1)) + '</b></div>';
      } });
  }
  function drawDvol() {
    var key = S.cur + ':' + S.dr, R = DV_R.filter(function (r) { return r.k === S.dr; })[0] || DV_R[1], seq = ++V.dseq, ts = stage('ts');
    function show(dv) {
      var panes = [];
      if (dv.px && dv.px.length > 1) panes.push({ weight: 2, title: T('p_index'), fmt: function (v) { return OB.fmtP(v); }, series: [{ name: T('p_index'), type: 'line', color: INK, width: 1.5, data: dv.px }] });
      panes.push({ weight: 3, title: T('p_dvol'), fmt: function (v) { return v.toFixed(1); }, series: [{ name: T('p_dvol'), type: 'candle', data: dv.rows }] });
      V.sub = T('or_' + S.dr) + ' · DVOL · Deribit · ' + stamp();
      ts.set({ daily: R.res === '1D', label: T('aria_dvol', { coin: S.cur }), panes: panes });
    }
    if (V.dv[key] && Date.now() - V.dv[key].at < 5 * 60000) { show(V.dv[key]); return; }
    status('<span class="ob-spin"></span>' + esc(T('loading_o')));
    var t0 = R.span ? Date.now() - R.span : DV0;
    Promise.all([loadDvol(S.cur, t0, R.res), loadDelivery(S.cur, t0).catch(function () { return null; })]).then(function (r) {
      if (seq !== V.dseq || S.view !== 'dvol') return;
      if (!r[0].length) throw new Error('no dvol');
      V.dv[key] = { rows: r[0], px: r[1], at: Date.now() }; status(''); show(V.dv[key]);
    }).catch(function (e) { if (seq !== V.dseq) return; fail(e); });
  }
  function render() {
    if (!V.book) return;
    tiles(); table(); controls();
    OB.ui.setSeg(V.el, 'ob-v', S.view);
    var info = $('#ob-skew', V.el); if (info) info.hidden = true;
    if (S.view === 'strike') drawStrike(); else if (S.view === 'expiry') drawExpiry(); else if (S.view === 'smile') drawSmile(); else if (S.view === 'term') drawTerm(); else drawDvol();
    $('#ob-note', V.el).textContent = T('note_opt') + (S.view === 'smile' || S.view === 'term' ? ' ' + T('note_skew') : '');
  }
  function fail(e) {
    if (w.console) console.error(e);
    status('<b>' + esc(T('err_net')) + '</b><br><span>' + esc(T('err_deribit')) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
  }
  function load(quiet) {
    var seq = ++V.seq, cur = S.cur; V.loading = true;
    if (!quiet) status('<span class="ob-spin"></span>' + esc(T('loading_o')));
    var now = Date.now();
    Promise.all([loadBook(cur), dvolPage(cur, now - 26 * H, now, '3600').catch(function () { return null; })]).then(function (r) {
      if (seq !== V.seq) return;
      V.book = r[0]; V.at = Date.now(); V.loading = false; V.term = M.term(V.book, V.at);
      var a = (r[1] && r[1].data) || [];
      V.dvNow = a.length ? { now: +a[a.length - 1][4], d1: a.length > 23 ? +a[a.length - 1][4] - +a[Math.max(0, a.length - 25)][4] : null } : null;
      if (!quiet) status('');
      render();
    }).catch(function (e) { if (seq !== V.seq) return; V.loading = false; if (!quiet || !V.book) fail(e); });
  }
  function mount(el) {
    V.el = el; V.book = null; V.chart = null; V.kind = null;
    el.innerHTML = '<div class="ob-tools"><label class="ob-lbl"><span>' + esc(T('asset')) + '</span>' + OB.ui.seg('ob-as', [['BTC', 'BTC'], ['ETH', 'ETH']], S.cur, 'ob-num') + '</label>' +
      '<label class="ob-lbl"><span>' + esc(T('view')) + '</span>' + OB.ui.seg('ob-v', [['strike', T('ov_strike')], ['expiry', T('ov_expiry')], ['smile', T('ov_smile')], ['term', T('ov_term')], ['dvol', T('ov_dvol')]], S.view, 'ob-rng') + '</label>' +
      '<button type="button" class="ob-ib ob-gear" id="ob-gear" aria-expanded="false" aria-controls="ob-more" aria-label="' + esc(T('more')) + '" title="' + esc(T('more')) + '">' + OB.icon('gear') + '</button>' +
      '<div class="ob-more" id="ob-more"></div>' + OB.ui.acts() + '</div><div class="ob-tiles" id="ob-tiles"></div>' +
      '<div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div><p class="ob-note ob-skew" id="ob-skew" hidden></p><div class="ob-tblbox" id="ob-tbl" hidden></div><p class="ob-note" id="ob-note"></p>';
    stage(S.view === 'dvol' ? 'ts' : 'bars');                   /* made at once: it gives the page its height while the data loads */
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'ob-as' && v !== S.cur) { S.cur = v; S.exp = 'all'; OB.ui.setSeg(el, 'ob-as', v); save(); V.book = null; load(); }
      else if (seg === 'ob-v' && v !== S.view) { S.view = v; save(); V.dseq++; status(''); render(); }
      else if (seg === 'ob-w' && v !== S.win) { S.win = v; save(); render(); }
      else if (seg === 'ob-u' && v !== S.unit) { S.unit = v; save(); render(); }
      else if (seg === 'ob-r' && v !== S.dr) { S.dr = v; save(); render(); }
      else if (b.getAttribute('data-exp')) { S.exp = b.getAttribute('data-exp'); S.view = 'strike'; save(); V.dseq++; status(''); render(); $('#ob-ts', el).scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      else if (b.id === 'ob-gear') { var op = !$('.ob-tools', el).classList.contains('open'); $('.ob-tools', el).classList.toggle('open', op); b.setAttribute('aria-expanded', op ? 'true' : 'false'); if (V.chart) V.chart.onResize(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') { V.dv = {}; load(); }
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.chart && V.book) V.chart.png(S.cur + ' · ' + T('tab_options') + ' · ' + T('ov_' + S.view), V.sub, 'entekhab-options-' + S.cur + '-' + S.view + '.png'); }
      else if (b.id === 'ob-share') OB.ui.share({ coin: S.cur, view: S.view, exp: (S.view === 'strike' || S.view === 'smile') && S.exp !== 'all' ? S.exp : null, range: S.view === 'dvol' ? S.dr : null });
    };
    el.onchange = function (e) { if (e.target.id === 'ob-exp') { S.exp = e.target.value; render(); } };      /* the same choice serves the strike view and the smile */
    clearInterval(V.timer);
    V.timer = setInterval(function () { if (!d.hidden && V.book && !V.loading && S.view !== 'dvol') load(true); }, 120000);       /* a quiet refresh every 2 minutes while in view */
    load();
  }
  function unmount() { V.seq++; V.dseq++; clearInterval(V.timer); if (V.chart) V.chart.destroy(); V.chart = null; V.kind = null; }
  OB.views.options = { mount: mount, unmount: unmount };
  OB._op = { V: V, S: S };
})();
