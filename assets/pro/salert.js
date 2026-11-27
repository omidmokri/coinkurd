/* entekhab.net — /market/ Smart alerts: several conditions joined with AND / OR / NOT, built from menus.
   The builder writes one line of Entekhab Script (script.js), so the alert is checked by the same tested code as a
   written multi-condition alert, on the alert's timeframe, when a bar closes. Nothing here can run page code: every
   piece of the line comes from the fixed lists below and from numbers checked to be finite.
   Indicators need some bars before they have a value. A plain comparison is false while it warms up; a NOT is made
   false too (it checks its own values exist), so a NOT can never fire just because there is no data yet. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  /* what a side of a condition can be: e is the Entekhab Script for it, L its length when it has one */
  var SRC = {
    close: { e: 'close' }, open: { e: 'open' }, high: { e: 'high' }, low: { e: 'low' }, volume: { e: 'volume' },
    rsi: { d: 14, e: 'ta.rsi(close, L)' }, ema: { d: 20, e: 'ta.ema(close, L)' }, sma: { d: 50, e: 'ta.sma(close, L)' },
    wma: { d: 20, e: 'ta.wma(close, L)' }, hma: { d: 20, e: 'ta.hma(close, L)' }, vwma: { d: 20, e: 'ta.vwma(close, L)' },
    macd: { e: '(ta.ema(close, 12) - ta.ema(close, 26))' }, macds: { e: 'ta.ema(ta.ema(close, 12) - ta.ema(close, 26), 9)' },
    macdh: { e: '((ta.ema(close, 12) - ta.ema(close, 26)) - ta.ema(ta.ema(close, 12) - ta.ema(close, 26), 9))' },
    bbu: { d: 20, e: '(ta.sma(close, L) + 2 * ta.stdev(close, L))' }, bbm: { d: 20, e: 'ta.sma(close, L)' },
    bbl: { d: 20, e: '(ta.sma(close, L) - 2 * ta.stdev(close, L))' },
    atrp: { d: 14, e: '(100 * ta.atr(L) / close)' }, roc: { d: 10, e: 'ta.roc(close, L)' },
    volx: { d: 20, e: '(volume / ta.sma(volume, L))' }, hh: { d: 20, e: 'ta.highest(high, L)[1]' }, ll: { d: 20, e: 'ta.lowest(low, L)[1]' },
    stoch: { d: 14, e: 'ta.stoch(close, high, low, L)' }, cci: { d: 20, e: 'ta.cci(close, L)' }
  };
  var SRCK = Object.keys(SRC);
  /* how the two sides meet; rise / fall take a number of bars on the right */
  var OPS = { gt: '>', lt: '<', ge: '>=', le: '<=', xup: 'ta.crossover', xdn: 'ta.crossunder', rise: 'ta.rising', fall: 'ta.falling' };
  var OPK = Object.keys(OPS);
  var MAXG = 4, MAXC = 6, MAXLEN = 600;
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function int(v, lo, hi, d) { v = Math.round(+v); return isFinite(v) && v >= lo && v <= hi ? v : d; }
  /* a plain decimal Entekhab Script reads exactly (no exponent); negative numbers in brackets */
  function num(v) {
    v = +v; if (!isFinite(v) || Math.abs(v) >= 1e12) return null; if (v === 0) return '0';
    var a = Math.abs(v), s = a.toFixed(Math.max(0, Math.min(18, 9 - Math.floor(Math.log10(a)))));
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (!/^\d+(\.\d+)?$/.test(s) || +s === 0) return null;
    return v < 0 ? '(-' + s + ')' : s;
  }
  function side(x) {        /* {s, l} → its script text, or null */
    if (!x || !own(SRC, x.s)) return null; var d = SRC[x.s];
    return d.d ? d.e.split('L').join(String(int(x.l, 1, 500, d.d))) : d.e;
  }
  /* the longest length a side uses. The script engine shortens a length that is longer than the history it is given,
     so a rule is only allowed to be true once the chart has at least this many bars (see expr) */
  function need(x) { if (!x || !own(SRC, x.s)) return 1; var d = SRC[x.s]; return d.d ? int(x.l, 1, 500, d.d) : /^macd/.test(x.s) ? 26 : 1; }
  /* a spec from storage or the form, reduced to known keys and checked numbers */
  function clean(sp) {
    sp = sp && typeof sp === 'object' ? sp : {};
    var g = (Array.isArray(sp.g) ? sp.g : []).slice(0, MAXG).map(function (G) {
      G = G && typeof G === 'object' ? G : {};
      var c = (Array.isArray(G.c) ? G.c : []).slice(0, MAXC).map(function (C) {
        C = C && typeof C === 'object' ? C : {};
        var a = C.a && own(SRC, C.a.s) ? { s: C.a.s } : { s: 'close' }; if (SRC[a.s].d) a.l = int(C.a.l, 1, 500, SRC[a.s].d);
        var op = own(OPS, C.op) ? C.op : 'gt', b;
        if (op === 'rise' || op === 'fall') b = { t: 'n', v: int(C.b && C.b.v, 1, 50, 3) };
        else if (C.b && C.b.t === 's' && own(SRC, C.b.s)) { b = { t: 's', s: C.b.s }; if (SRC[b.s].d) b.l = int(C.b.l, 1, 500, SRC[b.s].d); }
        else b = { t: 'n', v: isFinite(+(C.b && C.b.v)) && C.b.v !== '' && C.b.v != null ? +C.b.v : NaN };
        return { not: !!C.not, a: a, op: op, b: b };
      });
      return { j: G.j === 'or' ? 'or' : 'and', not: !!G.not, c: c };
    });
    return { j: sp.j === 'or' ? 'or' : 'and', g: g };
  }
  /* one condition → { e: its script, ops: the sides that must have a value for a NOT } or { err } */
  function condExpr(C) {
    var L = side(C.a); if (!L) return { err: 'saE_side' };
    var R, ops = [L], e;
    if (C.op === 'rise' || C.op === 'fall') { e = OPS[C.op] + '(' + L + ', ' + C.b.v + ')'; }
    else {
      if (C.b.t === 's') { R = side(C.b); if (!R) return { err: 'saE_side' }; ops.push(R); }
      else { R = num(C.b.v); if (R == null) return { err: 'saE_num' }; }
      e = C.op === 'xup' || C.op === 'xdn' ? OPS[C.op] + '(' + L + ', ' + R + ')' : L + ' ' + OPS[C.op] + ' ' + R;
    }
    e = '(' + e + ')';
    if (C.not) e = '(not ' + e + ' and ' + guard(ops) + ')';
    return { e: e, ops: ops };
  }
  function guard(ops) { var u = []; ops.forEach(function (o) { if (u.indexOf(o) < 0) u.push(o); }); return u.map(function (o) { return o + ' == ' + o; }).join(' and '); }
  /* the whole rule → { expr } or { err, gi, ci } */
  function expr(sp) {
    sp = clean(sp); if (!sp.g.length) return { err: 'saE_empty' };
    var parts = [], W = 1;
    for (var i = 0; i < sp.g.length; i++) {
      var G = sp.g[i]; if (!G.c.length) return { err: 'saE_emptyG', gi: i };
      var cs = [], ops = [];
      for (var j = 0; j < G.c.length; j++) {
        var r = condExpr(G.c[j]); if (r.err) return { err: r.err, gi: i, ci: j }; cs.push(r.e); ops = ops.concat(r.ops);
        W = Math.max(W, need(G.c[j].a), G.c[j].b.t === 's' ? need(G.c[j].b) : 1);
      }
      var e = cs.length > 1 ? '(' + cs.join(' ' + G.j + ' ') + ')' : cs[0];
      if (G.not) e = '(not ' + e + ' and ' + guard(ops) + ')';
      parts.push(e);
    }
    var out = parts.join(' ' + sp.j + ' ');
    if (W > 1) out = (parts.length > 1 && sp.j === 'or' ? '(' + out + ')' : out) + ' and bar_index >= ' + (W - 1);
    if (out.length > MAXLEN) return { err: 'saE_long', n: out.length };
    return { expr: out, spec: sp, need: W };
  }
  /* run the rule over closed bars: the rule's value on each bar, each condition's value now, and the times it would
     have fired (the bar where it turns from false to true, as the live alert does) */
  function evaluate(sp, bars) {
    var r = expr(sp); if (r.err) return r;
    if (!P.script) return { err: 'saE_script' };
    var c = P.script.cond(r.expr); if (!c.ok) return { err: 'saE_script', msg: c.err };
    var s = c.series(bars), n = bars.length, fires = [], tr = 0, known = 0;
    for (var i = 0; i < n; i++) { if (s[i] > 0) tr++; if (i && s[i] > 0 && !(s[i - 1] > 0)) fires.push(bars[i].t); }
    var conds = r.spec.g.map(function (G) {
      return G.c.map(function (C) {
        var q = condExpr(C), cc = P.script.cond(q.e), v = cc.ok ? cc.series(bars) : [];
        var vals = q.ops.map(function (o) { var z = P.script.cond(o); var zz = z.ok ? z.series(bars) : []; return zz[n - 1]; });
        var ready = n >= r.need && vals.every(function (x) { return isFinite(x); });
        if (ready) known++;
        return { now: v[n - 1] > 0, ready: ready, vals: vals };
      });
    });
    return { expr: r.expr, spec: r.spec, now: s[n - 1] > 0, fires: fires, bars: n, truePct: n ? 100 * tr / n : 0, conds: conds };
  }
  P.sa = { SRC: SRC, OPS: OPS, clean: clean, expr: expr, evaluate: evaluate, num: num, MAXG: MAXG, MAXC: MAXC };

  var PRESETS = {
    dip: { j: 'and', g: [{ j: 'and', c: [{ a: { s: 'rsi', l: 14 }, op: 'lt', b: { t: 'n', v: 30 } }, { a: { s: 'close' }, op: 'gt', b: { t: 's', s: 'ema', l: 200 } }] }] },
    cross: { j: 'and', g: [{ j: 'and', c: [{ a: { s: 'ema', l: 9 }, op: 'xup', b: { t: 's', s: 'ema', l: 21 } }, { a: { s: 'volx', l: 20 }, op: 'gt', b: { t: 'n', v: 1.5 } }] }] },
    brk: { j: 'and', g: [{ j: 'and', c: [{ a: { s: 'close' }, op: 'gt', b: { t: 's', s: 'hh', l: 20 } }, { a: { s: 'volx', l: 20 }, op: 'gt', b: { t: 'n', v: 2 } }] }] },
    ext: { j: 'or', g: [{ j: 'and', c: [{ a: { s: 'close' }, op: 'gt', b: { t: 's', s: 'bbu', l: 20 } }] }, { j: 'and', c: [{ a: { s: 'close' }, op: 'lt', b: { t: 's', s: 'bbl', l: 20 } }] }] },
    calm: { j: 'and', g: [{ j: 'and', c: [{ a: { s: 'macd' }, op: 'xup', b: { t: 's', s: 'macds' } }] }, { j: 'and', not: true, c: [{ a: { s: 'atrp', l: 14 }, op: 'gt', b: { t: 'n', v: 3 } }] }] }
  };
  P.saPresets = PRESETS;

  /* ---------------------------------------------------------------- the dialog (browser only) */
  if (typeof document === 'undefined') return;
  var A, T, h, $, $$, esc;
  function ready() { A = P.app; if (!A) return false; T = A.T; h = A.h; $ = A.$; $$ = A.$$; esc = A.esc; return true; }
  function srcName(x) { var d = SRC[x.s]; return T('saS_' + x.s) + (d && d.d ? ' (' + int(x.l, 1, 500, d.d) + ')' : ''); }
  /* a short readable summary for the alert list (from the cleaned spec only: known names and numbers) */
  /* left-to-right inside its own isolate, so symbols and brackets keep their order in a right-to-left page or notification */
  P.saText = function (sp) {
    if (!ready()) return '';
    sp = clean(sp);
    return '\u2066' + sp.g.map(function (G) {
      var t = G.c.map(function (C) {
        var b = C.op === 'rise' || C.op === 'fall' ? T('saBars', { n: C.b.v }) : C.b.t === 's' ? srcName(C.b) : (isFinite(C.b.v) ? String(+C.b.v) : '?');
        return (C.not ? T('saNot') + ' ' : '') + srcName(C.a) + ' ' + T('saO_' + C.op) + ' ' + b;
      }).join(' ' + T('saJ_' + G.j) + ' ');
      return (G.not ? T('saNot') + ' ' : '') + (G.c.length > 1 || sp.g.length > 1 ? '(' + t + ')' : t);
    }).join(' ' + T('saJ_' + sp.j) + ' ') + '\u2069';
  };

  P.smartAlert = function (cell, start) {
    if (!ready() || !cell) return;
    var sym = cell.cfg.sym, tfs = ['5m', '15m', '1h', '4h', '1d', '1w'].concat([cell.cfg.tf]).filter(function (x, i, a) { return a.indexOf(x) === i && P.parseTF(x); });
    var sp = clean(start || PRESETS.dip), tf = cell.cfg.tf, sub = null, bars = [], lastRes = null, tmr = 0;
    var box = h('<div class="pm-sa"><details class="pm-odwhy"><summary></summary><p></p><p></p><p></p></details>' +
      '<div class="pm-sarow"><label class="pm-field"><span></span><select class="pm-in pm-satf"></select></label><div class="pm-sapre"></div></div>' +
      '<div class="pm-sag"></div><div class="pm-row"><button type="button" class="pm-btn sm pm-saaddg"></button><label class="pm-field pm-satop"><span></span><select class="pm-in"><option value="and"></option><option value="or"></option></select></label></div>' +
      '<section class="pm-odsec pm-sanow"><h4></h4><div class="pm-sast"></div><p class="pm-odhint pm-sahist"></p><ul class="pm-safires"></ul></section>' +
      '<details class="pm-saexp"><summary></summary><code dir="ltr"></code><div class="pm-row"><button type="button" class="pm-btn sm pm-sacopy"></button><button type="button" class="pm-btn sm pm-sascript"></button></div></details>' +
      '<div class="pm-sarow"><label class="pm-field"><span></span><select class="pm-in pm-samode"><option value="once"></option><option value="every"></option></select></label>' +
      '<label class="pm-field pm-samsg"><span></span><input class="pm-in" maxlength="80"></label></div>' +
      '<p class="pm-odhint pm-sanote"></p><p class="pm-scerr bad pm-saerr" hidden></p><div class="pm-row"><button type="button" class="pm-btn pri pm-sasave"></button></div></div>');
    var why = $$('.pm-odwhy p', box); $('.pm-odwhy summary', box).textContent = T('saWhyT'); why[0].textContent = T('saWhy1'); why[1].textContent = T('saWhy2'); why[2].textContent = T('saWhy3');
    var FL = $$('.pm-field > span', box); FL[0].textContent = T('mTf'); FL[1].textContent = T('saTop'); FL[2].textContent = T('mMode'); FL[3].textContent = T('mMsg');
    var TF = $('.pm-satf', box); tfs.forEach(function (x) { var o = new Option(A.tfLabel(x), x); if (x === tf) o.selected = true; TF.appendChild(o); });
    var TOP = $('.pm-satop select', box); TOP.options[0].textContent = T('saJT_and'); TOP.options[1].textContent = T('saJT_or');
    $('.pm-saaddg', box).textContent = '+ ' + T('saAddG'); $('.pm-sanow h4', box).textContent = T('saNowT');
    $('.pm-saexp summary', box).textContent = T('saExpT'); $('.pm-sacopy', box).textContent = T('saCopy'); $('.pm-sascript', box).textContent = T('saScript');
    var MODE = $('.pm-samode', box); MODE.options[0].textContent = T('once'); MODE.options[1].textContent = T('every');
    $('.pm-sanote', box).textContent = T('saNote'); $('.pm-sasave', box).textContent = T('saSave');
    var pre = $('.pm-sapre', box);
    Object.keys(PRESETS).forEach(function (k) {
      var b = h('<button type="button" class="pm-chip"></button>'); b.textContent = T('saP_' + k); b.title = T('saP_' + k);
      b.onclick = function () { sp = clean(PRESETS[k]); draw(); }; pre.appendChild(b);
    });
    var G = $('.pm-sag', box), ERR = $('.pm-saerr', box);
    function opt(sel, v, label) { var o = new Option(label, v); sel.appendChild(o); return o; }
    function srcSel(cur, cls) {
      var s = h('<select class="pm-in ' + cls + '"></select>');
      SRCK.forEach(function (k) { opt(s, k, T('saS_' + k)); }); s.value = cur; return s;
    }
    function lenIn(src, v, cls) {
      var i = h('<input class="pm-in pm-salen ' + cls + '" type="number" min="1" max="500" step="1" inputmode="numeric">');
      i.value = SRC[src].d ? int(v, 1, 500, SRC[src].d) : ''; i.hidden = !SRC[src].d; i.title = i.ariaLabel = T('length'); return i;
    }
    /* the form is drawn from sp; every change reads the form back into sp and runs the rule again */
    function draw() {
      G.innerHTML = ''; TOP.value = sp.j; $('.pm-satop', box).hidden = sp.g.length < 2;
      sp.g.forEach(function (g, gi) {
        var gw = h('<section class="pm-odsec pm-sagrp"><div class="pm-sagh"><b></b><select class="pm-in pm-sagj"><option value="and"></option><option value="or"></option></select>' +
          '<label class="pm-sanotl"><input type="checkbox" class="pm-sagnot"> <span></span></label><button type="button" class="pm-ib pm-sagx">×</button></div><div class="pm-sacs"></div>' +
          '<button type="button" class="pm-btn sm pm-saaddc"></button></section>');
        $('b', gw).textContent = T('saGroup', { n: gi + 1 });
        var gj = $('.pm-sagj', gw); gj.options[0].textContent = T('saJG_and'); gj.options[1].textContent = T('saJG_or'); gj.value = g.j; gj.hidden = g.c.length < 2;
        $('.pm-sagnot', gw).checked = g.not; $('.pm-sanotl span', gw).textContent = T('saGNot'); $('.pm-sanotl', gw).title = T('saGNotTip');
        $('.pm-sagx', gw).title = $('.pm-sagx', gw).ariaLabel = T('remove'); $('.pm-sagx', gw).hidden = sp.g.length < 2;
        $('.pm-saaddc', gw).textContent = '+ ' + T('saAddC'); $('.pm-saaddc', gw).hidden = g.c.length >= MAXC;
        gj.onchange = function () { g.j = gj.value; draw(); };
        $('.pm-sagnot', gw).onchange = function () { g.not = this.checked; run(); };
        $('.pm-sagx', gw).onclick = function () { sp.g.splice(gi, 1); draw(); };
        $('.pm-saaddc', gw).onclick = function () { g.c.push({ not: false, a: { s: 'rsi', l: 14 }, op: 'gt', b: { t: 'n', v: 50 } }); draw(); };
        var cs = $('.pm-sacs', gw);
        g.c.forEach(function (C, ci) {
          var row = h('<div class="pm-sacr"><span class="pm-sadot" aria-hidden="true"></span><label class="pm-sanotl"><input type="checkbox" class="pm-sanot"> <span></span></label></div>');
          $('.pm-sanot', row).checked = C.not; $('.pm-sanotl span', row).textContent = T('saNot'); $('.pm-sanotl', row).title = T('saNotTip');
          var a = srcSel(C.a.s, 'pm-saa'), al = lenIn(C.a.s, C.a.l, 'pm-saal'), op = h('<select class="pm-in pm-saop"></select>');
          OPK.forEach(function (k) { opt(op, k, T('saO_' + k)); }); op.value = C.op;
          var bt = h('<select class="pm-in pm-sabt"></select>'); opt(bt, 'n', T('saBN')); opt(bt, 's', T('saBS')); bt.value = C.b.t;
          var bv = h('<input class="pm-in pm-sabv" type="number" step="any" inputmode="decimal">'), bs = srcSel(C.b.s || 'ema', 'pm-sabs'), bl = lenIn(C.b.s || 'ema', C.b.l, 'pm-sabl');
          var rf = C.op === 'rise' || C.op === 'fall';
          bv.value = isFinite(C.b.v) ? C.b.v : ''; bv.title = bv.ariaLabel = rf ? T('saBarsN') : T('saBN');
          bt.hidden = rf; bs.hidden = rf || C.b.t !== 's'; bl.hidden = rf || C.b.t !== 's' || !SRC[bs.value].d; bv.hidden = !rf && C.b.t === 's';
          [a, al, op, bt, bv, bs, bl].forEach(function (x) { row.appendChild(x); });
          var x = h('<button type="button" class="pm-ib pm-sacx">×</button>'); x.title = x.ariaLabel = T('remove'); x.hidden = g.c.length < 2 && sp.g.length < 2; row.appendChild(x);
          row.appendChild(h('<small class="pm-saval" dir="ltr"></small>'));
          function back(redraw) {
            C.not = $('.pm-sanot', row).checked; C.a = { s: a.value }; if (SRC[a.value].d) C.a.l = int(al.value, 1, 500, SRC[a.value].d);
            C.op = op.value;
            if (C.op === 'rise' || C.op === 'fall') C.b = { t: 'n', v: int(bv.value, 1, 50, 3) };
            else if (bt.value === 's') { C.b = { t: 's', s: bs.value }; if (SRC[bs.value].d) C.b.l = int(bl.value, 1, 500, SRC[bs.value].d); }
            else C.b = { t: 'n', v: bv.value === '' ? NaN : +bv.value };
            if (redraw) draw(); else run();
          }
          a.onchange = op.onchange = bt.onchange = bs.onchange = function () { back(true); };
          al.oninput = bl.oninput = bv.oninput = $('.pm-sanot', row).onchange = function () { back(false); };
          x.onclick = function () { g.c.splice(ci, 1); if (!g.c.length) sp.g.splice(gi, 1); draw(); };
          cs.appendChild(row);
        });
        G.appendChild(gw);
        if (gi < sp.g.length - 1) { var jn = h('<div class="pm-sajn"></div>'); jn.textContent = T('saJ_' + sp.j); G.appendChild(jn); }
      });
      $('.pm-saaddg', box).hidden = sp.g.length >= MAXG;
      run();
    }
    TOP.onchange = function () { sp.j = TOP.value; draw(); };
    $('.pm-saaddg', box).onclick = function () { sp.g.push({ j: 'and', not: false, c: [{ not: false, a: { s: 'close' }, op: 'gt', b: { t: 's', s: 'sma', l: 50 } }] }); draw(); };
    function fmtV(v) { if (!isFinite(v)) return '—'; var a = Math.abs(v); return (+v.toFixed(a >= 1000 ? 2 : a >= 1 ? 3 : Math.min(10, (P.prec ? P.prec(a) : 6)))).toLocaleString('en-US', { maximumFractionDigits: 10 }); }
    function closedBars() {
      var t = P.parseTF(tf); if (!t) return [];
      return P.mtfCalc ? P.mtfCalc.closedOnly(bars, t.sec, Date.now() / 1000, false) : bars.slice(0, -1);
    }
    function run() {
      clearTimeout(tmr); tmr = setTimeout(run0, 60);
    }
    function run0() {
      var r = expr(sp); ERR.hidden = !r.err; $('.pm-sasave', box).disabled = !!r.err; $('.pm-sacopy', box).disabled = $('.pm-sascript', box).disabled = !!r.err;
      $$('.pm-sacr', box).forEach(function (row) { row.classList.remove('bad'); });
      if (r.err) {
        ERR.textContent = T(r.err, { n: r.n });
        if (r.gi != null && r.ci != null) { var gw = $$('.pm-sagrp', box)[r.gi], rw = gw && $$('.pm-sacr', gw)[r.ci]; if (rw) rw.classList.add('bad'); }
        $('.pm-saexp code', box).textContent = ''; paint(null); return;
      }
      $('.pm-saexp code', box).textContent = r.expr;
      var B = closedBars();
      lastRes = B.length >= 3 ? evaluate(sp, B.slice(-1500)) : null;
      paint(lastRes);
    }
    function paint(res) {
      var st = $('.pm-sast', box), hs = $('.pm-sahist', box), ul = $('.pm-safires', box); ul.innerHTML = '';
      if (!res || res.err) {
        st.className = 'pm-sast'; st.textContent = bars.length ? T('saNoBars') : T('saLoading'); hs.textContent = '';
        $$('.pm-sadot', box).forEach(function (d) { d.className = 'pm-sadot'; d.title = ''; }); $$('.pm-saval', box).forEach(function (v) { v.textContent = ''; });
        return;
      }
      st.className = 'pm-sast ' + (res.now ? 'up' : 'dn'); st.textContent = T(res.now ? 'saNowYes' : 'saNowNo', { tf: A.tfLabel(tf) });
      var gws = $$('.pm-sagrp', box);
      res.conds.forEach(function (gc, gi) {
        var rows = gws[gi] ? $$('.pm-sacr', gws[gi]) : [];
        gc.forEach(function (c, ci) {
          var row = rows[ci]; if (!row) return; var d = $('.pm-sadot', row), v = $('.pm-saval', row);
          d.className = 'pm-sadot ' + (!c.ready ? 'wait' : c.now ? 'yes' : 'no'); d.title = T(!c.ready ? 'saDotWait' : c.now ? 'saDotYes' : 'saDotNo');
          v.textContent = c.vals.map(fmtV).join(' · ');
        });
      });
      var n = res.fires.length, per = res.bars ? (100 * n / res.bars) : 0;
      hs.textContent = T('saHist', { n: n, b: res.bars, tf: A.tfLabel(tf) }) + (n ? ' ' + T('saHistPct', { p: res.truePct.toFixed(1) }) : '') +
        (n === 0 ? ' ' + T('saNever') : per > 10 ? ' ' + T('saNoisy') : '');
      res.fires.slice(-5).reverse().forEach(function (t) { var li = h('<li dir="ltr"></li>'); li.textContent = A.fmtD ? A.fmtD(t) : new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' '); ul.appendChild(li); });
    }
    function listen() {
      if (sub) { sub.off(); sub = null; } bars = []; paint(null);
      sub = P.feed(sym, tf, function (what, F, x) {
        if (!document.body.contains(box)) { if (sub) sub.off(); sub = null; return; }
        if (what === 'reset' || (what === 'tick' && x && x.closed) || what === 'more') { bars = F.bars.slice(); run(); }
      });
      if (tf === cell.cfg.tf && cell.bars && cell.bars.length) { bars = cell.bars.slice(); run(); }
    }
    TF.onchange = function () { tf = TF.value; listen(); };
    $('.pm-sacopy', box).onclick = function () { var t = $('.pm-saexp code', box).textContent; try { navigator.clipboard.writeText(t); A.toast(T('copied')); } catch (e) { } };
    $('.pm-sascript', box).onclick = function () {
      var t = $('.pm-saexp code', box).textContent; A.closeModal(); P.multiAlert(cell);
      setTimeout(function () { var ta = document.querySelector('.pm-mexp'); if (ta) ta.value = t; var tsel = document.querySelector('.pm-iset [name=tf]'); if (tsel) tsel.value = tf; }, 0);
    };
    $('.pm-sasave', box).onclick = function () {
      var r = expr(sp); if (r.err) { run0(); return; }
      var c = P.script && P.script.cond(r.expr); if (!c || !c.ok) { ERR.hidden = false; ERR.textContent = T('saE_script'); return; }
      P.addAlert({ id: P.uid(), sym: sym, k: 'multi', expr: r.expr, spec: r.spec, tf: tf, mode: MODE.value === 'every' ? 'every' : 'once', on: true, at: Date.now(), msg: $('.pm-samsg input', box).value.trim().slice(0, 80) });
      A.closeModal(); A.toast(T('alertSet', { c: (P.pair ? P.pair(sym) : sym) + ' · ' + P.saText(r.spec) }));
      if (window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { } }
    };
    $('.pm-samsg input', box).addEventListener('keydown', function (e) { e.stopPropagation(); });
    draw(); listen();
    A.modal(T('saTitle') + ' · ' + (P.pair ? P.pair(sym) : sym), box, { wide: true, nofocus: true, onclose: function () { clearTimeout(tmr); if (sub) { sub.off(); sub = null; } } });
  };
  P.saReady = true;
})();
