/* Entekhab Pine Studio — Smart Money Concepts layer (AGPL v3, part of /assets/studio/).
   Written for this site after the ideas of the open-source smartmoneyconcepts project (joshyattridge/smart-money-concepts):
   swing highs and lows, break of structure (BOS) and change of character (CHoCH), order blocks, fair value gaps, liquidity
   pools with their sweeps, previous day/week highs and lows, and premium/discount zones. Plain functions over arrays of
   bars {t,o,h,l,c,v}; nothing here looks ahead of the bar it marks except a swing point, which is confirmed `len` bars later
   (the `at` field says when). */
(function (G) {
  'use strict';

  function swings(B, len) {
    const n = B.length, out = [];
    for (let i = len; i < n - len; i++) {
      let hi = true, lo = true;
      for (let k = 1; k <= len && (hi || lo); k++) {
        if (B[i - k].h >= B[i].h || B[i + k].h > B[i].h) hi = false;
        if (B[i - k].l <= B[i].l || B[i + k].l < B[i].l) lo = false;
      }
      if (hi) out.push({ i, type: 1, p: B[i].h, at: i + len });
      if (lo) out.push({ i, type: -1, p: B[i].l, at: i + len });
    }
    // keep an alternating sequence: of two highs (or lows) in a row, keep the more extreme
    const s = [];
    for (const p of out) {
      const last = s[s.length - 1];
      if (last && last.type === p.type) { if ((p.type === 1 && p.p > last.p) || (p.type === -1 && p.p < last.p)) s[s.length - 1] = p; }
      else s.push(p);
    }
    return s;
  }

  // BOS / CHoCH: a close beyond the last confirmed swing high (low). Same direction as the trend → BOS, against it → CHoCH.
  function structure(B, S, closeBreak) {
    const ev = [];
    let trend = 0, lastH = null, lastL = null, si = 0;
    for (let i = 0; i < B.length; i++) {
      while (si < S.length && S[si].at <= i) { if (S[si].type === 1) lastH = S[si]; else lastL = S[si]; si++; }
      const up = closeBreak ? B[i].c : B[i].h, dn = closeBreak ? B[i].c : B[i].l;
      if (lastH && up > lastH.p && !lastH.broken) {
        lastH.broken = true;
        ev.push({ kind: trend === -1 ? 'CHoCH' : 'BOS', dir: 1, from: lastH.i, i, p: lastH.p });
        trend = 1;
      }
      if (lastL && dn < lastL.p && !lastL.broken) {
        lastL.broken = true;
        ev.push({ kind: trend === 1 ? 'CHoCH' : 'BOS', dir: -1, from: lastL.i, i, p: lastL.p });
        trend = -1;
      }
    }
    return { events: ev, trend };
  }

  // Order block: the last opposite-coloured candle before the move that broke structure; mitigated when price trades back through it.
  function orderBlocks(B, events, keep) {
    const obs = [];
    for (const e of events) {
      let k = -1;
      for (let j = e.i - 1; j >= Math.max(0, e.from - 1); j--) {
        const bear = B[j].c < B[j].o, bull = B[j].c > B[j].o;
        if ((e.dir === 1 && bear) || (e.dir === -1 && bull)) { k = j; break; }
      }
      if (k < 0) continue;
      const ob = { dir: e.dir, i: k, top: B[k].h, bot: B[k].l, end: null, kind: e.kind, vol: B[k].v };
      for (let j = e.i + 1; j < B.length; j++) {
        if ((e.dir === 1 && B[j].l < ob.bot) || (e.dir === -1 && B[j].h > ob.top)) { ob.end = j; break; }
      }
      obs.push(ob);
    }
    const live = obs.filter(o => o.end == null).slice(-keep), dead = obs.filter(o => o.end != null).slice(-keep);
    return live.concat(dead);
  }

  // Fair value gap: three candles where the first and third do not overlap. Filled when price closes the gap.
  function fvg(B, minPct, keep) {
    const out = [];
    for (let i = 2; i < B.length; i++) {
      const a = B[i - 2], c = B[i];
      if (c.l > a.h && (c.l - a.h) / a.h * 100 >= minPct) out.push({ dir: 1, i: i - 1, top: c.l, bot: a.h, end: null });
      else if (c.h < a.l && (a.l - c.h) / a.l * 100 >= minPct) out.push({ dir: -1, i: i - 1, top: a.l, bot: c.h, end: null });
    }
    for (const g of out) for (let j = g.i + 2; j < B.length; j++) {
      if ((g.dir === 1 && B[j].l <= g.bot) || (g.dir === -1 && B[j].h >= g.top)) { g.end = j; break; }
    }
    const open = out.filter(g => g.end == null).slice(-keep), done = out.filter(g => g.end != null).slice(-Math.ceil(keep / 2));
    return open.concat(done);
  }

  // Liquidity: two or more swing highs (lows) within rangePct of each other — equal highs/lows where stops rest. Swept when price trades through.
  function liquidity(B, S, rangePct) {
    const out = [], used = new Set();
    for (let a = 0; a < S.length; a++) {
      if (used.has(a)) continue;
      const grp = [S[a]];
      for (let b = a + 1; b < S.length; b++) {
        if (S[b].type !== S[a].type || used.has(b)) continue;
        if (Math.abs(S[b].p - S[a].p) / S[a].p * 100 <= rangePct) { grp.push(S[b]); used.add(b); }
      }
      if (grp.length < 2) continue;
      const lvl = grp.reduce((s, x) => s + x.p, 0) / grp.length, last = grp[grp.length - 1];
      const L = { dir: S[a].type, p: lvl, i: grp[0].i, j: last.i, n: grp.length, swept: null };
      for (let k = last.at; k < B.length; k++) {
        if ((L.dir === 1 && B[k].h > Math.max(...grp.map(x => x.p))) || (L.dir === -1 && B[k].l < Math.min(...grp.map(x => x.p)))) { L.swept = k; break; }
      }
      out.push(L);
    }
    return out.slice(-12);
  }

  // Previous day / week high and low (on intraday charts).
  function previous(B, periodMs) {
    const out = [];
    let cur = null, prev = null;
    for (let i = 0; i < B.length; i++) {
      const k = Math.floor(B[i].t / periodMs);
      if (!cur || cur.k !== k) { if (cur) prev = cur; cur = { k, h: B[i].h, l: B[i].l, i }; }
      else { cur.h = Math.max(cur.h, B[i].h); cur.l = Math.min(cur.l, B[i].l); }
    }
    if (prev) out.push({ h: prev.h, l: prev.l, from: prev.i, to: B.length - 1 });
    return out;
  }

  // Premium / discount: the range between the last swing high and low, split at equilibrium (50%).
  function zones(S) {
    const H = [...S].reverse().find(s => s.type === 1), L = [...S].reverse().find(s => s.type === -1);
    if (!H || !L) return null;
    const top = H.p, bot = L.p, eq = (top + bot) / 2;
    return { top, bot, eq, from: Math.min(H.i, L.i) };
  }

  function run(B, o) {
    o = Object.assign({ len: 5, closeBreak: true, fvgPct: 0.05, liqPct: 0.15, keep: 8 }, o || {});
    const S = swings(B, o.len), st = structure(B, S.map(s => Object.assign({}, s)), o.closeBreak);
    const tf = B.length > 1 ? B[1].t - B[0].t : 3600e3;
    return {
      swings: S, events: st.events, trend: st.trend,
      obs: orderBlocks(B, st.events, o.keep), fvgs: fvg(B, o.fvgPct, o.keep), liq: liquidity(B, S, o.liqPct),
      pd: tf < 864e5 ? previous(B, 864e5) : [], pw: tf < 6048e5 ? previous(B, 6048e5) : [], zone: zones(S)
    };
  }

  G.SMC = { run, swings, structure, orderBlocks, fvg, liquidity, previous, zones };
})(typeof self !== 'undefined' ? self : this);
