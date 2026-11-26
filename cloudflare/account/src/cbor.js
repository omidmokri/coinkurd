/* Minimal CBOR decoder for WebAuthn (attestation objects and COSE keys). Definite lengths only, as WebAuthn uses. */
export function decodeCbor(bytes, start = 0) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = start;
  function need(n) { if (p + n > bytes.length) throw new Error('cbor: short'); }
  function len(ai) {
    if (ai < 24) return ai;
    if (ai === 24) { need(1); return bytes[p++]; }
    if (ai === 25) { need(2); const x = v.getUint16(p); p += 2; return x; }
    if (ai === 26) { need(4); const x = v.getUint32(p); p += 4; return x; }
    if (ai === 27) { need(8); const hi = v.getUint32(p), lo = v.getUint32(p + 4); p += 8;
      if (hi > 0x1fffff) throw new Error('cbor: too big'); return hi * 4294967296 + lo; }
    throw new Error('cbor: indefinite length not supported');
  }
  function item(depth) {
    if (depth > 16) throw new Error('cbor: too deep');
    need(1);
    const b = bytes[p++], mt = b >> 5, ai = b & 31;
    switch (mt) {
      case 0: return len(ai);
      case 1: return -1 - len(ai);
      case 2: { const n = len(ai); need(n); const s = bytes.slice(p, p + n); p += n; return s; }
      case 3: { const n = len(ai); need(n); const s = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(p, p + n)); p += n; return s; }
      case 4: { const n = len(ai); if (n > 1000) throw new Error('cbor: big array'); const a = []; for (let i = 0; i < n; i++) a.push(item(depth + 1)); return a; }
      case 5: { const n = len(ai); if (n > 1000) throw new Error('cbor: big map'); const m = new Map();
        for (let i = 0; i < n; i++) { const k = item(depth + 1); m.set(k, item(depth + 1)); } return m; }
      case 7:
        if (ai === 20) return false; if (ai === 21) return true; if (ai === 22) return null; if (ai === 23) return undefined;
        throw new Error('cbor: unsupported simple/float');
      default: throw new Error('cbor: unsupported major type ' + mt);
    }
  }
  const value = item(0);
  return { value, end: p };
}
