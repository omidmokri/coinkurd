/* entekhab.net — the market map: the coin panel (a drawer on wide screens, a sheet on phones).
   Overview  : price live (Binance socket while the panel is open), the change over all nine timeframes, market cap, FDV,
               volume, dominance, supply, ATH/ATL, the 7-day line, a converter to dollars and to toman (the Iranian
               exchanges' tether board, data/friction.json), and the coin's sector neighbours.
   Chart     : candles from Binance (TradingView Lightweight Charts, self-hosted), live.
   Flow      : aggressive buys minus sells for each window (data/mm_flow.json), the last three hours minute by minute,
               and the large trades as they happen.
   Order book: depth within ±2 % (Binance, refreshed every 10 s), spread, imbalance and the biggest walls.
   Derivatives: OKX perpetual funding and open interest (live), long/short accounts and liquidations from the site.
   Entekhab  : the scanner's findings, RSI and trend, the Entekhab score, recent news, and the coin's pages on the site.
   Every figure names its source; what a source does not give is "—". Not financial advice. */
(function () {
  'use strict';
  var MM = window.MM, d = document, S = MM.S, D = MM.D, T = MM.T, esc = MM.esc, h = MM.h, $ = MM.$, $$ = MM.$$;
  var P = MM.panel = {};
  var el = null, c = null, tab = 'over', ws = null, wsSyms = '', timers = [], chart = null, live = {};
  var BOT = 'Kurd_kurdistan_bot', OKX = 'https://www.okx.com/api/v5/';
  var TABS = ['over', 'chart', 'flow', 'book', 'deriv', 'ek'];

  function clearTimers() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; }
  function every(f, ms) { f(); timers.push(setInterval(function () { if (!d.hidden && el && el.classList.contains('on')) f(); }, ms)); }

  /* ---------------------------------------------------------------- frame */
  function frame() {
    if (el) return el;
    el = h('<aside class="mm-panel" translate="no" role="dialog" aria-modal="false" aria-labelledby="mm-p-name"><div class="mm-p-drag" aria-hidden="true"></div><div class="mm-p-in"></div></aside>');
    d.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-x]')) { P.close(); return; }
      var t = e.target.closest('[data-tab]'); if (t) { show(t.getAttribute('data-tab')); return; }
      var o = e.target.closest('[data-open]'); if (o) { MM.openCoin(o.getAttribute('data-open'), tab); return; }
      if (e.target.closest('[data-watch]')) { var on = MM.watch.toggle(c.s); MM.toast(T(on ? 'watch_added' : 'watch_removed')); head(); return; }
      var ctf = e.target.closest('[data-ctf]'); if (ctf) { chartTf = ctf.getAttribute('data-ctf'); MM.store.set('ek_mm_ctf', chartTf); body(); return; }
    });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el.classList.contains('on') && !d.querySelector('.mm-modal')) P.close(); });
    /* drag the sheet down to close it (phones) */
    var y0 = null;
    $('.mm-p-drag', el).addEventListener('pointerdown', function (e) { y0 = e.clientY; el.style.transition = 'none'; try { e.target.setPointerCapture(e.pointerId); } catch (er) { } });
    $('.mm-p-drag', el).addEventListener('pointermove', function (e) { if (y0 != null) el.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)'; });
    $('.mm-p-drag', el).addEventListener('pointerup', function (e) { var dy = y0 == null ? 0 : e.clientY - y0; y0 = null; el.style.transition = ''; el.style.transform = ''; if (dy > 90) P.close(); });
    return el;
  }
  P.open = function (coin, t) {
    frame(); c = coin; tab = TABS.indexOf(t) >= 0 ? t : (MM.store.get('ek_mm_ptab', 'over') || 'over');
    if (TABS.indexOf(tab) < 0) tab = 'over';
    el.dir = MM.rtl() ? 'rtl' : 'ltr'; el.lang = MM.lang();
    $('.mm-p-in', el).innerHTML = '<div class="mm-p-head"></div><div class="mm-p-tf"></div><nav class="mm-p-tabs" role="tablist"></nav><div class="mm-p-body"></div>';
    el.classList.add('on'); d.documentElement.classList.add('mm-p-open');
    head(); tfs(); tabs(); body(); socket();
    if (!P.wired) { P.wired = true; MM.on('data', function () { if (el && el.classList.contains('on') && c) { c = D.by[c.s] || c; head(); tfs(); } }); }
    try { history.replaceState(history.state, '', location.pathname + qs(c.s)); } catch (e) { }
  };
  function qs(s) { var q = new URLSearchParams(location.search); if (s) q.set('coin', s); else q.delete('coin'); var x = q.toString(); return x ? '?' + x : ''; }
  P.close = function () {
    if (!el) return;
    el.classList.remove('on'); d.documentElement.classList.remove('mm-p-open');
    clearTimers(); closeSocket(); killChart();
    try { history.replaceState(history.state, '', location.pathname + qs(null)); } catch (e) { }
  };
  function head() {
    var ch = c.ch[S.tf], src = live.p && c.bn ? 'live' : '';
    $('.mm-p-head', el).innerHTML =
      '<div class="mm-p-id">' + MM.logo(c.s, 42) + '<div><h2 id="mm-p-name">' + esc(c.n) + '</h2><small><b>' + esc(c.s) + '</b> · #' + MM.loc(c.rk) + ' · <i class="mm-sdot" style="background:' + MM.SECC[c.sec] + '"></i>' + esc(MM.secName(c.sec)) + '</small></div>' +
      '<button type="button" class="mm-ib mm-star' + (MM.watch.has(c.s) ? ' on' : '') + '" data-watch aria-pressed="' + MM.watch.has(c.s) + '" title="' + esc(T(MM.watch.has(c.s) ? 'watch_on' : 'watch_add')) + '">' + MM.ic('star') + '</button>' +
      '<button type="button" class="mm-ib" data-x aria-label="' + esc(T('close')) + '">' + MM.ic('close') + '</button></div>' +
      '<div class="mm-p-price"><b class="mm-n" id="mm-p-px">' + MM.fmtP(live.p || c.p) + '</b><span class="mm-chip mm-n ' + MM.cls(ch) + '">' + MM.fmtPct(ch) + ' · ' + MM.TFLBL[S.tf] + '</span>' +
      '<span class="mm-p-src ' + (src || D.live.src) + '"><i></i>' + esc(T(c.bn ? (src || D.live.src === 'live' ? 'p_live' : 'p_snap') : 'p_nobn')) + '</span></div>';
  }
  function tfs() {
    $('.mm-p-tf', el).innerHTML = MM.TFS.map(function (k) {
      var v = c.ch[k];
      return '<span class="' + (k === S.tf ? 'on ' : '') + MM.cls(v) + '"><small>' + MM.TFLBL[k] + '</small><b class="mm-n">' + MM.fmtPct(v) + '</b></span>';
    }).join('');
  }
  function tabs() {
    $('.mm-p-tabs', el).innerHTML = TABS.map(function (k) { return '<button type="button" role="tab" data-tab="' + k + '" class="' + (k === tab ? 'on' : '') + '" aria-selected="' + (k === tab) + '">' + esc(T('p_' + k)) + '</button>'; }).join('');
  }
  function show(k) { if (TABS.indexOf(k) < 0) return; tab = k; MM.store.set('ek_mm_ptab', k); tabs(); body(); socket(); }
  function body() {
    clearTimers(); killChart();
    var b = $('.mm-p-body', el); b.scrollTop = 0;
    ({ over: over, chart: chartTab, flow: flowTab, book: bookTab, deriv: derivTab, ek: ekTab })[tab](b);
  }
  /* txt: a value made of words (a date), which must keep the page's reading direction instead of the numbers' LTR */
  function kv(label, val, cls, txt) { return '<div class="mm-kv"><small>' + esc(label) + '</small><b ' + (txt ? 'dir="auto"' : 'class="mm-n' + (cls ? ' ' + cls : '') + '"') + '>' + val + '</b></div>'; }
  function note(s) { return '<p class="mm-p-note">' + esc(s) + '</p>'; }
  function card(title, html, extra) { return '<section class="mm-p-card"' + (extra || '') + '>' + (title ? '<h3>' + esc(title) + '</h3>' : '') + html + '</section>'; }

  /* ---------------------------------------------------------------- live socket (price; trades on the flow tab) */
  function socket() {
    if (!c || !c.bn || MM.saver() || !('WebSocket' in window)) { closeSocket(); return; }
    var s = c.bn.toLowerCase(), want = [s + '@miniTicker'];
    if (tab === 'flow') want.push(s + '@aggTrade');
    if (tab === 'chart') want.push(s + '@kline_' + chartIv());
    var key = want.join('/');
    if (ws && wsSyms === key) return;
    closeSocket(); wsSyms = key; live = {};
    try { ws = new WebSocket(MM.WS + '?streams=' + key); } catch (e) { ws = null; return; }
    var me = ws;
    ws.onmessage = function (e) {
      if (me !== ws) return;
      var m; try { m = JSON.parse(e.data); } catch (er) { return; }
      var x = m && m.data; if (!x) return;
      if (x.e === '24hrMiniTicker') {
        var p = +x.c; if (!(p > 0)) return;
        var prev = live.p; live.p = p;
        var px = d.getElementById('mm-p-px');
        if (px) { px.textContent = MM.fmtP(p); if (prev && p !== prev) { px.classList.remove('fu', 'fd'); void px.offsetWidth; px.classList.add(p > prev ? 'fu' : 'fd'); } }
      } else if (x.e === 'aggTrade') trade(x);
      else if (x.e === 'kline' && chart && chart.feed) chart.feed(x.k);
    };
    ws.onclose = function () { if (me === ws) { ws = null; wsSyms = ''; } };
  }
  function closeSocket() { if (ws) { try { ws.close(); } catch (e) { } } ws = null; wsSyms = ''; }

  /* ================================================================ overview */
  var toman = null;
  function loadToman() {
    if (toman) return toman;
    return (toman = MM.getJSON('/data/friction.json', 15000).then(function (j) { var p = j && j.prices; return p && p.usdt > 0 ? { r: p.usdt, t: p.usdt_time } : null; }, function () { toman = null; return null; }));
  }
  function over(b) {
    var tot = D.coins.reduce(function (s, x) { return s + (x.sec !== 'wrapped' ? x.mc || 0 : 0); }, 0);
    var p = live.p || c.p, pct = function (a, z) { return a && z ? (a / z * 100) : null; };
    var supply = c.ms ? MM.clamp((c.cs || 0) / c.ms * 100, 0, 100) : null;
    var sp = c.sp ? '<div class="mm-p-spark">' + MM.spark(c, 600, 96) + '<div class="mm-p-rng"><span class="mm-n">' + MM.fmtP(c.sp[0]) + '</span><small>' + esc(T('range7')) + '</small><span class="mm-n">' + MM.fmtP(c.sp[1]) + '</span></div></div>' : '';
    var stats = '<div class="mm-kvs">' +
      kv(T('mcap'), MM.fmtUsd(c.mc)) + kv(T('fdv'), MM.fmtUsd(c.fd)) + kv(T('vol24'), MM.fmtUsd(c.v)) +
      kv(T('volmc'), c.v && c.mc ? (c.v / c.mc * 100).toFixed(2) + '%' : '—') + kv(T('dom'), tot ? (c.mc / tot * 100).toFixed(c.mc / tot > 0.01 ? 2 : 3) + '%' : '—') +
      kv(T('rank'), '#' + MM.loc(c.rk)) + '</div>';
    var sup = '<div class="mm-kvs">' + kv(T('circ'), MM.fmtQty(c.cs)) + kv(T('total'), MM.fmtQty(c.ts)) + kv(T('max'), c.ms ? MM.fmtQty(c.ms) : '∞') + '</div>' +
      (supply != null ? '<div class="mm-bar"><i style="width:' + supply.toFixed(1) + '%"></i></div><p class="mm-p-note">' + esc(T('supplyPct', { p: MM.loc(supply.toFixed(1)) })) + '</p>' : '');
    var athp = c.ath ? (p / c.ath - 1) * 100 : null, atlp = c.atl ? (p / c.atl - 1) * 100 : null;
    var ath = '<div class="mm-kvs">' + kv(T('ath'), MM.fmtP(c.ath)) + kv(T('fromAth'), MM.fmtPct(athp), MM.cls(athp)) + kv(T('athDate'), esc(MM.fmtDate(c.athd)), '', 1) +
      kv(T('atl'), MM.fmtP(c.atl)) + kv(T('fromAtl'), MM.fmtPct(atlp), MM.cls(atlp)) + kv(T('atlDate'), esc(MM.fmtDate(c.atld)), '', 1) + '</div>';
    var peers = D.coins.filter(function (x) { return x.sec === c.sec && x.s !== c.s; }).slice(0, 8);
    var pr = peers.length ? '<div class="mm-peers">' + peers.map(function (x) {
      var v = x.ch[S.tf]; return '<button type="button" data-open="' + esc(x.s) + '">' + MM.logo(x.s, 22) + '<b>' + esc(x.s) + '</b><span class="mm-n ' + MM.cls(v) + '">' + MM.fmtPct(v) + '</span><small class="mm-n">' + MM.fmtUsd(x.mc) + '</small></button>';
    }).join('') + '</div>' : note(T('noPeers'));
    b.innerHTML = (sp ? card(T('spark7'), sp) : '') + card(T('market'), stats) + card(T('supply'), sup) + card(T('extremes'), ath) +
      card(T('conv'), '<div class="mm-conv"><label><input type="number" inputmode="decimal" min="0" step="any" value="1" id="mm-cv-a"><span>' + esc(c.s) + '</span></label><b>=</b><label><input type="number" inputmode="decimal" min="0" step="any" id="mm-cv-u"><span>USD</span></label><b>=</b><label><input type="number" inputmode="decimal" min="0" step="any" id="mm-cv-t"><span>' + esc(T('toman')) + '</span></label></div><p class="mm-p-note" id="mm-cv-n"></p>') +
      card(T('peers', { s: MM.secName(c.sec) }), pr);
    var A = $('#mm-cv-a', b), U = $('#mm-cv-u', b), M = $('#mm-cv-t', b), rate = null;
    function from(which) {
      var px = live.p || c.p; if (!(px > 0)) return;
      var a = +A.value, u = +U.value, t = +M.value;
      if (which === 'a') { u = a * px; U.value = round(u); if (rate) M.value = Math.round(u * rate); }
      if (which === 'u') { A.value = round(u / px); if (rate) M.value = Math.round(u * rate); }
      if (which === 't' && rate) { u = t / rate; U.value = round(u); A.value = round(u / px); }
    }
    function round(x) { return !isFinite(x) ? '' : +(x >= 1 ? x.toFixed(2) : x.toPrecision(6)); }
    A.oninput = function () { from('a'); }; U.oninput = function () { from('u'); }; M.oninput = function () { from('t'); };
    from('a');
    loadToman().then(function (r) {
      if (!el || !b.isConnected) return;
      var n = $('#mm-cv-n', b);
      if (r) { rate = r.r; from('a'); n.textContent = T('tomanNote', { r: MM.loc(Math.round(r.r).toLocaleString('en-US')), t: MM.fmtDate(r.t, true) }); }
      else { M.disabled = true; n.textContent = T('tomanNo'); }
    });
  }

  /* ================================================================ chart */
  var chartTf = MM.store.get('ek_mm_ctf', '1h');
  var CIV = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w' };
  function chartIv() { return CIV[chartTf] || '1h'; }
  function killChart() { if (chart) { try { chart.ro && chart.ro.disconnect(); chart.c.remove(); } catch (e) { } chart = null; } }
  function chartTab(b) {
    if (!c.bn) { b.innerHTML = (c.sp ? card(T('spark7'), '<div class="mm-p-spark">' + MM.spark(c, 600, 140) + '</div>') : '') + note(T('noChart')); return; }
    b.innerHTML = '<div class="mm-ctf" role="group">' + Object.keys(CIV).map(function (k) { return '<button type="button" data-ctf="' + k + '" class="' + (k === chartTf ? 'on' : '') + '">' + MM.TFLBL[k === '1w' ? '7d' : k] + '</button>'; }).join('') + '</div>' +
      '<div class="mm-chart" id="mm-chart"><div class="mm-wait">' + esc(T('loading')) + '</div></div>' + note(T('chartSrc'));
    socket();
    var box = $('#mm-chart', b), iv = chartIv(), me = c.s;
    Promise.all([MM.loadScript('/assets/vendor/lwc5.js'), MM.getJSON(MM.API + 'klines?symbol=' + c.bn + '&interval=' + iv + '&limit=400', 15000)]).then(function (r) {
      if (!el || c.s !== me || tab !== 'chart' || !box.isConnected) return;
      var LW = window.LightweightCharts, rows = r[1];
      box.innerHTML = '';
      var ch = LW.createChart(box, {
        autoSize: true, layout: { background: { type: 'solid', color: '#0b0b0c' }, textColor: '#b8b8b2', fontFamily: 'Vazirmatn, "Space Grotesk", sans-serif', fontSize: 11, attributionLogo: false },
        grid: { vertLines: { color: 'rgba(255,255,255,.035)' }, horzLines: { color: 'rgba(255,255,255,.035)' } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,.1)' }, timeScale: { borderColor: 'rgba(255,255,255,.1)', timeVisible: iv !== '1d' && iv !== '1w', secondsVisible: false },
        crosshair: { mode: 0, vertLine: { color: 'rgba(247,147,26,.45)', labelBackgroundColor: '#3a2a12' }, horzLine: { color: 'rgba(247,147,26,.45)', labelBackgroundColor: '#3a2a12' } },
        localization: { priceFormatter: function (p) { return MM.fmtP(p).slice(1); } }
      });
      var up = MM.upc(), dn = MM.dnc();
      var cs = ch.addSeries(LW.CandlestickSeries, { upColor: up, downColor: dn, borderUpColor: up, borderDownColor: dn, wickUpColor: up, wickDownColor: dn });
      var vs = ch.addSeries(LW.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'v', lastValueVisible: false, priceLineVisible: false });
      ch.priceScale('v').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      var bar = function (k) { return { time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] }; };
      var vol = function (k) { return { time: Math.floor(k[0] / 1000), value: +k[7], color: +k[4] >= +k[1] ? 'rgba(52,211,153,.35)' : 'rgba(255,90,77,.35)' }; };
      cs.setData(rows.map(bar)); vs.setData(rows.map(vol));
      ch.timeScale().fitContent();
      chart = { c: ch, feed: function (k) { if (k.i !== iv) return; var row = [k.t, k.o, k.h, k.l, k.c, k.v, k.T, k.q]; cs.update(bar(row)); vs.update(vol(row)); } };
    }, function () { if (box.isConnected) box.innerHTML = '<div class="mm-wait mm-err">' + esc(T('noReach')) + '</div>'; });
  }

  /* ================================================================ money flow */
  var trades = { list: [], buy: 0, sell: 0, since: 0, s: '' };
  function trade(x) {
    if (trades.s !== c.s) trades = { list: [], buy: 0, sell: 0, since: Date.now(), s: c.s };
    var usd = +x.p * +x.q, buy = !x.m;
    if (buy) trades.buy += usd; else trades.sell += usd;
    var min = c.mc > 5e10 ? 100000 : c.mc > 5e9 ? 25000 : 5000;
    if (usd >= min) { trades.list.unshift({ t: x.T, p: +x.p, u: usd, b: buy }); trades.list.length = Math.min(trades.list.length, 40); }
    if (!trades.raf) trades.raf = requestAnimationFrame(function () { trades.raf = 0; drawTrades(); });
  }
  function drawTrades() {
    var box = d.getElementById('mm-trades'); if (!box) return;
    var min = c.mc > 5e10 ? 100000 : c.mc > 5e9 ? 25000 : 5000, tot = trades.buy + trades.sell;
    box.innerHTML = '<div class="mm-tsum"><span class="up">' + esc(T('buys')) + ' <b class="mm-n">' + MM.fmtUsd(trades.buy) + '</b></span><i class="mm-brbar"><i style="width:' + (tot ? trades.buy / tot * 100 : 50).toFixed(1) + '%;background:' + MM.upc() + '"></i></i><span class="dn">' + esc(T('sells')) + ' <b class="mm-n">' + MM.fmtUsd(trades.sell) + '</b></span></div>' +
      '<p class="mm-p-note">' + esc(T('tradesSince', { t: MM.ago(trades.since || Date.now()), m: MM.fmtUsd(min) })) + '</p>' +
      (trades.list.length ? '<ol class="mm-trl">' + trades.list.map(function (t) {
        return '<li class="' + (t.b ? 'up' : 'dn') + '"><span>' + esc(T(t.b ? 'buy' : 'sell')) + '</span><b class="mm-n">' + MM.fmtUsd(t.u) + '</b><small class="mm-n">' + MM.fmtP(t.p) + '</small><small class="mm-n">' + new Date(t.t).toTimeString().slice(0, 8) + '</small></li>';
      }).join('') + '</ol>' : note(T('noBig')));
  }
  function flowTab(b) {
    if (!c.bn) { b.innerHTML = note(T('noFlow')); return; }
    b.innerHTML = card(T('flowWin'), '<div id="mm-fw"><div class="mm-wait">' + esc(T('loading')) + '</div></div>' + note(T('flowWhat'))) +
      card(T('cvd3h'), '<div id="mm-cvd" class="mm-cvd"><div class="mm-wait">' + esc(T('loading')) + '</div></div>') +
      card(T('bigTrades'), '<div id="mm-trades"></div>');
    drawTrades();
    MM.loadFlow().then(function (j) {
      var f = j.f && j.f[c.s], box = d.getElementById('mm-fw'); if (!box) return;
      if (!f) { box.innerHTML = note(T('noFlow')); return; }
      var mx = 0; MM.TFS.forEach(function (k) { if (f[k]) mx = Math.max(mx, Math.abs(f[k][0])); });
      box.innerHTML = '<table class="mm-ft"><thead><tr><th>' + esc(T('window')) + '</th><th>' + esc(T('netFlow')) + '</th><th>' + esc(T('buyShare')) + '</th><th>' + esc(T('volume')) + '</th></tr></thead><tbody>' +
        MM.TFS.map(function (k) {
          var x = f[k]; if (!x) return '';
          var net = x[0], qv = x[1], bs = qv ? (net + qv) / (2 * qv) * 100 : null, wpc = mx ? Math.abs(net) / mx * 50 : 0;
          return '<tr><td>' + MM.TFLBL[k] + '</td><td><div class="mm-fbar"><i class="' + (net >= 0 ? 'up' : 'dn') + '" style="width:' + wpc.toFixed(1) + '%;' + (net >= 0 ? 'inset-inline-start:50%' : 'inset-inline-end:50%') + ';background:' + MM.sideColor(net) + '"></i></div><b class="mm-n ' + MM.cls(net) + '">' + MM.fmtSigned(net) + '</b></td>' +
            '<td class="mm-n">' + (bs == null ? '—' : bs.toFixed(1) + '%') + '</td><td class="mm-n">' + MM.fmtUsd(qv) + '</td></tr>';
        }).join('') + '</tbody></table><p class="mm-p-note">' + esc(T('flowAsOf', { t: MM.fmtDate(j.t, true) })) + '</p>';
    }, function () { var box = d.getElementById('mm-fw'); if (box) box.innerHTML = note(T('noData')); });
    MM.getJSON(MM.API + 'klines?symbol=' + c.bn + '&interval=1m&limit=180', 15000).then(function (rows) {
      var box = d.getElementById('mm-cvd'); if (!box) return;
      var cum = 0, pts = rows.map(function (k) { cum += 2 * +k[10] - +k[7]; return [k[0], cum, +k[4]]; });
      box.innerHTML = cvdSvg(pts) + '<p class="mm-p-note">' + esc(T('cvdNote', { v: MM.fmtSigned(cum) })) + '</p>';
    }, function () { var box = d.getElementById('mm-cvd'); if (box) box.innerHTML = note(T('noReach')); });
  }
  function cvdSvg(pts) {
    if (pts.length < 2) return '';
    var W = 600, H = 150, lo = Infinity, hi = -Infinity, plo = Infinity, phi = -Infinity;
    pts.forEach(function (p) { lo = Math.min(lo, p[1], 0); hi = Math.max(hi, p[1], 0); plo = Math.min(plo, p[2]); phi = Math.max(phi, p[2]); });
    var X = function (i) { return (i / (pts.length - 1) * W).toFixed(1); }, Y = function (v) { return (H - 6 - (v - lo) / ((hi - lo) || 1) * (H - 12)).toFixed(1); }, YP = function (v) { return (H - 6 - (v - plo) / ((phi - plo) || 1) * (H - 12)).toFixed(1); };
    var line = pts.map(function (p, i) { return X(i) + ',' + Y(p[1]); }).join(' '), pl = pts.map(function (p, i) { return X(i) + ',' + YP(p[2]); }).join(' ');
    var end = pts[pts.length - 1][1], col = MM.sideColor(end);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-svg" preserveAspectRatio="none" role="img" aria-label="CVD"><line x1="0" x2="' + W + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="rgba(255,255,255,.18)" stroke-dasharray="4 4"/>' +
      '<polyline points="' + pl + '" fill="none" stroke="rgba(247,147,26,.55)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' +
      '<polygon points="0,' + Y(0) + ' ' + line + ' ' + W + ',' + Y(0) + '" fill="' + col + '" fill-opacity=".14"/><polyline points="' + line + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>' +
      '<div class="mm-lgd"><span><i style="background:' + col + '"></i>' + esc(T('cvdLine')) + '</span><span><i style="background:#f7931a"></i>' + esc(T('priceLine')) + '</span></div>';
  }

  /* ================================================================ order book */
  function bookTab(b) {
    if (!c.bn) { b.innerHTML = note(T('noBook')); return; }
    b.innerHTML = card(T('depth2'), '<div id="mm-depth" class="mm-depth"><div class="mm-wait">' + esc(T('loading')) + '</div></div>') + '<div id="mm-bk"></div>' + note(T('bookSrc'));
    every(function () {
      MM.getJSON(MM.API + 'depth?symbol=' + c.bn + '&limit=1000', 12000).then(function (ob) {
        if (!d.getElementById('mm-depth')) return;
        P.drawBook(ob);
      }, function () { var e = d.getElementById('mm-depth'); if (e) e.innerHTML = '<div class="mm-wait mm-err">' + esc(T('noReach')) + '</div>'; });
    }, 10000);
  }
  /* the book's numbers (also used by the liquidity page) */
  P.bookStats = function (ob) {
    var bids = ob.bids.map(function (x) { return [+x[0], +x[1]]; }), asks = ob.asks.map(function (x) { return [+x[0], +x[1]]; });
    if (!bids.length || !asks.length) return null;
    var mid = (bids[0][0] + asks[0][0]) / 2, out = { mid: mid, spread: (asks[0][0] - bids[0][0]) / mid * 1e4, bids: bids, asks: asks, band: {} };
    [0.5, 1, 2].forEach(function (p) {
      var lo = mid * (1 - p / 100), hi = mid * (1 + p / 100), B = 0, A = 0;
      bids.forEach(function (x) { if (x[0] >= lo) B += x[0] * x[1]; }); asks.forEach(function (x) { if (x[0] <= hi) A += x[0] * x[1]; });
      out.band[p] = { b: B, a: A };
    });
    out.reach = Math.min((mid - bids[bids.length - 1][0]) / mid, (asks[asks.length - 1][0] - mid) / mid) * 100;
    var walls = function (side, lim) { return side.filter(function (x) { return Math.abs(x[0] / mid - 1) <= 0.02; }).map(function (x) { return [x[0], x[0] * x[1]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, lim); };
    out.wb = walls(bids, 3); out.wa = walls(asks, 3);
    return out;
  };
  P.depthSvg = function (s, rangePct, W) {
    W = Math.max(260, Math.round(W || 600));
    var H = W < 480 ? 180 : 220, r = Math.min(rangePct || 2, Math.max(0.1, s.reach)), lo = s.mid * (1 - r / 100), hi = s.mid * (1 + r / 100);
    var cb = [], ca = [], cum = 0;
    s.bids.forEach(function (x) { if (x[0] >= lo) { cum += x[0] * x[1]; cb.push([x[0], cum]); } });
    cum = 0; s.asks.forEach(function (x) { if (x[0] <= hi) { cum += x[0] * x[1]; ca.push([x[0], cum]); } });
    var mx = Math.max(cb.length ? cb[cb.length - 1][1] : 0, ca.length ? ca[ca.length - 1][1] : 0) || 1;
    var X = function (p) { return ((p - lo) / (hi - lo) * W).toFixed(1); }, Y = function (v) { return (H - 18 - v / mx * (H - 30)).toFixed(1); };
    var pb = cb.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }), pa = ca.map(function (p) { return X(p[0]) + ',' + Y(p[1]); });
    var up = MM.upc(), dn = MM.dnc();
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-svg" role="img" aria-label="' + esc(T('depth2')) + '">' +
      (pb.length ? '<polygon points="' + X(s.mid) + ',' + Y(0) + ' ' + X(cb[0][0]) + ',' + Y(0) + ' ' + pb.join(' ') + ' ' + X(lo) + ',' + Y(cb[cb.length - 1][1]) + ' ' + X(lo) + ',' + Y(0) + '" fill="' + up + '" fill-opacity=".18" stroke="' + up + '" stroke-width="1.6"/>' : '') +
      (pa.length ? '<polygon points="' + X(s.mid) + ',' + Y(0) + ' ' + X(ca[0][0]) + ',' + Y(0) + ' ' + pa.join(' ') + ' ' + X(hi) + ',' + Y(ca[ca.length - 1][1]) + ' ' + X(hi) + ',' + Y(0) + '" fill="' + dn + '" fill-opacity=".18" stroke="' + dn + '" stroke-width="1.6"/>' : '') +
      '<line x1="' + X(s.mid) + '" x2="' + X(s.mid) + '" y1="6" y2="' + (H - 18) + '" stroke="#f7931a" stroke-dasharray="3 4"/>' +
      '<text x="4" y="' + (H - 4) + '" class="mm-ax">' + MM.fmtP(lo) + '</text><text x="' + (W / 2) + '" y="' + (H - 4) + '" class="mm-ax" text-anchor="middle">' + MM.fmtP(s.mid) + '</text><text x="' + (W - 4) + '" y="' + (H - 4) + '" class="mm-ax" text-anchor="end">' + MM.fmtP(hi) + '</text>' +
      '<text x="4" y="16" class="mm-ax">' + MM.fmtUsd(mx) + '</text></svg>';
    return { svg: svg, r: r };
  };
  P.drawBook = function (ob) {
    var s = P.bookStats(ob), box = d.getElementById('mm-depth'), bk = d.getElementById('mm-bk'); if (!s || !box) return;
    var g = P.depthSvg(s, 2, box.clientWidth);
    box.innerHTML = g.svg + (g.r < 2 ? '<p class="mm-p-note">' + esc(T('bookReach', { r: MM.loc(g.r.toFixed(2)) })) + '</p>' : '');
    var b1 = s.band[1], imb = b1.b + b1.a ? (b1.b - b1.a) / (b1.b + b1.a) * 100 : null;
    var wall = function (a, cls) { return a.map(function (x) { return '<li class="' + cls + '"><b class="mm-n">' + MM.fmtP(x[0]) + '</b><span class="mm-n">' + MM.fmtUsd(x[1]) + '</span><small class="mm-n">' + MM.fmtPct((x[0] / s.mid - 1) * 100) + '</small></li>'; }).join(''); };
    if (bk) bk.innerHTML = card(T('bookNums'), '<div class="mm-kvs">' + kv(T('spread'), s.spread.toFixed(2) + ' bps') + kv(T('imb1'), imb == null ? '—' : MM.fmtPct(imb, 1), MM.cls(imb)) + kv(T('reach'), '±' + s.reach.toFixed(2) + '%') + '</div>' +
      '<table class="mm-ft"><thead><tr><th></th><th>±0.5%</th><th>±1%</th><th>±2%</th></tr></thead><tbody>' +
      '<tr><td class="up">' + esc(T('bids')) + '</td>' + [0.5, 1, 2].map(function (p) { return '<td class="mm-n">' + MM.fmtUsd(s.band[p].b) + (p > s.reach ? '+' : '') + '</td>'; }).join('') + '</tr>' +
      '<tr><td class="dn">' + esc(T('asks')) + '</td>' + [0.5, 1, 2].map(function (p) { return '<td class="mm-n">' + MM.fmtUsd(s.band[p].a) + (p > s.reach ? '+' : '') + '</td>'; }).join('') + '</tr></tbody></table>') +
      card(T('walls'), '<div class="mm-walls"><ol>' + wall(s.wb, 'up') + '</ol><ol>' + wall(s.wa, 'dn') + '</ol></div>' + note(T('wallsNote')));
  };

  /* ================================================================ derivatives */
  function derivTab(b) {
    b.innerHTML = card(T('perp'), '<div id="mm-perp"><div class="mm-wait">' + esc(T('loading')) + '</div></div>' + note(T('perpSrc'))) + '<div id="mm-dx"></div>';
    var inst = c.s + '-USDT-SWAP';
    Promise.all([
      MM.getJSON(OKX + 'public/funding-rate?instId=' + inst, 12000).catch(function () { return null; }),
      MM.getJSON(OKX + 'public/open-interest?instType=SWAP&instId=' + inst, 12000).catch(function () { return null; })
    ]).then(function (r) {
      var box = d.getElementById('mm-perp'); if (!box) return;
      var f = r[0] && r[0].data && r[0].data[0], oi = r[1] && r[1].data && r[1].data[0];
      if (!f && !oi) { box.innerHTML = note(T('noPerp')); return; }
      var fr = f ? +f.fundingRate * 100 : null, next = f ? +f.fundingTime : null;
      box.innerHTML = '<div class="mm-kvs">' + kv(T('funding'), fr == null ? '—' : (fr > 0 ? '+' : '') + fr.toFixed(4) + '%', MM.cls(fr)) +
        kv(T('fundingAnn'), fr == null ? '—' : MM.fmtPct(fr * 3 * 365, 1), MM.cls(fr)) + kv(T('oi'), oi ? MM.fmtUsd(+oi.oiUsd) : '—') +
        kv(T('nextFunding'), next ? new Date(next).toTimeString().slice(0, 5) + ' · ' + T('inMin', { n: MM.loc(Math.max(0, Math.round((next - Date.now()) / 60000))) }) : '—') + '</div>' +
        '<p class="mm-p-note">' + esc(T(fr == null ? 'fundNone' : fr > 0.03 ? 'fundHot' : fr < -0.01 ? 'fundCold' : 'fundCalm')) + '</p>';
    });
    MM.getJSON('/data/derivatives.json', 15000).then(function (j) {
      var box = d.getElementById('mm-dx'); if (!box) return;
      var X = j[c.s], sw = (j.swaps || []).filter(function (x) { return x.coin === c.s; })[0], html = '';
      if (X && X.long_short && X.long_short.length) {
        var ls = X.long_short[X.long_short.length - 1][1], ls0 = X.long_short[0][1];
        html += card(T('lsTitle'), '<div class="mm-kvs">' + kv(T('lsNow'), ls.toFixed(2)) + kv(T('ls48'), ls0.toFixed(2)) + kv(T('lsLong'), (ls / (1 + ls) * 100).toFixed(1) + '%') + '</div>' + note(T('lsNote')));
      }
      if (X && X.liq) {
        var q = X.liq, tot = (q.long_usd_24h || q.long_usd || 0) + (q.short_usd_24h || q.short_usd || 0);
        html += card(T('liqTitle'), '<div class="mm-kvs">' + kv(T('liqLong'), MM.fmtUsd(q.long_usd_24h != null ? q.long_usd_24h : q.long_usd), 'dn') + kv(T('liqShort'), MM.fmtUsd(q.short_usd_24h != null ? q.short_usd_24h : q.short_usd), 'up') + kv(T('liqTot'), MM.fmtUsd(tot)) + '</div>' + note(T('liqNote')));
      }
      if (sw && !X) html += note(T('dxOther', { oi: MM.fmtUsd(sw.oi_usd), f: (sw.funding > 0 ? '+' : '') + sw.funding + '%' }));
      html += '<p class="mm-p-links"><a href="/derivatives/">' + esc(T('l_deriv')) + ' ' + MM.ic('ext', 'sm') + '</a></p>';
      box.innerHTML = html;
    }, function () { });
  }

  /* the bot reads  a_<COIN>_<PRICE>  with "d" for the decimal point and no exponent (scripts/bot_pro.py): the same
     encoding as /market/ (assets/pro/panels.js plainNum), tested against it in tests/test_bot_mm.py */
  function plainNum(v) {
    v = +v; if (!(v > 1e-15) || v >= 1e12) return '';
    var s = v.toFixed(Math.max(0, Math.min(18, 9 - Math.floor(Math.log10(v)))));
    return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
  }
  P._plainNum = plainNum;

  /* ================================================================ Entekhab's own data */
  function ekTab(b) {
    var links = [];
    if (c.pg) links.push('<a href="/coins/' + c.s.toLowerCase() + '/">' + esc(T('l_coin')) + '</a>');
    if (c.dn) links.push('<a href="/dna/' + c.s.toLowerCase() + '/">' + esc(T('l_dna')) + '</a>');
    links.push('<a href="/compare/">' + esc(T('l_cmp')) + '</a>', '<a href="/market/">' + esc(T('l_market')) + '</a>');
    var price = live.p || c.p, pv = price >= 1 ? price.toFixed(2) : String(+price.toPrecision(4));
    b.innerHTML = '<div id="mm-ek">' + (c.ek ? '<div class="mm-wait">' + esc(T('loading')) + '</div>' : note(T('ekNone'))) + '</div>' +
      card(T('alertT'), '<div class="mm-alert"><label><span>' + esc(c.s) + ' ≥ / ≤</span><input type="number" step="any" min="0" id="mm-al" value="' + esc(pv) + '"></label><a class="mm-btn pri" id="mm-al-go" target="_blank" rel="noopener">' + esc(T('alertGo')) + '</a></div>' + note(T('alertNote'))) +
      card(T('onSite'), '<p class="mm-p-links">' + links.join(' · ') + '</p>');
    var inp = $('#mm-al', b), go = $('#mm-al-go', b);
    var set = function () {
      var v = plainNum(inp.value), ok = /^[A-Z0-9]{2,12}$/.test(c.s) && /^\d{1,12}(\.\d{1,18})?$/.test(v);
      go.classList.toggle('off', !ok); go.setAttribute('aria-disabled', ok ? 'false' : 'true');
      if (!ok) { go.removeAttribute('href'); return; }
      go.href = 'https://t.me/' + BOT + '?start=a_' + c.s + '_' + v.replace('.', 'd');
    };
    inp.oninput = set; set();
    if (!c.ek) return;
    MM.getJSON('/api/v1/coins/' + c.s.toLowerCase() + '.json', 15000).then(function (j) {
      var box = d.getElementById('mm-ek'); if (!box) return;
      var m = j.market || {}, sc = j.score || null, ops = j.opportunities || [], news = (j.news || []).slice(0, 5), L = MM.lang();
      var html = card(T('tech'), '<div class="mm-kvs">' + kv('RSI (1h)', m.rsi != null ? (+m.rsi).toFixed(1) : '—') + kv(T('trend'), esc(MM.has('tr_' + m.trend) ? T('tr_' + m.trend) : '—')) +
        kv(T('hl48'), m.lo48 ? MM.fmtP(m.lo48) + ' – ' + MM.fmtP(m.hi48) : '—') + (sc ? kv(T('ekScore'), esc(String(sc.score != null ? sc.score : '—'))) : '') + '</div>' + note(T('techSrc')));
      if (ops.length) html += card(T('scanner'), '<ul class="mm-ops">' + ops.slice(0, 5).map(function (o) {
        var why = o.why ? (o.why[L] || o.why.en || o.why.fa || '') : '';
        var nm = MM.has('op_' + o.type) ? T('op_' + o.type) : o.type;
        return '<li class="' + (o.dir === 'bull' ? 'up' : o.dir === 'bear' ? 'dn' : '') + '"><b>' + esc(nm) + ' · ' + esc(o.tf || '') + '</b>' + (why ? '<small>' + esc(why) + '</small>' : '') + '</li>';
      }).join('') + '</ul>' + note(T('scanNote')));
      if (news.length) html += card(T('news'), '<ul class="mm-news">' + news.map(function (n) {
        var t = (L === 'fa' && n.tfa) || (L === 'ckb' && n.tckb) || n.title || '';
        return '<li><a href="' + esc(n.url || n.link || '#') + '" target="_blank" rel="noopener">' + esc(t) + '</a><small>' + esc(n.source || '') + '</small></li>';
      }).join('') + '</ul>');
      box.innerHTML = html;
    }, function () { var box = d.getElementById('mm-ek'); if (box) box.innerHTML = note(T('noData')); });
  }
})();
