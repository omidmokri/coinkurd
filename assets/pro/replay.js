/* entekhab.net — /market/ bar replay: pick a bar in the past, hide everything after it, then play the market forward
   bar by bar at one of nine speeds (or step by hand), with practice trades and their result. The chart's indicators
   and drawings keep working; the live feed of that chart waits until the replay ends. */
(function () {
  'use strict';
  var P = window.PRO, A = P && P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, ic = A.ic;
  var SPEEDS = [[3000, '0.3×'], [2000, '0.5×'], [1000, '1×'], [500, '2×'], [300, '3×'], [200, '5×'], [100, '10×'], [50, '20×'], [20, '50×']];

  var SYNC = P.store.get('ek_pro_rsync', true) !== false;          /* replay every chart of the layout together */
  function bar(cell) { return $('.pm-repbar', cell.el); }
  function others(cell) { return A.cells().filter(function (c) { return c !== cell; }); }
  function nowOf(cell) {                                             /* the replay's clock: the close of what is shown */
    var R = cell.replay; if (!R) return null;
    return R.sub && R.k >= 0 ? R.sub[R.k].t + R.ivSec : cell.bars[R.i].t + cell.tfSec();
  }
  function idxAt(cell, now) {                                        /* the last bar of a chart that has closed by `now` */
    var B = cell.bars, sec = cell.tfSec(), lo = 0, hi = B.length - 1, r = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (B[m].t + sec <= now) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  }
  function syncOthers(master) {
    if (!SYNC || !master.replay || master.replay.follower) return;
    var now = nowOf(master);
    others(master).forEach(function (c) {
      var R = c.replay; if (!R || !R.follower) return;
      var j = idxAt(c, now); if (j < 1) j = 1;
      if (j !== R.i) { R.i = j; c.render(j); c.marks(); c.legendLast(); c.drawer.update(); c.ovl.update(); paint(c); }
    });
  }
  P.replayToggle = function (cell) { if (cell.replay || cell.picking) stop(cell); else pick(cell); };
  P.replayStop = function (cell, quiet) { stop(cell, quiet); };

  /* 1. choose the start: a blue line follows the pointer; a click cuts the chart there */
  function pick(cell) {
    if (!cell.bars.length) { A.toast(T('loading')); return; }
    cell.picking = true; cell.el.classList.add('pm-picking'); cell.drawer.setTool(null); cell.drawer.select(null);
    showBar(cell);
    cell._pickMove = function (p) { cell.cutX = p && p.point ? p.point.x : null; cell.ovl.update(); };
    cell._pickClick = function (p) {
      if (!cell.picking || !p || p.logical == null) return;
      var i = Math.max(0, Math.min(cell.disp.length - 2, Math.round(p.logical)));
      if (cell.xform && cell.xform()) {                              /* bricks/columns: back to the bar that formed the picked one */
        var t = cell.disp[i].t, B = cell.bars; i = 0; while (i < B.length - 1 && B[i + 1].t <= t) i++;
        i = Math.max(1, Math.min(B.length - 2, i));
      }
      begin(cell, cell.bars.slice(), i);
    };
    cell.chart.subscribeCrosshairMove(cell._pickMove); cell.chart.subscribeClick(cell._pickClick);
    A.toast(T('pickStart'));
  }
  function unpick(cell) {
    if (cell._pickMove) { cell.chart.unsubscribeCrosshairMove(cell._pickMove); cell.chart.unsubscribeClick(cell._pickClick); cell._pickMove = cell._pickClick = null; }
    cell.picking = false; cell.cutX = null; cell.el.classList.remove('pm-picking'); cell.ovl.update();
  }
  /* 2. the replay itself: cell.bars becomes the replay buffer, cell.replay.i the last visible bar */
  function begin(cell, bars, i, more, follower) {
    unpick(cell);
    var old = cell.replay;
    if (old) clearInterval(old.timer);
    cell.replay = { i: i, speed: old ? old.speed : 2, play: false, timer: null, pos: null, trades: old ? old.trades : [], more: more !== false, cash: old ? old.cash : 0, follower: !!follower, iv: null, sub: null, k: -1 };
    cell.bars = bars;
    cell.render(i); cell.legend(); showBar(cell);
    var r = cell.chart.timeScale().getVisibleLogicalRange(), w = r ? r.to - r.from : 120, li = cell.xform && cell.xform() ? cell.disp.length - 1 : i;
    cell.chart.timeScale().setVisibleLogicalRange({ from: li - w * 0.75, to: li + w * 0.25 });
    if (!follower && SYNC) {                                         /* every other chart follows this one's clock */
      var now = nowOf(cell);
      others(cell).forEach(function (c) {
        if (!c.bars.length) return;
        if (c.picking) unpick(c);
        var src = c.replay ? c.bars : c.bars.slice(), j = idxAt(c, now);
        if (j >= 1) begin(c, src, j, true, true);
      });
    }
    A.emit('replay', cell);
  }
  function step(cell, k) {
    var R = cell.replay; if (!R) return;
    if (R.follower) return;
    if (R.iv) { stepSub(cell, k); syncOthers(cell); return; }
    if (k < 0) { if (R.i > 1) { R.i--; cell.render(R.i); paint(cell); syncOthers(cell); } return; }
    if (R.i >= cell.bars.length - 1) { extend(cell); return; }
    R.i++;
    var bars = cell.bars.slice(0, R.i + 1);
    if (cell.xform && cell.xform()) { cell.render(R.i); cell.legendLast(); paint(cell); syncOthers(cell); return; }   /* bricks may come several at once */
    cell.disp = cell.toDisp(bars);
    var D = cell.disp, L = D.length;
    cell.main.update(cell.point(D[L - 1], D[L - 2]));
    cell.renderInds(false, true); cell.marks(); cell.legendLast(); cell.drawer.update(); cell.ovl.update();
    paint(cell); syncOthers(cell);
  }
  /* Replay intervals: step by a smaller timeframe, so the current bar is built the way it formed */
  function setIv(cell, iv) {
    var R = cell.replay; if (!R) return;
    pause(cell);
    if (!iv) {                                                       /* back to whole bars: the partial bar completes */
      R.iv = null; R.sub = null; R.k = -1; R.part = null; cell.render(R.i); paint(cell); return;
    }
    var tf = P.parseTF(cell.cfg.tf), it = P.parseTF(iv); if (!tf || !it || it.sec >= tf.sec || tf.sec % it.sec) return;
    var from = (cell.bars[R.i].t + tf.sec) * 1000;
    if (from > Date.now()) { A.toast(T('repEnd')); return; }
    A.toast(T('loading'));
    P.history(cell.cfg.sym, iv, from, Math.min(Date.now(), from + it.sec * 1000 * 1000)).then(function (rows) {
      if (!cell.replay || cell.replay !== R) return;
      if (!rows.length) { A.toast(T('noHistory')); return; }
      R.iv = iv; R.ivSec = it.sec; R.sub = rows; R.k = -1; R.part = null; paint(cell);
    }, function () { A.toast(T('netErr')); });
  }
  function stepSub(cell, k) {
    var R = cell.replay, S = R.sub;
    if (k < 0) { if (R.k > 0) { R.k--; showSub(cell, true); } return; }
    if (R.k >= S.length - 1) {                                       /* more of the finer bars, or the end */
      if (R.loading) return;
      var last = S[S.length - 1], from = (last.t + R.ivSec) * 1000;
      if (from > Date.now() - R.ivSec * 1000) { pause(cell); A.toast(T('repEnd')); return; }
      R.loading = true;
      P.history(cell.cfg.sym, R.iv, from, Math.min(Date.now(), from + R.ivSec * 1000 * 1000)).then(function (rows) {
        R.loading = false; var add = rows.filter(function (b) { return b.t > last.t; });
        if (!add.length) { pause(cell); A.toast(T('repEnd')); return; }
        R.sub = R.sub.concat(add);
        var tf = P.parseTF(cell.cfg.tf), lb = cell.bars[cell.bars.length - 1];
        if (lb && add[add.length - 1].t >= lb.t + tf.sec) return P.history(cell.cfg.sym, cell.cfg.tf, (lb.t + tf.sec) * 1000, Math.min(Date.now(), (add[add.length - 1].t + tf.sec) * 1000)).then(function (bb) {
          cell.bars = cell.bars.concat(bb.filter(function (b) { return b.t > lb.t; }));
        });
      }, function () { R.loading = false; pause(cell); A.toast(T('netErr')); });
      return;
    }
    R.k++; showSub(cell, false);
  }
  function showSub(cell, back) {
    var R = cell.replay, S = R.sub, ts = S[R.k].t, tf = P.parseTF(cell.cfg.tf), bt = P.bucket(ts, tf), B = cell.bars;
    var i = -1, lo = 0, hi = B.length - 1; while (lo <= hi) { var m = (lo + hi) >> 1; if (B[m].t <= bt) { i = m; lo = m + 1; } else hi = m - 1; }
    if (i < 0) return;
    var part = null;
    for (var j = R.k; j >= 0 && S[j].t >= bt; j--) { var x = S[j]; if (!part) part = { t: bt, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v }; else { part.o = x.o; if (x.h > part.h) part.h = x.h; if (x.l < part.l) part.l = x.l; part.v += x.v; } }
    if (!part) return;
    var moved = i !== R.i, keep = B[i];
    R.i = i; R.part = part; B[i] = part;
    if (back || (moved && i < cell.disp.length - 1)) cell.render(i);
    else {
      cell.disp = cell.toDisp(B.slice(0, i + 1));
      var D = cell.disp, L = D.length; cell.main.update(cell.point(D[L - 1], D[L - 2]));
      cell.renderInds(false, true); cell.marks(); cell.legendLast(); cell.drawer.update(); cell.ovl.update();
    }
    B[i] = keep; paint(cell);
  }
  /* the first candle the market has */
  function firstStart(cell) {
    A.toast(T('loading'));
    P.firstBars(cell.cfg.sym, cell.cfg.tf).then(function (rows) {
      if (!rows || rows.length < 3) { A.toast(T('noHistory')); return; }
      begin(cell, rows, 1, true);
    }, function () { A.toast(T('netErr')); });
  }
  /* reached the end of the buffer: fetch the next stretch, or say that this is now */
  function extend(cell) {
    var R = cell.replay, last = cell.bars[cell.bars.length - 1], sec = cell.tfSec();
    if (!R.more || last.t + sec * 2 > Date.now() / 1000) { pause(cell); A.toast(T('repEnd')); return; }
    if (R.loading) return; R.loading = true;
    P.history(cell.cfg.sym, cell.cfg.tf, (last.t + sec) * 1000, Math.min(Date.now(), (last.t + sec * 1000) * 1000)).then(function (rows) {
      R.loading = false;
      var add = rows.filter(function (b) { return b.t > last.t; });
      if (!add.length) { R.more = false; pause(cell); A.toast(T('repEnd')); return; }
      cell.bars = cell.bars.concat(add);
    }, function () { R.loading = false; pause(cell); A.toast(T('netErr')); });
  }
  function play(cell) { var R = cell.replay; if (!R) return; R.play = true; clearInterval(R.timer); R.timer = setInterval(function () { step(cell, 1); }, SPEEDS[R.speed][0]); paint(cell); }
  function pause(cell) { var R = cell.replay; if (!R) return; R.play = false; clearInterval(R.timer); paint(cell); }
  function stop(cell, quiet) {
    unpick(cell);
    var R = cell.replay; if (R) clearInterval(R.timer);
    if (R && !R.follower) others(cell).forEach(function (c) { if (c.replay && c.replay.follower) stop(c, true); });
    cell.replay = null; var b = bar(cell); if (b) b.remove();
    if (cell.feed) { cell.bars = cell.feed.bars.slice(); cell.render(); cell.fit(); }
    cell.legend(); A.emit('replay', cell);
  }
  /* practice trades at the replay close; size in USDT, no fees, no leverage */
  function price(cell) { var R = cell.replay; return R ? (R.sub && R.k >= 0 && R.part ? R.part.c : cell.bars[R.i].c) : null; }
  function open(cell, side) {
    var R = cell.replay; if (!R) return;
    if (R.pos && R.pos.side === side) return;
    if (R.pos) close(cell);
    R.pos = { side: side, entry: price(cell), t: cell.bars[R.i].t, size: R.size || 1000 };
    paint(cell);
  }
  function close(cell) {
    var R = cell.replay; if (!R || !R.pos) return;
    var p = price(cell), q = R.pos, pct = (p / q.entry - 1) * 100 * q.side;
    R.trades.push({ side: q.side, entry: q.entry, exit: p, t0: q.t, t1: cell.bars[R.i].t, pct: pct, usd: q.size * pct / 100 });
    R.cash += q.size * pct / 100; R.pos = null; paint(cell);
  }
  function showBar(cell) {
    var b = bar(cell); if (b) b.remove();
    b = h('<div class="pm-repbar" dir="ltr"></div>'); cell.el.appendChild(b);
    paint(cell);
  }
  function paint(cell) {
    var b = bar(cell); if (!b) return;
    var R = cell.replay;
    if (R && R.follower) {                                           /* this chart follows another one's clock */
      b.innerHTML = '<span class="pm-rept">🔗 ' + esc(A.fmtT(cell.bars[R.i].t)) + '</span>'; b.classList.add('pm-follow'); return;
    }
    b.classList.remove('pm-follow');
    if (!R) {
      b.innerHTML = '<span class="pm-rept">' + esc(T('pickStart')) + '</span><button type="button" class="pm-rb" data-a="first">⏮ ' + esc(T('firstBar')) + '</button><button type="button" class="pm-rb" data-a="rand">🎲 ' + esc(T('random')) + '</button><button type="button" class="pm-rb" data-a="date">' + ic('cal') + ' ' + esc(T('date')) + '</button><button type="button" class="pm-rb" data-a="x">' + ic('x') + '</button>';
    } else {
      var cur = cell.bars[R.i], p = price(cell), q = R.pos, open_ = q ? (p / q.entry - 1) * 100 * q.side : null, multi = A.cells().length > 1;
      var tShow = R.sub && R.k >= 0 ? R.sub[R.k].t : cur.t;
      var wins = R.trades.filter(function (t) { return t.pct > 0; }).length;
      b.innerHTML = '<button type="button" class="pm-rb" data-a="pick" title="' + esc(T('newStart')) + '">✂</button>' +
        '<button type="button" class="pm-rb" data-a="back" title="' + esc(T('stepBack')) + '">' + ic('back') + '</button>' +
        '<button type="button" class="pm-rb pm-rplay" data-a="play" title="' + esc(T(R.play ? 'pause' : 'play')) + '">' + ic(R.play ? 'pause' : 'play') + '</button>' +
        '<button type="button" class="pm-rb" data-a="fwd" title="' + esc(T('stepFwd')) + '">' + ic('step') + '</button>' +
        '<button type="button" class="pm-rb" data-a="spd" title="' + esc(T('speed')) + '">' + SPEEDS[R.speed][1] + '</button>' +
        '<button type="button" class="pm-rb' + (R.iv ? ' on' : '') + '" data-a="iv" title="' + esc(T('repIv')) + '">⏱ ' + esc(R.iv ? A.tfLabel(R.iv) : T('ivBar')) + '</button>' +
        (multi ? '<button type="button" class="pm-rb' + (SYNC ? ' on' : '') + '" data-a="sync" title="' + esc(T('repSync')) + '">🔗</button>' : '') +
        '<span class="pm-rept">' + esc(A.fmtT(tShow)) + '</span>' +
        '<button type="button" class="pm-rb buy" data-a="buy">' + esc(T('buy')) + '</button><button type="button" class="pm-rb sell" data-a="sell">' + esc(T('sell')) + '</button>' +
        (q ? '<button type="button" class="pm-rb" data-a="close">' + esc(T('closePos')) + '</button><span class="pm-pnl ' + (open_ >= 0 ? 'up' : 'dn') + '">' + (q.side > 0 ? '▲' : '▼') + ' ' + (open_ >= 0 ? '+' : '') + open_.toFixed(2) + '%</span>' : '') +
        (R.trades.length ? '<button type="button" class="pm-rb" data-a="stats">' + esc(T('trades')) + ' ' + R.trades.length + ' · ' + Math.round(wins / R.trades.length * 100) + '% · <b class="' + (R.cash >= 0 ? 'up' : 'dn') + '">' + (R.cash >= 0 ? '+' : '') + R.cash.toFixed(1) + '$</b></button>' : '') +
        '<button type="button" class="pm-rb" data-a="x" title="' + esc(T('exitReplay')) + '">' + ic('x') + '</button>';
    }
    $$('[data-a]', b).forEach(function (x) {
      x.onclick = function (e) {
        e.stopPropagation(); var a = x.getAttribute('data-a');
        if (a === 'x') stop(cell); if (a === 'rand') randomStart(cell); if (a === 'date') dateStart(cell); if (a === 'first') firstStart(cell);
        if (a === 'iv') ivMenu(cell, x);
        if (a === 'sync') { SYNC = !SYNC; P.store.set('ek_pro_rsync', SYNC); if (SYNC) begin(cell, cell.bars, cell.replay.i, cell.replay.more); else others(cell).forEach(function (c) { if (c.replay && c.replay.follower) stop(c, true); }); paint(cell); }
        if (a === 'pick') { pause(cell); var keep = cell.replay; stop(cell, true); cell.replay = null; pick(cell); if (keep) { } }
        if (a === 'back') { pause(cell); step(cell, -1); } if (a === 'fwd') { pause(cell); step(cell, 1); }
        if (a === 'play') { if (cell.replay.play) pause(cell); else play(cell); }
        if (a === 'spd') speedMenu(cell, x);
        if (a === 'buy') open(cell, 1); if (a === 'sell') open(cell, -1); if (a === 'close') close(cell);
        if (a === 'stats') stats(cell);
      };
    });
  }
  function ivMenu(cell, anchor) {
    var R = cell.replay, tf = P.parseTF(cell.cfg.tf), I = P.inst ? P.inst(cell.cfg.sym) : null, min = I ? I.minSec : 1;
    var opts = ['1s', '5s', '15s', '1m', '5m', '15m', '1h', '4h'].filter(function (x) { var t = P.parseTF(x); return t && t.sec < tf.sec && tf.sec % t.sec === 0 && t.sec >= min && tf.sec / t.sec <= 1440; });
    var items = [{ label: T('ivBar'), on: !R.iv, act: function () { setIv(cell, null); } }].concat(opts.map(function (x) { return { label: A.tfLabel(x), on: R.iv === x, act: function () { setIv(cell, x); } }; }));
    if (!opts.length) items.push({ head: T('ivNone') });
    A.menu(anchor, items);
  }
  function speedMenu(cell, anchor) {
    var R = cell.replay;
    A.menu(anchor, SPEEDS.map(function (s, k) { return { label: s[1] + '  ·  ' + (s[0] >= 1000 ? (s[0] / 1000) + ' s' : s[0] + ' ms') + ' / ' + T('bar'), on: k === R.speed, act: function () { R.speed = k; if (R.play) play(cell); else paint(cell); } }; }));
  }
  function randomStart(cell) {
    var n = cell.bars.length; if (n < 200) { A.toast(T('needMore')); return; }
    begin(cell, cell.bars.slice(), 100 + Math.floor(Math.random() * (n - 200)));
  }
  function dateStart(cell) {
    var f = h('<form class="pm-go"><label class="pm-field"><span></span><input class="pm-in" type="date" required></label><div class="pm-row"><button class="pm-btn pri" type="submit"></button></div></form>');
    $('span', f).textContent = T('date'); $('button', f).textContent = T('startHere');
    $('input', f).max = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    f.onsubmit = function (e) {
      e.preventDefault(); var ts = Date.parse($('input', f).value + 'T00:00:00Z') / 1000; if (!isFinite(ts)) return; A.closeModal();
      var D = cell.bars, sec = cell.tfSec();
      if (D.length && ts >= D[0].t + sec * 60) { var i = Math.floor(P.t2l(D, ts, sec)); begin(cell, D.slice(), Math.max(1, Math.min(D.length - 2, i))); return; }
      A.toast(T('loading'));
      P.history(cell.cfg.sym, cell.cfg.tf, (ts - sec * 300) * 1000, Math.min(Date.now(), (ts + sec * 700) * 1000)).then(function (rows) {
        if (rows.length < 20) { A.toast(T('noHistory')); return; }
        var i = 0; while (i < rows.length - 1 && rows[i + 1].t <= ts) i++;
        begin(cell, rows, Math.max(1, Math.min(rows.length - 2, i)), true);
      }, function () { A.toast(T('netErr')); });
    };
    A.modal(T('replayFrom'), f);
  }
  function stats(cell) {
    var R = cell.replay, rows = R.trades.slice().reverse().map(function (t) {
      return '<tr><td>' + (t.side > 0 ? '▲ ' + esc(T('buy')) : '▼ ' + esc(T('sell'))) + '</td><td class="pm-num">' + cell.fmt(t.entry) + '</td><td class="pm-num">' + cell.fmt(t.exit) + '</td><td class="pm-num ' + (t.pct >= 0 ? 'up' : 'dn') + '">' + (t.pct >= 0 ? '+' : '') + t.pct.toFixed(2) + '%</td><td><small>' + esc(A.fmtD(t.t0)) + '</small></td></tr>';
    }).join('');
    var win = R.trades.filter(function (t) { return t.pct > 0; }), loss = R.trades.filter(function (t) { return t.pct <= 0; });
    var avg = function (a) { return a.length ? a.reduce(function (s, t) { return s + t.pct; }, 0) / a.length : 0; };
    A.modal(T('trades'), '<p class="pm-p">' + esc(T('repStats', { n: A.loc(R.trades.length), w: A.loc(Math.round(win.length / Math.max(1, R.trades.length) * 100)), aw: avg(win).toFixed(2), al: avg(loss).toFixed(2), s: R.cash.toFixed(2) })) + '</p>' +
      '<div class="pm-tw"><table class="pm-tbl" dir="ltr"><tr><th></th><th>' + esc(T('entry')) + '</th><th>' + esc(T('exit')) + '</th><th>%</th><th></th></tr>' + rows + '</table></div><p class="pm-note">' + esc(T('repNote')) + '</p>');
  }
  P.replayKey = function (cell, e) {
    var R = cell.replay; if (!R) return false;
    if (e.key === ' ') { e.preventDefault(); if (R.play) pause(cell); else play(cell); return true; }
    if (e.key === 'ArrowRight') { e.preventDefault(); pause(cell); step(cell, 1); return true; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); pause(cell); step(cell, -1); return true; }
    if (e.key.toLowerCase() === 'b' && e.shiftKey) { open(cell, 1); return true; }
    if (e.key.toLowerCase() === 's' && e.shiftKey) { open(cell, -1); return true; }
    return false;
  };
  A.on('replay', function () { var b = $('#pm-rep'); if (b) b.classList.toggle('on', !!(A.active() && (A.active().replay || A.active().picking))); });
  A.on('active', function () { var b = $('#pm-rep'); if (b) b.classList.toggle('on', !!(A.active() && (A.active().replay || A.active().picking))); });
  P._replay = { begin: begin, step: step, open: open, close: close, SPEEDS: SPEEDS, setIv: setIv, firstStart: firstStart, sync: function (v) { SYNC = !!v; } };   /* for the tests */
})();
