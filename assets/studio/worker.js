/* Entekhab Pine Studio — script runner (Web Worker).
   Runs Pine Script v5/v6 (or PineTS syntax) with PineTS by LuxAlgo, off the page's main thread so the chart stays smooth.
   This file and the rest of /assets/studio/ are free software under the GNU AGPL v3 (see /assets/studio/PINETS-LICENSE.txt);
   source: https://github.com/omidmokri/coinkurd/tree/main/assets/studio
   A worker keeps its own security policy, so PineTS may compile scripts here; the page itself never evaluates code. */
importScripts('/assets/studio/pinets.min.js?v=0.13.1');

const COL = c => (typeof c === 'string' && c) ? c : null;

function packPlots(ctx, n, times) {
  const out = [], ind = ctx.indicator || (ctx.strategy && ctx.strategy.config) || {};
  const ov = ind.overlay === true;
  const drawings = { labels: [], lines: [], boxes: [], tables: [] };
  for (const key of Object.keys(ctx.plots || {})) {
    const P = ctx.plots[key], o = P.options || {}, D = P.data || [];
    const style = o.style || 'line';
    if (key === '__labels__' || key === '__lines__' || key === '__boxes__' || key === '__tables__') {
      const last = D.length ? D[D.length - 1].value : [];
      const arr = (Array.isArray(last) ? last : []).filter(x => x && !x._deleted).slice(-500);
      drawings[key.slice(2, -2)] = arr.map(x => { const y = {}; for (const k in x) if (typeof x[k] !== 'object' || x[k] === null) y[k] = x[k]; return y; });
      continue;
    }
    if (key.startsWith('__')) continue;
    const vals = new Array(n).fill(null), cols = new Array(n).fill(null);
    // the plot holds one entry per bar, in bar order
    const off = n - D.length;
    for (let i = 0; i < D.length; i++) {
      const d = D[i], j = i + off; if (j < 0) continue;
      let v = d.value;
      if (style === 'shape' || style === 'char' || style === 'arrow') v = v === true || (typeof v === 'number' && !isNaN(v) && v !== 0) ? (typeof v === 'number' ? v : 1) : null;
      else if (style === 'background' || style === 'barcolor') v = v ? 1 : null;
      else if (typeof v !== 'number' || !isFinite(v)) v = null;
      vals[j] = v;
      cols[j] = COL(d.options && d.options.color);
    }
    out.push({
      key, title: P.title || key, style,
      overlay: o.overlay === true || ov || !!o.force_overlay,
      force_overlay: !!o.force_overlay,
      color: COL(o.color), linewidth: o.linewidth || 1, location: o.location || null, shape: o.shape || o.char || null,
      text: o.text || '', vals, cols, display: o.display
    });
  }
  return { plots: out, drawings };
}

function packStrategy(st, n, bars) {
  if (!st || !st.closedtrades) return null;
  const T = (st.closedtrades || []).map(t => ({
    id: t.entry_id, eb: t.entry_bar_index, ep: t.entry_price, xb: t.exit_bar_index, xp: t.exit_price,
    size: t.size, profit: t.profit, comm: t.commission || 0, dd: t.max_drawdown, ru: t.max_runup, xid: t.exit_id || ''
  }));
  const O = (st.opentrades || []).map(t => ({ id: t.entry_id, eb: t.entry_bar_index, ep: t.entry_price, size: t.size, profit: t.profit || 0 }));
  if (!T.length && !O.length && !st.netprofit) return { empty: true, cap: st.initial_capital };
  // equity per bar: starting capital + closed profit, plus the open trade marked to the close
  const cap = st.initial_capital || 100000, eq = new Array(n).fill(cap);
  const add = new Array(n + 1).fill(0);
  for (const t of T) if (t.xb >= 0 && t.xb < n) add[t.xb] += t.profit;
  let run = cap;
  for (let i = 0; i < n; i++) { run += add[i]; let open = 0; for (const o of O) if (i >= o.eb) open += (bars[i].close - o.ep) * o.size; eq[i] = run + open; }
  const S = {};
  for (const k of ['initial_capital', 'netprofit', 'grossprofit', 'grossloss', 'openprofit', 'max_drawdown', 'max_runup', 'max_drawdown_percent_value',
    'sharpe_ratio', 'sortino_ratio', 'cagr', 'buy_and_hold_pnl', 'buy_and_hold_per_gain', 'wintrades', 'losstrades', 'eventrades', 'position_size']) S[k] = typeof st[k] === 'number' ? st[k] : null;
  return { trades: T, open: O, stats: S, equity: eq };
}

self.onmessage = async ev => {
  const m = ev.data || {};
  if (m.type !== 'run') return;
  const t0 = Date.now();
  try {
    const bars = m.bars, n = bars.length;
    const data = bars.map(b => ({ openTime: b.t, closeTime: b.t + m.tfMs - 1, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
    const pt = new PineTS(data, m.symbol || 'BTCUSDT', m.tf || '60');
    const ctx = await pt.run(m.src);
    const P = packPlots(ctx, n);
    const res = {
      type: 'done', id: m.id, ms: Date.now() - t0,
      indicator: (() => { const I = ctx.indicator || (ctx.strategy && ctx.strategy.config) || {}; return { title: I.title || '', overlay: !!I.overlay, strategy: !ctx.indicator && !!ctx.strategy }; })(),
      plots: P.plots, drawings: P.drawings,
      strategy: packStrategy(ctx.strategy, n, bars),
      alerts: (ctx.alerts || []).slice(-50).map(a => ({ msg: String(a.message || a.msg || a.title || ''), bar: a.bar_index ?? a.bar ?? null })),
      warnings: (ctx.warnings || []).slice(0, 20).map(String)
    };
    self.postMessage(res);
  } catch (e) {
    const msg = String(e && e.message || e);
    const line = (/line[:\s]+(\d+)/i.exec(msg) || / at (\d+):\d+/.exec(msg) || [])[1] || null;
    self.postMessage({ type: 'error', id: m.id, msg, line: line ? +line : null, ms: Date.now() - t0 });
  }
};
