/* Entekhab Chrome extension — popup */
'use strict';
const SITE = 'https://entekhab.net';
const $ = s => document.querySelector(s);
const T = {
  fa: { brand: 'انتخاب', tMarket: 'بازار', tReport: 'گزارش', tPosts: 'کانال', tAlerts: 'هشدار', search: 'جست‌وجوی کوین…', above: 'بالاتر از', below: 'پایین‌تر از', add: 'افزودن',
    settings: 'تنظیمات', badge: 'عدد روی آیکون', notifyPosts: 'اعلان پست‌های تازهٔ Coin_Kurd', privacy: 'همهٔ تنظیمات فقط روی همین مرورگر ذخیره می‌شود و هیچ اطلاعاتی از شما ارسال نمی‌شود.',
    enc: '📚 دانشنامه', academy: '🏛 آکادمی', lab: '🧪 شبیه‌ساز', dash: '📊 داشبورد', bot: '🤖 ربات', nfa: 'توصیهٔ مالی نیست', fng: 'ترس و طمع', mcap: 'ارزش کل بازار', dom: 'دامیننس BTC',
    upd: 'به‌روزرسانی', ago: 'دقیقه پیش', now: 'همین الان', off: 'خاموش', noAlerts: 'هنوز هشداری نساخته‌اید. وقتی قیمت به عدد شما برسد، اعلان می‌گیرید.', hit: 'فعال شد', loading: 'در حال بارگذاری…',
    err: 'داده در دسترس نیست؛ اتصال اینترنت را بررسی کنید.', more: 'گزارش کامل در سایت', allPosts: 'همهٔ پست‌ها', fngC: { 'Extreme Fear': 'ترس شدید', Fear: 'ترس', Neutral: 'خنثی', Greed: 'طمع', 'Extreme Greed': 'طمع شدید' } },
  ckb: { brand: 'ئینتیخاب', tMarket: 'بازاڕ', tReport: 'ڕاپۆرت', tPosts: 'کەناڵ', tAlerts: 'ئاگاداری', search: 'گەڕان بۆ دراو…', above: 'سەرووی', below: 'خوارووی', add: 'زیادکردن',
    settings: 'ڕێکخستنەکان', badge: 'ژمارە لەسەر ئایکۆن', notifyPosts: 'ئاگاداری پۆستی نوێی Coin_Kurd', privacy: 'هەموو ڕێکخستنەکان تەنها لەم وێبگەڕەدا هەڵدەگیرێن و هیچ زانیارییەک نانێردرێت.',
    enc: '📚 زانستنامە', academy: '🏛 ئەکادیمیا', lab: '🧪 سیمولەیتەر', dash: '📊 داشبۆرد', bot: '🤖 بۆت', nfa: 'ئامۆژگاریی دارایی نییە', fng: 'ترس و تەماع', mcap: 'بەهای گشتی بازاڕ', dom: 'باڵادەستیی BTC',
    upd: 'نوێکردنەوە', ago: 'خولەک لەمەوبەر', now: 'ئێستا', off: 'کوژاوە', noAlerts: 'هێشتا ئاگادارییەکت دروست نەکردووە.', hit: 'چالاک بوو', loading: 'بارکردن…',
    err: 'داتا بەردەست نییە؛ پەیوەندیی ئینتەرنێت بپشکنە.', more: 'ڕاپۆرتی تەواو لە ماڵپەڕ', allPosts: 'هەموو پۆستەکان', fngC: { 'Extreme Fear': 'ترسی زۆر', Fear: 'ترس', Neutral: 'بێلایەن', Greed: 'تەماع', 'Extreme Greed': 'تەماعی زۆر' } },
  en: { brand: 'Entekhab', tMarket: 'Market', tReport: 'Report', tPosts: 'Channel', tAlerts: 'Alerts', search: 'Search coin…', above: 'above', below: 'below', add: 'Add',
    settings: 'Settings', badge: 'Toolbar badge', notifyPosts: 'Notify new Coin_Kurd posts', privacy: 'Settings stay in this browser only; nothing about you is sent anywhere.',
    enc: '📚 Encyclopedia', academy: '🏛 Academy', lab: '🧪 Simulator', dash: '📊 Dashboard', bot: '🤖 Bot', nfa: 'Not financial advice', fng: 'Fear & Greed', mcap: 'Total market cap', dom: 'BTC dominance',
    upd: 'Updated', ago: 'min ago', now: 'just now', off: 'Off', noAlerts: 'No alerts yet. You get a notification when the price reaches your level.', hit: 'triggered', loading: 'Loading…',
    err: 'Data unavailable; check your connection.', more: 'Full report on the site', allPosts: 'All posts', fngC: {} }
};
let S = {}, L = 'fa', REPORT = null;
const t = k => (T[L] && T[L][k]) || T.fa[k] || k;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = p => p == null || !isFinite(p) ? '—' : p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 0 }) : p >= 1 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p.toPrecision(4);
const big = n => !isFinite(n) ? '—' : n >= 1e12 ? '$' + (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : '$' + fmt(n);
async function getJSON(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); }

function spark(a, up) {
  if (!a || a.length < 2) return '';
  const mn = Math.min(...a), mx = Math.max(...a), w = 60, h = 20;
  const pts = a.map((v, i) => `${(i / (a.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / ((mx - mn) || 1) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${up ? '#22c55e' : '#ef4444'}" stroke-width="1.4" points="${pts}"/></svg>`;
}
function coins() {
  const m = (S.market && S.market.coins) || [], lv = S.live || {};
  return m.map(c => ({ ...c, price: (lv[c.coin] && lv[c.coin].price) || c.price, chg24: lv[c.coin] && lv[c.coin].chg24 != null ? lv[c.coin].chg24 : c.chg24 }));
}

function applyLang() {
  document.documentElement.lang = L; document.documentElement.dir = L === 'en' ? 'ltr' : 'rtl';
  document.querySelectorAll('[data-t]').forEach(e => { e.textContent = t(e.dataset.t); });
  document.querySelectorAll('[data-tp]').forEach(e => { e.placeholder = t(e.dataset.tp); });
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.l === L));
  render();
}

function render() {
  const m = S.market;
  // KPIs
  if (m) {
    const f = m.fng || {}, g = m.global || {};
    $('#kpis').innerHTML = [
      [t('fng'), `${f.value ?? '—'} <small style="display:inline">${esc((t('fngC') || {})[f.class] || f.class || '')}</small>`],
      [t('mcap'), big(g.mcap) + (g.mcap_chg24 != null ? ` <small style="display:inline" class="${g.mcap_chg24 >= 0 ? 'up' : 'dn'}">${g.mcap_chg24 >= 0 ? '+' : ''}${(+g.mcap_chg24).toFixed(1)}%</small>` : '')],
      [t('dom'), g.btc_d != null ? g.btc_d.toFixed(1) + '%' : '—']
    ].map(([a, b]) => `<div class="kpi"><small>${a}</small><b>${b}</b></div>`).join('');
  } else $('#kpis').innerHTML = `<p class="empty">${t(S.err ? 'err' : 'loading')}</p>`;
  // market list
  const q = ($('#q').value || '').trim().toUpperCase();
  const list = coins().filter(c => !q || c.coin.includes(q));
  $('#list').innerHTML = list.length ? list.map(c => {
    const up = (c.chg24 || 0) >= 0;
    return `<a class="it" href="${SITE}/coins/${encodeURIComponent(c.coin.toLowerCase())}/" target="_blank" rel="noopener"><span class="c">${esc(c.coin)}</span>${spark(c.spark, up)}<span class="p">$${fmt(c.price)}</span>` +
      `<span class="ch ${up ? 'up' : 'dn'}">${c.chg24 == null ? '—' : (up ? '+' : '') + (+c.chg24).toFixed(2) + '%'}</span></a>`;
  }).join('') : `<p class="empty">${t(m ? 'search' : (S.err ? 'err' : 'loading'))}</p>`;
  // updated
  const at = S.checkedAt || S.marketAt, mins = at ? Math.round((Date.now() - at) / 60000) : null;
  $('#upd').textContent = at ? `${t('upd')}: ${mins < 1 ? t('now') : mins + ' ' + t('ago')}` : '';
  // posts
  const ps = S.posts || [];
  $('#posts').innerHTML = ps.length ? ps.slice(0, 15).map(p => `<a class="post" href="${esc(p.page || SITE + '/p/' + p.id + '/')}" target="_blank" rel="noopener">${esc(p.title)}<small>${esc(new Date(p.date).toLocaleString(L === 'en' ? 'en-GB' : 'fa-IR', { dateStyle: 'medium', timeStyle: 'short' }))}${p.coins && p.coins.length ? ' · ' + esc(p.coins.join(' ')) : ''}</small></a>`).join('') +
    `<p class="note"><a href="https://t.me/Coin_Kurd" target="_blank" rel="noopener">${t('allPosts')} ←</a></p>` : `<p class="empty">${t('loading')}</p>`;
  // report
  if (REPORT) {
    const r = REPORT[L] || REPORT.fa || {};
    $('#report').innerHTML = `<h3>${esc(r.headline || '')}</h3><p>${esc(r.body || '')}</p><p class="note"><a href="${SITE}/dashboard/" target="_blank" rel="noopener">${t('more')}</a></p>`;
    $('#report').dir = L === 'en' ? 'ltr' : 'rtl';
  }
  // alerts + settings
  const cs = coins().map(c => c.coin), sel = $('#aCoin'), cur = sel.value;
  sel.innerHTML = cs.filter(c => !['USDT', 'USDC'].includes(c)).map(c => `<option>${esc(c)}</option>`).join(''); if (cur) sel.value = cur;
  const b = $('#badge');
  b.innerHTML = `<option value="OFF">${t('off')}</option>` + cs.filter(c => !['USDT', 'USDC', 'GOLD'].includes(c)).map(c => `<option>${esc(c)}</option>`).join('');
  b.value = S.badge || 'BTC';
  $('#notifyPosts').checked = !!S.notifyPosts;
  const al = S.alerts || [];
  $('#alerts').innerHTML = al.length ? al.map(a => `<div class="al${a.hit ? ' hit' : ''}"><span><b>${esc(a.coin)}</b> ${a.op === '>' ? t('above') : t('below')} <b dir="ltr">$${esc(a.price)}</b>${a.hit ? ' — ✅ ' + t('hit') : ''}</span><button data-del="${esc(a.id)}" aria-label="delete">✕</button></div>`).join('')
    : `<p class="empty">${t('noAlerts')}</p>`;
}

async function load() {
  S = await chrome.storage.local.get(null);
  L = S.lang || (navigator.language.startsWith('fa') ? 'fa' : navigator.language.startsWith('en') ? 'en' : 'fa');
  applyLang();
  if (!S.market || Date.now() - (S.checkedAt || 0) > 4 * 60000) refresh();
  if (!S.posts || Date.now() - (S.postsAt || 0) > 10 * 60000) getJSON(`${SITE}/api/v1/posts_latest.json?t=${Date.now()}`).then(async d => {
    const posts = (d.posts || []).slice(0, 20); await chrome.storage.local.set({ posts, postsAt: Date.now(), lastPostId: Math.max(S.lastPostId || 0, posts[0] ? posts[0].id : 0) });
    S.posts = posts; render();
  }).catch(() => { });
  getJSON(`${SITE}/api/v1/report.json?t=${Date.now()}`).then(d => { REPORT = d.report; render(); }).catch(() => { $('#report').innerHTML = `<p class="empty">${t('err')}</p>`; });
}
function refresh() {
  const b = $('#refresh'); b.classList.add('spin');
  chrome.runtime.sendMessage({ type: 'refresh' }, async () => {
    b.classList.remove('spin'); S = await chrome.storage.local.get(null); S.err = !S.market; render();
  });
}

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.dataset.pane === b.dataset.tab));
});
document.querySelectorAll('.lang button').forEach(b => b.onclick = async () => { L = b.dataset.l; await chrome.storage.local.set({ lang: L }); applyLang(); });
$('#refresh').onclick = refresh;
$('#q').oninput = render;
$('#badge').onchange = async e => { S.badge = e.target.value; await chrome.storage.local.set({ badge: S.badge }); };
$('#notifyPosts').onchange = async e => {
  S.notifyPosts = e.target.checked;
  if (S.notifyPosts && chrome.notifications && chrome.notifications.getPermissionLevel) chrome.notifications.getPermissionLevel(() => { });
  await chrome.storage.local.set({ notifyPosts: S.notifyPosts });
};
$('#af').onsubmit = async e => {
  e.preventDefault();
  const px = parseFloat($('#aPx').value); if (!(px > 0)) return;
  const a = { id: Date.now().toString(36), coin: $('#aCoin').value, op: $('#aOp').value, price: px, at: Date.now() };
  S.alerts = (S.alerts || []).concat(a).slice(-30); await chrome.storage.local.set({ alerts: S.alerts }); $('#aPx').value = ''; render();
};
$('#alerts').onclick = async e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  S.alerts = (S.alerts || []).filter(a => a.id !== b.dataset.del); await chrome.storage.local.set({ alerts: S.alerts }); render();
};
chrome.storage.onChanged.addListener(async (ch, area) => { if (area === 'local' && (ch.market || ch.live || ch.alerts)) { S = await chrome.storage.local.get(null); render(); } });
load();
