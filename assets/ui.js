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
  fa: [['/', 'خانه'], ['/lab/', 'آزمایشگاه'], ['/dna/', 'DNA بازار'], ['/terminal/', 'ترمینال'], ['/me/', 'فضای من'], ['/dashboard/', 'داشبورد']],
  ckb: [['/', 'ماڵەوە'], ['/lab/', 'تاقیگە'], ['/dna/', 'DNAی بازاڕ'], ['/terminal/', 'تێرمیناڵ'], ['/me/', 'بۆشاییی من'], ['/dashboard/', 'داشبۆرد']],
  en: [['/', 'Home'], ['/lab/', 'Lab'], ['/dna/', 'Market DNA'], ['/terminal/', 'Terminal'], ['/me/', 'My space'], ['/dashboard/', 'Dashboard']]
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
})();
function streak() { const days = ls.get('ek_days', []); let s = 0, cur = new Date(); cur.setUTCHours(0, 0, 0, 0); const set = new Set(days);
  for (; ;) { const k = cur.toISOString().slice(0, 10); if (set.has(k)) { s++; cur.setUTCDate(cur.getUTCDate() - 1); } else break; } return s; }
/* ---- alert engine (runs on every tool page; rules live only in this browser) ---- */
const ALERT_M = { price: 'price', chg24: 'chg24', rsi: 'rsi' };
async function alertTick() {
  const rules = ls.get('ek_alerts', []); if (!rules.length) return;
  const m = await j('/data/market.json' + V()), dv = await j('/data/derivatives.json' + V()); if (!m) return;
  const fired = ls.get('ek_alert_log', []), now = Date.now(), msgs = [];
  rules.forEach(r => {
    if (r.last && now - r.last < 6 * 36e5) return;
    const k = m.coins.find(c => c.coin === r.coin); let v = null;
    if (r.metric === 'signal') v = (m.opportunities || []).some(o => o.coin === r.coin && (r.val === 'any' || o.type === r.val)) ? 1 : 0;
    else if (r.metric === 'funding') v = ((dv && dv.swaps) || []).find(s => s.coin === r.coin)?.funding ?? null;
    else if (k) v = k[ALERT_M[r.metric]];
    if (v == null) return;
    const hit = r.metric === 'signal' ? v === 1 : (r.op === '>' ? v > +r.val : v < +r.val);
    if (hit) { r.last = now; const msg = `${r.coin} ${r.metric}${r.metric === 'signal' ? ' ' + r.val : ' ' + r.op + ' ' + r.val} (now ${typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v})`; msgs.push({ r, msg }); fired.unshift({ t: now, id: r.id, level: r.level, msg }); }
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
