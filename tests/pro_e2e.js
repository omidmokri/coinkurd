/* End-to-end check of /market/ in headless Chrome with Binance mocked in its real formats.
   Usage: node tests/pro_e2e.js [outdir]     (serves the repo itself on a free port)
   Binance REST (klines, ticker/24hr, ticker/price) and the combined WebSocket stream are answered here with a
   deterministic synthetic market; OKX and fonts are blocked, so the fallbacks run too. Exits 1 on any JS error. */
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..'), OUT = process.argv[2] || '/tmp/pro_e2e';
/* the site's own strings, read in a sandbox, so a check can compare what the page shows with the text it should show */
const PRO_T = (() => { const vm = require('vm'), fs = require('fs'), sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/pro/i18n.js'), 'utf8'), sb); const S = sb.window.PRO.STR; return (l, k) => (S[l] && S[l][k]) || S.en[k]; })();
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
  /* the bar still open closes at the price of now, as on Binance (and as the socket below sends it) — not at its end */
  const b = out[out.length - 1];
  if (b && b[6] >= Date.now()) { const c = px(sym, Math.floor(Date.now() / 1000)); b[4] = c.toFixed(8); b[2] = Math.max(+b[2], c).toFixed(8); b[3] = Math.min(+b[3], c).toFixed(8); }
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
    if (p === 'ping') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });   /* data.js probes the host once before it uses it */
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
    const nowS = Math.floor(Date.now() / 1000), iso = t => new Date(t * 1000).toISOString(), h5 = Math.floor(nowS / 3600) * 3600 - 5 * 3600;   /* two headlines inside one hour, whatever the minute now */
    let reel = [{ id: 'r1', at: iso(nowS - 3000), url: 'https://example.com/1', source: 'Src', coins: ['BTC'], cat: 'news', t: { en: 'Old one', fa: 'خبر قدیمی', ckb: 'کۆن', ar: 'قديم' } }];
    await ctxN.route(/\/data\/news\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [
      { id: 'a', title: 'BTC one', tfa: 'بیت‌کوین یک', url: 'https://example.com/a', source: 'S1', date: iso(h5 + 60), coins: ['BTC'], category: 'regulation' },
      { id: 'b', title: 'BTC two', tfa: 'بیت‌کوین دو', url: 'https://example.com/b', source: 'S2', date: iso(h5 + 900), coins: ['BTC', 'ETH'], category: 'news' },
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
    ok('[ckb] help: thirteen guide topics (your currency and the languages added), the keyboard, and support links (group, admin, class)', hp.n === 13 && hp.keys === 8 && hp.links.join() === 'https://t.me/Coin_Kurd_Group,https://t.me/Kurdistan_Coin,/class/' && hp.dir === 'rtl', JSON.stringify(hp));
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

  /* ---------- prices in the visitor's currency: the site's reference rates (data/fx, mocked here in their real format) */
  const FXD0 = Date.UTC(2017, 0, 2) / 1000, DAY = 86400, TODAY0 = Math.floor(Date.now() / 1000 / DAY) * DAY;
  const FXS = {                                                             /* currency: source, first day, value of day i */
    EUR: ['ecb', FXD0, i => 0.9 + 0.0001 * (i % 100)], JPY: ['ecb', FXD0, i => 150 + 0.01 * (i % 50)],
    TRY: ['xapi', Date.UTC(2024, 2, 2) / 1000, i => 30 + 0.01 * i], VND: ['xapi', Date.UTC(2024, 2, 2) / 1000, i => 25000 + i]
  };
  const fxDay = t => new Date(t * 1000).toISOString().slice(0, 10);
  function fxFile(c) {                                                      /* the history file ends a week ago (rewritten weekly) */
    const [src, a, f] = FXS[c], n = Math.round((TODAY0 - 8 * DAY - a) / DAY) + 1, v = [];
    for (let i = 0; i < n; i++) v.push(+f(i).toFixed(6));
    return { c, src, from: fxDay(a), to: fxDay(a + (n - 1) * DAY), v };
  }
  function fxLatest() {                                                     /* the last 14 days of each: they overlap the file's end */
    const from = TODAY0 - 13 * DAY, r = {};
    Object.keys(FXS).forEach(c => { const [src, a, f] = FXS[c], row = [src]; for (let k = 0; k < 14; k++) row.push(+f(Math.round((from + k * DAY - a) / DAY)).toFixed(6)); r[c] = row; });
    return { at: new Date().toISOString(), usdt: 0.999, from: fxDay(from), to: fxDay(TODAY0), r };
  }
  async function mockFx(page) {
    await page.route(/\/data\/fx\/[A-Za-z]+\.json/, r => {
      const m = /\/data\/fx\/([A-Za-z]+)\.json/.exec(r.request().url())[1];
      if (m === 'latest') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fxLatest()) });
      if (FXS[m]) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fxFile(m)) });
      return r.fulfill({ status: 404, body: 'nf' });
    });
  }
  async function zonePage(vw, vh, tz, url, tag) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: tz, serviceWorkers: 'block' });
    const page = await ctx.newPage(), stats = { rest: 0, ws: 0, msgs: 0 };
    page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(`[${tag}] console: ${m.text()}`); });
    await mockNet(page, stats); await mockFx(page);
    await page.addInitScript(() => { try { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1'); } } catch (e) { } });
    await page.goto(base + url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length && PRO.app.cells()[0].disp.length > 100, null, { timeout: 25000 }).catch(() => { });
    await page.waitForTimeout(1200);
    return { page, ctx, stats };
  }
  const waitSym = (page, s) => page.waitForFunction(x => { const c = PRO.app.active(); return c.cfg.sym === x && c.disp.length > 20; }, s, { timeout: 15000 }).catch(() => { });
  /* every bar of a coin in a currency = the same Binance bar × the rate at the middle of the bar */
  const conv = page => page.evaluate(() => {
    const c = PRO.app.active(), F = c.feed, B = F.bf ? F.bf.bars : [], sec = c.tfSec(), bad = [];
    const byT = {}; B.forEach(b => { byT[b.t] = b; });
    c.bars.slice(-300).forEach(b => { const u = byT[b.t], r = F.R.at(b.t + sec / 2); if (!u || !r || Math.abs(b.c - u.c * r) > 1e-9 * b.c || Math.abs(b.h - u.h * r) > 1e-9 * b.h) bad.push(b.t); });
    return { n: c.bars.length, bad: bad.length, src: F.src, srcl: (c.el.querySelector('.pm-src') || {}).textContent, sym: c.cfg.sym, prec: c.prec(), last: c.bars[c.bars.length - 1].c, usd: (B[B.length - 1] || {}).c };
  });

  if (!ONLY || ONLY === 'fx') {
    const { page, ctx } = await zonePage(1280, 860, 'Europe/Berlin', '/market/?lang=en', 'fx');
    const s0 = await page.evaluate(() => ({ cur: PRO.fx.cur(), sym: PRO.app.active().cfg.sym, btn: document.querySelector('#pm-cur').textContent, w: (document.querySelector('.pm-spanel select') || {}).value }));
    ok('a visitor in Berlin starts in euros: BTC/EUR, the euro on the currency button, «coins in EUR» open', s0.cur === 'EUR' && s0.sym === 'BTC_EUR' && /EUR/.test(s0.btn) && s0.w === 'loc', JSON.stringify(s0));
    await waitSym(page, 'BTC_EUR');
    const c1 = await conv(page);
    ok('BTC in euros: every bar = the Binance bar × the reference rate at its middle; source named', c1.src === 'fiat' && c1.n > 300 && c1.bad === 0 && /Binance × ECB/.test(c1.srcl), JSON.stringify(c1));
    /* the rate itself, hand-checked: today and a week ago come from latest.json, the day before from the file */
    const r1 = await page.evaluate(([d0]) => { const R = PRO.fx.rate('EUR'), end = t => t + 86400; return { a: R.at(end(d0 - 20 * 86400)), b: R.at(end(d0 - 3 * 86400)), mid: R.at(end(d0 - 3 * 86400) - 43200), to: R.to, n: R.pts.length }; }, [TODAY0]);
    const f = FXS.EUR[2], iA = Math.round((TODAY0 - 20 * DAY - FXD0) / DAY), iB = Math.round((TODAY0 - 3 * DAY - FXD0) / DAY);
    ok('the rate: a day from the history file, a day from latest.json, half a day between them a straight line', Math.abs(r1.a - f(iA)) < 1e-9 && Math.abs(r1.b - f(iB)) < 1e-9 && Math.abs(r1.mid - (f(iB) + f(iB - 1)) / 2) < 1e-9 && r1.to === fxDay(TODAY0), JSON.stringify(r1));
    /* a currency whose rates start in March 2024: no bar before that (nothing extrapolated) */
    await page.evaluate(() => { PRO.app.active().setTF('1w'); PRO.app.applySym('BTC_VND'); }); await waitSym(page, 'BTC_VND');
    const v1 = await page.evaluate(() => { const b = PRO.app.active().bars; return { first: b[0].t, n: b.length, prec: PRO.app.active().prec() }; });
    ok('BTC in dong (rates since 2 March 2024): no bar before the first known day, no decimals', v1.first >= Date.UTC(2024, 1, 26) / 1000 && v1.n > 50 && v1.prec === 0, JSON.stringify(v1));
    /* tether in euros: the rate as a chart, one value a day */
    await page.evaluate(() => { PRO.app.active().setTF('1d'); PRO.app.applySym('USDT_EUR'); }); await waitSym(page, 'USDT_EUR');
    const u1 = await page.evaluate(() => { const c = PRO.app.active(), b = c.bars; return { n: b.length, last: b[b.length - 1].c, t: b[b.length - 1].t, srcl: c.el.querySelector('.pm-src').textContent, pair: c.el.querySelector('.pm-lsym').textContent }; });
    ok('tether in euros: one bar a day from the reference rate (ECB), named USDT/EUR', u1.n > 3000 && Math.abs(u1.last - FXS.EUR[2](Math.round((TODAY0 - FXD0) / DAY))) < 1e-9 && u1.t === TODAY0 && u1.srcl === 'ECB' && /USDT\/EUR/.test(u1.pair), JSON.stringify(u1));
    await page.evaluate(() => { PRO.app.active().setTF('1h'); PRO.app.applySym('BTC_EUR'); }); await waitSym(page, 'BTC_EUR');
    /* the currency menu: the visitor's own rate, per tether and per dollar, and back */
    await page.click('#pm-cur'); await page.waitForTimeout(800);
    const menu = await page.evaluate(() => ({ rows: document.querySelectorAll('.pm-cui').length, first: [...document.querySelectorAll('.pm-cui b')].slice(0, 4).map(b => b.textContent).join(' '), ref: document.querySelector('.pm-cur1 small').textContent, sug: !!document.querySelector('.pm-cui[data-c="EUR"] .pm-sug') }));
    ok('the currency menu: the current one first, the time zone’s marked, USDT and the toman, then every rate in latest.json', menu.rows >= 6 && /^EUR/.test(menu.first) && /USDT/.test(menu.first) && /1 USDT = 0\.9\d* EUR · ECB/.test(menu.ref) && menu.sug, JSON.stringify(menu));
    await shot(page, '60_fx_menu');
    await page.fill('.pm-own input', '0.5'); await page.selectOption('.pm-own select', 'USDT'); await page.click('.pm-own button[type=submit]'); await page.waitForTimeout(900);
    const o1 = await conv(page);
    const o1b = await page.evaluate(() => { const c = PRO.app.active(), u = c.feed.bf.bars, b = c.bars; return { r: b[b.length - 5].c / u[u.length - 5].c, dot: !!document.querySelector('#pm-cur .pm-owndot'), srcl: c.el.querySelector('.pm-src').textContent }; });
    ok('your own rate (0.5 per USDT): every bar, the whole history, × 0.5; the page says «your rate»', o1.bad === 0 && Math.abs(o1b.r - 0.5) < 1e-12 && o1b.dot && /your rate/.test(o1b.srcl), JSON.stringify([o1, o1b]));
    const ref = await page.evaluate(() => { const t = PRO.tickers.d.USDT_EUR; return t ? t.c : null; });
    ok('…while tether’s own price in the list stays the reference rate (a typed rate has no market behind it)', ref > 0.89 && ref < 0.92, ref);
    await page.fill('.pm-own input', '0.5'); await page.selectOption('.pm-own select', 'USD'); await page.click('.pm-own button[type=submit]'); await page.waitForTimeout(900);
    const o2 = await page.evaluate(() => { const c = PRO.app.active(), u = c.feed.bf.bars, b = c.bars; return b[b.length - 5].c / u[u.length - 5].c; });
    ok('…per dollar: × 0.5 × the dollar value of one tether (0.999)', Math.abs(o2 - 0.5 * 0.999) < 1e-12, o2);
    await page.click('.pm-own [data-a="ref"]'); await page.waitForTimeout(1200);
    const o3 = await conv(page);
    ok('…and back to the reference rate', o3.bad === 0 && /ECB/.test(o3.srcl) && !(await page.evaluate(() => !!document.querySelector('#pm-cur .pm-owndot'))), JSON.stringify(o3));
    /* another currency: the chart follows, lists follow */
    await page.click('.pm-cui[data-c="TRY"]'); await page.waitForTimeout(400); await page.keyboard.press('Escape');
    await waitSym(page, 'BTC_TRY'); await page.waitForTimeout(1500);
    const t1 = await conv(page);
    const t1b = await page.evaluate(() => ({ list: [...document.querySelectorAll('.pm-spanel select option')].map(o => o.textContent).join('|'), rows: [...document.querySelectorAll('.pm-wr[data-s]')].slice(0, 3).map(r => r.getAttribute('data-s') + '=' + r.querySelector('.pm-wc').textContent) }));
    ok('choosing the lira moves BTC/EUR to BTC/TRY (exchange-api) and the list to «coins in TRY» with live prices (millions of lira: no decimals)', t1.sym === 'BTC_TRY' && t1.bad === 0 && /exchange-api/.test(t1.srcl) && /Coins in TRY/.test(t1b.list) && t1b.rows.length === 3 && t1b.rows[0].indexOf('USDT_TRY=') === 0 && /^BTC_TRY=\d{1,3}(,\d{3})+$/.test(t1b.rows[1]), JSON.stringify([t1, t1b]));
    await shot(page, '61_fx_try');
    /* market watch in the currency */
    await page.evaluate(() => PRO.screener()); await page.waitForTimeout(400);
    await page.click('.pm-scr [data-m="loc"]'); await page.waitForTimeout(2500);
    const sc = await page.evaluate(() => [...document.querySelectorAll('.pm-scrt tbody tr[data-s]')].slice(0, 3).map(r => r.getAttribute('data-s') + '=' + r.children[2].textContent));
    ok('market watch «Crypto (TRY)»: every coin with its price in lira', sc.length === 3 && sc.every(x => /^[A-Z0-9]+_TRY=[\d,.]+$/.test(x)), sc.join(' | '));
    await page.keyboard.press('Escape');
    /* the backtest starts with about 10,000 USDT in lira, as a round number */
    const bal = await page.evaluate(() => { PRO.bt.tester(PRO.app.active()); const f = [...document.querySelectorAll('.pm-mbox label, .pm-mbox .pm-field, .pm-mbox')].map(e => e.textContent).join(' '); return f; });
    ok('the strategy tester counts in lira', /TRY/.test(bal), bal.slice(0, 200));
    await page.keyboard.press('Escape');
    /* reload: a chart in a currency and a chart in toman stay (they used to be sent back to BTC on every visit) */
    await page.evaluate(() => { PRO.app.setActive(0); }); await page.evaluate(() => PRO.app.symbolSearch && 0);
    await page.evaluate(() => { const st = PRO.app.st(); st.layout = '2v'; st.charts = [st.charts[0], JSON.parse(JSON.stringify(st.charts[0]))]; st.charts[1].sym = 'BTC_IRT'; PRO.app.save(); });
    await page.waitForTimeout(600); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length === 2, null, { timeout: 20000 }).catch(() => { }); await page.waitForTimeout(4000);
    const rl = await page.evaluate(() => PRO.app.cells().map(c => c.cfg.sym).join());
    ok('after a reload BTC/TRY and BTC in toman are still there', rl === 'BTC_TRY,BTC_IRT', rl);
    /* the yen: no decimals */
    await page.evaluate(() => PRO.fx.set('JPY')); await waitSym(page, 'BTC_JPY'); await page.waitForTimeout(800);
    const j1 = await conv(page);
    ok('in yen: no decimals, every bar converted', j1.prec === 0 && j1.bad === 0 && j1.sym === 'BTC_JPY', JSON.stringify(j1));
    await shot(page, '62_fx_jpy');
    /* the dollar: plain USDT pairs again */
    await page.evaluate(() => PRO.fx.set('USD')); await waitSym(page, 'BTC'); await page.waitForTimeout(600);
    const d1 = await page.evaluate(() => ({ sym: PRO.app.cells()[0].cfg.sym, src: PRO.app.cells()[0].feed.src, list: [...document.querySelectorAll('.pm-spanel select option')].map(o => o.value).join(), sel: document.querySelector('.pm-spanel select').value, rows: document.querySelectorAll('.pm-wr[data-s]').length }));
    ok('USD means no conversion: back to BTC/USDT; the «coins in …» list gives way to «my watchlist»', d1.sym === 'BTC' && d1.src === 'binance' && d1.list.indexOf('loc') < 0 && d1.sel === 'site' && d1.rows > 3, JSON.stringify(d1));
    await ctx.close();
  }

  /* ---------- the 43 other languages: one page each (/market/<code>/), built here from a fake translation cache */
  if (!ONLY || ONLY === 'gm') for (const [vw, vh, lang] of [[1280, 860, 'en'], [390, 800, 'fa']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const D0 = Math.floor(Date.now() / 86400000) * 86400 - 86400, N = 400, cl = i => 5000 + i * 2 + (i % 7);
    const bars = []; for (let i = 0; i < N; i++) { const t = D0 - (N - 1 - i) * 86400, c = cl(i), o = i ? cl(i - 1) : c; bars.push([t, o, Math.max(o, c) + 3, Math.min(o, c) - 3, c, 0]); }
    await page.route(/\/data\/markets\/[A-Za-z]+\.json/, r => {
      const id = new URL(r.request().url()).pathname.split('/').pop().replace('.json', '');
      if (id === 'index') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: 'SPX', status: 'ok', src: 'Yahoo Finance', last: [D0, cl(N - 1)], prev: cl(N - 2) }] }) });
      if (id !== 'SPX') return r.fulfill({ status: 404, body: '' });
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'SPX', status: 'ok', src: { id: 'yahoo', sym: '^GSPC', label: 'Yahoo Finance' }, bars }) });
    });
    /* a real click: the search, the indices tab, the S&P 500 row */
    await page.click(vw > 600 ? '#pm-sym' : '.pm-cell .pm-lsym'); await page.waitForTimeout(400);
    const chips = await page.evaluate(() => [...document.querySelectorAll('.pm-sscat .pm-chip')].map(b => b.textContent));
    const gi = chips.length; await page.click(`.pm-sscat .pm-chip:nth-child(${gi})`); await page.waitForTimeout(500);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.pm-ssl [data-s]')].map(b => b.getAttribute('data-s')));
    ok(`[${lang} ${vw}] search: the last tab lists the indices, DXY and the US stocks`, rows.includes('GM_SPX') && rows.includes('GM_DXY') && rows.includes('GM_NVDA') && rows.length === 11, chips.slice(-1) + ' ' + rows.join(','));
    await page.click('.pm-ssl [data-s="GM_SPX"]');
    await page.evaluate(() => PRO.app.active().setTF('1d')); await waitSym(page, 'GM_SPX');
    const d1 = await page.evaluate(() => { const c = PRO.app.active(), b = c.bars; return { n: b.length, c: b[b.length - 1].c, t: b[b.length - 1].t, st: c.feed.state, srcl: c.el.querySelector('.pm-src').textContent, pair: c.el.querySelector('.pm-lsym').textContent }; });
    ok(`[${lang} ${vw}] S&P 500 daily: every bar from the site's file, last close exact, source named`, d1.n === N && d1.c === cl(N - 1) && d1.t === D0 && d1.st === 'snap' && /entekhab · Yahoo Finance/.test(d1.srcl) && /SPX/.test(d1.pair), JSON.stringify(d1));
    await page.evaluate(() => PRO.app.active().setTF('1w')); await page.waitForTimeout(1200);
    const w1 = await page.evaluate(() => { const b = PRO.app.active().bars; return { n: b.length, c: b[b.length - 1].c }; });
    ok(`[${lang} ${vw}] weekly bars built from the days, last close kept`, w1.n >= 57 && w1.n <= 59 && w1.c === cl(N - 1), JSON.stringify(w1));
    await page.evaluate(() => PRO.app.active().setTF('1h')); await page.waitForTimeout(1200);
    const h1 = await page.evaluate(() => { const c = PRO.app.active(); return { tf: c.cfg.tf, n: c.bars.length, toast: [...document.querySelectorAll('.pm-toast')].map(x => x.textContent).join(' | ') }; });
    ok(`[${lang} ${vw}] asking for 1h stays on the daily chart, with a note why`, h1.tf === '1d' && h1.n === N && h1.toast.length > 0, JSON.stringify(h1));
    await page.evaluate(() => PRO.tickers.watch(['GM_SPX'])); await page.waitForTimeout(1500);
    const tk = await page.evaluate(() => { const x = PRO.tickers.d.GM_SPX; return x ? { c: x.c, o: x.o } : null; });
    ok(`[${lang} ${vw}] watchlist price: the last close and the one before, from the site's index`, tk && tk.c === cl(N - 1) && tk.o === cl(N - 2), JSON.stringify(tk));
    await shot(page, `96_gm_${lang}_${vw}`);
    await ctx.close();
  }
  if (!ONLY || ONLY === 'langs') {
    const { execFileSync } = require('child_process'), os = require('os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'l10n-')), tplPath = path.join(ROOT, 'market', 'index.html'), tplKeep = fs.readFileSync(tplPath, 'utf8');
    try {
      /* German and Hebrew complete; Japanese without its page text. «replay» left out of German: English shows */
      execFileSync('python3', ['-c', `
import sys, json, os
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'scripts'))})
import pro_l10n as L
src = L.sources()
for code, mark, seo in (("de", "ᴰᴱ ", True), ("iw", "עב ", True), ("jp", "日本 ", False)):
    s = {k: [L.h(v), (v.replace(">", ">" + mark, 1) if "<" in v else mark + v)] for k, v in src.items() if (seo or not (k.startswith("seo.") or k.startswith("about."))) and k != "replay"}
    json.dump({"lang": code, "s": s}, open(os.path.join(${JSON.stringify(tmp)}, code + ".json"), "w"), ensure_ascii=False)
`]);
      execFileSync('python3', [path.join(ROOT, 'scripts', 'build_market_l10n.py')], { env: Object.assign({}, process.env, { PRO_L10N_CACHE: tmp }) });
      const { page, ctx } = await zonePage(1280, 860, 'Europe/Berlin', '/market/de/', 'de');
      const g = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, L: PRO.app.LANG(), ind: document.querySelector('#pm-ind span').textContent, rep: document.querySelector('#pm-rep span').textContent,
        cur: PRO.fx.cur(), sym: PRO.app.active().cfg.sym, h1: [...document.querySelectorAll('.pm-head h1 span')].filter(e => !e.hidden).map(e => e.textContent).join('|'),
        about: [...document.querySelectorAll('section.pm-about[data-lang]')].filter(e => !e.hidden).map(e => e.getAttribute('data-lang')).join(), on: [...document.querySelectorAll('#langs button.on')].length,
        hdr: (document.querySelector('#ekh .ek-i') || {}).textContent, lgb: document.querySelector('#pm-lang span').textContent, title: document.title }));
      ok('/market/de/: German page (lang, direction), strings from its pack, a missing one in English, prices in euros', g.lang === 'de' && g.dir === 'ltr' && g.L === 'de' && g.ind === 'ᴰᴱ Indicators' && g.rep === 'Replay' && g.cur === 'EUR' && g.sym === 'BTC_EUR' && g.lgb === 'Deutsch', JSON.stringify(g));
      ok('…its heading, about text and title in German; the site header in English with no language marked', g.h1 === 'ᴰᴱ Live market' && g.about === 'de' && /^ᴰᴱ Live market: /.test(g.title) && g.on === 0 && /^[A-Za-z]/.test(g.hdr || ''), JSON.stringify(g));
      const ov = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      ok('no sideways scroll at 1280', !ov);
      await shot(page, '70_de_1280');
      await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(900);
      ok('no sideways scroll at 390', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      await shot(page, '71_de_390');
      await page.setViewportSize({ width: 1280, height: 860 }); await page.waitForTimeout(500);
      /* the language menu → Español: its own address, and remembered for /market/ */
      await page.click('#pm-lang'); await page.waitForTimeout(400);
      const PRO_LANGS = await page.evaluate(() => (window.PRO && PRO.LANGS || window.P && P.LANGS || []).length);
      const lm = await page.evaluate(() => ({ n: document.querySelectorAll('.pm-lgi').length, first: document.querySelector('.pm-lgi b').textContent, last: [...document.querySelectorAll('.pm-lgi b')].pop().textContent, on: document.querySelector('.pm-lgi.on b').textContent,
        flags: document.querySelectorAll('.pm-lgi .pm-lgf').length, kurd: (document.querySelector('.pm-lgi[data-lg="ckb"] .pm-lgf') || {}).getAttribute && document.querySelector('.pm-lgi[data-lg="ckb"] .pm-lgf').getAttribute('src'),
        kmr: !!document.querySelector('.pm-lgi[data-lg="kmr"]'), pill: (document.querySelector('.pm-hglobe b') || {}).textContent }));
      ok('the language menu: every language of the workspace, کوردی first, English last, the current one marked', lm.n === PRO_LANGS && lm.first === 'کوردی' && lm.last === 'English' && lm.on === 'Deutsch', JSON.stringify(lm));
      ok('every language in the menu wears a flag, and Kurdish wears the Kurdistan Region flag', lm.flags === lm.n && /kurdistan\.svg$/.test(lm.kurd || ''), JSON.stringify({ flags: lm.flags, n: lm.n, kurd: lm.kurd }));
      ok('Kurmanji is in the menu and the pill counts the real number', lm.kmr && lm.pill === String(PRO_LANGS), JSON.stringify({ kmr: lm.kmr, pill: lm.pill, want: PRO_LANGS }));
      await shot(page, '72_lang_menu');
      await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.click('.pm-lgi[data-lg="es"]')]);
      await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length, null, { timeout: 20000 }).catch(() => { });
      const es = await page.evaluate(() => ({ path: location.pathname, L: PRO.app.LANG(), saved: localStorage.getItem('ek_pro_lang'), robots: (document.querySelector('meta[name=robots]') || {}).content || '' }));
      ok('Español opens /market/es/ and is remembered; an untranslated page is noindex', es.path === '/market/es/' && es.L === 'es' && es.saved === 'es' && /noindex/.test(es.robots), JSON.stringify(es));
      await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.goto(base + '/market/', { waitUntil: 'commit' })]);
      await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length, null, { timeout: 20000 }).catch(() => { });
      ok('/market/ then opens the remembered language', await page.evaluate(() => location.pathname === '/market/es/' && PRO.app.LANG() === 'es'));
      /* the site's own switch on such a page: back to /market/ in Persian */
      await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.evaluate(() => document.querySelector('#langs button[data-l="fa"]').click())]);
      await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length, null, { timeout: 20000 }).catch(() => { });
      const fa = await page.evaluate(() => ({ path: location.pathname, L: PRO.app.LANG(), saved: localStorage.getItem('ek_pro_lang'), dir: document.documentElement.dir }));
      ok('فارسی in the header goes back to /market/ in Persian and forgets the other language', fa.path === '/market/' && fa.L === 'fa' && !fa.saved && fa.dir === 'rtl', JSON.stringify(fa));
      /* the owner's /en/ address */
      await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => { }), page.goto(base + '/market/en/', { waitUntil: 'commit' })]);
      await page.waitForFunction(() => window.PRO && PRO.app && PRO.app.cells().length, null, { timeout: 20000 }).catch(() => { });
      ok('/market/en/ opens /market/ in English', await page.evaluate(() => location.pathname === '/market/' && PRO.app.LANG() === 'en'));
      await ctx.close();
      /* Hebrew: right to left */
      const h = await zonePage(1280, 860, 'Asia/Jerusalem', '/market/iw/', 'iw');
      const hs = await h.page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, pro: document.getElementById('pro').getAttribute('dir'), cur: PRO.fx.cur(), ind: document.querySelector('#pm-ind span').textContent, over: document.documentElement.scrollWidth > innerWidth + 1 }));
      ok('/market/iw/: Hebrew, right to left (the chart itself stays left to right), prices in shekels', hs.lang === 'he' && hs.dir === 'rtl' && hs.pro === 'ltr' && hs.cur === 'ILS' && hs.ind === 'עב Indicators' && !hs.over, JSON.stringify(hs));
      await shot(h.page, '73_iw_1280');
      await h.page.setViewportSize({ width: 390, height: 780 }); await h.page.waitForTimeout(900);
      ok('Hebrew at 390: no sideways scroll', !(await h.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      await shot(h.page, '74_iw_390');
      await h.ctx.close();
      /* Japanese in Tokyo: yen; its page text not translated yet, so English there */
      const j = await zonePage(1280, 860, 'Asia/Tokyo', '/market/jp/', 'jp');
      const js = await j.page.evaluate(() => ({ cur: PRO.fx.cur(), sym: PRO.app.active().cfg.sym, prec: PRO.app.active().prec(), ind: document.querySelector('#pm-ind span').textContent, h1: [...document.querySelectorAll('.pm-head h1 span')].filter(e => !e.hidden).map(e => e.textContent).join('|') }));
      ok('/market/jp/ in Tokyo: yen without decimals, workspace strings in its pack, page text in English until translated', js.cur === 'JPY' && js.sym === 'BTC_JPY' && js.prec === 0 && js.ind === '日本 Indicators' && js.h1 === 'Live market', JSON.stringify(js));
      await shot(j.page, '75_jp_1280');
      await j.ctx.close();
    } finally {
      fs.writeFileSync(tplPath, tplKeep);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  /* ---------- Phase C/D: the position planner on the chart, the risk board, the matrix, the regime card, the data library */
  if (!ONLY || ONLY === 'cd') for (const [vw, vh, lang] of [[1280, 860, 'en'], [390, 800, 'fa']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `cd ${lang} ${vw}`;
    /* place a long position with the mouse */
    const box = await page.locator('.pm-cell .pm-chart').first().boundingBox();
    if (vw < 600) await page.evaluate(() => PRO.app.active().drawer.setTool('long'));
    else await page.click('[data-tool="long"]');
    await page.mouse.click(box.x + box.width * (vw < 600 ? 0.45 : 0.6), box.y + box.height * 0.45);
    await page.waitForTimeout(500);
    const geo = () => page.evaluate(() => {
      const c = PRO.app.active(), L = PRO.app.DRAW()[c.cfg.sym] || [], d = L.filter(x => x.k === 'long').pop(); if (!d) return null;
      const r = c.drawer.o.el.getBoundingClientRect(), g = d._g, q = g && g.pos, xr = q ? Math.max(q.x0, q.x1) : 0;
      return { id: d.id, pts: JSON.parse(JSON.stringify(d.pts)), sel: c.drawer.sel === d.id, card: !!document.querySelector('.pm-plan'),
        entry: q && { x: r.left + g.px[0].x, y: r.top + g.px[0].y }, tg: q && { x: r.left + xr, y: r.top + q.yt }, sl: q && { x: r.left + xr, y: r.top + q.ys },
        mid: q && { x: r.left + (q.x0 + q.x1) / 2, y: r.top + (q.yt + q.ye) / 2 } };
    });
    let g0 = await geo();
    ok(`[${tag}] a long position is placed, selected and its planner card opens`, g0 && g0.pts.length === 3 && g0.sel && g0.card, JSON.stringify(g0 && { n: g0.pts.length, sel: g0.sel, card: g0.card }));
    if (g0 && g0.tg) {
      const cover = await page.evaluate(g => [g.entry, g.tg, g.sl].map(p => { const e = document.elementFromPoint(p.x, p.y); return e ? !!e.closest('.pm-plan') : null; }), g0);
      ok(`[${tag}] the planner card covers none of the position's handles`, cover.every(x => x === false), JSON.stringify(cover));
      if (vw < 600) {
        const fo = await page.evaluate(() => { const c = document.querySelector('.pm-plan'); const a = c.classList.contains('pm-plmin'); c.querySelector('.pm-plh b').click(); const b = c.classList.contains('pm-plmin'); c.querySelector('.pm-plh b').click(); return { a, b, c: c.classList.contains('pm-plmin'), s: c.querySelector('.pm-pls').textContent }; });
        ok(`[${tag}] on a phone the card starts folded with the loss and R:R in its header, and a tap opens and folds it`, fo.a && !fo.b && fo.c && /R/.test(fo.s), JSON.stringify(fo));
      }
      const drag = async (p, dy) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x, p.y + dy, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250); };
      /* target alone */
      await drag(g0.tg, -18); let g1 = await geo(); const hitT = await page.evaluate(p => { const c = PRO.app.active(), r = c.drawer.o.el.getBoundingClientRect(), h = c.drawer.hit(p.x - r.left, p.y - r.top), e = document.elementFromPoint(p.x, p.y); return { part: h && h.part, at: e ? e.tagName + '.' + String(e.className).slice(0, 40) : null, pane: c.drawer.pane() }; }, g1.tg);
      ok(`[${tag}] dragging the target moves only the target`, g1.pts[1].p > g0.pts[1].p && g1.pts[0].p === g0.pts[0].p && g1.pts[2].p === g0.pts[2].p, JSON.stringify([g0.pts.map(p => p.p), g1.pts.map(p => p.p), hitT, g0.tg]));
      /* stop alone */
      await drag(g1.sl, 14); let g2 = await geo();
      ok(`[${tag}] dragging the stop moves only the stop`, g2.pts[2].p < g1.pts[2].p && g2.pts[0].p === g1.pts[0].p && g2.pts[1].p === g1.pts[1].p, JSON.stringify(g2.pts.map(p => p.p)));
      /* entry alone */
      await drag(g2.entry, -6); let g3 = await geo();
      ok(`[${tag}] dragging the entry moves only the entry`, g3.pts[0].p !== g2.pts[0].p && g3.pts[1].p === g2.pts[1].p && g3.pts[2].p === g2.pts[2].p && g3.pts[1].t === g2.pts[1].t, JSON.stringify(g3.pts));
      /* the body moves all three together, by the same price step */
      await drag(g3.mid, 20); let g4 = await geo();
      const dp = [0, 1, 2].map(i => +(g4.pts[i].p - g3.pts[i].p).toPrecision(8));
      ok(`[${tag}] dragging the box moves the whole position, all three lines by the same amount`, dp[0] !== 0 && dp[0] === dp[1] && dp[1] === dp[2], JSON.stringify(dp));
      /* undo walks back one step at a time */
      await page.keyboard.press('Control+z'); await page.waitForTimeout(250); let gu = await geo();
      ok(`[${tag}] Ctrl+Z undoes the last drag only`, JSON.stringify(gu.pts) === JSON.stringify(g3.pts), JSON.stringify(gu.pts));
      /* the card's numbers follow the lines, and say the liquidation is a simplified estimate */
      await page.evaluate(() => { const c = document.querySelector('.pm-plan'); if (c && c.classList.contains('pm-plmin')) c.querySelector('.pm-plh b').click(); });
      const cardT = await page.evaluate(() => (document.querySelector('.pm-plan') || {}).innerText || '');
      const want = await page.evaluate(() => PRO.app.T('rcLiqS'));
      ok(`[${tag}] the planner card labels the liquidation "${want}"`, cardT.indexOf(want) >= 0, cardT.slice(0, 200));
      const same = await page.evaluate(() => { const c = PRO.app.active(), d = (PRO.app.DRAW()[c.cfg.sym] || []).filter(x => x.k === 'long').pop(), r = PRO.plan(PRO.planInputs(d)); return { qty: r.qty, txt: (document.querySelector('.pm-plan') || {}).innerText || '' }; });
      ok(`[${tag}] the card shows the quantity of the lines as they are now`, same.qty > 0 && same.txt.indexOf(same.qty.toLocaleString('en-US', { maximumFractionDigits: 8 })) >= 0, String(same.qty));
      if (vw < 600) await page.evaluate(() => { const c = document.querySelector('.pm-plan'); if (c && !c.classList.contains('pm-plmin')) c.querySelector('.pm-plh b').click(); });
      /* zoom and scroll: the lines stay on their prices */
      const before = (await geo()).pts;
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6); await page.mouse.wheel(0, -300); await page.waitForTimeout(300);
      await page.evaluate(() => PRO.app.active().chart.timeScale().scrollToPosition(-20, false)); await page.waitForTimeout(300);
      const after = (await geo()).pts;
      ok(`[${tag}] zoom and scroll change no price or time of the position`, JSON.stringify(before) === JSON.stringify(after));
      /* a click on empty chart deselects */
      /* an empty spot: on the chart, off the card, off the position */
      const spot = await page.evaluate(() => { const c = PRO.app.active(), r = c.drawer.o.el.getBoundingClientRect(), pn = c.drawer.pane();
        for (const fy of [0.85, 0.15, 0.5]) for (const fx of [0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92]) { const x = r.left + pn.w * fx, y = r.top + pn.h * fy, e = document.elementFromPoint(x, y);
          if (e && e.tagName === 'CANVAS' && !e.closest('.pm-plan') && c.drawer.o.el.contains(e) && !c.drawer.hit(x - r.left, y - r.top)) return [x, y]; }
        return null; });
      if (spot) await page.mouse.click(spot[0], spot[1]); await page.waitForTimeout(200);
      const ds = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y), c = PRO.app.active(); return { sel: c.drawer.sel, card: !!document.querySelector('.pm-plan'), at: e ? e.tagName + '.' + e.className : null, n: (PRO.app.DRAW()[c.cfg.sym] || []).length, tool: c.drawer.tool }; }, spot || [0, 0]);
      ok(`[${tag}] a click on empty chart deselects the position and closes the card`, !ds.sel && !ds.card, JSON.stringify(ds));
      /* a timeframe change keeps the levels */
      await page.evaluate(() => PRO.app.active().setTF ? PRO.app.active().setTF('4h') : null); await page.waitForTimeout(1200);
      const tfp = await page.evaluate(() => { const c = PRO.app.active(); return (PRO.app.DRAW()[c.cfg.sym] || []).filter(x => x.k === 'long').pop().pts; });
      ok(`[${tag}] changing timeframe leaves the position's prices as they were`, tfp.map(p => p.p).join() === after.map(p => p.p).join(), JSON.stringify(tfp));
      await shot(page, `80_cd_planner_${lang}_${vw}`);
    }
    /* the risk board: planned and active kept apart */
    await page.evaluate(() => {
      const now = Date.now();
      localStorage.setItem('ek_pro_plans', JSON.stringify([
        { id: 'a1', at: now, sym: 'BTC', tf: '1h', long: true, entry: 100, stop: 95, targets: [{ p: 110, share: 100 }], qty: 2, notional: 200, margin: 200, risk: 10, rr: 2, status: 'active', ex: 'Binance' },
        { id: 'a2', at: now, sym: 'BTC', tf: '1h', long: false, entry: 100, stop: 104, targets: [{ p: 92, share: 100 }], qty: 1, notional: 100, margin: 100, risk: 4, rr: 2, status: 'active', ex: 'Bybit' },
        { id: 'p1', at: now, sym: 'ETH', tf: '1h', long: true, entry: 50, stop: 48, targets: [{ p: 56, share: 100 }], qty: 3, notional: 150, margin: 150, risk: 6, rr: 3, status: 'planned', ex: '' }]));
    });
    await page.evaluate(() => PRO.riskBoard()); await page.waitForTimeout(400);
    const bt = await page.evaluate(() => ({ t: (document.querySelector('.pm-modal') || {}).innerText || '', a: PRO.app.T('plActiveR'), p: PRO.app.T('plPlannedR'), rows: document.querySelectorAll('.pm-modal tbody tr').length }));
    ok(`[${tag}] the risk board shows planned and active risk as two separate figures`, bt.t.indexOf(bt.a) >= 0 && bt.t.indexOf(bt.p) >= 0 && bt.rows >= 3, JSON.stringify({ rows: bt.rows }));
    const ov = await page.evaluate(() => { const b = document.querySelector('.pm-mbox'); return b ? b.scrollWidth > b.clientWidth + 2 || document.documentElement.scrollWidth > innerWidth + 1 : true; });
    ok(`[${tag}] the risk board fits the screen`, !ov);
    await shot(page, `81_cd_board_${lang}_${vw}`);
    await page.keyboard.press('Escape'); await page.evaluate(() => PRO.app.closeModal());
    /* the matrix: every row has a state; the regime card explains itself */
    await page.evaluate(() => PRO.mtf()); await page.waitForFunction(() => document.querySelectorAll('.pm-mtft tbody tr').length >= 3 && ![...document.querySelectorAll('.pm-mtft tbody tr')].some(r => /…|\.\.\./.test(r.innerText)), null, { timeout: 25000 }).catch(() => { });
    const mx = await page.evaluate(() => {
      const T = PRO.app.T, st = ['confirmed', 'developing', 'neutral', 'conflicting', 'insufficient'].map(k => T('ms_' + k));
      const rows = [...document.querySelectorAll('.pm-mtft tbody tr')].map(r => r.innerText);
      return { n: rows.length, ok: rows.filter(t => st.some(s => t.indexOf(s) >= 0)).length, why: !!document.querySelector('.pm-rgw, .pm-rgc details'), strip: !!document.querySelector('.pm-rgstrip, .pm-rgc svg') };
    });
    ok(`[${tag}] every matrix row carries one of the five states`, mx.n >= 3 && mx.ok === mx.n, JSON.stringify(mx));
    ok(`[${tag}] the regime card has its explanation and its history strip`, mx.why && mx.strip, JSON.stringify(mx));
    await shot(page, `82_cd_matrix_${lang}_${vw}`);
    await page.evaluate(() => PRO.app.closeModal());
    /* the data library */
    await page.click('#pm-data'); await page.waitForTimeout(300);
    const dl = await page.evaluate(() => ({ n: document.querySelectorAll('.pm-dlr').length, all: PRO.DATALIB.length, safe: [...document.querySelectorAll('.pm-dlr a')].every(a => a.target === '_blank' && /noopener/.test(a.rel) && a.href.indexOf('https://') === 0) }));
    ok(`[${tag}] the data library lists every source, each link opening safely in a new tab`, dl.n === dl.all && dl.n >= 25 && dl.safe, JSON.stringify(dl));
    await page.fill('.pm-dl input', 'binance'); await page.waitForTimeout(150);
    const f1 = await page.evaluate(() => document.querySelectorAll('.pm-dlr').length);
    await page.fill('.pm-dl input', ''); await page.click('.pm-dlcats .pm-chip:nth-child(2)'); await page.waitForTimeout(150);
    const f2 = await page.evaluate(() => ({ n: document.querySelectorAll('.pm-dlr').length, g: document.querySelectorAll('.pm-dlg').length }));
    ok(`[${tag}] search and the category chips filter the list`, f1 >= 1 && f1 < dl.all && f2.g === 1 && f2.n < dl.all, JSON.stringify({ f1, f2 }));
    const ov2 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(`[${tag}] the data library fits the screen`, !ov2);
    await page.click('.pm-dlcats .pm-chip:nth-child(1)'); await page.waitForTimeout(100);
    await shot(page, `83_cd_datalib_${lang}_${vw}`);
    await ctx.close();
  }

  /* ---------- ODM: the whole-trade planner (stepped entries, ATR stop, stepped exits, trail, test, alerts, board) */
  if (!ONLY || ONLY === 'cd' || ONLY === 'odm') for (const [vw, vh, lang] of [[1280, 860, 'en'], [390, 800, 'fa']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `odm ${lang} ${vw}`, e0 = errors.length;
    const btn = k => page.evaluate(k => { const t = PRO.app.T(k), b = [...document.querySelectorAll('.pm-odact button, .pm-odsec button, .pm-odm button')].find(x => x.textContent.trim() === t || x.textContent.trim() === '+ ' + t); if (!b) return false; b.click(); return true; }, k);
    const open = async () => { if (vw < 600) await page.evaluate(() => document.querySelector('#pm-odm').click()); else await page.click('#pm-odm'); await page.waitForSelector('.pm-odm', { timeout: 5000 }); await page.waitForTimeout(200); };
    await open();
    const st = () => page.evaluate(() => {
      const m = document.querySelector('.pm-odm'), box = document.querySelector('.pm-mbox'), body = document.querySelector('.pm-mbody');
      return { cards: m.querySelectorAll('.pm-odout .pm-cor').length, err: [...m.querySelectorAll('.pm-odout .pm-cw2')].map(x => x.textContent).join(' | '),
        loss: (() => { const t = PRO.app.T('rcMaxLoss'); const c = [...m.querySelectorAll('.pm-odout .pm-cor')].find(x => x.querySelector('small').textContent === t); return c ? c.querySelector('b').textContent : null; })(),
        liq: [...m.querySelectorAll('.pm-odout .pm-cor small')].some(x => x.textContent === PRO.app.T('rcLiqS')),
        tables: [...m.querySelectorAll('.pm-odout table')].map(t => t.querySelectorAll('tbody tr').length), rowsE: m.querySelectorAll('.pm-odin .pm-odsec:nth-of-type(2) .pm-odrow').length,
        rowsX: m.querySelectorAll('.pm-odrx').length, fits: box.getBoundingClientRect().right <= innerWidth + 1 && box.getBoundingClientRect().left >= -1, hscroll: body.scrollWidth - body.clientWidth, why: !!m.querySelector('.pm-odwhy summary'), top: (document.querySelector('.pm-odtop') || {}).textContent || '' };
    });
    let s0 = await st();
    ok(`[${tag}] ODM opens with a three-step ladder, an ATR stop, three exits and a trail, and shows its results`, s0.cards >= 8 && s0.rowsE === 3 && s0.rowsX === 3 && s0.tables.length === 3 && s0.why, JSON.stringify(s0));
    ok(`[${tag}] a one-line summary (risk, average, stop, all exits in R) sits on top of the planner`, /−10/.test(s0.top) && /SL/.test(s0.top) && /R\)/.test(s0.top), s0.top);
    ok(`[${tag}] the loss at the stop is exactly the risk chosen (1% of 1000 = 10)`, s0.loss && /^[−-]10$/.test(s0.loss.replace(/\s/g, '')), s0.loss);
    ok(`[${tag}] the planner fits the screen with no sideways scroll`, s0.fits && s0.hscroll <= 1, JSON.stringify(s0));
    ok(`[${tag}] liquidation is labelled as a simplified estimate`, s0.liq, '');
    /* risk 2% → loss 20; the engine's own figure matches the card */
    await page.evaluate(() => { const t = PRO.app.T('rcRisk'), l = [...document.querySelectorAll('.pm-odm .pm-cf')].find(x => x.querySelector('span') && x.querySelector('span').textContent === t), i = l.querySelector('input'); i.value = '2'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    let s1 = await st();
    ok(`[${tag}] raising the risk to 2% doubles the loss at the stop to 20`, s1.loss && /^[−-]20$/.test(s1.loss.replace(/\s/g, '')), s1.loss);
    /* a four-step growing ladder */
    await page.evaluate(() => { const T = PRO.app.T, f = (k, v) => { const l = [...document.querySelectorAll('.pm-odm .pm-cf')].find(x => x.querySelector('span') && x.querySelector('span').textContent === T(k)), i = l.querySelector('input,select'); i.value = v; i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }; f('odGN', '4'); f('odGSplit', 'grow'); });
    await btn('odGBuild'); let s2 = await st();
    const shares = await page.evaluate(() => JSON.parse(localStorage.getItem('ek_pro_odm') || '{}').entries);
    ok(`[${tag}] building a four-step growing ladder gives 10/20/30/40%`, s2.rowsE === 4 && shares && shares.map(x => +x.q).join() === '10,20,30,40' && s2.tables[0] === 4, JSON.stringify(shares));
    /* a stop on the wrong side is refused with a reason */
    await page.evaluate(() => { const T = PRO.app.T, g = (k) => [...document.querySelectorAll('.pm-odm .pm-cf')].find(x => x.querySelector('span') && x.querySelector('span').textContent === T(k)); const m = g('odSMode').querySelector('select'); m.value = 'price'; m.dispatchEvent(new Event('change', { bubbles: true })); const v = g('odSVal').querySelector('input'); v.value = String(PRO.app.active().bars.slice(-1)[0].c * 2); v.dispatchEvent(new Event('input', { bubbles: true })); });
    let s3 = await st();
    ok(`[${tag}] a stop above a long's entries is refused with a plain reason, and the action buttons switch off`, s3.err === PRO_T(lang, 'odE_side') && await page.evaluate(() => [...document.querySelectorAll('.pm-odact button[data-need]')].every(b => b.disabled)), s3.err);
    await page.evaluate(() => { const T = PRO.app.T, g = (k) => [...document.querySelectorAll('.pm-odm .pm-cf')].find(x => x.querySelector('span') && x.querySelector('span').textContent === T(k)); const m = g('odSMode').querySelector('select'); m.value = 'atr'; m.dispatchEvent(new Event('change', { bubbles: true })); const v = g('odSVal').querySelector('input'); v.value = '2'; v.dispatchEvent(new Event('input', { bubbles: true })); });
    await btn('odP_pct'); let s4 = await st();
    ok(`[${tag}] the +5/+10/+20% exit preset gives three exits and the plan is valid again`, s4.rowsX === 3 && !s4.err.includes(PRO_T(lang, 'odE_side')) && s4.tables[1] === 3, JSON.stringify(s4));
    await shot(page, `84_odm_${lang}_${vw}`);
    /* test on the chart's past candles */
    await btn('odTest'); await page.waitForTimeout(250);
    const tr = await page.evaluate(() => { const r = document.querySelector('.pm-odres'); return r && { cards: r.querySelectorAll('.pm-cor').length, note: !!r.querySelector('.pm-odhint') }; });
    ok(`[${tag}] the history test runs and reports its ending, fills, result, bars and unclear bars`, tr && tr.cards >= 5 && tr.note, JSON.stringify(tr));
    await shot(page, `85_odm_test_${lang}_${vw}`);
    /* alerts for each level */
    const nA0 = await page.evaluate(() => PRO._alerts().length);
    await btn('odAlerts'); await page.waitForTimeout(150);
    const al = await page.evaluate(() => document.querySelectorAll('.pm-odalr').length);
    await btn('odAlAdd'); await page.waitForTimeout(150);
    const nA1 = await page.evaluate(() => PRO._alerts().filter(a => /^ODM /.test(a.msg || '')).length);
    ok(`[${tag}] one alert per level: 4 entries, the stop, 3 exits (and the trail start if set)`, al >= 8 && nA1 === al && nA1 - 0 >= 8 && (await page.evaluate(() => PRO._alerts().length)) - nA0 === al, JSON.stringify({ al, nA1, nA0 }));
    await btn('odAlAdd'); await page.waitForTimeout(150);
    ok(`[${tag}] adding the same alerts again makes no duplicates`, (await page.evaluate(() => PRO._alerts().filter(a => /^ODM /.test(a.msg || '')).length)) === nA1, '');
    /* all ticked levels to the Telegram bot in one link, in the format the bot reads (o_<COIN>_<k><PRICE>-…, at most 63 characters) */
    const ob = await page.evaluate(() => {
      const a = document.querySelector('.pm-odbot'); if (!a) return null;
      const arg = (a.getAttribute('href') || '').split('?start=')[1] || '';
      return { shown: !a.hidden, arg, text: a.textContent, rel: a.rel };
    });
    ok(`[${tag}] one link sends every ticked level to the Telegram bot`, ob && ob.shown && /^o_[A-Z0-9]{1,12}_[estx]\d+(d\d+)?(-[estx]\d+(d\d+)?){0,7}$/.test(ob.arg) && ob.arg.length <= 63 && /[_-]s\d/.test(ob.arg) && /noopener/.test(ob.rel), JSON.stringify(ob));
    const ob2 = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('.pm-odalr input[type=checkbox]')];
      boxes.forEach(b => { b.checked = false; b.dispatchEvent(new Event('change')); });
      const hid = document.querySelector('.pm-odbot').hidden;
      boxes[0].checked = true; boxes[0].dispatchEvent(new Event('change'));
      const one = (document.querySelector('.pm-odbot').getAttribute('href') || '').split('?start=')[1] || '';
      boxes.forEach(b => { b.checked = true; b.dispatchEvent(new Event('change')); });
      return { hid, one };
    });
    ok(`[${tag}] the bot link follows the ticks (hidden with none, one level with one)`, ob2.hid && /^o_[A-Z0-9]+_e\d+(d\d+)?$/.test(ob2.one), JSON.stringify(ob2));
    await shot(page, `86_odm_alerts_${lang}_${vw}`);
    /* save to the risk board as planned, with the full-fill risk */
    await btn('odSave'); await page.waitForTimeout(150);
    const sv = await page.evaluate(() => { const L = JSON.parse(localStorage.getItem('ek_pro_plans') || '[]'), p = L.find(x => x.kind === 'odm'); return p && { st: p.status, risk: p.risk, n: p.entries.length, t: p.targets.length }; });
    ok(`[${tag}] saving puts the plan on the risk board as planned, with its 4 entries, 3 exits and a risk of 20`, sv && sv.st === 'planned' && Math.abs(sv.risk - 20) < 1e-6 && sv.n === 4 && sv.t === 3, JSON.stringify(sv));
    /* show on the chart */
    await btn('odShow'); await page.waitForTimeout(200);
    const ln = await page.evaluate(() => ({ n: PRO.odmLinesShown(), modal: !!document.querySelector('.pm-odm') }));
    ok(`[${tag}] "Show on chart" closes the planner and draws every level`, ln.n >= 9 && !ln.modal, JSON.stringify(ln));
    await shot(page, `87_odm_chart_${lang}_${vw}`);
    await open(); await btn('odHide'); await page.waitForTimeout(100);
    ok(`[${tag}] the levels can be hidden again`, (await page.evaluate(() => PRO.odmLinesShown())) === 0, '');
    ok(`[${tag}] no JS errors in the ODM checks`, errors.length === e0, errors.slice(e0).join(' || '));
    await ctx.close();
  }

  /* ---------- ODM on the chart: drag a line and the plan is worked out again, tap to put a level, undo, Escape; and the
     right-click menu removes ODM levels, alerts, one indicator or drawing, or everything, each with Undo */
  if (!ONLY || ONLY === 'cd' || ONLY === 'odm' || ONLY === 'odc') for (const [vw, vh, lang] of [[1280, 860, 'en'], [1024, 768, 'fa'], [390, 800, 'ar'], [390, 800, 'ckb']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `odm chart ${lang} ${vw}`, e0 = errors.length, phone = vw < 600;
    const T = k => page.evaluate(k => PRO.app.T(k), k);
    await page.evaluate(() => { localStorage.removeItem('ek_pro_odm'); document.querySelector('#pm-odm').click(); });
    await page.waitForSelector('.pm-odm .pm-odt', { timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(300);
    const showT = await T('odShow');
    await page.evaluate(t => [...document.querySelectorAll('.pm-odact button')].find(b => b.textContent.trim() === t).click(), showT);
    await page.waitForTimeout(400);
    /* the plan's levels have to be on screen to be grabbed; how far the ATR stop and the ladder reach depends on the day's candles,
       so zoom the chart out, as a user would, until every level is inside the price pane */
    for (const n of [0, 250, 500, 1000, 2000]) {
      const fits = await page.evaluate(n => { const c = PRO.app.active(), D = c.disp; if (n) c.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, D.length - n), to: D.length + 3 }); return true; }, n);
      await page.waitForTimeout(n ? 350 : 0);
      const ok2 = await page.evaluate(() => { const c = PRO.app.active(), ph = c.chart.panes()[0].getHeight(), L = PRO.odmLive(); return L && L.levels.every(l => l.y != null && l.y > 30 && l.y < ph - 60); });
      if (fits && ok2) break;
    }
    /* the box is placed for the view it was first drawn in: after zooming out, place it again for this view */
    await page.evaluate(() => { const L = PRO.odmLive(); if (L) { L.st.anchor = 0; L.st.zEnd = 0; PRO.app.active().ovl.update(); } }); await page.waitForTimeout(200);
    const live = () => page.evaluate(() => { const L = PRO.odmLive(); if (!L) return null; const c = PRO.app.active(), r = c.box.getBoundingClientRect(); return { plan: { err: L.plan.err || null, stop: L.plan.stop, avg: L.plan.avg, risk: L.plan.risk, qty: L.plan.qty, nx: L.plan.exits ? L.plan.exits.length : 0, nf: L.plan.fills ? L.plan.fills.length : 0 }, st: JSON.parse(JSON.stringify(L.st)), levels: L.levels, pick: L.pick, box: { l: r.left, t: r.top, w: r.width, h: r.height }, pl: c.main.priceLines().length, hud: (document.querySelector('.pm-odhud .pm-odhs') || {}).textContent || '', msg: (document.querySelector('.pm-odhud .pm-odhm') || {}).textContent || '', msgDn: !!document.querySelector('.pm-odhud .pm-odhm.dn'), range: JSON.stringify(c.chart.timeScale().getVisibleLogicalRange()) }; });
    let L0 = await live();
    const hb = await page.evaluate(() => { const h = document.querySelector('.pm-odhud'), c = PRO.app.active().box.getBoundingClientRect(); if (!h) return null; const r = h.getBoundingClientRect(); return { in: r.left >= c.left - 1 && r.right <= c.right + 1 && r.bottom <= c.bottom + 1 && r.top >= c.top, btn: h.querySelectorAll('[data-pk]').length, open: !!h.querySelector('[data-a="open"]'), undo: h.querySelector('[data-a="undo"]').disabled, dir: h.dir, h: r.height, w: r.width }; });
    ok(`[${tag}] "Show on chart" draws every level as a price line and opens the panel on the chart`, L0 && L0.levels.length >= 7 && L0.pl === L0.levels.length && hb && hb.in && hb.btn === 3 && hb.open && hb.undo && /SL/.test(L0.hud), JSON.stringify({ n: L0 && L0.levels.length, pl: L0 && L0.pl, hb }));
    await shot(page, `88_odm_drag_${lang}_${vw}`);
    /* the plan drawn as a position: green from the average entry to the last target, red to the stop, from a candle to the right edge */
    const zone = () => page.evaluate(() => PRO.odmZone());
    const Zn = await zone();
    const zy = await page.evaluate(() => { const L = PRO.odmLive(), c = PRO.app.active(), xs = L.levels.filter(l => /^x/.test(l.k)), y = p => c.main.priceToCoordinate(p); return { side: PRO.app.T(L.plan.stop < L.plan.avg ? 'odZLong' : 'odZShort'), ya: y(L.plan.avg), ys: y(L.plan.stop), yt: xs.length ? y(Math.max(...xs.map(l => l.p))) : null, long: PRO.odmLive().plan.stop < PRO.odmLive().plan.avg, W: c.box.getBoundingClientRect().width }; });
    ok(`[${tag}] ODM draws the plan as a position box: from a candle to its own right edge (closed, not to the chart's edge), from the stop to the last target, with the entry line inside`, Zn && Zn.x1 - Zn.x0 >= 40 && Zn.end && !Zn.ext && Zn.x1 < L0.box.w - 2 && Zn.x0 >= 0 && Math.abs(Zn.ya - zy.ya) < 1 && Math.abs(Zn.bot - Math.min(Zn.H, zy.long ? zy.ys : zy.yt)) < 1 && Math.abs(Zn.top - Math.max(0, zy.long ? zy.yt : zy.ys)) < 1 && Zn.anchor > 0 && Zn.tags.some(t => t.startsWith(zy.long ? zy.side : zy.side)) && Zn.tags.some(t => /^TP\d/.test(t)), JSON.stringify({ Zn, zy }));
    const pts = await page.evaluate(([Z]) => {
      const L = PRO.odmLive(), ys = L.levels.map(l => l.y), bx = PRO.app.active().box.getBoundingClientRect(), labs = [...document.querySelectorAll('.pm-odz span,.pm-odhud,.pm-leg,.pm-toast')].map(e => e.getBoundingClientRect()), off = (x, y) => labs.some(r => bx.left + x >= r.left - 3 && bx.left + x <= r.right + 3 && bx.top + y >= r.top - 3 && bx.top + y <= r.bottom + 3), clear = y => Math.min(...ys.map(z => Math.abs(z - y))) > 12, out = [];
      for (let i = 0; i < 9; i++) { const x = Z.x0 + (Z.x1 - Z.x0) * (0.1 + i * 0.1); for (const f of [0.15, 0.35, 0.55, 0.75]) { const yg = Z.top + (Z.ya - Z.top) * f, yr = Z.ya + (Z.bot - Z.ya) * f; if (clear(yg) && !off(x, yg)) out.push([x, yg, 'g']); if (clear(yr) && !off(x, yr)) out.push([x, yr, 'r']); } }
      return out;
    }, [Zn]);
    /* what the screen shows, with and without the box (the same moment, the same candles) */
    const clip = { x: Math.round(L0.box.l + Zn.x0), y: Math.round(L0.box.t + Zn.top), width: Math.max(4, Math.round(Zn.x1 - Zn.x0)), height: Math.max(4, Math.round(Zn.bot - Zn.top)) };
    const px = async () => { const b64 = (await page.screenshot({ clip })).toString('base64'); return page.evaluate(async ([b64, pts, clip, l, t]) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0); const k = im.width / clip.width;
      return pts.map(([x, y]) => [...g.getImageData(Math.max(0, Math.min(im.width - 1, Math.round((l + x - clip.x) * k))), Math.max(0, Math.min(im.height - 1, Math.round((t + y - clip.y) * k))), 1, 1).data].slice(0, 3)); }, [b64, pts, clip, L0.box.l, L0.box.t]); };
    const on1 = await px(); await page.evaluate(() => PRO._odmZoneVis(false)); await page.waitForTimeout(200);
    const off = await px(); await page.evaluate(() => PRO._odmZoneVis(true)); await page.waitForTimeout(200);
    const tint = { n1: 0, n2: 0, gr: 0, rd: 0 };
    pts.forEach((p, i) => { const dr = on1[i][0] - off[i][0], dg = on1[i][1] - off[i][1]; if (Math.abs(dr) + Math.abs(dg) < 6) return; if (p[2] === 'g') { tint.n1++; if (dg > dr + 4) tint.gr++; } else { tint.n2++; if (dr > dg + 4) tint.rd++; } });
    /* on a phone the profit or the stop side can be mostly off the pane; each side seen must have its own colour, and one side at least four points */
    ok(`[${tag}] the profit side of the box is green and the stop side red on the chart itself`, (tint.n1 >= 4 || tint.n2 >= 4) && tint.gr >= tint.n1 * 0.9 && tint.rd >= tint.n2 * 0.9, JSON.stringify({ tint, s: pts.slice(0, 4).map((p, i) => [p[2], on1[i], off[i]]) }));
    /* the round handle on the entry line moves the start candle; Undo puts it back */
    {
      const dx = Zn.x0 > 110 ? -70 : 70, hx = L0.box.l + Zn.x0, hy = L0.box.t + Zn.ya;
      if (!phone) { await page.mouse.move(hx, hy); await page.mouse.down(); for (let i = 1; i <= 6; i++) await page.mouse.move(hx + dx * i / 6, hy); await page.mouse.up(); }
      else await page.evaluate(([x, y, dx]) => {
        const el = document.elementFromPoint(x, y), o = (x, t) => ({ bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 9, pointerType: 'touch', isPrimary: true, buttons: t ? 1 : 0, button: 0 });
        /* a finger taps the position first to select it, then drags the handle */
        el.dispatchEvent(new PointerEvent('pointerdown', o(x, 1))); el.dispatchEvent(new PointerEvent('pointerup', o(x, 0)));
        el.dispatchEvent(new PointerEvent('pointerdown', o(x, 1))); for (let i = 1; i <= 6; i++) el.dispatchEvent(new PointerEvent('pointermove', o(x + dx * i / 6, 1))); el.dispatchEvent(new PointerEvent('pointerup', o(x + dx, 0)));
      }, [hx, hy, dx]);
      await page.waitForTimeout(150);
      const Z2 = await zone(), L2b = await live();
      ok(`[${tag}] dragging the round handle moves the box to another candle and leaves the levels as they were`, Z2 && Math.abs((Z2.x0 - Zn.x0) - dx) < 14 && (dx < 0 ? Z2.anchor < Zn.anchor : Z2.anchor > Zn.anchor) && L2b.plan.stop === L0.plan.stop && L2b.plan.avg === L0.plan.avg && L2b.range === L0.range, JSON.stringify({ x0: Zn.x0, x1: Z2 && Z2.x0, a0: Zn.anchor, a1: Z2 && Z2.anchor, dx }));
      await page.click('.pm-odhud [data-a="undo"]'); await page.waitForTimeout(150);
      const Z3 = await zone();
      ok(`[${tag}] Undo puts the box back on its first candle`, Z3 && Z3.anchor === Zn.anchor && Math.abs(Z3.x0 - Zn.x0) < 1, JSON.stringify({ a: Z3 && Z3.anchor, want: Zn.anchor }));
    }
    const X = L0.box.l + L0.box.w * 0.42;
    const under = (x, y) => page.evaluate(([x, y]) => { const out = []; let el = document.elementFromPoint(x, y); for (let i = 0; el && i < 6; i++, el = el.parentElement) { const cs = getComputedStyle(el); out.push(el.tagName + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '') + '[' + cs.position + ',' + cs.zIndex + ']'); } return out.join(' < ') + ' @' + Math.round(x) + ',' + Math.round(y); }, [x, y]);
    const yOf = (L, k) => { const l = L.levels.find(z => z.k === k); return l ? L.box.t + l.y : null; };
    /* drag the stop down 40 px: wider stop, same risk, smaller size */
    const xFree = (y) => page.evaluate(([y, X]) => { const c = PRO.app.active().box.getBoundingClientRect(); const xs = [X]; for (let x = c.left + c.width * 0.15; x < c.right - 70; x += 8) xs.push(x); for (const x of xs) { const el = document.elementFromPoint(x, y); if (el && !el.closest('.pm-odhud,.pm-leg,.pm-toast,.pm-menu')) return x; } for (const x of xs) { const el = document.elementFromPoint(x, y); if (el && el.closest('.pm-odhud') && !el.closest('button')) return x; } return X; }, [y, X]);
    const drag = async (y0, dy, touch) => {
      const X = await xFree(y0);
      if (!touch) { await page.mouse.move(X, y0); await page.mouse.down(); for (let i = 1; i <= 6; i++) await page.mouse.move(X, y0 + dy * i / 6); await page.mouse.up(); }
      else await page.evaluate(([x, y0, dy]) => {
        const box = PRO.app.active().box, el = document.elementFromPoint(x, y0) || box, o = (y, t) => ({ bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, buttons: t ? 1 : 0, button: 0 });
        el.dispatchEvent(new PointerEvent('pointerdown', o(y0, 1))); el.dispatchEvent(new PointerEvent('pointerup', o(y0, 0)));   /* tap to select */
        el.dispatchEvent(new PointerEvent('pointerdown', o(y0, 1)));
        for (let i = 1; i <= 6; i++) el.dispatchEvent(new PointerEvent('pointermove', o(y0 + dy * i / 6, 1)));
        el.dispatchEvent(new PointerEvent('pointerup', o(y0 + dy, 0)));
      }, [X, y0, dy]);
      await page.waitForTimeout(150);
    };
    /* down 40 px widens the stop; when the stop sits near the foot of the price pane, up 40 px narrows it instead (a line is grabbed where it can be seen) */
    const paneH = await page.evaluate(() => PRO.app.active().chart.panes()[0].getHeight());
    const slY = yOf(L0, 'sl') - L0.box.t, dyS = slY + 40 > paneH - 30 ? -40 : 40;
    await drag(yOf(L0, 'sl'), dyS, phone);
    let L1 = await live();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ek_pro_odm') || '{}').stop);
    ok(`[${tag}] dragging the stop line moves the stop, keeps the risk and changes the size to match; it is saved as a price`, (dyS > 0 ? L1.plan.stop < L0.plan.stop && L1.plan.qty < L0.plan.qty : L1.plan.stop > L0.plan.stop && L1.plan.qty > L0.plan.qty) && Math.abs(L1.plan.risk - L0.plan.risk) < 1e-6 && L1.st.stop.mode === 'price' && saved.mode === 'price' && Math.abs(+saved.v - L1.plan.stop) <= Math.abs(L1.plan.stop) * 1e-6 && L1.hud !== L0.hud, JSON.stringify({ s0: L0.plan.stop, s1: L1.plan.stop, r0: L0.plan.risk, r1: L1.plan.risk, q0: L0.plan.qty, q1: L1.plan.qty, saved, under: L1.plan.stop < L0.plan.stop ? '' : await under(X, yOf(L0, 'sl')), hud: await page.evaluate(() => { const h = document.querySelector('.pm-odhud'); if (!h) return null; const r = h.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), h.className]; }), box: L0.box, ysl: yOf(L0, 'sl') }));
    ok(`[${tag}] the chart does not pan or zoom while a line is dragged`, L1.range === L0.range, L0.range + ' → ' + L1.range);
    /* drag the first entry up 20 px: the average follows */
    await drag(yOf(L1, 'e0'), -20, phone);
    const L2 = await live();
    ok(`[${tag}] dragging an entry moves it and the average follows`, +L2.st.entries[0].p > +L1.st.entries[0].p && L2.plan.avg > L1.plan.avg && !L2.plan.err, JSON.stringify({ e1: L1.st.entries[0].p, e2: L2.st.entries[0].p, a1: L1.plan.avg, a2: L2.plan.avg, err: L2.plan.err }));
    /* undo puts the entry back */
    await page.click('.pm-odhud [data-a="undo"]'); await page.waitForTimeout(150);
    const L3 = await live();
    ok(`[${tag}] Undo on the panel puts the last change back`, L3.st.entries[0].p === L1.st.entries[0].p && Math.abs(L3.plan.avg - L1.plan.avg) < 1e-9, JSON.stringify({ e: L3.st.entries[0].p, want: L1.st.entries[0].p }));
    /* Escape while a line is held puts it back */
    if (!phone) {
      const y = yOf(L3, 'sl'), X = await xFree(y), sgn = y - L0.box.t + 40 > paneH - 30 ? -1 : 1; await page.mouse.move(X, y); await page.mouse.down(); for (let i = 1; i <= 4; i++) await page.mouse.move(X, y + sgn * 10 * i);
      const mid = await live(); await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(150);
      const L4 = await live();
      ok(`[${tag}] Escape while dragging puts the line back where it was`, mid.plan.stop !== L3.plan.stop && Math.abs(L4.plan.stop - L3.plan.stop) < 1e-9 && L4.range === L3.range, JSON.stringify({ mid: mid.plan.stop, back: L4.plan.stop, want: L3.plan.stop }));
    }
    /* tap "+ Target", then the chart above the last target: a new exit at that price */
    let Lb = await live();
    /* a price between the average entry and the highest target that is on screen */
    const tapP = await page.evaluate(() => { const L = PRO.odmLive(), c = PRO.app.active(), xs = L.levels.filter(l => /^x/.test(l.k)).map(l => l.p), a = L.plan.avg, top = Math.max(...xs);
      const yA = c.main.priceToCoordinate(a), yTop = Math.max(24, c.main.priceToCoordinate(top)); const ys = L.levels.map(l => l.y);
      let best = null, bd = -1; for (let y = yTop; y < yA - 8; y += 3) { const d = Math.min(...ys.map(z => Math.abs(z - y))); if (d > bd) { bd = d; best = y; } } return best == null ? null : { y: best, p: c.main.coordinateToPrice(best) }; });
    const yT = tapP ? tapP.y : null;
    await page.click('.pm-odhud [data-pk="x"]'); await page.waitForTimeout(80);
    const pk = await page.evaluate(() => ({ on: document.querySelector('.pm-odhud [data-pk="x"]').classList.contains('on'), cls: PRO.app.active().el.classList.contains('pm-odpick'), msg: document.querySelector('.pm-odhud .pm-odhm').textContent }));
    ok(`[${tag}] "+ Target" waits for a tap and says so`, pk.on && pk.cls && pk.msg === (await T('odPick_x')), JSON.stringify(pk));
    if (yT != null && yT > 10) {
      await page.mouse.click(await xFree(Lb.box.t + yT), Lb.box.t + yT);
      await page.waitForTimeout(150);
      const L5 = await live(), nx = L5.st.exits.filter(x => x.v !== '' && +x.q > 0);
      ok(`[${tag}] a tap on the chart adds the target at that price, in order, and the panel stops waiting`, L5.st.exits.length === Lb.st.exits.length + 1 && !L5.plan.err && L5.plan.nx === Lb.plan.nx + 1 && nx.some(x => x.mode === 'price' && Math.abs(+x.v / tapP.p - 1) < 0.002) && !L5.pick && Math.abs(nx.reduce((s, x) => s + +x.q, 0) - 100) < 0.01, JSON.stringify({ n0: Lb.st.exits.length, n1: L5.st.exits.length, err: L5.plan.err, ex: L5.st.exits, tapP }));
      Lb = L5;
    } else ok(`[${tag}] room above the last target to tap`, false, String(yT));
    /* tap "Stop" and then a price above the entries: the plan refuses it, says why, and the stop line stays to be dragged back */
    const yBad = await page.evaluate(() => { const L = PRO.odmLive(), e = Math.max(...L.levels.filter(l => /^e/.test(l.k)).map(l => l.p)), x = Math.min(...L.levels.filter(l => /^x/.test(l.k)).map(l => l.p)); return PRO.app.active().main.priceToCoordinate((e + x) / 2); });
    await page.click('.pm-odhud [data-pk="s"]'); await page.waitForTimeout(60);
    await page.mouse.click(await xFree(Lb.box.t + yBad), Lb.box.t + yBad);
    await page.waitForTimeout(150);
    const L6 = await live();
    ok(`[${tag}] a stop on the wrong side is refused with the reason, and its line stays on the chart`, L6.plan.err === 'side' && L6.msgDn && L6.msg === (await T('odE_side')) && L6.levels.some(l => l.k === 'sl'), JSON.stringify({ err: L6.plan.err, msg: L6.msg, k: L6.levels.map(l => l.k) }));
    await page.click('.pm-odhud [data-a="undo"]'); await page.waitForTimeout(150);
    ok(`[${tag}] Undo brings the working plan back`, !(await live()).plan.err, '');

    /* the right-click menu */
    await page.evaluate(() => { const c = PRO.app.active(), L = PRO.odmLive(); PRO.addPriceAlert(c.cfg.sym, L.plan.stop, 'down', 'ODM SL'); PRO.addPriceAlert(c.cfg.sym, L.plan.exits[0].p, 'up', 'ODM TP1'); });
    const freeY = async () => page.evaluate(() => {
      const c = PRO.app.active(), L = PRO.odmLive(), ys = (L ? L.levels.map(l => l.y) : []).concat(PRO.alertLines(c.cfg.sym).map(a => c.main.priceToCoordinate(a.v))).filter(y => y != null), h = c.box.getBoundingClientRect().height;
      const hu = document.querySelector('.pm-odhud'), bt = c.box.getBoundingClientRect().top, hr = hu ? hu.getBoundingClientRect() : null;
      let best = 40, bd = -1; for (let y = 30; y < h - 60; y += 4) { if (hr && y >= hr.top - bt - 8 && y <= hr.bottom - bt + 8) continue; const d = Math.min(...ys.map(z => Math.abs(z - y)), 999); if (d > bd) { bd = d; best = y; } } return best;
    });
    const rclick = async (y, x) => { await page.mouse.click(x || X, L0.box.t + y, { button: 'right' }); await page.waitForSelector('.pm-menu .pm-mi', { timeout: 3000 }).catch(() => { }); await page.waitForTimeout(80); };
    const menuTxt = () => page.evaluate(() => ({ heads: [...document.querySelectorAll('.pm-menu .pm-mh')].map(x => x.textContent), items: [...document.querySelectorAll('.pm-menu .pm-mi')].map(x => x.querySelector('span').textContent + '|' + ((x.querySelector('small') || {}).textContent || '') + '|' + x.disabled), fits: (() => { const m = document.querySelector('.pm-menu'); if (!m) return false; const r = m.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; })() }));
    const pickMenu = t => page.evaluate(t => { const b = [...document.querySelectorAll('.pm-menu .pm-mi')].find(x => x.querySelector('span').textContent === t); if (!b) return false; b.click(); return true; }, t);
    const undoToast = () => page.evaluate(() => { const b = document.querySelector('.pm-toast .pm-tbtn'); if (!b) return false; b.click(); return true; });
    const Tk = {}; for (const k of ['ctxRemoveH', 'ctxOdmLv', 'ctxAlAll', 'ctxOdmHide', 'ctxOpenOdm', 'ctxAlDel', 'ctxIndOne', 'ctxDrwOne', 'ctxClearAll', 'undo', 'ctxBack']) Tk[k] = await T(k);
    let fy = await freeY(); await rclick(fy);
    let M = await menuTxt();
    const has = (M, k) => M.items.some(s => s.split('|')[0] === Tk[k]);
    ok(`[${tag}] right-click shows "Remove from chart" with "ODM levels and their alerts" (one item) and this coin's alerts`, M.heads.includes(Tk.ctxRemoveH) && has(M, 'ctxOdmLv') && has(M, 'ctxAlAll') && M.fits && !M.items.some(s => /ODM/.test(s) && ![Tk.ctxOdmLv, Tk.ctxOpenOdm, Tk.ctxOdmHide].includes(s.split('|')[0])), JSON.stringify(M));
    await shot(page, `88b_ctx_remove_${lang}_${vw}`);
    await pickMenu(Tk.ctxOdmLv); await page.waitForTimeout(120);
    const odmAl = () => page.evaluate(() => ({ al: PRO._alerts().filter(a => /^ODM /.test(a.msg || '')).length, ov: PRO.alertLines(PRO.app.active().cfg.sym).filter(a => a.odm).length, n: PRO.odmLinesShown(), pl: PRO.app.active().main.priceLines().length, hud: !!document.querySelector('.pm-odhud'), t: (document.querySelector('.pm-toast') || {}).textContent || '' }));
    const g1 = await odmAl();
    ok(`[${tag}] "ODM levels and their alerts" takes every ODM line, the panel, the ODM alerts and their 🔔 lines off the chart in one go, and offers Undo`, g1.n === 0 && g1.pl === 0 && !g1.hud && g1.al === 0 && g1.ov === 0 && g1.t.includes(Tk.undo), JSON.stringify(g1));
    await undoToast(); await page.waitForTimeout(150);
    const g1b = await odmAl();
    ok(`[${tag}] Undo draws the ODM levels again and brings their alerts back`, g1b.n >= 7 && g1b.al === 2 && g1b.ov === 2, JSON.stringify(g1b));
    /* right-click on the stop line itself */
    const Ls = await live(), ySl = Ls.levels.find(l => l.k === 'sl').y; await rclick(ySl, await xFree(L0.box.t + ySl));
    M = await menuTxt();
    ok(`[${tag}] right-click on an ODM line names it and offers Open ODM and Remove`, M.heads[0] && M.heads[0].startsWith('ODM · SL') && has(M, 'ctxOpenOdm') && has(M, 'ctxOdmHide'), JSON.stringify(M.heads));
    await pickMenu(Tk.ctxOdmHide); await page.waitForTimeout(120);
    const g1c = await odmAl();
    ok(`[${tag}] "Remove" on the line takes the ODM levels and their alerts off together`, g1c.n === 0 && g1c.pl === 0 && g1c.al === 0 && g1c.ov === 0, JSON.stringify(g1c));
    await undoToast(); await page.waitForTimeout(150);
    ok(`[${tag}] Undo brings both back`, (await odmAl()).al === 2 && (await odmAl()).n >= 7, '');
    /* inside the position box, away from any line: the position's own menu */
    {
      const zp = await page.evaluate(() => { const Z = PRO.odmZone(), L = PRO.odmLive(), c = PRO.app.active(), ys = L.levels.map(l => l.y).concat(PRO.alertLines(c.cfg.sym).map(a => c.main.priceToCoordinate(a.v))), hu = document.querySelector('.pm-odhud'), bt = c.box.getBoundingClientRect().top, hr = hu ? hu.getBoundingClientRect() : null;
        let best = null, bd = -1; const bx = c.box.getBoundingClientRect().left + Z.x0 + (Z.x1 - Z.x0) * 0.75; for (let y = Z.top + 4; y < Z.bot - 4; y += 3) { if (hr && y >= hr.top - bt - 8 && y <= hr.bottom - bt + 8) continue; const el = document.elementFromPoint(bx, bt + y); if (!el || !el.closest('.pm-chart')) continue; const d = Math.min(...ys.filter(v => v != null).map(v => Math.abs(v - y))); if (d > bd) { bd = d; best = y; } }
        return best == null ? null : { x: c.box.getBoundingClientRect().left + Z.x0 + (Z.x1 - Z.x0) * 0.75, y: best, d: bd, side: PRO.app.T(L.plan.stop < L.plan.avg ? 'odZLong' : 'odZShort') }; });
      if (zp && zp.d > 8) {
        await rclick(zp.y, zp.x); M = await menuTxt();
        ok(`[${tag}] right-click inside the position box offers Open ODM and Remove for the position`, M.heads[0] && M.heads[0].startsWith('ODM · ' + zp.side) && has(M, 'ctxOdmHide'), JSON.stringify({ heads: M.heads, zp, under: M.heads.length ? '' : await under(zp.x, L0.box.t + zp.y) }));
        await page.keyboard.press('Escape'); await page.waitForTimeout(80);
      } else ok(`[${tag}] room inside the box to right-click`, false, JSON.stringify(zp));
    }
    /* a plain alert line under the cursor */
    fy = await freeY();
    await page.evaluate(y => { const c = PRO.app.active(); PRO.addPriceAlert(c.cfg.sym, c.main.coordinateToPrice(y), 'cross', ''); }, fy);
    await rclick(fy); M = await menuTxt();
    ok(`[${tag}] right-click on an alert line offers to delete that alert`, M.heads[0] && M.heads[0].startsWith('🔔') && has(M, 'ctxAlDel'), JSON.stringify(M.heads));
    const nAl0 = await page.evaluate(() => PRO._alerts().length);
    await pickMenu(Tk.ctxAlDel); await page.waitForTimeout(120);
    ok(`[${tag}] "Delete this alert" deletes that one alert only`, (await page.evaluate(() => PRO._alerts().length)) === nAl0 - 1 && (await page.evaluate(() => PRO._alerts().filter(a => /^ODM /.test(a.msg || '')).length)) === 2, '');
    /* the ODM window: one "Hide from chart" button that takes the lines and their alerts away; no separate alerts button */
    await page.evaluate(() => document.querySelector('#pm-odm').click()); await page.waitForSelector('.pm-odm', { timeout: 5000 }); await page.waitForTimeout(200);
    const hdT = await T('odHide');
    const dbtn = await page.evaluate(() => [...document.querySelectorAll('.pm-odact button')].map(x => ({ t: x.textContent.trim(), h: x.hidden })));
    ok(`[${tag}] the ODM window shows "Hide from chart" and no separate alerts button`, dbtn.some(b => b.t === hdT && !b.h) && !dbtn.some(b => /ODM/.test(b.t) && b.t !== hdT), JSON.stringify(dbtn));
    await page.evaluate(t => { const b = [...document.querySelectorAll('.pm-odact button')].find(b => b.textContent.trim() === t); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, hdT); await page.waitForTimeout(150);
    const g2 = await odmAl();
    ok(`[${tag}] "Hide from chart" clears the ODM lines, the ODM alerts and their 🔔 lines from the chart`, g2.al === 0 && g2.n === 0 && g2.pl === 0 && g2.ov === 0, JSON.stringify(g2));
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    /* indicators and drawings, one at a time or all together */
    await page.evaluate(() => { document.querySelector('#pm-ind').click(); });
    await page.waitForSelector('.pm-idi[data-id="bb"]', { timeout: 5000 }).catch(() => { });
    await page.evaluate(() => { document.querySelector('.pm-idi[data-id="bb"]').click(); });
    await page.evaluate(() => { const ch = document.querySelectorAll('.pm-idt .pm-chip')[1]; if (ch) ch.click(); });
    await page.waitForTimeout(100); await page.evaluate(() => { const r = document.querySelector('.pm-idi[data-id="rsi"]'); if (r) r.click(); });
    await page.evaluate(() => PRO.app.closeModal()); await page.waitForTimeout(400);
    await page.evaluate(() => { const c = PRO.app.active(), s = c.cfg.sym, t = c.disp[c.disp.length - 30].t, p = c.disp[c.disp.length - 1].c; PRO.app.mutate(s, L => { L.push({ id: 'h1', k: 'hline', pts: [{ t, p: p * 0.97 }], s: { c: '#f7931a', w: 1, d: 0, x: '' } }); L.push({ id: 'h2', k: 'hline', pts: [{ t, p: p * 1.03 }], s: { c: '#f7931a', w: 1, d: 0, x: '' } }); }); });
    const i0 = await page.evaluate(() => PRO.app.active().cfg.inds.map(x => x.id));
    fy = await freeY(); await rclick(fy); M = await menuTxt();
    ok(`[${tag}] right-click offers one indicator, one drawing, or clearing the whole chart`, has(M, 'ctxIndOne') && has(M, 'ctxDrwOne') && has(M, 'ctxClearAll'), JSON.stringify({ i0, M }));
    await pickMenu(Tk.ctxIndOne); await page.waitForTimeout(100);
    const sub = await menuTxt();
    ok(`[${tag}] "An indicator…" lists each indicator with Back`, sub.items.length >= i0.length + 2 && sub.items.some(s => s.startsWith(Tk.ctxBack + '|')) && sub.fits, JSON.stringify(sub));
    await page.evaluate(() => [...document.querySelectorAll('.pm-menu .pm-mi')][0].click()); await page.waitForTimeout(200);
    const i1 = await page.evaluate(() => PRO.app.active().cfg.inds.map(x => x.id));
    await undoToast(); await page.waitForTimeout(200);
    const i2 = await page.evaluate(() => PRO.app.active().cfg.inds.map(x => x.id));
    ok(`[${tag}] removing one indicator leaves the others, and Undo puts it back`, i0.length >= 2 && i1.length === i0.length - 1 && JSON.stringify(i2) === JSON.stringify(i0), JSON.stringify({ i0, i1, i2 }));
    await rclick(await freeY()); await pickMenu(Tk.ctxDrwOne); await page.waitForTimeout(100);
    await page.evaluate(() => [...document.querySelectorAll('.pm-menu .pm-mi')][0].click()); await page.waitForTimeout(200);
    const d1 = await page.evaluate(() => (PRO.app.DRAW()[PRO.app.active().cfg.sym] || []).map(x => x.id));
    ok(`[${tag}] removing one drawing from the list removes the newest one only`, JSON.stringify(d1) === '["h1"]', JSON.stringify(d1));
    await undoToast(); await page.waitForTimeout(150);
    await rclick(await freeY()); await pickMenu(Tk.ctxClearAll); await page.waitForTimeout(150);
    await page.evaluate(() => document.querySelector('.pm-modal [data-y]').click()); await page.waitForTimeout(250);
    const cl = await page.evaluate(() => ({ d: (PRO.app.DRAW()[PRO.app.active().cfg.sym] || []).length, i: PRO.app.active().cfg.inds.length }));
    await undoToast(); await page.waitForTimeout(250);
    const cl2 = await page.evaluate(() => ({ d: (PRO.app.DRAW()[PRO.app.active().cfg.sym] || []).length, i: PRO.app.active().cfg.inds.length }));
    ok(`[${tag}] "Clear the whole chart" asks first, clears drawings and indicators, and Undo brings both back`, cl.d === 0 && cl.i === 0 && cl2.d === 2 && cl2.i === i0.length, JSON.stringify({ cl, cl2 }));
    ok(`[${tag}] no JS errors on the chart or in the menu`, errors.length === e0, errors.slice(e0).join(' || '));
    await ctx.close();
  }

  /* ---------- ODM on the chart, as Omid asked on the call: the chart pans, zooms and changes timeframe with ODM on; a click selects
     the position and never removes it; the box is closed by default with a right edge to drag, and can be extended on demand */
  if (!ONLY || ONLY === 'cd' || ONLY === 'odm' || ONLY === 'odp') for (const [vw, vh, lang] of [[1280, 860, 'en'], [1024, 768, 'fa'], [390, 800, 'ar'], [390, 800, 'ckb']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `odm pan ${lang} ${vw}`, e0 = errors.length, phone = vw < 600;
    const T = k => page.evaluate(k => PRO.app.T(k), k);
    const cdp = phone ? await ctx.newCDPSession(page) : null;
    if (cdp) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await page.evaluate(() => { localStorage.removeItem('ek_pro_odm'); document.querySelector('#pm-odm').click(); });
    await page.waitForSelector('.pm-odm .pm-odt', { timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(300);
    const showT = await T('odShow');
    await page.evaluate(t => [...document.querySelectorAll('.pm-odact button')].find(b => b.textContent.trim() === t).click(), showT);
    await page.waitForTimeout(500);
    const st = () => page.evaluate(() => { const c = PRO.app.active(), r = c.box.getBoundingClientRect(), vr = c.chart.timeScale().getVisibleLogicalRange(), o = c.chart.options(), Z = PRO.odmZone(), L = PRO.odmLive();
      return { n: PRO.odmLinesShown(), pl: c.main.priceLines().length, Z, stop: L && L.plan.stop, avg: L && L.plan.avg, from: vr ? vr.from : null, to: vr ? vr.to : null, tf: c.cfg.tf, free: !!(o.handleScroll && o.handleScroll.pressedMouseMove && o.handleScale && o.handleScale.mouseWheel), box: { l: r.left, t: r.top, w: r.width, h: r.height }, ys: L ? L.levels.map(l => l.y).filter(y => y != null) : [], hud: (() => { const h = document.querySelector('.pm-odhud'); if (!h) return null; const q = h.getBoundingClientRect(); return { t: q.top, b: q.bottom }; })() }; });
    /* a point with no ODM line, handle, label or panel near it; inside the box when asked */
    const freePt = (S, inBox) => page.evaluate(([S, inBox]) => {
      const Z = S.Z, b = S.box, labs = [...document.querySelectorAll('.pm-odz span,.pm-odhud,.pm-leg,.pm-toast,.pm-selbar')].map(e => e.getBoundingClientRect());
      const okp = (x, y) => { const X = b.l + x, Y = b.t + y; if (labs.some(r => X >= r.left - 6 && X <= r.right + 6 && Y >= r.top - 6 && Y <= r.bottom + 6)) return false; if (S.ys.some(v => Math.abs(v - y) < 15)) return false; if (Z && (Math.abs(x - Z.x0) < 26 || Math.abs(x - Z.x1) < 26) && Math.abs(y - Z.ya) < 26) return false; const el = document.elementFromPoint(X, Y); return !!(el && el.closest('.pm-chart')); };
      const x0 = inBox ? Z.x0 + 8 : 20, x1 = inBox ? Z.x1 - 8 : b.w - 90, y0 = inBox ? Z.top + 6 : 30, y1 = inBox ? Z.bot - 6 : b.h - 60;
      for (let y = y0; y < y1; y += 5) for (let x = x0; x < x1; x += 7) { if (!inBox && Z && x >= Z.x0 - 10 && x <= Z.x1 + 10 && y >= Z.top - 10 && y <= Z.bot + 10) continue; if (okp(x, y)) return { x: b.l + x, y: b.t + y }; }
      return null; }, [S, inBox]);
    const mdrag = async (x, y, dx, dy) => { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(x + dx * i / 8, y + dy * i / 8); await page.mouse.up(); await page.waitForTimeout(200); };
    const tdrag = async (x, y, dx, dy) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 8, y: y + dy * i / 8 }] }); await page.waitForTimeout(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(300); };
    const tap = async (x, y) => { if (phone) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } else await page.mouse.click(x, y); await page.waitForTimeout(200); };
    const pan = (x, y, dx, dy) => phone ? tdrag(x, y, dx, dy) : mdrag(x, y, dx, dy);
    let S0 = await st();
    ok(`[${tag}] the position box is closed by default: it ends at its own candle, with a handle on its right edge`, S0.n >= 7 && S0.Z && S0.Z.end && !S0.Z.ext && S0.Z.x1 < S0.box.w - 2 && S0.Z.zEnd > S0.Z.anchor, JSON.stringify({ n: S0.n, Z: S0.Z && { x0: S0.Z.x0, x1: S0.Z.x1, end: S0.Z.end, ext: S0.Z.ext }, w: S0.box.w }));
    await shot(page, `94_odm_closed_${lang}_${vw}`);
    /* a click (a tap on a phone) inside the box: the position is selected, nothing is removed and no level moves */
    let pin = await freePt(S0, true);
    if (pin) {
      await tap(pin.x, pin.y);
      const S1 = await st();
      ok(`[${tag}] a ${phone ? 'tap' : 'click'} inside the position selects it and removes nothing`, S1.n === S0.n && S1.pl === S0.pl && S1.Z && S1.Z.sel && S1.stop === S0.stop && S1.avg === S0.avg, JSON.stringify({ n0: S0.n, n1: S1.n, sel: S1.Z && S1.Z.sel }));
      await shot(page, `94b_odm_selected_${lang}_${vw}`);
    } else ok(`[${tag}] room inside the box to click`, false, JSON.stringify(S0.Z));
    /* a click on a line itself: it stays where it was, and the position is still on the chart */
    {
      const S = await st(), L = await page.evaluate(() => PRO.odmLive().levels.find(l => l.k === 'sl')), X = S.box.l + (S.Z ? (S.Z.x0 + S.Z.x1) / 2 : S.box.w / 2);
      if (L && L.y > 10 && L.y < S.box.h - 30) { await tap(X, S.box.t + L.y); const S2 = await st(); ok(`[${tag}] a ${phone ? 'tap' : 'click'} on the stop line leaves the stop and the position as they were`, S2.n === S.n && S2.stop === S.stop && S2.avg === S.avg, JSON.stringify({ s0: S.stop, s1: S2.stop, n: S2.n })); }
    }
    /* dragging the chart, inside the box and outside it, pans it; with a finger even across the lines */
    for (const where of ['in', 'out']) {
      const S = await st(), p = await freePt(S, where === 'in');
      if (!p) { ok(`[${tag}] room ${where} the box to drag`, false, ''); continue; }
      await pan(p.x, p.y, phone ? 120 : 160, 0);
      const S2 = await st();
      ok(`[${tag}] dragging the chart ${where === 'in' ? 'inside' : 'outside'} the position pans it back in time with ODM on`, S2.from != null && S2.from < S.from - 2 && S2.n === S.n && S2.free && S2.stop === S.stop, JSON.stringify({ from: S.from, to: S2.from, free: S2.free, n: S2.n }));
    }
    if (phone) {
      const S = await st(), sl = await page.evaluate(() => PRO.odmLive().levels.find(l => l.k === 'sl')), x = S.box.l + S.box.w * 0.3;
      await tap(S.box.l + 30, S.box.t + 40);   /* let the position go first */
      const S1 = await st();
      if (sl && sl.y > 20 && sl.y < S.box.h - 40) { await tdrag(x, S.box.t + sl.y, 110, 0); const S2 = await st(); ok(`[${tag}] a swipe that starts on an ODM line pans the chart when the position is not selected`, S2.from < S1.from - 2 && S2.stop === S1.stop && S2.n === S1.n, JSON.stringify({ f0: S1.from, f1: S2.from, s0: S1.stop, s1: S2.stop })); }
    } else {
      const S = await st(), p = await freePt(S, false);
      await page.mouse.move(p.x, p.y); for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(60); } await page.waitForTimeout(250);
      const S2 = await st();
      ok(`[${tag}] the mouse wheel zooms the chart with ODM on`, Math.abs((S2.to - S2.from) - (S.to - S.from)) > 1 && S2.n === S.n, JSON.stringify({ w0: S.to - S.from, w1: S2.to - S2.from }));
    }
    /* the right edge: dragged to resize, extended to the chart's edge on demand and closed again; Undo after each */
    {
      /* the whole box in view, with room on its right */
      await page.evaluate(() => { const c = PRO.app.active(), Z = PRO.odmZone(), D = c.disp, sec = c.tfSec(), a = PRO.t2l(D, Z.anchor, sec), e = PRO.t2l(D, Z.zEnd, sec), w = Math.max(30, (e - a) * 4); c.chart.timeScale().setVisibleLogicalRange({ from: a - w * 0.3, to: e + w * 0.45 }); });
      await page.waitForTimeout(300);
      let S = await st();
      const Z = S.Z, hx = S.box.l + Z.x1, hy = S.box.t + Z.ya, dx = Z.x1 + 80 < S.box.w - 10 ? 60 : -Math.min(60, (Z.x1 - Z.x0) / 2);
      if (phone) { await tap(S.box.l + (Z.x0 + Z.x1) / 2, S.box.t + (Z.top + Z.ya) / 2); await tdrag(hx, hy, dx, 0); } else await mdrag(hx, hy, dx, 0);
      const S2 = await st();
      ok(`[${tag}] dragging the handle on the right edge resizes the box and leaves its start and the levels as they were`, S2.Z && Math.abs((S2.Z.x1 - Z.x1) - dx) < 16 && Math.abs(S2.Z.x0 - Z.x0) < 2 && S2.Z.anchor === Z.anchor && S2.stop === S.stop && Math.abs(S2.from - S.from) < 0.5, JSON.stringify({ x1: Z.x1, x1b: S2.Z && S2.Z.x1, dx, x0: Z.x0, x0b: S2.Z && S2.Z.x0, f: [S.from, S2.from] }));
      const extT = await T('odExt');
      const eb = await page.evaluate(() => { const b = document.querySelector('.pm-odhud [data-a="ext"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { t: b.title, p: b.getAttribute('aria-pressed'), x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
      ok(`[${tag}] the panel has an "extend to the right edge" button`, eb && eb.t === extT && eb.p === 'false' && eb.w >= (phone ? 28 : 22), JSON.stringify(eb));
      if (eb) {
        await page.mouse.click(eb.x, eb.y); await page.waitForTimeout(200);
        const S3 = await st(), on = await page.evaluate(() => document.querySelector('.pm-odhud [data-a="ext"]').getAttribute('aria-pressed'));
        ok(`[${tag}] "Extend" runs the box to the chart's right edge, and the button shows it is on`, S3.Z && S3.Z.ext && Math.abs(S3.Z.x1 - S3.box.w) < 80 && !S3.Z.end && on === 'true' && S3.n === S.n, JSON.stringify({ x1: S3.Z && S3.Z.x1, w: S3.box.w, on }));
        await shot(page, `94c_odm_extended_${lang}_${vw}`);
        await page.mouse.click(eb.x, eb.y); await page.waitForTimeout(200);
        const S4 = await st();
        ok(`[${tag}] pressing it again closes the box at its own right edge again`, S4.Z && !S4.Z.ext && S4.Z.end && Math.abs(S4.Z.x1 - S2.Z.x1) < 3, JSON.stringify({ x1: S4.Z && S4.Z.x1, want: S2.Z && S2.Z.x1 }));
      }
    }
    /* another timeframe with ODM on: the chart is free, it pans back in time, and the lines and the box are still there */
    {
      const S = await st();
      const want = S.tf === '4h' ? '1h' : '4h';
      let clicked = await page.evaluate(w => { const b = [...document.querySelectorAll('[data-tf="' + w + '"]')].find(e => e.offsetParent && e.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, want);
      if (!clicked) { await page.click('#pm-tfs .pm-tf.on').catch(() => { }); await page.waitForTimeout(300); await page.fill('.pm-tfc input', want).catch(() => { }); await page.press('.pm-tfc input', 'Enter').catch(() => { }); clicked = 'typed'; }
      if (clicked && clicked.x != null) await page.mouse.click(clicked.x, clicked.y);
      await page.waitForFunction(w => PRO.app.active().cfg.tf === w && PRO.app.active().disp.length > 100, want, { timeout: 10000 }).catch(() => { });
      await page.waitForTimeout(500);
      const S1 = await st();
      ok(`[${tag}] after a real click on another timeframe the ODM lines and the box are still on the chart and the chart is free`, S1.tf === want && S1.n === S.n && S1.pl === S.pl && S1.Z && S1.free, JSON.stringify({ tf: S1.tf, want, n: S1.n, pl: S1.pl, Z: !!S1.Z, free: S1.free, clicked: !!clicked }));
      const p = (await freePt(S1, false)) || (await freePt(S1, true));   /* in a shorter timeframe the box can fill the view */
      if (p) { await pan(p.x, p.y, phone ? 130 : 180, 0); const S2 = await st(); ok(`[${tag}] after the timeframe change the chart still pans back into history with ODM on`, S2.from < S1.from - 2 && S2.n === S1.n, JSON.stringify({ f0: S1.from, f1: S2.from })); }
      else ok(`[${tag}] room to drag after the timeframe change`, false, '');
      const S2b = await st(), p2 = (await freePt(S2b, false)) || (await freePt(S2b, true));
      if (p2) { await pan(p2.x, p2.y, 0, phone ? 90 : 120); const S3 = await st(); ok(`[${tag}] dragging up and down with ODM on moves the chart, not the plan`, S3.stop === S1.stop && S3.avg === S1.avg && S3.n === S1.n && S3.free, JSON.stringify({ s: [S1.stop, S3.stop] })); }
    }
    /* only an explicit act removes the position: Delete on the selected position (desktop) or the panel's bin, both with Undo */
    {
      const S = await st(), p = await freePt(S, true);
      if (!phone && p) {
        await page.mouse.click(p.x, p.y); await page.waitForTimeout(150); await page.keyboard.press('Delete'); await page.waitForTimeout(200);
        const S1 = await st(), tt = await page.evaluate(() => (document.querySelector('.pm-toast') || {}).textContent || '');
        ok(`[${tag}] Delete on the selected position removes it and offers Undo`, S1.n === 0 && tt.includes(await T('undo')), JSON.stringify({ n: S1.n, tt }));
        await page.evaluate(() => { const b = document.querySelector('.pm-toast .pm-tbtn'); if (b) b.click(); }); await page.waitForTimeout(250);
        ok(`[${tag}] Undo brings the position back`, (await st()).n === S.n, '');
      }
      const rm = await page.evaluate(() => { const b = document.querySelector('.pm-odhud [data-a="hide"]'); return b ? { t: b.title, ic: !!b.querySelector('svg') } : null; });
      ok(`[${tag}] the panel's remove button says what it does`, rm && rm.t === (await T('odRemove')), JSON.stringify(rm));
    }
    ok(`[${tag}] no JS errors while panning, zooming and changing timeframe with ODM on`, errors.length === e0, errors.slice(e0).join(' || '));
    await ctx.close();
  }

  /* ---------- ODM's guided tour: offered once, one step per part, the part lit and in view, Back/Next/Done, keys, Escape */
  if (!ONLY || ONLY === 'cd' || ONLY === 'odm' || ONLY === 'otr') for (const [vw, vh, lang] of [[1280, 860, 'en'], [1024, 768, 'fa'], [390, 800, 'ar'], [390, 800, 'ckb']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `odm tour ${lang} ${vw}`, e0 = errors.length, phone = vw < 600;
    await page.evaluate(() => { localStorage.removeItem('ek_pro_odm'); localStorage.removeItem('ek_pro_odtour'); document.querySelector('#pm-odm').click(); });
    await page.waitForSelector('.pm-odm .pm-odt', { timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(300);
    const of = await page.evaluate(() => { const o = document.querySelector('.pm-odoffer'), g = document.querySelector('.pm-odgo'); return { offer: o ? o.querySelector('p').textContent : null, want: PRO.app.T('odTourOffer'), go: g ? g.textContent.trim() : null, wantGo: PRO.app.T('odGuide') }; });
    ok(`[${tag}] the first time, ODM offers the tour and shows its "Guide me" button`, of.offer === of.want && of.go === of.wantGo, JSON.stringify(of));
    await page.evaluate(() => document.querySelector('.pm-odoffer [data-a="go"]').click()); await page.waitForTimeout(250);
    const step = () => page.evaluate(() => {
      const b = document.querySelector('.pm-odtour'), t = document.querySelector('.pm-odtgt'), body = document.querySelector('.pm-mbody'); if (!b || !t) return { b: !!b, t: !!t };
      const br = b.getBoundingClientRect(), tr = t.getBoundingClientRect(), vr = body.getBoundingClientRect(), A = PRO.odTour.active();
      const hd0 = document.getElementById('ekh'), hb0 = hd0 && /fixed|sticky/.test(getComputedStyle(hd0).position) ? hd0.getBoundingClientRect().bottom : 0, visTop = Math.max(vr.top, 0, hb0), visBot = Math.min(vr.bottom, innerHeight, b.classList.contains('sheet') ? br.top : 1e9);
      const shown = Math.min(tr.bottom, visBot) - Math.max(tr.top, visTop);
      const overlap = !b.classList.contains('sheet') && !(br.bottom <= tr.top + 1 || br.top >= tr.bottom - 1 || br.right <= tr.left + 1 || br.left >= tr.right - 1) && br.top < Math.max(tr.top, visTop) + 40;
      const hd = document.getElementById('ekh'), hb = hd && /fixed|sticky/.test(getComputedStyle(hd).position) ? hd.getBoundingClientRect().bottom : 0;
      return { k: A.k, i: A.i, n: A.n, n1: b.querySelector('small').textContent, title: b.querySelector('b').textContent, text: b.querySelector('p').textContent, next: b.querySelector('[data-a="next"]').textContent, back: b.querySelector('[data-a="back"]').disabled,
        hit: (() => { const n = b.querySelector('[data-a="next"]').getBoundingClientRect(), el = document.elementFromPoint(n.left + n.width / 2, n.top + n.height / 2); if (el && el.closest('.pm-odtour')) return 'ok'; const out = []; let e = el; for (let i = 0; e && i < 7; i++, e = e.parentElement) { const cs = getComputedStyle(e); out.push(e.tagName + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '') + '[' + cs.position + ',' + cs.zIndex + ']'); } const pr = document.getElementById('pro').getBoundingClientRect(), mr = document.querySelector('.pm-modal').getBoundingClientRect(); return out.join(' < ') + ' @' + Math.round(n.left) + ',' + Math.round(n.top) + ' pro=' + [pr.top, pr.bottom].map(Math.round) + ' modal=' + [mr.top, mr.bottom].map(Math.round); })(),
        br: [Math.round(br.left), Math.round(br.top), Math.round(br.width), Math.round(br.height)], tr: [Math.round(tr.left), Math.round(tr.top), Math.round(tr.width), Math.round(tr.height)], vw: [innerWidth, innerHeight, Math.round(scrollY)],
        sheet: b.classList.contains('sheet'), inView: br.left >= -1 && br.right <= innerWidth + 1 && br.top >= hb - 1 && br.bottom <= innerHeight + 1, hb, seen: shown >= Math.min(40, tr.height - 2), overlap, tall: tr.height > innerHeight * 0.45, dir: b.dir, focus: document.activeElement === b.querySelector('[data-a="next"]') };
    });
    let s = await step(); const seenK = [], bad = [];
    ok(`[${tag}] the tour starts at "Your account", step 1, with Back off and the account part lit`, s.k === 'acc' && s.i === 0 && s.back && s.title === (await page.evaluate(() => PRO.app.T('odTr_acc_t'))) && s.n >= 9 && (phone ? s.sheet : !s.sheet) && s.focus, JSON.stringify(s));
    await shot(page, `89_odm_tour_${lang}_${vw}`);
    for (let i = 0; i < 12 && s && s.k; i++) {
      seenK.push(s.k);
      if (!s.title || !s.text || !s.inView || !s.seen || s.hit !== 'ok' || (s.overlap && !s.tall) || s.n1 !== (await page.evaluate(([i, n]) => PRO.app.T('odTourN', { i, n }), [s.i + 1, s.n]))) bad.push(s);
      if (s.k === 'loss') await shot(page, `89b_odm_tour_loss_${lang}_${vw}`);
      if (s.i === s.n - 1) break;
      await page.evaluate(() => document.querySelector('.pm-odtour [data-a="next"]').click()); await page.waitForTimeout(200); s = await step();
    }
    ok(`[${tag}] every step names its part, keeps it in view and not under its note, and counts "i of n"`, bad.length === 0 && seenK.length === s.n && new Set(seenK).size === seenK.length && seenK.includes('loss') && seenK.includes('act'), JSON.stringify({ seenK, bad: bad.slice(0, 3).map(x => ({ k: x.k, hit: x.hit, br: x.br, tr: x.tr, vw: x.vw, inView: x.inView, seen: x.seen, overlap: x.overlap, sheet: x.sheet })) }));
    ok(`[${tag}] the last step says Done`, s.next === (await page.evaluate(() => PRO.app.T('odTourDone'))), s.next);
    await page.evaluate(() => document.querySelector('.pm-odtour [data-a="next"]').click()); await page.waitForTimeout(150);
    const end = await page.evaluate(() => ({ tour: !!document.querySelector('.pm-odtour'), lit: document.querySelectorAll('.pm-odtgt').length, modal: !!document.querySelector('.pm-odm'), seen: localStorage.getItem('ek_pro_odtour') }));
    ok(`[${tag}] Done closes the tour and leaves ODM open`, !end.tour && !end.lit && end.modal && end.seen === '1', JSON.stringify(end));
    /* opened again: no offer, the button starts it; the arrow key moves on; Escape leaves the tour but not ODM */
    await page.evaluate(() => { PRO.app.closeModal(); document.querySelector('#pm-odm').click(); }); await page.waitForSelector('.pm-odm .pm-odt', { timeout: 8000 }).catch(() => { }); await page.waitForTimeout(250);
    const again = await page.evaluate(() => ({ offer: !!document.querySelector('.pm-odoffer'), go: !!document.querySelector('.pm-odgo') }));
    ok(`[${tag}] once seen, ODM no longer offers the tour but keeps the button`, !again.offer && again.go, JSON.stringify(again));
    await page.evaluate(() => document.querySelector('.pm-odgo').click()); await page.waitForTimeout(200);
    await page.keyboard.press(lang === 'en' ? 'ArrowRight' : 'ArrowLeft'); await page.waitForTimeout(150);
    const k2 = await page.evaluate(() => PRO.odTour.active());
    ok(`[${tag}] the arrow key in the reading direction moves to the next step`, k2 && k2.i === 1, JSON.stringify(k2));
    await page.evaluate(() => document.querySelector('.pm-odtour [data-a="back"]').click()); await page.waitForTimeout(150);
    ok(`[${tag}] Back goes to the step before`, (await page.evaluate(() => PRO.odTour.active().i)) === 0, '');
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    const esc = await page.evaluate(() => ({ tour: !!document.querySelector('.pm-odtour'), modal: !!document.querySelector('.pm-odm'), lit: document.querySelectorAll('.pm-odtgt').length }));
    ok(`[${tag}] Escape leaves the tour, not ODM`, !esc.tour && esc.modal && !esc.lit, JSON.stringify(esc));
    ok(`[${tag}] no JS errors in the tour`, errors.length === e0, errors.slice(e0).join(' || '));
    await ctx.close();
  }

  /* ---------- ODM result tables: one line per header and per number in every language, nothing cut, at desktop, tablet and phone widths */
  if (!ONLY || ONLY === 'cd' || ONLY === 'odm' || ONLY === 'odt') for (const [vw, vh, lang] of [[1280, 860, 'en'], [1024, 768, 'fa'], [900, 800, 'ar'], [390, 800, 'ckb'], [390, 800, 'fa']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `odm tables ${lang} ${vw}`, e0 = errors.length;
    await page.evaluate(() => { localStorage.removeItem('ek_pro_odm'); document.querySelector('#pm-odm').click(); });
    await page.waitForSelector('.pm-odm .pm-odt', { timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const one = (el) => { const r = document.createRange(); if (el.r) r.selectNodeContents(el.r); else r.selectNodeContents(el); const ys = new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))); return ys.size <= 1; };
      const T = PRO.app.T, box = document.querySelector('.pm-mbox'), body = document.querySelector('.pm-mbody');
      const tabs = [...document.querySelectorAll('.pm-odout .pm-odt')].map(t => {
        const w = t.parentElement, ths = [...t.querySelectorAll('th')], tds = [...t.querySelectorAll('td')];
        const txt = (x) => { const r = document.createRange(), t = [...x.childNodes].find(n => n.nodeType === 3); if (!t) return x; return { r: t }; };
        const parts = (x) => x.querySelector('.pm-odpc2,.pm-odl') ? [...x.querySelectorAll('b,small')] : x.querySelector('.pm-odi') ? [txt(x)] : [x];
        return { heads: ths.map(x => x.textContent), multi: ths.concat(tds).flatMap(parts).filter(x => !one(x)).map(x => x.r ? x.r.textContent : x.textContent),
          cut: tds.filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.textContent),
          fits: t.scrollWidth <= w.clientWidth + 1, scrolls: getComputedStyle(w).overflowX === 'auto' };
      });
      const e = document.querySelector('.pm-odout .pm-odt'), ths = e ? [...e.querySelectorAll('th')] : [];
      const loss = e ? [...e.querySelectorAll('tbody tr')].map(r => +r.lastElementChild.querySelector('b').textContent.replace(/[−,\s]/g, '')) : [];
      const bars = e ? [...e.querySelectorAll('.pm-odlb i')].map(i => i.getBoundingClientRect().width / i.parentElement.getBoundingClientRect().width) : [];
      const pct = e ? [...e.querySelectorAll('.pm-odl small')].map(x => parseFloat(x.textContent)) : [];
      const card = (() => { const c = [...document.querySelectorAll('.pm-odout .pm-cor')].find(x => x.querySelector('small').textContent === T('rcMaxLoss')); return c ? +c.querySelector('b').textContent.replace(/[−,\s]/g, '') : null; })();
      return { tabs, bars, pct, tip: ths.length ? [ths[2].title, ths[3].title] : [], want: [T('odAvgAfter'), T('odLossIf')], note: (document.querySelector('.pm-odfn') || {}).textContent || '',
        loss, card, fits: box.getBoundingClientRect().right <= innerWidth + 1 && box.getBoundingClientRect().left >= -1 && body.scrollWidth - body.clientWidth <= 1, w: Math.round(box.getBoundingClientRect().width) };
    });
    ok(`[${tag}] every header and every number in the planner's tables stays on one line`, m.tabs.length >= 2 && m.tabs.every(t => t.multi.length === 0), JSON.stringify(m.tabs.map(t => t.multi)));
    ok(`[${tag}] no number is cut off in any table cell`, m.tabs.every(t => t.cut.length === 0), JSON.stringify(m.tabs.map(t => t.cut)));
    ok(`[${tag}] each table fits its column, or scrolls inside its own box (never clipped)`, m.tabs.every(t => t.fits || t.scrolls), JSON.stringify(m.tabs.map(t => [t.fits, t.scrolls])));
    if (vw >= 900) ok(`[${tag}] on a wide screen the entries and exits tables fit with no scrolling`, m.tabs.slice(0, 2).every(t => t.fits), JSON.stringify({ w: m.w, fits: m.tabs.map(t => t.fits) }));
    ok(`[${tag}] the short headers keep their full wording as a tooltip, explained under the table`, m.tip[0] === m.want[0] && m.tip[1] === m.want[1] && m.note.length > 30, JSON.stringify({ tip: m.tip, note: m.note }));
    ok(`[${tag}] the loss at the stop grows step by step and its last row equals the loss card (risk)`, m.loss.length >= 2 && m.loss.every((v, i) => i === 0 || v > m.loss[i - 1]) && Math.abs(m.loss[m.loss.length - 1] - m.card) < 0.011, JSON.stringify({ loss: m.loss, card: m.card }));
    ok(`[${tag}] the loss column shows each step's share of the full risk as a growing red bar ending full, with its percent`, m.bars.length === m.loss.length && m.bars.every((v, i) => i === 0 || v > m.bars[i - 1]) && Math.abs(m.bars[m.bars.length - 1] - 1) < 0.02 && Math.abs(m.pct[m.pct.length - 1] - 100) < 0.5 && m.pct.every((v, i) => Math.abs(v - m.loss[i] / m.card * 100) < 0.6), JSON.stringify({ bars: m.bars, pct: m.pct, loss: m.loss }));
    ok(`[${tag}] the planner window fits the screen with no sideways scroll`, m.fits, JSON.stringify({ w: m.w }));
    await page.evaluate(() => { const t = document.querySelector('.pm-odout .pm-odt'); if (t) t.scrollIntoView({ block: 'start' }); }); await page.waitForTimeout(200);
    await shot(page, `84b_odm_table_${lang}_${vw}`);
    ok(`[${tag}] no JS errors in the planner tables checks`, errors.length === e0, errors.slice(e0).join(' || '));
    await ctx.close();
  }

  /* ---------- ODM help: an icon of its own on every section, field and result; its card explains, gives an example and
     the user's own numbers, answers questions from the guide, hands the rest to a person; in every language, phone and desktop */
  if (!ONLY || ONLY === 'cd' || ONLY === 'odm' || ONLY === 'odh') for (const [vw, vh, lang] of [[1280, 860, 'en'], [1024, 768, 'fa'], [900, 800, 'ar'], [390, 800, 'ckb'], [390, 800, 'ar']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `odm help ${lang} ${vw}`, e0 = errors.length;
    await page.evaluate(() => { localStorage.removeItem('ek_pro_odm'); document.querySelector('#pm-odm').click(); });
    await page.waitForSelector('.pm-odm .pm-odt', { timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(300);
    const ic = await page.evaluate(() => {
      const B = [...document.querySelectorAll('.pm-odm .pm-odi')], by = {};
      B.forEach(b => { const k = b.getAttribute('data-odh'); (by[k] = by[k] || []).push(b.innerHTML); });
      const keys = Object.keys(by), glyphs = new Set(keys.map(k => by[k][0]));
      return { n: B.length, keys: keys.length, same: keys.every(k => by[k].every(g => g === by[k][0])), unique: glyphs.size === keys.length,
        named: B.every(b => (b.getAttribute('aria-label') || '').length > 6), want: ['acc', 'ent', 'stop', 'exit', 'trail', 'more', 'risk', 'lev', 'fee', 'qty', 'maxloss', 'fills', 'avgso', 'lossat', 'ends'].filter(k => !by[k]) };
    });
    ok(`[${tag}] every section, field and result of the planner has a help icon`, ic.n >= 40 && ic.keys >= 38 && ic.want.length === 0, JSON.stringify(ic));
    ok(`[${tag}] each item's icon is its own picture, and every icon has a spoken name`, ic.unique && ic.same && ic.named, JSON.stringify(ic));
    /* tap the risk field's icon: the card opens, the field itself does not take the tap */
    await page.click('.pm-odin .pm-odi[data-odh="risk"]');
    await page.waitForSelector('.pm-odpop', { timeout: 3000 }).catch(() => { });
    const c1 = await page.evaluate(() => {
      const T = PRO.app.T, p = document.querySelector('.pm-odpop'); if (!p) return null; const r = p.getBoundingClientRect();
      return { title: p.querySelector('.pm-odph b').textContent, want: T('odh_risk_t'), ex: (p.querySelector('.pm-odpe span') || {}).textContent || '', exW: T('odh_risk_e'),
        mine: (p.querySelector('.pm-odpy span') || {}).textContent || '', what: p.querySelectorAll('.pm-odpr').length, ask: !!p.querySelector('.pm-odpa input'),
        sheet: p.classList.contains('sheet'), inView: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1, focusInput: document.activeElement && document.activeElement.matches('.pm-odin input'),
        dir: p.dir, risk: (PRO.odh.ctx || {}).risk,
        under: ['#ekb', '#nxr', '.bnav'].map(q => document.querySelector(q)).filter(n => n && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden' && n.getBoundingClientRect().height > 0).map(n => n.getBoundingClientRect().top).filter(t => t > innerHeight * 0.6 && t < r.bottom - 1) };
    });
    ok(`[${tag}] tapping an icon opens its card: title, what it is, what it is for and an example`, c1 && c1.title === c1.want && c1.what === 2 && c1.ex === c1.exW && c1.ex.length > 10 && c1.ask, JSON.stringify(c1));
    ok(`[${tag}] the card shows the user's own numbers, every placeholder filled`, c1 && c1.mine.length > 5 && !/\{\w+\}/.test(c1.mine) && c1.mine.indexOf(c1.risk) >= 0, JSON.stringify(c1 && { mine: c1.mine, risk: c1.risk }));
    ok(`[${tag}] the card sits inside the screen (a sheet at the bottom on a phone, above the site's bottom bar), in the page's direction, and the field did not take the tap`, c1 && c1.inView && c1.under.length === 0 && (vw < 600 ? c1.sheet : !c1.sheet) && c1.dir === (lang === 'en' ? 'ltr' : 'rtl') && !c1.focusInput, JSON.stringify(c1));
    await shot(page, `85_odm_help_${lang}_${vw}`);
    /* ask the guide one of its own questions, in this language */
    const q1 = await page.evaluate(() => PRO.app.T('odhQ1'));
    await page.fill('.pm-odpa input', q1); await page.click('.pm-odpa button[type=submit]'); await page.waitForTimeout(150);
    const a1 = await page.evaluate(() => { const c = document.querySelector('.pm-odpres .pm-odpc'); return { first: c ? c.textContent : '', want: PRO.app.T('odhA1'), tg: !!document.querySelector('.pm-odptg') }; });
    ok(`[${tag}] the ask box answers a question from the planner's guide, in this language`, a1.first.indexOf(a1.want) >= 0 && a1.tg, JSON.stringify(a1).slice(0, 300));
    await shot(page, `85b_odm_ask_${lang}_${vw}`);
    /* a question the guide cannot answer goes to a person: the question is copied and the support chat opens */
    await page.fill('.pm-odpa input', 'zzqx wwvb'); await page.click('.pm-odpa button[type=submit]'); await page.waitForTimeout(100);
    const a2 = await page.evaluate(() => {
      const none = (document.querySelector('.pm-odpres .pm-odpm') || {}).textContent || '', want = PRO.app.T('odhNone'); let href = '';
      const old = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { href = this.href; };
      document.querySelector('.pm-odptg').click(); HTMLAnchorElement.prototype.click = old;
      return { none: none === want, href, copy: PRO.odh.lastCopy || '' };
    });
    ok(`[${tag}] with no answer in the guide, "Ask a person" copies the question with the item's name and opens the Telegram support chat`, a2.none && a2.href === 'https://t.me/Kurdistan_Coin' && a2.copy.indexOf('zzqx wwvb') >= 0 && a2.copy.indexOf(await page.evaluate(() => PRO.app.T('odh_risk_t'))) >= 0, JSON.stringify(a2));
    /* Escape closes the card, not the planner */
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    const esc1 = await page.evaluate(() => ({ pop: !!document.querySelector('.pm-odpop'), modal: !!document.querySelector('.pm-odm') }));
    ok(`[${tag}] Escape closes the card and leaves the planner open`, !esc1.pop && esc1.modal, JSON.stringify(esc1));
    /* a result card's icon and the loss column's own icon open their cards too */
    await page.evaluate(() => { const b = document.querySelector('.pm-odout th .pm-odi[data-odh="lossat"]'); b.scrollIntoView({ block: 'center' }); });
    await page.click('.pm-odout th .pm-odi[data-odh="lossat"]'); await page.waitForTimeout(150);
    const c2 = await page.evaluate(() => { const p = document.querySelector('.pm-odpop'); return p ? { k: p.getAttribute('data-odh'), t: p.querySelector('.pm-odph b').textContent, want: PRO.app.T('odh_lossat_t'), faq: p.querySelectorAll('.pm-odpf').length } : null; });
    ok(`[${tag}] the loss column's icon explains the column, with the guide's question about it`, c2 && c2.k === 'lossat' && c2.t === c2.want && c2.faq >= 1, JSON.stringify(c2));
    await shot(page, `85c_odm_loss_help_${lang}_${vw}`);
    await page.evaluate(() => PRO.odh.close());
    if (vw >= 900) {
      /* a mouse: hovering shows the card, leaving it closes it */
      await page.hover('.pm-odin .pm-odi[data-odh="lev"]'); await page.waitForTimeout(450);
      const hv = await page.evaluate(() => ({ k: (document.querySelector('.pm-odpop') || { getAttribute: () => '' }).getAttribute('data-odh') }));
      await page.mouse.move(2, 2); await page.waitForTimeout(450);
      const hv2 = await page.evaluate(() => !!document.querySelector('.pm-odpop'));
      ok(`[${tag}] hovering an icon with the mouse shows its card, moving away hides it`, hv.k === 'lev' && !hv2, JSON.stringify({ hv, hv2 }));
    } else {
      /* a phone: press and hold opens it too */
      const box = await page.evaluate(() => { const b = document.querySelector('.pm-odin .pm-odi[data-odh="lev"]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.evaluate(({ x, y }) => { const b = document.elementFromPoint(x, y).closest('.pm-odi'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })); }, box);
      await page.waitForTimeout(600);
      const hd = await page.evaluate(() => (document.querySelector('.pm-odpop') || { getAttribute: () => '' }).getAttribute('data-odh'));
      ok(`[${tag}] press and hold on an icon opens its card`, hd === 'lev', hd);
    }
    ok(`[${tag}] no JS errors in the planner help checks`, errors.length === e0, errors.slice(e0).join(' || '));
    await ctx.close();
  }

  /* ---------- Smart alerts: several conditions joined with AND / OR / NOT, checked on the chart's closed bars */
  if (!ONLY || ONLY === 'cd' || ONLY === 'odm' || ONLY === 'sa') for (const [vw, vh, lang] of [[1280, 860, 'en'], [390, 800, 'fa']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `smart alerts ${lang} ${vw}`, e0 = errors.length;
    /* from the alerts panel's own button */
    await page.evaluate(() => { const s = document.querySelector('.pm-stab[data-p="alerts"]'); if (s) s.click(); }); await page.waitForTimeout(300);
    await page.evaluate(() => { const t = PRO.app.T('saTab'), b = [...document.querySelectorAll('.pm-btn.wide')].find(x => x.textContent.includes(t)); if (b) b.click(); });
    await page.waitForSelector('.pm-sa', { timeout: 5000 }).catch(() => { });
    ok(`[${tag}] the alerts panel opens the smart alert builder`, await page.evaluate(() => !!document.querySelector('.pm-sa')), '');
    const wait = () => page.waitForFunction(() => { const s = document.querySelector('.pm-sast'); return s && /\b(up|dn)\b/.test(s.className); }, null, { timeout: 8000 }).catch(() => { });
    await wait(); await page.waitForTimeout(150);
    const st = () => page.evaluate(() => {
      const m = document.querySelector('.pm-sa'), box = document.querySelector('.pm-mbox'), body = document.querySelector('.pm-mbody');
      return { code: (m.querySelector('.pm-saexp code') || {}).textContent || '', now: m.querySelector('.pm-sast').className, groups: m.querySelectorAll('.pm-sagrp').length,
        rows: m.querySelectorAll('.pm-sacr').length, dots: [...m.querySelectorAll('.pm-sadot')].map(d => d.className.replace('pm-sadot', '').trim()),
        vals: [...m.querySelectorAll('.pm-saval')].map(v => v.textContent), hist: m.querySelector('.pm-sahist').textContent, fires: m.querySelectorAll('.pm-safires li').length,
        err: m.querySelector('.pm-saerr').hidden ? '' : m.querySelector('.pm-saerr').textContent, save: !m.querySelector('.pm-sasave').disabled,
        fits: box.getBoundingClientRect().right <= innerWidth + 1 && box.getBoundingClientRect().left >= -1, hscroll: body.scrollWidth - body.clientWidth };
    });
    let s0 = await st();
    ok(`[${tag}] it opens on the "RSI dip in an uptrend" rule, with its script`, s0.code === '((ta.rsi(close, 14) < 30) and (close > ta.ema(close, 200))) and bar_index >= 199' && s0.groups === 1 && s0.rows === 2, JSON.stringify(s0));
    ok(`[${tag}] each condition shows a state dot and its values, and the rule shows its state now and its history`, s0.dots.length === 2 && s0.dots.every(d => /^(yes|no|wait)$/.test(d)) && s0.vals.every(v => v.length > 0) && s0.hist.length > 10, JSON.stringify(s0));
    /* the builder's answer against the chart's own indicators on the same closed bars */
    const ind = await page.evaluate(() => {
      const c = PRO.app.active(), t = PRO.parseTF(c.cfg.tf), B = PRO.mtfCalc.closedOnly(c.bars, t.sec, Date.now() / 1000, false).slice(-1500), n = B.length;
      const r = PRO.ind.compute('rsi', B, { len: 14 }).v[n - 1], e = PRO.ind.compute('ema', B, { len: 200 }).v[n - 1], cl = B[n - 1].c;
      return { n, rsi: r, ema: e, close: cl, want: n >= 200 && r < 30 && cl > e, dot0: r < 30, dot1: cl > e };
    });
    ok(`[${tag}] "now" and each dot match RSI(14) and EMA(200) worked out by the chart on the same closed bars`, ind.n > 200 && s0.now.includes(ind.want ? 'up' : 'dn') && s0.dots[0] === (ind.dot0 ? 'yes' : 'no') && s0.dots[1] === (ind.dot1 ? 'yes' : 'no'), JSON.stringify({ ind, now: s0.now, dots: s0.dots }));
    /* every preset gives a valid rule */
    const pres = await page.evaluate(async () => {
      const out = []; for (const b of document.querySelectorAll('.pm-sapre .pm-chip')) { b.click(); await new Promise(r => setTimeout(r, 120)); out.push({ code: document.querySelector('.pm-saexp code').textContent, err: !document.querySelector('.pm-saerr').hidden }); }
      return out;
    });
    ok(`[${tag}] all 5 ready-made rules load and make a valid script`, pres.length === 5 && pres.every(p => p.code.length > 10 && !p.err), JSON.stringify(pres));
    /* back to the first preset, then NOT on its first condition */
    await page.evaluate(() => document.querySelector('.pm-sapre .pm-chip').click()); await page.waitForTimeout(150);
    await page.evaluate(() => { const c = document.querySelector('.pm-sacr .pm-sanot'); c.checked = true; c.dispatchEvent(new Event('change')); }); await page.waitForTimeout(200);
    let s1 = await st();
    ok(`[${tag}] NOT on a condition flips it and guards its warm-up`, s1.code.startsWith('((not (ta.rsi(close, 14) < 30) and ta.rsi(close, 14) == ta.rsi(close, 14)) and') && s1.dots[0] === (ind.dot0 ? 'no' : 'yes'), JSON.stringify(s1));
    /* a second group joined with OR */
    await page.evaluate(() => document.querySelector('.pm-saaddg').click()); await page.waitForTimeout(150);
    await page.evaluate(() => { const s = document.querySelector('.pm-satop select'); s.value = 'or'; s.dispatchEvent(new Event('change')); }); await page.waitForTimeout(200);
    let s2 = await st();
    ok(`[${tag}] a second group joined with OR`, s2.groups === 2 && / or \(close > ta\.sma\(close, 50\)\)\) and bar_index >= 199$/.test(s2.code) && s2.code.startsWith('(((not') && !s2.err, s2.code);
    await shot(page, `88_sa_${lang}_${vw}`);
    await page.evaluate(() => document.querySelector('.pm-sasave').scrollIntoView({ block: 'end' })); await page.waitForTimeout(150); await shot(page, `88b_sa_now_${lang}_${vw}`);
    await page.evaluate(() => document.querySelector('.pm-sa').scrollIntoView({ block: 'start' }));
    ok(`[${tag}] the builder fits the screen with no sideways scroll`, s2.fits && s2.hscroll <= 1, JSON.stringify({ fits: s2.fits, h: s2.hscroll }));
    /* an empty number is refused with a reason and Save switches off */
    await page.evaluate(() => { const v = [...document.querySelectorAll('.pm-sabv')].find(x => !x.hidden); v.value = ''; v.dispatchEvent(new Event('input')); }); await page.waitForTimeout(200);
    let s3 = await st();
    ok(`[${tag}] an empty number is refused with a plain reason and Save switches off`, s3.err === PRO_T(lang, 'saE_num') && !s3.save && await page.evaluate(() => !!document.querySelector('.pm-sacr.bad')), JSON.stringify(s3));
    await page.evaluate(() => { const v = [...document.querySelectorAll('.pm-sabv')].find(x => !x.hidden); v.value = '30'; v.dispatchEvent(new Event('input')); }); await page.waitForTimeout(200);
    /* save: a multi alert with its spec; the script it keeps gives the same answer the builder showed, through the same check live alerts use */
    const n0 = await page.evaluate(() => PRO._alerts().length), s4 = await st();
    await page.evaluate(() => document.querySelector('.pm-sasave').click()); await page.waitForTimeout(300);
    const sv = await page.evaluate(() => {
      const a = PRO._alerts().slice(-1)[0], c = PRO.app.active(), t = PRO.parseTF(a.tf), B = PRO.mtfCalc.closedOnly(c.bars, t.sec, Date.now() / 1000, false).slice(-1500);
      return { toast: (document.querySelector('.pm-toast') || {}).textContent || '', k: a.k, spec: !!(a.spec && a.spec.g && a.spec.g.length === 2), expr: a.expr, on: a.on, tf: a.tf, test: PRO.script.cond(a.expr).test(B), modal: !!document.querySelector('.pm-sa'), n: PRO._alerts().length,
        text: [...document.querySelectorAll('.pm-ar')].map(x => x.textContent).join(' | ') };
    });
    ok(`[${tag}] saving adds one smart alert with its rule, on the chart's timeframe`, sv.n === n0 + 1 && sv.k === 'multi' && sv.spec && sv.expr === s4.code && sv.on && !sv.modal, JSON.stringify(sv));
    ok(`[${tag}] the confirmation names the pair and the rule in words`, sv.toast.includes('BTC/USDT') && !sv.toast.includes('{') && sv.toast.includes(PRO_T(lang, 'saS_rsi')), sv.toast);
    ok(`[${tag}] the saved rule gives the same answer now as the builder showed`, (sv.test[1] === 1) === s4.now.includes('up'), JSON.stringify({ t: sv.test, now: s4.now }));
    const lt = sv.text;      /* the alerts panel is still open from the start of these checks */
    /* in a right-to-left page a Latin condition still reads left to right (RSI before 30), and in a narrow box no condition is split across lines */
    const bd = await page.evaluate((rtl) => {
      const d = document.createElement('div'); d.dir = rtl ? 'rtl' : 'ltr'; d.style.cssText = 'position:fixed;top:0;left:0;width:150px;font:14px sans-serif;background:#000;color:#fff;z-index:99999';
      d.textContent = PRO.saText(PRO._alerts().slice(-1)[0].spec); document.body.appendChild(d);
      const tn = d.firstChild, s = tn.data, rng = document.createRange(), box = (i) => { rng.setStart(tn, i); rng.setEnd(tn, i + 1); return rng.getBoundingClientRect(); };
      const iR = s.indexOf('RSI'), i3 = s.indexOf('30', iR), r = box(iR), t = box(i3);
      const out = { dir: getComputedStyle(d).direction, rsiX: Math.round(r.left), x30: Math.round(t.left), sameLine: Math.abs(r.top - t.top) < 4 }; d.remove(); return out;
    }, ['fa', 'ar', 'ckb'].includes(lang));
    ok(`[${tag}] "RSI (14) < 30" reads left to right and stays on one line, also in a right-to-left page`, bd.rsiX < bd.x30 && bd.sameLine, JSON.stringify(bd));
    ok(`[${tag}] the alert list shows the rule in words, not as script`, lt.includes(PRO_T(lang, 'saS_rsi')) && lt.includes(PRO_T(lang, 'saTx_or')) && !lt.includes('ta.rsi') && lt.includes('\u2068'), lt.slice(0, 300));
    await shot(page, `89_sa_list_${lang}_${vw}`);
    /* the price alert dialog has a Smart tab that opens the builder */
    const tab = await page.evaluate(async () => {
      PRO.alertDialog(PRO.app.active()); await new Promise(r => setTimeout(r, 200));
      const b = document.querySelector('.pm-af [data-k="smart"]'); if (!b) return { b: false };
      const lbl = b.textContent; b.click(); await new Promise(r => setTimeout(r, 300));
      const r = { b: true, lbl, sa: !!document.querySelector('.pm-sa'), af: !!document.querySelector('.pm-af') }; PRO.app.closeModal(); return r;
    });
    ok(`[${tag}] the alert dialog's Smart tab opens the builder`, tab.b && tab.lbl === PRO_T(lang, 'saTab') && tab.sa && !tab.af, JSON.stringify(tab));
    ok(`[${tag}] no JS errors in the smart alert checks`, errors.length === e0, errors.slice(e0).join(' || '));
    await ctx.close();
  }

  /* ---------- Liquidity map: real order books (mocked in each exchange's own format) and real liquidation feeds */
  if (!ONLY || ONLY === 'cd' || ONLY === 'odm' || ONLY === 'lq') for (const [vw, vh, lang] of [[1280, 860, 'en'], [390, 800, 'fa']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `liquidity ${lang} ${vw}`, e0 = errors.length, H = { 'access-control-allow-origin': '*' };
    /* one fixed book per venue, built once around the price at the first request; the test sums it on its own below */
    const BOOK = {}, mk = (v, mid, n, tick, wallB, wallA) => {
      const b = [], a = [];
      for (let i = 1; i <= n; i++) {
        const pb = +(mid - i * tick).toFixed(2), pa = +(mid + i * tick).toFixed(2), qb = 0.2 + ((i * 7) % 11) / 10, qa = 0.2 + ((i * 5) % 13) / 10;
        b.push([pb, +(qb + (wallB && Math.abs(pb - wallB) < tick / 2 ? 40 : 0)).toFixed(4)]); a.push([pa, +(qa + (wallA && Math.abs(pa - wallA) < tick / 2 ? 25 : 0)).toFixed(4)]);
      }
      return { b, a };
    };
    const book = (v) => {
      if (BOOK[v]) return BOOK[v];
      const mid = Math.round(px('BTCUSDT', Math.floor(Date.now() / 1000))), tick = 1;
      const wb = mid - Math.round(mid * 0.004), wa = mid + Math.round(mid * 0.006);
      BOOK[v] = v === 'bnf' ? mk(v, mid, 1000, tick, wb, 0) : v === 'bns' ? mk(v, mid, 5000, tick, 0, 0) : mk(v, mid, 500, tick, 0, wa);
      BOOK[v].mid = mid; BOOK[v].wb = wb; BOOK[v].wa = wa; return BOOK[v];
    };
    const S = (x) => x.map(r => [String(r[0]), String(r[1])]);
    await page.route(/fapi\.binance\.com\/fapi\/v1\/depth/, r => { const k = book('bnf'); r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ lastUpdateId: 1, E: Date.now(), T: Date.now(), bids: S(k.b), asks: S(k.a) }) }); });
    await page.route(/data-api\.binance\.vision\/api\/v3\/depth/, r => { const k = book('bns'); r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ lastUpdateId: 1, bids: S(k.b), asks: S(k.a) }) }); });
    await page.route(/api\.bybit\.com\/v5\/market\/orderbook/, r => { const k = book('byf'); r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ retCode: 0, retMsg: 'OK', result: { s: 'BTCUSDT', b: S(k.b), a: S(k.a), ts: Date.now(), u: 1 } }) }); });
    /* liquidations: Binance one long every 2 s, Bybit a short on each subscribe answer and then every 3 s */
    const LQS = [];
    await page.routeWebSocket(/fstream\.binance\.com/, ws => {
      const t = setInterval(() => { const p = px('BTCUSDT', Math.floor(Date.now() / 1000)), x = { e: 'forceOrder', E: Date.now(), o: { s: 'BTCUSDT', S: 'SELL', o: 'LIMIT', f: 'IOC', q: '0.5', p: String(p * 0.999), ap: p.toFixed(2), X: 'FILLED', l: '0.5', z: '0.5', T: Date.now() } }; LQS.push(['bnf', 'long', +p.toFixed(2) * 0.5]); ws.send(JSON.stringify(x)); }, 2000);
      ws.onClose(() => clearInterval(t));
    });
    await page.routeWebSocket(/stream\.bybit\.com/, ws => {
      let t = null;
      ws.onMessage(m => {
        let j; try { j = JSON.parse(m); } catch (e) { return; }
        if (j.op === 'ping') return ws.send(JSON.stringify({ op: 'pong', success: true }));
        if (j.op === 'subscribe' && /^allLiquidation\.BTCUSDT$/.test(j.args[0])) {
          ws.send(JSON.stringify({ success: true, op: 'subscribe' }));
          const send = () => { const p = px('BTCUSDT', Math.floor(Date.now() / 1000)); LQS.push(['byf', 'short', +p.toFixed(1) * 0.8]); ws.send(JSON.stringify({ topic: 'allLiquidation.BTCUSDT', type: 'snapshot', ts: Date.now(), data: [{ T: Date.now(), s: 'BTCUSDT', S: 'Sell', v: '0.8', p: p.toFixed(1) }] })); };
          send(); t = setInterval(send, 3000);
        }
      });
      ws.onClose(() => clearInterval(t));
    });
    await page.evaluate(() => { const b = document.querySelector('#pm-lq'); if (b) b.click(); else PRO.liqMap(); });
    await page.waitForSelector('.pm-lq', { timeout: 5000 }).catch(() => { });
    ok(`[${tag}] the toolbar opens the liquidity map and it switches on`, await page.evaluate(() => !!document.querySelector('.pm-lq') && document.querySelector('.pm-lqon').checked), '');
    await page.waitForFunction(() => { const s = PRO.liqState(); return s && s.n >= 2 && s.liq.length >= 3; }, null, { timeout: 30000 }).catch(() => { });
    const s1 = await page.evaluate(() => PRO.liqState());
    ok(`[${tag}] two readings of the books kept, three venues answered and OKX (blocked here) is shown as unreachable`, s1 && s1.n >= 2 && s1.stat.bnf.ok && s1.stat.bns.ok && s1.stat.byf.ok && s1.stat.okx && !s1.stat.okx.ok, JSON.stringify(s1 && { n: s1.n, stat: s1.stat }));
    /* the band every book reaches is Bybit's 500 levels: mid ± 500 */
    const B0 = BOOK.byf;
    ok(`[${tag}] the band every chosen book covers is the shallowest book's reach`, s1 && s1.lo === B0.mid - 500 && s1.hi === B0.mid + 500, JSON.stringify({ lo: s1 && s1.lo, hi: s1 && s1.hi, mid: B0.mid }));
    /* the biggest bid and ask walls, summed here from the three books with nothing from liqmap.js */
    const step = s1.step, sumAt = (side, price) => { const k = Math.floor(price / step + 1e-9); let q = 0; ['bnf', 'bns', 'byf'].forEach(v => BOOK[v][side].forEach(r => { if (Math.floor(r[0] / step + 1e-9) === k) q += r[1]; })); return { k, q }; };
    const eb = sumAt('b', BOOK.bnf.wb), ea = sumAt('a', BOOK.byf.wa);
    ok(`[${tag}] the biggest bid wall is the 40 BTC order 0.4% under the price, with its size summed across books`, s1.w && s1.w.bid[0].k === eb.k && Math.abs(s1.w.bid[0].q - eb.q) < 1e-6 && s1.w.bid[0].top === 'bnf', JSON.stringify({ got: s1.w && s1.w.bid[0], want: eb, step }));
    ok(`[${tag}] the biggest ask wall is the 25 BTC order 0.6% over the price, mostly on Bybit`, s1.w && s1.w.ask[0].k === ea.k && Math.abs(s1.w.ask[0].q - ea.q) < 1e-6 && s1.w.ask[0].top === 'byf', JSON.stringify({ got: s1.w && s1.w.ask[0], want: ea }));
    /* liquidations: what the page kept is exactly what the feeds sent, each on the right side */
    const lq = s1.liq, nb = lq.filter(x => x.v === 'bnf'), ny = lq.filter(x => x.v === 'byf');
    ok(`[${tag}] liquidations from both feeds: Binance SELL = long closed, Bybit Sell = short closed`, nb.length >= 1 && ny.length >= 1 && nb.every(x => x.side === 'long') && ny.every(x => x.side === 'short') && nb.every(x => Math.abs(x.q - 0.5) < 1e-9) && ny.every(x => Math.abs(x.q - 0.8) < 1e-9), JSON.stringify(lq.slice(0, 4)));
    const pn = await page.evaluate(() => ({ rows: document.querySelectorAll('.pm-lqt tbody tr').length, up: document.querySelectorAll('.pm-lqt tr.up').length, src: [...document.querySelectorAll('.pm-lqsrc li')].map(x => x.className), sum: (document.querySelector('.pm-lqliq .pm-odhint') || {}).textContent || '', st: document.querySelector('.pm-lqst').textContent,
      fits: (() => { const b = document.querySelector('.pm-mbox'), body = document.querySelector('.pm-mbody'); return b.getBoundingClientRect().right <= innerWidth + 1 && body.scrollWidth - body.clientWidth <= 1; })() }));
    ok(`[${tag}] the panel lists 5 bid and 5 ask walls, each source with its state, and the liquidation totals`, pn.rows === 10 && pn.up === 5 && pn.src.length === 6 && pn.src.filter(c => c === 'ok').length === 5 && pn.src.includes('bad') && pn.sum.length > 10, JSON.stringify(pn));
    ok(`[${tag}] the panel fits the screen with no sideways scroll`, pn.fits, '');
    await shot(page, `90_lq_panel_${lang}_${vw}`);
    /* on the chart: the book is drawn at the very right edge (clear of the liquidation bubbles on the open bar) in green under the price and red over it */
    await page.evaluate(() => PRO.app.closeModal()); await page.waitForTimeout(400);
    await shot(page, `91_lq_chart_${lang}_${vw}`);
    const px2 = await page.evaluate(() => {
      const c = PRO.app.active(), s = PRO.liqState(), cv = [...c.el.querySelectorAll('canvas')].filter(x => x.width > 50);
      const yB = c.main.priceToCoordinate(s.w.bid[0].p), yA = c.main.priceToCoordinate(s.w.ask[0].p), out = { yB, yA, hits: [] };
      cv.forEach(x => { const g = x.getContext('2d'), r = x.getBoundingClientRect(), k = x.width / r.width; if (!g || r.width < 200) return; [['b', yB], ['a', yA]].forEach(([n, y]) => { if (y == null) return; const d = g.getImageData(Math.round((r.width - 6) * k), Math.round(y * k), 1, 1).data; out.hits.push([n, d[0], d[1], d[2], d[3]]); }); });
      return out;
    });
    const green = px2.hits.some(h => h[0] === 'b' && h[2] > h[1] + 40 && h[4] > 0), red = px2.hits.some(h => h[0] === 'a' && h[1] > h[2] + 40 && h[4] > 0);
    ok(`[${tag}] the book is drawn at the chart's right edge: green at the bid wall, red at the ask wall`, green && red, JSON.stringify(px2));
    const lx = await page.evaluate(() => { const c = PRO.app.active(), s = PRO.liqState(), x = s.liq[s.liq.length - 1], ts = c.chart.timeScale(), n = c.disp.length; return { X: PRO.lqX(x.t), last: ts.logicalToCoordinate(n - 1), next: ts.logicalToCoordinate(n), t: x.t, lastT: c.disp[n - 1].t, sec: c.tfSec() }; });
    ok(`[${tag}] each liquidation is drawn at the time it happened: the newest one sits on the bar still open`, lx.X != null && lx.last != null && lx.X >= lx.last - 1 && lx.X <= lx.next + 1, JSON.stringify(lx));
    /* switching the coin starts again; a symbol no exchange lists says so */
    await page.evaluate(() => PRO.app.active().setSym('IR_USD')); await page.waitForTimeout(600);
    ok(`[${tag}] on a market no exchange book covers it stops and says why`, await page.evaluate(() => !PRO.liqState()), '');
    await page.evaluate(() => PRO.app.active().setSym('BTC')); await page.waitForTimeout(300);
    ok(`[${tag}] no JS errors in the liquidity map checks`, errors.length === e0, errors.slice(e0).join(' || '));
    await page.evaluate(() => PRO.liqStop());
    await ctx.close();
  }

  /* ---------- Reset the page: every alert, the alert history, every drawing and the ODM plan go at once, with real clicks, and Undo brings them back */
  if (!ONLY || ONLY === 'cd' || ONLY === 'odm' || ONLY === 'rst') for (const [vw, vh, lang] of [[1280, 860, 'en'], [1024, 768, 'fa'], [390, 800, 'ar'], [390, 800, 'ckb']]) {
    const { page, ctx } = await newPage(vw, vh, lang);
    const tag = `reset ${lang} ${vw}`, e0 = errors.length;
    const seed = () => page.evaluate(() => {
      const c = PRO.app.active(), px = c.bars[c.bars.length - 1].c, t = c.bars[c.bars.length - 5].t;
      [['BTC', px * 1.1, 'up'], ['BTC', px * 0.9, 'down'], ['ETH', 5000, 'up'], ['SOL', 50, 'down']].forEach(a => PRO.addPriceAlert(a[0], a[1], a[2], a[0] === 'BTC' && a[2] === 'down' ? 'ODM S1' : ''));
      PRO.alertLog([{ t: Date.now(), msg: 'test fired' }]);
      PRO.app.mutate('BTC', L => { L.push({ id: 'r1', k: 'hline', pts: [{ t, p: px }], s: {} }); L.push({ id: 'r2', k: 'trend', pts: [{ t, p: px }, { t: c.bars[c.bars.length - 1].t, p: px * 1.01 }], s: {} }); });
      PRO.app.mutate('ETH', L => { L.push({ id: 'r3', k: 'hline', pts: [{ t, p: 3000 }], s: {} }); });
      localStorage.setItem('ek_pro_odm', JSON.stringify({ v: 1, sym: 'BTC', entries: [{ p: px * 0.98 }] }));
    });
    const count = () => page.evaluate(() => ({ al: PRO.alertsAll().length, log: PRO.alertLog().length, dr: Object.values(PRO.app.DRAW()).reduce((n, L) => n + L.length, 0), od: !!localStorage.getItem('ek_pro_odm'), ln: (PRO.alertLines('BTC') || []).length }));
    await seed();
    const c0 = await count();
    ok(`[${tag}] seeded 4 alerts on 3 coins, 1 history line, 3 drawings on 2 coins and an ODM plan`, c0.al === 4 && c0.log === 1 && c0.dr === 3 && c0.od, JSON.stringify(c0));
    /* the trash flyout on the tool rail holds Reset; a real click opens the dialog */
    if (!(await page.isVisible('#pm-tools'))) { await page.click('#pm-pen'); await page.waitForTimeout(250); }   /* phones: the pen button shows the tool rail */
    const fly = await page.$('#pm-tools [data-fly="clear"]');
    if (fly && await fly.isVisible()) { await fly.scrollIntoViewIfNeeded(); await fly.click(); }
    await page.waitForTimeout(250);
    const it = await page.$$('.pm-fi');
    let hit = null; for (const b of it) { const tx = await b.textContent(); if (tx.indexOf(await page.evaluate(() => PRO.app.T('rsTitle'))) >= 0) hit = b; }
    ok(`[${tag}] the trash menu on the tool rail has Reset the page`, !!hit, String(it.length));
    if (hit) await hit.click(); else await page.evaluate(() => PRO.resetPage());
    await page.waitForSelector('.pm-rs', { timeout: 3000 }).catch(() => { });
    const dlg = await page.evaluate(() => {
      const f = document.querySelector('.pm-rs'); if (!f) return null;
      const r = [...f.querySelectorAll('.pm-rsr')].map(l => ({ n: l.querySelector('input').name, on: l.querySelector('input').checked, dis: l.querySelector('input').disabled, v: l.querySelector('b').textContent }));
      const b = document.querySelector('.pm-mbox').getBoundingClientRect(), body = document.querySelector('.pm-mbody');
      return { r, fits: b.left >= -1 && b.right <= innerWidth + 1 && body.scrollWidth - body.clientWidth <= 1, h44: [...f.querySelectorAll('.pm-rsr')].every(l => l.getBoundingClientRect().height >= 40), title: document.querySelector('.pm-mhead b').textContent };
    });
    const R = k => (dlg && dlg.r.find(x => x.n === k)) || {};
    ok(`[${tag}] the dialog lists alerts 4, history 1, drawings 3, ODM ✓ ticked, and indicators not ticked`, dlg && R('al').on && /4|٤|۴/.test(R('al').v) && R('log').on && R('dr').on && /3|٣|۳/.test(R('dr').v) && R('od').on && R('ind').on === false, JSON.stringify(dlg));
    ok(`[${tag}] the dialog fits the screen and each row is big enough to tap`, dlg && dlg.fits && dlg.h44, JSON.stringify(dlg && { fits: dlg.fits, h44: dlg.h44 }));
    await shot(page, `92_reset_dialog_${lang}_${vw}`);
    /* untick nothing; a real click on Reset */
    await page.click('.pm-rs .pm-rsgo'); await page.waitForTimeout(400);
    const c1 = await count();
    ok(`[${tag}] after Reset: no alerts on any coin, no history, no drawings, no ODM plan, no alert lines on the chart`, c1.al === 0 && c1.log === 0 && c1.dr === 0 && !c1.od && c1.ln === 0, JSON.stringify(c1));
    const kept = await page.evaluate(() => ({ st: !!localStorage.getItem('ek_pro'), w: localStorage.getItem('ek_pro_watch') !== 'null' }));
    ok(`[${tag}] the layout is kept`, kept.st, JSON.stringify(kept));
    /* Undo in the note brings it all back */
    const ub = await page.$('.pm-toast .pm-tbtn');
    ok(`[${tag}] the note after Reset carries Undo`, !!ub, '');
    if (ub) await ub.click(); await page.waitForTimeout(400);
    const c2 = await count();
    ok(`[${tag}] Undo brings back the 4 alerts, the history, the 3 drawings and the ODM plan`, c2.al === 4 && c2.log === 1 && c2.dr === 3 && c2.od && c2.ln >= 2, JSON.stringify(c2));
    /* reset again, and undo later from the workspace menu (after the note is gone) */
    await page.evaluate(() => PRO.resetPage()); await page.waitForSelector('.pm-rs');
    await page.click('.pm-rs .pm-rsgo'); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelectorAll('.pm-toast').forEach(x => x.remove()));
    const ws = await page.$('#pm-ws');
    if (ws && await ws.isVisible()) { await ws.click(); } else await page.evaluate(() => document.querySelector('#pm-ws').click());
    await page.waitForTimeout(250);
    const ul = await page.evaluate(() => { const L = PRO.app.T('rsUndoLast'); const b = [...document.querySelectorAll('.pm-menu .pm-mi')].find(x => x.textContent.indexOf(L) >= 0); if (b) { b.scrollIntoView({ block: 'nearest' }); b.setAttribute('data-test', 'ul'); } return !!b; });
    ok(`[${tag}] the workspace menu offers Undo the last reset`, ul, '');
    if (ul) await page.click('.pm-menu [data-test="ul"]'); await page.waitForTimeout(400);
    const c3 = await count();
    ok(`[${tag}] Undo the last reset brings everything back`, c3.al === 4 && c3.log === 1 && c3.dr === 3 && c3.od, JSON.stringify(c3));
    /* the alerts panel: one alert deleted with a real click, Undo; then Delete all, asked first, then Undo */
    await page.evaluate(() => PRO.app.setSide('alerts')); await page.waitForTimeout(400);
    const del1 = await page.$('.pm-al .pm-ar [data-a="del"]');
    ok(`[${tag}] the alerts panel shows each alert with its delete button`, !!del1 && (await page.$$('.pm-al .pm-ar')).length === 4, '');
    if (del1) { await del1.scrollIntoViewIfNeeded(); await del1.click(); } await page.waitForTimeout(300);
    const a1 = await count();
    ok(`[${tag}] one tap on its bin deletes just that alert`, a1.al === 3, JSON.stringify(a1));
    const ub2 = await page.$('.pm-toast .pm-tbtn'); if (ub2) await ub2.click(); await page.waitForTimeout(300);
    ok(`[${tag}] and Undo puts it back`, (await count()).al === 4, '');
    const da = await page.$('.pm-al [data-a="delall"]');
    ok(`[${tag}] the panel has Delete all alerts (4)`, !!da && /4|٤|۴/.test(await da.textContent()), '');
    if (da) { await da.scrollIntoViewIfNeeded(); await da.click(); } await page.waitForTimeout(250);
    const asked = await page.evaluate(() => !!document.querySelector('.pm-modal [data-y]')) && (await count()).al === 4;
    ok(`[${tag}] Delete all asks first and deletes nothing yet`, asked, '');
    if (asked) await page.click('.pm-modal [data-y]'); await page.waitForTimeout(300);
    ok(`[${tag}] yes deletes all 4 alerts`, (await count()).al === 0, '');
    await shot(page, `93_reset_alerts_${lang}_${vw}`);
    const ub3 = await page.$('.pm-toast .pm-tbtn'); if (ub3) await ub3.click(); await page.waitForTimeout(300);
    ok(`[${tag}] and Undo brings all 4 back`, (await count()).al === 4, '');
    ok(`[${tag}] no JS errors in the Reset checks`, errors.length === e0, errors.slice(e0).join(' || '));
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
