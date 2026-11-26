/* Telegram sign-in checks (official algorithms, https://core.telegram.org/widgets/login and
   https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app). The bot token stays in a Worker secret. */
import { hmac, sha256, hex, same, enc } from './util.js';

const FIELDS = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date'];

export async function checkLogin(data, token, now, maxAge = 600) {
  if (!data || typeof data !== 'object' || typeof data.hash !== 'string') throw new Error('telegram: bad data');
  const keys = Object.keys(data).filter(k => k !== 'hash');
  for (const k of keys) if (!FIELDS.includes(k)) throw new Error('telegram: unexpected field');
  const dcs = keys.sort().map(k => `${k}=${data[k]}`).join('\n');
  const want = hex(await hmac(await sha256(token), dcs));
  if (!same(want, data.hash.toLowerCase())) throw new Error('telegram: bad signature');
  const age = now / 1000 - Number(data.auth_date);
  if (!(age < maxAge && age > -60)) throw new Error('telegram: too old');
  if (!/^\d{1,16}$/.test(String(data.id))) throw new Error('telegram: bad id');
  return { id: String(data.id), username: data.username || '', name: data.first_name || '' };
}

export async function checkWebApp(initData, token, now, maxAge = 86400) {
  if (typeof initData !== 'string' || initData.length > 4096) throw new Error('telegram: bad data');
  const q = new URLSearchParams(initData), hash = q.get('hash');
  if (!hash) throw new Error('telegram: bad data');
  const pairs = [];
  for (const [k, v] of q) if (k !== 'hash') pairs.push(`${k}=${v}`);
  pairs.sort();
  const secret = await hmac(enc.encode('WebAppData'), token);
  const want = hex(await hmac(secret, pairs.join('\n')));
  if (!same(want, hash.toLowerCase())) throw new Error('telegram: bad signature');
  const age = now / 1000 - Number(q.get('auth_date'));
  if (!(age < maxAge && age > -60)) throw new Error('telegram: too old');
  const u = JSON.parse(q.get('user') || 'null');
  if (!u || !/^\d{1,16}$/.test(String(u.id))) throw new Error('telegram: no user');
  return { id: String(u.id), username: u.username || '', name: u.first_name || '' };
}
