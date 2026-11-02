/* entekhab.net — live prices. One Binance market-data WebSocket feeds every element marked
   data-live="BTC" (price) or data-livechg="BTC" (24h change). Falls back silently to the page's own numbers. */
(function () {
  const STABLE = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDE'];
  let ws = null, syms = '', retry = 0, timer = null;
  const fmt = v => '$' + v.toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 0 : v >= 1 ? 3 : v >= 0.01 ? 5 : 8 });
  const want = () => [...new Set([...document.querySelectorAll('[data-live],[data-livechg]')].map(e => String(e.dataset.live || e.dataset.livechg).toUpperCase()))]
    .filter(x => /^[A-Z0-9]{2,12}$/.test(x) && !STABLE.includes(x)).slice(0, 60);
  function onMsg(ev) {
    let d; try { d = JSON.parse(ev.data).data; } catch (e) { return; }
    if (!d || !d.s) return;
    const c = d.s.replace(/USDT$/, ''), p = +d.c, o = +d.o, ch = o ? (p / o - 1) * 100 : null;
    document.querySelectorAll(`[data-live="${c}"]`).forEach(e => {
      const old = +e.dataset.v || 0; e.dataset.v = p; e.textContent = fmt(p);
      if (old && old !== p) { e.classList.remove('lv-up', 'lv-dn'); void e.offsetWidth; e.classList.add(p > old ? 'lv-up' : 'lv-dn'); }
    });
    if (ch != null) document.querySelectorAll(`[data-livechg="${c}"]`).forEach(e => {
      e.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%';
      ['up', 'pos'].forEach(k => e.classList.toggle(k, ch >= 0)); ['down', 'neg'].forEach(k => e.classList.toggle(k, ch < 0));
    });
    document.documentElement.classList.add('live-on');
  }
  function connect() {
    const s = want(); if (!s.length || !('WebSocket' in window)) return;
    if (ws && s.join() === syms) return;
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { } }
    syms = s.join();
    try { ws = new WebSocket('wss://data-stream.binance.vision/stream?streams=' + s.map(x => x.toLowerCase() + 'usdt@miniTicker').join('/')); } catch (e) { return; }
    ws.onmessage = onMsg; ws.onopen = () => { retry = 0; };
    ws.onclose = () => { document.documentElement.classList.remove('live-on'); ws = null; syms = ''; if (!document.hidden && retry < 6) { clearTimeout(timer); timer = setTimeout(connect, 2500 * ++retry); } };
  }
  window.liveRefresh = connect;
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (ws) { try { ws.close(); } catch (e) { } } } else { retry = 0; connect(); } });
  if (document.readyState !== 'loading') connect(); else addEventListener('DOMContentLoaded', connect);
})();
