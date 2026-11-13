/* /market/ continuous quarterly futures (assets/pro/markets.js, kind 'fut'): expiry calendar, which contract each bar
   belongs to, rolls and B-ADJ back-adjustment, checked on a synthetic Bybit. Run: node tests/test_pro_fut.js */
'use strict';
const path = require('path'), fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'pro', 'markets.js'), 'utf8');
const i0 = src.indexOf("  var BYB = 'https://api.bybit.com"), i1 = src.indexOf('  P._futChain = futChain;');
const d0 = src.indexOf('  function dedup(a)'), d1 = src.indexOf('  P._dedup = dedup;');
if (i0 < 0 || i1 < 0 || d0 < 0 || d1 < 0) { console.log('FAIL: blocks not found'); process.exit(1); }
const P = {};
P.bucket = (t, tf) => tf.sec < 86400 ? (t - ((t % 86400) + 86400) % 86400) + Math.floor((((t % 86400) + 86400) % 86400) / tf.sec) * tf.sec : t - ((t % tf.sec) + tf.sec) % tf.sec;
/* a fake Bybit: contract X has price base + offset(X) + slope·t, so each roll has a known gap */
const OFF = {}, calls = [];
P.getJSON = (url) => {
  calls.push(url);
  const q = new URL(url).searchParams, sym = q.get('symbol'), iv = q.get('interval'), s = +q.get('start') / 1000, e = Math.floor(+q.get('end') / 1000);
  const sec = { D: 86400, '60': 3600, '240': 14400 }[iv];
  if (!(sym in OFF)) return Promise.resolve({ retCode: 0, result: { list: [] } });
  const L = []; for (let t = Math.ceil(s / sec) * sec; t <= e; t += sec) { const p = 50000 + OFF[sym] + t / 1e4; L.push([String(t * 1000), String(p - 1), String(p + 5), String(p - 5), String(p), '10']); }
  return Promise.resolve({ retCode: 0, result: { list: L.reverse().slice(0, 1000) } });
};
const N = (fa, ckb, ar, en) => ({ fa, ckb, ar, en });
const code = src.slice(d0, d1) + src.slice(i0, i1) + '\nreturn { expiries, futRes, futChain, aggTo };';
const M = new Function('P', 'N', code)(P, N);
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } };
const iso = t => new Date(t * 1000).toISOString().slice(0, 16);

/* 1. the calendar: the last Friday of each quarter month, 08:00 UTC, and Bybit's contract codes */
const ex = M.expiries(Date.UTC(2025, 0, 1) / 1000, Date.UTC(2027, 0, 1) / 1000);
ok(ex.map(x => x.code).join() === 'H25,M25,U25,Z25,H26,M26,U26,Z26,H27', 'codes ' + ex.map(x => x.code).join());
ok(ex.find(x => x.code === 'Z26').e * 1000 === 1798185600000 && ex.find(x => x.code === 'Z25').e === Date.UTC(2025, 11, 26, 8) / 1000, 'Z26 = Bybit deliveryTime, Z25 = 26 Dec 2025 08:00');
ok(ex.every(x => new Date(x.e * 1000).getUTCDay() === 5 && new Date(x.e * 1000).getUTCHours() === 8 && new Date((x.e + 7 * 86400) * 1000).getUTCMonth() !== new Date(x.e * 1000).getUTCMonth()), 'every expiry is the last Friday of its month at 08:00');
/* 2. timeframes → Bybit intervals */
const R = id => M.futRes({ id, sec: { '1h': 3600, '4h': 14400, '8h': 28800, '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000, '1s': 1 }[id], u: id.slice(-1) });
ok(R('1h').iv === '60' && R('8h').iv === '240' && R('8h').n === 2 && R('3d').iv === 'D' && R('3d').n === 3 && R('1w').iv === 'W' && R('1M').iv === 'M' && R('1s') === null, 'intervals');

/* 3. a chain across two rolls, daily: Z25 → H26 → M26 */
Object.assign(OFF, { BTCUSDZ25: 0, BTCUSDH26: 300, BTCUSDM26: 700 });
const from = Date.UTC(2025, 10, 1) / 1000, to = Date.UTC(2026, 4, 1) / 1000, r = R('1d');
M.futChain('BTC', r, from, to, false).then(raw => {
  ok(raw.length && raw.every((b, i) => !i || b.t - raw[i - 1].t === 86400), 'continuous daily bars, no gaps or repeats: ' + raw.length);
  const z = Date.UTC(2025, 11, 26, 8) / 1000, h = Date.UTC(2026, 2, 27, 8) / 1000;
  const at = t => raw.find(b => b.t === t), price = (sym, t) => 50000 + OFF[sym] + t / 1e4;
  ok(at(z - 8 * 3600 - 86400).c === price('BTCUSDZ25', z - 8 * 3600 - 86400), 'the day before expiry is still Z25');
  ok(at(z - 8 * 3600).c === price('BTCUSDH26', z - 8 * 3600), 'the expiry day itself (it closes after 08:00) is already H26');
  ok(at(h - 8 * 3600).c === price('BTCUSDM26', h - 8 * 3600) && raw[raw.length - 1].c === price('BTCUSDM26', raw[raw.length - 1].t), 'H26 → M26 and the last bar is the front contract');
  ok(raw.front && raw.front.c === 'BTCUSDM26', 'front contract M26');
  return M.futChain('BTC', r, from, to, true).then(adj => {
    ok(adj.length === raw.length && adj.gaps.length === 2, 'B-ADJ: same bars, two rolls');
    const g = adj.gaps.map(x => x.gap);
    ok(Math.abs(g[0] - 400) < 1e-9 && Math.abs(g[1] - 300) < 1e-9, 'gaps are next − expiring at the last bar of the expiring one: ' + g);
    const late = adj.filter(b => b.t >= h - 8 * 3600), mid = adj.filter(b => b.t >= z - 8 * 3600 && b.t < h - 8 * 3600), early = adj.filter(b => b.t < z - 8 * 3600);
    ok(late.every(b => b.c === raw.find(x => x.t === b.t).c), 'the front contract keeps its real prices');
    ok(mid.every(b => Math.abs(b.c - raw.find(x => x.t === b.t).c - 400) < 1e-9) && early.every(b => Math.abs(b.c - raw.find(x => x.t === b.t).c - 700) < 1e-9), 'earlier contracts shift by the sum of later gaps (400, then 700)');
    let jumps = 0; for (let i = 1; i < adj.length; i++) if (Math.abs(adj[i].c - adj[i - 1].c - 8.64) > 1e-6) jumps++;
    ok(jumps === 0, 'the back-adjusted series has no roll jumps (each day moves only by the trend)');
    let rawJ = 0; for (let i = 1; i < raw.length; i++) if (Math.abs(raw[i].c - raw[i - 1].c - 8.64) > 1e-6) rawJ++;
    ok(rawJ === 2, 'the raw series jumps exactly at the two rolls');
    /* 4. hourly: the roll hour */
    return M.futChain('BTC', R('1h'), z - 3 * 3600, z + 3 * 3600, false).then(hr => {
      ok(hr.find(b => b.t === z - 3600).c === price('BTCUSDZ25', z - 3600) && hr.find(b => b.t === z).c === price('BTCUSDH26', z), 'hourly: 07:00 is Z25, 08:00 is H26');
      /* 5. a contract the exchange has no data for ends the series there */
      delete OFF.BTCUSDZ25;
      return M.futChain('BTC', r, from, to, true).then(cut => {
        ok(cut.length && cut[0].t >= z - 8 * 3600 && cut.gaps.length === 1, 'no data for Z25: the series starts with H26');
        console.log(n + ' checks, ' + fails + ' failed'); process.exit(fails ? 1 : 0);
      });
    });
  });
}).catch(e => { console.log('FAIL', e && e.stack); process.exit(1); });
