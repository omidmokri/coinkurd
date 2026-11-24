/* entekhab.net — /market/ extras: the portfolio book and the options chain.
   The portfolio lives only in this browser (nothing is sent anywhere); it never asks for exchange keys.
   The options chain reads Deribit's public market data in the visitor's browser (BTC and ETH). */
(function () {
  'use strict';
  var P = window.PRO, A = P && P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$, $$ = A.$$, S = P.store;
  function num(v) { v = parseFloat(String(v).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 1776; }).replace(/[,٬\s]/g, '')); return isFinite(v) ? v : NaN; }
  function f2(v, dg) { return isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: dg == null ? 2 : dg, minimumFractionDigits: 0 }) : '—'; }

  /* ================================================================ portfolio */
  var PF = S.get('ek_pro_pf', null);
  if (!PF || typeof PF !== 'object' || !Array.isArray(PF.lists)) PF = { lists: [{ n: '', rows: [] }], cur: 0 };
  PF.lists = PF.lists.filter(function (l) { return l && Array.isArray(l.rows); }).map(function (l) {
    return { n: String(l.n || '').slice(0, 40), rows: l.rows.filter(function (r) { return r && A.SYM_RE.test(r.s) && isFinite(r.q) && isFinite(r.p); }).map(function (r) { return { s: r.s, q: +r.q, p: +r.p }; }) };
  });
  if (!PF.lists.length) PF.lists = [{ n: '', rows: [] }];
  PF.cur = Math.max(0, Math.min(PF.lists.length - 1, PF.cur | 0));
  function savePF() { S.set('ek_pro_pf', PF); demand(); }
  function demand() { var all = {}; PF.lists.forEach(function (l) { l.rows.forEach(function (r) { all[r.s] = 1; }); }); if (P.want) P.want('pf', Object.keys(all)); }
  var COLS = ['#f7931a', '#38bdf8', '#34d399', '#a78bfa', '#f472b6', '#facc15', '#ff5a4d', '#22d3ee', '#a3e635', '#e879f9', '#94a3b8'];
  P.portfolio = function () {
    var box = h('<div class="pm-pf"></div>'), off = null;
    function draw() {
      var L = PF.lists[PF.cur], tot = 0, cost = 0, rows = L.rows.map(function (r) { var t = P.tickers.d[r.s], px = t ? t.c : NaN, val = r.q * px, c = r.q * r.p; if (isFinite(val)) tot += val; cost += c; return { r: r, px: px, val: val, cost: c }; });
      var known = rows.filter(function (x) { return isFinite(x.val); }), kc = known.reduce(function (s, x) { return s + x.cost; }, 0), pnl = tot - kc;
      var tabs = PF.lists.map(function (l, i) { return '<button type="button" class="pm-chip' + (i === PF.cur ? ' on' : '') + '" data-l="' + i + '">' + esc(l.n || T('pfName', { n: i + 1 })) + '</button>'; }).join('') + '<button type="button" class="pm-chip" data-a="newl">+</button>';
      var seg = known.slice().sort(function (a, b) { return b.val - a.val; }), bar = tot > 0 ? '<div class="pm-pfbar">' + seg.map(function (x, i) { return '<i style="width:' + (x.val / tot * 100).toFixed(2) + '%;background:' + COLS[i % COLS.length] + '" title="' + esc(x.r.s) + ' ' + (x.val / tot * 100).toFixed(1) + '%"></i>'; }).join('') + '</div>' : '';
      box.innerHTML = '<div class="pm-idt">' + tabs + '</div>' +
        '<div class="pm-btg"><div class="pm-btc"><small>' + esc(T('pfValue')) + '</small><b class="pm-num">' + f2(tot) + ' <small>USDT</small></b></div><div class="pm-btc"><small>' + esc(T('pfCost')) + '</small><b class="pm-num">' + f2(kc) + '</b></div>' +
        '<div class="pm-btc"><small>' + esc(T('pfPnl')) + '</small><b class="pm-num ' + (pnl >= 0 ? 'up' : 'dn') + '">' + (pnl >= 0 ? '+' : '') + f2(pnl) + (kc > 0 ? ' <small>(' + (pnl / kc * 100).toFixed(2) + '%)</small>' : '') + '</b></div></div>' + bar +
        '<div class="pm-tw"><table class="pm-tbl" dir="ltr"><tr><th>' + esc(T('symbol')) + '</th><th>' + esc(T('pfQty')) + '</th><th>' + esc(T('pfAvg')) + '</th><th>' + esc(T('pfNow')) + '</th><th>' + esc(T('pfValue')) + '</th><th>%</th><th>' + esc(T('pfPnl')) + '</th><th></th></tr>' +
        rows.map(function (x, i) { var g = x.val - x.cost, share = tot > 0 && isFinite(x.val) ? x.val / tot * 100 : NaN; return '<tr><td><b>' + esc(x.r.s) + '</b></td><td class="pm-num">' + f2(x.r.q, 8) + '</td><td class="pm-num">' + f2(x.r.p, 8) + '</td><td class="pm-num">' + (isFinite(x.px) ? f2(x.px, 8) : '…') + '</td><td class="pm-num">' + f2(x.val) + '</td><td class="pm-num">' + (isFinite(share) ? share.toFixed(1) : '—') + '</td><td class="pm-num ' + (g >= 0 ? 'up' : 'dn') + '">' + (isFinite(g) ? (g >= 0 ? '+' : '') + f2(g) + ' (' + (x.cost > 0 ? (g / x.cost * 100).toFixed(1) : '0') + '%)' : '—') + '</td><td><button type="button" class="pm-ib" data-del="' + i + '">' + A.ic('trash') + '</button></td></tr>'; }).join('') +
        '</table></div>' + (rows.length ? '' : '<p class="pm-note">' + esc(T('pfEmpty')) + '</p>') +
        '<form class="pm-row pm-pfadd"><input class="pm-in" name="s" placeholder="BTC" maxlength="12" dir="ltr" autocomplete="off"><input class="pm-in" name="q" placeholder="' + esc(T('pfQty')) + '" inputmode="decimal" dir="ltr"><input class="pm-in" name="p" placeholder="' + esc(T('pfAvg')) + '" inputmode="decimal" dir="ltr"><button class="pm-btn pri" type="submit">' + esc(T('pfAdd')) + '</button></form>' +
        '<div class="pm-row"><button type="button" class="pm-btn" data-a="ren">' + esc(T('renameList')) + '</button><button type="button" class="pm-btn" data-a="csv">CSV</button>' + (PF.lists.length > 1 ? '<button type="button" class="pm-btn pm-del" data-a="dell">' + esc(T('remove')) + '</button>' : '') + '</div><p class="pm-note">' + esc(T('pfNote')) + '</p>';
      $$('[data-l]', box).forEach(function (b) { b.onclick = function () { PF.cur = +b.getAttribute('data-l'); savePF(); draw(); }; });
      $('[data-a="newl"]', box).onclick = function () { PF.lists.push({ n: '', rows: [] }); PF.cur = PF.lists.length - 1; savePF(); draw(); };
      $$('[data-del]', box).forEach(function (b) { b.onclick = function () { L.rows.splice(+b.getAttribute('data-del'), 1); savePF(); draw(); }; });
      $('[data-a="ren"]', box).onclick = function () { A.ask(T('renameList'), L.n, function (n) { L.n = String(n || '').replace(/[<>]/g, '').slice(0, 40); savePF(); P.portfolio(); }); };
      $('[data-a="csv"]', box).onclick = function () { A.download('entekhab_portfolio.csv', '﻿symbol,quantity,avg_price,price,value,pnl\n' + rows.map(function (x) { return [x.r.s, x.r.q, x.r.p, isFinite(x.px) ? x.px : '', isFinite(x.val) ? x.val.toFixed(2) : '', isFinite(x.val) ? (x.val - x.cost).toFixed(2) : ''].join(','); }).join('\n') + '\n', 'text/csv'); };
      var dl = $('[data-a="dell"]', box); if (dl) dl.onclick = function () { PF.lists.splice(PF.cur, 1); PF.cur = 0; savePF(); draw(); };
      $('.pm-pfadd', box).onsubmit = function (e) {
        e.preventDefault(); var f = e.target, s = String(f.s.value).trim().toUpperCase().replace(/USDT$/, ''), q = num(f.q.value), p = num(f.p.value);
        if (!A.SYM_RE.test(s) || !(q > 0) || !(p >= 0)) { A.toast(T('badValue')); return; }
        var ex = L.rows.filter(function (r) { return r.s === s; })[0];
        if (ex) { var nq = ex.q + q; ex.p = nq > 0 ? (ex.q * ex.p + q * p) / nq : p; ex.q = nq; } else L.rows.push({ s: s, q: q, p: p });   /* buying more: the average price moves */
        savePF(); draw();
      };
    }
    demand(); draw();
    var t = setInterval(function () { if (!box.isConnected) { clearInterval(t); return; } if (!document.activeElement || !box.contains(document.activeElement) || document.activeElement.tagName !== 'INPUT') draw(); }, 4000);
    A.modal(T('pfTitle'), box, { wide: true, nofocus: true, onclose: function () { clearInterval(t); } });
  };
  demand();

  /* ================================================================ options chain (Deribit, public data) */
  var MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  function expT(s) { var m = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(s); return m && MON[m[2]] != null ? Date.UTC(2000 + +m[3], MON[m[2]], +m[1], 8) : NaN; }
  P.options = function (cur) {
    cur = cur === 'ETH' ? 'ETH' : 'BTC';
    var box = h('<div class="pm-opt"><p class="pm-note"></p></div>'); $('p', box).textContent = T('loading');
    A.modal(T('optChain', { c: cur }), box, { wide: true, nofocus: true });
    P.getJSON('https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=' + cur + '&kind=option').then(function (j) {
      var R = j && Array.isArray(j.result) ? j.result : null; if (!R || !R.length) throw 0;
      var by = {}, spot = NaN;
      R.forEach(function (o) {
        var m = /^([A-Z]+)-(\d{1,2}[A-Z]{3}\d{2})-(\d+(?:d\d+)?)-([CP])$/.exec(String(o.instrument_name || '')); if (!m) return;
        var k = parseFloat(m[3].replace('d', '.')), e = by[m[2]] || (by[m[2]] = { t: expT(m[2]), K: {} }), row = e.K[k] || (e.K[k] = { k: k });
        row[m[4]] = { iv: +o.mark_iv, oi: +o.open_interest || 0, vol: +o.volume || 0, px: +o.mark_price };
        if (isFinite(+o.underlying_price) && !isFinite(spot)) spot = +o.underlying_price;
      });
      var exps = Object.keys(by).filter(function (e) { return isFinite(by[e].t); }).sort(function (a, b) { return by[a].t - by[b].t; }), sel = exps[0];
      function draw() {
        var E = by[sel], ks = Object.keys(E.K).map(Number).sort(function (a, b) { return a - b; }), coi = 0, poi = 0, cv = 0, pv = 0;
        ks.forEach(function (k) { var r = E.K[k]; if (r.C) { coi += r.C.oi; cv += r.C.vol; } if (r.P) { poi += r.P.oi; pv += r.P.vol; } });
        /* max pain: the settlement price at which the holders of all open options are paid the least */
        var best = NaN, bestV = Infinity; ks.forEach(function (s0) { var pay = 0; ks.forEach(function (k) { var r = E.K[k]; if (r.C && s0 > k) pay += (s0 - k) * r.C.oi; if (r.P && s0 < k) pay += (k - s0) * r.P.oi; }); if (pay < bestV) { bestV = pay; best = s0; } });
        var atm = ks.reduce(function (a, k) { return Math.abs(k - spot) < Math.abs(a - spot) ? k : a; }, ks[0]), ar = E.K[atm], aiv = ar ? ((ar.C ? ar.C.iv : 0) + (ar.P ? ar.P.iv : 0)) / ((ar.C ? 1 : 0) + (ar.P ? 1 : 0) || 1) : NaN;
        var days = Math.max(0.02, (E.t - Date.now()) / 864e5), em = isFinite(aiv) ? spot * aiv / 100 * Math.sqrt(days / 365) : NaN, mxo = Math.max.apply(null, ks.map(function (k) { var r = E.K[k]; return Math.max(r.C ? r.C.oi : 0, r.P ? r.P.oi : 0); })) || 1;
        var cell = function (o) { return o ? '<td class="pm-num">' + f2(o.oi, 1) + '</td><td class="pm-num">' + f2(o.vol, 1) + '</td><td class="pm-num">' + (isFinite(o.iv) ? o.iv.toFixed(1) : '—') + '</td><td class="pm-num">' + (isFinite(o.px) ? f2(o.px * spot, 0) : '—') + '</td>' : '<td></td><td></td><td></td><td></td>'; };
        box.innerHTML = '<div class="pm-idt">' + exps.map(function (e) { return '<button type="button" class="pm-chip' + (e === sel ? ' on' : '') + '" data-e="' + esc(e) + '">' + esc(e) + '</button>'; }).join('') + '</div>' +
          '<div class="pm-btg"><div class="pm-btc"><small>' + esc(T('optSpot')) + '</small><b class="pm-num">' + f2(spot, 0) + '</b></div><div class="pm-btc"><small>' + esc(T('optPC')) + '</small><b class="pm-num">' + (coi ? (poi / coi).toFixed(2) : '—') + '</b></div>' +
          '<div class="pm-btc"><small>' + esc(T('optPain')) + '</small><b class="pm-num">' + f2(best, 0) + '</b></div><div class="pm-btc"><small>' + esc(T('optIV')) + '</small><b class="pm-num">' + (isFinite(aiv) ? aiv.toFixed(1) + '%' : '—') + '</b></div>' +
          '<div class="pm-btc"><small>' + esc(T('optMove')) + '</small><b class="pm-num">' + (isFinite(em) ? '±' + f2(em, 0) + ' <small>(' + (em / spot * 100).toFixed(1) + '%)</small>' : '—') + '</b></div><div class="pm-btc"><small>' + esc(T('optDays')) + '</small><b class="pm-num">' + days.toFixed(1) + '</b></div></div>' +
          '<div class="pm-tw pm-optw"><table class="pm-tbl pm-optt" dir="ltr"><tr><th colspan="4" class="up">CALL</th><th></th><th colspan="4" class="dn">PUT</th></tr><tr><th>OI</th><th>Vol</th><th>IV%</th><th>$</th><th>Strike</th><th>OI</th><th>Vol</th><th>IV%</th><th>$</th></tr>' +
          ks.map(function (k) { var r = E.K[k], co = r.C ? r.C.oi / mxo * 100 : 0, po = r.P ? r.P.oi / mxo * 100 : 0; return '<tr class="' + (k === atm ? 'pm-atm' : '') + (k === best ? ' pm-pain' : '') + '" style="background:linear-gradient(90deg,rgba(52,211,153,.14) ' + co.toFixed(0) + '%,transparent ' + co.toFixed(0) + '%)">' + cell(r.C) + '<td class="pm-num pm-optk"><b>' + f2(k, 2) + '</b></td>' + cell(r.P) + '</tr>'; }).join('') + '</table></div>' +
          '<p class="pm-note">' + esc(T('optNote2')) + '</p>';
        $$('[data-e]', box).forEach(function (b) { b.onclick = function () { sel = b.getAttribute('data-e'); draw(); }; });
        var a = $('.pm-atm', box); if (a && a.scrollIntoView) try { a.scrollIntoView({ block: 'center' }); } catch (e) { }
      }
      draw();
    }).catch(function () { box.innerHTML = ''; var p = h('<p class="pm-note"></p>'); p.textContent = T('optFail'); box.appendChild(p); });
  };
})();
