/* entekhab.net — account data merge rules, shared by the browser (assets/account/sync.js) and the account
   Worker (cloudflare/account). Pure functions, no I/O.

   A saved item is one localStorage entry: a key, its text value (null when deleted) and the time it last changed.
   Two rules:
   - Day to day, the newer change of a key wins (last-writer-wins), so a deletion on one device stays deleted.
   - When two sets of data meet for the first time (a device signs in, or two accounts are joined), nothing may be
     lost: lists are united, objects are merged field by field (the newer side wins a field both have), and for a
     plain value the newer one is kept. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EKMerge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY_RE = /^(ek|ck|ekn|wl|ps)_[A-Za-z0-9_.:-]{1,80}$/;
  // device-only flags, caches and the display language (each device keeps its own): never leave the device
  var SKIP_RE = /^(ek_sync|ek_acct|ek_gpu|ek_bf_gpu|ek_ar_test|ek_splash_|ek_ios_dismiss|ek_app_dismiss|ek_upd_seen|ek_uic$|ek_pro_px$|ek_reach$|ck_lang$|ek_pro_lang$)|_cache$/;
  var MAX_VALUE = 100 * 1024;          // characters of one value
  var MAX_DEPTH = 6;

  function syncable(k) { return typeof k === 'string' && KEY_RE.test(k) && !SKIP_RE.test(k); }

  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

  function stable(x) {
    if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
    if (isObj(x)) return '{' + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(x[k]); }).join(',') + '}';
    return JSON.stringify(x === undefined ? null : x);
  }

  // an object in a list is the same item on both sides when it carries the same id-like field
  var ID_FIELDS = ['id', 'uid', 'key', 'slug', 'created', 'at', 'ts', 'time'];
  function itemId(x) {
    if (isObj(x)) {
      for (var i = 0; i < ID_FIELDS.length; i++) {
        var v = x[ID_FIELDS[i]];
        if (typeof v === 'string' || (typeof v === 'number' && isFinite(v))) return ID_FIELDS[i] + '\u0000' + v;
      }
    }
    return 'v\u0000' + stable(x);
  }

  // newer list first (its order and its version of a shared item win), then what only the older list has
  function uniteLists(newer, older) {
    var seen = Object.create(null), out = [];
    function add(x) { var id = itemId(x); if (!seen[id]) { seen[id] = 1; out.push(x); } }
    newer.forEach(add); older.forEach(add);
    return out;
  }

  function mergeValues(newer, older, depth) {
    if (depth > MAX_DEPTH) return newer;
    if (Array.isArray(newer) && Array.isArray(older)) return uniteLists(newer, older);
    if (isObj(newer) && isObj(older)) {
      var out = {};
      Object.keys(older).forEach(function (k) { out[k] = older[k]; });
      Object.keys(newer).forEach(function (k) {
        out[k] = Object.prototype.hasOwnProperty.call(older, k) ? mergeValues(newer[k], older[k], depth + 1) : newer[k];
      });
      return out;
    }
    return newer === undefined ? older : newer;
  }

  function parse(s) { try { return { ok: true, v: JSON.parse(s) }; } catch (e) { return { ok: false }; } }

  /* Join two versions of one key on first contact. a and b are {v: string|null, t: number}.
     Returns {v, t}: the value to keep everywhere. */
  function joinKey(a, b) {
    if (!a) return b;
    if (!b) return a;
    var an = a.t > b.t || (a.t === b.t && String(a.v) >= String(b.v));
    var newer = an ? a : b, older = an ? b : a;
    if (newer.v === older.v) return newer;
    if (newer.v == null) return older.v == null ? newer : older;      // first contact: a deletion never wipes data
    if (older.v == null) return newer;
    var pn = parse(newer.v), po = parse(older.v);
    if (pn.ok && po.ok && ((Array.isArray(pn.v) && Array.isArray(po.v)) || (isObj(pn.v) && isObj(po.v)))) {
      var s = JSON.stringify(mergeValues(pn.v, po.v, 0));
      if (s.length <= MAX_VALUE) return { v: s, t: Math.max(a.t, b.t) };
    }
    return newer;
  }

  /* Day-to-day rule: does change c replace the stored s? */
  function wins(c, s) {
    if (!s) return true;
    return c.t > s.t;                   // equal times: the stored copy stays, so every copy ends the same
  }

  // a small, fast fingerprint of a value (FNV-1a 32-bit + length), to notice local changes
  function fp(s) {
    if (s == null) return '';
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + '.' + s.length.toString(36);
  }

  return { syncable: syncable, joinKey: joinKey, wins: wins, mergeValues: mergeValues, uniteLists: uniteLists,
           fp: fp, stable: stable, KEY_RE: KEY_RE, SKIP_RE: SKIP_RE, MAX_VALUE: MAX_VALUE };
});
