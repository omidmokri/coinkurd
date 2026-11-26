/* Sign-In with Ethereum (EIP-4361): the wallet signs a plain-text message (personal_sign / EIP-191).
   No transaction, no approval, no gas. The message is written here, kept in the flow and checked byte for byte. */
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { enc, hex } from './util.js';

export function checksum(addr) {
  const a = addr.toLowerCase().replace(/^0x/, '');
  const h = hex(keccak_256(enc.encode(a)));
  let out = '0x';
  for (let i = 0; i < 40; i++) out += parseInt(h[i], 16) >= 8 ? a[i].toUpperCase() : a[i];
  return out;
}

export function message({ domain, uri, address, chainId, nonce, issuedAt, expiresAt, statement }) {
  return `${domain} wants you to sign in with your Ethereum account:\n${checksum(address)}\n\n${statement}\n\n` +
    `URI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expiresAt}`;
}

export function recover(msg, sigHex) {
  if (typeof sigHex !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(sigHex)) throw new Error('wallet: bad signature');
  const bytes = enc.encode(msg);
  const digest = keccak_256(new Uint8Array([...enc.encode('\x19Ethereum Signed Message:\n' + bytes.length), ...bytes]));
  const s = sigHex.slice(2);
  let v = parseInt(s.slice(128, 130), 16);
  if (v >= 27) v -= 27;
  if (v !== 0 && v !== 1) throw new Error('wallet: bad signature');
  const sig = secp256k1.Signature.fromCompact(s.slice(0, 128)).addRecoveryBit(v);
  if (sig.hasHighS()) throw new Error('wallet: bad signature');
  const pub = sig.recoverPublicKey(digest).toRawBytes(false).slice(1);
  return '0x' + hex(keccak_256(pub).slice(12));
}
