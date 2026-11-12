/* entekhab.net — /market/ bar replay: pick a bar in the past, hide everything after it, then play the market forward
   bar by bar at one of nine speeds (or step by hand), with practice trades and their result. The chart's indicators
   and drawings keep working; the live feed of that chart waits until the replay ends. */
(function () {
  'use strict';
  var P = window.PRO, A = P && P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, ic = A.ic;
  var SPEEDS = [[3000, '0.3×'], [2000, '0.5×'], [1000, '1×'], [500, '2×'], [300, '3×'], [200, '5×'], [100, '10×'], [50, '20×'], [20, '50×']];

  function bar(cell) { return $('.pm-repbar', cell.el); }
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
  function begin(cell, bars, i, more) {
    unpick(cell);
    var old = cell.replay;
    cell.replay = { i: i, speed: old ? old.speed : 2, play: false, timer: null, pos: null, trades: old ? old.trades : [], more: more !== false, cash: old ? old.cash : 0 };
    cell.bars = bars;
    cell.render(i); cell.legend(); showBar(cell);
    var r = cell.chart.timeScale().getVisibleLogicalRange(), w = r ? r.to - r.from : 120;
    cell.chart.timeScale().setVisibleLogicalRange({ from: i - w * 0.75, to: i + w * 0.25 });
    A.emit('replay', cell);
  }
  function step(cell, k) {
    var R = cell.replay; if (!R) return;
    if (k < 0) { if (R.i > 1) { R.i--; cell.render(R.i); paint(cell); } return; }
    if (R.i >= cell.bars.length - 1) { extend(cell); return; }
    R.i++;
    var bars = cell.bars.slice(0, R.i + 1);
    cell.disp = cell.toDisp(bars);
    var D = cell.disp, L = D.length;
    cell.main.update(cell.point(D[L - 1], D[L - 2]));
    cell.renderInds(false, true); cell.marks(); cell.legendLast(); cell.drawer.update(); cell.ovl.update();
    paint(cell);
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
    cell.replay = null; var b = bar(cell); if (b) b.remove();
    if (cell.feed) { cell.bars = cell.feed.bars.slice(); cell.render(); cell.fit(); }
    cell.legend(); A.emit('replay', cell);
  }
  /* practice trades at the replay close; size in USDT, no fees, no leverage */
  function price(cell) { var R = cell.replay; return R ? cell.bars[R.i].c : null; }
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
    if (!R) {
      b.innerHTML = '<span class="pm-rept">' + esc(T('pickStart')) + '</span><button type="button" class="pm-rb" data-a="rand">🎲 ' + esc(T('random')) + '</button><button type="button" class="pm-rb" data-a="date">' + ic('cal') + ' ' + esc(T('date')) + '</button><button type="button" class="pm-rb" data-a="x">' + ic('x') + '</button>';
    } else {
      var cur = cell.bars[R.i], p = cur.c, q = R.pos, open_ = q ? (p / q.entry - 1) * 100 * q.side : null;
      var wins = R.trades.filter(function (t) { return t.pct > 0; }).length;
      b.innerHTML = '<button type="button" class="pm-rb" data-a="pick" title="' + esc(T('newStart')) + '">✂</button>' +
        '<button type="button" class="pm-rb" data-a="back" title="' + esc(T('stepBack')) + '">' + ic('back') + '</button>' +
        '<button type="button" class="pm-rb pm-rplay" data-a="play" title="' + esc(T(R.play ? 'pause' : 'play')) + '">' + ic(R.play ? 'pause' : 'play') + '</button>' +
        '<button type="button" class="pm-rb" data-a="fwd" title="' + esc(T('stepFwd')) + '">' + ic('step') + '</button>' +
        '<button type="button" class="pm-rb" data-a="spd" title="' + esc(T('speed')) + '">' + SPEEDS[R.speed][1] + '</button>' +
        '<span class="pm-rept">' + esc(A.fmtT(cur.t)) + '</span>' +
        '<button type="button" class="pm-rb buy" data-a="buy">' + esc(T('buy')) + '</button><button type="button" class="pm-rb sell" data-a="sell">' + esc(T('sell')) + '</button>' +
        (q ? '<button type="button" class="pm-rb" data-a="close">' + esc(T('closePos')) + '</button><span class="pm-pnl ' + (open_ >= 0 ? 'up' : 'dn') + '">' + (q.side > 0 ? '▲' : '▼') + ' ' + (open_ >= 0 ? '+' : '') + open_.toFixed(2) + '%</span>' : '') +
        (R.trades.length ? '<button type="button" class="pm-rb" data-a="stats">' + esc(T('trades')) + ' ' + R.trades.length + ' · ' + Math.round(wins / R.trades.length * 100) + '% · <b class="' + (R.cash >= 0 ? 'up' : 'dn') + '">' + (R.cash >= 0 ? '+' : '') + R.cash.toFixed(1) + '$</b></button>' : '') +
        '<button type="button" class="pm-rb" data-a="x" title="' + esc(T('exitReplay')) + '">' + ic('x') + '</button>';
    }
    $$('[data-a]', b).forEach(function (x) {
      x.onclick = function (e) {
        e.stopPropagation(); var a = x.getAttribute('data-a');
        if (a === 'x') stop(cell); if (a === 'rand') randomStart(cell); if (a === 'date') dateStart(cell);
        if (a === 'pick') { pause(cell); var keep = cell.replay; stop(cell, true); cell.replay = null; pick(cell); if (keep) { } }
        if (a === 'back') { pause(cell); step(cell, -1); } if (a === 'fwd') { pause(cell); step(cell, 1); }
        if (a === 'play') { if (cell.replay.play) pause(cell); else play(cell); }
        if (a === 'spd') speedMenu(cell, x);
        if (a === 'buy') open(cell, 1); if (a === 'sell') open(cell, -1); if (a === 'close') close(cell);
        if (a === 'stats') stats(cell);
      };
    });
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
  P._replay = { begin: begin, step: step, open: open, close: close, SPEEDS: SPEEDS };   /* for the tests */
})();
