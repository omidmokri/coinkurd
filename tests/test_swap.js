/* /swap/ — assets/swap/swap.js run against a fake page: what reaches Rango's widget, and when nothing does.
   Run: node tests/test_swap.js */
'use strict';
const S = require('../assets/swap/swap.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : 'FAIL  ') + m); if (!c) fails++; };

const KEY = '0a1b2c3d-1111-4222-8333-444455556666', WC = '0123456789abcdef0123456789abcdef';
const ADDR = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const good = () => ({ enabled: true, apiKey: KEY, walletConnectProjectId: WC, affiliate: { ref: 'Ab12Cd', percent: 0.5, wallets: { BSC: ADDR } } });

// ---- config(): an allow-list, rebuilt field by field
const c = S.config(good());
ok(c && c.apiKey === KEY && c.walletConnectProjectId === WC, 'a good config passes');
ok(JSON.stringify(c.affiliate) === JSON.stringify({ ref: 'Ab12Cd', percent: 0.5, wallets: { BSC: ADDR } }), 'the affiliate block is passed as given');
ok(JSON.stringify(Object.keys(c).sort()) === JSON.stringify(['affiliate', 'apiKey', 'features', 'from', 'language', 'theme', 'walletConnectProjectId']), 'only the known fields reach the widget');
const evil = good(); evil.apiUrl = 'https://evil.example/'; evil.signers = { customEthereumRPC: 'https://evil.example/' }; evil.__UNSTABLE_OR_INTERNAL__ = { campaignTag: { linkUrl: 'https://evil.example/' } };
evil.affiliate.extra = 'x';
const e = S.config(evil);
ok(e && !('apiUrl' in e) && !('signers' in e) && !('__UNSTABLE_OR_INTERNAL__' in e) && !('extra' in e.affiliate), 'apiUrl, custom RPCs and internal fields are dropped even if someone adds them');
ok(JSON.stringify(e).indexOf('evil') < 0, '…and none of their values survive');
const refuse = (m, why) => { const d = good(); m(d); ok(S.config(d) === null, 'refused: ' + why); };
refuse(d => { d.enabled = false; }, 'switched off');
refuse(d => { d.enabled = 'true'; }, 'enabled as text');
refuse(d => { d.apiKey = ''; }, 'no api key');
refuse(d => { d.apiKey = 'c6381a79-2817-4602-83bf-6a641a409e32'; }, "Rango's documentation key");
refuse(d => { d.walletConnectProjectId = 'e24844c5deb5193c1c14840a7af6a40b'; }, 'the documentation WalletConnect id');
refuse(d => { d.apiKey = KEY + '&apiUrl=x'; }, 'an api key with extra characters');
refuse(d => { d.affiliate.percent = 3.5; }, 'a fee above 3%');
refuse(d => { d.affiliate.percent = -0.1; }, 'a negative fee');
refuse(d => { d.affiliate.percent = '1'; }, 'a fee given as text');
refuse(d => { d.affiliate.percent = NaN; }, 'a fee that is not a number');
refuse(d => { d.affiliate.ref = ''; }, 'a fee without a ref');
refuse(d => { d.affiliate.ref = 'a b'; }, 'a ref with a space');
refuse(d => { d.affiliate.wallets.BSC = ADDR.slice(0, -1); }, 'a short address');
refuse(d => { d.affiliate.wallets.SOLANA = ADDR; }, 'an EVM address for Solana');
refuse(d => { d.affiliate.wallets = [ADDR]; }, 'wallets as a list');
refuse(d => { d.affiliate.wallets['__proto__x'] = ADDR; }, 'a bad chain name');
ok(S.config(null) === null && S.config([]) === null && S.config('x') === null, 'refused: anything that is not an object');
const noAff = good(); delete noAff.affiliate;
ok(S.config(noAff) && !('affiliate' in S.config(noAff)), 'no affiliate block: the widget simply gets none');

// ---- address(): Rango's own format, to Rango's own host only
const u = S.address(c);
const url = new URL(u);
ok(url.origin === 'https://widget.rango.exchange' && url.pathname === '/', 'the frame address is https://widget.rango.exchange/');
ok([...url.searchParams.keys()].join() === 'config', 'one parameter only: config (no clientUrl, so the widget never messages this page)');
const back = JSON.parse(url.searchParams.get('config'), (k, v) => typeof v === 'string' && v[0] === '$' ? v.replace('$', '#') : v);   // what widget/app/src/App.tsx does
ok(JSON.stringify(back) === JSON.stringify(c), "read back the way Rango's app reads it, the settings are unchanged");
ok(u.indexOf('#') < 0, 'no # in the address (colours travel with $, as Rango expects)');
ok(S.address(null) === null, 'no settings → no address');

// ---- start(): a fake page
function page(dataC, opts) {
  opts = opts || {};
  const attrs = {}, kids = [], store = { ck_lang: opts.lang };
  const el = () => { const a = {}; return { a, setAttribute(k, v) { a[k] = String(v); }, getAttribute(k) { return k in a ? a[k] : null; } }; };
  const de = { setAttribute(k, v) { attrs[k] = v; } };
  const box = { getAttribute: k => k === 'data-c' ? dataC : null, appendChild(n) { kids.push(n); } };
  const doc = { documentElement: de, getElementById: id => id === 'sw-box' ? box : null, createElement: t => Object.assign(el(), { tag: t }), querySelectorAll: () => [] };
  const win = { document: doc, localStorage: { getItem: k => store[k] || null, setItem(k, v) { store[k] = v; } } };
  win.self = win; win.top = opts.framed ? {} : win;
  return { win, attrs, kids };
}
let p = page(JSON.stringify({ enabled: false }));
ok(S.start(p.win) === 'off' && p.kids.length === 0 && p.attrs['data-s'] === 'off', 'switched off: no frame is made, nothing leaves the site');
p = page('{not json');
ok(S.start(p.win) === 'off' && p.kids.length === 0, 'broken settings: no frame');
p = page(JSON.stringify(evil), { framed: true });
ok(S.start(p.win) === 'framed' && p.kids.length === 0 && p.attrs['data-s'] === 'framed', 'inside another site\'s frame: no widget (click-jacking)');
p = page(JSON.stringify(good()), { lang: 'ckb' });
ok(S.start(p.win) === 'on' && p.kids.length === 1 && p.attrs['data-s'] === 'on', 'good settings: one frame');
const f = p.kids[0];
ok(f.tag === 'iframe' && f.a.src === u, 'it is an iframe to the checked address');
ok(f.a.sandbox === 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms', 'sandboxed; cannot navigate this tab');
ok(f.a.referrerpolicy === 'no-referrer' && f.a.allow === 'clipboard-write', 'no referrer; the only permission is copying to the clipboard');
ok(p.attrs['data-l'] === 'ckb' && p.attrs.dir === 'rtl', 'the page follows the language chosen on the site');
p = page(JSON.stringify(good()), { lang: '"><script>' });
S.start(p.win);
ok(p.attrs['data-l'] === 'fa', 'an unknown stored language falls back to Persian');

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASS'));
process.exit(fails ? 1 : 0);
