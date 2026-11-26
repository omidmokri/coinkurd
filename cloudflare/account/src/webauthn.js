/* Passkeys (WebAuthn) — registration and sign-in checks, with WebCrypto only.
   Algorithms: ES256 (P-256, COSE -7) and RS256 (COSE -257), which cover every platform authenticator. */
import { decodeCbor } from './cbor.js';
import { b64u, unb64u, sha256, dec, concat } from './util.js';

function parseClientData(b64, type, challenge, origins) {
  const raw = unb64u(b64);
  const c = JSON.parse(dec.decode(raw));
  if (c.type !== type) throw new Error('passkey: wrong type');
  if (typeof c.challenge !== 'string' || c.challenge !== challenge) throw new Error('passkey: wrong challenge');
  if (!origins.includes(c.origin)) throw new Error('passkey: wrong origin');
  if (c.crossOrigin === true) throw new Error('passkey: cross-origin');
  return raw;
}

async function parseAuthData(ad, rpId) {
  if (ad.length < 37) throw new Error('passkey: short authData');
  const rpHash = await sha256(rpId);
  for (let i = 0; i < 32; i++) if (ad[i] !== rpHash[i]) throw new Error('passkey: wrong rpId');
  const flags = ad[32];
  if (!(flags & 0x01)) throw new Error('passkey: user not present');
  const counter = new DataView(ad.buffer, ad.byteOffset + 33, 4).getUint32(0);
  return { flags, counter, uv: !!(flags & 0x04) };
}

function coseToJwk(m) {
  if (!(m instanceof Map)) throw new Error('passkey: bad key');
  const kty = m.get(1), alg = m.get(3);
  if (kty === 2 && alg === -7 && m.get(-1) === 1) {
    const x = m.get(-2), y = m.get(-3);
    if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) throw new Error('passkey: bad EC key');
    return { alg: -7, jwk: { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y), ext: true } };
  }
  if (kty === 3 && alg === -257) {
    const n = m.get(-1), e = m.get(-2);
    if (!(n instanceof Uint8Array) || !(e instanceof Uint8Array) || n.length < 256) throw new Error('passkey: bad RSA key');
    return { alg: -257, jwk: { kty: 'RSA', n: b64u(n), e: b64u(e), alg: 'RS256', ext: true } };
  }
  throw new Error('passkey: unsupported algorithm');
}

function importKey(alg, jwk) {
  return alg === -7
    ? crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    : crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

// WebAuthn ES256 signatures are DER; WebCrypto wants r||s (64 bytes)
function derToRaw(der) {
  let p = 0;
  if (der[p++] !== 0x30) throw new Error('passkey: bad signature');
  let l = der[p++]; if (l & 0x80) p += l & 0x7f;
  function int() {
    if (der[p++] !== 0x02) throw new Error('passkey: bad signature');
    let n = der[p++]; let v = der.slice(p, p + n); p += n;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    if (v.length > 32) throw new Error('passkey: bad signature');
    const o = new Uint8Array(32); o.set(v, 32 - v.length); return o;
  }
  return concat(int(), int());
}

export async function verifyRegistration(cred, { challenge, origins, rpId }) {
  if (!cred || cred.type !== 'public-key' || !cred.response) throw new Error('passkey: bad credential');
  parseClientData(cred.response.clientDataJSON, 'webauthn.create', challenge, origins);
  const att = decodeCbor(unb64u(cred.response.attestationObject)).value;
  if (!(att instanceof Map)) throw new Error('passkey: bad attestation');
  const ad = att.get('authData');
  if (!(ad instanceof Uint8Array)) throw new Error('passkey: bad authData');
  const { flags, counter } = await parseAuthData(ad, rpId);
  if (!(flags & 0x40)) throw new Error('passkey: no credential data');
  let p = 37 + 16;
  const idLen = (ad[p] << 8) | ad[p + 1]; p += 2;
  if (idLen < 16 || idLen > 1023 || p + idLen > ad.length) throw new Error('passkey: bad credential id');
  const credId = b64u(ad.slice(p, p + idLen)); p += idLen;
  if (credId !== b64u(unb64u(cred.rawId || cred.id))) throw new Error('passkey: id mismatch');
  const key = coseToJwk(decodeCbor(ad, p).value);
  await importKey(key.alg, key.jwk);      // throws if the key is not usable
  return { credId, alg: key.alg, jwk: key.jwk, counter };
}

export async function verifyAssertion(cred, stored, { challenge, origins, rpId }) {
  if (!cred || cred.type !== 'public-key' || !cred.response) throw new Error('passkey: bad credential');
  const cdj = parseClientData(cred.response.clientDataJSON, 'webauthn.get', challenge, origins);
  const ad = unb64u(cred.response.authenticatorData);
  const { counter } = await parseAuthData(ad, rpId);
  const sig = unb64u(cred.response.signature);
  const data = concat(ad, await sha256(cdj));
  const key = await importKey(stored.alg, JSON.parse(stored.jwk));
  const ok = stored.alg === -7
    ? await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(sig), data)
    : await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sig, data);
  if (!ok) throw new Error('passkey: bad signature');
  if ((counter > 0 || stored.counter > 0) && counter <= stored.counter) throw new Error('passkey: counter went back (cloned key?)');
  return { counter };
}
