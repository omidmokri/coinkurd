/* entekhab.net — the Observatory: the arithmetic of /charts/liquidations/, /charts/cvd/, /charts/basis/ and
   /charts/stablecoins/. Pure functions, no page and no network: assets/obs/flow.js and prem.js use them in the
   browser, tests/test_obs_flow.js runs them in Node on figures small enough to work out by hand.

   Definitions
   -----------
   a Gate row         one period (5 minutes, 1 hour or 4 hours) of a USDT perpetual on Gate, as its public statistics
                      give it: dollars of long and of short positions liquidated, contracts bought and sold by takers,
                      the mark price and the open interest at the end of the period (halved: see gateRows).
   a missing period   Gate's statistics stop now and then, for every contract at once. Such a period has no taker
                      volume at all on BTC_USDT (which never stops trading) and the period before it is cut short.
                      Both are marked incomplete: their figures are what the source has and read lower than the truth.
                      A period the source has no row for at all is incomplete too.
   a bucket           periods summed into hours, 4 hours or UTC days. A bucket is made of hourly rows where all of its
                      hours exist; older buckets are made of Gate's 4-hour rows. Gate's own daily rows are not used:
                      whole days are empty in them.
   the last 24 hours  the 23 closed hours before the running one, and the running one — never more than 24 hours.
   taker delta        what takers bought minus what they sold in a candle. A Binance candle gives the takers' buys and
                      the whole volume, so the delta is 2 × buys − volume. A Gate row gives both sides.
   CVD                the running sum of taker deltas from the first candle on screen: it starts at zero there, so its
                      level depends on the range and only its direction and its turns carry meaning.
   basis              (futures price ÷ index price − 1) × 100. Per year: basis × 365 ÷ days to expiry — simple, not
                      compounded, and not worked out for an expiry nearer than two days (a gap of a few dollars would
                      read as a large yearly rate).
   Coinbase premium   (Coinbase's close in dollars ÷ Binance's close in Tether − 1) × 100, candle by candle
                      (CryptoQuant's definition). "Tether-adjusted": Binance's price is first turned into dollars
                      with Coinbase's own USDT-USD close, so what is left is not Tether's distance from a dollar.
   SSR                Bitcoin's market value ÷ the value of the dollar stablecoins in circulation.
   rank               the share (per cent) of the days up to a day whose value is at or below that day's. */
(function (root) {
  'use strict';
  var H = 3600000, DAY = 86400000, MIN_ANN_DAYS = 2;
  function num(x) { if (x == null || x === '') return null; var v = +x; return isFinite(v) ? v : null; }
  function byT(a, b) { return a.t - b.t; }
  function uniqT(rows) {                       /* oldest first; of two rows with one time the later one in the list stays */
    var seen = {}, out = [];
    rows.forEach(function (r) { if (seen[r.t] != null) out[seen[r.t]] = r; else { seen[r.t] = out.length; out.push(r); } });
    return out.sort(byT);
  }

  /* ================================================================ Gate */
  /* the API's rows → [{ t (ms), ll, sl (dollars liquidated: longs, shorts), buy, sell (coins takers bought and sold),
     px (mark price), oi (dollars) }], oldest first. `mult` = coins in one contract.
     Open interest: these statistics count the long and the short side of every contract (measured 2026-11-14 on four
     contracts: exactly twice the contract's own `position_size`), so the figure is halved to the usual one-sided one. */
  function gateRows(raw, mult) {
    var m = mult > 0 ? mult : 1, out = [];
    (Array.isArray(raw) ? raw : []).forEach(function (r) {
      if (!r) return;
      var t = num(r.time); if (!(t > 0)) return;
      var px = num(r.mark_price), oi = num(r.open_interest_usd);
      out.push({ t: t * 1000, ll: Math.max(0, num(r.long_liq_usd) || 0), sl: Math.max(0, num(r.short_liq_usd) || 0),
        buy: Math.max(0, num(r.long_taker_size) || 0) * m, sell: Math.max(0, num(r.short_taker_size) || 0) * m, px: px > 0 ? px : null, oi: oi > 0 ? oi / 2 : null });
    });
    return uniqT(out);
  }
  /* the periods the source has nothing for, read from the reference contract's rows, and the period before each: { time: 1 } */
  function gaps(ref, step, now) {
    var bad = {};
    (ref || []).forEach(function (r) {
      if (r.t + step > now) return;                    /* the period still running proves nothing */
      if (r.buy + r.sell > 0) return;
      bad[r.t] = 1; bad[r.t - step] = 1;
    });
    return bad;
  }
  /* rows of `fine` milliseconds summed into buckets of `step`, from `from` on (a multiple of step):
     [{ t, ll, sl, buy, sell, d (taker delta, coins), du (the same in dollars, each row at its own mark price), px, oi
        (the last of the bucket), n rows of `want`, bad (incomplete), live (still running) }] */
  function roll(rows, fine, step, bad, from, now) {
    var map = {}, out = [], want = Math.max(1, Math.round(step / fine));
    (rows || []).forEach(function (r) {
      if (r.t < from) return;
      var b = Math.floor(r.t / step) * step, o = map[b];
      if (!o) { o = map[b] = { t: b, ll: 0, sl: 0, buy: 0, sell: 0, d: 0, du: 0, px: null, oi: null, n: 0, want: want, bad: false, live: b + step > now }; out.push(o); }
      o.ll += r.ll; o.sl += r.sl; o.buy += r.buy; o.sell += r.sell; o.d += r.buy - r.sell;
      if (r.px) { o.du += (r.buy - r.sell) * r.px; o.px = r.px; }
      if (r.oi) o.oi = r.oi;
      o.n++; if (bad && bad[r.t]) o.bad = true;
    });
    out.sort(byT);
    out.forEach(function (o) { if (o.n < want && !o.live) o.bad = true; });
    return out;
  }
  /* the buckets of a liquidation chart: from the hourly rows where a bucket has all its hours, from the 4-hour rows
     before that. A first bucket that the history itself cuts short is left out instead of being shown as a low one. */
  function liqSeries(h1, h4, step, from, now, bad1, bad4) {
    var a = roll(h1, H, step, bad1, from, now), cut = Infinity, out = [], i;
    for (i = 0; i < a.length; i++) if (a[i].n === a[i].want || a[i].live) { cut = a[i].t; break; }
    if (h4 && h4.length && step >= 4 * H) {
      var started = false;
      roll(h4, 4 * H, step, bad4, from, now).forEach(function (x) {
        if (x.t >= cut) return;
        if (!started && x.n < x.want) return;
        started = true; x.src = '4h'; out.push(x);
      });
    }
    a.forEach(function (x) { if (x.t >= cut) { x.src = '1h'; out.push(x); } });
    return out;
  }
  function liqTotals(buckets) {
    var L = 0, S = 0, bad = 0, max = null;
    (buckets || []).forEach(function (x) { L += x.ll; S += x.sl; if (x.bad) bad++; if (!max || x.ll + x.sl > max.ll + max.sl) max = x; });
    return { long: L, short: S, total: L + S, longShare: L + S > 0 ? L / (L + S) * 100 : null, bad: bad, n: (buckets || []).length, max: max && max.ll + max.sl > 0 ? max : null };
  }
  /* `bad`: how many of the 23 closed hours are incomplete or have no row (the running hour may not have one yet) */
  function last24(h1, now, bad1) {
    var h0 = Math.floor(now / H) * H, from = h0 - 23 * H, L = 0, S = 0, n = 0, closed = 0, bad = 0;
    (h1 || []).forEach(function (r) { if (r.t < from || r.t > now) return; L += r.ll; S += r.sl; n++; if (r.t < h0) closed++; if (bad1 && bad1[r.t]) bad++; });
    return n ? { long: L, short: S, total: L + S, hours: n, bad: bad + Math.max(0, 23 - closed), from: from } : null;
  }

  /* ================================================================ OKX: the liquidation orders of the last 24 hours */
  /* Orders come newest first, 100 a page, and the next page is asked with `after` (orders older than that time).
     Orders that share a millisecond would be lost between two pages, so the walk asks with after = edge + 1 and skips
     the orders of that millisecond it has already taken. State: { edge: the oldest time seen, skip: how many orders
     of that time are taken, strict: ask with after = edge itself }. A full page that brings nothing new means one
     millisecond holds a page or more: the walk then steps past it (strict) and says so (lost).
     okxAfter(state, end) → the `after` to ask with · okxStep(page, state, floor) → the next state with the new rows,
     `more` (ask again) — only orders at or after `floor` are kept and the walk stops below it. */
  function okxAfter(st, end) { return !st || st.edge == null ? end : st.strict ? st.edge : st.edge + 1; }
  function okxStep(page, st, floor, full) {
    st = st || {};
    var edge = st.edge == null ? null : st.edge, strict = !!st.strict, k = strict ? 0 : (st.skip || 0);
    var oldest = edge, same = edge == null || strict ? 0 : (st.skip || 0), rows = [], fresh = 0, i, t;
    for (i = 0; i < page.length; i++) {
      t = page[i].t;
      if (edge != null && !strict && t === edge && k > 0) { k--; continue; }
      if (edge != null && (t > edge || (strict && t === edge))) continue;          /* cannot happen with these cursors; never counted twice */
      fresh++;
      if (t >= floor) rows.push(page[i]);
      if (oldest == null || t < oldest) { oldest = t; same = 1; } else if (t === oldest) same++;
    }
    var isFull = page.length >= (full || 100), stuck = isFull && fresh === 0 && !strict && edge != null;
    return { rows: rows, edge: oldest, skip: same, strict: stuck, lost: stuck, more: stuck || (isFull && fresh > 0 && oldest >= floor) };
  }
  /* totals and the largest orders: [{ t, px, usd, side: 'long' | 'short' }] */
  function orders(list, since, top) {
    var L = 0, S = 0, n = 0, rows = [];
    (list || []).forEach(function (o) { if (!o || !(o.usd > 0) || o.t < since) return; n++; if (o.side === 'long') L += o.usd; else S += o.usd; rows.push(o); });
    rows.sort(function (a, b) { return b.usd - a.usd || b.t - a.t; });
    return { long: L, short: S, total: L + S, n: n, top: rows.slice(0, top || 15) };
  }

  /* ================================================================ taker delta and CVD */
  /* Binance candles (spot or futures) → [{ t, o, h, l, c, v (coins), d (taker delta, coins), du (dollars) }].
     `mult`: a futures contract quoted per 1000 coins has mult 1000 (prices ÷ mult, sizes × mult). */
  function klineRows(raw, mult) {
    var m = mult > 0 ? mult : 1, out = [];
    (Array.isArray(raw) ? raw : []).forEach(function (k) {
      if (!k || k.length < 11) return;
      var t = num(k[0]), o = num(k[1]), h = num(k[2]), l = num(k[3]), c = num(k[4]), v = num(k[5]), q = num(k[7]), tb = num(k[9]), tq = num(k[10]);
      if (!(t > 0) || !(c > 0) || v == null || tb == null) return;
      out.push({ t: t, o: o / m, h: h / m, l: l / m, c: c / m, v: v * m, d: (2 * tb - v) * m, du: q != null && tq != null ? 2 * tq - q : null });
    });
    return uniqT(out);
  }
  /* the running sum of rows[key] from `from` on: { line: [[t + shift, sum], …], total, n } */
  function cvd(rows, key, from, shift) {
    var acc = 0, line = [], n = 0;
    (rows || []).forEach(function (r) { if (r.t < from) return; var v = r[key]; if (v == null || !isFinite(v)) return; acc += v; n++; line.push([r.t + (shift || 0), acc]); });
    return { line: line, total: n ? acc : null, n: n };
  }

  /* ================================================================ futures curve (Deribit) */
  var MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  /* 'BTC-27NOV26' → expiry at 08:00 UTC of that day · 'BTC-PERPETUAL' → the perpetual · anything else → null */
  function parseFuture(name) {
    var s = String(name == null ? '' : name), m = /^([A-Z]+)-PERPETUAL$/.exec(s);
    if (m) return { cur: m[1], perp: true };
    m = /^([A-Z]+)-(\d{1,2})([A-Z]{3})(\d{2})$/.exec(s);
    if (!m || MON[m[3]] == null) return null;
    var day = +m[2], ts = Date.UTC(2000 + +m[4], MON[m[3]], day, 8);
    if (!(day >= 1 && day <= 31) || new Date(ts).getUTCDate() !== day) return null;
    return { cur: m[1], code: m[2] + m[3] + m[4], ts: ts };
  }
  /* rows of get_book_summary_by_currency (kind=future) →
     { index, perp: { mark, basis, usd, oi, vol } | null, exps: [{ name, code, ts, days, mark, usd, basis, ann, oi, vol }] by expiry, oi (dated futures, dollars) } */
  function curve(rows, now) {
    var index = null, perp = null, exps = [], oi = 0;
    (Array.isArray(rows) ? rows : []).forEach(function (x) {
      var p = parseFuture(x && x.instrument_name); if (!p) return;
      var mark = num(x.mark_price), idx = num(x.estimated_delivery_price);
      if (!(mark > 0) || !(idx > 0)) return;
      if (index == null) index = idx;
      var o = { name: x.instrument_name, mark: mark, usd: mark - idx, basis: (mark / idx - 1) * 100, oi: num(x.open_interest), vol: num(x.volume_usd) };
      if (p.perp) { perp = o; return; }
      if (p.ts <= now) return;
      o.code = p.code; o.ts = p.ts; o.days = (p.ts - now) / DAY; o.ann = o.days >= MIN_ANN_DAYS ? o.basis * 365 / o.days : null;
      if (o.oi > 0) oi += o.oi;
      exps.push(o);
    });
    exps.sort(function (a, b) { return a.ts - b.ts; });
    return { index: index, perp: perp, exps: exps, oi: oi };
  }

  /* ================================================================ files written by CI (premium.json, stables.json) */
  /* a column { o: index of its first value, v: [...] } → a full list of n values, null where there is none */
  function col(c, n) {
    var out = new Array(n), i;
    for (i = 0; i < n; i++) out[i] = null;
    if (c && Array.isArray(c.v)) for (i = 0; i < c.v.length && c.o + i < n; i++) { var v = c.v[i]; out[c.o + i] = v == null || !isFinite(v) ? null : +v; }
    return out;
  }
  /* closes on one time grid → the premium and the Tether-adjusted premium, per cent; null where a close is missing */
  function premium(cb, bn, usdt) {
    var n = Math.min(cb.length, bn.length), raw = new Array(n), adj = new Array(n);
    for (var i = 0; i < n; i++) {
      var ok = cb[i] > 0 && bn[i] > 0;
      raw[i] = ok ? (cb[i] / bn[i] - 1) * 100 : null;
      adj[i] = ok && usdt && usdt[i] > 0 ? (cb[i] / (bn[i] * usdt[i]) - 1) * 100 : null;
    }
    return { raw: raw, adj: adj };
  }
  /* values on a grid → [[t, v], …] from index `from` on, skipping the missing ones */
  function pairs(t0, step, a, from) {
    var out = [];
    for (var i = Math.max(0, from || 0); i < a.length; i++) if (a[i] != null && isFinite(a[i])) out.push([t0 + i * step, a[i]]);
    return out;
  }
  /* a[i] − a[i − n], null where either is missing */
  function diff(a, n) {
    var out = new Array(a.length);
    for (var i = 0; i < a.length; i++) out[i] = i >= n && a[i] != null && a[i - n] != null ? a[i] - a[i - n] : null;
    return out;
  }
  function ratio(a, b, k) {
    var n = Math.min(a.length, b.length), out = new Array(n);
    for (var i = 0; i < n; i++) out[i] = a[i] != null && b[i] > 0 ? a[i] / b[i] * (k || 1) : null;
    return out;
  }
  function last(a) { var i = a ? a.length - 1 : -1; while (i >= 0 && (a[i] == null || !isFinite(a[i]))) i--; return i; }
  function rank(a, i) {
    if (i < 0 || a[i] == null) return null;
    var n = 0, le = 0;
    for (var k = 0; k <= i; k++) if (a[k] != null) { n++; if (a[k] <= a[i]) le++; }
    return n ? le / n * 100 : null;
  }
  /* mean of the last `n` values ending at i; null unless at least `need` of them are there */
  function meanLast(a, i, n, need) {
    var s = 0, c = 0;
    for (var k = Math.max(0, i - n + 1); k <= i; k++) if (a[k] != null) { s += a[k]; c++; }
    return c >= (need || n) ? s / c : null;
  }
  function dayMs(iso) { return Date.parse(iso + 'T00:00:00Z'); }

  var api = { H: H, DAY: DAY, MIN_ANN_DAYS: MIN_ANN_DAYS, gateRows: gateRows, gaps: gaps, roll: roll, liqSeries: liqSeries, liqTotals: liqTotals, last24: last24,
    okxAfter: okxAfter, okxStep: okxStep, orders: orders, klineRows: klineRows, cvd: cvd, parseFuture: parseFuture, curve: curve,
    col: col, premium: premium, pairs: pairs, diff: diff, ratio: ratio, last: last, rank: rank, meanLast: meanLast, dayMs: dayMs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OBFlow = api;
})(typeof window !== 'undefined' ? window : this);
