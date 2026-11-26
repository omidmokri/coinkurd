// End-to-end tests of the account Worker in Miniflare (real workerd + local D1). Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, webcrypto, randomBytes, createHmac } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

const here = new URL('..', import.meta.url).pathname;
execFileSync('npx', ['esbuild', 'src/index.js', '--bundle', '--format=esm', '--platform=neutral', '--main-fields=module,main', '--outfile=dist/worker.js', '--log-level=warning'], { cwd: here });

const SITE = 'https://entekhab.net', API = 'https://api.entekhab.net';
const TG = '123456:TEST-token-abc';
const b64u = b => Buffer.from(b).toString('base64url');
const sha = s => createHash('sha256').update(s).digest();
const outbox = [];
let github = { id: 42, login: 'omid' }, google = { sub: 'g-1', email: 'omid.test@gmail.com' };
const codes = new Map();

let mf;
before(async () => {
  mf = new Miniflare({
    modules: true, scriptPath: here + 'dist/worker.js', compatibilityDate: '2025-06-01',
    d1Databases: ['DB'],
    bindings: { SITE_ORIGIN: SITE, API_ORIGIN: API, RP_ID: 'entekhab.net', EXTRA_ORIGINS: 'https://www.entekhab.net',
      DATA_KEY: b64u(randomBytes(32)), GITHUB_CLIENT_ID: 'gh-id', GITHUB_CLIENT_SECRET: 'gh-secret',
      GOOGLE_CLIENT_ID: 'go-id', GOOGLE_CLIENT_SECRET: 'go-secret', TG_BOT_TOKEN: TG, TG_BOT_NAME: 'test_bot',
      RESEND_KEY: 're_test', EMAIL_FROM: 'entekhab.net <login@entekhab.net>', EMAIL_DAILY: '90' },
    outboundService: async (req) => {
      const u = new URL(req.url);
      if (u.host === 'github.com' && u.pathname === '/login/oauth/access_token') {
        const b = await req.json(); const c = codes.get(b.code);
        if (!c || b.client_secret !== 'gh-secret' || b64u(sha(b.code_verifier)) !== c.challenge || b.redirect_uri !== API + '/v1/auth/github/callback')
          return Response.json({ error: 'bad_verification_code' });
        codes.delete(b.code); return Response.json({ access_token: 'gho_x', token_type: 'bearer', scope: '' });
      }
      if (u.host === 'api.github.com' && u.pathname === '/user') return req.headers.get('authorization') === 'Bearer gho_x' ? Response.json(github) : new Response('', { status: 401 });
      if (u.host === 'api.github.com' && u.pathname.startsWith('/applications/')) { outbox.push({ revoked: true }); return new Response(null, { status: 204 }); }
      if (u.host === 'oauth2.googleapis.com') {
        const f = new URLSearchParams(await req.text()); const c = codes.get(f.get('code'));
        if (!c || b64u(sha(f.get('code_verifier'))) !== c.challenge) return Response.json({ error: 'invalid_grant' }, { status: 400 });
        codes.delete(f.get('code'));
        const claims = { iss: 'https://accounts.google.com', aud: 'go-id', sub: google.sub, email: google.email, email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 600, nonce: c.nonce, ...(google.override || {}) };
        return Response.json({ id_token: 'h.' + b64u(JSON.stringify(claims)) + '.s', access_token: 'ya29' });
      }
      if (u.host === 'api.resend.com') { outbox.push(await req.json()); return Response.json({ id: 'm1' }); }
      return new Response('unexpected outbound ' + req.url, { status: 599 });
    },
  });
  const db = await mf.getD1Database('DB');
  for (const s of readFileSync(here + 'schema.sql', 'utf8').split(';').map(x => x.replace(/--.*$/gm, '').trim()).filter(Boolean)) await db.prepare(s).run();
});
after(async () => { await mf.dispose(); });

// a browser: its own cookie jar for api.entekhab.net
class Browser {
  constructor(ip) { this.jar = new Map(); this.ip = ip || '10.0.0.' + Math.floor(Math.random() * 250); }
  async go(path, opt = {}) {
    const h = new Headers(opt.headers || {});
    if (this.jar.size) h.set('cookie', [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '));
    h.set('cf-connecting-ip', this.ip);
    if (opt.json !== undefined) { h.set('content-type', 'application/json'); }
    if (opt.method === 'POST' && !h.has('origin') && opt.origin !== false) h.set('origin', SITE);
    if (opt.method !== 'POST' && opt.fetch) h.set('origin', SITE);
    const r = await mf.dispatchFetch(API + path, { method: opt.method || 'GET', headers: h, body: opt.json !== undefined ? JSON.stringify(opt.json) : opt.body, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) {
      const [kv, ...attrs] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (/max-age=0/i.test(attrs.join(';')) || !v) this.jar.delete(k); else this.jar.set(k, v);
      assert.match(c, /Secure/); assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Lax/); assert.match(c, /^__Host-/);
    }
    return r;
  }
  post(path, json) { return this.go(path, { method: 'POST', json }); }
  async me() { return (await this.go('/v1/me', { fetch: true })).json(); }
}

async function oauth(b, p, mode, code) {
  let loc;
  if (mode === 'link') {      // adding a method starts from the site's own POST only
    const s = await b.post(`/v1/auth/${p}/start`, { mode: 'link', ret: '/trader/' });
    assert.equal(s.status, 200);
    loc = new URL((await s.json()).url);
  } else {
    const s = await b.go(`/v1/auth/${p}/start?return=/trader/`);
    assert.equal(s.status, 302);
    loc = new URL(s.headers.get('location'));
  }
  const q = loc.searchParams;
  assert.equal(q.get('code_challenge_method'), 'S256');
  assert.equal(q.get('redirect_uri'), `${API}/v1/auth/${p}/callback`);
  if (p === 'github') { assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize'); assert.equal(q.get('scope'), null); }
  if (p === 'google') { assert.equal(q.get('scope'), 'openid email'); assert.ok(q.get('nonce')); }
  codes.set(code, { challenge: q.get('code_challenge'), nonce: q.get('nonce') });
  const c = await b.go(`/v1/auth/${p}/callback?code=${code}&state=${q.get('state')}`);
  assert.equal(c.status, 302);
  return { loc: c.headers.get('location'), state: q.get('state') };
}

test('signed out: providers listed, nothing else', async () => {
  const b = new Browser();
  const r = await b.go('/v1/me', { fetch: true });
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
  assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
  const j = await r.json();
  assert.equal(j.signedIn, false);
  assert.deepEqual(j.providers, { github: true, google: true, telegram: true, wallet: true, passkey: true, email: true });
  assert.equal((await b.go('/v1/data', { fetch: true })).status, 401);
});

test('cross-site requests are refused', async () => {
  const b = new Browser();
  const evil = await b.go('/v1/me', { headers: { origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  assert.equal((await b.go('/v1/logout', { method: 'POST', json: {}, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await b.go('/v1/logout', { method: 'POST', json: {}, origin: false })).status, 403);
  assert.equal((await b.go('/v1/auth/wallet/start', { method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await b.go('/v1/me', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await b.go('/v1/me', { method: 'OPTIONS', headers: { origin: SITE } })).status, 204);
});

test('GitHub: PKCE + state, bound to the browser, single use, token revoked', async () => {
  const b = new Browser();
  const { loc, state } = await oauth(b, 'github', null, 'code-gh-1');
  assert.equal(loc, SITE + '/trader/#ek_auth=new');
  assert.ok(b.jar.has('__Host-eks')); assert.ok(!b.jar.has('__Host-ekf'));
  assert.ok(outbox.some(x => x.revoked));
  const me = await b.me();
  assert.equal(me.signedIn, true);
  assert.deepEqual(me.methods.map(m => [m.provider, m.label]), [['github', '@omid']]);
  // the same callback again: refused
  const again = await b.go(`/v1/auth/github/callback?code=code-gh-1&state=${state}`);
  assert.match(again.headers.get('location'), /#ek_auth=err_/);
  // a planted callback in another browser (no flow cookie): refused
  const victim = new Browser(), s = await b.go('/v1/auth/github/start');
  const st = new URL(s.headers.get('location')).searchParams.get('state');
  const planted = await victim.go(`/v1/auth/github/callback?code=x&state=${st}`);
  assert.match(planted.headers.get('location'), /#ek_auth=err_other_browser$/);
  assert.equal((await victim.me()).signedIn, false);
  // signing in again finds the same account
  const b2 = new Browser();
  assert.match((await oauth(b2, 'github', null, 'code-gh-2')).loc, /#ek_auth=in$/);
});

test('open redirects are not possible', async () => {
  const b = new Browser();
  for (const r of ['//evil.example/', '/\\evil.example', 'https://evil.example/', '/me/?x=<script>']) {
    const s = await b.go('/v1/auth/github/start?return=' + encodeURIComponent(r));
    const st = new URL(s.headers.get('location')).searchParams.get('state');
    const c = await b.go(`/v1/auth/github/callback?error=access_denied&state=${st}`);
    assert.equal(c.headers.get('location'), SITE + '/me/#ek_auth=err_cancelled');
  }
});

test('Google: nonce and audience checked; email kept masked only', async () => {
  const b = new Browser();
  assert.match((await oauth(b, 'google', null, 'code-go-1')).loc, /#ek_auth=new$/);
  assert.equal((await b.me()).methods[0].label, 'om***@gmail.com');
  google.override = { aud: 'someone-else' };
  const x = new Browser();
  assert.match((await oauth(x, 'google', null, 'code-go-2')).loc, /err_provider_refused$/);
  google.override = null;
});

async function walletLogin(b, key, mode) {
  const addr = '0x' + Buffer.from(keccak_256(secp256k1.getPublicKey(key, false).slice(1)).slice(12)).toString('hex');
  const s = await (await b.post('/v1/auth/wallet/start', { address: addr, chainId: 1, mode })).json();
  assert.match(s.message, /^entekhab\.net wants you to sign in with your Ethereum account:\n0x/);
  assert.match(s.message, /not a transaction/);
  const bytes = Buffer.from(s.message, 'utf8');
  const digest = keccak_256(Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n' + bytes.length), bytes]));
  const sig = secp256k1.sign(digest, key);
  const hexSig = '0x' + sig.toCompactHex() + (27 + sig.recovery).toString(16);
  return { addr, flow: s.flow, sig: hexSig, res: await b.post('/v1/auth/wallet/verify', { flow: s.flow, signature: hexSig }) };
}

test('wallet: signature must come from the address, once', async () => {
  const b = new Browser(), key = secp256k1.utils.randomPrivateKey();
  const { res, flow, sig } = await walletLogin(b, key);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).result, 'new');
  assert.match((await b.me()).methods[0].label, /^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/);
  assert.equal((await b.post('/v1/auth/wallet/verify', { flow, signature: sig })).status, 403);     // flow cookie gone
  // a signature by another key for this address
  const c = new Browser(), other = secp256k1.utils.randomPrivateKey();
  const addr = '0x' + Buffer.from(keccak_256(secp256k1.getPublicKey(key, false).slice(1)).slice(12)).toString('hex');
  const s = await (await c.post('/v1/auth/wallet/start', { address: addr })).json();
  const bytes = Buffer.from(s.message); const d = keccak_256(Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n' + bytes.length), bytes]));
  const bad = secp256k1.sign(d, other);
  const r = await c.post('/v1/auth/wallet/verify', { flow: s.flow, signature: '0x' + bad.toCompactHex() + (27 + bad.recovery).toString(16) });
  assert.equal(r.status, 400);
  assert.equal((await c.me()).signedIn, false);
});

test('Telegram: sign-in page answer, signature and age checked; Mini App data refused', async () => {
  const b = new Browser();
  const s = await (await b.post('/v1/auth/telegram/start', { ret: '/me/' })).json();
  const u = new URL(s.url);
  assert.equal(u.origin + u.pathname, 'https://oauth.telegram.org/auth');
  assert.equal(u.searchParams.get('bot_id'), '123456');
  assert.equal(u.searchParams.get('return_to'), `${SITE}/me/?tgf=${s.flow}`);
  assert.equal(u.searchParams.get('request_access'), null);
  const auth = { id: 777, first_name: 'Omid', username: 'omid_m', auth_date: Math.floor(Date.now() / 1000) };
  const dcs = Object.keys(auth).sort().map(k => `${k}=${auth[k]}`).join('\n');
  auth.hash = createHmac('sha256', sha(TG)).update(dcs).digest('hex');
  const tampered = { ...auth, id: 778 };
  assert.equal((await b.post('/v1/auth/telegram/verify', { flow: s.flow, auth: tampered })).status, 400);
  const s2 = await (await b.post('/v1/auth/telegram/start', {})).json();
  const ok = await b.post('/v1/auth/telegram/verify', { flow: s2.flow, auth });
  assert.equal(ok.status, 200);
  assert.equal((await b.me()).methods[0].label, '@omid_m');
  // Mini App initData, same account
  const m = new Browser(), s3 = await (await m.post('/v1/auth/telegram/start', {})).json();
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAA', user: JSON.stringify({ id: 777, first_name: 'Omid' }) });
  const pairs = [...p].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  p.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(TG).digest()).update(pairs).digest('hex'));
  const r = await m.post('/v1/auth/telegram/verify', { flow: s3.flow, initData: p.toString() });
  assert.equal(r.status, 400, 'Mini App data is not accepted (it is not tied to this sign-in and could be replayed)');
  // too old
  const o = new Browser(), s4 = await (await o.post('/v1/auth/telegram/start', {})).json();
  const old = { id: 9, first_name: 'x', auth_date: Math.floor(Date.now() / 1000) - 4000 };
  old.hash = createHmac('sha256', sha(TG)).update(Object.keys(old).sort().map(k => `${k}=${old[k]}`).join('\n')).digest('hex');
  assert.equal((await o.post('/v1/auth/telegram/verify', { flow: s4.flow, auth: old })).status, 400);
});

// ---- a software passkey (P-256), enough to drive the real WebAuthn checks
function cbor(v) {
  const head = (mt, n) => n < 24 ? [mt << 5 | n] : n < 256 ? [mt << 5 | 24, n] : [mt << 5 | 25, n >> 8, n & 255];
  if (typeof v === 'number') return Buffer.from(v >= 0 ? head(0, v) : head(1, -1 - v));
  if (typeof v === 'string') { const b = Buffer.from(v); return Buffer.concat([Buffer.from(head(3, b.length)), b]); }
  if (v instanceof Uint8Array) return Buffer.concat([Buffer.from(head(2, v.length)), Buffer.from(v)]);
  if (v instanceof Map) return Buffer.concat([Buffer.from(head(5, v.size)), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  throw new Error('cbor');
}
async function makePasskey() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  return { kp, id: randomBytes(32), counter: 0, cose: new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]) };
}
function authData(pk, flags, withCred) {
  const c = Buffer.alloc(4); c.writeUInt32BE(pk.counter);
  const parts = [sha('entekhab.net'), Buffer.from([flags]), c];
  if (withCred) { const l = Buffer.alloc(2); l.writeUInt16BE(pk.id.length); parts.push(Buffer.alloc(16), l, pk.id, cbor(pk.cose)); }
  return Buffer.concat(parts);
}
function rawToDer(raw) {
  const int = b => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.subarray(i); if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); return Buffer.concat([Buffer.from([2, b.length]), b]); };
  const body = Buffer.concat([int(raw.subarray(0, 32)), int(raw.subarray(32))]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}
async function pkRegister(b, pk, origin = SITE) {
  const s = await (await b.post('/v1/auth/passkey/register/start', {})).json();
  assert.equal(s.options.rp.id, 'entekhab.net'); assert.equal(s.options.attestation, 'none');
  const cd = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: s.options.challenge, origin }));
  const att = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData(pk, 0x45, true)]]));
  return b.post('/v1/auth/passkey/register/verify', { flow: s.flow, credential: { id: b64u(pk.id), rawId: b64u(pk.id), type: 'public-key',
    response: { clientDataJSON: b64u(cd), attestationObject: b64u(att) } } });
}
async function pkLogin(b, pk, origin = SITE) {
  const s = await (await b.post('/v1/auth/passkey/login/start', {})).json();
  const cd = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: s.options.challenge, origin }));
  const ad = authData(pk, 0x05, false);
  const raw = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pk.kp.privateKey, Buffer.concat([ad, sha(cd)])));
  return b.post('/v1/auth/passkey/login/verify', { flow: s.flow, credential: { id: b64u(pk.id), rawId: b64u(pk.id), type: 'public-key',
    response: { clientDataJSON: b64u(cd), authenticatorData: b64u(ad), signature: b64u(rawToDer(raw)), userHandle: null } } });
}

test('passkey: register makes an account, sign-in checks origin, signature and counter', async () => {
  const pk = await makePasskey(), b = new Browser();
  assert.equal((await pkRegister(new Browser(), pk, 'https://evil.example')).status, 400);
  const r = await pkRegister(b, pk);
  assert.equal(r.status, 200); assert.equal((await r.json()).result, 'new');
  const c = new Browser();
  pk.counter = 0;
  assert.equal((await (await pkLogin(c, pk)).json()).result, 'in');
  assert.equal((await pkLogin(new Browser(), pk, 'https://evil.example')).status, 400);
  pk.counter = 5; assert.equal((await pkLogin(new Browser(), pk)).status, 200);
  pk.counter = 3; assert.equal((await pkLogin(new Browser(), pk)).status, 400);    // counter went back
  const other = await makePasskey(); other.id = pk.id; other.counter = 9;          // same id, wrong key
  assert.equal((await pkLogin(new Browser(), other)).status, 400);
});

test('email link: rate limited, one use, only in the browser that asked', async () => {
  const b = new Browser('10.1.1.1');
  outbox.length = 0;
  assert.equal((await b.post('/v1/auth/email/start', { email: 'not an email' })).status, 400);
  assert.equal((await b.post('/v1/auth/email/start', { email: 'Omid@Example.com', lang: 'fa', ret: '/me/' })).status, 200);
  const mail = outbox.find(x => x.to);
  assert.deepEqual(mail.to, ['omid@example.com']); assert.equal(mail.subject, 'ورود به entekhab.net');
  const link = mail.text.match(/https:\/\/entekhab\.net\/me\/#ek_email=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/);
  assert.ok(link);
  const other = new Browser();
  assert.equal((await (await other.post('/v1/auth/email/verify', { flow: link[1], token: link[2] })).json()).error, 'other_browser');
  assert.equal((await b.post('/v1/auth/email/verify', { flow: link[1], token: 'wrong' })).status, 400);
  // the wrong token used the flow up: ask again
  assert.equal((await b.post('/v1/auth/email/start', { email: 'omid@example.com' })).status, 200);
  const l2 = outbox.filter(x => x.to).pop().text.match(/#ek_email=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/);
  const ok = await b.post('/v1/auth/email/verify', { flow: l2[1], token: l2[2] });
  assert.equal((await ok.json()).result, 'new');
  assert.equal((await b.me()).methods[0].label, 'om***@example.com');
  assert.equal((await b.post('/v1/auth/email/verify', { flow: l2[1], token: l2[2] })).status, 403);
  assert.equal((await b.post('/v1/auth/email/start', { email: 'omid@example.com' })).status, 200);
  assert.equal((await b.post('/v1/auth/email/start', { email: 'omid@example.com' })).status, 429);     // 3 an hour
  const db = await mf.getD1Database('DB');
  const all = JSON.stringify((await db.prepare('SELECT * FROM identities').all()).results);
  assert.ok(!all.includes('omid@example.com'), 'the address itself is never stored');
});

test('data: newer wins, deletions kept, limits, encrypted at rest', async () => {
  const b = new Browser();
  await oauth(b, 'github', null, 'code-gh-data');      // same GitHub account as before
  github = { id: 4242, login: 'data' };
  const d = new Browser(); await oauth(d, 'github', null, 'code-gh-data2');
  const w = await (await d.post('/v1/data', { changes: [{ k: 'ek_watch', v: '["BTC"]', t: 1000 }, { k: 'ek_level', v: '3', t: 1000 }] })).json();
  assert.deepEqual(w.applied.sort(), ['ek_level', 'ek_watch']);
  // the display language and device flags stay on each device
  assert.equal((await d.post('/v1/data', { changes: [{ k: 'ck_lang', v: 'en', t: 1001 }] })).status, 400);
  assert.equal((await d.post('/v1/data', { changes: [{ k: 'ek_sync', v: '{}', t: 1001 }] })).status, 400);
  const older = await (await d.post('/v1/data', { changes: [{ k: 'ek_watch', v: '["ETH"]', t: 500 }] })).json();
  assert.deepEqual(older.stale, [{ k: 'ek_watch', v: '["BTC"]', t: 1000 }]);
  const del = await (await d.post('/v1/data', { changes: [{ k: 'ek_level', v: null, t: 2000 }] })).json();
  assert.deepEqual(del.applied, ['ek_level']);
  const all = await (await d.go('/v1/data?since=0', { fetch: true })).json();
  assert.deepEqual(all.items.map(x => [x.k, x.v]).sort(), [['ek_level', null], ['ek_watch', '["BTC"]']]);
  const since = await (await d.go('/v1/data?since=' + (all.rev - 1), { fetch: true })).json();
  assert.equal(since.items.length, 1);
  for (const bad of [{ k: '__proto__', v: 'x', t: 1 }, { k: 'other_key', v: 'x', t: 1 }, { k: 'ek_sync_state', v: 'x', t: 1 }, { k: 'ek_gpu', v: 'x', t: 1 },
                     { k: 'ek_x', v: 'x'.repeat(100 * 1024 + 1), t: 1 }, { k: 'ek_x', v: 5, t: 1 }])
    assert.equal((await d.post('/v1/data', { changes: [bad] })).status, 400, JSON.stringify(bad).slice(0, 60));
  const db = await mf.getD1Database('DB');
  const rows = (await db.prepare('SELECT v FROM data').all()).results.map(r => r.v);
  assert.ok(rows.every(v => v == null || !v.includes('BTC')), 'values are encrypted');
  // quota
  const big = 'x'.repeat(100 * 1024 - 10);
  let refused = 0;
  for (let i = 0; i < 20; i++) refused += (await (await d.post('/v1/data', { changes: [{ k: 'ek_big' + i, v: big, t: 5 }] })).json()).quota.length;
  assert.ok(refused > 0, 'quota reached');
});

test('linking and joining: every method on one account, nothing lost', async () => {
  github = { id: 9001, login: 'joiner' };
  const a = new Browser();
  await oauth(a, 'github', null, 'code-join-a');
  await a.post('/v1/data', { changes: [{ k: 'ek_watch', v: '["BTC","SOL"]', t: 100 }, { k: 'ek_notes', v: '[{"id":1,"title":"a"}]', t: 100 }] });
  // the same person had signed in with a wallet elsewhere and saved other things there
  const key = secp256k1.utils.randomPrivateKey(), b = new Browser();
  await walletLogin(b, key);
  await b.post('/v1/data', { changes: [{ k: 'ek_watch', v: '["ETH"]', t: 200 }, { k: 'ek_notes', v: '[{"id":2,"title":"b"}]', t: 50 }, { k: 'ek_port', v: '{"BTC":1}', t: 50 }] });
  // link Google to A (new method), then the wallet (belongs to B: accounts are joined)
  google = { sub: 'g-join', email: 'j@x.org' };
  assert.match((await oauth(a, 'google', 'link', 'code-join-g')).loc, /#ek_auth=linked$/);
  const { res } = await walletLogin(a, key, 'link');
  assert.equal((await res.json()).result, 'joined');
  const me = await a.me();
  assert.deepEqual(me.methods.map(m => m.provider).sort(), ['github', 'google', 'wallet']);
  const data = Object.fromEntries((await (await a.go('/v1/data?since=0', { fetch: true })).json()).items.map(x => [x.k, x.v]));
  assert.deepEqual(JSON.parse(data.ek_watch).sort(), ['BTC', 'ETH', 'SOL']);
  assert.deepEqual(JSON.parse(data.ek_notes).map(n => n.id).sort(), [1, 2]);
  assert.equal(data.ek_port, '{"BTC":1}');
  assert.equal((await b.me()).signedIn, false, 'the joined account is gone, its session too');
  // link without being signed in: refused
  const n = new Browser();
  assert.equal((await n.post('/v1/auth/google/start', { mode: 'link' })).status, 401);
  // link never starts from a plain link another site could open
  assert.equal((await a.go('/v1/auth/google/start?mode=link')).status, 405);
  // unlink: one method at a time, never the last
  const gref = me.methods.find(m => m.provider === 'google').ref;
  assert.equal((await a.post('/v1/unlink', { ref: gref })).status, 200);
  const left = (await a.me()).methods;
  await a.post('/v1/unlink', { ref: left[0].ref });
  assert.equal((await a.post('/v1/unlink', { ref: (await a.me()).methods[0].ref })).status, 409);
});

test('sign out and delete the account', async () => {
  github = { id: 31337, login: 'bye' };
  const a = new Browser();
  await oauth(a, 'github', null, 'code-bye');
  await a.post('/v1/data', { changes: [{ k: 'ek_watch', v: '["X"]', t: 1 }] });
  const second = new Browser(); await oauth(second, 'github', null, 'code-bye2');
  assert.equal((await a.post('/v1/logout', {})).status, 200);
  assert.equal((await a.me()).signedIn, false);
  assert.equal((await second.post('/v1/account/delete', {})).status, 400);
  assert.equal((await second.post('/v1/account/delete', { confirm: 'delete' })).status, 200);
  assert.equal((await second.me()).signedIn, false);
  const db = await mf.getD1Database('DB');
  const left = await db.prepare("SELECT COUNT(*) n FROM identities WHERE provider='github' AND subject='31337'").first();
  assert.equal(left.n, 0);
  const fresh = new Browser();
  assert.match((await oauth(fresh, 'github', null, 'code-bye3')).loc, /#ek_auth=new$/);
});

test('hardening: sessions end on unlink and everywhere, deletion records count, request limits', async () => {
  github = { id: 9090, login: 'h1' };
  const a = new Browser(), b = new Browser();
  await oauth(a, 'github', null, 'code-h-a'); await oauth(b, 'github', null, 'code-h-b');   // one account, two browsers
  google = { sub: 'g-h1', email: 'h1@example.com' };
  await oauth(a, 'google', 'link', 'code-h-g');
  assert.equal((await b.me()).signedIn, true);
  // removing a method ends every other session, so a lost method keeps no way in
  const gh = (await a.me()).methods.find(m => m.provider === 'github').ref;
  assert.equal((await a.post('/v1/unlink', { ref: gh })).status, 200);
  assert.equal((await b.me()).signedIn, false);
  assert.equal((await a.me()).signedIn, true);
  // sign out on all devices
  const c = new Browser(); await oauth(c, 'google', null, 'code-h-g2');
  assert.equal((await a.post('/v1/logout', { all: true })).status, 200);
  assert.equal((await a.me()).signedIn, false);
  assert.equal((await c.me()).signedIn, false);
  // deleting a key the account never had stores nothing
  const d = new Browser(); await oauth(d, 'google', null, 'code-h-g3');
  const del = await (await d.post('/v1/data', { changes: Array.from({ length: 80 }, (_, i) => ({ k: 'ek_none' + i, v: null, t: 5 })) })).json();
  assert.equal(del.applied.length, 80);
  assert.equal((await (await d.go('/v1/data?since=0', { fetch: true })).json()).items.length, 0);
  // 80 changes in one request work (D1 binds at most 100 values); more are refused before touching the database
  const put = await (await d.post('/v1/data', { changes: Array.from({ length: 80 }, (_, i) => ({ k: 'ek_k' + i, v: 'x', t: 5 })) })).json();
  assert.equal(put.applied.length, 80);
  assert.equal((await d.post('/v1/data', { changes: Array.from({ length: 81 }, (_, i) => ({ k: 'ek_z' + i, v: 'x', t: 5 })) })).status, 400);
  // a body with no length header is still read with a limit
  const big = new ReadableStream({ start(ctl) { const chunk = new Uint8Array(1024 * 1024).fill(32); for (let i = 0; i < 5; i++) ctl.enqueue(chunk); ctl.close(); } });
  const r = await mf.dispatchFetch(API + '/v1/data', { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', cookie: [...d.jar].map(([k, v]) => `${k}=${v}`).join('; ') }, body: big, duplex: 'half' });
  assert.equal(r.status, 413);
});

test('hardening: new accounts are capped per network, IPv6 counted by /64', async () => {
  const made = [];
  for (let i = 0; i < 11; i++) {
    const b = new Browser(`2001:db8:1:2:${i}::1`);
    const s = await (await b.post('/v1/auth/wallet/start', { address: '0x' + (i + 1).toString(16).padStart(40, '0') })).json();
    made.push(s && s.message ? 1 : 0);
  }
  assert.equal(made.reduce((x, y) => x + y), 11, 'starting is not the limit');
  // (the account cap is checked where an account is made; wallet signing is covered elsewhere, passkeys are quickest here)
  let refused = 0;
  for (let i = 0; i < 12; i++) {
    const b = new Browser(`2001:db8:9:9:${i}::7`), pk = await makePasskey();
    const r = await pkRegister(b, pk);
    if (r.status === 429) refused++;
  }
  assert.ok(refused >= 2, 'more than 10 new accounts a day from one /64 are refused: ' + refused);
});
