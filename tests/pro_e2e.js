/* End-to-end check of /market/ in headless Chrome with Binance mocked in its real formats.
   Usage: node tests/pro_e2e.js [outdir]     (serves the repo itself on a free port)
   Binance REST (klines, ticker/24hr, ticker/price) and the combined WebSocket stream are answered here with a
   deterministic synthetic market; OKX and fonts are blocked, so the fallbacks run too. Exits 1 on any JS error. */
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..'), OUT = process.argv[2] || '/tmp/pro_e2e';
fs.mkdirSync(OUT, { recursive: true });

/* ---------- a tiny static server for the repo */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end('nf'); return; }
      r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

/* ---------- synthetic market */
const IV = { '1s': 1, '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800, '12h': 43200, '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000 };
function h32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function base(sym) { return { BTCUSDT: 71000, ETHUSDT: 2000, SOLUSDT: 150, XAUTUSDT: 3900, BNBUSDT: 600, XRPUSDT: 2.4, DOGEUSDT: 0.21, PEPEUSDT: 0.0000121 }[sym] || (1 + h32(sym) % 300); }
function px(sym, t) { const b = base(sym), k = h32(sym) % 1000 / 1000; return b * (1 + 0.06 * Math.sin(t / 86400 / 9 * 6.283 + k * 6) + 0.015 * Math.sin(t / 3600 / 5 * 6.283 + k) + 0.004 * Math.sin(t / 97) + 0.0015 * Math.sin(t / 7.3)); }
function bar(sym, t, iv) {
  const o = px(sym, t), c = px(sym, t + iv), n = Math.max(2, Math.min(12, Math.round(iv / 60))), xs = [];
  for (let i = 1; i < n; i++) xs.push(px(sym, t + iv * i / n));
  const hi = Math.max(o, c, ...xs) * (1 + 0.0004 * (h32(sym + t) % 5)), lo = Math.min(o, c, ...xs) * (1 - 0.0004 * (h32(t + sym) % 5));
  const v = 10 + (h32(sym + ':' + t) % 1000) / 10;
  return [t * 1000, o.toFixed(8), hi.toFixed(8), lo.toFixed(8), c.toFixed(8), v.toFixed(5), (t + iv) * 1000 - 1, (v * o).toFixed(4), 100, (v / 2).toFixed(5), (v * o / 2).toFixed(4), '0'];
}
function klines(q) {
  const sym = q.get('symbol'), iv = IV[q.get('interval')], lim = Math.min(1000, +(q.get('limit') || 500)), now = Math.floor(Date.now() / 1000);
  if (!iv || !/^[A-Z0-9]+USDT$/.test(sym) || sym === 'NOPEUSDT') return null;
  const st = q.get('startTime') ? Math.ceil(+q.get('startTime') / 1000 / iv) * iv : null, en = q.get('endTime') ? Math.floor(+q.get('endTime') / 1000) : now;
  const last = Math.floor(Math.min(en, now) / iv) * iv, out = [];
  if (st != null) { for (let t = st; t <= last && out.length < lim; t += iv) out.push(bar(sym, t, iv)); }
  else { for (let t = last - (lim - 1) * iv; t <= last; t += iv) out.push(bar(sym, t, iv)); }
  return out;
}
function mini(sym) { const now = Math.floor(Date.now() / 1000), c = px(sym, now), o = px(sym, now - 86400); return { symbol: sym, openPrice: o.toFixed(8), highPrice: (Math.max(o, c) * 1.01).toFixed(8), lowPrice: (Math.min(o, c) * 0.99).toFixed(8), lastPrice: c.toFixed(8), volume: '1000', quoteVolume: (1e6 + h32(sym) % 9e8).toFixed(2), openTime: (now - 86400) * 1000, closeTime: now * 1000 }; }

const OVR = {};          /* test hook: the next miniTicker prices of a symbol */
async function mockNet(page, stats) {
  await page.route(/fonts\.(googleapis|gstatic)\.com|www\.okx\.com|t\.me\//, r => r.abort());
  await page.route(/data-api\.binance\.vision\/api\/v3\//, async r => {
    const u = new URL(r.request().url()), p = u.pathname.replace('/api/v3/', ''); stats.rest++;
    if (p === 'klines') { const k = klines(u.searchParams); if (!k) return r.fulfill({ status: 400, body: '{"code":-1121,"msg":"Invalid symbol."}' }); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(k) }); }
    if (p === 'ticker/24hr') { const syms = JSON.parse(u.searchParams.get('symbols') || '[]'); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(syms.map(mini)) }); }
    if (p === 'ticker/price') { const logos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/logos/index.json'), 'utf8')); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(logos.concat(['PAXG']).map(s => ({ symbol: s + 'USDT', price: '1.0' }))) }); }
    return r.fulfill({ status: 404, body: '{}' });
  });
  await page.routeWebSocket(/data-stream\.binance\.vision/, ws => {
    if (/\/stream$/.test(ws.url())) stats.ws++; else stats.other = (stats.other || 0) + 1; const subs = new Set();
    ws.onMessage(m => {
      let j; try { j = JSON.parse(m); } catch (e) { return; }
      if (j.method === 'SUBSCRIBE') j.params.forEach(s => subs.add(s)); if (j.method === 'UNSUBSCRIBE') j.params.forEach(s => subs.delete(s));
      ws.send(JSON.stringify({ result: null, id: j.id }));
    });
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      subs.forEach(s => {
        const [pair, kind] = s.split('@'), sym = pair.toUpperCase();
        if (kind === 'miniTicker') { const m = mini(sym); if (OVR[sym] && OVR[sym].length) m.lastPrice = String(OVR[sym].shift()); ws.send(JSON.stringify({ stream: s, data: { e: '24hrMiniTicker', E: Date.now(), s: sym, c: m.lastPrice, o: m.openPrice, h: m.highPrice, l: m.lowPrice, v: m.volume, q: m.quoteVolume } })); }
        else if (kind.startsWith('kline_')) {
          const iv = IV[kind.slice(6)], t = Math.floor(now / iv) * iv, b = bar(sym, t, iv), cnow = px(sym, now);
          ws.send(JSON.stringify({ stream: s, data: { e: 'kline', E: Date.now(), s: sym, k: { t: t * 1000, T: (t + iv) * 1000 - 1, s: sym, i: kind.slice(6), o: b[1], h: String(Math.max(+b[2], cnow)), l: String(Math.min(+b[3], cnow)), c: cnow.toFixed(8), v: b[5], x: false } } }));
          stats.msgs++;
        }
      });
    }, 500);
    ws.onClose(() => clearInterval(timer));
  });
}

(async () => {
  const srv = await serve(), port = srv.address().port, base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] });
  const errors = [], results = [];
  function ok(name, cond, extra) { results.push([cond ? 'PASS' : 'FAIL', name, extra || '']); console.log(cond ? 'PASS' : 'FAIL', name, extra ? '— ' + String(extra).slice(0, 300) : ''); if (!cond) process.exitCode = 1; }
  async function newPage(vw, vh, lang, clean = true) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'Asia/Tehran', serviceWorkers: 'block' });
    const page = await ctx.newPage(), stats = { rest: 0, ws: 0, msgs: 0 };
    page.on('pageerror', e => errors.push(`[${lang} ${vw}] pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(`[${lang} ${vw}] console: ${m.text()}`); });
    await mockNet(page, stats);
    if (clean) await page.addInitScript(() => { try { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1'); } } catch (e) { } });
    await page.goto(`${base}/market/?lang=${lang}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length && PRO.app.cells()[0].disp.length > 100, null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    return { page, ctx, stats };
  }
  const shot = (page, n) => page.screenshot({ path: path.join(OUT, n + '.png') });

  const ONLY = process.env.ONLY || '';
  /* ---------- desktop, Persian: the full tour */
  if (!ONLY) {
    const { page, ctx, stats } = await newPage(1280, 860, 'fa');
    await shot(page, '01_fa_1280');
    const s0 = await page.evaluate(() => { const c = PRO.app.cells()[0]; return { n: c.disp.length, st: c.feed.state, src: c.feed.src, last: c.disp[c.disp.length - 1].c, dir: document.documentElement.dir, lang: document.documentElement.lang }; });
    ok('chart loads 1h history from Binance', s0.n >= 500 && s0.src === 'binance', JSON.stringify(s0));
    ok('page is Persian RTL', s0.dir === 'rtl' && s0.lang === 'fa');
    await page.waitForFunction(() => PRO.app.cells()[0].feed.state === 'live', null, { timeout: 8000 }).catch(() => { });
    ok('live over the WebSocket', await page.evaluate(() => PRO.app.cells()[0].feed.state === 'live'), JSON.stringify(stats));
    /* seconds timeframe and a custom one */
    await page.click('[data-tf="5s"]'); await page.waitForFunction(() => PRO.app.cells()[0].cfg.tf === '5s' && PRO.app.cells()[0].disp.length > 100, null, { timeout: 10000 });
    const s5 = await page.evaluate(() => { const d = PRO.app.cells()[0].disp; return { n: d.length, step: d[d.length - 1].t - d[d.length - 2].t, al: d[d.length - 1].t % 5 }; });
    ok('5-second bars built from 1s klines', s5.step === 5 && s5.al === 0 && s5.n >= 500, JSON.stringify(s5));
    await page.waitForTimeout(1200); await shot(page, '02_fa_5s');
    await page.click('#pm-tfmore'); await page.fill('.pm-tfc input', '7m'); await page.press('.pm-tfc input', 'Enter');
    await page.waitForFunction(() => PRO.app.cells()[0].cfg.tf === '7m' && PRO.app.cells()[0].disp.length > 50, null, { timeout: 10000 });
    const s7 = await page.evaluate(() => { const d = PRO.app.cells()[0].disp; return d.slice(-3).map(b => (b.t % 86400) / 60); });
    ok('custom 7m timeframe aligned to the day', s7.every(m => m % 7 === 0 || m === 1435), JSON.stringify(s7));
    await page.click('[data-tf="1h"]'); await page.waitForTimeout(800);
    /* chart types */
    for (const t of ['hollow', 'heikin', 'bars', 'line', 'linemk', 'step', 'area', 'baseline', 'columns', 'candle']) { await page.evaluate(t => PRO.app.active().setType(t), t); }
    ok('all ten chart types render without error', errors.length === 0, errors.slice(-1)[0]);
    await page.evaluate(() => PRO.app.active().setType('heikin')); await page.waitForTimeout(300); await shot(page, '03_fa_heikin'); await page.evaluate(() => PRO.app.active().setType('candle'));
    /* indicators: overlay, panes, cloud */
    await page.click('#pm-ind'); await page.click('.pm-idi[data-id="bb"]'); await page.click('.pm-idi[data-id="ichi"]');
    await page.click('.pm-idt .pm-chip:nth-child(2)'); await page.click('.pm-idi[data-id="rsi"]'); await page.click('.pm-idi[data-id="macd"]');
    await page.click('.pm-idt .pm-chip:nth-child(3)'); await page.click('.pm-idi[data-id="posts"]');
    await page.keyboard.press('Escape'); await page.waitForTimeout(800);
    const ind = await page.evaluate(() => { const c = PRO.app.active(); return { panes: c.chart.panes().length, n: c.cfg.inds.length, ser: Object.keys(c.series).length }; });
    ok('indicators added (2 oscillator panes + overlays)', ind.panes === 3 && ind.n === 6, JSON.stringify(ind));
    await shot(page, '04_fa_indicators');
    /* drawing: a trend line with the mouse, a fib, a long position */
    const box = await page.locator('.pm-cell .pm-chart').first().boundingBox();
    await page.click('[data-tool="trend"]'); await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.45); await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.25);
    /* drag the trend line's body and undo it */
    const before = await page.evaluate(() => JSON.stringify((PRO.app.DRAW().BTC || [])[0].pts));
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.35); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5, { steps: 5 }); await page.mouse.up();
    const after = await page.evaluate(() => JSON.stringify((PRO.app.DRAW().BTC || [])[0].pts));
    await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
    const undone = await page.evaluate(() => JSON.stringify((PRO.app.DRAW().BTC || [])[0].pts));
    ok('dragging a drawing moves it in time and price; Ctrl+Z restores it', before !== after && undone === before, before + ' → ' + after + ' → ' + undone);
    await page.click('[data-tool="fib"]'); await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.2); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5, { steps: 6 }); await page.mouse.up();
    await page.click('[data-tool="long"]'); await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.4);
    await page.click('[data-tool="pitch"]'); for (const [x, y] of [[0.18, 0.42], [0.26, 0.22], [0.33, 0.38]]) await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    await page.waitForTimeout(600);
    const dr = await page.evaluate(() => { const L = JSON.parse(localStorage.getItem('ek_pro_draw') || '{}').BTC || []; return L.map(x => x.k + ':' + x.pts.length); });
    ok('four drawings made and saved', dr.length === 4 && dr.includes('trend:2') && dr.includes('fib:2') && dr.includes('long:3') && dr.includes('pitch:3'), JSON.stringify(dr));
    await shot(page, '05_fa_drawings');
    /* drawings follow the coin to another timeframe at the same time/price */
    await page.click('[data-tf="4h"]'); await page.waitForFunction(() => PRO.app.cells()[0].cfg.tf === '4h' && PRO.app.cells()[0].disp.length > 100, null, { timeout: 8000 });
    ok('drawings kept on 4h', await page.evaluate(() => (PRO.app.DRAW().BTC || []).length === 4));
    await page.click('[data-tf="1h"]'); await page.waitForTimeout(600);
    /* alerts: price alert crossing the live price fires */
    await page.click('#pm-alert'); const last = await page.evaluate(() => { const b = PRO.app.active().bars; return b[b.length - 1].c; });
    await page.selectOption('.pm-af [name=c]', 'cross'); await page.fill('.pm-af [name=v]', String((last * 1.00001).toFixed(2)));
    await page.click('.pm-af button[type=submit]'); await page.waitForTimeout(400);
    const al = await page.evaluate(() => JSON.parse(localStorage.getItem('ek_pro_alerts') || '[]').map(a => a.k + ':' + a.c + ':' + a.on));
    ok('price alert created', al.length === 1 && al[0] === 'price:cross:true', JSON.stringify(al));
    await page.click('.pm-stab[data-p="alerts"]'); await page.waitForTimeout(500); await shot(page, '06_fa_alerts');
    const lv = await page.evaluate(() => JSON.parse(localStorage.getItem('ek_pro_alerts'))[0].v);
    OVR.BTCUSDT = [lv * 0.998, lv * 0.999, lv * 1.002, lv * 0.997, lv * 1.003];      /* crosses up, down, up: a once-alert fires once */
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ek_pro_alert_log') || '[]').length > 0, null, { timeout: 15000 }).catch(() => { });
    await page.waitForTimeout(2500);
    const lg = await page.evaluate(() => ({ log: JSON.parse(localStorage.getItem('ek_pro_alert_log') || '[]').length, on: JSON.parse(localStorage.getItem('ek_pro_alerts'))[0].on }));
    ok('the price alert fired when the live price crossed, once', lg.log === 1 && lg.on === false, JSON.stringify(lg));
    /* ✈: the alert goes to the bot as t.me/<bot>?start=a_<COIN>_<PRICE> — a plain decimal the bot reads back exactly */
    const tg = await page.evaluate(() => { let u = null; const o = window.open; window.open = x => { u = x; return null; }; const b = document.querySelector('.pm-ar [data-a="tg"]'); if (b) b.click(); window.open = o; return { u, lv: JSON.parse(localStorage.getItem('ek_pro_alerts'))[0].v, tiny: PRO._plainNum(6e-7), big: PRO._plainNum(72155.5) }; });
    const tm = /^https:\/\/t\.me\/Kurd_kurdistan_bot\?start=a_BTC_(\d{1,12}(?:d\d{1,18})?)$/.exec(tg.u || '');
    ok('✈ hands the alert to the bot with the exact price', !!tm && Math.abs(+tm[1].replace('d', '.') - tg.lv) <= tg.lv * 1e-9 && tg.tiny === '0.0000006' && tg.big === '72155.5', JSON.stringify(tg));
    /* indicator alert maths on known data */
    const ev = await page.evaluate(() => { const mk = cs => cs.map((c, i) => ({ t: i * 3600, o: c, h: c, l: c, c: c, v: 1 }));
      const up = mk([...Array(40).keys()].map(i => 100 - i).concat([60, 70, 90, 120])), a = { k: 'ind', ind: { id: 'rsi', len: 14 }, c: 'up', v: 30 };
      const ma = { k: 'ind', ind: { id: 'ma', len: 10, ma: 'sma' }, c: 'up' };
      return { rsi: [41, 42, 43].map(n => PRO.alertEval(a, up.slice(0, n))).join(','), ma: [41, 42, 43].map(n => PRO.alertEval(ma, up.slice(0, n))).join(',') }; });
    ok('indicator alerts fire on the bar that crosses — not before, not after', ev.rsi === 'false,true,false' && ev.ma === 'false,true,false', JSON.stringify(ev));
    /* economic calendar (falls back to events.json until the full calendar exists) */
    await page.click('.pm-stab[data-p="cal"]'); await page.waitForTimeout(1200); await shot(page, '07_fa_calendar');
    ok('calendar panel lists events', await page.evaluate(() => document.querySelectorAll('.pm-cr').length > 0 || /\S/.test((document.querySelector('.pm-cl') || {}).textContent || '')));
    /* replay: pick, step, play, trade, exit */
    await page.click('#pm-rep'); await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5); await page.waitForTimeout(300);
    const r0 = await page.evaluate(() => { const c = PRO.app.active(); return { on: !!c.replay, i: c.replay && c.replay.i, n: c.disp.length, all: c.bars.length }; });
    ok('replay cuts the chart at the clicked bar', r0.on && r0.n === r0.i + 1 && r0.n < r0.all, JSON.stringify(r0));
    await page.click('.pm-repbar [data-a="buy"]'); for (let k = 0; k < 5; k++) await page.click('.pm-repbar [data-a="fwd"]');
    await page.click('.pm-repbar [data-a="close"]');
    const r1 = await page.evaluate(() => { const c = PRO.app.active(); return { i: c.replay.i, trades: c.replay.trades.length, pct: c.replay.trades[0] && c.replay.trades[0].pct, e: c.replay.trades[0] && c.replay.trades[0].entry, x: c.replay.trades[0] && c.replay.trades[0].exit }; });
    ok('replay steps 5 bars; the practice trade P&L is exit/entry − 1', r1.i === r0.i + 5 && r1.trades === 1 && Math.abs(r1.pct - (r1.x / r1.e - 1) * 100) < 1e-9, JSON.stringify(r1));
    await page.click('.pm-repbar [data-a="spd"]'); await page.click('.pm-menu .pm-mi:nth-child(9)'); await page.click('.pm-repbar [data-a="play"]'); await page.waitForTimeout(700);
    const r2 = await page.evaluate(() => PRO.app.active().replay.i); ok('replay plays at 50×', r2 > r1.i + 10, r1.i + ' → ' + r2);
    await page.click('.pm-repbar [data-a="play"]'); await shot(page, '08_fa_replay');
    await page.click('.pm-repbar [data-a="x"]'); await page.waitForTimeout(300);
    ok('replay exits back to live', await page.evaluate(() => !PRO.app.active().replay && PRO.app.active().disp.length === PRO.app.active().feed.bars.length));
    /* multi-chart: 4, sync symbol, then 16 */
    await page.click('#pm-lay'); await page.click('.pm-layb[data-l="4"]'); await page.waitForFunction(() => PRO.app.cells().length === 4 && PRO.app.cells().every(c => c.disp.length > 50), null, { timeout: 15000 });
    const syms = await page.evaluate(() => PRO.app.cells().map(c => c.cfg.sym));
    ok('4 charts, different coins', new Set(syms).size === 4, syms.join(','));
    await page.waitForTimeout(1200); await shot(page, '09_fa_multi4');
    await page.click('#pm-lay'); await page.click('.pm-layb[data-l="16"]'); await page.waitForFunction(() => PRO.app.cells().length === 16 && PRO.app.cells().every(c => c.disp.length > 10), null, { timeout: 25000 });
    await page.waitForTimeout(1500); await shot(page, '10_fa_multi16');
    ok('16 charts at once over one socket', stats.ws === 1, JSON.stringify(stats));
    await page.click('#pm-lay'); await page.click('.pm-layb[data-l="1"]'); await page.waitForTimeout(800);
    /* watchlist add + flag */
    await page.click('.pm-stab[data-p="watch"]'); await page.waitForTimeout(600);
    await page.click('.pm-wr[data-s="ETH"] .pm-wf'); await page.click('.pm-menu .pm-mi:nth-child(4)');
    ok('colour flag saved', await page.evaluate(() => JSON.parse(localStorage.getItem('ek_pro_watch')).flags.ETH === 'g'));
    await page.waitForTimeout(1200); await shot(page, '11_fa_watch');
    /* CSV export */
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('#pm-ws'); await page.click('.pm-menu .pm-mi:has-text("CSV")'); })()]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').split('\n');
    ok('CSV has a header and every bar with indicator columns', /^time_utc,unix,open,high,low,close,volume,/.test(csv[0]) && csv.length > 500 && /rsi/.test(csv[0]), csv[0].slice(0, 120));
    /* autosave: reload restores everything */
    const keep = await page.evaluate(() => JSON.stringify({ inds: PRO.app.active().cfg.inds.map(x => x.id), tf: PRO.app.active().cfg.tf }));
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length && PRO.app.cells()[0].disp.length > 100, null, { timeout: 20000 });
    const back = await page.evaluate(() => JSON.stringify({ inds: PRO.app.active().cfg.inds.map(x => x.id), tf: PRO.app.active().cfg.tf }));
    ok('reload restores layout, indicators and drawings', keep === back && await page.evaluate(() => (PRO.app.DRAW().BTC || []).length === 4), keep + ' vs ' + back);
    /* share link round trip */
    await page.click('#pm-ws'); await page.click('.pm-menu .pm-mi:has-text("لینک")'); await page.waitForSelector('.pm-modal input');
    const link = await page.inputValue('.pm-modal input'); ok('share link made', /\/market\/#s=z[A-Za-z0-9_-]+$/.test(link), link.length + ' chars');
    fs.writeFileSync(path.join(OUT, 'share_link.txt'), link);
    await ctx.close();
    /* open the link in a fresh browser */
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const p2 = await c2.newPage(); await mockNet(p2, { rest: 0, ws: 0, msgs: 0 });
    p2.on('pageerror', e => errors.push('[share] ' + e.message));
    await p2.goto(link.replace('https://entekhab.net', base).replace(/^http:\/\/127\.0\.0\.1:\d+/, base).replace('/market/#', '/market/?lang=en#'));
    await p2.waitForSelector('.pm-modal .pm-btn.pri', { timeout: 15000 }); await p2.click('.pm-modal .pm-btn.pri'); await p2.waitForTimeout(800);
    ok('shared layout opens with its drawings', await p2.evaluate(() => (PRO.app.DRAW().BTC || []).length === 4 && PRO.app.active().cfg.inds.length === 6));
    await c2.close();
  }

  /* ---------- the four languages at desktop and phone widths */
  if (!ONLY) for (const [lang, w, h] of [['en', 1280, 860], ['ckb', 1280, 860], ['ar', 1280, 860], ['fa', 390, 844], ['en', 390, 844], ['ckb', 390, 844], ['ar', 390, 844]]) {
    const { page, ctx } = await newPage(w, h, lang);
    await page.click('.pm-stab[data-p="cal"], #pm-sidebtn').catch(() => { });
    if (w < 900) { await page.click('#pm-sidebtn').catch(() => { }); }
    await page.waitForTimeout(1200);
    await shot(page, `20_${lang}_${w}`);
    const info = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, keys: [...document.querySelectorAll('#pro *')].map(e => e.childNodes.length === 1 && e.firstChild.nodeType === 3 ? e.textContent : '').filter(t => /^[a-z]+_[a-zA-Z_]+$|^[a-z][a-zA-Z]+[A-Z][a-zA-Z]*$/.test(t)).slice(0, 5), over: document.documentElement.scrollWidth > innerWidth + 1 }));
    ok(`[${lang} ${w}] no raw keys, right direction, no sideways scroll`, info.keys.length === 0 && info.dir === (lang === 'en' ? 'ltr' : 'rtl') && !info.over, JSON.stringify(info));
    if (w < 900) { await page.keyboard.press('Escape'); await page.click('.pm-sclose').catch(() => { }); await page.click('#pm-pen'); await page.waitForTimeout(300); await shot(page, `21_${lang}_${w}_tools`); }
    await ctx.close();
  }

  /* ---------- phones, as first opened: every control that matters is on screen and not under anything */
  if (!ONLY || ONLY === 'phones') for (const lang of ['fa', 'en', 'ckb', 'ar']) {
    const { page, ctx } = await newPage(390, 844, lang);
    const vis = await page.evaluate(() => ['#pm-sym', '.pm-tf.on', '#pm-type', '#pm-ind', '#pm-rep', '#pm-alert', '#pm-sidebtn', '#pm-pen', '#pm-go'].map(sel => {
      const e = document.querySelector(sel); if (!e) return sel + ':missing';
      const r = e.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && top && (top === e || e.contains(top)) ? '' : sel + ' ' + Math.round(r.left) + '..' + Math.round(r.right) + ' under ' + (top ? (top.id || String(top.className)) : '-');
    }).filter(Boolean));
    ok(`[${lang} 390] symbol, timeframe, type, indicators, replay, alert, panels, drawing and go-to-date all on screen, uncovered`, vis.length === 0, JSON.stringify(vis));
    /* tapping the only timeframe shown opens the full list; picking 5s switches the chart */
    await page.click('#pm-tfs .pm-tf.on'); await page.waitForTimeout(300);
    const menuIn = await page.evaluate(() => { const m = document.querySelector('.pm-tfmenu'); if (!m) return false; const r = m.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.height > 100; });
    await page.click('.pm-tfmenu .pm-tf >> text=5s').catch(() => { });
    await page.waitForFunction(() => PRO.app.active().cfg.tf === '5s', null, { timeout: 8000 }).catch(() => { });
    const tfNow = await page.evaluate(() => PRO.app.active().cfg.tf);
    ok(`[${lang} 390] tapping the timeframe opens the list on screen; 5s applies`, menuIn && tfNow === '5s', JSON.stringify({ menuIn, tfNow }));
    await page.click('#pm-sidebtn'); await page.waitForTimeout(500);
    const side = await page.evaluate(() => {
      const s = document.querySelector('.pm-side'), x = document.querySelector('.pm-sclose'), r = x && x.getBoundingClientRect(), top = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const tabs = [...document.querySelectorAll('.pm-stab')].map(b => b.getBoundingClientRect()).every(q => q.left >= 0 && q.right <= innerWidth && q.height <= 40);
      return { open: !!s && getComputedStyle(s).display !== 'none' && s.getBoundingClientRect().height > 200, close: !!r && r.left >= 0 && r.right <= innerWidth && !!top && (top === x || x.contains(top)), tabs };
    });
    ok(`[${lang} 390] the panels button opens the side sheet; its tabs fit on one line and its close button is on screen`, side.open && side.close && side.tabs, JSON.stringify(side));
    await shot(page, `22_${lang}_390_fresh`); await ctx.close();
  }

  /* ---------- a background tab stops streaming (metered connections), and picks up where it left when seen again */
  if (!ONLY || ONLY === 'hide') {
    const { page, ctx, stats } = await newPage(1280, 860, 'en');
    const setHidden = h => page.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, h);
    const ws0 = stats.ws;
    await setHidden(true); await page.evaluate(() => PRO._wsPause());           /* the one-minute timer, without the wait */
    await page.waitForTimeout(600); const m0 = stats.msgs; await page.waitForTimeout(3000);
    const hidden = { up: await page.evaluate(() => PRO.wsState()), msgs: stats.msgs - m0 };
    await setHidden(false);
    await page.waitForFunction(() => PRO.wsState(), null, { timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(2500);
    const back = await page.evaluate(() => ({ up: PRO.wsState(), st: PRO.app.cells().map(c => c.feed && c.feed.state).join() }));
    ok('a hidden tab closes its socket (no data), and reopens it live when seen again', hidden.up === false && hidden.msgs === 0 && back.up === true && stats.ws === ws0 + 1 && /^live/.test(back.st), JSON.stringify({ hidden, back, sockets: stats.ws - ws0 }));
    await ctx.close();
  }

  /* ---------- a slow connection: panels.js and replay.js arrive late; the panels, calendar flags and alert checks still start */
  if (!ONLY || ONLY === 'slow') {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-US', timezoneId: 'Asia/Tehran', serviceWorkers: 'block' });
    const page = await ctx.newPage(), stats = { rest: 0, ws: 0, msgs: 0 };
    page.on('pageerror', e => errors.push('[slow] ' + e.message));
    await mockNet(page, stats);
    await page.route(/\/assets\/pro\/(panels|replay)\.js/, async r => { await new Promise(z => setTimeout(z, 1800)); await r.continue(); });
    await page.goto(`${base}/market/?lang=fa`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length && PRO.app.cells()[0].disp.length > 100, null, { timeout: 20000 }).catch(() => { });
    await page.waitForTimeout(2500);
    const sl = await page.evaluate(() => ({ side: PRO.app.st().side, rows: document.querySelectorAll('.pm-spanel .pm-wr').length, pin: document.querySelectorAll('.pm-spanel .pm-pin').length,
      cal: !!(PRO.calEvents && PRO.calEvents().length), replay: typeof PRO.replayToggle }));
    ok('on a slow connection (side scripts late) the watchlist, the calendar and replay still start', sl.side === 'watch' && sl.rows >= 5 && sl.pin === 1 && sl.cal && sl.replay === 'function', JSON.stringify(sl));
    await ctx.close();
  }

  /* ---------- opening the page stars nothing across the site; «My watchlist» shows the default coins until edited */
  if (!ONLY || ONLY === 'watch') {
    const { page, ctx } = await newPage(1280, 860, 'fa');
    const w = await page.evaluate(() => ({ stored: localStorage.getItem('ek_watch'), rows: [...document.querySelectorAll('.pm-wr[data-s]')].map(e => e.getAttribute('data-s')).join(),
      dur: PRO.durText ? PRO.durText(19 * 3600 + 22 * 60) : null }));
    ok('the default «My watchlist» is shown without writing site-wide stars; countdown in words', w.stored === null && w.rows === 'BTC,ETH,SOL,BNB,XRP,DOGE,XAUT' && w.dur === '19 ساعت و 22 دقیقه', JSON.stringify(w));
    await ctx.close();
  }

  /* ---------- the site rule: a coin is never shown without its own logo, even from old storage, a file or a link */
  if (!ONLY || ONLY === 'logo') {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-US', timezoneId: 'Asia/Tehran', serviceWorkers: 'block' });
    const page = await ctx.newPage(), stats = { rest: 0, ws: 0, msgs: 0 };
    page.on('pageerror', e => errors.push('[logo] ' + e.message));
    await mockNet(page, stats);
    await page.addInitScript(() => { try { if (!sessionStorage.getItem('kept')) {
      localStorage.clear(); sessionStorage.setItem('kept', '1');
      localStorage.setItem('ek_pro', JSON.stringify({ layout: '2h', active: 0, side: 'watch', charts: [{ sym: 'NOPE', tf: '1h', type: 'candle', inds: [] }, { sym: 'ETH', tf: '1h', type: 'candle', inds: [] }] }));
      localStorage.setItem('ek_pro_draw', JSON.stringify({ NOPE: [{ id: 'a1', k: 'hline', pts: [{ t: 1700000000, p: 1 }], s: {} }], ETH: [{ id: 'a2', k: 'hline', pts: [{ t: 1700000000, p: 2000 }], s: {} }] }));
      localStorage.setItem('ek_pro_alerts', JSON.stringify([{ id: 'x1', sym: 'NOPE', k: 'price', c: 'cross', v: 1, mode: 'once', on: true, at: 1 }, { id: 'x2', sym: 'BTC', k: 'price', c: 'cross', v: 99999, mode: 'once', on: true, at: 1 }]));
      localStorage.setItem('ek_watch', JSON.stringify(['BTC', 'NOPE', 'ETH']));
    } } catch (e) { } });
    await page.goto(`${base}/market/?lang=en`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length === 2 && PRO.app.cells()[0].cfg.sym === 'BTC' && PRO.app.cells()[0].disp.length > 100, null, { timeout: 20000 }).catch(() => { });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('#pro img')].filter(i => /\/data\/logos\//.test(i.src));
      return { syms: PRO.app.cells().map(c => c.cfg.sym).join(), draw: Object.keys(PRO.app.DRAW()).join(), alerts: JSON.parse(localStorage.getItem('ek_pro_alerts')).map(a => a.sym).join(),
        rows: [...document.querySelectorAll('.pm-wr[data-s]')].map(e => e.getAttribute('data-s')).join(), stored: localStorage.getItem('ek_watch'),
        toast: (document.querySelector('.pm-toast') || {}).textContent || '', imgs: imgs.length, broken: imgs.filter(i => i.complete && !i.naturalWidth).map(i => i.src.split('/').pop()) };
    });
    ok('a stored chart on a coin without a logo moves to BTC and says so; its drawings and alerts are not kept; the list skips it', r.syms === 'BTC,ETH' && r.draw === 'ETH' && r.alerts === 'BTC' && /BTC/.test(r.rows) && /ETH/.test(r.rows) && !/NOPE/.test(r.rows) && /BTC/.test(r.toast), JSON.stringify(r));
    ok('every coin logo in the workspace loads (none missing)', r.imgs > 3 && r.broken.length === 0, JSON.stringify({ imgs: r.imgs, broken: r.broken }));
    ok('the site-wide star list itself is left as it was (only hidden here)', /NOPE/.test(r.stored || ''), r.stored);
    await ctx.close();
  }

  /* ---------- Arabic as deployed: CI adds ar.js and its head snippet to every page (scripts/i18n_ar.py → inject).
     The header folds its language buttons in Arabic; the site menu's language row clicks them the same way as here. */
  if (!ONLY || ONLY === 'ar') {
    const tmp = path.join(require('os').tmpdir(), 'market_ar_' + process.pid + '.html');
    fs.copyFileSync(path.join(ROOT, 'market/index.html'), tmp);
    require('child_process').execFileSync('python3', ['-c', 'import sys; sys.path.insert(0, "scripts"); import i18n_ar; i18n_ar.inject(sys.argv[1])', tmp], { cwd: ROOT });
    const html = fs.readFileSync(tmp, 'utf8'); fs.unlinkSync(tmp);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-US', timezoneId: 'Asia/Tehran', serviceWorkers: 'block' });
    const page = await ctx.newPage(), stats = { rest: 0, ws: 0, msgs: 0 };
    page.on('pageerror', e => errors.push('[ar-deployed] ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push('[ar-deployed] console: ' + m.text()); });
    await mockNet(page, stats);
    await page.route(u => new URL(u).pathname === '/market/', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
    await page.addInitScript(() => { try { if (!sessionStorage.getItem('kept')) { localStorage.clear(); localStorage.setItem('ek_ar', '1'); localStorage.setItem('ck_lang', 'en'); sessionStorage.setItem('kept', '1'); } } catch (e) { } });
    const ready = () => page.waitForFunction(() => getComputedStyle(document.body).opacity === '1' && window.PRO && PRO.app && PRO.app.cells().length && PRO.app.cells()[0].disp.length > 100, null, { timeout: 15000 }).catch(() => { });
    const t0 = Date.now();
    await page.goto(`${base}/market/`, { waitUntil: 'domcontentloaded' }); await ready();
    const ms = Date.now() - t0;
    const st = await page.evaluate(() => ({ lang: PRO.app.LANG(), dir: document.documentElement.dir, pro: document.getElementById('pro').getAttribute('dir'), op: getComputedStyle(document.body).opacity,
      ar: !!document.querySelector('script[src^="/assets/ar.js"]'), about: [...document.querySelectorAll('section.pm-about[data-lang]')].filter(e => !e.hidden).map(e => e.getAttribute('data-lang')).join(),
      btn: [...document.querySelectorAll('#langs button[data-l]')].map(b => b.getAttribute('data-l') + (b.classList.contains('on') ? '*' : '')).join(' '), leg: (document.querySelector('.pm-leg') || {}).textContent || '' }));
    ok('Arabic as deployed (ar.js + its head snippet): shown in Arabic within the wait, chart kept left-to-right, switch order ckb fa ar en', st.lang === 'ar' && st.dir === 'rtl' && st.pro === 'ltr' && st.op === '1' && st.ar && st.about === 'ar' && /^ckb fa ar\* en$/.test(st.btn) && ms < 9000, JSON.stringify(st).slice(0, 260) + ' ' + ms + 'ms');
    await shot(page, '40_ar_deployed');
    await Promise.all([page.waitForNavigation({ timeout: 10000 }).catch(() => { }), page.evaluate(() => document.querySelector('#langs button[data-l="en"]').click())]); await ready();
    const en = await page.evaluate(() => ({ lang: PRO.app.LANG(), dir: document.documentElement.dir, ek_ar: localStorage.getItem('ek_ar'), ck: localStorage.getItem('ck_lang'), about: [...document.querySelectorAll('section.pm-about[data-lang]')].filter(e => !e.hidden).map(e => e.getAttribute('data-lang')).join() }));
    ok('from Arabic, the header’s English turns the market to English', en.lang === 'en' && en.dir === 'ltr' && !en.ek_ar && en.ck === 'en' && en.about === 'en', JSON.stringify(en));
    await Promise.all([page.waitForNavigation({ timeout: 10000 }).catch(() => { }), page.evaluate(() => document.querySelector('#langs button[data-l="ar"]').click())]); await ready();
    const ar2 = await page.evaluate(() => ({ lang: PRO.app.LANG(), dir: document.documentElement.dir, ek_ar: localStorage.getItem('ek_ar'), about: [...document.querySelectorAll('section.pm-about[data-lang]')].filter(e => !e.hidden).map(e => e.getAttribute('data-lang')).join() }));
    ok('…and العربية turns it back to Arabic', ar2.lang === 'ar' && ar2.dir === 'rtl' && ar2.ek_ar === '1' && ar2.about === 'ar', JSON.stringify(ar2));
    await Promise.all([page.waitForNavigation({ timeout: 10000 }).catch(() => { }), page.evaluate(() => document.querySelector('#langs button[data-l="ckb"]').click())]); await ready();
    const ck = await page.evaluate(() => ({ lang: PRO.app.LANG(), dir: document.documentElement.dir, ek_ar: localStorage.getItem('ek_ar') }));
    ok('…and کوردی from Arabic gives Kurdish', ck.lang === 'ckb' && ck.dir === 'rtl' && !ck.ek_ar, JSON.stringify(ck));
    await ctx.close();
  }

  /* ---------- Binance unreachable: OKX blocked too, BTC falls back to the site snapshot */
  if (!ONLY) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, serviceWorkers: 'block' }); const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('[offline] ' + e.message));
    await page.route(/fonts\.|okx\.com|binance\.vision/, r => r.abort());
    await page.routeWebSocket(/binance\.vision/, ws => { ws.close(); });
    await page.goto(`${base}/market/?lang=en`); await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length && (PRO.app.cells()[0].feed || {}).state && ['snap', 'error'].includes(PRO.app.cells()[0].feed.state), null, { timeout: 30000 });
    const st = await page.evaluate(() => ({ s: PRO.app.cells()[0].feed.state, n: PRO.app.cells()[0].disp.length }));
    ok('without Binance and OKX, BTC 1h comes from the site snapshot and says so', st.s === 'snap' && st.n > 10, JSON.stringify(st));
    await page.waitForTimeout(400); await shot(page, '30_offline_snapshot'); await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(results.filter(r => r[0] === 'PASS').length + ' passed, ' + results.filter(r => r[0] === 'FAIL').length + ' failed');
  console.log(errors.length ? 'JS ERRORS:\n' + errors.join('\n') : 'no JS errors');
  if (errors.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);              /* data.js keeps timers alive; leave when done */
})().catch(e => { console.error(e); process.exit(1); });
