/* entekhab.net — /market/ Entekhab Script: a small Pine-like language for the visitor's own indicators.
   Safety first: the source is never handed to eval / Function. It is tokenised, parsed and run by the interpreter
   below, which knows only numbers, series, strings and a fixed list of functions. There are no loops and no way to
   reach the page, the network or storage, so a script always ends and can only produce numbers to plot.
   Series are whole arrays (one value per bar); every operation works on the whole array at once. */
(function (root) {
  'use strict';
  var P = root.PRO = root.PRO || {}, I = P.ind, N = NaN;
  var MAXSRC = 20000, MAXTOK = 20000, MAXST = 400, MAXPLOT = 64, MAXIN = 40;
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function E(msg, line) { var e = new Error(msg); e.line = line; e.es = 1; return e; }

  /* ---------------------------------------------------------------- tokens */
  function lex(src) {
    var t = [], i = 0, line = 1, n = src.length, depth = 0;
    while (i < n) {
      var c = src[i];
      if (c === '\n') { if (!depth && t.length && t[t.length - 1].t !== 'nl') t.push({ t: 'nl', line: line }); line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '"' || c === "'") { var j = i + 1, s = ''; while (j < n && src[j] !== c && src[j] !== '\n') { s += src[j]; j++; } if (src[j] !== c) throw E('unterminated text', line); t.push({ t: 'str', v: s.slice(0, 80), line: line }); i = j + 1; continue; }
      if (c === '#' && /^#[0-9a-fA-F]{6}/.test(src.slice(i, i + 7))) { var hx = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?/.exec(src.slice(i, i + 9))[0]; t.push({ t: 'col', v: hx.slice(0, 7), line: line }); i += hx.length; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) { var m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i, i + 40)); t.push({ t: 'num', v: parseFloat(m[0]), line: line }); i += m[0].length; continue; }
      if (/[A-Za-z_]/.test(c)) { var m2 = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(i, i + 80)); t.push({ t: 'id', v: m2[0], line: line }); i += m2[0].length; continue; }
      var two = src.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '==' || two === '!=' || two === ':=' || two === '=>') { t.push({ t: 'op', v: two, line: line }); i += 2; continue; }
      if ('+-*/%<>=?:,()[]'.indexOf(c) >= 0) { if (c === '(' || c === '[') depth++; if (c === ')' || c === ']') depth = Math.max(0, depth - 1); t.push({ t: 'op', v: c, line: line }); i++; continue; }
      throw E('unexpected character “' + c + '”', line);
    }
    if (t.length > MAXTOK) throw E('the script is too long', 1);
    t.push({ t: 'nl', line: line }); t.push({ t: 'eof', line: line }); return t;
  }

  /* ---------------------------------------------------------------- parser → a tree of plain objects */
  var TYPES = { var: 1, varip: 1, float: 1, int: 1, bool: 1, color: 1, string: 1, series: 1, simple: 1, const: 1 };
  function parse(src) {
    if (typeof src !== 'string' || src.length > MAXSRC) throw E('the script is too long', 1);
    var t = lex(src), p = 0, out = [];
    function pk() { return t[p]; } function nx() { return t[p++]; }
    function isOp(v) { return t[p].t === 'op' && t[p].v === v; }
    function eat(v) { if (!isOp(v)) throw E('expected “' + v + '”', t[p].line); p++; }
    function expr() { return ternary(); }
    function ternary() { var c = or(); if (isOp('?')) { p++; var a = ternary(); eat(':'); var b = ternary(); return { k: 'tern', c: c, a: a, b: b, line: c.line }; } return c; }
    function isId(v) { return t[p].t === 'id' && t[p].v === v; }
    function or() { var a = and(); while (isId('or')) { var l = nx().line; a = { k: 'bin', op: 'or', a: a, b: and(), line: l }; } return a; }
    function and() { var a = cmp(); while (isId('and')) { var l = nx().line; a = { k: 'bin', op: 'and', a: a, b: cmp(), line: l }; } return a; }
    function cmp() { var a = add(); while (t[p].t === 'op' && ['<', '>', '<=', '>=', '==', '!='].indexOf(t[p].v) >= 0) { var o = nx(); a = { k: 'bin', op: o.v, a: a, b: add(), line: o.line }; } return a; }
    function add() { var a = mul(); while (isOp('+') || isOp('-')) { var o = nx(); a = { k: 'bin', op: o.v, a: a, b: mul(), line: o.line }; } return a; }
    function mul() { var a = unary(); while (isOp('*') || isOp('/') || isOp('%')) { var o = nx(); a = { k: 'bin', op: o.v, a: a, b: unary(), line: o.line }; } return a; }
    function unary() { if (isOp('-')) { var l = nx().line; return { k: 'neg', a: unary(), line: l }; } if (isOp('+')) { p++; return unary(); } if (isId('not')) { var l2 = nx().line; return { k: 'not', a: unary(), line: l2 }; } return post(); }
    function post() {
      var a = prim();
      for (;;) {
        if (isOp('[')) { var l = nx().line, ix = expr(); eat(']'); a = { k: 'hist', a: a, n: ix, line: l }; }
        else break;
      }
      return a;
    }
    function prim() {
      var k = nx();
      if (k.t === 'num') return { k: 'num', v: k.v, line: k.line };
      if (k.t === 'str') return { k: 'str', v: k.v, line: k.line };
      if (k.t === 'col') return { k: 'col', v: k.v, line: k.line };
      if (k.t === 'op' && k.v === '(') { var e = expr(); eat(')'); return e; }
      if (k.t === 'id') {
        if (isOp('(')) {
          p++; var args = [], named = {};
          while (!isOp(')')) {
            if (t[p].t === 'id' && t[p + 1].t === 'op' && t[p + 1].v === '=') { var nm = nx().v; p++; named[nm] = expr(); }
            else args.push(expr());
            if (isOp(',')) p++; else if (!isOp(')')) throw E('expected “,” or “)”', t[p].line);
          }
          p++; return { k: 'call', f: k.v, args: args, named: named, line: k.line };
        }
        return { k: 'id', v: k.v, line: k.line };
      }
      throw E('unexpected “' + (k.v != null ? k.v : 'end of line') + '”', k.line);
    }
    while (t[p].t !== 'eof') {
      if (t[p].t === 'nl') { p++; continue; }
      while (t[p].t === 'id' && TYPES[t[p].v] && t[p + 1].t === 'id') p++;                 /* "var float x = …" → "x = …" */
      if (t[p].t === 'id' && (t[p].v === 'if' || t[p].v === 'for' || t[p].v === 'while' || t[p].v === 'switch')) throw E('“' + t[p].v + '” is not supported; use  cond ? a : b', t[p].line);
      if (t[p].t === 'id' && t[p + 1].t === 'op' && t[p + 1].v === '=>') throw E('user functions are not supported yet', t[p].line);
      if (t[p].t === 'id' && t[p + 1].t === 'op' && (t[p + 1].v === '=' || t[p + 1].v === ':=')) { var nm0 = nx(); p++; out.push({ k: 'set', n: nm0.v, e: expr(), line: nm0.line }); }
      else { var ex = expr(); out.push({ k: 'do', e: ex, line: ex.line }); }
      if (t[p].t !== 'nl' && t[p].t !== 'eof') throw E('unexpected “' + (t[p].v != null ? t[p].v : '') + '”', t[p].line);
      if (out.length > MAXST) throw E('too many lines (max ' + MAXST + ')', t[p].line);
    }
    return out;
  }

  /* ---------------------------------------------------------------- series helpers */
  function A(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = N; return a; }
  function isS(x) { return Array.isArray(x); }
  function ok(x) { return typeof x === 'number' && isFinite(x); }
  function S(x, n) { if (isS(x)) return x; var a = new Array(n), v = x === true ? 1 : x === false ? 0 : typeof x === 'number' ? x : N; for (var i = 0; i < n; i++) a[i] = v; return a; }
  function map2(a, b, n, f) { if (!isS(a) && !isS(b)) return f(num(a), num(b)); a = S(a, n); b = S(b, n); var o = new Array(n); for (var i = 0; i < n; i++) o[i] = f(a[i], b[i]); return o; }
  function map1(a, n, f) { if (!isS(a)) return f(num(a)); var o = new Array(n); for (var i = 0; i < n; i++) o[i] = f(a[i]); return o; }
  function num(x) { return x === true ? 1 : x === false ? 0 : typeof x === 'number' ? x : N; }
  function len(x, line, max) { if (isS(x)) x = x[x.length - 1]; x = Math.round(num(x)); if (!(x >= 1)) throw E('a length must be 1 or more', line); return Math.min(x, max || 5000); }
  function sma(x, n) { var o = A(x.length), s = 0, c = 0; for (var i = 0; i < x.length; i++) { if (ok(x[i])) { s += x[i]; c++; } if (i >= n) { if (ok(x[i - n])) { s -= x[i - n]; c--; } } if (i >= n - 1 && c === n) o[i] = s / n; } return o; }
  function ema(x, n, al) { var o = A(x.length), a = al || 2 / (n + 1), pv = N, s = 0, c = 0; for (var i = 0; i < x.length; i++) { if (!ok(x[i])) continue; if (!ok(pv)) { s += x[i]; c++; if (c === n) { pv = s / n; o[i] = pv; } } else { pv = a * x[i] + (1 - a) * pv; o[i] = pv; } } return o; }
  function wma(x, n) { var o = A(x.length), d = n * (n + 1) / 2; for (var i = n - 1; i < x.length; i++) { var s = 0, g = true; for (var k = 0; k < n; k++) { var v = x[i - k]; if (!ok(v)) { g = false; break; } s += v * (n - k); } if (g) o[i] = s / d; } return o; }
  function roll(x, n, f) { var o = A(x.length); for (var i = n - 1; i < x.length; i++) { var w = [], g = true; for (var k = i - n + 1; k <= i; k++) { if (!ok(x[k])) { g = false; break; } w.push(x[k]); } if (g) o[i] = f(w); } return o; }
  function stdev(x, n) { return roll(x, n, function (w) { var m = 0, i; for (i = 0; i < w.length; i++) m += w[i]; m /= w.length; var s = 0; for (i = 0; i < w.length; i++) s += (w[i] - m) * (w[i] - m); return Math.sqrt(s / w.length); }); }
  function shift(x, k) { var o = A(x.length); for (var i = 0; i < x.length; i++) { var j = i - k; if (j >= 0 && j < x.length) o[i] = x[j]; } return o; }
  function rsi(x, n) { var o = A(x.length), ag = 0, al = 0, c = 0; for (var i = 1; i < x.length; i++) { if (!ok(x[i]) || !ok(x[i - 1])) continue; var ch = x[i] - x[i - 1], g = Math.max(ch, 0), l = Math.max(-ch, 0); c++; if (c <= n) { ag += g / n; al += l / n; if (c < n) continue; } else { ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; } o[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } return o; }
  function trng(C) { var n = C.c.length, o = A(n); for (var i = 0; i < n; i++) o[i] = i ? Math.max(C.h[i] - C.l[i], Math.abs(C.h[i] - C.c[i - 1]), Math.abs(C.l[i] - C.c[i - 1])) : C.h[i] - C.l[i]; return o; }
  function linreg(x, n, off) { return (function () { var o = A(x.length), sx = n * (n - 1) / 2, sxx = (n - 1) * n * (2 * n - 1) / 6, den = n * sxx - sx * sx; for (var j = n - 1; j < x.length; j++) { var sy = 0, sxy = 0, g = true; for (var i = 0; i < n; i++) { var v = x[j - (n - 1) + i]; if (!ok(v)) { g = false; break; } sy += v; sxy += i * v; } if (!g) continue; var sl = den ? (n * sxy - sx * sy) / den : 0, ic = (sy - sl * sx) / n; o[j] = ic + sl * (n - 1 - off); } return o; })(); }
  var COLORS = { red: '#ff5a4d', green: '#34d399', blue: '#60a5fa', orange: '#f7931a', yellow: '#facc15', purple: '#a78bfa', white: '#e5e7eb', gray: '#9ca3af', black: '#111111', aqua: '#22d3ee', teal: '#14b8a6', lime: '#a3e635', fuchsia: '#e879f9', maroon: '#b91c1c', navy: '#1e3a8a', olive: '#84cc16', silver: '#cbd5e1' };

  /* ---------------------------------------------------------------- the interpreter */
  function run(tree, bars, params, dry) {
    var n = bars.length, C = I.cols(bars), env = Object.create(null), R = { title: '', overlay: false, plots: [], hlines: [], shapes: [], inputs: [], out: {} };
    env.open = C.o; env.high = C.h; env.low = C.l; env.close = C.c; env.volume = C.v; env.time = C.t.map(function (t) { return t * 1000; });
    env.hl2 = C.h.map(function (h, i) { return (h + C.l[i]) / 2; }); env.hlc3 = C.h.map(function (h, i) { return (h + C.l[i] + C.c[i]) / 3; }); env.ohlc4 = C.h.map(function (h, i) { return (C.o[i] + h + C.l[i] + C.c[i]) / 4; });
    env.bar_index = C.c.map(function (x, i) { return i; }); env.na = N; env['true'] = 1; env['false'] = 0;
    function arg(c, i, name, def) { var e = c.args[i] !== undefined ? c.args[i] : c.named[name]; return e === undefined ? def : ev(e); }
    function ser(c, i, name) { var v = arg(c, i, name); if (v === undefined) throw E(c.f + '(): a value is missing', c.line); if (typeof v === 'string') throw E(c.f + '(): a number or series is expected', c.line); return S(v, n); }
    function ln(c, i, name) { var v = arg(c, i, name); if (v === undefined) throw E(c.f + '(): the length is missing', c.line); return len(v, c.line, Math.max(1, n)); }
    function colr(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null; }
    var F = {
      sma: function (c) { return sma(ser(c, 0, 'source'), ln(c, 1, 'length')); }, ema: function (c) { return ema(ser(c, 0, 'source'), ln(c, 1, 'length')); },
      rma: function (c) { var k = ln(c, 1, 'length'); return ema(ser(c, 0, 'source'), k, 1 / k); }, wma: function (c) { return wma(ser(c, 0, 'source'), ln(c, 1, 'length')); },
      hma: function (c) { var x = ser(c, 0, 'source'), k = ln(c, 1, 'length'), a = wma(x, Math.max(1, Math.round(k / 2))), b = wma(x, k); return wma(a.map(function (v, i) { return 2 * v - b[i]; }), Math.max(1, Math.round(Math.sqrt(k)))); },
      vwma: function (c) { var x = ser(c, 0, 'source'), k = ln(c, 1, 'length'), a = sma(x.map(function (v, i) { return v * C.v[i]; }), k), b = sma(C.v, k); return a.map(function (v, i) { return b[i] ? v / b[i] : N; }); },
      stdev: function (c) { return stdev(ser(c, 0, 'source'), ln(c, 1, 'length')); }, dev: function (c) { return roll(ser(c, 0, 'source'), ln(c, 1, 'length'), function (w) { var m = 0, i; for (i = 0; i < w.length; i++) m += w[i]; m /= w.length; var s = 0; for (i = 0; i < w.length; i++) s += Math.abs(w[i] - m); return s / w.length; }); },
      highest: function (c) { return roll(c.args.length > 1 || c.named.source ? ser(c, 0, 'source') : C.h, ln(c, c.args.length > 1 ? 1 : 0, 'length'), function (w) { return Math.max.apply(null, w); }); },
      lowest: function (c) { return roll(c.args.length > 1 || c.named.source ? ser(c, 0, 'source') : C.l, ln(c, c.args.length > 1 ? 1 : 0, 'length'), function (w) { return Math.min.apply(null, w); }); },
      sum: function (c) { return roll(ser(c, 0, 'source'), ln(c, 1, 'length'), function (w) { var s = 0; for (var i = 0; i < w.length; i++) s += w[i]; return s; }); },
      cum: function (c) { var x = ser(c, 0, 'source'), s = 0; return x.map(function (v) { if (ok(v)) s += v; return s; }); },
      change: function (c) { var x = ser(c, 0, 'source'), k = c.args[1] || c.named.length ? ln(c, 1, 'length') : 1, p = shift(x, k); return x.map(function (v, i) { return v - p[i]; }); },
      mom: function (c) { var x = ser(c, 0, 'source'), p = shift(x, ln(c, 1, 'length')); return x.map(function (v, i) { return v - p[i]; }); },
      roc: function (c) { var x = ser(c, 0, 'source'), p = shift(x, ln(c, 1, 'length')); return x.map(function (v, i) { return p[i] ? 100 * (v - p[i]) / p[i] : N; }); },
      rsi: function (c) { return rsi(ser(c, 0, 'source'), ln(c, 1, 'length')); },
      tr: function () { return trng(C); }, atr: function (c) { var k = ln(c, 0, 'length'); return ema(trng(C), k, 1 / k); },
      stoch: function (c) { var x = ser(c, 0, 'source'), h = ser(c, 1, 'high'), l = ser(c, 2, 'low'), k = ln(c, 3, 'length'), hh = roll(h, k, function (w) { return Math.max.apply(null, w); }), ll = roll(l, k, function (w) { return Math.min.apply(null, w); }); return x.map(function (v, i) { return hh[i] > ll[i] ? 100 * (v - ll[i]) / (hh[i] - ll[i]) : N; }); },
      cci: function (c) { var x = ser(c, 0, 'source'), k = ln(c, 1, 'length'), m = sma(x, k), d = roll(x, k, function (w) { var a = 0, i; for (i = 0; i < w.length; i++) a += w[i]; a /= w.length; var s = 0; for (i = 0; i < w.length; i++) s += Math.abs(w[i] - a); return s / w.length; }); return x.map(function (v, i) { return d[i] ? (v - m[i]) / (0.015 * d[i]) : N; }); },
      linreg: function (c) { return linreg(ser(c, 0, 'source'), ln(c, 1, 'length'), Math.round(num(arg(c, 2, 'offset', 0))) || 0); },
      percentrank: function (c) { var x = ser(c, 0, 'source'), k = ln(c, 1, 'length'), o = A(n); for (var i = k; i < n; i++) { var cnt = 0, g = true; for (var j = 1; j <= k; j++) { if (!ok(x[i - j])) { g = false; break; } if (x[i - j] <= x[i]) cnt++; } if (g && ok(x[i])) o[i] = 100 * cnt / k; } return o; },
      correlation: function (c) { var a = ser(c, 0, 'source1'), b = ser(c, 1, 'source2'), k = ln(c, 2, 'length'), o = A(n); for (var i = k - 1; i < n; i++) { var sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, g = true; for (var j = i - k + 1; j <= i; j++) { if (!ok(a[j]) || !ok(b[j])) { g = false; break; } sa += a[j]; sb += b[j]; saa += a[j] * a[j]; sbb += b[j] * b[j]; sab += a[j] * b[j]; } if (!g) continue; var d = Math.sqrt((k * saa - sa * sa) * (k * sbb - sb * sb)); o[i] = d ? (k * sab - sa * sb) / d : N; } return o; },
      crossover: function (c) { var a = ser(c, 0, 'source1'), b = ser(c, 1, 'source2'); return a.map(function (v, i) { return i && ok(v) && ok(b[i]) && ok(a[i - 1]) && ok(b[i - 1]) && a[i - 1] <= b[i - 1] && v > b[i] ? 1 : 0; }); },
      crossunder: function (c) { var a = ser(c, 0, 'source1'), b = ser(c, 1, 'source2'); return a.map(function (v, i) { return i && ok(v) && ok(b[i]) && ok(a[i - 1]) && ok(b[i - 1]) && a[i - 1] >= b[i - 1] && v < b[i] ? 1 : 0; }); },
      cross: function (c) { var a = ser(c, 0, 'source1'), b = ser(c, 1, 'source2'); return a.map(function (v, i) { return i && ok(v) && ok(b[i]) && ok(a[i - 1]) && ok(b[i - 1]) && ((a[i - 1] <= b[i - 1] && v > b[i]) || (a[i - 1] >= b[i - 1] && v < b[i])) ? 1 : 0; }); },
      rising: function (c) { var x = ser(c, 0, 'source'), k = ln(c, 1, 'length'); return x.map(function (v, i) { for (var j = 0; j < k; j++) if (!(x[i - j] > x[i - j - 1])) return 0; return 1; }); },
      falling: function (c) { var x = ser(c, 0, 'source'), k = ln(c, 1, 'length'); return x.map(function (v, i) { for (var j = 0; j < k; j++) if (!(x[i - j] < x[i - j - 1])) return 0; return 1; }); },
      barssince: function (c) { var x = ser(c, 0, 'condition'), k = N; return x.map(function (v) { if (v) k = 0; else if (ok(k)) k++; return k; }); },
      valuewhen: function (c) { var q = ser(c, 0, 'condition'), x = ser(c, 1, 'source'), v = N; return q.map(function (z, i) { if (z) v = x[i]; return v; }); },
      nz: function (c) { var r = arg(c, 1, 'replacement', 0); return map2(arg(c, 0, 'source'), r, n, function (a, b) { return ok(a) ? a : b; }); },
      fixnan: function (c) { var x = ser(c, 0, 'source'), v = N; return x.map(function (z) { if (ok(z)) v = z; return v; }); },
      abs: function (c) { return map1(arg(c, 0, 'x'), n, Math.abs); }, sqrt: function (c) { return map1(arg(c, 0, 'x'), n, Math.sqrt); }, log: function (c) { return map1(arg(c, 0, 'x'), n, Math.log); },
      log10: function (c) { return map1(arg(c, 0, 'x'), n, function (v) { return Math.log(v) / Math.LN10; }); }, exp: function (c) { return map1(arg(c, 0, 'x'), n, Math.exp); },
      round: function (c) { return map1(arg(c, 0, 'x'), n, Math.round); }, floor: function (c) { return map1(arg(c, 0, 'x'), n, Math.floor); }, ceil: function (c) { return map1(arg(c, 0, 'x'), n, Math.ceil); },
      sign: function (c) { return map1(arg(c, 0, 'x'), n, function (v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }); },
      pow: function (c) { return map2(arg(c, 0, 'base'), arg(c, 1, 'exponent'), n, Math.pow); },
      max: function (c) { var r = ev(c.args[0]); for (var i = 1; i < c.args.length; i++) r = map2(r, ev(c.args[i]), n, Math.max); return r; },
      min: function (c) { var r = ev(c.args[0]); for (var i = 1; i < c.args.length; i++) r = map2(r, ev(c.args[i]), n, Math.min); return r; },
      avg: function (c) { var r = ev(c.args[0]); for (var i = 1; i < c.args.length; i++) r = map2(r, ev(c.args[i]), n, function (a, b) { return a + b; }); return map1(r, n, function (v) { return v / c.args.length; }); },
      indicator: function (c) { var t = arg(c, 0, 'title', ''); if (typeof t === 'string') R.title = t.slice(0, 60); var o = arg(c, 1, 'overlay', 0); R.overlay = !!num(isS(o) ? o[0] : o); return 0; },
      input: function (c) {
        var def = num(arg(c, 0, 'defval', 0)), title = arg(c, 1, 'title', ''), key = 'i' + R.inputs.length; if (!ok(def)) throw E('input(): the default must be a number', c.line);
        if (R.inputs.length >= MAXIN) throw E('too many inputs', c.line);
        R.inputs.push({ key: key, def: def, title: typeof title === 'string' && title ? title.slice(0, 40) : key });
        var v = params && ok(+params[key]) ? +params[key] : def; return v;
      },
      plot: function (c) {
        if (R.plots.length >= MAXPLOT) throw E('too many plots', c.line);
        var s = ser(c, 0, 'series'), title = arg(c, 1, 'title', ''), col = colr(arg(c, 2, 'color', null)) || ['#f7931a', '#38bdf8', '#34d399', '#e879f9', '#facc15', '#ff5a4d'][R.plots.length % 6], style = arg(c, 99, 'style', 'line');
        var key = 'p' + R.plots.length, kind = style === 'columns' || style === 'histogram' ? 'hist' : style === 'circles' || style === 'cross' ? 'dots' : style === 'stepline' ? 'step' : 'line';
        R.plots.push([key, kind, kind === 'hist' && !c.named.color && c.args[2] === undefined ? '' : col, typeof title === 'string' ? title.slice(0, 40) : '']); R.out[key] = s; return 0;
      },
      hline: function (c) { var v = num(arg(c, 0, 'price')); if (ok(v) && R.hlines.length < 20) R.hlines.push(v); return 0; },
      plotshape: function (c) {
        if (R.shapes.length >= 12) throw E('too many plotshape() calls', c.line);
        var s = ser(c, 0, 'series'), title = arg(c, 1, 'title', ''), loc = arg(c, 99, 'location', 'above'), txt = arg(c, 99, 'text', ''), col = colr(arg(c, 99, 'color', null));
        var key = 's' + R.shapes.length; R.shapes.push({ key: key, below: loc === 'below' ? 1 : 0, text: (typeof txt === 'string' && txt ? txt : typeof title === 'string' ? title : '').slice(0, 12), color: col || (loc === 'below' ? '#34d399' : '#ff5a4d') }); R.out[key] = s; return 0;
      },
      bgcolor: function () { return 0; }, alertcondition: function () { return 0; }, fill: function () { return 0; }, barcolor: function () { return 0; }
    };
    F['input.int'] = F['input.float'] = F['input.source'] = F.input; F.plotchar = F.plotarrow = F.plotshape; F.strategy = F.indicator; F.study = F.indicator;
    F['color.new'] = function (c) { return arg(c, 0, 'color', '#f7931a'); }; F['color.rgb'] = function (c) { var r = num(arg(c, 0, 'r')), g = num(arg(c, 1, 'g')), b = num(arg(c, 2, 'b')); function h2(v) { v = Math.max(0, Math.min(255, Math.round(v) || 0)).toString(16); return v.length < 2 ? '0' + v : v; } return '#' + h2(r) + h2(g) + h2(b); };
    F['input.bool'] = function (c) { var d = arg(c, 0, 'defval', 0); return num(d) ? 1 : 0; }; F['input.string'] = function (c) { var d = arg(c, 0, 'defval', ''); return typeof d === 'string' ? d : ''; }; F['input.color'] = function (c) { return arg(c, 0, 'defval', '#f7931a'); };
    function fname(f) { return f.replace(/^(ta|math)\./, ''); }
    function ev(e) {
      switch (e.k) {
        case 'num': return e.v; case 'str': return e.v; case 'col': return e.v;
        case 'id': {
          var v = e.v;
          if (v in env) return env[v];
          if (v.indexOf('color.') === 0 && own(COLORS, v.slice(6))) return COLORS[v.slice(6)];
          if (own(COLORS, v)) return COLORS[v];
          var m = /^(plot\.style_|shape\.|location\.|size\.|hline\.style_|display\.|barmerge\.|xloc\.|yloc\.|text\.|position\.|label\.style_)([a-z_0-9]+)$/.exec(v);
          if (m) return m[2] === 'belowbar' || m[2] === 'bottom' ? 'below' : m[2] === 'abovebar' || m[2] === 'top' ? 'above' : m[2];
          if (v === 'ta.tr') return trng(C); if (v === 'math.pi') return Math.PI; if (v === 'math.e') return Math.E;
          throw E('unknown name “' + v + '”', e.line);
        }
        case 'neg': return map1(ev(e.a), n, function (x) { return -x; });
        case 'not': return map1(ev(e.a), n, function (x) { return x ? 0 : 1; });
        case 'hist': { var k = ev(e.n); if (isS(k)) k = k[k.length - 1]; k = Math.round(num(k)); if (!(k >= 0) || k > 100000) throw E('[ ] needs a number from 0 upward', e.line); return shift(S(ev(e.a), n), k); }
        case 'tern': {
          var c = ev(e.c), a = ev(e.a), b = ev(e.b);
          if (typeof a === 'string' || typeof b === 'string') { var cc = isS(c) ? c[c.length - 1] : c; return cc ? a : b; }
          if (!isS(c) && !isS(a) && !isS(b)) return num(c) ? a : b;
          c = S(c, n); a = S(a, n); b = S(b, n); var o = new Array(n); for (var i = 0; i < n; i++) o[i] = c[i] ? a[i] : b[i]; return o;
        }
        case 'bin': {
          var x = ev(e.a), y = ev(e.b), op = e.op;
          if (typeof x === 'string' || typeof y === 'string') { if (op === '==') return x === y ? 1 : 0; if (op === '!=') return x !== y ? 1 : 0; if (op === '+') return (String(x) + String(y)).slice(0, 80); throw E('text cannot be used with “' + op + '”', e.line); }
          return map2(x, y, n, op === '+' ? function (a, b) { return a + b; } : op === '-' ? function (a, b) { return a - b; } : op === '*' ? function (a, b) { return a * b; } : op === '/' ? function (a, b) { return b === 0 ? N : a / b; } : op === '%' ? function (a, b) { return b === 0 ? N : a % b; }
            : op === '<' ? function (a, b) { return a < b ? 1 : 0; } : op === '>' ? function (a, b) { return a > b ? 1 : 0; } : op === '<=' ? function (a, b) { return a <= b ? 1 : 0; } : op === '>=' ? function (a, b) { return a >= b ? 1 : 0; }
            : op === '==' ? function (a, b) { return a === b ? 1 : 0; } : op === '!=' ? function (a, b) { return a !== b ? 1 : 0; } : op === 'and' ? function (a, b) { return a && b ? 1 : 0; } : function (a, b) { return a || b ? 1 : 0; });
        }
        case 'call': {
          var f = fname(e.f); if (!Object.prototype.hasOwnProperty.call(F, f)) throw E('unknown function “' + e.f + '()”', e.line);
          return F[f](e);
        }
      }
      throw E('cannot evaluate this', e.line);
    }
    for (var i = 0; i < tree.length; i++) {
      var st = tree[i];
      try {
        if (st.k === 'set') { if (st.n === 'open' || st.n === 'high' || st.n === 'low' || st.n === 'close' || st.n === 'volume') throw E('“' + st.n + '” is a built-in name', st.line); env[st.n] = ev(st.e); }
        else ev(st.e);
      } catch (er) { if (er && er.es) { if (!er.line) er.line = st.line; throw er; } throw E(String(er && er.message || er).slice(0, 120), st.line); }
    }
    if (!dry && !R.plots.length && !R.shapes.length) throw E('the script draws nothing: add plot(...)', 1);
    return R;
  }

  /* ---------------------------------------------------------------- the visitor's scripts as indicators */
  var KEY = 'ek_pro_scripts', LIST = [];
  function sample() { var b = [], p = 100; for (var i = 0; i < 300; i++) { var o = p; p = p * (1 + 0.01 * Math.sin(i / 7) + 0.004 * Math.cos(i * 1.7)); b.push({ t: 1700000000 + i * 3600, o: o, h: Math.max(o, p) * 1.003, l: Math.min(o, p) * 0.997, c: p, v: 100 + 40 * Math.sin(i / 3) }); } return b; }
  /* check(src) → { ok, meta } or { ok: false, err, line } — runs the script once on a small made-up chart */
  function check(src) {
    try { var tree = parse(String(src || '')), R = run(tree, sample(), null); return { ok: true, tree: tree, meta: R }; }
    catch (e) { return { ok: false, err: String(e && e.message || e).slice(0, 160), line: e && e.line || 1 }; }
  }
  function register(s) {
    var r = check(s.src); if (!r.ok) return r;
    var M = r.meta, p = {}; M.inputs.forEach(function (x) { p[x.key] = x.def; });
    I.DEF[s.id] = { pane: M.overlay ? undefined : true, p: p, free: 1, user: 1, plots: M.plots.map(function (x) { return [x[0], x[1], x[2]]; }), levels: M.hlines.length ? M.hlines : undefined, shapes: M.shapes, labels: M.inputs };
    I.USER[s.id] = function (bars, q) { try { return run(r.tree, bars, q).out; } catch (e) { return {}; } };
    var nm = (s.name || M.title || 'Script').slice(0, 60);
    Object.keys(P.STR || {}).forEach(function (l) { P.STR[l]['in_' + s.id] = nm; P.STR[l]['ind_' + s.id] = 'Entekhab Script'; M.inputs.forEach(function (x) { P.STR[l]['p_' + x.key] = x.title; }); });
    return r;
  }
  function load() {
    var a = []; try { a = JSON.parse(root.localStorage.getItem(KEY) || '[]'); } catch (e) { a = []; }
    LIST = (Array.isArray(a) ? a : []).filter(function (s) { return s && /^us_[a-z0-9]{4,16}$/.test(s.id) && typeof s.src === 'string' && s.src.length <= MAXSRC; }).map(function (s) { return { id: s.id, name: String(s.name || '').slice(0, 60), src: s.src }; });
    LIST.forEach(function (s) { try { register(s); } catch (e) { } });
  }
  function store() { try { root.localStorage.setItem(KEY, JSON.stringify(LIST)); } catch (e) { } }
  P.script = {
    check: check, list: function () { return LIST.slice(); },
    save: function (id, name, src) {
      var s = id ? LIST.filter(function (x) { return x.id === id; })[0] : null;
      if (!s) { s = { id: 'us_' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(-12), name: '', src: '' }; LIST.push(s); }
      s.name = String(name || '').replace(/[<>]/g, '').slice(0, 60); s.src = String(src).slice(0, MAXSRC); var r = register(s); if (!r.ok) { if (!id) LIST.pop(); return r; } store(); r.id = s.id; return r;
    },
    remove: function (id) { LIST = LIST.filter(function (x) { return x.id !== id; }); delete I.DEF[id]; delete I.USER[id]; store(); },
    EXAMPLES: [
      ['RSI + signal', 'indicator("My RSI")\nlen = input(14, "Length")\nr = ta.rsi(close, len)\nsig = ta.ema(r, 9)\nplot(r, "RSI", color=#c084fc)\nplot(sig, "Signal", color=#f7931a)\nhline(70)\nhline(30)\nplotshape(ta.crossover(r, 30), "Buy", location=location.belowbar, color=color.green, text="B")\nplotshape(ta.crossunder(r, 70), "Sell", location=location.abovebar, color=color.red, text="S")'],
      ['EMA cross', 'indicator("EMA cross", overlay=true)\nfast = input(9, "Fast")\nslow = input(21, "Slow")\na = ta.ema(close, fast)\nb = ta.ema(close, slow)\nplot(a, "Fast", color=color.green)\nplot(b, "Slow", color=color.red)\nplotshape(ta.crossover(a, b), "Long", location=location.belowbar, text="L")\nplotshape(ta.crossunder(a, b), "Short", location=location.abovebar, text="S")'],
      ['Bollinger %B', 'indicator("Bollinger %B")\nlen = input(20, "Length")\nmult = input(2.0, "Mult")\nbasis = ta.sma(close, len)\ndev = mult * ta.stdev(close, len)\npb = (close - (basis - dev)) / (2 * dev)\nplot(pb, "%B", color=color.aqua)\nhline(1)\nhline(0.5)\nhline(0)'],
      ['Volume spike', 'indicator("Volume spike")\nlen = input(20, "Average")\nk = input(2.0, "Times")\navg = ta.sma(volume, len)\nratio = volume / avg\nplot(ratio, "Volume / average", style=plot.style_columns)\nhline(k)']
    ]
  };
  load();
})(typeof window !== 'undefined' ? window : globalThis);
