/* Entekhab browser extension — service worker
   Every 5 minutes: market snapshot from entekhab.net (+ live prices from Binance's public data API when reachable),
   the toolbar tooltip price, price alerts and (optional) new Coin_Kurd post notifications. Nothing about the user is sent anywhere.

   ⚠️⚠️⚠️ THE LOGO RULE — set by the site's owner, and repeated by him: THE LOGO IS NEVER COVERED. ⚠️⚠️⚠️
   Chrome draws a badge (setBadgeText) ON TOP of the toolbar icon — over the logo — whatever its length, and an
   earlier version did exactly that with the price. So this extension:
     • never sets badge text (only ever setBadgeText({ text: '' }), which clears it),
     • never sets a badge colour and never paints its own icon (no setIcon with imageData / canvas),
     • never draws anything over the logo in the popup.
   The price lives in the icon's TOOLTIP instead (setTitle) and inside the popup.
   scripts/build_extension.py refuses to package a build that breaks this, and tests/test_extension_logo.py checks
   the popup. Do not bring the badge back — not shorter, not smaller, not as an option. */
'use strict';
const SITE = 'https://entekhab.net';
const BINANCE = 'https://data-api.binance.vision/api/v3';
const DEFAULTS = { lang: 'fa', tip: 'BTC', alerts: [], notifyPosts: false, lastPostId: 0 };

async function settings() {
  const s = await chrome.storage.local.get(Object.keys(DEFAULTS).concat('badge'));
  if (s.badge !== undefined) {               // 1.5.x kept its coin under "badge": it now names the tooltip's coin
    if (s.tip === undefined) { s.tip = s.badge; await chrome.storage.local.set({ tip: s.tip }); }
    await chrome.storage.local.remove('badge'); delete s.badge;
  }
  return { ...DEFAULTS, ...s };
}

async function getJSON(url, ms = 10000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

// live prices for a handful of coins; falls back silently to the site snapshot
async function live(coins) {
  const syms = [...new Set(coins)].filter(c => /^[A-Z0-9]{2,12}$/.test(c) && !['USDT', 'USDC', 'GOLD'].includes(c)).map(c => c + 'USDT');
  if (!syms.length) return {};
  try {
    const d = await getJSON(`${BINANCE}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(syms))}&type=MINI`, 8000);
    const o = {}; d.forEach(x => { const p = +x.lastPrice, op = +x.openPrice; o[x.symbol.replace(/USDT$/, '')] = { price: p, chg24: op ? (p / op - 1) * 100 : null }; });
    return o;
  } catch (e) { return {}; }
}

/* the only badge call this extension may make: an empty one, which removes any badge an older version left */
async function clearIcon() { try { await chrome.action.setBadgeText({ text: '' }); } catch (e) { } }

async function tick() {
  const s = await settings();
  let market = null;
  try { market = await getJSON(`${SITE}/data/market.json?t=${Date.now()}`); } catch (e) { }
  const want = [s.tip, ...s.alerts.map(a => a.coin)].filter(c => c && c !== 'OFF');
  const lv = await live(want);
  const price = c => (lv[c] && lv[c].price) || ((market && market.coins || []).find(x => x.coin === c) || {}).price;
  const chg = c => (lv[c] && lv[c].chg24 != null ? lv[c].chg24 : ((market && market.coins || []).find(x => x.coin === c) || {}).chg24);
  const patch = { checkedAt: Date.now(), live: lv };
  if (market) { patch.market = market; patch.marketAt = Date.now(); }
  await chrome.storage.local.set(patch);

  // the toolbar icon: the logo alone, never covered (THE LOGO RULE above) — the price goes in its tooltip
  await clearIcon();
  const tc = s.tip && s.tip !== 'OFF' ? s.tip : null;
  if (tc && price(tc)) {
    const ch = chg(tc);
    await chrome.action.setTitle({ title: `${tc}: $${price(tc).toLocaleString('en-US', { maximumFractionDigits: 6 })}` + (ch != null ? ` (${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%)` : '') + ' — Entekhab' });
  } else await chrome.action.setTitle({ title: chrome.i18n.getMessage('extTitle') || 'Entekhab' });

  // price alerts (one-shot)
  let changed = false;
  for (const a of s.alerts) {
    if (a.hit) continue;
    const p = price(a.coin); if (!p) continue;
    if ((a.op === '>' && p >= a.price) || (a.op === '<' && p <= a.price)) {
      a.hit = Date.now(); changed = true;
      const up = a.op === '>', px = '$' + p.toLocaleString('en-US', { maximumFractionDigits: 6 });
      const N = {
        fa: ['هشدار قیمت', `${a.coin} ${up ? 'بالاتر از' : 'پایین‌تر از'} $${a.price} رسید — ${px}`],
        ckb: ['ئاگاداریی نرخ', `${a.coin} گەیشتە ${up ? 'سەرووی' : 'خوارووی'} $${a.price} — ${px}`],
        ar: ['تنبيه السعر', `بلغ ${a.coin} ${up ? 'أعلى من' : 'أدنى من'} $${a.price} — ${px}`],
        en: ['Price alert', `${a.coin} went ${up ? 'above' : 'below'} $${a.price} — ${px}`]
      }[s.lang] || [];
      const id = 'alert-' + a.id;
      await notify(id, `${N[0] || 'Entekhab'}: ${a.coin}`, N[1] || `${a.coin} ${px}`, `${SITE}/coins/${a.coin.toLowerCase()}/`);
    }
  }
  if (changed) await chrome.storage.local.set({ alerts: s.alerts });

  // new channel posts
  if (s.notifyPosts) {
    try {
      const d = await getJSON(`${SITE}/api/v1/posts_latest.json?t=${Date.now()}`);
      const posts = d.posts || [], top = posts.length ? posts[0].id : 0;
      if (s.lastPostId && top > s.lastPostId) {
        for (const p of posts.filter(x => x.id > s.lastPostId).slice(0, 3).reverse()) await notify('post-' + p.id, 'Coin_Kurd', p.title || '', p.page || `${SITE}/p/${p.id}/`);
      }
      if (top) await chrome.storage.local.set({ lastPostId: top, posts: posts.slice(0, 20), postsAt: Date.now() });
    } catch (e) { }
  }
}

async function notify(id, title, message, url) {
  const { links = {} } = await chrome.storage.local.get('links');
  links[id] = url; const keys = Object.keys(links); if (keys.length > 60) keys.slice(0, keys.length - 60).forEach(k => delete links[k]);
  await chrome.storage.local.set({ links });
  chrome.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon128.png', title, message: String(message).slice(0, 240), priority: 1 });
}
chrome.notifications.onClicked.addListener(async id => {
  const { links = {} } = await chrome.storage.local.get('links');
  if (links[id] && links[id].startsWith(SITE)) chrome.tabs.create({ url: links[id] });
  chrome.notifications.clear(id);
});

function ensureAlarm() { chrome.alarms.get('tick', a => { if (!a) chrome.alarms.create('tick', { periodInMinutes: 5, delayInMinutes: 0.1 }); }); }
chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(Object.keys(DEFAULTS).concat('badge'));
  const init = {};
  if (cur.badge !== undefined) { if (cur.tip === undefined) init.tip = cur.badge; await chrome.storage.local.remove('badge'); }   // 1.5.x → 1.6
  for (const k in DEFAULTS) if (cur[k] === undefined && init[k] === undefined) init[k] = DEFAULTS[k];
  if (Object.keys(init).length) await chrome.storage.local.set(init);
  await clearIcon();
  ensureAlarm(); tick();
});
chrome.runtime.onStartup.addListener(() => { clearIcon(); ensureAlarm(); tick(); });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tick') tick(); });
chrome.runtime.onMessage.addListener((m, _s, reply) => { if (m && m.type === 'refresh') { tick().then(() => reply({ ok: true })).catch(() => reply({ ok: false })); return true; } });
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && (ch.tip || ch.alerts)) tick(); });

// omnibox:  "ek btc" → coin page,  "ek academy" / "ek lab" / … → section
const PAGES = [
  ['encyclopedia', '/encyclopedia/', 'دانشنامهٔ بازارهای مالی · Encyclopedia of financial markets'],
  ['enc', '/encyclopedia/', 'دانشنامه · Encyclopedia'],
  ['satoshi', '/satoshi/', 'داستان ساتوشی · Satoshi’s story'],
  ['map', '/map/', 'نقشهٔ یادگیری · Learning map'],
  ['battle', '/battle/', 'نبرد من · My Battle'],
  ['apps', '/app/', 'اپلیکیشن‌ها: اندروید، آیفون، ویندوز · Apps: Android, iPhone, Windows'],
  ['bot', '/trade-bot/', 'ربات معامله‌گر انتخاب · Entekhab trading bot'],
  ['academy', '/academy/', 'آکادمی کریپتو · Crypto Academy'], ['lab', '/academy/lab/', 'آزمایشگاه و شبیه‌ساز · Lab & simulator'],
  ['learn', '/learn/', 'مسیر یادگیری · Learning path'], ['glossary', '/academy/glossary/', 'اصطلاحات · Glossary'],
  ['dashboard', '/dashboard/', 'داشبورد بازار · Market dashboard'], ['tools', '/tools/', 'ابزارها · Tools'],
  ['safety', '/safety/', 'بررسی امنیت توکن · Token safety'], ['terminal', '/terminal/', 'ترمینال · Terminal'], ['coins', '/coins/', 'همهٔ کوین‌ها · All coins']
];
function xml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])); }
chrome.omnibox.setDefaultSuggestion({ description: 'Entekhab: نام کوین (btc, eth…) یا satoshi, map, battle, apps, encyclopedia, academy, dashboard' });
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const q = text.trim().toLowerCase(); const { market } = await chrome.storage.local.get('market');
  const coins = ((market && market.coins) || []).map(c => c.coin.toLowerCase());
  const out = [];
  coins.filter(c => c.startsWith(q)).slice(0, 5).forEach(c => out.push({ content: `${SITE}/coins/${c}/`, description: `<match>${xml(c.toUpperCase())}</match> — <url>entekhab.net/coins/${xml(c)}/</url>` }));
  PAGES.filter(p => p[0].startsWith(q)).slice(0, 5).forEach(p => out.push({ content: SITE + p[1], description: `<match>${xml(p[0])}</match> — ${xml(p[2])}` }));
  suggest(out);
});
chrome.omnibox.onInputEntered.addListener(text => {
  const q = text.trim(); let url;
  if (q.startsWith(SITE + '/')) url = q;
  else { const p = PAGES.find(x => x[0] === q.toLowerCase()); url = p ? SITE + p[1] : /^[a-z0-9]{2,12}$/i.test(q) ? `${SITE}/coins/${q.toLowerCase()}/` : `${SITE}/academy/`; }
  chrome.tabs.update({ url });
});
