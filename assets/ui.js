/* entekhab.net shared helpers for the tool pages (dna, terminal) */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fm = (n, d = 2) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const sg = (n, d = 2) => n == null || isNaN(n) ? '—' : `<span class="num ${n >= 0 ? 'pos' : 'neg'}">${n >= 0 ? '+' : ''}${fm(n, d)}%</span>`;
const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
let lang = (() => { try { return localStorage.getItem('ck_lang'); } catch (e) { return null; } })() || 'fa';
const I = { fa: {}, ckb: {}, en: {} };
const T = k => (I[lang] && I[lang][k] !== undefined) ? I[lang][k] : I.en[k];
const j = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch (e) { return null; } };
const V = () => '?v=' + Math.floor(Date.now() / 12e4);
let LOGO = new Set();
const logoUrl = c => LOGO.has(c) ? `/data/logos/${c}.png` : null;
const logoTag = (c, s = 22) => logoUrl(c) ? `<img src="${logoUrl(c)}" alt="" width="${s}" height="${s}" style="border-radius:50%;vertical-align:middle;margin-inline-end:6px;background:#fff1">` : `<span style="display:inline-grid;place-items:center;width:${s}px;height:${s}px;border-radius:50%;background:#333;font-size:${Math.round(s * .38)}px;margin-inline-end:6px;vertical-align:middle;font-family:var(--mono)">${esc(String(c).slice(0, 3))}</span>`;
function share(text, url) {
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (navigator.share) navigator.share({ text, url }).catch(() => window.open(tg, '_blank')); else window.open(tg, '_blank');
}
function bgPaint(x, W, H) {
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1a1006'); g.addColorStop(.5, '#0b0c0f'); g.addColorStop(1, '#071018');
  x.fillStyle = g; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < W; i += 54) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
  for (let i = 0; i < H; i += 54) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
}
function wrapText(x, t, cx, y, w, lh) { let line = ''; for (const wd of String(t).split(' ')) { const tt = line ? line + ' ' + wd : wd; if (x.measureText(tt).width > w && line) { x.fillText(line, cx, y); y += lh; line = wd; } else line = tt; } x.fillText(line, cx, y); return y; }
const NAV = {
  fa: [['/', 'خانه'], ['/indicators/', 'اندیکاتورها'], ['/lab/', 'آزمایشگاه'], ['/dna/', 'DNA بازار'], ['/terminal/', 'ترمینال'], ['/me/', 'فضای من'], ['/learn/', 'آموزش'], ['/tools/', 'ابزارها']],
  ckb: [['/', 'ماڵەوە'], ['/indicators/', 'ئیندیکاتۆرەکان'], ['/lab/', 'تاقیگە'], ['/dna/', 'DNAی بازاڕ'], ['/terminal/', 'تێرمیناڵ'], ['/me/', 'بۆشاییی من'], ['/learn/', 'فێربوون'], ['/tools/', 'ئامرازەکان']],
  en: [['/', 'Home'], ['/indicators/', 'Indicators'], ['/lab/', 'Lab'], ['/dna/', 'Market DNA'], ['/terminal/', 'Terminal'], ['/me/', 'My space'], ['/learn/', 'Learn'], ['/tools/', 'Tools']]
};
function uiLang(onChange) {
  const apply = () => {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
    document.querySelectorAll('[data-t]').forEach(e => { const v = T(e.dataset.t); if (v !== undefined) e.innerHTML = v; });
    const tabs = $('#tabs'); if (tabs) tabs.innerHTML = (NAV[lang] || NAV.en).map(([h, t]) => `<a href="${h}"${location.pathname === h ? ' style="color:var(--ink);background:#ffffff12"' : ''}>${t}</a>`).join('');
    document.querySelectorAll('#langs button').forEach(b => b.classList.toggle('on', b.dataset.l === lang));
    onChange && onChange();
  };
  const L = $('#langs'); if (L) L.onclick = e => { const b = e.target.closest('button'); if (!b) return; lang = b.dataset.l; try { localStorage.setItem('ck_lang', lang); } catch (_) { } apply(); };
  apply();
}
/* ---- visit streak + pages visited (local only) ---- */
(() => {
  const d = new Date().toISOString().slice(0, 10), days = ls.get('ek_days', []);
  if (days[days.length - 1] !== d) { days.push(d); ls.set('ek_days', days.slice(-400)); }
  const pg = ls.get('ek_pages', []);
  if (!pg.includes(location.pathname)) { pg.push(location.pathname); ls.set('ek_pages', pg.slice(-60)); }
  if (location.pathname !== '/me/') { const rc = ls.get('ek_recent', []).filter(x => x && x.p !== location.pathname); rc.unshift({ p: location.pathname, t: document.title.replace(/\s*\|\s*entekhab\.net\s*$/i, ''), at: Date.now() }); ls.set('ek_recent', rc.slice(0, 30)); }
})();
function streak() { const days = ls.get('ek_days', []); let s = 0, cur = new Date(); cur.setUTCHours(0, 0, 0, 0); const set = new Set(days);
  for (; ;) { const k = cur.toISOString().slice(0, 10); if (set.has(k)) { s++; cur.setUTCDate(cur.getUTCDate() - 1); } else break; } return s; }
/* ---- alert engine (runs on every tool page; rules live only in this browser) ---- */
const ALERT_M = { price: 'price', chg24: 'chg24', rsi: 'rsi' };
/* a rule is { coin, conds:[{m, op, v}], level } — every condition must hold (AND). Old single-condition rules {metric, op, val} still work. */
const conds = r => r.conds && r.conds.length ? r.conds : [{ m: r.metric, op: r.op, v: r.val }];
async function alertTick() {
  const rules = ls.get('ek_alerts', []); if (!rules.length) return;
  const used = new Set(rules.flatMap(r => conds(r).map(c => c.m)));
  const [m, dv, sc, nw] = await Promise.all([j('/data/market.json' + V()), used.has('funding') ? j('/data/derivatives.json' + V()) : null,
    used.has('score') ? j('/data/score.json' + V()) : null, used.has('news') ? j('/data/news.json' + V()) : null]);
  if (!m) return;
  const fired = ls.get('ek_alert_log', []), now = Date.now(), msgs = [];
  const val = (coin, c) => {
    const k = m.coins.find(x => x.coin === coin), op = (m.opportunities || []).filter(o => o.coin === coin);
    if (c.m === 'signal') return op.some(o => c.v === 'any' || o.type === c.v) ? 1 : 0;
    if (c.m === 'funding') return ((dv && dv.swaps) || []).find(s => s.coin === coin)?.funding ?? null;
    if (c.m === 'score') return sc?.coins?.[coin]?.score ?? null;
    if (c.m === 'volx') return op.length ? Math.max(...op.map(o => o.vol_x || 0)) : 0;
    if (c.m === 'news') return ((nw && nw.items) || []).filter(n => (n.coins || []).includes(coin) && now - Date.parse(n.date) < 864e5).length;
    return k ? k[ALERT_M[c.m]] ?? null : null;
  };
  rules.forEach(r => {
    if (r.last && now - r.last < 6 * 36e5) return;
    const parts = [];
    for (const c of conds(r)) {
      const v = val(r.coin, c); if (v == null) return;
      const hit = c.m === 'signal' ? v === 1 : (c.op === '>' ? v > +c.v : v < +c.v); if (!hit) return;
      parts.push(`${c.m}${c.m === 'signal' ? ' ' + c.v : ' ' + c.op + ' ' + c.v} (now ${typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v})`);
    }
    r.last = now; const msg = `${r.coin} ${parts.join(' & ')}`; msgs.push({ r, msg }); fired.unshift({ t: now, id: r.id, level: r.level, msg });
  });
  if (msgs.length) {
    ls.set('ek_alerts', rules); ls.set('ek_alert_log', fired.slice(0, 100));
    if (window.Notification && Notification.permission === 'granted') {
      const byCoin = {}; msgs.forEach(x => (byCoin[x.r.coin] = byCoin[x.r.coin] || []).push(x.msg));      // merge per coin
      Object.entries(byCoin).forEach(([c, a]) => { try { new Notification('entekhab.net · ' + c, { body: a.join('\n'), tag: 'ek-' + c }); } catch (e) { } });
    }
    window.dispatchEvent(new Event('ek-alerts'));
  }
}
setTimeout(alertTick, 4000); setInterval(() => { if (!document.hidden) alertTick(); }, 120000);
/* ---- installable app (PWA) + offline reading ---- */
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
