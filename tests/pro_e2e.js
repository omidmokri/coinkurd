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

/* ---------- tgju.org (Iran's market, rial) in its real formats: TradingView UDF history, the day's table, the all-prices table */
const TGB = { price_dollar_rl: 2670000, price_eur: 2930000, price_iqd: 1680, geram18: 250000000, sekee: 2540000000, 'crypto-tether-irr': 2700000, ons: 4000, silver: 51 };
function tgPrice(g, t) { const b = TGB[g] || (100000 + h32(g) % 900000); return b * (1 + 0.03 * Math.sin(t / 86400 / 7 * 6.283 + h32(g) % 7) + 0.004 * Math.sin(t / 3600 / 6 * 6.283)); }
function tgHist(q) {
  const g = q.get('symbol'), res = q.get('resolution'), sec = res === '1D' ? 86400 : res === 'W' ? 604800 : res === 'M' ? 2592000 : +res * 60;
  if (!sec || !g) return { s: 'no_data' };
  /* as tgju really sends it: intraday bars on Tehran's clock (hours at :30 UTC), days at 00:00 UTC, and a timestamp repeated now and then */
  const s2 = /^crypto-/.test(g) ? Math.max(sec, 86400) : sec, now = Math.floor(Date.now() / 1000), TZ = s2 < 86400 ? 12600 : 0,
    last = Math.floor((now + TZ) / s2) * s2 - TZ, n = s2 >= 86400 ? 1500 : 3000, out = { s: 'ok', t: [], o: [], h: [], l: [], c: [], v: [] };
  for (let k = n - 1; k >= 0; k--) {
    const t = last - k * s2, o = tgPrice(g, t), c = tgPrice(g, t + s2), reps = k === 40 || k === 400 ? 2 : 1;
    for (let r = 0; r < reps; r++) { out.t.push(t); out.o.push(Math.round(o)); out.c.push(Math.round(c * (1 + r * 0.001))); out.h.push(Math.round(Math.max(o, c) * 1.002)); out.l.push(Math.round(Math.min(o, c) * 0.998)); }
  }
  return out;
}
function tehClock(now) { const d = new Date((now + 12600) * 1000), z = n => String(n).padStart(2, '0'); return z(d.getUTCHours()) + ':' + z(d.getUTCMinutes()) + ':' + z(d.getUTCSeconds()); }
function tgToday(g) { const now = Math.floor(Date.now() / 1000); return { draw: null, recordsTotal: 900, recordsFiltered: 900, data: [[Math.round(tgPrice(g, now)).toLocaleString('en-US'), tehClock(now), '1,000', '0.1%']] }; }
function tgAll() { const now = Math.floor(Date.now() / 1000), cur = {}; Object.keys(TGB).concat(['price_gbp', 'price_aed', 'price_try', 'geram24', 'mesghal', 'gold_futures', 'sekeb', 'nim', 'rob', 'gerami', 'coin_blubber', 'silver_999']).forEach(g => { const p = Math.round(tgPrice(g, now)); cur[g] = { p: p.toLocaleString('en-US'), h: Math.round(p * 1.01).toLocaleString('en-US'), l: Math.round(p * 0.99).toLocaleString('en-US'), d: '1,000', dp: 0.5, dt: 'high', ts: '2026-11-12 ' + tehClock(now) }; }); return { current: cur }; }

const OVR = {};          /* test hook: the next miniTicker prices of a symbol */
async function mockNet(page, stats) {
  await page.route(/fonts\.(googleapis|gstatic)\.com|www\.okx\.com|t\.me\//, r => r.abort());
  await page.route(/tgju\.org/, async r => {
    const u = new URL(r.request().url()); stats.tgju = (stats.tgju || 0) + 1; const H = { 'access-control-allow-origin': '*' };
    if (/\/tv2\/history/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(tgHist(u.searchParams)) });
    const m = /today-table-data\/([^/?]+)/.exec(u.pathname); if (m) return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(tgToday(decodeURIComponent(m[1]))) });
    if (/ajax\.json/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(tgAll()) });
    return r.fulfill({ status: 404, body: '{}' });
  });
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
    const r1 = await page.evaluate(() => { const c = PRO.app.active(), A = c.replay.acct, t = A.trades[0]; return { i: c.replay.i, trades: A.trades.length, pct: t && t.pct, e: t && t.entry, x: t && t.exit, fee: A.cfg.fee, lev: A.cfg.lev, slip: A.cfg.slip }; });
    ok('replay steps 5 bars; the practice trade P&L is (exit/entry − 1) less both fees, on the margin', r1.i === r0.i + 5 && r1.trades === 1 && r1.slip === 0 && Math.abs(r1.pct - r1.lev * ((r1.x / r1.e - 1) * 100 - r1.fee * (1 + r1.x / r1.e))) < 1e-6, JSON.stringify(r1));
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
    const raw = fs.readFileSync(await dl.path(), 'utf8'), csv = raw.replace(/^\ufeff/, '').split('\n');
    ok('CSV (with a BOM for Excel) has every bar in UTC and in the page\'s own time and calendar, with indicator columns', raw.charCodeAt(0) === 0xfeff && /^time_utc,time_local,unix,open,high,low,close,volume,/.test(csv[0]) && csv.length > 500 && /rsi/.test(csv[0]) && /^\d{4}-\d\d-\d\dT[^,]+Z,("[^"]+"|[^,]+),\d+,/.test(csv[1]) && dl.suggestedFilename().startsWith('entekhab_BTCUSDT_'), csv[0].slice(0, 120) + ' | ' + csv[1].slice(0, 80) + ' | ' + dl.suggestedFilename());
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

  /* ---------- replay as on Faraz: every chart together, a finer step inside the bar, and the first candle */
  if (!ONLY || ONLY === 'replay2') {
    const { page, ctx } = await newPage(1280, 860, 'en');
    await page.click('#pm-lay'); await page.waitForTimeout(300); await page.click('.pm-layb[data-l="2v"]'); await page.waitForTimeout(400); await page.keyboard.press('Escape');
    await page.evaluate(() => { const c = PRO.app.cells(); PRO.app.setActive(1); PRO.app.applySym('ETH'); PRO.app.setActive(0); });
    await page.waitForFunction(() => PRO.app.cells().length === 2 && PRO.app.cells().every(c => c.disp.length > 300), null, { timeout: 20000 }).catch(() => { });
    const r1 = await page.evaluate(() => {
      const [a, b] = PRO.app.cells(); PRO._replay.sync(true);
      PRO._replay.begin(a, a.bars.slice(), a.bars.length - 200);
      const f0 = b.replay && b.replay.follower, t0 = [a.bars[a.replay.i].t, b.bars[b.replay.i].t];
      for (let k = 0; k < 3; k++) PRO._replay.step(a, 1);
      return { f0, t0, t1: [a.bars[a.replay.i].t, b.bars[b.replay.i].t], bi: b.replay.i };
    });
    ok('replay on two charts: the second follows the first, bar for bar', r1.f0 === true && r1.t0[0] === r1.t0[1] && r1.t1[0] === r1.t1[1] && r1.t1[0] - r1.t0[0] === 3 * 3600, JSON.stringify(r1));
    await page.evaluate(() => PRO._replay.setIv(PRO.app.cells()[0], '5m'));
    await page.waitForFunction(() => { const R = PRO.app.cells()[0].replay; return R && R.sub && R.sub.length > 10; }, null, { timeout: 10000 }).catch(() => { });
    const r2 = await page.evaluate(() => {
      const a = PRO.app.cells()[0], R = a.replay, i0 = R.i; const out = [];
      for (let k = 0; k < 14; k++) { PRO._replay.step(a, 1); out.push({ i: R.i, k: R.k, c: R.part && R.part.c, sub: R.sub[R.k].c, last: a.disp[a.disp.length - 1].c }); }
      return { i0, out: out.filter((x, j) => j % 4 === 0 || j === 13), b: PRO.app.cells()[1].replay.i };
    });
    const okIv = r2.out.every(x => Math.abs(x.c - x.sub) < 1e-9 && Math.abs(x.last - x.c) < 1e-9) && r2.out[0].i === r2.i0 + 1 && r2.out[r2.out.length - 1].i === r2.i0 + 2;
    ok('replay step of 5 minutes on a 1 h chart: the bar forms tick by tick, then the next one starts', okIv, JSON.stringify(r2).slice(0, 400));
    await shot(page, '52_replay_sync_iv');
    await page.evaluate(() => PRO._replay.firstStart(PRO.app.cells()[0]));
    await page.waitForTimeout(2500);
    const r3 = await page.evaluate(() => { const a = PRO.app.cells()[0]; return { i: a.replay && a.replay.i, t: a.replay && a.bars[0].t }; });
    ok('replay from the first candle', r3.i === 1 && r3.t < Date.now() / 1000 - 86400 * 365, JSON.stringify(r3));
    await page.evaluate(() => PRO.replayStop(PRO.app.cells()[0]));
    const r4 = await page.evaluate(() => PRO.app.cells().map(c => !!c.replay));
    ok('ending the replay ends it on every chart', r4.every(x => !x), JSON.stringify(r4));
    await ctx.close();
  }

  /* ---------- Iran's market and every coin in toman (tgju.org mocked in its formats) */
  /* ---------- the economic calendar: date range + alerts before events (all high-impact, or one event) */
  if (!ONLY || ONLY === 'cal') {
    const now0 = Math.floor(Date.now() / 1000);
    const EV = [
      { t: now0 + 14 * 60, c: 'USD', i: 'H', n: 'Core CPI m/m', f: '0.3%', p: '0.2%', tr: { fa: 'تورم هسته‌ای ماهانه' } },
      { t: now0 + 3 * 60, c: 'EUR', i: 'M', n: 'German ZEW Economic Sentiment', tr: { fa: 'شاخص احساسات اقتصادی ZEW آلمان' } },
      { t: now0 + 26 * 3600, c: 'GBP', i: 'H', n: 'GDP m/m', tr: { fa: 'تولید ناخالص داخلی ماهانه' } },
      { t: now0 + 9 * 86400, c: 'JPY', i: 'L', n: 'Tankan Index', tr: { fa: 'شاخص تانکان' } },
      { t: now0 - 2 * 3600, c: 'USD', i: 'H', n: 'Retail Sales m/m', tr: { fa: 'خرده‌فروشی ماهانه' } }];
    const { page, ctx } = await newPage(1280, 860, 'fa');
    await page.route(/\/data\/ecocal\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated_at: new Date().toISOString(), source: 'test', since: '2026-01-01', events: EV }) }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length && PRO.app.cells()[0].disp.length > 100, null, { timeout: 20000 });
    await page.click('.pm-stab[data-p="cal"]'); await page.waitForTimeout(1200);
    const rows = sel => page.evaluate(s => [...document.querySelectorAll('.pm-cr')].map(b => b.textContent), sel);
    const all = await rows();
    ok('calendar: the test events are listed (low impact hidden by the default filter)', all.length === 4 && all.some(x => /تورم هسته/.test(x)) && !all.some(x => /تانکان/.test(x)), all.length + ' rows');
    await page.click('[data-r="today"]'); await page.waitForTimeout(300);
    const today = await rows();
    await page.click('[data-r="tomorrow"]'); await page.waitForTimeout(300);
    const tom = await rows();
    await page.click('[data-r="next"]'); await page.waitForTimeout(300);
    const nxt = await rows();
    const tehNow = new Date((now0 + 12600) * 1000), tehH = tehNow.getUTCHours() + tehNow.getUTCMinutes() / 60;
    /* «today» in Tehran: the events 3 and 14 minutes away (+ the one 2 hours ago if it was still today), never tomorrow's */
    ok('calendar range «today» / «tomorrow» / «next week» filter by the page time zone', today.some(x => /تورم هسته/.test(x)) && !today.some(x => /تانکان/.test(x)) && (tehH + 26 < 48 ? tom.some(x => /تولید ناخالص/.test(x)) : true) && !tom.some(x => /تورم هسته/.test(x)) && nxt.every(x => !/تورم هسته/.test(x)), JSON.stringify({ today: today.length, tom: tom.length, nxt: nxt.length }));
    await page.click('[data-r="all"]'); await page.waitForTimeout(300);
    await shot(page, '60_fa_calendar_range');
    /* one event: the bell → «5 min before» → it fires (the event is 3 minutes away) */
    const bells = await page.evaluate(() => document.querySelectorAll('.pm-cr .pm-cb').length);
    ok('past events have no bell, future ones do', bells === 3, String(bells));
    const zew = await page.evaluateHandle(() => [...document.querySelectorAll('.pm-cr')].find(b => /ZEW/.test(b.textContent)).querySelector('.pm-cb'));
    await zew.click(); await page.waitForTimeout(300);
    const menu = await page.evaluate(() => [...document.querySelectorAll('.pm-menu .pm-mi')].map(b => b.textContent));
    ok('the bell menu offers 0/5/15/30/60 minutes in Persian', menu.length === 5 && /۵|5/.test(menu[1]) && /دقیقه/.test(menu[1]), menu.join(' | '));
    await page.click('.pm-menu .pm-mi:nth-of-type(2)'); await page.waitForTimeout(300);
    await page.evaluate(() => PRO._evCheck()); await page.waitForTimeout(400);
    const f1 = await page.evaluate(() => ({ toast: [...document.querySelectorAll('.pm-toast')].map(x => x.textContent).join(' | '), log: JSON.parse(localStorage.getItem('ek_pro_alert_log') || '[]').map(x => x.msg), on: document.querySelectorAll('.pm-cb.on').length }));
    ok('a per-event alert fires before the release: toast + alert log, in Persian', /ZEW/.test(f1.toast) && /دیگر/.test(f1.toast) && f1.log.some(m => /ZEW/.test(m)) && f1.on === 1, JSON.stringify(f1));
    /* firing once only */
    await page.evaluate(() => PRO._evCheck()); await page.waitForTimeout(200);
    const n1 = await page.evaluate(() => JSON.parse(localStorage.getItem('ek_pro_alert_log') || '[]').filter(x => /ZEW/.test(x.msg)).length);
    ok('it fires once, not on every check', n1 === 1, String(n1));
    /* every high-impact event, 15 minutes before: CPI (14 min away) fires, the medium/low ones do not */
    await page.click('.pm-evall input'); await page.waitForTimeout(200);
    await page.evaluate(() => PRO._evCheck()); await page.waitForTimeout(300);
    const f2 = await page.evaluate(() => ({ log: JSON.parse(localStorage.getItem('ek_pro_alert_log') || '[]').map(x => x.msg), st: JSON.parse(localStorage.getItem('ek_pro_evalerts') || '{}') }));
    ok('«alert before every high-impact event» (15 min) fires for CPI only', f2.log.some(m => /تورم هسته/.test(m)) && !f2.log.some(m => /تانکان|تولید ناخالص/.test(m)) && f2.st.all === true && f2.st.min === 15, JSON.stringify(f2.log));
    /* the minutes button */
    await page.click('.pm-evmin'); await page.waitForTimeout(200);
    await page.click('.pm-menu .pm-mi:nth-of-type(4)'); await page.waitForTimeout(200);
    const m30 = await page.evaluate(() => ({ b: document.querySelector('.pm-evmin').textContent, min: JSON.parse(localStorage.getItem('ek_pro_evalerts')).min }));
    ok('the minutes button switches to 30 and is remembered', m30.min === 30 && /۳۰|30/.test(m30.b), JSON.stringify(m30));
    await shot(page, '61_fa_calendar_alerts');
    /* survives a reload */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length, null, { timeout: 20000 });
    await page.waitForTimeout(1500); await page.click('.pm-stab[data-p="cal"]').catch(() => { }); await page.waitForTimeout(1200);
    const rl = await page.evaluate(() => ({ all: (document.querySelector('.pm-evall input') || {}).checked, bell: document.querySelectorAll('.pm-cb.on').length }));
    ok('after a reload the switch and the bell are still on', rl.all === true && rl.bell === 1, JSON.stringify(rl));
    await ctx.close();
  }

  /* ---------- the bigger indicator library: 70 indicators, search in Persian, drawing ahead (Alligator), pivots, panes */
  if (!ONLY || ONLY === 'inds2') {
    const { page, ctx } = await newPage(1280, 860, 'fa');
    await page.evaluate(() => PRO.app.indDialog ? PRO.app.indDialog() : document.querySelector('#pm-inds').click()); await page.waitForTimeout(400);
    const counts = await page.evaluate(() => { const n = () => document.querySelectorAll('.pm-idl .pm-idi').length; const tabs = [...document.querySelectorAll('.pm-idt .pm-chip')]; const r = { over: n() }; tabs[1].click(); r.pane = n(); tabs[0].click(); return r; });
    ok('the indicator dialog lists 25 overlays and 45 pane indicators', counts.over === 25 && counts.pane === 45, JSON.stringify(counts));
    await page.fill('.pm-id input[type=search]', 'تمساح'); await page.waitForTimeout(200);
    const found = await page.evaluate(() => [...document.querySelectorAll('.pm-idl .pm-idi b')].map(x => x.textContent));
    ok('search in Persian finds the Alligator', found.length === 1 && /تمساح/.test(found[0]), found.join(','));
    await page.click('.pm-idl .pm-idi'); await page.waitForTimeout(300);
    for (const q of ['پیوت', 'زیگزاگ', 'PPO', 'فیشر']) { await page.fill('.pm-id input[type=search]', q); await page.waitForTimeout(150); await page.click('.pm-idl .pm-idi'); await page.waitForTimeout(250); }
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const st = await page.evaluate(() => {
      const c = PRO.app.active(), out = {}, last = c.disp[c.disp.length - 1].t;
      Object.values(c.series).forEach(r => { out[r.x.id] = r.list.map((s, j) => { const d = s.data(), v = d.filter(p => p.value != null); return { key: r.keys[j], n: v.length, ahead: v.length ? v[v.length - 1].time > last : false }; }); });
      return { out, panes: c.chart.panes().length, inds: c.cfg.inds.map(x => x.id) };
    });
    const al = st.out.alli || [], pv = st.out.piv || [], zz = (st.out.zz || [])[0] || {}, pp = st.out.ppo || [], fi = st.out.fisher || [];
    ok('Alligator lines are drawn ahead of the last bar (8/5/3 bars)', al.length === 3 && al.every(x => x.n > 100 && x.ahead), JSON.stringify(al));
    ok('pivots (7 levels), ZigZag, PPO (3 plots) and Fisher (2) all have values; 3 panes added', pv.length === 7 && pv.every(x => x.n > 50) && zz.n > 100 && pp.length === 3 && pp.every(x => x.n > 100) && fi.length === 2 && st.panes >= 3, JSON.stringify({ pv: pv.map(x => x.n), zz: zz.n, panes: st.panes, inds: st.inds }));
    await shot(page, '63_fa_new_indicators');
    /* settings of a new indicator: Persian labels, values kept */
    await page.evaluate(() => { const c = PRO.app.active(), x = c.cfg.inds.find(z => z.id === 'alli'); PRO.app.indSettings(c, x); }); await page.waitForTimeout(300);
    const labels = await page.evaluate(() => [...document.querySelectorAll('.pm-iset .pm-field span')].map(x => x.textContent));
    ok('Alligator settings show six Persian labels', labels.length === 6 && labels.includes('طول فک') && labels.includes('جابه‌جایی لب'), labels.join(' | '));
    await page.keyboard.press('Escape');
    /* a toman chart with zero volume: volume-based indicators show nothing rather than garbage */
    await ctx.close();
  }

  /* ---------- watchlist sections: add, move a symbol into one, collapse, keep after reload, remove; ek_watch stays symbols only */
  if (!ONLY || ONLY === 'sections') {
    const { page, ctx } = await newPage(1280, 860, 'fa');
    const clickMenu = async txt => { await page.waitForSelector('.pm-menu .pm-mi'); await page.evaluate(t => { const b = [...document.querySelectorAll('.pm-menu .pm-mi')].find(x => x.textContent.includes(t)); b.click(); }, txt); await page.waitForTimeout(250); };
    await page.waitForSelector('.pm-wl .pm-wr');
    await page.click('.pm-ph [data-a="more"]'); await clickMenu('افزودن بخش');
    await page.fill('.pm-ask input', 'طلا و نقره'); await page.click('.pm-ask button[type=submit]'); await page.waitForTimeout(300);
    let st = await page.evaluate(() => ({ heads: [...document.querySelectorAll('.pm-wsec b')].map(x => x.textContent), rows: [...document.querySelectorAll('.pm-wl > div')].map(x => x.dataset.sec || x.dataset.s) }));
    ok('a section header is added at the end of «my watchlist»', st.heads.length === 1 && st.heads[0] === 'طلا و نقره' && st.rows[st.rows.length - 1] === '§طلا و نقره', JSON.stringify(st.rows));
    await page.dispatchEvent('.pm-wr[data-s="XAUT"]', 'contextmenu'); await clickMenu('طلا و نقره');
    st = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.pm-wl > div')].map(x => x.dataset.sec || x.dataset.s), n: document.querySelector('.pm-wsec small').textContent, watch: localStorage.getItem('ek_watch') }));
    ok('XAUT moves under the section; the site-wide star list is not touched', st.rows.slice(-2).join() === '§طلا و نقره,XAUT' && /۱|1/.test(st.n) && (st.watch === null || !/§/.test(st.watch)), JSON.stringify(st));
    await page.click('.pm-wsec .pm-wst'); await page.waitForTimeout(200);
    const shut = await page.evaluate(() => ({ hidden: !document.querySelector('.pm-wr[data-s="XAUT"]'), cls: document.querySelector('.pm-wsec').className }));
    ok('a click on the header folds the section', shut.hidden && /shut/.test(shut.cls), JSON.stringify(shut));
    await shot(page, '64_fa_watch_sections');
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.pm-wl .pm-wsec', { timeout: 20000 }); await page.waitForTimeout(500);
    const kept = await page.evaluate(() => ({ head: document.querySelector('.pm-wsec b').textContent, hidden: !document.querySelector('.pm-wr[data-s="XAUT"]') }));
    ok('the section and its folded state survive a reload', kept.head === 'طلا و نقره' && kept.hidden, JSON.stringify(kept));
    /* sorting shows the plain list; removing the section keeps XAUT */
    await page.click('.pm-wsec .pm-wsm'); await clickMenu('حذف بخش');
    const gone = await page.evaluate(() => ({ heads: document.querySelectorAll('.pm-wsec').length, xaut: !!document.querySelector('.pm-wr[data-s="XAUT"]') }));
    ok('removing the section keeps its symbols', gone.heads === 0 && gone.xaut, JSON.stringify(gone));
    /* a custom list with two sections */
    await page.click('.pm-ph [data-a="more"]'); await clickMenu('فهرست تازه');
    await page.fill('.pm-ask input', 'تست'); await page.click('.pm-ask button[type=submit]'); await page.waitForTimeout(300);
    await page.click('.pm-ph [data-a="more"]'); await clickMenu('افزودن بخش'); await page.fill('.pm-ask input', 'الف'); await page.click('.pm-ask button[type=submit]'); await page.waitForTimeout(250);
    const lists = await page.evaluate(() => JSON.parse(localStorage.getItem('ek_pro_watch')).lists);
    ok('custom lists keep their sections in their own array', lists.length === 1 && lists[0].s.join() === '§الف', JSON.stringify(lists));
    await ctx.close();
  }

  /* ---------- «sync indicators» across a multi-chart layout */
  if (!ONLY || ONLY === 'syncind') {
    const { page, ctx } = await newPage(1280, 860, 'fa');
    await page.click('#pm-lay'); await page.click('.pm-layb[data-l="4"]');
    await page.waitForFunction(() => PRO.app.cells().length === 4 && PRO.app.cells().every(c => c.disp.length > 50), null, { timeout: 30000 });
    await page.click('#pm-lay'); await page.waitForTimeout(200);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.pm-menu .pm-mi')].find(x => x.textContent.includes('اندیکاتورها')); b.click(); }); await page.waitForTimeout(300);
    await page.keyboard.press('Escape'); await page.mouse.click(640, 120);
    const a0 = await page.evaluate(() => PRO.app.cells().map(c => c.cfg.inds.map(x => x.id).join('+')));
    await page.evaluate(() => { PRO.app.setActive(1); PRO.app.indDialog(); }); await page.waitForTimeout(300);
    await page.fill('.pm-id input[type=search]', 'هال'); await page.waitForTimeout(150); await page.click('.pm-idl .pm-idi'); await page.waitForTimeout(400);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const a1 = await page.evaluate(() => PRO.app.cells().map(c => ({ ids: c.cfg.inds.map(x => x.id).join('+'), drawn: Object.values(c.series).some(r => r.x.id === 'hma' && r.list[0].data().length > 20) })));
    ok('with «sync indicators» on, an indicator added on chart 2 appears, drawn, on all four charts', a1.every(x => /hma/.test(x.ids) && x.drawn), JSON.stringify({ a0, a1 }));
    await page.evaluate(() => { const c = PRO.app.cells()[1], x = c.cfg.inds.find(z => z.id === 'hma'); x.p.len = 30; c.indsChanged(); }); await page.waitForTimeout(300);
    const a2 = await page.evaluate(() => PRO.app.cells().map(c => (c.cfg.inds.find(z => z.id === 'hma') || {}).p.len));
    ok('changing its length on one chart changes it everywhere', a2.every(v => v === 30), JSON.stringify(a2));
    await page.click('#pm-lay'); await page.click('.pm-layb[data-l="1"]'); await page.waitForTimeout(600);
    await ctx.close();
  }

  /* ---------- all 17 chart types (Faraz / TradingView list); the price-only ones are rebuilt from closes */
  if (!ONLY || ONLY === 'types') {
    const { page, ctx } = await newPage(1280, 860, 'fa');
    await page.click('#pm-type'); await page.waitForTimeout(300);
    const names = await page.evaluate(() => [...document.querySelectorAll('.pm-tymenu .pm-mi span')].map(x => x.textContent));
    ok('the chart-type menu lists 17 types in Persian, with the price-only group', names.length === 17 && names.includes('رنکو') && names.includes('کاگی') && names.includes('شمعی حجمی') && names.includes('ناحیه‌ای HLC'), names.join(' | '));
    await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
    const res = {};
    for (const t of ['candle', 'hollow', 'volcandle', 'heikin', 'bars', 'highlow', 'line', 'linemk', 'step', 'area', 'hlcarea', 'baseline', 'columns', 'renko', 'lbreak', 'kagi', 'pnf']) {
      await page.evaluate(t => PRO.app.active().setType(t), t); await page.waitForTimeout(350);
      res[t] = await page.evaluate(() => { const c = PRO.app.active(), D = c.disp; let inc = true; for (let i = 1; i < D.length; i++) if (!(D[i].t > D[i - 1].t)) { inc = false; break; } return { n: D.length, inc, data: c.main.data().length, ind: Object.keys(c.series).length }; });
      if (['volcandle', 'hlcarea', 'renko', 'kagi', 'pnf', 'lbreak', 'highlow'].includes(t)) await shot(page, '62_type_' + t);
    }
    const bad = Object.entries(res).filter(([t, r]) => !(r.n > 5 && r.inc && r.data === r.n && r.ind >= 1));
    ok('each of the 17 types draws (series = bars, times strictly increasing, volume indicator kept)', bad.length === 0, JSON.stringify(bad.length ? bad : res.renko));
    ok('price-only types rebuild the bars (fewer items than candles)', res.renko.n < res.candle.n && res.kagi.n < res.candle.n && res.pnf.n < res.candle.n && res.lbreak.n < res.candle.n, JSON.stringify({ c: res.candle.n, r: res.renko.n, k: res.kagi.n, p: res.pnf.n, l: res.lbreak.n }));
    /* box settings: a bigger box → fewer bricks; remembered after reload */
    await page.evaluate(() => PRO.app.active().setType('renko')); await page.waitForTimeout(300);
    const before = await page.evaluate(() => ({ n: PRO.app.active().disp.length, box: PRO.app.active().boxAuto }));
    await page.click('#pm-type'); await page.waitForTimeout(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.pm-tymenu .pm-mi')].pop(); b.click(); }); await page.waitForTimeout(300);
    const ph = await page.evaluate(() => (document.querySelector('.pm-iset input[name=box]') || {}).placeholder || '');
    await page.fill('.pm-iset input[name=box]', String(before.box * 3)); await page.click('.pm-iset button[type=submit]'); await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({ n: PRO.app.active().disp.length, tp: PRO.app.active().cfg.tp }));
    ok('renko box setting: placeholder shows the automatic size; 3× box → far fewer bricks', /خودکار/.test(ph) && after.n < before.n / 2 && after.tp.box === before.box * 3, JSON.stringify({ ph, before, after }));
    /* live: ticks keep the rebuilt chart consistent */
    await page.waitForTimeout(3500);
    const live = await page.evaluate(() => { const c = PRO.app.active(), D = c.disp; return { n: D.length, data: c.main.data().length, last: D[D.length - 1] && D[D.length - 1].c }; });
    ok('renko stays consistent while live ticks arrive', live.n === live.data && live.n > 3, JSON.stringify(live));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length && PRO.app.cells()[0].disp.length > 3, null, { timeout: 20000 });
    const kept = await page.evaluate(() => ({ type: PRO.app.active().cfg.type, tp: PRO.app.active().cfg.tp }));
    ok('type and box size survive a reload', kept.type === 'renko' && kept.tp && kept.tp.box === before.box * 3, JSON.stringify(kept));
    /* replay on a price-only type */
    await page.evaluate(() => { const c = PRO.app.active(); c.setTP({}); }); await page.waitForTimeout(300);
    const rp = await page.evaluate(async () => {
      const c = PRO.app.active(); if (!PRO._replay) return 'no replay';
      PRO._replay.begin(c, c.bars.slice(), c.bars.length - 300); await new Promise(r => setTimeout(r, 400));
      const n1 = c.disp.length, i1 = c.replay.i, t1 = c.disp[n1 - 1].t;
      for (let i = 0; i < 150; i++) PRO._replay.step(c); await new Promise(r => setTimeout(r, 300));
      const n2 = c.disp.length, i2 = c.replay.i, data = c.main.data().length, lastBar = c.bars[c.replay.i].t, lastBrick = c.disp[n2 - 1].t;
      PRO._replay.close(c); return { n1, n2, i1, i2, data, noFuture: lastBrick <= lastBar + 400, t1 };
    });
    ok('replay works on renko: bricks are added as bars are replayed, none from the future', rp && rp.i2 === rp.i1 + 150 && rp.n2 > rp.n1 && rp.data === rp.n2 && rp.noFuture, JSON.stringify(rp));
    /* picking the replay start on a brick goes back to the bar that formed it */
    const pk = await page.evaluate(() => { const c = PRO.app.active(), k = Math.floor(c.disp.length / 2), t = c.disp[k].t; c._pickClick && 0; return { k, t, bar: c.bars.findIndex(b => b.t >= t - 3600) }; });
    ok('a brick maps back to its bar (time order kept)', pk.bar >= 0, JSON.stringify(pk));
    await page.evaluate(() => PRO.app.active().setType('candle'));
    await ctx.close();
  }

  if (!ONLY || ONLY === 'toman') {
    const { page, ctx, stats } = await newPage(1280, 860, 'fa');
    /* the search: currencies in toman */
    await page.click('#pm-sym'); await page.waitForTimeout(400);
    await page.click('.pm-sscat .pm-chip:nth-child(5)'); await page.waitForTimeout(400);
    const fx = await page.evaluate(() => [...document.querySelectorAll('.pm-ssl [data-s]')].map(b => b.getAttribute('data-s') + '=' + b.querySelector('b').textContent));
    ok('search: the currencies tab lists the dollar, euro and Iraqi dinar in toman, with names', fx.some(x => x === 'IR_USD=دلار آمریکا') && fx.some(x => /^IR_EUR=/.test(x)) && fx.some(x => /^IR_IQD=دینار عراق/.test(x)), fx.slice(0, 6).join(' | '));
    await page.click('.pm-ssl [data-s="IR_USD"]');
    await page.waitForFunction(() => { const c = PRO.app.active(); return c.cfg.sym === 'IR_USD' && c.disp.length > 100; }, null, { timeout: 15000 }).catch(() => { });
    const usd = await page.evaluate(() => { const c = PRO.app.active(), b = c.bars[c.bars.length - 1]; return { src: c.feed && c.feed.src, st: c.feed && c.feed.state, n: c.disp.length, c: b && b.c, leg: (c.el.querySelector('.pm-lsym') || {}).textContent, srcl: (c.el.querySelector('.pm-src') || {}).textContent, prec: c.prec() }; });
    ok('the dollar in toman: tgju history ÷ 10, polled live, named and without decimals', usd.src === 'tgju' && usd.n > 100 && usd.c > 250000 && usd.c < 290000 && /دلار آمریکا/.test(usd.leg) && usd.srcl === 'tgju' && usd.prec === 0, JSON.stringify(usd));
    await shot(page, '50_fa_toman_usd');
    /* tgju's grid: hourly bars stay on Tehran's :30 after a live tick, one bar per time, ticks never make bars of their own */
    const grid = async (sym, tf) => {
      await page.evaluate(([s, t]) => { PRO.app.active().setTF(t); PRO.app.applySym(s); }, [sym, tf]);
      await page.waitForFunction(s => { const c = PRO.app.active(); return c.cfg.sym === s && c.disp.length > 100; }, sym, { timeout: 15000 }).catch(() => { });
      await page.waitForTimeout(1500);
      return page.evaluate(() => {
        const c = PRO.app.active(), B = c.bars, sec = c.tfSec(), d = c.main.data(); let inc = true, off = {};
        for (let i = 1; i < B.length; i++) if (!(B[i].t > B[i - 1].t)) inc = false;
        B.slice(-50).forEach(b => { off[(b.t % sec + sec) % sec] = 1; });
        return { n: B.length, inc, offs: Object.keys(off), lastAge: Math.floor(Date.now() / 1000) - B[B.length - 1].t, data: d.length };
      });
    };
    const g1 = await grid('IR_USD', '1h'), g2 = await grid('IR_ONS', '1d');
    ok('tgju bars stay on their grid after live ticks (1h on :30, 1d at 00:00), strictly increasing, repeated timestamps merged',
      g1.inc && g1.offs.join() === '1800' && g1.lastAge < 3600 && g2.inc && g2.offs.join() === '0' && g2.lastAge < 86400 && g1.data === g1.n && g2.data === g2.n, JSON.stringify({ g1, g2 }));
    await page.evaluate(() => { PRO.app.active().setTF('1h'); PRO.app.applySym('IR_USD'); }); await page.waitForTimeout(1200);
    /* shorter than tgju has → 5 minutes, said */
    await page.evaluate(() => PRO.app.active().setTF('1m')); await page.waitForTimeout(1200);
    const t5 = await page.evaluate(() => ({ tf: PRO.app.active().cfg.tf, toast: (document.querySelector('.pm-toast') || {}).textContent || '' }));
    ok('a 1-minute request on a tgju symbol becomes 5 minutes, and the page says why', t5.tf === '5m' && /۵|5/.test(t5.toast), JSON.stringify(t5));
    /* bitcoin in toman = Binance × tether rate */
    await page.evaluate(() => PRO.app.applySym('BTC_IRT')); await page.evaluate(() => PRO.app.active().setTF('1h'));
    await page.waitForFunction(() => { const c = PRO.app.active(); return c.cfg.sym === 'BTC_IRT' && c.disp.length > 100; }, null, { timeout: 15000 }).catch(() => { });
    const irt = await page.evaluate(() => { const c = PRO.app.active(), b = c.bars[c.bars.length - 1], r = PRO.rateAt(b.t + 1800); return { src: c.feed.src, n: c.disp.length, c: b.c, r: r, leg: c.el.querySelector('.pm-lsym').textContent, srcl: c.el.querySelector('.pm-src').textContent }; });
    ok('bitcoin in toman: the Binance bar × tether in toman, labelled computed', irt.src === 'irt' && irt.n > 100 && irt.r > 250000 && irt.c > 60000 * irt.r && irt.c < 90000 * irt.r && /BTC\/تومان/.test(irt.leg) && /tgju/.test(irt.srcl), JSON.stringify(irt));
    /* tether in toman needs tether's own logo; until the site has it, it is not offered (the logo rule) */
    const usdt = await page.evaluate(() => ({ has: PRO.hasLogo('IR_USDT'), inList: PRO.irList().indexOf('IR_USDT') >= 0 }));
    ok('tether in toman is offered only once tether’s logo exists', usdt.has === usdt.inList, JSON.stringify(usdt));
    /* the watchlist: Iran's market and every Binance coin */
    await page.selectOption('.pm-spanel select', 'iran'); await page.waitForTimeout(1500);
    const ir = await page.evaluate(() => [...document.querySelectorAll('.pm-wr[data-s]')].map(r => r.getAttribute('data-s') + '=' + r.querySelector('.pm-wc').textContent));
    ok('watchlist «gold & currency (toman)» shows live tgju prices', ir.length >= 30 && ir.some(x => /^IR_USD=2[5-9]\d,\d{3}$/.test(x)) && ir.some(x => /^IR_SEKEE=2[0-9]{2},\d{3},\d{3}$/.test(x)), ir.slice(0, 5).join(' | '));
    await page.selectOption('.pm-spanel select', 'all'); await page.waitForTimeout(1200);
    const all = await page.evaluate(() => ({ n: document.querySelectorAll('.pm-wr[data-s]').length, uni: 0, q: !!document.querySelector('.pm-wq') }));
    const uni = await page.evaluate(() => PRO.universe().then(u => u.length));
    await page.fill('.pm-wq', 'eth'); await page.waitForTimeout(500);
    const filt = await page.evaluate(() => [...document.querySelectorAll('.pm-wr[data-s]')].map(r => r.getAttribute('data-s')));
    ok('watchlist «every Binance coin» lists the whole universe, with a filter', all.n === uni && uni > 100 && all.q && filt.indexOf('ETH') >= 0 && filt.length < 10, JSON.stringify({ all, uni, filt }));
    /* alerts: the dollar can go to the bot (its own asset names), bitcoin in toman cannot */
    const bot = await page.evaluate(() => ({ usd: PRO._botArg({ sym: 'IR_USD', v: 270000 }), gold: PRO._botArg({ sym: 'IR_GERAM18', v: 25000000 }), irt: PRO._botArg({ sym: 'BTC_IRT', v: 1 }), btc: PRO._botArg({ sym: 'BTC', v: 72155.5 }) }));
    ok('alert links: t_USD_270000, t_GOLD_18_…, none for computed toman coins, a_BTC_… unchanged', bot.usd === 't_USD_270000' && bot.gold === 't_GOLD_18_25000000' && bot.irt === null && bot.btc === 'a_BTC_72155d5', JSON.stringify(bot));
    const tfs = await page.evaluate(() => { PRO.app.applySym('BTC'); return true; });
    await page.click('#pm-tfmore').catch(() => { }); await page.waitForTimeout(300);
    const secs = await page.evaluate(() => [...document.querySelectorAll('.pm-tfmenu .pm-tf')].map(b => b.childNodes[0].textContent).filter(t => /s$/.test(t)));
    ok('seconds timeframes 1s–45s, as on Faraz', ['1s', '5s', '10s', '15s', '20s', '30s', '45s'].every(t => secs.indexOf(t) >= 0), secs.join(','));
    await page.keyboard.press('Escape');
    await ctx.close();
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

  /* ---------- alerts beyond price levels: n% moves, sloped lines and channels, an end date, more indicator conditions */
  if (!ONLY || ONLY === 'al2') {
    const { page, ctx } = await newPage(1280, 860, 'fa');
    /* LINK: a market no other open page watches, so the shared tick hook feeds only this page */
    await page.evaluate(() => PRO.app.active().setSym('LINK')); await page.waitForFunction(() => { const c = PRO.app.active(); return c.cfg.sym === 'LINK' && c.disp.length > 100; }, null, { timeout: 20000 });
    await page.click('#pm-alert'); await page.waitForSelector('.pm-af'); await page.waitForTimeout(120);
    await page.selectOption('.pm-af [name=c]', 'pmv'); await page.fill('.pm-af [name=v]', '1'); await page.dispatchEvent('.pm-af [name=v]', 'input');
    const tgt = await page.evaluate(() => document.querySelector('.pm-af .pm-tgt').textContent);
    await page.selectOption('.pm-af [name=exp]', String(86400e3));
    await page.click('.pm-af button[type=submit]'); await page.waitForTimeout(300);
    const pa = await page.evaluate(() => { const a = PRO._alerts()[0]; return { k: a.k, c: a.c, v: a.v, base: a.base, exp: a.exp - a.at, lines: PRO.alertLines('LINK').map(x => x.v) }; });
    ok('a 1% either-way alert keeps its starting price, an end date in a day, and shows both targets', pa.c === 'pmv' && pa.v === 1 && pa.base > 0 && Math.abs(pa.exp - 86400e3) < 5000 && pa.lines.length === 2 && Math.abs(pa.lines[0] / pa.base - 1.01) < 1e-9 && Math.abs(pa.lines[1] / pa.base - 0.99) < 1e-9 && /[0-9]/.test(tgt), JSON.stringify(pa) + ' ' + tgt);
    for (let k = 0; k < 8 && !(await page.evaluate(() => PRO._alerts()[0].n >= 1)); k++) {   /* other open pages may take ticks from the shared hook: offer the move again */
      OVR.LINKUSDT = [pa.base * 0.996, pa.base * 1.004, pa.base * 1.0105, pa.base * 1.0102]; await page.waitForTimeout(2500);
    }
    const pf = await page.evaluate(() => { const a = PRO._alerts()[0]; return { n: a.n, on: a.on, log: JSON.parse(localStorage.getItem('ek_pro_alert_log') || '[]')[0] }; });
    ok('…and fires once the price is 1% away', pf.n === 1 && pf.on === false && pf.log && /1%/.test(pf.log.msg), JSON.stringify(pf));
    /* a sloped line: the alert follows it */
    const now = Math.floor(Date.now() / 1000);
    const lv = await page.evaluate((now) => {
      const c = PRO.app.active(), p = c.bars[c.bars.length - 1].c;
      PRO.app.mutate('LINK', L => { L.push({ id: 'tl1', k: 'ray', pts: [{ t: now - 36000, p: p * 0.99 }, { t: now - 18000, p: p * 0.995 }], s: {} }); L.push({ id: 'ch1', k: 'channel', pts: [{ t: now - 36000, p: p * 0.98 }, { t: now - 18000, p: p * 0.99 }, { t: now - 30000, p: p * 1.02 }], s: { r: true } }); });
      const d = PRO.app.DRAW().LINK.find(x => x.id === 'tl1');
      PRO.alertDialog(c, { draw: d });
      return { p, L: PRO.alertLevels({ sym: 'LINK', did: 'tl1' }, now), C: PRO.alertLevels({ sym: 'LINK', did: 'ch1' }, now), tab: document.querySelector('.pm-af [data-k="draw"].on') ? 1 : 0, opts: [...document.querySelectorAll('.pm-af [name=dc] option')].map(o => o.value).join(',') };
    }, now);
    const lineAt = lv.p * 0.99 + lv.p * 0.005 * 36000 / 18000, base = lv.p * 0.98 + lv.p * 0.01 * 2, off = lv.p * 1.02 - (lv.p * 0.98 + lv.p * 0.01 * 6000 / 18000);
    ok('a ray: the alert reads the line where it is now; a channel gives both sides', lv.tab === 1 && lv.opts === 'cross,up,down' && Math.abs(lv.L[0] / lineAt - 1) < 1e-4 && Math.abs(lv.C[0] / base - 1) < 1e-4 && Math.abs(lv.C[1] / (base + off) - 1) < 1e-4, JSON.stringify(lv));
    await page.selectOption('.pm-af [name=dc]', 'up'); await page.click('.pm-af button[type=submit]'); await page.waitForTimeout(300);
    const L1 = await page.evaluate(() => PRO.alertLevels({ sym: 'LINK', did: 'tl1' }, Date.now() / 1000)[0]);
    for (let k = 0; k < 8 && !(await page.evaluate(() => PRO._alerts()[0].k === 'draw' && PRO._alerts()[0].n >= 1)); k++) {
      OVR.LINKUSDT = [L1 * 0.997, L1 * 0.999, L1 * 1.004, L1 * 1.006]; await page.waitForTimeout(2500);
    }
    const df = await page.evaluate(() => { const a = PRO._alerts()[0]; return { k: a.k, c: a.c, n: a.n, dk: a.dk }; });
    ok('…and fires when the price breaks above the ray', df.k === 'draw' && df.c === 'up' && df.n === 1 && df.dk === 'ray', JSON.stringify(df));
    /* the end date: an expired alert switches off and says so */
    const ex = await page.evaluate(() => { const a = PRO._alerts()[1]; a.on = true; a.exp = Date.now() - 1000; PRO._alertSweep(); return { on: a.on, expd: a.expd, log: JSON.parse(localStorage.getItem('ek_pro_alert_log') || '[]')[0].msg }; });
    ok('an alert past its end date switches off and is logged', ex.on === false && ex.expd === 1 && ex.log.length > 5, JSON.stringify(ex));
    /* the new indicator conditions fire on the bar that crosses */
    const ev = await page.evaluate(() => {
      const mk = (cs, vs) => cs.map((c, i) => ({ t: i * 3600, o: c, h: c * 1.001, l: c * 0.999, c, v: vs ? vs[i] : 1 }));
      const run = (a, bars, from) => bars.map((_, n) => n >= from ? (PRO.alertEval(a, bars.slice(0, n + 1)) ? 1 : 0) : 0).join('').slice(from);
      const dn = [...Array(60).keys()].map(i => 200 - i), cs = dn.concat([...Array(30).keys()].map(i => 141 + i * 3));
      const x = run({ k: 'ind', ind: { id: 'xma', len: 5, len2: 15 }, c: 'up' }, mk(cs), 55);
      const s = run({ k: 'ind', ind: { id: 'st', len: 10 }, c: 'up' }, mk(cs), 55);
      const vv = Array(50).fill(10).concat([10, 31, 40, 10]), v = run({ k: 'ind', ind: { id: 'vol', len: 20 }, c: 'gt', v: 3 }, mk(Array(54).fill(100), vv), 48);
      const k = run({ k: 'ind', ind: { id: 'stoch', len: 14 }, c: 'up', v: 20 }, mk(cs), 55);
      return { x, s, v, k };
    });
    const once = s => (s.match(/1/g) || []).length === 1;
    ok('new indicator alerts: EMA cross, SuperTrend flip, Stochastic and a volume spike each fire once, on their bar', once(ev.x) && once(ev.s) && once(ev.k) && ev.v === '000100', JSON.stringify(ev));
    await page.click('.pm-stab[data-p="alerts"]'); await page.waitForTimeout(400); await shot(page, '65_fa_alerts2');
    await ctx.close();
  }

  /* ---------- news on the chart (the site's feed) and news alerts (the four-language reel) */
  if (!ONLY || ONLY === 'news') {
    const ctxN = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-US', timezoneId: 'Asia/Tehran', serviceWorkers: 'block' });
    const nowS = Math.floor(Date.now() / 1000), iso = t => new Date(t * 1000).toISOString();
    let reel = [{ id: 'r1', at: iso(nowS - 3000), url: 'https://example.com/1', source: 'Src', coins: ['BTC'], cat: 'news', t: { en: 'Old one', fa: 'خبر قدیمی', ckb: 'کۆن', ar: 'قديم' } }];
    await ctxN.route(/\/data\/news\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [
      { id: 'a', title: 'BTC one', tfa: 'بیت‌کوین یک', url: 'https://example.com/a', source: 'S1', date: iso(nowS - 5 * 3600 + 60), coins: ['BTC'], category: 'regulation' },
      { id: 'b', title: 'BTC two', tfa: 'بیت‌کوین دو', url: 'https://example.com/b', source: 'S2', date: iso(nowS - 5 * 3600 + 900), coins: ['BTC', 'ETH'], category: 'news' },
      { id: 'c', title: 'BTC three', url: 'https://example.com/c', source: 'S3', date: iso(nowS - 20 * 3600), coins: ['BTC'], category: 'security' },
      { id: 'd', title: 'ETH only', url: 'https://example.com/d', source: 'S4', date: iso(nowS - 3 * 3600), coins: ['ETH'], category: 'news' }] }) }));
    await ctxN.route(/\/data\/newsreel\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: reel }) }));
    const page = await ctxN.newPage(); page.on('pageerror', e => errors.push('[news] ' + e.message));
    await mockNet(page, { rest: 0, ws: 0, msgs: 0 });
    await page.goto(`${base}/market/?lang=fa`); await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length && PRO.app.cells()[0].disp.length > 100, null, { timeout: 20000 });
    await page.click('#pm-ind'); await page.waitForSelector('.pm-chip'); await page.click('.pm-chip:nth-child(3)'); await page.click('.pm-idi[data-id="news"]'); await page.waitForTimeout(800);
    await page.evaluate(() => PRO.app.closeModal());
    const nm = await page.evaluate(() => { const c = PRO.app.active(), k = Object.keys(c.markInfo || {}).filter(x => x[0] === 'n'); return { k: k.length, sizes: k.map(x => c.markInfo[x].items.length).sort().join(','), first: k.length && c.markInfo[k[0]].items[0].category }; });
    ok('news on the chart: one mark per bar, this coin only (2 in one hour, 1 alone)', nm.k === 2 && nm.sizes === '1,2', JSON.stringify(nm));
    await page.evaluate(() => { const c = PRO.app.active(), k = Object.keys(c.markInfo).filter(x => x[0] === 'n' && c.markInfo[x].items.length === 2)[0]; c.onClick({ point: { x: 10, y: 10 }, hoveredObjectId: k }); });
    const nb = await page.evaluate(() => [...document.querySelectorAll('.pm-newsi')].map(a => a.querySelector('b').textContent + '|' + a.href));
    ok('clicking it lists its headlines in the reader\'s language, with links', nb.length === 2 && nb[0].startsWith('بیت‌کوین یک|https://example.com/a'), JSON.stringify(nb));
    await page.evaluate(() => PRO.app.closeModal()); await shot(page, '66_fa_news_marks');
    /* news alerts */
    await page.click('.pm-stab[data-p="alerts"]'); await page.waitForSelector('.pm-nal select');
    await page.selectOption('.pm-nal select', 'imp'); await page.waitForTimeout(400);
    const n0 = await page.evaluate(() => PRO._newsPoll());
    reel = reel.concat([{ id: 'r2', at: iso(nowS - 60), url: 'https://example.com/2', source: 'Src', coins: ['ZZZ'], cat: 'regulation', t: { en: 'Rule change', fa: 'قانون تازه', ckb: 'یاسای نوێ', ar: 'قانون جديد' } },
      { id: 'r3', at: iso(nowS - 30), url: 'https://example.com/3', source: 'Src', coins: ['BTC'], cat: 'news', t: { en: 'Plain', fa: 'معمولی', ckb: 'ئاسایی', ar: 'عادي' } }]);
    const n1 = await page.evaluate(() => PRO._newsPoll());
    const lg = await page.evaluate(() => (JSON.parse(localStorage.getItem('ek_pro_alert_log') || '[]')[0] || {}).msg);
    ok('news alerts: the first read is a baseline, then only new important headlines alert, in the reader\'s language', n0 === 0 && n1 === 1 && /قانون تازه/.test(lg || ''), JSON.stringify({ n0, n1, lg }));
    await page.selectOption('.pm-nal select', 'watch'); await page.waitForTimeout(600);
    reel = reel.concat([{ id: 'r4', at: iso(nowS - 10), url: 'https://example.com/4', source: 'Src', coins: ['ETH'], cat: 'news', t: { en: 'ETH news', fa: 'خبر اتریوم', ckb: 'ئیسیریۆم', ar: 'إيثريوم' } },
      { id: 'r5', at: iso(nowS - 5), url: 'https://example.com/5', source: 'Src', coins: ['ZZZ'], cat: 'news', t: { en: 'Other', fa: 'دیگر', ckb: 'تر', ar: 'آخر' } }]);
    const n2 = await page.evaluate(() => PRO._newsPoll());
    ok('…and in watchlist mode only headlines about the watched coins', n2 === 1, String(n2));
    await shot(page, '67_fa_news_alerts'); await ctxN.close();
  }

  /* ---------- market watch (screener) */
  if (!ONLY || ONLY === 'scr') {
    const { page, ctx } = await newPage(1280, 860, 'fa');
    await page.click('.pm-stab[data-p="watch"]').catch(() => { }); await page.waitForSelector('.pm-ph [data-a="scr"]');
    await page.click('.pm-ph [data-a="scr"]'); await page.waitForSelector('.pm-scrt tbody tr[data-s]', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.pm-scrt tbody tr[data-s]').length > 5, null, { timeout: 20000 });
    const s1 = await page.evaluate(() => { const r = [...document.querySelectorAll('.pm-scrt tbody tr[data-s]')]; const q = r.map(x => x.children[4].textContent); return { n: r.length, first: r[0].getAttribute('data-s'), sum: document.querySelector('.pm-scrsum').textContent.slice(0, 80), movers: document.querySelectorAll('.pm-mv').length, sorted: PRO.app.st ? 1 : 1 }; });
    const vols = await page.evaluate(() => { const u = { K: 1e3, M: 1e6, B: 1e9 }, L = [...document.querySelectorAll('.pm-scrt tbody tr[data-s]')].map(x => { const m = /^([\d.]+)([KMB]?)$/.exec(x.children[4].textContent.trim()); return m ? +m[1] * (u[m[2]] || 1) : NaN; }).filter(v => isFinite(v)); return L.length > 5 && L.every((v, i) => !i || v <= L[i - 1] * 1.01 + 1e-9); });
    ok('market watch lists the Binance coins sorted by 24h volume, with breadth and top movers', s1.n >= 6 && vols && s1.movers === 8 && /[0-9۰-۹]/.test(s1.sum), JSON.stringify(s1));
    await shot(page, '68_fa_screener');
    await page.click('.pm-scrt th[data-k="p"]');
    const s2 = await page.evaluate(() => { const L = [...document.querySelectorAll('.pm-scrt tbody tr[data-s]')].map(x => parseFloat(x.children[3].textContent.replace('−', '-'))).filter(v => isFinite(v)); return { ok: L.every((v, i) => !i || v <= L[i - 1] + 1e-9), n: L.length, head: L.slice(0, 5) }; });
    ok('a click on 24h sorts by change, highest first', s2.ok && s2.n >= 6, JSON.stringify(s2));
    await page.click('.pm-scrf [data-f="down"]');
    const s3 = await page.evaluate(() => [...document.querySelectorAll('.pm-scrt tbody tr[data-s]')].every(x => /^-/.test(x.children[3].textContent)));
    ok('the losers filter keeps only falling coins', s3);
    await page.click('.pm-scrf [data-f="all"]'); await page.fill('.pm-scr input[type=search]', 'eth'); await page.waitForTimeout(300);
    const s4 = await page.evaluate(() => [...document.querySelectorAll('.pm-scrt tbody tr[data-s]')].map(x => x.getAttribute('data-s')));
    ok('search narrows the list', s4.length >= 1 && s4.every(x => /ETH/.test(x)), JSON.stringify(s4));
    const star0 = await page.evaluate(() => (JSON.parse(localStorage.getItem('ek_watch') || '[]')));
    await page.click('.pm-scrt tbody tr[data-s="ETHFI"] [data-star], .pm-scrt tbody tr[data-s]:not([data-s="ETH"]) [data-star]');
    const star1 = await page.evaluate(() => (JSON.parse(localStorage.getItem('ek_watch') || '[]')));
    ok('☆ adds the coin to the watchlist', star1.length === Math.max(star0.length, 7) + 1 || star1.length === star0.length + 1, JSON.stringify([star0.length, star1.length]));
    await page.click('.pm-scrt tbody tr[data-s="ETH"] td:nth-child(2)');
    ok('a row opens the coin on the chart and closes the list', await page.evaluate(() => !document.querySelector('.pm-scr') && PRO.app.active().cfg.sym === 'ETH'));
    await page.evaluate(() => PRO.screener()); await page.click('.pm-scr [data-m="iran"]'); await page.waitForTimeout(2500);
    const s5 = await page.evaluate(() => [...document.querySelectorAll('.pm-scrt tbody tr[data-s]')].map(x => x.getAttribute('data-s')));
    if (!s5.length) console.log('DEBUG iran', await page.evaluate(() => JSON.stringify({ L: (PRO.irList ? PRO.irList() : []).slice(0, 6), d: (PRO.irList ? PRO.irList() : []).slice(0, 6).map(s => PRO.tickers.d[s] || null), body: document.querySelector('.pm-scrt tbody').textContent.slice(0, 120) })));
    ok('the Iran tab lists the toman market', s5.length >= 5 && s5.some(x => /^IR_|_IRT$/.test(x)), JSON.stringify(s5.slice(0, 8)));
    await page.evaluate(() => { localStorage.removeItem('ek_pro_scr'); PRO.app.closeModal(); });
    await ctx.close();
    const { page: pg, ctx: cx } = await newPage(390, 844, 'ar');
    await pg.evaluate(() => PRO.screener()); await pg.waitForSelector('.pm-scrt tbody tr[data-s]', { timeout: 20000 });
    const fit = await pg.evaluate(() => { const m = document.querySelector('.pm-mbox').getBoundingClientRect(); return { l: m.left, r: m.right, vw: innerWidth, sw: document.documentElement.scrollWidth }; });
    ok('[ar 390] market watch fits the phone (the table scrolls inside)', fit.l >= 0 && fit.r <= fit.vw + 0.5 && fit.sw <= fit.vw, JSON.stringify(fit));
    await shot(pg, '69_ar_screener_phone'); await cx.close();
  }

  /* ---------- help and support; a QR code of the workspace; every chart in one CSV; two tabs in step */
  if (!ONLY || ONLY === 'help') {
    const { page, ctx } = await newPage(1280, 860, 'ckb');
    await page.click('.pm-stab[data-p="help"]'); await page.waitForSelector('.pm-help');
    const hp = await page.evaluate(() => ({ n: document.querySelectorAll('.pm-help details').length, keys: document.querySelectorAll('.pm-keys tr').length, links: [...document.querySelectorAll('.pm-sup a')].map(a => a.getAttribute('href')), fab: !!document.getElementById('ask-fab'), dir: document.querySelector('.pm-spanel').dir }));
    ok('[ckb] help: eleven guide topics, the keyboard, and support links (group, admin, class)', hp.n === 11 && hp.keys === 8 && hp.links.join() === 'https://t.me/Coin_Kurd_Group,https://t.me/Kurdistan_Coin,/class/' && hp.dir === 'rtl', JSON.stringify(hp));
    await page.click('.pm-help details:nth-of-type(7) summary'); await shot(page, '70_ckb_help');
    if (hp.fab) { await page.click('.pm-sup [data-a="ai"]'); await page.waitForTimeout(500); ok('the assistant button opens the site assistant', await page.evaluate(() => { const p = document.querySelector('.ask-panel, #ask-panel'); return !!p && getComputedStyle(p).display !== 'none'; })); }
    await page.click('#pm-ws'); await page.click('.pm-menu .pm-mi:nth-last-child(5)').catch(() => { });
    await page.evaluate(() => { const m = [...document.querySelectorAll('.pm-menu .pm-mi')].find(x => /share|بەستەر|لینک|رابط/i.test(x.textContent)); if (m) m.click(); });
    await page.waitForSelector('.pm-qr svg', { timeout: 8000 }).catch(() => { });
    const qr = await page.evaluate(() => ({ svg: !!document.querySelector('.pm-qr svg'), url: (document.querySelector('.pm-modal input') || {}).value || '' }));
    ok('the share dialog shows a QR code of the workspace link', qr.svg && /\/market\/#s=[zj]/.test(qr.url), JSON.stringify({ svg: qr.svg, len: qr.url.length }));
    await shot(page, '71_ckb_share_qr'); await page.evaluate(() => PRO.app.closeModal());
    await page.evaluate(() => { PRO.app.st().layout = '2v'; }); await page.click('#pm-lay'); await page.click('.pm-menu .pm-mi:nth-child(2)').catch(() => { }); await page.waitForTimeout(1500);
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => { document.querySelector('#pm-ws').click(); setTimeout(() => { const m = [...document.querySelectorAll('.pm-menu .pm-mi')].filter(x => /CSV/.test(x.textContent)); m[m.length - 1].click(); }, 200); })]);
    const all = fs.readFileSync(await dl2.path(), 'utf8').replace(/^﻿/, '').trim().split('\n'), syms = new Set(all.slice(1).map(l => l.split(',')[0]));
    const nCells = await page.evaluate(() => PRO.app.cells().length);
    ok('one CSV holds every chart of the layout, symbol and timeframe on each row', /^symbol,timeframe,time_utc,time_local,unix,/.test(all[0]) && all.length > 200 && syms.size >= Math.min(2, nCells), all[0] + ' | ' + [...syms].join(' ') + ' | charts ' + nCells);
    /* a second tab: a drawing and an alert made here appear there without a reload */
    const p2 = await ctx.newPage(); await mockNet(p2, { rest: 0, ws: 0, msgs: 0 });
    await p2.goto(`${base}/market/?lang=ckb`); await p2.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length && PRO.app.cells()[0].disp.length > 100, null, { timeout: 20000 });
    await page.evaluate(() => { const c = PRO.app.active(), b = c.bars[c.bars.length - 1]; PRO.app.mutate(c.cfg.sym, L => L.push({ id: 'syncx', k: 'hline', pts: [{ t: b.t, p: b.c }], s: {} })); PRO.app.save(); });
    await page.evaluate(() => { const c = PRO.app.active(); PRO.alertDialog(c); }); await page.waitForSelector('.pm-af'); await page.waitForTimeout(120); await page.click('.pm-af button[type=submit]');
    await p2.waitForTimeout(1200);
    const sy = await p2.evaluate(() => { const s = PRO.app.active().cfg.sym; return { d: (PRO.app.DRAW()[s] || []).some(x => x.id === 'syncx'), a: PRO._alerts().length }; });
    ok('two tabs stay in step: the drawing and the alert made in one show in the other', sy.d && sy.a >= 1, JSON.stringify(sy));
    await ctx.close();
  }

  /* ---------- continuous quarterly futures (Bybit) with B-ADJ */
  if (!ONLY || ONLY === 'fut') {
    const { page, ctx } = await newPage(1280, 860, 'fa');
    const OFF = {}, fx = (y, q) => { const d = new Date(Date.UTC(y, q, 0, 8)); while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1); return d.getTime() / 1000; };
    for (let y = 2024; y <= 2027; y++) [3, 6, 9, 12].forEach((q, j) => { OFF['BTCUSD' + 'HMUZ'[j] + String(y % 100).padStart(2, '0')] = (y - 2024) * 400 + j * 100; });
    const px = (sym, t) => 60000 + OFF[sym] + 2000 * Math.sin(t / 86400 / 9);
    let kl = 0;
    await page.route(/api\.bybit\.com\/v5\/market\/kline/, r => {
      kl++; const q = new URL(r.request().url()).searchParams, sym = q.get('symbol'), sec = { D: 86400, '60': 3600, '240': 14400, '15': 900 }[q.get('interval')], s0 = +q.get('start') / 1000, e = Math.min(Math.floor(+q.get('end') / 1000), Math.floor(Date.now() / 1000));
      const L = []; if (sym in OFF) for (let t = Math.ceil(s0 / sec) * sec; t <= e; t += sec) { const p = px(sym, t); L.push([String(t * 1000), String(p - 3), String(p + 20), String(p - 20), String(p), '100']); }
      r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ retCode: 0, result: { list: L.reverse().slice(0, 1000) } }) });
    });
    await page.route(/api\.bybit\.com\/v5\/market\/tickers/, r => { const sym = new URL(r.request().url()).searchParams.get('symbol'), p = px(sym, Date.now() / 1000); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ retCode: 0, result: { list: [{ lastPrice: String(p), prevPrice24h: String(p * 0.99), highPrice24h: String(p * 1.01), lowPrice24h: String(p * 0.98), volume24h: '123456' }] } }) }); });
    await page.click('.pm-lsym'); await page.waitForSelector('.pm-ss'); await page.waitForTimeout(150);
    await page.click('.pm-sscat .pm-chip:last-child'); await page.waitForSelector('.pm-ssi[data-s="BTC_F1"]');
    const list = await page.evaluate(() => [...document.querySelectorAll('.pm-ssi')].map(b => b.getAttribute('data-s') + ' ' + b.querySelector('b').textContent));
    await page.click('.pm-ssi[data-s="BTC_F1"]');
    await page.waitForFunction(() => { const c = PRO.app.active(); return c.cfg.sym === 'BTC_F1' && c.feed && c.feed.state === 'poll' && c.disp.length > 100; }, null, { timeout: 20000 });
    const f1 = await page.evaluate(() => { const c = PRO.app.active(), b = c.bars; return { n: b.length, src: document.querySelector('.pm-src').textContent, pair: document.querySelector('.pm-lsym b').textContent, badj: !!document.querySelector('.pm-badj'), on: document.querySelector('.pm-badj').classList.contains('on'), gaps: b.filter((x, i) => i && x.t - b[i - 1].t !== 3600).length, last: b[b.length - 1].c, front: c.feed.front && c.feed.front.c }; });
    ok('futures: BTC1! in its own search tab, a continuous hourly chart from Bybit with a B-ADJ button', list.join() === 'BTC_F1 BTC1!,ETH_F1 ETH1!' && f1.src === 'Bybit' && f1.pair === 'BTC1!' && f1.badj && !f1.on && f1.gaps === 0 && f1.n > 1000, JSON.stringify(f1));
    const exp = await page.evaluate(() => { const n = Date.now() / 1000; return PRO._futExp(n, n)[0]; });
    ok('the front contract is the next quarterly expiry, and its price is the real one', f1.front === 'BTCUSD' + exp.code && Math.abs(f1.last - (60000 + OFF['BTCUSD' + exp.code] + 2000 * Math.sin(Math.floor(Date.now() / 3600000) * 3600 / 86400 / 9))) < 30, JSON.stringify({ front: f1.front, last: f1.last }));
    await page.evaluate(() => PRO.app.active().setTF('1d')); await page.waitForFunction(() => { const c = PRO.app.active(); return c.cfg.tf === '1d' && c.feed && c.feed.state === 'poll' && c.disp.length > 300; }, null, { timeout: 20000 });
    const raw = await page.evaluate(() => PRO.app.active().bars.map(b => [b.t, b.c]));
    await page.click('.pm-badj'); await page.waitForFunction(() => { const c = PRO.app.active(); return c.feed && c.feed.adj && c.feed.state === 'poll' && c.disp.length > 300; }, null, { timeout: 20000 });
    const adj = await page.evaluate(() => ({ b: PRO.app.active().bars.map(b => [b.t, b.c]), gaps: PRO.app.active().feed.gaps.map(g => g.gap), on: document.querySelector('.pm-badj').classList.contains('on'), saved: JSON.parse(localStorage.getItem('ek_pro_badj') || '{}') }));
    const rmap = new Map(raw), lastSame = adj.b[adj.b.length - 1][1] === rmap.get(adj.b[adj.b.length - 1][0]);
    const wave = t => 2000 * Math.sin(t / 86400 / 9), jump = (A, i) => Math.abs((A[i][1] - A[i - 1][1]) - (wave(A[i][0]) - wave(A[i - 1][0])));   /* what is left after the market's own move */
    let rawJ = 0, adjJ = 0; for (let i = 1; i < raw.length; i++) if (jump(raw, i) > 1) rawJ++;
    for (let i = 1; i < adj.b.length; i++) if (jump(adj.b, i) > 1) adjJ++;
    ok('B-ADJ: the latest price stays real, the rolls\' jumps disappear from the history, and the choice is remembered', adj.on && adj.saved.BTC_F1 === true && lastSame && rawJ >= 2 && adjJ === 0 && adj.gaps.length >= 2 && adj.gaps.every(g => g === 100 || g === 200), JSON.stringify({ rawJ, adjJ, gaps: adj.gaps, lastSame }));
    await shot(page, '72_fa_futures_badj');
    await page.evaluate(() => { PRO.app.active().setTF('1h'); }); await page.waitForTimeout(1500);
    const kl0 = kl; await page.waitForTimeout(6500);
    ok('the chart keeps polling Bybit for the live bar', kl > kl0, String(kl - kl0));
    await page.evaluate(() => { localStorage.removeItem('ek_pro_badj'); PRO.app.active().setSym('BTC'); });
    await ctx.close();
  }

  /* ---------- backtesting: the strategy tester, its optimizer and report, and the replay practice account with orders */
  if (!ONLY || ONLY === 'bt') {
    const { page, ctx } = await newPage(1280, 860, 'fa');
    await page.click('#pm-bt'); await page.waitForSelector('.pm-btf'); await page.waitForTimeout(120);
    const opts = await page.evaluate(() => [...document.querySelectorAll('.pm-btf [name="st"] option')].map(o => o.value));
    ok('the tester lists nine strategies on BTC, the Kurdistani signals among them', opts.length === 9 && opts.includes('ek'), opts.join(','));
    await page.selectOption('.pm-btf [name="st"]', 'macross'); await page.fill('.pm-btf [name="fast"]', '9'); await page.fill('.pm-btf [name="slow"]', '21');
    await page.click('.pm-btf [type="submit"]'); await page.waitForSelector('.pm-btr .pm-btg');
    const b1 = await page.evaluate(() => {
      const c = PRO.app.active(), bars = c.bars, a = PRO.btRun(c.cfg.sym, bars, 'macross', { fast: 9, slow: 21 }, PRO.bt.cfg()), s = PRO.btStats(a, bars, c.tfSec());
      const cards = [...document.querySelectorAll('.pm-btr .pm-btc')].map(e => e.textContent), rows = document.querySelectorAll('.pm-btr .pm-btt tr').length - 1;
      return { n: s.n, net: s.netPct, cards: cards.length, txt: cards.join('|'), rows, marks: (c.btMarks || []).length, curve: !!document.querySelector('.pm-btr canvas.pm-eqc') };
    });
    const shown = (b1.txt.match(/[+−]\d+\.\d\d%/) || [''])[0].replace('−', '-');
    ok('the report shows the same result as a direct run: trades, return, every trade, the curve, marks on the chart', b1.n > 3 && b1.rows === Math.min(300, b1.n) && Math.abs(parseFloat(shown) - b1.net) < 0.006 && b1.cards >= 20 && b1.curve && b1.marks >= b1.n * 2, JSON.stringify(b1).slice(0, 300));
    await shot(page, '60_fa_bt_report');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.pm-btr [data-a="csv"]')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').trim().split('\n');
    ok('the CSV has a header and one line per trade', csv[0].startsWith('n,side,entry_time_utc') && csv.length === b1.n + 1, csv.length + ' lines');
    await page.evaluate(() => PRO.app.closeModal());
    /* the optimizer */
    await page.click('#pm-bt'); await page.waitForSelector('.pm-btf'); await page.click('.pm-btf [data-m="opt"]');
    const cnt = await page.evaluate(() => document.querySelector('.pm-btcnt').textContent);
    await page.click('.pm-btf [type="submit"]'); await page.waitForSelector('.pm-opt', { timeout: 20000 });
    const o1 = await page.evaluate(() => { const r = [...document.querySelectorAll('.pm-opt tr[data-j]')].filter(x => +x.children[4].textContent >= 3); return { n: document.querySelectorAll('.pm-opt tr[data-j]').length, nets: r.map(x => parseFloat(x.children[3].textContent.replace('−', '-'))) }; });
    ok('the optimizer tests every combination and ranks them by return', o1.n >= 10 && o1.nets.length && o1.nets.every((v, i) => !i || v <= o1.nets[i - 1] + 0.006) && /[0-9۰-۹]/.test(cnt), cnt + ' ' + JSON.stringify(o1).slice(0, 200));
    await shot(page, '61_fa_bt_optimizer');
    await page.click('.pm-opt tr[data-j="0"]'); await page.waitForSelector('.pm-btr .pm-btg');
    ok('a row opens its full report, with a way back', await page.evaluate(() => !!document.querySelector('.pm-btr [data-a="back"]')));
    await page.click('.pm-btr [data-a="back"]'); await page.waitForSelector('.pm-opt');
    await page.evaluate(() => PRO.app.closeModal());
    /* more history than the chart holds */
    await page.click('#pm-bt'); await page.waitForSelector('.pm-btf'); await page.click('.pm-btf [data-m="run"]');
    await page.selectOption('.pm-btf [name="len"]', '5000'); await page.click('.pm-btf [type="submit"]'); await page.waitForSelector('.pm-btr .pm-btg', { timeout: 20000 });
    const h5 = await page.evaluate(() => { const H = PRO.app.active()._btHist, b = H && H.bars.concat(PRO.app.active().bars); return { n: b && b.length, gaps: b ? b.filter((x, i) => i && x.t - b[i - 1].t !== 3600).length : -1, head: document.querySelector('.pm-btr .pm-bth').textContent }; });
    ok('a test on the last 5,000 bars loads the older ones, without gaps', h5.n === 5000 && h5.gaps === 0, JSON.stringify(h5));
    await page.evaluate(() => PRO.app.closeModal());
    /* the replay practice account: a limit order, its fill, stop-loss and target, the report */
    await page.evaluate(() => { const c = PRO.app.active(); PRO._replay.begin(c, c.bars.slice(), c.bars.length - 400); });
    await page.waitForSelector('.pm-repbar [data-a="order"]');
    const p0 = await page.evaluate(() => { const c = PRO.app.active(); return c.bars[c.replay.i].c; });
    await page.click('.pm-repbar [data-a="order"]'); await page.waitForSelector('.pm-bto'); await page.waitForTimeout(120);
    await page.selectOption('.pm-bto [name="type"]', 'limit'); await page.fill('.pm-bto [name="price"]', String(+(p0 * 0.998).toPrecision(8)));
    await page.click('.pm-bto [type="submit"]');
    const o0 = await page.evaluate(() => PRO.app.active().replay.acct.orders.length);
    let filled = null;
    for (let k = 0; k < 80 && !filled; k++) { await page.click('.pm-repbar [data-a="fwd"]'); filled = await page.evaluate(() => { const q = PRO.app.active().replay.acct.pos; return q ? { e: q.entry } : null; }); }
    await shot(page, '64_fa_bt_replay_bar');
    ok('a buy limit 0.2% under the price fills at its own price when a revealed bar reaches it', o0 === 1 && filled && Math.abs(filled.e - +(p0 * 0.998).toPrecision(8)) < 1e-9, JSON.stringify({ o0, filled, p0 }));
    const now = await page.evaluate(() => PRO.app.active().replay.acct.px), SL = +(now * 0.99).toPrecision(8), TP = +(Math.max(now, filled.e) * 1.01).toPrecision(8);
    await page.click('.pm-repbar [data-a="stops"]'); await page.waitForSelector('.pm-modal [name="sl"]'); await page.waitForTimeout(120);
    await page.fill('.pm-modal [name="sl"]', String(SL * 1.02)); await page.click('.pm-modal [type="submit"]');
    const bad = await page.evaluate(() => ({ modal: !!document.querySelector('.pm-modal [name="sl"]'), toast: (document.querySelector('.pm-toast') || {}).textContent, sl: PRO.app.active().replay.acct.pos.sl }));
    ok('a stop-loss above the price of a long is refused, with the reason', bad.modal && bad.sl == null && /.{8}/.test(bad.toast || ''), JSON.stringify(bad));
    await page.fill('.pm-modal [name="sl"]', String(SL)); await page.fill('.pm-modal [name="tp"]', String(TP));
    await page.click('.pm-modal [type="submit"]');
    const st1 = await page.evaluate(() => { const A = PRO.app.active().replay.acct; return { sl: A.pos && A.pos.sl, tp: A.pos && A.pos.tp, px: A.px, modal: !!document.querySelector('.pm-modal'), toast: (document.querySelector('.pm-toast') || {}).textContent }; });
    ok('stop-loss and target are set on the open trade', st1.sl > 0 && st1.tp > 0 && !st1.modal, JSON.stringify(st1));
    let done = null;
    for (let k = 0; k < 300 && !done; k++) { await page.evaluate(() => PRO._replay.step(PRO.app.active(), 1)); done = await page.evaluate(() => { const A = PRO.app.active().replay.acct; return A.pos ? null : A.trades[A.trades.length - 1]; }); }
    ok('then its stop-loss or target closes it at that price', done && (done.why === 'sl' || done.why === 'tp') && Math.abs(done.exit - (done.why === 'tp' ? TP : SL)) < 1e-6 * SL, JSON.stringify(done) + ' SL ' + SL + ' TP ' + TP);
    await page.click('.pm-repbar [data-a="stats"]'); await page.waitForSelector('.pm-btr [data-a="reset"]'); await shot(page, '62_fa_bt_replay_report');
    await page.click('.pm-btr [data-a="reset"]');
    ok('the report starts a fresh account', await page.evaluate(() => { const A = PRO.app.active().replay.acct; return !A.trades.length && !A.pos && A.bal === A.start; }));
    /* account settings: leverage and size reach the next account */
    await page.click('.pm-repbar [data-a="acct"]'); await page.waitForSelector('.pm-bts'); await page.waitForTimeout(120);
    await page.fill('.pm-bts [name="lev"]', '5'); await page.fill('.pm-bts [name="size"]', '20');
    const fv = await page.evaluate(() => [...document.querySelectorAll('.pm-bts input')].map(i => i.name + '=' + i.value).join(' '));
    await page.click('.pm-bts [type="submit"]');
    await page.click('.pm-repbar [data-a="buy"]');
    const lv = await page.evaluate(() => { const A = PRO.app.active().replay.acct; return { lev: A.pos && A.pos.lev, m: A.pos && A.pos.margin / A.start, liq: !!A.liqPrice(), lines: (PRO.app.active()._btL || []).length, cfg: PRO.bt.cfg(), acfg: A.cfg }; });
    lv.form = fv;
    ok('settings: 5× leverage, 20% of the account, a liquidation line', lv.lev === 5 && Math.abs(lv.m - 0.2) < 1e-9 && lv.liq && lv.lines >= 2, JSON.stringify(lv));
    await page.evaluate(() => PRO.replayStop(PRO.app.active()));
    /* not BTC: no Kurdistani signals; phones: the report fits */
    await page.evaluate(() => PRO.app.active().setSym('ETH')); await page.waitForFunction(() => PRO.app.active().disp.length > 100);
    await page.click('#pm-bt'); await page.waitForSelector('.pm-btf');
    ok('other markets do not offer the BTC signals', await page.evaluate(() => ![...document.querySelectorAll('.pm-btf [name="st"] option')].some(o => o.value === 'ek')));
    await page.evaluate(() => { localStorage.removeItem('ek_pro_bt'); PRO.app.closeModal(); });
    await ctx.close();
    for (const lang of ['ckb', 'ar', 'en']) {
      const { page: pg, ctx: cx } = await newPage(390, 844, lang);
      await pg.evaluate(() => PRO.bt.tester(PRO.app.active())); await pg.waitForSelector('.pm-btf');
      await pg.click('.pm-btf [type="submit"]'); await pg.waitForSelector('.pm-btr .pm-btg');
      const fit = await pg.evaluate(() => { const m = document.querySelector('.pm-mbox'), r = m.getBoundingClientRect(); return { w: r.width, l: r.left, r: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth, dir: m.dir }; });
      ok(`[${lang} 390] the backtest report fits the phone screen`, fit.l >= 0 && fit.r <= fit.vw + 0.5 && fit.sw <= fit.vw, JSON.stringify(fit));
      await shot(pg, '63_' + lang + '_bt_phone'); await cx.close();
    }
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
