/* entekhab.net — the Observatory: /charts/liquidations/ (real liquidations, bar by bar) and /charts/cvd/ (net taker buying,
   spot against futures). Read in the visitor's browser, no key and no server of ours:
     Gate      api.gateio.ws            futures/usdt/contract_stats — dollars of longs and shorts liquidated and the takers' buys
                                        and sells, per 5 minutes or per hour; futures/usdt/candlesticks — the price
     OKX       www.okx.com              public/liquidation-orders — the liquidation orders of the last 24 hours (see okxLoad: not quite all of them)
     Binance   data-api.binance.vision  spot candles with the takers' share · fapi.binance.com the same for futures
   Arithmetic and definitions: assets/obs/flowmath.js. What these pages are not: the whole market. Binance and Bybit publish
   liquidations only as they happen and keep no history, so the history here is Gate's (and OKX's last day) and the pages
   say so. Gate's statistics miss a period now and then; those bars are drawn pale and counted, never filled in. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document, w = window, F = w.OBFlow, SRC = OB.src;
  var H = 3600000, DAY = 86400000, MS = OB.IVMS;
  var INK = '#e8e8e3', GRN = '#34d399', RED = '#ff5a4d', BLUE = '#3987e5', ACC = '#f7931a';
  var GATE = 'https://api.gateio.ws/api/v4/futures/usdt/', BNS = 'https://data-api.binance.vision/api/v3/', BNF = 'https://fapi.binance.com/fapi/v1/', OKX = 'https://www.okx.com/api/v5/';
  var GATE_ROWS = 2000;                                   /* the most rows Gate gives in one answer: 83 days of hours, 333 days of 4-hour periods */

  var LQ_R = [{ k: '24h', span: 24 * H, step: H }, { k: '3d', span: 3 * DAY, step: H }, { k: '1w', span: 7 * DAY, step: 4 * H },
    { k: '1m', span: 30 * DAY, step: DAY }, { k: '3m', span: 90 * DAY, step: DAY }, { k: '1y', span: 365 * DAY, step: DAY },
    { k: 'all', span: 1500 * DAY, step: DAY, all: true }];          /* "since 2023": Gate's daily rows, and before them the site's archive (data/obs/liq_archive.json) */
  var CV_R = [{ k: '24h', span: 24 * H, iv: '5m' }, { k: '3d', span: 3 * DAY, iv: '15m' }, { k: '1w', span: 7 * DAY, iv: '1h' },
    { k: '1m', span: 30 * DAY, iv: '4h' }, { k: '3m', span: 90 * DAY, iv: '1d' }, { k: '1y', span: 365 * DAY, iv: '1d' }];
  var IVK = { 3600000: '1h', 14400000: '4h', 86400000: '1d' };
  var DEF = { coin: 'BTC', lq_r: '3m', cv_r: '1w', cv_u: 'coin' };
  var S = (function () {
    var s = OB.store.get('ek_obs_fl', null) || {}, o = JSON.parse(JSON.stringify(DEF));
    Object.keys(o).forEach(function (k) { if (typeof s[k] === typeof o[k]) o[k] = s[k]; });
    var q = new URLSearchParams(location.search), v = q.get('coin');
    if (v && /^[A-Z0-9]{1,14}$/.test(v)) o.coin = v;
    if (/^(coin|usd)$/.test(q.get('unit') || '')) o.cv_u = q.get('unit');
    o._range = q.get('range');
    return o;
  })();
  var save = OB.debounce(function () { var c = Object.assign({}, S); delete c._range; OB.store.set('ek_obs_fl', c); }, 300);
  var V = { kind: null, el: null, ts: null, seq: 0, oseq: 0, timer: null, data: null, loading: false, sub: '', okx: null };

  function byK(list, k, def) { for (var i = 0; i < list.length; i++) if (list[i].k === k) return list[i]; return list[def]; }
  function rangeOf(kind) {
    var key = kind === 'liqhist' ? 'lq_r' : 'cv_r', list = kind === 'liqhist' ? LQ_R : CV_R;
    if (S._range) { if (byK(list, S._range, -1)) S[key] = S._range; S._range = null; }
    var R = byK(list, S[key], kind === 'liqhist' ? 4 : 2); S[key] = R.k; return R;
  }
  function tile(label, value, sub, id) { return '<div class="ob-tile"' + (id ? ' id="' + id + '"' : '') + '><small>' + esc(label) + '</small><b class="ob-n">' + value + '</b>' + (sub ? '<span>' + sub + '</span>' : '<span></span>') + '</div>'; }
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }
  function fail(head, text) {
    status('<b>' + esc(head) + '</b><br><span>' + esc(text) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
  }
  function usd(v) { return v == null || !isFinite(v) ? '—' : OB.fmtUsd(v); }
  function sgnUsd(v) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + OB.fmtUsd(Math.abs(v)); }
  function sgnQty(v) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + OB.compact(Math.abs(v)); }
  function pct(v, dp) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(dp == null ? 2 : dp) + '%'; }
  function when(t, step) { return step >= DAY ? OB.fmtDate(t + 12 * H) : OB.fmtDate(t, true); }       /* a UTC day is named by its noon, so every time zone reads the same date */
  function utc(ms) { return new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }

  /* ================================================================ Gate */
  function gateStats(base, iv, limit) {
    return SRC.cached('gs_' + base + '_' + iv + '_' + limit, 45000, function () {
      return OB.getJSON(GATE + 'contract_stats?contract=' + base + '_USDT&interval=' + iv + '&limit=' + limit, 30000).then(function (a) { if (!Array.isArray(a) || !a.length) throw new Error('gate'); return a; });
    });
  }
  /* the rows of one contract and the periods the source missed (read from BTC_USDT's rows of the same request) */
  function gateSet(base, iv, limit, mult, now) {
    return Promise.all([gateStats(base, iv, limit), base === 'BTC' ? null : gateStats('BTC', iv, limit).catch(function () { return null; })]).then(function (r) {
      var rows = F.gateRows(r[0], mult), ref = base === 'BTC' ? rows : r[1] ? F.gateRows(r[1], 1) : null;
      return { rows: rows, ref: ref, bad: ref ? F.gaps(ref, MS[iv], now) : null, checked: !!ref };
    });
  }
  function gateCandles(base, iv, limit) {
    return OB.getJSON(GATE + 'candlesticks?contract=' + base + '_USDT&interval=' + iv + '&limit=' + limit, 20000).then(function (a) {
      if (!Array.isArray(a)) throw new Error('gate');
      var out = [], seen = {};
      a.forEach(function (k) { var t = +k.t * 1000, c = +k.c; if (!(t > 0) || !(c > 0) || seen[t]) return; seen[t] = 1; out.push([t, +k.o, +k.h, +k.l, c]); });
      return out.sort(function (x, y) { return x[0] - y[0]; });
    });
  }

  /* ================================================================ OKX: every liquidation order of the last 24 hours */
  /* the 24 hours are cut into 2-hour slices walked at the same time; each walk pages back until it leaves its slice */
  /* OKX's list is not a clean ledger (measured 2026-11-14 on BTC): in a dense burst the same 150 ms answer with 13 orders for one cursor and
     with 12 partly different ones for another, so two walks over the same day differ by one to two per cent in both directions. Nothing
     returned is made up, but something is always left out: the sum is shown as a floor. */
  function okxLoad(base, now, onProgress) {
    var SL = 2 * H, from = now - 24 * H, slices = [], all = [], lost = false, cut = false;
    for (var a = from; a < now; a += SL) slices.push([a, Math.min(now, a + SL)]);
    return SRC.okx.ctVal(base).then(function (ct) {
      var tasks = slices.map(function (sl) {
        return function () {
          var st = null, pages = 0;
          function step() {
            var after = F.okxAfter(st, sl[1]);
            return OB.getJSON(OKX + 'public/liquidation-orders?instType=SWAP&uly=' + base + '-USDT&state=filled&limit=100&after=' + after, 15000).then(function (j) {
              var page = [];
              ((j && j.data) || []).forEach(function (g) { (g.details || []).forEach(function (x) {
                var t = +x.ts, px = +x.bkPx, sz = +x.sz; if (!(t > 0)) return;
                page.push({ t: t, px: px, usd: px > 0 && sz > 0 ? px * sz * ct : 0, side: x.posSide === 'short' || (x.posSide !== 'long' && x.side === 'buy') ? 'short' : 'long' });
              }); });
              page.sort(function (p, q) { return q.t - p.t; });
              st = F.okxStep(page, st, sl[0]); pages++;
              for (var i = 0; i < st.rows.length; i++) all.push(st.rows[i]);
              if (st.lost) lost = true;
              if (onProgress) onProgress(all.length);
              if (st.more && pages < 60) return step();
              if (st.more) cut = true;
            });
          }
          return step();
        };
      });
      return OB.pool(tasks, 4).then(function () { return { list: all, from: from, now: now, lost: lost, cut: cut }; });
    });
  }

  /* ================================================================ shared frame */
  function frame(kind, el, tools, body) {
    V.kind = kind; V.el = el; V.data = null; V.okx = null;
    el.innerHTML = '<div class="ob-tools">' + OB.ui.coinBtn(S.coin) + tools + OB.ui.acts() + '</div>' + body;
    OB.ui.coinLabel(el, S.coin); OB.loadLogos().then(function () { OB.ui.coinLabel(el, S.coin); });
    V.ts = new OB.TS($('#ob-ts', el));
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      var rk = V.kind === 'liqhist' ? 'lq_r' : 'cv_r';
      if (seg === 'ob-r' && v !== S[rk]) { S[rk] = v; OB.ui.setSeg(el, 'ob-r', v); save(); load(false, true); }
      else if (seg === 'ob-u' && v !== S.cv_u) { S.cv_u = v; OB.ui.setSeg(el, 'ob-u', v); save(); if (V.data) RENDER.cvd(V.data); }
      else if (b.id === 'ob-coin') OB.ui.pickCoin({ current: function () { return S.coin; }, onPick: function (base) { S.coin = base; save(); OB.ui.coinLabel(el, base); load(); } });
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load();
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.ts && V.data) V.ts.png(S.coin + ' · ' + T('tab_' + V.kind), V.sub, 'entekhab-' + V.kind + '-' + S.coin + '.png'); }
      else if (b.id === 'ob-share') OB.ui.share(V.kind === 'cvd' ? { coin: S.coin, range: S.cv_r, unit: S.cv_u } : { coin: S.coin, range: S.lq_r });
    };
    clearInterval(V.timer);
    /* a quiet refresh every 2 minutes for the short ranges; the long ones read megabytes and change little: the refresh button is theirs */
    V.timer = setInterval(function () { if (!d.hidden && V.data && !V.loading && V.data.R.span <= 7 * DAY) load(true); }, 120000);
  }
  /* keep: a change of range keeps OKX's last day as it is (the same 24 hours), unless it is older than 5 minutes */
  function load(quiet, keep) {
    var seq = ++V.seq, base = S.coin, now = Date.now(); V.loading = true;
    if (!quiet) status('<span class="ob-spin"></span>' + esc(T(V.kind === 'liqhist' ? 'loading_g' : 'loading2')));
    LOAD[V.kind](base, now).then(function (data) {
      if (seq !== V.seq) return;
      V.keep = !!quiet && !!V.data;                                    /* a quiet refresh leaves the reader's zoom alone */
      V.data = data; V.loading = false; status(''); RENDER[V.kind](data); V.keep = false;
      if (V.kind === 'liqhist' && !quiet && !(keep && V.okx && V.okx.base === base && V.okx.state && now - V.okx.now < 300000)) okx(base, now);
    }, function (e) {
      if (seq !== V.seq) return;
      V.loading = false; if (w.console) console.warn(e);
      if (quiet && V.data) return;
      V.data = null;                                                   /* nothing stale is redrawn under the error */
      if (V.kind === 'liqhist') fail(T('err_gate'), T('err_gate_d', { coin: base })); else fail(T('err_net'), T('err_cvd_d'));
    });
  }
  function unmount() { V.seq++; V.oseq++; clearInterval(V.timer); if (V.ts) V.ts.destroy(); V.ts = null; V.data = null; var p = d.getElementById('ob-pick'); if (p) p.remove(); }
  var LOAD = {}, RENDER = {};

  /* ================================================================ liquidations, bar by bar */
  LOAD.liqhist = function (base, now) {
    var R = rangeOf('liqhist'), hours = Math.min(GATE_ROWS, Math.ceil(R.span / H) + 30), deep = R.span / H + 24 > GATE_ROWS;
    var n4 = Math.min(GATE_ROWS, Math.ceil(R.span / (4 * H)) + 12), bars = Math.min(GATE_ROWS, Math.ceil(R.span / R.step) + 3);
    return Promise.all([
      gateSet(base, '1h', hours, 1, now),
      deep ? gateSet(base, '4h', n4, 1, now).catch(function () { return null; }) : null,
      gateCandles(base, IVK[R.step], Math.min(GATE_ROWS, bars)).catch(function () { return null; }),
      R.all ? gateSet(base, '1d', GATE_ROWS, 1, now).catch(function () { return null; }) : null,
      R.all ? OB.getJSON('/data/obs/liq_archive.json', 30000).catch(function () { return null; }) : null
    ]).then(function (r) {
      var arch = r[4] && r[4].coins && r[4].coins[base] ? r[4].coins[base] : null;
      return { base: base, R: R, now: now, h1: r[0], h4: r[1], deep: deep, candles: r[2], d1: r[3], arch: arch, archAt: r[4] ? r[4].updated_at : null };
    });
  };
  RENDER.liqhist = function (D0) {
    var el = V.el, R = D0.R, step = R.step, now = D0.now, base = D0.base;
    var from = Math.floor((now - R.span) / step) * step + step;
    var bk = F.liqSeries(D0.h1.rows, D0.h4 ? D0.h4.rows : null, step, from, now, D0.h1.bad, D0.h4 ? D0.h4.bad : null);
    if (R.all) {
      bk = F.older(bk, [D0.d1 ? F.dayBars(D0.d1.rows, D0.d1.ref, now) : null, F.archBars(D0.arch)]);
    }
    if (!bk.length) { fail(T('err_gate'), T('err_gate_d', { coin: base })); return; }
    var tot = F.liqTotals(bk), d24 = F.last24(D0.h1.rows, now, D0.h1.bad), first = bk[0].t;
    var ls = function (x) { return esc(T('lq_ls', { l: OB.ltr(usd(x.long)), s: OB.ltr(usd(x.short)) })); };
    $('#ob-tiles', el).innerHTML =
      tile(T('lq_24', { ex: 'Gate' }), esc(d24 ? usd(d24.total) : '—'), d24 ? ls(d24) + (d24.bad ? ' · ' + esc(T('lq_miss_h', { n: OB.loc(d24.bad) })) : '') : '', 'ob-t-24') +
      tile(R.all ? T('lq_tot_all') : T('lq_tot', { r: T('r_' + R.k) }), esc(usd(tot.total)), ls(tot), 'ob-t-tot') +
      tile(T('lq_share'), esc(tot.longShare == null ? '—' : tot.longShare.toFixed(1) + '%'), tot.longShare == null ? '' : esc(T('lq_share_s', { p: OB.ltr((100 - tot.longShare).toFixed(1) + '%') })), 'ob-t-share') +
      tile(T(step >= DAY ? 'lq_max_d' : 'lq_max_b'), esc(tot.max ? usd(tot.max.ll + tot.max.sl) : '—'), tot.max ? esc(when(tot.max.t, step)) : '', 'ob-t-max') +
      tile(T('lq_24_min', { ex: 'OKX' }), '<span id="ob-okx-v">…</span>', '<span id="ob-okx-s">' + esc(T('lq_okx_wait', { n: OB.loc(0) })) + '</span>', 'ob-t-okx');
    var dim = {}, up = [], dn = [], oi = [];
    bk.forEach(function (x) { up.push([x.t, x.sl]); dn.push([x.t, -x.ll]); if (x.bad) dim[x.t] = 1; if (x.oi) oi.push([x.t, x.oi]); });
    var cs = (D0.candles || []).filter(function (c) { return c[0] >= first && c[0] <= bk[bk.length - 1].t; });
    var abs = function (v) { return OB.fmtUsd(Math.abs(v)); };
    var panes = [
      cs.length ? { weight: 2, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [{ name: T('p_price'), type: 'candle', data: cs }] }
        : { weight: 2, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [{ name: T('p_price'), type: 'step', color: INK, width: 1.5, data: bk.filter(function (x) { return x.px; }).map(function (x) { return [x.t, x.px]; }) }] },
      { weight: 3, title: T('p_liq'), fmt: abs, marks: [{ y: 0, color: 'rgba(255,255,255,.3)' }], series: [
        { name: T('s_liq_short'), type: 'bars', color: GRN, data: up, dim: dim, fmt: abs }, { name: T('s_liq_long'), type: 'bars', color: RED, data: dn, dim: dim, fmt: abs }] }
    ];
    if (oi.length > 1) panes.push({ weight: 1.4, title: T('p_oi_gate'), fmt: function (v) { return OB.fmtUsd(v); }, series: [{ name: T('p_oi_gate'), type: 'step', color: BLUE, width: 1.5, data: oi }] });
    V.sub = T('r_' + R.k) + ' · Gate · ' + utc(now);
    V.bk = bk;
    V.ts.set({ daily: step >= DAY, keepView: V.keep, label: T('aria_lq', { coin: base }), dimNote: T('lq_pale'), view: [first, bk[bk.length - 1].t + step * 1.5], panes: panes });
    /* the table: the last bars, newest first */
    var rows = bk.slice(-14).reverse().map(function (x) {
      var t = x.ll + x.sl;
      return '<tr' + (x.bad ? ' class="ob-inc"' : '') + '><td>' + esc(when(x.t, step)) + (x.live ? ' <small>' + esc(T('lq_live')) + '</small>' : '') + (x.bad ? ' <small class="ob-incm">' + esc(T('lq_inc')) + '</small>' : '') + '</td><td class="ob-n dn">' + esc(usd(x.ll)) +
        '</td><td class="ob-n up">' + esc(usd(x.sl)) + '</td><td class="ob-n">' + esc(usd(t)) + '</td><td class="ob-n">' + (t > 0 ? (x.ll / t * 100).toFixed(1) + '%' : '—') + '</td><td class="ob-n">' + (x.px ? '$' + esc(OB.fmtP(x.px)) : '—') + '</td></tr>';
    }).join('');
    $('#ob-tbl', el).innerHTML = '<h3>' + esc(T('tbl_lq', { coin: base })) + '</h3><div class="ob-tblw"><table class="ob-grid" id="ob-ltbl"><thead><tr><th>' + esc(T(step >= DAY ? 'th_date' : 'th_time')) + '</th><th>' + esc(T('s_liq_long')) + '</th><th>' +
      esc(T('s_liq_short')) + '</th><th>' + esc(T('total')) + '</th><th>' + esc(T('lq_share')) + '</th><th>' + esc(T('th_close')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    $('#ob-tbl', el).hidden = false;
    var old = bk.filter(function (x) { return x.src === '4h'; }).length, note = T('note_lq');
    if (tot.bad) note += ' ' + T('lq_bad_n', { n: OB.loc(tot.bad), m: OB.loc(tot.n) });
    var n1d = bk.filter(function (x) { return x.src === '1d'; }).length, nar = bk.filter(function (x) { return x.src === 'arch'; }).length;
    if (nar) note += ' ' + T('lq_arch', { d: when(bk[nar].t, step) });
    if (n1d) note += ' ' + T('lq_1d', { d: when(bk[nar + n1d] ? bk[nar + n1d].t : bk[bk.length - 1].t, step) });
    old = bk.filter(function (x) { return x.src === '4h'; }).length;
    if (old && nar + n1d + old < bk.length) note += ' ' + T('lq_4h', { d: when(bk[nar + n1d + old].t, step) });
    if (D0.deep && !D0.h4) note += ' ' + T('lq_no4h');
    if (!D0.h1.checked) note += ' ' + T('lq_unchecked');
    $('#ob-note', el).textContent = note;
    if (V.okx && V.okx.base === base) okxShow(V.okx);
  };
  /* OKX's last 24 hours: V.okx = { base, now, state: 'load' | 'ok' | 'err', n (orders read so far), sum, … } */
  function okx(base, now) {
    var seq = ++V.oseq, st = V.okx = { base: base, now: now, state: 'load', n: 0 };
    okxShow(st);
    okxLoad(base, now, function (n) { if (seq !== V.oseq) return; st.n = n; okxShow(st); }).then(function (r) {
      if (seq !== V.oseq) return;
      r.base = base; r.state = 'ok'; r.sum = F.orders(r.list, r.from, 15); V.okx = r; okxShow(r);
    }, function (e) {
      if (seq !== V.oseq) return; if (w.console) console.warn(e);
      st.state = 'err'; okxShow(st);
    });
  }
  function okxShow(r) {
    var el = V.el, v = $('#ob-okx-v', el), s = $('#ob-okx-s', el), box = $('#ob-okx', el), m = r.sum; if (!v || !box) return;
    if (r.state !== 'ok') {
      box.hidden = true; box.innerHTML = '';
      v.textContent = r.state === 'err' ? '—' : '…'; s.textContent = r.state === 'err' ? T('lq_okx_none') : T('lq_okx_wait', { n: OB.loc(r.n) });
      return;
    }
    v.textContent = usd(m.total);
    s.textContent = T('lq_ls', { l: OB.ltr(usd(m.long)), s: OB.ltr(usd(m.short)) }) + ' · ' + T('lq_okx_n', { n: OB.loc(m.n.toLocaleString('en-US')) });
    if (!m.n) { box.hidden = true; return; }
    var rows = m.top.map(function (o) {
      return '<tr><td>' + esc(OB.fmtDate(o.t, true)) + '</td><td class="' + (o.side === 'long' ? 'dn' : 'up') + '">' + esc(T(o.side === 'long' ? 'side_long' : 'side_short')) + '</td><td class="ob-n">$' + esc(OB.fmtP(o.px)) + '</td><td class="ob-n">' + esc(usd(o.usd)) + '</td></tr>';
    }).join('');
    box.innerHTML = '<h3>' + esc(T('tbl_okx', { coin: r.base })) + '</h3><p class="ob-mut ob-small">' + esc(T('tbl_okx_n', { t: utc(r.now) })) + (r.lost || r.cut ? ' ' + esc(T('lq_okx_part')) : '') +
      '</p><div class="ob-tblw"><table class="ob-grid" id="ob-otbl"><thead><tr><th>' + esc(T('th_time')) + '</th><th>' + esc(T('th_side')) + '</th><th>' + esc(T('t_price')) + '</th><th>' + esc(T('th_value')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    box.hidden = false;
  }
  OB.views.liqhist = {
    mount: function (el) {
      var R = rangeOf('liqhist');
      frame('liqhist', el, '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', LQ_R.map(function (r) { return [r.k, T('r_' + r.k)]; }), R.k, 'ob-rng') + '</label>',
        '<div class="ob-tiles" id="ob-tiles"></div><div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div><p class="ob-note" id="ob-note"></p>' +
        '<div class="ob-tblbox" id="ob-tbl" hidden></div><div class="ob-tblbox" id="ob-okx" hidden></div>');
      load();
    }, unmount: unmount };

  /* ================================================================ CVD: net taker buying, spot against futures */
  function bnSpot(base, iv, from) { return OB.getJSON(BNS + 'klines?symbol=' + base + 'USDT&interval=' + iv + '&startTime=' + from + '&limit=1000', 20000); }
  /* the spot candles → { rows } | { none: true } (no such market) | { err: true } (not readable now). The mirror refuses an unknown
     symbol without CORS headers, which a page cannot tell from a dead connection — so after a failure it asks for Bitcoin, which is
     always there. Candles whose price is not this coin's (another coin under the same ticker) are not used either. */
  function spotSet(base, iv, from, refPx) {
    return bnSpot(base, iv, from).then(function (a) {
      var r = F.klineRows(a, 1);
      return r.length && OB.samePx(r[r.length - 1].c, refPx) ? { rows: r } : { none: true };
    }, function () {
      if (base === 'BTC') return { err: true };
      return OB.getJSON(BNS + 'klines?symbol=BTCUSDT&interval=1d&limit=1', 10000).then(function (a) { return Array.isArray(a) && a.length ? { none: true } : { err: true }; }, function () { return { err: true }; });
    });
  }
  function bnFut(sym, iv, from) { return OB.getJSON(BNF + 'klines?symbol=' + sym + '&interval=' + iv + '&startTime=' + from + '&limit=1500', 12000); }
  /* Gate's takers, rolled up to the candle size: 5-minute rows for the two short ranges, hourly rows for the others */
  function gateFut(base, R, from, now, ref) {
    var step = MS[R.iv], fine = step < H ? '5m' : '1h', n = Math.min(GATE_ROWS, Math.ceil((now - from) / MS[fine]) + 6);
    return SRC.gate.one(base).then(function (g) {
      if (!(g.mult > 0) || !OB.samePx(g.px, ref)) throw new Error('gate: another contract under this name');
      return gateSet(base, fine, n, g.mult, now);
    }).then(function (set) {
      var bk = F.roll(set.rows, MS[fine], step, set.bad, from, now);
      while (bk.length && bk[0].n < bk[0].want && !bk[0].live) bk.shift();              /* a first candle the history cuts short is not shown as a small one */
      if (!bk.length) throw new Error('gate: no rows');
      return { ex: 'gate', rows: bk, bad: bk.filter(function (x) { return x.bad; }).length, checked: set.checked };
    });
  }
  LOAD.cvd = function (base, now) {
    var R = rangeOf('cvd'), step = MS[R.iv], from = Math.floor((now - R.span) / step) * step + step;
    return OB.coins().catch(function () { return null; }).then(function (list) {
      var coin = null; (list || []).forEach(function (c) { if (c.base === base) coin = c; });
      var bnUp = !!(list && list.ok && list.ok.binance), canBn = bnUp && !!(coin && coin.bn);
      return Promise.all([
        spotSet(base, R.iv, from, coin ? coin.px : null),
        canBn ? bnFut(coin.bn, R.iv, from).then(function (a) { var r = F.klineRows(a, coin.bnMult); return r.length ? { ex: 'binance', rows: r, bad: 0, checked: true } : null; }, function () { return null; }) : null
      ]).then(function (r) {
        var spot = r[0].rows || null, why = r[0].err ? 'err' : r[0].none ? 'none' : null, ref = spot ? spot[spot.length - 1].c : coin ? coin.px : null;
        if (r[1]) return { spot: spot, why: why, fut: r[1] };
        return gateFut(base, R, from, now, ref).then(function (g) { return { spot: spot, why: why, fut: g }; }, function () { return { spot: spot, why: why, fut: null }; });
      }).then(function (x) {
        if (!x.spot && !x.fut) throw new Error('no data');
        return { base: base, R: R, now: now, from: from, spot: x.spot, spotWhy: x.why, fut: x.fut, bnListed: canBn || !bnUp };
      });
    });
  };
  RENDER.cvd = function (D0) {
    var el = V.el, R = D0.R, step = MS[R.iv], base = D0.base, spot = D0.spot, fut = D0.fut, usdU = S.cv_u === 'usd', key = usdU ? 'du' : 'd', daily = step >= DAY;
    var start = Math.max(D0.from, spot ? spot[0].t : 0, fut ? fut.rows[0].t : 0), shift = daily ? 0 : step / 2;
    var a = spot ? F.cvd(spot, key, start, shift) : null, b = fut ? F.cvd(fut.rows, key, start, shift) : null;
    var unit = usdU ? '$' : base, exName = fut ? OB.exById(fut.ex).name : '';
    var fmt = usdU ? function (v) { return OB.fmtUsd(v); } : function (v) { return OB.compact(v); };
    var val = function (x) { return x == null || x.total == null ? '—' : usdU ? sgnUsd(x.total) : sgnQty(x.total) + ' ' + base; };
    var cs = spot ? spot.filter(function (r) { return r.t >= start; }).map(function (r) { return [r.t, r.o, r.h, r.l, r.c]; })
      : fut.ex === 'binance' ? fut.rows.filter(function (r) { return r.t >= start; }).map(function (r) { return [r.t, r.o, r.h, r.l, r.c]; }) : null;
    var px0 = cs && cs.length ? cs[0][1] : null, px1 = cs && cs.length ? cs[cs.length - 1][4] : null, chg = px0 > 0 ? (px1 / px0 - 1) * 100 : null;
    $('#ob-tiles', el).innerHTML =
      tile(T('cv_spot'), esc(val(a)), esc(spot ? 'Binance · ' + T('r_' + R.k) : T('cv_none')), 'ob-t-spot') +
      tile(T('cv_fut'), esc(val(b)), esc(fut ? exName + ' · ' + T('r_' + R.k) : T('cv_none')), 'ob-t-fut') +
      tile(T('cv_px'), esc(pct(chg)), px1 ? '$' + esc(OB.fmtP(px1)) : '', 'ob-t-px');
    var panes = [];
    if (cs && cs.length) panes.push({ weight: 3, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [{ name: T('p_price'), type: 'candle', data: cs }] });
    else panes.push({ weight: 3, title: T('p_price'), fmt: function (v) { return OB.fmtP(v); }, series: [{ name: T('p_price'), type: 'step', color: INK, width: 1.5, data: fut.rows.filter(function (r) { return r.t >= start && r.px; }).map(function (r) { return [r.t, r.px]; }) }] });
    var zero = [{ y: 0, color: 'rgba(255,255,255,.3)' }];
    if (a && a.n) panes.push({ weight: 2, title: T('p_cvd_spot', { u: unit }), fmt: fmt, zero: true, marks: zero, series: [{ name: T('p_cvd_spot', { u: unit }), type: 'line', color: BLUE, width: 1.7, data: a.line }] });
    if (b && b.n) panes.push({ weight: 2, title: T('p_cvd_fut', { u: unit, ex: exName }), fmt: fmt, zero: true, marks: zero, series: [{ name: T('p_cvd_fut', { u: unit, ex: exName }), type: 'line', color: ACC, width: 1.7, data: b.line }] });
    V.sub = T('r_' + R.k) + ' · Binance' + (fut && fut.ex === 'gate' ? ' + Gate' : '') + ' · ' + utc(D0.now);
    var end = Math.max(spot ? spot[spot.length - 1].t : 0, fut ? fut.rows[fut.rows.length - 1].t : 0);
    V.ts.set({ daily: daily, keepView: V.keep, label: T('aria_cvd', { coin: base }), view: [start, end + step * 1.5], panes: panes });
    var note = T('note_cvd');
    if (!spot) note += ' ' + T(D0.spotWhy === 'err' ? 'cv_spot_err' : 'cv_nospot');
    if (!fut) note += ' ' + T('cv_nofut');
    else if (fut.ex === 'gate') {
      note += ' ' + T(D0.bnListed ? 'cv_gate' : 'cv_gate2');
      if (start > D0.from + step) note += ' ' + T('cv_gate_from', { d: when(start, step) });
      if (fut.bad) note += ' ' + T('cv_bad', { n: OB.loc(fut.bad) });
    }
    $('#ob-note', el).textContent = note;
  };
  OB.views.cvd = {
    mount: function (el) {
      var R = rangeOf('cvd');
      frame('cvd', el, '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', CV_R.map(function (r) { return [r.k, T('r_' + r.k)]; }), R.k, 'ob-rng') + '</label>' +
        '<label class="ob-lbl"><span>' + esc(T('unit')) + '</span>' + OB.ui.seg('ob-u', [['coin', T('u_coin')], ['usd', T('u_usd')]], S.cv_u) + '</label>',
        '<div class="ob-tiles" id="ob-tiles"></div><div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div><p class="ob-note" id="ob-note"></p>');
      load();
    }, unmount: unmount };
  OB._fl = { V: V, S: S, LQ_R: LQ_R, CV_R: CV_R };
})();
