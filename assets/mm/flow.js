/* entekhab.net — the market map: money flow (/money-flow/).
   What is measured, and from where:
     spot flow   = aggressive buys − aggressive sells in USDT on Binance (taker-buy quote volume × 2 − total quote volume),
                   per coin and window, from data/mm_flow.json (CI every ~15 min). It shows who is pushing, not where the
                   money "goes": every trade has a buyer and a seller.
     market cap  = live price × circulating supply; its change over the window = how much value the market added or lost.
     stablecoins = USD stablecoins in circulation now / a day / a week / a month ago (DefiLlama): minted dollars enter
                   crypto, burned ones leave.
     dominance   = BTC / ETH / stablecoins / the rest, hourly for 30 days (data/flows.json, CoinGecko).
     leverage    = open interest and funding of perpetual futures (data/derivatives.json, OKX).
   Nothing here is a forecast or advice. */
(function () {
  'use strict';
  var MM = window.MM, d = document, S = MM.S, D = MM.D, T = MM.T, esc = MM.esc, h = MM.h;
  var V = MM.views.flow = {};
  var st = null;

  function F(c, tf) { var f = D.flow && D.flow.f && D.flow.f[c.s], x = f && f[tf]; return x ? { net: x[0], qv: x[1] } : null; }
  /* the dollars a coin's market cap gained or lost over the window */
  function dMc(c, tf) { var v = c.ch[tf]; return v == null || v <= -100 || !c.mc ? null : c.mc - c.mc / (1 + v / 100); }
  function universe() {
    var n = S.top.flow || 100;
    return D.coins.filter(function (c) { return c.sec !== 'stable' && c.sec !== 'wrapped'; }).slice(0, n);
  }

  /* ---------------------------------------------------------------- KPIs */
  function kpis(list, tf) {
    var net = 0, qv = 0, inn = 0, out = 0, dm = 0, have = 0;
    list.forEach(function (c) { var f = F(c, tf); if (f) { have++; net += f.net; qv += f.qv; if (f.net > 0) inn++; else if (f.net < 0) out++; } var x = dMc(c, tf); if (x != null) dm += x; });
    var bs = qv ? (net + qv) / (2 * qv) * 100 : null, stb = D.flow && D.flow.st;
    var dom = st.dom, btcd = null, btcd0 = null;
    if (dom && dom.length) {
      var last = dom[dom.length - 1], secs = { '5m': 3600, '15m': 3600, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400, '7d': 604800, '30d': 2592000, '1y': 2592000 }[tf];
      var t0 = last.t - secs, prev = dom.filter(function (x) { return x.t <= t0; }).pop() || dom[0];
      btcd = last.btc; btcd0 = prev.btc; st.domSpan = last.t - prev.t;
    }
    var k = function (lbl, val, sub, cls) { return '<div class="mm-kpi' + (cls ? ' ' + cls : '') + '"><small>' + esc(lbl) + '</small><b' + (/^</.test(val) ? '' : ' class="mm-n"') + '>' + val + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; };
    var stSub = stb ? '<i class="mm-n ' + MM.cls(stb.d1) + '">' + MM.fmtSigned(stb.d1) + '</i> ' + esc(T('per1d')) + ' · <i class="mm-n ' + MM.cls(stb.d7) + '">' + MM.fmtSigned(stb.d7) + '</i> ' + esc(T('per7d')) + ' · <i class="mm-n ' + MM.cls(stb.d30) + '">' + MM.fmtSigned(stb.d30) + '</i> ' + esc(T('per30d')) : esc(T('noData'));
    return '<div class="mm-kpis">' +
      k(T('k_net', { n: MM.loc(list.length), tf: MM.TFLBL[tf] }), have ? MM.fmtSigned(net) : '—', have ? esc(T('k_bs', { p: MM.loc(bs.toFixed(1)) })) : esc(T('noData')), have ? (net > 0 ? 'up' : net < 0 ? 'dn' : '') : '') +
      k(T('k_breadth'), have ? '<span class="up mm-n">' + MM.loc(inn) + '</span> / <span class="dn mm-n">' + MM.loc(out) + '</span>' : '—', esc(T('k_breadth2'))) +
      k(T('k_mc', { tf: MM.TFLBL[tf] }), MM.fmtSigned(dm), esc(T('k_mc2')), dm > 0 ? 'up' : dm < 0 ? 'dn' : '') +
      k(T('k_stable'), stb ? MM.fmtUsd(stb.tot) : '—', stSub, stb ? (stb.d7 > 0 ? 'up' : stb.d7 < 0 ? 'dn' : '') : '') +
      k(T('k_btcd'), btcd != null ? btcd.toFixed(2) + '%' : '—', btcd != null ? '<i class="mm-n ' + MM.cls(btcd - btcd0) + '">' + (btcd - btcd0 >= 0 ? '+' : '') + (btcd - btcd0).toFixed(2) + '</i> ' + esc(T('k_btcd2', { span: span(st.domSpan) })) : '') +
      '</div>';
  }
  function span(sec) { if (!sec) return '—'; return sec < 172800 ? T('span_h', { n: MM.loc(Math.max(1, Math.round(sec / 3600))) }) : T('span_d', { n: MM.loc(Math.round(sec / 86400)) }); }

  /* ---------------------------------------------------------------- sectors and the flow river */
  function sectors(list, tf) {
    var by = {};
    list.forEach(function (c) {
      var s = by[c.sec] = by[c.sec] || { k: c.sec, net: 0, qv: 0, dm: 0, mc: 0, n: 0, has: 0, top: null, bot: null };
      var f = F(c, tf), x = dMc(c, tf);
      s.n++; s.mc += c.mc || 0; if (x != null) s.dm += x;
      if (f) { s.has++; s.net += f.net; s.qv += f.qv; if (!s.top || f.net > s.top.v) s.top = { s: c.s, v: f.net }; if (!s.bot || f.net < s.bot.v) s.bot = { s: c.s, v: f.net }; }
    });
    return Object.keys(by).map(function (k) { var s = by[k]; s.bs = s.qv ? (s.net + s.qv) / (2 * s.qv) * 100 : null; s.pct = s.mc - s.dm > 0 ? s.dm / (s.mc - s.dm) * 100 : null; return s; });
  }
  /* fit a label into a box: shrink the font rather than let it spill into the neighbour */
  function fitFont(txt, w, fs) { var est = String(txt).length * fs * (/[\u0600-\u06ff]/.test(txt) ? 0.5 : 0.6); return est > w ? Math.max(9, Math.floor(fs * w / est)) : fs; }
  function river(secs, metric, W) {
    var val = function (s) { return metric === 'mc' ? s.dm : s.has ? s.net : 0; };
    var outs = secs.filter(function (s) { return val(s) < 0; }).sort(function (a, b) { return val(a) - val(b); });
    var ins = secs.filter(function (s) { return val(s) > 0; }).sort(function (a, b) { return val(b) - val(a); });
    if (!outs.length && !ins.length) return '<p class="mm-p-note">' + esc(T('noData')) + '</p>';
    W = Math.max(280, Math.round(W || 1000));
    var nr = W < 640, MINH = 26, gap = nr ? 6 : 8, m = nr ? 1 : 12;
    var nodeW = nr ? Math.round(W * 0.3) : Math.min(170, Math.round(W * 0.16)), hubW = nr ? 28 : 56, cx = W / 2;
    var n = Math.max(outs.length, ins.length, 1), top = 34, fsN = nr ? 12 : 13;
    /* each sector's label: one line if it fits at a readable size, otherwise two lines (and a taller node) */
    var LY = {};
    secs.forEach(function (s) {
      var name = MM.secName(s.k), fs = fitFont(name, nodeW - 10, fsN), best = -1, mid = name.length / 2;
      if (fs >= 10.5 || !/\s/.test(name)) { LY[s.k] = { lines: [name], fs: fs, mh: MINH }; return; }
      name.replace(/\s/g, function (m, i) { if (best < 0 || Math.abs(i - mid) < Math.abs(best - mid)) best = i; return m; });
      var a = name.slice(0, best), b = name.slice(best + 1);
      LY[s.k] = { lines: [a, b], fs: Math.min(fitFont(a, nodeW - 10, fsN), fitFont(b, nodeW - 10, fsN)), mh: 38 };
    });
    var mhs = function (arr) { return arr.reduce(function (a, s) { return a + LY[s.k].mh; }, 0) + gap * Math.max(0, arr.length - 1); };
    var H = Math.max(nr ? 230 : 300, Math.max(mhs(outs), mhs(ins)) + 76), avail = H - top - 22;
    var sumL = outs.reduce(function (a, s) { return a - val(s); }, 0), sumR = ins.reduce(function (a, s) { return a + val(s); }, 0), tot = Math.max(sumL, sumR) || 1;
    /* one scale for both sides; small sectors get a readable node, their ribbon keeps its true width */
    var need = function (arr, k) { return arr.reduce(function (a, s) { return a + Math.max(LY[s.k].mh, Math.abs(val(s)) * k); }, 0) + gap * Math.max(0, arr.length - 1); };
    var k = (avail - gap * (n - 1)) / tot;
    for (var it = 0; it < 80 && (need(outs, k) > avail || need(ins, k) > avail); it++) k *= 0.93;
    var place = function (arr) {
      var y = top + (avail - need(arr, k)) / 2;
      return arr.map(function (s) { var tw = Math.max(1.2, Math.abs(val(s)) * k), o = { s: s, y: y, h: Math.max(LY[s.k].mh, tw), tw: tw }; y += o.h + gap; return o; });
    };
    var L = place(outs), R = place(ins);
    var twL = L.reduce(function (a, o) { return a + o.tw; }, 0), twR = R.reduce(function (a, o) { return a + o.tw; }, 0);
    var hubH = Math.max(twL, twR, 40), hubY = top + (avail - hubH) / 2;
    var up = MM.upc(), dn = MM.dnc();
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-river' + (nr ? ' nr' : '') + '" role="img" aria-label="' + esc(T('riverT')) + '"><defs>' +
      '<linearGradient id="rvo" x1="0" x2="1"><stop offset="0" stop-color="' + dn + '" stop-opacity=".75"/><stop offset="1" stop-color="#8a8a92" stop-opacity=".22"/></linearGradient>' +
      '<linearGradient id="rvi" x1="0" x2="1"><stop offset="0" stop-color="#8a8a92" stop-opacity=".22"/><stop offset="1" stop-color="' + up + '" stop-opacity=".75"/></linearGradient></defs>';
    var hy = hubY + (hubH - twL) / 2;
    L.forEach(function (o) { svg += ribbon(m + nodeW, o.y + (o.h - o.tw) / 2, cx - hubW / 2, hy, o.tw, 'url(#rvo)', 'out'); hy += o.tw; });
    hy = hubY + (hubH - twR) / 2;
    R.forEach(function (o) { svg += ribbon(cx + hubW / 2, hy, W - m - nodeW, o.y + (o.h - o.tw) / 2, o.tw, 'url(#rvi)', 'in'); hy += o.tw; });
    svg += '<rect x="' + (cx - hubW / 2) + '" y="' + hubY.toFixed(1) + '" width="' + hubW + '" height="' + hubH.toFixed(1) + '" rx="' + (nr ? 8 : 12) + '" fill="#17181d" stroke="rgba(247,147,26,.6)"/>' +
      MM.svgText(cx, (hubY - 9).toFixed(1), 'middle', 'mm-rvh', T('riverHub'));
    var lab = function (o, side) {
      var s = o.s, x = side === 'L' ? m : W - m - nodeW, col = MM.SECC[s.k], v = val(s), cy = o.y + o.h / 2, ly = LY[s.k];
      var nl = ly.lines.length, showV = o.h >= ly.mh + 16, lh = ly.fs + 3, y = cy - (nl * lh + (showV ? 15 : 0)) / 2 + ly.fs - 1, out = '';
      ly.lines.forEach(function (t) { out += MM.svgText(x + nodeW / 2, y.toFixed(1), 'middle', 'mm-rvt', t, { fs: ly.fs !== fsN ? ly.fs : 0 }); y += lh; });
      if (showV) out += '<text x="' + (x + nodeW / 2) + '" y="' + (y + 1).toFixed(1) + '" text-anchor="middle" class="mm-rvv ' + (v > 0 ? 'up' : 'dn') + '">' + esc(MM.fmtSigned(v)) + '</text>';
      return '<g class="mm-rvn" data-sec="' + s.k + '" tabindex="0" role="button"><rect x="' + x + '" y="' + o.y.toFixed(1) + '" width="' + nodeW + '" height="' + o.h.toFixed(1) + '" rx="5" fill="' + col + '" fill-opacity=".22" stroke="' + col + '" stroke-opacity=".7"/>' + out +
        '<title>' + esc(MM.secName(s.k) + ' · ' + MM.fmtSigned(v)) + '</title></g>';
    };
    var empty = function (side) {
      var x = side === 'L' ? m : W - m - nodeW, y = top + (avail - MINH) / 2;
      return '<g><rect x="' + x + '" y="' + y + '" width="' + nodeW + '" height="' + MINH + '" rx="5" fill="none" stroke="rgba(255,255,255,.25)" stroke-dasharray="4 4"/><text x="' + (x + nodeW / 2) + '" y="' + (y + MINH / 2 + 4.5) + '" text-anchor="middle" class="mm-rvt dim">0</text></g>';
    };
    L.forEach(function (o) { svg += lab(o, 'L'); }); R.forEach(function (o) { svg += lab(o, 'R'); });
    if (!L.length) svg += empty('L'); if (!R.length) svg += empty('R');
    svg += MM.svgText(m + nodeW / 2, 18, 'middle', 'mm-rvh dn', T('riverOut')) + MM.svgText(W - m - nodeW / 2, 18, 'middle', 'mm-rvh up', T('riverIn')) + '</svg>';
    if (!L.length) svg += '<p class="mm-p-note">' + esc(T('noOut')) + '</p>';
    if (!R.length) svg += '<p class="mm-p-note">' + esc(T('noIn')) + '</p>';
    return svg;
    function ribbon(x0, y0, x1, y1, w, fill, cls) {
      var mx = (x0 + x1) / 2, f = function (v) { return v.toFixed(1); };
      var p = 'M' + f(x0) + ',' + f(y0) + ' C' + f(mx) + ',' + f(y0) + ' ' + f(mx) + ',' + f(y1) + ' ' + f(x1) + ',' + f(y1) + ' L' + f(x1) + ',' + f(y1 + w) + ' C' + f(mx) + ',' + f(y1 + w) + ' ' + f(mx) + ',' + f(y0 + w) + ' ' + f(x0) + ',' + f(y0 + w) + ' Z';
      var c = 'M' + f(x0) + ',' + f(y0 + w / 2) + ' C' + f(mx) + ',' + f(y0 + w / 2) + ' ' + f(mx) + ',' + f(y1 + w / 2) + ' ' + f(x1) + ',' + f(y1 + w / 2);
      return '<path d="' + p + '" fill="' + fill + '"/>' + (w >= 2 ? '<path d="' + c + '" class="mm-rvp ' + cls + '" stroke-width="' + Math.max(1, Math.min(3, w / 6)).toFixed(1) + '"/>' : '');
    }
  }
  function secTable(secs, tf) {
    secs = secs.slice().sort(function (a, b) { return (b.has ? b.net : -Infinity) - (a.has ? a.net : -Infinity); });
    return '<div class="mm-tw"><table class="mm-ft mm-sort"><thead><tr><th>' + esc(T('sector')) + '</th><th>' + esc(T('netFlow')) + '</th><th>' + esc(T('buyShare')) + '</th><th>' + esc(T('mcChange')) + '</th><th>' + esc(T('chg', { tf: MM.TFLBL[tf] })) + '</th><th>' + esc(T('leader')) + '</th></tr></thead><tbody>' +
      secs.map(function (s) {
        return '<tr><td><i class="mm-sdot" style="background:' + MM.SECC[s.k] + '"></i>' + esc(MM.secName(s.k)) + ' <small>' + MM.loc(s.n) + '</small></td><td class="mm-n ' + MM.cls(s.net) + '">' + (s.has ? MM.fmtSigned(s.net) : '—') + '</td>' +
          '<td class="mm-n">' + (s.bs == null ? '—' : s.bs.toFixed(1) + '%') + '</td><td class="mm-n ' + MM.cls(s.dm) + '">' + MM.fmtSigned(s.dm) + '</td><td class="mm-n ' + MM.cls(s.pct) + '">' + MM.fmtPct(s.pct) + '</td>' +
          '<td>' + (s.top && s.top.v > 0 ? '<button type="button" class="mm-lnk" data-open="' + s.top.s + '">' + MM.logo(s.top.s, 16) + esc(s.top.s) + '</button>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ---------------------------------------------------------------- leaders */
  function leaders(list, tf) {
    var rows = list.map(function (c) { var f = F(c, tf); return f ? { c: c, net: f.net, qv: f.qv } : null; }).filter(Boolean);
    var top = rows.slice().sort(function (a, b) { return b.net - a.net; }).filter(function (r) { return r.net > 0; }).slice(0, 10);
    var bot = rows.slice().sort(function (a, b) { return a.net - b.net; }).filter(function (r) { return r.net < 0; }).slice(0, 10);
    var mx = Math.max(1, top.length ? top[0].net : 0, bot.length ? -bot[0].net : 0);
    var li = function (r) {
      var bs = r.qv ? (r.net + r.qv) / (2 * r.qv) * 100 : null, ch = r.c.ch[tf];
      return '<li><button type="button" data-open="' + r.c.s + '" data-tab="flow">' + MM.logo(r.c.s, 22) + '<b>' + esc(r.c.s) + '</b><span class="mm-lbar"><i style="width:' + (Math.abs(r.net) / mx * 100).toFixed(1) + '%;background:' + MM.sideColor(r.net) + '"></i></span>' +
        '<span class="mm-n ' + MM.cls(r.net) + '">' + MM.fmtSigned(r.net) + '</span><small class="mm-n">' + (bs == null ? '' : esc(T('bs_short', { p: bs.toFixed(0) }))) + '</small><small class="mm-n ' + MM.cls(ch) + '">' + MM.fmtPct(ch) + '</small></button></li>';
    };
    return '<div class="mm-two"><div><h4 class="up">' + esc(T('topIn')) + '</h4><ol class="mm-lead">' + (top.map(li).join('') || '<li class="mm-empty">' + esc(T('noData')) + '</li>') + '</ol></div>' +
      '<div><h4 class="dn">' + esc(T('topOut')) + '</h4><ol class="mm-lead">' + (bot.map(li).join('') || '<li class="mm-empty">' + esc(T('noData')) + '</li>') + '</ol></div></div>';
  }

  /* ---------------------------------------------------------------- flow vs price: four quadrants */
  function quad(list, tf, W) {
    var pts = list.slice(0, 80).map(function (c) { var f = F(c, tf), ch = c.ch[tf]; return f && f.qv > 0 && ch != null ? { c: c, x: ch, y: (f.net / f.qv) * 100 } : null; }).filter(Boolean);
    if (pts.length < 5) return '<p class="mm-p-note">' + esc(T('noData')) + '</p>';
    W = Math.max(280, Math.round(W || 1000));
    var nr = W < 640, H = nr ? Math.round(W * 1.02) : Math.min(600, Math.max(420, Math.round(W * 0.5))), P = nr ? 24 : 44, PT = 32, PB = 46, g = nr ? 0.62 : 1;
    /* the axes cover the bulk of the coins (90th percentile × 1.6); the few beyond sit on the edge */
    var lim = function (key) {
      var a = pts.map(function (p) { return Math.abs(p[key]); }).sort(function (x, y) { return x - y; });
      return Math.min(a[a.length - 1] * 1.08, a[Math.floor(0.9 * (a.length - 1))] * 1.6) || a[a.length - 1] * 1.08 || 1;
    };
    var ax = lim('x'), ay = lim('y'), off = 0;
    var X = function (v) { return P + (MM.clamp(v, -ax, ax) + ax) / (2 * ax) * (W - 2 * P); }, Y = function (v) { return H - PB - (MM.clamp(v, -ay, ay) + ay) / (2 * ay) * (H - PT - PB); };
    var up = MM.upc(), dn = MM.dnc(), x0 = X(0), y0 = Y(0), r2 = function (v) { return v.toFixed(1); };
    var tick = function (v, d) { return (v > 0 ? '+' : v < 0 ? '−' : '') + MM.loc(Math.abs(v).toFixed(d)) + '%'; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-quad' + (nr ? ' nr' : '') + '" role="img" aria-label="' + esc(T('quadT')) + '">' +
      '<rect x="' + P + '" y="' + PT + '" width="' + (W - 2 * P) + '" height="' + (H - PT - PB) + '" fill="none" stroke="rgba(255,255,255,.07)"/>' +
      '<rect x="' + r2(x0) + '" y="' + PT + '" width="' + r2(W - P - x0) + '" height="' + r2(y0 - PT) + '" fill="' + up + '" fill-opacity=".05"/>' +
      '<rect x="' + P + '" y="' + r2(y0) + '" width="' + r2(x0 - P) + '" height="' + r2(H - PB - y0) + '" fill="' + dn + '" fill-opacity=".05"/>' +
      '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + r2(y0) + '" y2="' + r2(y0) + '" stroke="rgba(255,255,255,.25)"/><line x1="' + r2(x0) + '" x2="' + r2(x0) + '" y1="' + PT + '" y2="' + (H - PB) + '" stroke="rgba(255,255,255,.25)"/>' +
      '<text x="' + (W - P - 4) + '" y="' + r2(y0 + 14) + '" text-anchor="end" class="mm-ax">' + tick(ax, ax < 10 ? 1 : 0) + '</text><text x="' + (P + 4) + '" y="' + r2(y0 + 14) + '" class="mm-ax">' + tick(-ax, ax < 10 ? 1 : 0) + '</text>' +
      '<text x="' + r2(x0 + 5) + '" y="' + (PT + 11) + '" class="mm-ax">' + tick(ay, 0) + '</text><text x="' + r2(x0 + 5) + '" y="' + (H - PB - 4) + '" class="mm-ax">' + tick(-ay, 0) + '</text>' +
      /* quadrant names sit outside the plot, so coins pinned to a corner never cover them */
      MM.svgText(W - P, PT - 9, 'end', 'mm-qt up', T('q_ur')) + MM.svgText(P, PT - 9, 'start', 'mm-qt', T('q_ul')) +
      MM.svgText(P, H - PB + 18, 'start', 'mm-qt dn', T('q_ll')) + MM.svgText(W - P, H - PB + 18, 'end', 'mm-qt', T('q_lr')) +
      MM.svgText(W / 2, H - 5, 'middle', 'mm-ax', T('q_x', { tf: MM.ltr(MM.TFLBL[tf]) })) +
      MM.svgText(11, H / 2, 'middle', 'mm-ax', T('q_y'), { attrs: ' transform="rotate(-90 11 ' + (H / 2) + ')"' });
    pts.forEach(function (p) {
      var r = MM.clamp((Math.sqrt(p.c.mc / 1e9) * 1.2 + 6) * g, 4.5, 26 * g), out = Math.abs(p.x) > ax || Math.abs(p.y) > ay;
      var cx = MM.clamp(X(p.x), P + r, W - P - r), cy = MM.clamp(Y(p.y), PT + r, H - PB - r);
      if (out) off++;
      s += '<g class="mm-qp' + (out ? ' out' : '') + '" data-open="' + p.c.s + '"><circle cx="' + r2(cx) + '" cy="' + r2(cy) + '" r="' + r2(r) + '" fill="' + MM.css(MM.rgb(p.x)) + '" fill-opacity=".85" stroke="' + (out ? '#fff' : 'rgba(255,255,255,.35)') + '"' + (out ? ' stroke-width="1.6" stroke-dasharray="3 2"' : '') + '/>' +
        (r > 11 ? '<text x="' + r2(cx) + '" y="' + r2(cy + 3.5) + '" text-anchor="middle" class="mm-qs">' + esc(p.c.s) + '</text>' : '') +
        '<title>' + esc(p.c.s + ' · ' + MM.fmtPct(p.x) + ' · ' + T('q_y') + ' ' + MM.fmtPct(p.y, 1)) + '</title></g>';
    });
    return s + '</svg>' + (off ? '<p class="mm-p-note">' + esc(T('q_off', { n: MM.loc(off) })) + '</p>' : '');
  }

  /* ---------------------------------------------------------------- stablecoins, dominance, leverage */
  function stables() {
    var stb = D.flow && D.flow.st; if (!stb) return '<p class="mm-p-note">' + esc(T('noData')) + '</p>';
    var rows = (stb.top || []).map(function (r) {
      return '<tr><td><b>' + esc(r.s) + '</b> <small>' + esc(r.n) + '</small></td><td class="mm-n">' + MM.fmtUsd(r.c) + '</td><td class="mm-n ' + MM.cls(r.d1) + '">' + MM.fmtSigned(r.d1) + '</td><td class="mm-n ' + MM.cls(r.d7) + '">' + MM.fmtSigned(r.d7) + '</td><td class="mm-n ' + MM.cls(r.d30) + '">' + MM.fmtSigned(r.d30) + '</td><td><small>' + esc((r.ch || []).join(' · ')) + '</small></td></tr>';
    }).join('');
    var hist = stb.hist || [], chart = '';
    if (hist.length > 10) {
      var W = 1000, H = 200, lo = Infinity, hi = -Infinity;
      hist.forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
      var X = function (i) { return (i / (hist.length - 1) * W).toFixed(1); }, Y = function (v) { return (H - 16 - (v - lo) / ((hi - lo) || 1) * (H - 30)).toFixed(1); };
      var pts = hist.map(function (p, i) { return X(i) + ',' + Y(p[1]); }).join(' ');
      chart = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-svg" preserveAspectRatio="none" role="img" aria-label="' + esc(T('stHist')) + '"><defs><linearGradient id="stg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2dd4bf" stop-opacity=".35"/><stop offset="1" stop-color="#2dd4bf" stop-opacity="0"/></linearGradient></defs>' +
        '<polygon points="0,' + H + ' ' + pts + ' ' + W + ',' + H + '" fill="url(#stg)"/><polyline points="' + pts + '" fill="none" stroke="#2dd4bf" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>' +
        '<div class="mm-axr"><span dir="auto">' + esc(MM.fmtDate(hist[0][0] * 1000)) + ' · <b class="mm-n">' + MM.fmtUsd(hist[0][1]) + '</b></span><span dir="auto">' + esc(MM.fmtDate(hist[hist.length - 1][0] * 1000)) + ' · <b class="mm-n">' + MM.fmtUsd(hist[hist.length - 1][1]) + '</b></span></div>';
    }
    return chart + '<div class="mm-tw"><table class="mm-ft"><thead><tr><th>' + esc(T('stable')) + '</th><th>' + esc(T('supplyNow')) + '</th><th>24h</th><th>7d</th><th>30d</th><th>' + esc(T('chains')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="mm-p-note">' + esc(T('stNote', { n: MM.loc(stb.n || 0) })) + '</p>';
  }
  function dominance() {
    var dom = st.dom; if (!dom || dom.length < 10) return '<p class="mm-p-note">' + esc(T('noData')) + '</p>';
    var W = 1000, H = 240, keys = ['btc', 'eth', 'stable', 'others'], cols = { btc: '#f7931a', eth: '#8b5cf6', stable: '#2dd4bf', others: '#a1a1aa' };
    var t0 = dom[0].t, t1 = dom[dom.length - 1].t, X = function (t) { return ((t - t0) / ((t1 - t0) || 1) * W).toFixed(1); };
    var base = dom.map(function () { return 0; }), s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-svg" preserveAspectRatio="none" role="img" aria-label="' + esc(T('domT')) + '">';
    keys.forEach(function (k) {
      var top = dom.map(function (p, i) { return base[i] + (p[k] || 0); });
      var a = dom.map(function (p, i) { return X(p.t) + ',' + (H - top[i] / 100 * H).toFixed(1); }), b = dom.map(function (p, i) { return X(p.t) + ',' + (H - base[i] / 100 * H).toFixed(1); }).reverse();
      s += '<polygon points="' + a.concat(b).join(' ') + '" fill="' + cols[k] + '" fill-opacity=".55"/>';
      base = top;
    });
    var last = dom[dom.length - 1];
    s += '</svg><div class="mm-lgd">' + keys.map(function (k) { return '<span><i style="background:' + cols[k] + '"></i>' + esc(T('dom_' + k)) + ' <b class="mm-n">' + (last[k] || 0).toFixed(1) + '%</b></span>'; }).join('') + '</div>';
    return s;
  }
  function leverage() {
    var x = st.dx; if (!x) return '<p class="mm-p-note">' + esc(T('noData')) + '</p>';
    var li = function (a) { return a.slice(0, 6).map(function (r) { var c = D.by[r.coin]; return '<li>' + (c ? MM.logo(r.coin, 18) : '') + '<b>' + esc(r.coin) + '</b><span class="mm-n ' + MM.cls(r.funding) + '">' + (r.funding > 0 ? '+' : '') + r.funding.toFixed(4) + '%</span><small class="mm-n">' + MM.fmtUsd(r.oi_usd) + '</small></li>'; }).join(''); };
    var hot = (x.funding_hot || []).filter(function (r) { return D.by[r.coin] && r.oi_usd > 2e6; }), cold = (x.funding_cold || []).filter(function (r) { return D.by[r.coin] && r.oi_usd > 2e6; });
    var hist = x.history || [], oiCh = null;
    if (hist.length > 2) { var a = hist[hist.length - 1], b0 = hist.filter(function (p) { return p.t <= a.t - 86400; }).pop() || hist[0]; oiCh = b0.oi ? (a.oi / b0.oi - 1) * 100 : null; }
    return '<div class="mm-kpis sm"><div class="mm-kpi"><small>' + esc(T('oiTot')) + '</small><b class="mm-n">' + MM.fmtUsd(x.total_oi_usd) + '</b><span class="mm-n ' + MM.cls(oiCh) + '">' + MM.fmtPct(oiCh) + ' 24h</span></div>' +
      '<div class="mm-kpi"><small>' + esc(T('fundAvg')) + '</small><b class="mm-n ' + MM.cls(x.avg_funding) + '">' + (x.avg_funding > 0 ? '+' : '') + (x.avg_funding || 0).toFixed(4) + '%</b><span>' + esc(T('per8h')) + '</span></div></div>' +
      '<div class="mm-two"><div><h4 class="up">' + esc(T('fundHotT')) + '</h4><ol class="mm-fund">' + li(hot) + '</ol></div><div><h4 class="dn">' + esc(T('fundColdT')) + '</h4><ol class="mm-fund">' + li(cold) + '</ol></div></div>' +
      '<p class="mm-p-note">' + esc(T('levNote')) + ' <a href="/derivatives/">' + esc(T('l_deriv')) + '</a></p>';
  }

  /* ---------------------------------------------------------------- page */
  function render() {
    if (!st) return;
    st.raf = 0;
    var tf = S.tf, list = universe();
    var secs = sectors(list, tf), metric = st.metric;
    var asOf = D.flow ? esc(T('flowAsOf', { t: MM.fmtDate(D.flow.t, true) })) : '';
    st.box.innerHTML =
      kpis(list, tf) +
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('riverT')) + '</h3><div class="mm-seg sm" role="group"><button type="button" data-metric="flow" class="' + (metric === 'flow' ? 'on' : '') + '">' + esc(T('m_flow')) + '</button><button type="button" data-metric="mc" class="' + (metric === 'mc' ? 'on' : '') + '">' + esc(T('m_mc')) + '</button></div>' +
      '<label class="mm-sel"><span>' + esc(T('coinsN')) + '</span><select data-n>' + [50, 100, 150, 200].map(function (n) { return '<option value="' + n + '"' + ((S.top.flow || 100) === n ? ' selected' : '') + '>' + MM.loc(n) + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="mm-sub">' + esc(T(metric === 'mc' ? 'riverMc' : 'riverFlow', { tf: T('tfn_' + tf) })) + '</p>' + MM.slot('river') + secTable(secs, tf) + '<p class="mm-p-note">' + asOf + '</p></section>' +
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('leadT', { tf: MM.TFLBL[tf] })) + '</h3></div>' + leaders(list, tf) + '</section>' +
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('quadT')) + '</h3></div><p class="mm-sub">' + esc(T('quadSub')) + '</p>' + MM.slot('quad') + '</section>' +
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('stT')) + '</h3></div><p class="mm-sub">' + esc(T('stSub')) + '</p>' + stables() + '</section>' +
      '<div class="mm-two cards"><section class="mm-card"><div class="mm-ch"><h3>' + esc(T('domT')) + '</h3></div><p class="mm-sub">' + esc(T('domSub')) + '</p>' + dominance() + '</section>' +
      '<section class="mm-card"><div class="mm-ch"><h3>' + esc(T('levT')) + '</h3></div>' + leverage() + '</section></div>' +
      '<section class="mm-card mm-howto"><h3>' + esc(T('howT')) + '</h3><ul>' + ['how1', 'how2', 'how3', 'how4', 'how5'].map(function (k) { return '<li>' + esc(T(k)) + '</li>'; }).join('') + '</ul></section>';
    MM.fill(st.box, 'river', function (w) { return river(secs, metric, w); });
    MM.fill(st.box, 'quad', function (w) { return quad(list, tf, w); });
  }
  function later() { if (st && !st.raf) st.raf = requestAnimationFrame(render); }
  V.mount = function (stage) {
    st = { metric: MM.store.get('ek_mm_rv', 'flow'), raf: 0 };
    st.box = h('<div class="mm-dash"><div class="mm-wait">' + esc(T('loading')) + '</div></div>');
    stage.appendChild(st.box);
    st.box.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open]'); if (o) { MM.openCoin(o.getAttribute('data-open'), o.getAttribute('data-tab') || 'flow'); return; }
      var m = e.target.closest('[data-metric]'); if (m) { st.metric = m.getAttribute('data-metric'); MM.store.set('ek_mm_rv', st.metric); render(); return; }
      var sn = e.target.closest('[data-sec]'); if (sn) { MM.pendingZoom = sn.getAttribute('data-sec'); MM.switchTo('heatmap'); }
    });
    st.box.addEventListener('change', function (e) { if (e.target.matches('[data-n]')) { S.top.flow = +e.target.value; MM.save(); render(); } });
    st.onData = MM.debounce(later, 400);
    MM.on('data', st.onData);
    st.unwatch = MM.watchWidth(st.box, later);
    st.box.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.mm-rvn')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    Promise.all([
      MM.loadFlow().catch(function () { return null; }),
      MM.getJSON('/data/flows.json', 15000).then(function (j) { st && (st.dom = j.dominance || []); }, function () { }),
      MM.getJSON('/data/derivatives.json', 15000).then(function (j) { st && (st.dx = j); }, function () { })
    ]).then(function () { render(); });
  };
  V.update = function () { later(); };
  V.unmount = function () { if (!st) return; MM.off('data', st.onData); if (st.unwatch) st.unwatch(); if (st.raf) cancelAnimationFrame(st.raf); st = null; };
})();
