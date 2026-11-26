/* D1 access: users, identities, sessions, short-lived flows, rate limits and the encrypted saved data. */
import { randId, sha256hex, b64u, unb64u, enc, dec } from './util.js';
import Merge from '../../../assets/account/merge.js';

export const SESSION_DAYS = 90;
export const MAX_KEYS = 600;          // rows, deletion records included
export const MAX_CHANGES = 80;        // per request: D1 takes at most 100 bound values in one query
export const SESSION_MAX_DAYS = 365;  // a session never lives longer than this, however often it is used
export const MAX_BYTES = 3 * 1024 * 1024;

// ---------------------------------------------------------------- encryption at rest (AES-256-GCM, Worker secret)
let keyCache = null, keyFor = null;
async function dataKey(env) {
  if (keyCache && keyFor === env.DATA_KEY) return keyCache;
  const raw = unb64u(env.DATA_KEY || '');
  if (raw.length !== 32) throw new Error('DATA_KEY must be 32 random bytes, base64url');
  keyCache = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  keyFor = env.DATA_KEY;
  return keyCache;
}
export async function seal(env, uid, k, text) {
  if (text == null) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(uid + '\u0000' + k) },
    await dataKey(env), enc.encode(text));
  return b64u(iv) + '.' + b64u(ct);
}
export async function open(env, uid, k, box) {
  if (box == null) return null;
  const [iv, ct] = box.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv), additionalData: enc.encode(uid + '\u0000' + k) },
    await dataKey(env), unb64u(ct));
  return dec.decode(pt);
}

// ---------------------------------------------------------------- rate limits (keys are hashed; no IP is stored)
export async function limited(env, name, who, max, seconds) {
  const k = name + ':' + (await sha256hex((env.DATA_KEY || '') + '|' + who)).slice(0, 24);
  const now = Date.now();
  const r = await env.DB.prepare(
    `INSERT INTO rate(k,n,reset) VALUES(?1,1,?2) ON CONFLICT(k) DO UPDATE SET
       n = CASE WHEN rate.reset < ?3 THEN 1 ELSE rate.n + 1 END,
       reset = CASE WHEN rate.reset < ?3 THEN ?2 ELSE rate.reset END RETURNING n`)
    .bind(k, now + seconds * 1000, now).first();
  return !r || r.n > max;
}

// ---------------------------------------------------------------- flows: one short-lived, single-use step of a sign-in
export async function newFlow(env, kind, data, seconds) {
  const id = randId(24);
  await env.DB.prepare('INSERT INTO flows(id,kind,data,expires) VALUES(?1,?2,?3,?4)')
    .bind(id, kind, JSON.stringify(data), Date.now() + seconds * 1000).run();
  return id;
}
export async function takeFlow(env, id, kind) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(id)) return null;
  const r = await env.DB.prepare('DELETE FROM flows WHERE id=?1 RETURNING kind,data,expires').bind(id).first();
  if (!r || r.kind !== kind || r.expires < Date.now()) return null;
  return JSON.parse(r.data);
}

// ---------------------------------------------------------------- sessions (only a hash of the token is stored)
export async function newSession(env, uid) {
  const token = randId(32), now = Date.now();
  await env.DB.prepare('INSERT INTO sessions(id,user_id,created,expires,seen) VALUES(?1,?2,?3,?4,?3)')
    .bind(await sha256hex(token), uid, now, now + SESSION_DAYS * 864e5).run();
  return token;
}
export async function session(env, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const id = await sha256hex(token), now = Date.now();
  const r = await env.DB.prepare('SELECT user_id,created,expires,seen FROM sessions WHERE id=?1').bind(id).first();
  if (!r || r.expires < now || now - r.created > SESSION_MAX_DAYS * 864e5) return null;
  if (now - r.seen > 864e5)       // slide the expiry at most once a day, never past the session's maximum age
    await env.DB.prepare('UPDATE sessions SET seen=?2, expires=MIN(?3, created + ?4) WHERE id=?1').bind(id, now, now + SESSION_DAYS * 864e5, SESSION_MAX_DAYS * 864e5).run();
  return { id, uid: r.user_id };
}
export async function endSession(env, sid) { await env.DB.prepare('DELETE FROM sessions WHERE id=?1').bind(sid).run(); }
export async function endAllSessions(env, uid) { await env.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(uid).run(); }

// ---------------------------------------------------------------- users and their sign-in methods
export async function findIdentity(env, provider, subject) {
  const r = await env.DB.prepare('SELECT user_id FROM identities WHERE provider=?1 AND subject=?2').bind(provider, subject).first();
  return r ? r.user_id : null;
}
export async function newUser(env) {
  const id = randId(16);
  await env.DB.prepare('INSERT INTO users(id,created,rev) VALUES(?1,?2,0)').bind(id, Date.now()).run();
  return id;
}
export function addIdentity(env, uid, provider, subject, label) {
  return env.DB.prepare('INSERT OR IGNORE INTO identities(provider,subject,user_id,label,created) VALUES(?1,?2,?3,?4,?5)')
    .bind(provider, subject, uid, String(label || '').slice(0, 80), Date.now());
}
export async function identities(env, uid) {
  const r = await env.DB.prepare('SELECT provider,subject,label,created FROM identities WHERE user_id=?1 ORDER BY created').bind(uid).all();
  return Promise.all(r.results.map(async x => ({ provider: x.provider, label: x.label, created: x.created,
    ref: (await sha256hex(x.provider + ':' + x.subject)).slice(0, 20), subject: x.subject })));
}

export async function deleteUser(env, uid) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM data WHERE user_id=?1').bind(uid),
    env.DB.prepare('DELETE FROM passkeys WHERE user_id=?1').bind(uid),
    env.DB.prepare('DELETE FROM identities WHERE user_id=?1').bind(uid),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(uid),
    env.DB.prepare('DELETE FROM users WHERE id=?1').bind(uid),
  ]);
}

// ---------------------------------------------------------------- saved data
export async function readData(env, uid, since) {
  const u = await env.DB.prepare('SELECT rev FROM users WHERE id=?1').bind(uid).first();
  const r = await env.DB.prepare('SELECT k,v,t,rev FROM data WHERE user_id=?1 AND rev>?2 ORDER BY rev').bind(uid, since).all();
  const items = [];
  for (const x of r.results) items.push({ k: x.k, v: await open(env, uid, x.k, x.v), t: x.t, rev: x.rev });
  return { rev: u ? u.rev : 0, items };
}

/* Write changes with the day-to-day rule (newer wins). changes: [{k, v, t}] already validated.
   Returns {applied:[k], stale:[{k,v,t}]} — stale ones lost to a newer stored value, which is sent back. */
export async function writeData(env, uid, changes) {
  if (!changes.length) return { applied: [], stale: [], quota: [] };
  const cur = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size),0) AS b FROM data WHERE user_id=?1').bind(uid).first();
  const old = new Map();
  const rows = await env.DB.prepare(`SELECT k,size,t,v IS NULL AS gone FROM data WHERE user_id=?1 AND k IN (${changes.map((_, i) => '?' + (i + 2)).join(',')})`)
    .bind(uid, ...changes.map(c => c.k)).all();
  for (const x of rows.results) old.set(x.k, x);
  let n = cur.n, b = cur.b;
  const ok = [], quota = [], nothing = [];
  for (const c of changes) {
    const o = old.get(c.k), size = c.v == null ? 0 : c.v.length * 2;
    if (c.v == null && !o) { nothing.push(c.k); continue; }   // deleting what the account never had: nothing to store
    const dn = o ? 0 : 1, db = size - (o && !o.gone ? o.size : 0);   // every row counts, deletion records too
    if (c.v != null && (n + dn > MAX_KEYS || b + db > MAX_BYTES)) { quota.push(c.k); continue; }
    if (o && c.t <= o.t) { ok.push(c); continue; }       // the conditional upsert skips it; it comes back as stale
    n += dn; b += db; ok.push(c);
  }
  const stmts = [env.DB.prepare('UPDATE users SET rev = rev + ?2 WHERE id=?1').bind(uid, ok.length)];
  for (let i = 0; i < ok.length; i++) {
    const c = ok[i];
    stmts.push(env.DB.prepare(
      `INSERT INTO data(user_id,k,v,t,rev,size) VALUES(?1,?2,?3,?4,(SELECT rev FROM users WHERE id=?1) - ?6,?5)
       ON CONFLICT(user_id,k) DO UPDATE SET v=excluded.v, t=excluded.t, rev=excluded.rev, size=excluded.size
       WHERE excluded.t > data.t`)
      .bind(uid, c.k, await seal(env, uid, c.k, c.v), c.t, c.v == null ? 0 : c.v.length * 2, ok.length - 1 - i));
  }
  const res = await env.DB.batch(stmts);
  const applied = [], staleKeys = [];
  for (let i = 0; i < ok.length; i++) (res[i + 1].meta.changes > 0 ? applied : staleKeys).push(ok[i].k);
  const stale = [];
  for (const k of staleKeys) {
    const r = await env.DB.prepare('SELECT v,t FROM data WHERE user_id=?1 AND k=?2').bind(uid, k).first();
    if (r) stale.push({ k, v: await open(env, uid, k, r.v), t: r.t });
  }
  return { applied: applied.concat(nothing), stale, quota };
}

/* Join account `from` into account `into` (the person proved they control both): sign-in methods move over and
   the saved data is joined with the first-contact rule, so nothing is lost. */
export async function joinUsers(env, into, from) {
  if (into === from) return;
  const a = await readData(env, into, -1), b = await readData(env, from, -1);
  const mine = new Map(a.items.map(x => [x.k, x]));
  const changes = [];
  for (const x of b.items) {
    const j = Merge.joinKey(mine.get(x.k) || null, { v: x.v, t: x.t });
    const m = mine.get(x.k);
    if (!m || m.v !== j.v) changes.push({ k: x.k, v: j.v, t: Math.max(j.t, m ? m.t + 1 : 0) });
  }
  await env.DB.batch([
    env.DB.prepare('UPDATE identities SET user_id=?1 WHERE user_id=?2').bind(into, from),
    env.DB.prepare('UPDATE passkeys SET user_id=?1 WHERE user_id=?2').bind(into, from),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(from),
  ]);
  for (let i = 0; i < changes.length; i += 50) await writeData(env, into, changes.slice(i, i + 50));
  await deleteUser(env, from);
}

export async function sweep(env) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM flows WHERE expires<?1').bind(now),
    env.DB.prepare('DELETE FROM sessions WHERE expires<?1').bind(now),
    env.DB.prepare('DELETE FROM rate WHERE reset<?1').bind(now),
  ]);
}
