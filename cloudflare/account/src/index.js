/* entekhab.net — account service (Cloudflare Worker + D1).

   Optional sign-in for the whole site. A visitor who never signs in loses nothing: the site keeps working from the
   browser's own storage exactly as before. A visitor who signs in gets that same data kept and synced, so it never
   resets. Sign-in methods, all joined to one account: GitHub, Google, Telegram, an Ethereum wallet (a signed message,
   never a transaction), a passkey and an email link.

   Security, in short:
   - The session is an HttpOnly, Secure, SameSite=Lax cookie on this host only (__Host-); only its hash is stored.
   - Every state-changing call must come from the site's origin, as JSON (so a cross-site form cannot send it).
   - Every sign-in step is single-use, expires within minutes and is bound to the browser that started it
     (a second __Host- cookie), so a sign-in link or result cannot be replayed or planted in someone else's browser.
   - GitHub and Google: authorization code with PKCE and state; the smallest scopes (none / openid email);
     the provider token is thrown away after one read.
   - Saved data is encrypted at rest with AES-256-GCM (a Worker secret), bound to the account and key.
   - Rate limits on every sign-in start; IPs are only used hashed, never stored.
   See README.fa.md for setup. */
import { b64u, unb64u, randId, sha256, sha256hex, same, cookies, setCookie, SEC, maskEmail, shortAddr, dec } from './util.js';
import * as S from './store.js';
import { verifyRegistration, verifyAssertion } from './webauthn.js';
import { message as siweMessage, recover, checksum } from './siwe.js';
import { checkLogin } from './telegram.js';
import Merge from '../../../assets/account/merge.js';

const SID = '__Host-eks', FID = '__Host-ekf';
const FLOW_SECONDS = 600;

function conf(env) {
  const site = env.SITE_ORIGIN || 'https://entekhab.net';
  const extra = String(env.EXTRA_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return { site, origins: [site, ...extra], api: env.API_ORIGIN || 'https://api.entekhab.net', rpId: env.RP_ID || new URL(site).hostname };
}

function providers(env) {
  return {
    github: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    telegram: !!(env.TG_BOT_TOKEN && /^\d+:/.test(env.TG_BOT_TOKEN)),
    wallet: true,
    passkey: true,
    email: !!(env.RESEND_KEY && env.EMAIL_FROM),
  };
}

class Fail extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }

function reply(req, env, body, status = 200, extra = {}) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', ...SEC, ...extra });
  const o = req.headers.get('origin');
  if (o && conf(env).origins.includes(o)) {
    h.set('access-control-allow-origin', o);
    h.set('access-control-allow-credentials', 'true');
  }
  h.set('vary', 'Origin');
  return new Response(JSON.stringify(body), { status, headers: h });
}
function withCookies(res, list) { for (const c of list) res.headers.append('set-cookie', c); return res; }
function redirect(url, cookieList = []) {
  const h = new Headers({ location: url, ...SEC });
  for (const c of cookieList) h.append('set-cookie', c);
  return new Response(null, { status: 302, headers: h });
}

function safeReturn(r) {
  return typeof r === 'string' && r.length <= 200 && /^\/(?![/\\])[A-Za-z0-9\-._~/%]*$/.test(r) ? r : '/me/';
}
function ipOf(req) {
  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  if (!ip.includes(':')) return ip;
  const full = ip.split('::').length === 2      // expand '::' so the first four groups are the /64
    ? (([a, b]) => { const x = a ? a.split(':') : [], y = b ? b.split(':') : []; return [...x, ...Array(8 - x.length - y.length).fill('0'), ...y]; })(ip.split('::'))
    : ip.split(':');
  return full.slice(0, 4).join(':') + '::/64';
}

async function body(req) {
  const ct = (req.headers.get('content-type') || '').split(';')[0].trim();
  if (ct !== 'application/json') throw new Fail(415, 'json_only');
  const MAX = 4 * 1024 * 1024, len = +req.headers.get('content-length') || 0;
  if (len > MAX) throw new Fail(413, 'too_big');
  const parts = [], rd = req.body ? req.body.getReader() : null;
  let n = 0;
  if (rd) for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    n += value.byteLength;
    if (n > MAX) { await rd.cancel(); throw new Fail(413, 'too_big'); }
    parts.push(value);
  }
  const all = new Uint8Array(n); let o = 0;
  for (const x of parts) { all.set(x, o); o += x.byteLength; }
  const t = new TextDecoder().decode(all);
  try { const j = JSON.parse(t); if (j && typeof j === 'object') return j; } catch (e) { /* fall through */ }
  throw new Fail(400, 'bad_json');
}

async function who(req, env) { return S.session(env, cookies(req)[SID]); }
async function mustWho(req, env) { const s = await who(req, env); if (!s) throw new Fail(401, 'signed_out'); return s; }

/* The one place every sign-in ends: find or make the account, or add the method to the signed-in account
   (joining two accounts when the method already belongs to another one). Returns {uid, result, token?}. */
async function finish(env, flow, provider, subject, label, current, ip) {
  const owner = await S.findIdentity(env, provider, subject);
  if (flow.mode === 'link') {
    if (!current || current.uid !== flow.uid) throw new Fail(401, 'signed_out');
    if (owner && owner !== current.uid) { await S.joinUsers(env, current.uid, owner); return { uid: current.uid, result: 'joined' }; }
    if (!owner) await S.addIdentity(env, current.uid, provider, subject, label).run();
    return { uid: current.uid, result: 'linked' };
  }
  let uid = owner, result = 'in';
  if (!uid) {
    if (await S.limited(env, 'new-ip', ip || 'unknown', 10, 86400) || await S.limited(env, 'new-all', 'all', +env.NEW_DAILY || 2000, 86400))
      throw new Fail(429, 'slow_down');
    uid = await S.newUser(env); await S.addIdentity(env, uid, provider, subject, label).run(); result = 'new';
  }
  if (current) await S.endSession(env, current.id);
  return { uid, result, token: await S.newSession(env, uid) };
}
function sessionCookies(done) {
  const list = [setCookie(FID, '', 0)];
  if (done.token) list.push(setCookie(SID, done.token, S.SESSION_DAYS * 86400));
  return list;
}

async function startFlow(req, env, kind, data) {
  if (await S.limited(env, 'start', ipOf(req), 40, 600)) throw new Fail(429, 'slow_down');
  const mode = data.mode === 'link' ? 'link' : 'login';
  let uid = null;
  if (mode === 'link') uid = (await mustWho(req, env)).uid;
  const id = await S.newFlow(env, kind, { ...data, mode, uid, ret: safeReturn(data.ret) }, FLOW_SECONDS);
  return { id, cookie: setCookie(FID, id, FLOW_SECONDS) };
}
async function takeBound(req, env, id, kind) {
  const c = cookies(req)[FID];
  if (!c || !same(c, String(id || ''))) throw new Fail(403, 'other_browser');
  const f = await S.takeFlow(env, id, kind);
  if (!f) throw new Fail(410, 'expired');
  return f;
}

// ---------------------------------------------------------------- GitHub and Google (redirects)
const OAUTH = {
  github: {
    auth: 'https://github.com/login/oauth/authorize',
    params: (env) => ({ client_id: env.GITHUB_CLIENT_ID, allow_signup: 'true' }),
    async identify(env, code, f, redirectUri) {
      const t = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'entekhab-account' },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri, code_verifier: f.verifier }),
      }).then(r => r.json());
      if (!t.access_token) throw new Fail(400, 'provider_refused');
      const u = await fetch('https://api.github.com/user', {
        headers: { authorization: 'Bearer ' + t.access_token, accept: 'application/vnd.github+json', 'user-agent': 'entekhab-account' },
      }).then(r => r.ok ? r.json() : null);
      // the token has done its one job: give it back to GitHub
      const revoke = fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
        method: 'DELETE', body: JSON.stringify({ access_token: t.access_token }),
        headers: { authorization: 'Basic ' + btoa(env.GITHUB_CLIENT_ID + ':' + env.GITHUB_CLIENT_SECRET), accept: 'application/vnd.github+json', 'user-agent': 'entekhab-account' },
      }).catch(() => null);
      if (!u || !Number.isInteger(u.id)) throw new Fail(400, 'provider_refused');
      return { subject: String(u.id), label: '@' + String(u.login || '').slice(0, 40), after: revoke };
    },
  },
  google: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    params: (env, f) => ({ client_id: env.GOOGLE_CLIENT_ID, response_type: 'code', scope: 'openid email', nonce: f.nonce, prompt: 'select_account' }),
    async identify(env, code, f, redirectUri) {
      const t = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: f.verifier }),
      }).then(r => r.json());
      if (typeof t.id_token !== 'string') throw new Fail(400, 'provider_refused');
      // the ID token came straight from Google's token endpoint over TLS (OIDC Core 3.1.3.7): check its claims
      const c = JSON.parse(dec.decode(unb64u(t.id_token.split('.')[1])));
      const now = Date.now() / 1000;
      if (!['https://accounts.google.com', 'accounts.google.com'].includes(c.iss) || c.aud !== env.GOOGLE_CLIENT_ID ||
          !(c.exp > now) || c.nonce !== f.nonce || typeof c.sub !== 'string') throw new Fail(400, 'provider_refused');
      const label = c.email && c.email_verified ? maskEmail(String(c.email).toLowerCase()) : 'Google';
      return { subject: c.sub, label };
    },
  },
};

async function oauthUrl(req, env, p, mode, ret) {
  if (!providers(env)[p]) throw new Fail(404, 'off');
  const verifier = randId(32), nonce = randId(16);
  const { id, cookie } = await startFlow(req, env, 'oauth:' + p, { verifier, nonce, mode, ret });
  const o = OAUTH[p], q = new URLSearchParams({
    ...o.params(env, { nonce }), redirect_uri: conf(env).api + `/v1/auth/${p}/callback`, state: id,
    code_challenge: b64u(await sha256(verifier)), code_challenge_method: 'S256',
  });
  return { url: o.auth + '?' + q, cookie };
}
// a plain link starts a sign-in; adding a method to an account (link) only starts from the site's own POST
async function oauthStart(req, env, p, url) {
  if (url.searchParams.get('mode') === 'link') throw new Fail(405, 'post_only');
  const { url: to, cookie } = await oauthUrl(req, env, p, 'login', url.searchParams.get('return'));
  return redirect(to, [cookie]);
}

async function oauthCallback(req, env, ctx, p, url) {
  const site = conf(env).site;
  let ret = '/me/';
  try {
    if (!providers(env)[p]) throw new Fail(404, 'off');
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    const f = await takeBound(req, env, state, 'oauth:' + p);
    ret = f.ret;
    if (url.searchParams.get('error') || !code) throw new Fail(400, 'cancelled');
    const id = await OAUTH[p].identify(env, code, f, conf(env).api + `/v1/auth/${p}/callback`);
    if (id.after) ctx.waitUntil(id.after);
    const done = await finish(env, f, p, id.subject, id.label, await who(req, env), ipOf(req));
    return redirect(`${site}${ret}#ek_auth=${done.result}`, sessionCookies(done));
  } catch (e) {
    return redirect(`${site}${ret}#ek_auth=err_${e instanceof Fail ? e.code : 'failed'}`, [setCookie(FID, '', 0)]);
  }
}

// ---------------------------------------------------------------- the API
async function api(req, env, ctx, url) {
  const path = url.pathname, method = req.method;
  const c = conf(env);

  if (method === 'OPTIONS') {
    const o = req.headers.get('origin');
    if (!o || !c.origins.includes(o)) return new Response(null, { status: 403, headers: SEC });
    return new Response(null, { status: 204, headers: { ...SEC, 'access-control-allow-origin': o, 'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600', vary: 'Origin' } });
  }

  // redirects (top-level navigations)
  let m = path.match(/^\/v1\/auth\/(github|google)\/(start|callback)$/);
  if (m && method === 'GET') return m[2] === 'start' ? oauthStart(req, env, m[1], url) : oauthCallback(req, env, ctx, m[1], url);

  // everything else is fetch() from the site
  if (method === 'POST') {
    const o = req.headers.get('origin');
    if (!o || !c.origins.includes(o)) throw new Fail(403, 'bad_origin');
  } else if (method !== 'GET') throw new Fail(405, 'method');

  m = path.match(/^\/v1\/auth\/(github|google)\/start$/);
  if (m && method === 'POST') {
    const b = await body(req);
    const { url: to, cookie } = await oauthUrl(req, env, m[1], b.mode === 'link' ? 'link' : 'login', b.ret);
    return withCookies(reply(req, env, { url: to }), [cookie]);
  }

  if (path === '/v1/me' && method === 'GET') {
    const s = await who(req, env);
    const base = { providers: providers(env), telegram_bot: env.TG_BOT_NAME || '' };
    if (!s) return reply(req, env, { signedIn: false, ...base });
    const u = await env.DB.prepare('SELECT created FROM users WHERE id=?1').bind(s.uid).first();
    if (!u) return withCookies(reply(req, env, { signedIn: false, ...base }), [setCookie(SID, '', 0)]);
    const ids = (await S.identities(env, s.uid)).map(({ subject, ...x }) => x);
    return reply(req, env, { signedIn: true, account: s.uid.slice(0, 6), created: u.created, methods: ids, ...base });
  }

  if (path === '/v1/data' && method === 'GET') {
    const s = await mustWho(req, env);
    const since = Math.max(-1, Math.floor(+url.searchParams.get('since') || 0));
    return reply(req, env, await S.readData(env, s.uid, since));
  }

  if (path === '/v1/data' && method === 'POST') {
    const s = await mustWho(req, env);
    if (await S.limited(env, 'data', s.uid, 600, 3600)) throw new Fail(429, 'slow_down');
    const b = await body(req);
    if (!Array.isArray(b.changes) || b.changes.length > S.MAX_CHANGES) throw new Fail(400, 'bad_changes');
    const now = Date.now(), seen = new Set(), changes = [];
    for (const x of b.changes) {
      if (!x || !Merge.syncable(x.k) || seen.has(x.k)) throw new Fail(400, 'bad_key');
      if (!(x.v === null || (typeof x.v === 'string' && x.v.length <= Merge.MAX_VALUE))) throw new Fail(400, 'bad_value');
      if (!Number.isFinite(x.t) || x.t < 0) throw new Fail(400, 'bad_time');
      seen.add(x.k);
      changes.push({ k: x.k, v: x.v, t: Math.min(Math.floor(x.t), now) });
    }
    const r = await S.writeData(env, s.uid, changes);
    const u = await env.DB.prepare('SELECT rev FROM users WHERE id=?1').bind(s.uid).first();
    return reply(req, env, { ...r, rev: u ? u.rev : 0 });
  }

  if (path === '/v1/logout' && method === 'POST') {
    const s = await who(req, env);
    let everywhere = false;
    if ((req.headers.get('content-type') || '').startsWith('application/json')) { try { everywhere = (await body(req)).all === true; } catch (e) { } }
    if (s) await (everywhere ? S.endAllSessions(env, s.uid) : S.endSession(env, s.id));
    return withCookies(reply(req, env, { ok: true }), [setCookie(SID, '', 0)]);
  }

  if (path === '/v1/unlink' && method === 'POST') {
    const s = await mustWho(req, env), b = await body(req);
    const all = await S.identities(env, s.uid);
    const x = all.find(i => same(i.ref, String(b.ref || '')));
    if (!x) throw new Fail(404, 'not_found');
    if (all.length < 2) throw new Fail(409, 'last_method');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM identities WHERE provider=?1 AND subject=?2 AND user_id=?3').bind(x.provider, x.subject, s.uid),
      env.DB.prepare('DELETE FROM passkeys WHERE cred_id=?1 AND user_id=?2').bind(x.provider === 'passkey' ? x.subject : '', s.uid),
      env.DB.prepare('DELETE FROM sessions WHERE user_id=?1 AND id<>?2').bind(s.uid, s.id),
    ]);
    return reply(req, env, { ok: true });
  }

  if (path === '/v1/account/delete' && method === 'POST') {
    const s = await mustWho(req, env), b = await body(req);
    if (b.confirm !== 'delete') throw new Fail(400, 'confirm');
    await S.deleteUser(env, s.uid);
    return withCookies(reply(req, env, { ok: true }), [setCookie(SID, '', 0)]);
  }

  // -------- Telegram: start gives the address of Telegram's own sign-in page; verify checks what it sends back
  if (path === '/v1/auth/telegram/start' && method === 'POST') {
    if (!providers(env).telegram) throw new Fail(404, 'off');
    const b = await body(req);
    const { id, cookie } = await startFlow(req, env, 'telegram', { mode: b.mode, ret: b.ret });
    const q = new URLSearchParams({ bot_id: env.TG_BOT_TOKEN.split(':')[0], origin: c.site, return_to: `${c.site}/me/?tgf=${id}` });
    return withCookies(reply(req, env, { flow: id, url: 'https://oauth.telegram.org/auth?' + q }), [cookie]);
  }
  if (path === '/v1/auth/telegram/verify' && method === 'POST') {
    if (!providers(env).telegram) throw new Fail(404, 'off');
    const b = await body(req);
    const f = await takeBound(req, env, b.flow, 'telegram');
    let t;
    try { t = await checkLogin(b.auth, env.TG_BOT_TOKEN, Date.now()); }
    catch (e) { throw new Fail(400, 'bad_proof'); }
    const done = await finish(env, f, 'telegram', t.id, t.username ? '@' + t.username : t.name, await who(req, env), ipOf(req));
    return withCookies(reply(req, env, { result: done.result, ret: f.ret }), sessionCookies(done));
  }

  // -------- Ethereum wallet: a message is written here, the wallet signs it, the signer must be the address
  if (path === '/v1/auth/wallet/start' && method === 'POST') {
    const b = await body(req);
    if (typeof b.address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(b.address)) throw new Fail(400, 'bad_address');
    const chainId = Number.isInteger(b.chainId) && b.chainId > 0 && b.chainId < 2 ** 31 ? b.chainId : 1;
    const now = new Date(), nonce = randId(12).replace(/[-_]/g, 'x');
    const msg = siweMessage({ domain: new URL(c.site).host, uri: c.site, address: b.address, chainId, nonce,
      issuedAt: now.toISOString(), expiresAt: new Date(+now + 5 * 60e3).toISOString(),
      statement: 'Sign in to entekhab.net. This only proves that you own this address: it is not a transaction, it approves nothing and it costs nothing.' });
    const { id, cookie } = await startFlow(req, env, 'wallet', { mode: b.mode, ret: b.ret, address: b.address.toLowerCase(), msg, exp: +now + 5 * 60e3 });
    return withCookies(reply(req, env, { flow: id, message: msg }), [cookie]);
  }
  if (path === '/v1/auth/wallet/verify' && method === 'POST') {
    const b = await body(req);
    const f = await takeBound(req, env, b.flow, 'wallet');
    if (Date.now() > f.exp) throw new Fail(410, 'expired');
    let addr;
    try { addr = recover(f.msg, b.signature); } catch (e) { throw new Fail(400, 'bad_proof'); }
    if (addr !== f.address) throw new Fail(400, 'bad_proof');
    const done = await finish(env, f, 'wallet', addr, shortAddr(checksum(addr)), await who(req, env), ipOf(req));
    return withCookies(reply(req, env, { result: done.result, ret: f.ret }), sessionCookies(done));
  }

  // -------- passkeys
  if (path === '/v1/auth/passkey/register/start' && method === 'POST') {
    const b = await body(req);
    const s = await who(req, env);
    const mode = s ? 'link' : 'login';
    const challenge = randId(32), handle = s ? s.uid : randId(16);
    let exclude = [];
    if (s) exclude = (await env.DB.prepare('SELECT cred_id FROM passkeys WHERE user_id=?1').bind(s.uid).all()).results.map(r => ({ type: 'public-key', id: r.cred_id }));
    const { id, cookie } = await startFlow(req, env, 'passkey:reg', { mode, ret: b.ret, challenge });
    return withCookies(reply(req, env, { flow: id, options: {
      challenge, rp: { id: c.rpId, name: 'entekhab.net' },
      user: { id: b64u(new TextEncoder().encode(handle)), name: 'entekhab.net', displayName: 'entekhab.net' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' },
      attestation: 'none', timeout: 120000, excludeCredentials: exclude } }), [cookie]);
  }
  if (path === '/v1/auth/passkey/register/verify' && method === 'POST') {
    const b = await body(req);
    const f = await takeBound(req, env, b.flow, 'passkey:reg');
    let r;
    try { r = await verifyRegistration(b.credential, { challenge: f.challenge, origins: c.origins, rpId: c.rpId }); }
    catch (e) { throw new Fail(400, 'bad_proof'); }
    if (await env.DB.prepare('SELECT 1 FROM passkeys WHERE cred_id=?1').bind(r.credId).first()) throw new Fail(409, 'exists');
    const current = await who(req, env);
    const done = await finish(env, f, 'passkey', r.credId, 'Passkey', current, ipOf(req));
    await env.DB.prepare('INSERT INTO passkeys(cred_id,user_id,jwk,alg,counter,created) VALUES(?1,?2,?3,?4,?5,?6)')
      .bind(r.credId, done.uid, JSON.stringify(r.jwk), r.alg, r.counter, Date.now()).run();
    return withCookies(reply(req, env, { result: done.result, ret: f.ret }), sessionCookies(done));
  }
  if (path === '/v1/auth/passkey/login/start' && method === 'POST') {
    const b = await body(req);
    const challenge = randId(32);
    const { id, cookie } = await startFlow(req, env, 'passkey:get', { mode: 'login', ret: b.ret, challenge });
    return withCookies(reply(req, env, { flow: id, options: { challenge, rpId: c.rpId, userVerification: 'preferred', timeout: 120000, allowCredentials: [] } }), [cookie]);
  }
  if (path === '/v1/auth/passkey/login/verify' && method === 'POST') {
    const b = await body(req);
    const f = await takeBound(req, env, b.flow, 'passkey:get');
    const credId = b.credential && typeof b.credential.rawId === 'string' ? b.credential.rawId : '';
    const pk = credId && await env.DB.prepare('SELECT user_id,jwk,alg,counter FROM passkeys WHERE cred_id=?1').bind(credId).first();
    if (!pk) throw new Fail(404, 'unknown_passkey');
    let r;
    try { r = await verifyAssertion(b.credential, pk, { challenge: f.challenge, origins: c.origins, rpId: c.rpId }); }
    catch (e) { throw new Fail(400, 'bad_proof'); }
    await env.DB.prepare('UPDATE passkeys SET counter=?2, last_used=?3 WHERE cred_id=?1').bind(credId, r.counter, Date.now()).run();
    const done = await finish(env, f, 'passkey', credId, 'Passkey', await who(req, env), ipOf(req));
    return withCookies(reply(req, env, { result: done.result, ret: f.ret }), sessionCookies(done));
  }

  // -------- email link: the link carries a one-time token and only works in the browser that asked for it
  if (path === '/v1/auth/email/start' && method === 'POST') {
    if (!providers(env).email) throw new Fail(404, 'off');
    const b = await body(req);
    const email = String(b.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@<>()",;:\\[\]]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/.test(email)) throw new Fail(400, 'bad_email');
    if (await S.limited(env, 'mail-ip', ipOf(req), 5, 3600) || await S.limited(env, 'mail-ip-day', ipOf(req), 10, 86400) || await S.limited(env, 'mail-to', email, 3, 3600) ||
        await S.limited(env, 'mail-all', 'all', +env.EMAIL_DAILY || 90, 86400)) throw new Fail(429, 'slow_down');
    const token = randId(32);
    const { id, cookie } = await startFlow(req, env, 'email', { mode: b.mode, ret: b.ret, eh: await sha256hex('email:' + email),
      label: maskEmail(email), th: await sha256hex(token) });
    const lang = ['fa', 'ckb', 'ar', 'en'].includes(b.lang) ? b.lang : 'fa';
    const sent = await sendMail(env, email, `${c.site}/me/#ek_email=${id}.${token}`, lang);
    if (!sent) throw new Fail(502, 'mail_failed');
    return withCookies(reply(req, env, { ok: true }), [cookie]);
  }
  if (path === '/v1/auth/email/verify' && method === 'POST') {
    if (!providers(env).email) throw new Fail(404, 'off');
    const b = await body(req);
    const f = await takeBound(req, env, b.flow, 'email');
    if (!same(await sha256hex(String(b.token || '')), f.th)) throw new Fail(400, 'bad_proof');
    const done = await finish(env, f, 'email', f.eh, f.label, await who(req, env), ipOf(req));
    return withCookies(reply(req, env, { result: done.result, ret: f.ret }), sessionCookies(done));
  }

  throw new Fail(404, 'not_found');
}

const MAIL = {
  fa: ['ورود به entekhab.net', 'برای ورود به entekhab.net روی این پیوند بزن. پیوند تا ۱۰ دقیقه و فقط یک بار، در همان مرورگری که درخواست دادی، کار می‌کند.', 'اگر تو درخواست نداده‌ای، این ایمیل را نادیده بگیر؛ بدون این پیوند کسی وارد نمی‌شود.'],
  ckb: ['چوونەژوورەوە بۆ entekhab.net', 'بۆ چوونەژوورەوە بۆ entekhab.net ئەم بەستەرە بکەرەوە. بەستەرەکە تا ١٠ خولەک و تەنها یەک جار، لە هەمان وێبگەڕدا کار دەکات.', 'ئەگەر تۆ داوات نەکردووە، ئەم ئیمەیڵە پشتگوێ بخە.'],
  ar: ['تسجيل الدخول إلى entekhab.net', 'افتح هذا الرابط لتسجيل الدخول إلى entekhab.net. يعمل الرابط مرة واحدة خلال ١٠ دقائق وفي المتصفح نفسه الذي طلبته منه.', 'إن لم تطلب ذلك فتجاهل هذه الرسالة.'],
  en: ['Sign in to entekhab.net', 'Open this link to sign in to entekhab.net. It works once, for 10 minutes, in the same browser you asked from.', "If you didn't ask for this, ignore this email; nobody can sign in without the link."],
};
async function sendMail(env, to, link, lang) {
  const [subject, line, ignore] = MAIL[lang];
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text: `${line}\n\n${link}\n\n${ignore}\n` }),
  }).catch(() => null);
  return !!(r && r.ok);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (Math.random() < 0.02) ctx.waitUntil(S.sweep(env).catch(() => null));
    if (url.pathname === '/' || url.pathname === '/health')
      return new Response('entekhab.net account service\n', { headers: { 'content-type': 'text/plain; charset=utf-8', ...SEC } });
    try {
      if (!url.pathname.startsWith('/v1/')) throw new Fail(404, 'not_found');
      return await api(req, env, ctx, url);
    } catch (e) {
      if (e instanceof Fail) return reply(req, env, { error: e.code }, e.status);
      console.error('account error', e && e.stack || e);
      return reply(req, env, { error: 'server' }, 500);
    }
  },
};
