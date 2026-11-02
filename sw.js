/* entekhab.net service worker — installable app + offline reading.
   Pages, data and scripts: network first (always fresh when online), cached copy when offline.
   Images and fonts: cache first. Third-party requests (Binance, TradingView, Google Fonts…) are never touched. */
const V = 'ek-v1', STATIC = V + '-static', PAGES = V + '-pages', DATA = V + '-data';
const CORE = ['/', '/offline.html', '/assets/ui.css', '/assets/ui.js', '/assets/logo-h.webp', '/assets/favicon-32.png', '/assets/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(STATIC).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(V + '-')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trim(name, max) { const c = await caches.open(name), ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); }
async function netFirst(req, name, key, max) {
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') { const c = await caches.open(name); await c.put(key, res.clone()); trim(name, max); }
    return res;
  } catch (err) {
    const hit = await caches.match(key);
    if (hit) return hit;
    if (req.mode === 'navigate') return (await caches.match('/offline.html')) || Response.error();
    return Response.error();
  }
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url); if (u.origin !== location.origin) return;
  const key = u.origin + u.pathname;                       // ignore ?v= cache-busters so the store stays small
  if (req.mode === 'navigate') { e.respondWith(netFirst(req, PAGES, key, 80)); return; }
  if (u.pathname.startsWith('/data/') && u.pathname.endsWith('.json')) { e.respondWith(netFirst(req, DATA, key, 60)); return; }
  if (/\.(js|css|webmanifest)$/.test(u.pathname)) { e.respondWith(netFirst(req, STATIC, key, 120)); return; }
  if (/\.(webp|png|jpg|jpeg|svg|ico|woff2?)$/.test(u.pathname)) {
    e.respondWith(caches.open(STATIC).then(c => c.match(key).then(m => m || fetch(req).then(res => { if (res.ok && res.type === 'basic') c.put(key, res.clone()); return res; }))));
  }
});
