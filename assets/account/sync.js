/* entekhab.net — keeps this browser's saved data (watchlists, notes, alerts, progress, settings…) in step with the
   visitor's account, only after they chose to sign in. Without sign-in this file is never loaded.
   - Never blocks or slows a page: it starts after the page, and any failure (offline, filtered network) is silent.
   - Day to day the newer change of a key wins; the first time a browser joins an account nothing is lost
     (assets/account/merge.js), and a copy of the browser's data from before the join is kept for 30 days.
   - Device-only flags and caches stay on the device (merge.js SKIP_RE). */
(function () {
  'use strict';
  var A = self.EK_ACCT || {}, API = A.api, M = self.EKMerge;
  if (!API || !M || self.EKSync) return;
  var ls;
  try { ls = window.localStorage; ls.getItem('ek_sync'); } catch (e) { return; }
  var P = Storage.prototype, rawSet = P.setItem, rawDel = P.removeItem;
  var ST = 'ek_sync', BK = 'ek_sync_backup';
  var busy = false, again = false, timer = 0, lastErr = null;

  function getState() { try { var s = JSON.parse(ls.getItem(ST) || 'null'); return s && s.on ? s : null; } catch (e) { return null; } }
  function putState(s) { try { rawSet.call(ls, ST, JSON.stringify(s)); } catch (e) { /* storage full: keep going */ } }
  function emit(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) { } }
  function call(method, path, body, keepalive) {
    return fetch(API + path, {
      method: method, credentials: 'include', keepalive: !!keepalive, cache: 'no-store',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (r.status === 401) { var e = new Error('signed_out'); e.code = 'signed_out'; throw e; }
      return r.json().then(function (j) { if (!r.ok) { var x = new Error(j.error || 'failed'); x.code = j.error; throw x; } return j; });
    });
  }
  function keys() {
    var out = [];
    for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (M.syncable(k)) out.push(k); }
    return out;
  }
  /* Parts of the site that keep their data under their own names (the encyclopedia's academy: 'enc:prog', 'enc:hist'…)
     travel inside one syncable key, as parsed values so a first join merges them field by field, and the account
     service needs no change. pack() before each sync folds them in;
     unpack() after one brings the account's copy back out. An empty set never overwrites a saved one. */
  var GROUPS = [{ re: /^enc:/, pre: 'enc:', key: 'ek_enc' }];
  function pack() {
    GROUPS.forEach(function (g) {
      var o = {}, n = 0;
      for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (g.re.test(k)) { var raw = ls.getItem(k), x; try { x = JSON.parse(raw); } catch (e) { x = { _raw: raw }; } o[k.slice(g.pre.length)] = x; n++; } }
      if (!n) return;
      var v = M.stable(o);
      if (v.length <= M.MAX_VALUE && ls.getItem(g.key) !== v) { try { rawSet.call(ls, g.key, v); } catch (e) { } }
    });
  }
  function unpack(changed) {
    GROUPS.forEach(function (g) {
      if (changed.indexOf(g.key) < 0) return;
      var o; try { o = JSON.parse(ls.getItem(g.key) || 'null'); } catch (e) { return; }
      if (!o || typeof o !== 'object' || Array.isArray(o) || !Object.keys(o).length) return;
      Object.keys(o).forEach(function (k) {
        if (!/^[A-Za-z0-9_.:-]{1,60}$/.test(k)) return;
        var x = o[k], v = x && typeof x === 'object' && typeof x._raw === 'string' ? x._raw : JSON.stringify(x);
        if (ls.getItem(g.pre + k) !== v && M.stable(safe(ls.getItem(g.pre + k))) !== M.stable(x)) setLocal(g.pre + k, v);
      });
      var gone = [];
      for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (g.re.test(k) && !(k.slice(g.pre.length) in o)) gone.push(k); }
      gone.forEach(function (k) { setLocal(k, null); });
    });
  }
  function safe(v) { try { return JSON.parse(v); } catch (e) { return { _raw: v }; } }
  function grouped(k) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].re.test(k)) return true; return false; }

  function setLocal(k, v) { try { if (v == null) rawDel.call(ls, k); else rawSet.call(ls, k, v); return true; } catch (e) { return false; } }

  // local changes since the last sync, found by comparing fingerprints (catches every way a page writes storage)
  function changes(s) {
    var now = Date.now(), out = [], seen = {};
    keys().forEach(function (k) {
      seen[k] = 1;
      var v = ls.getItem(k), f = M.fp(v);
      if (v.length > M.MAX_VALUE) return;                       // too big for the account: stays on the device
      if (s.fp[k] !== f) out.push({ k: k, v: v, t: s.lt[k] && s.lf[k] === f ? s.lt[k] : now });
    });
    Object.keys(s.fp).forEach(function (k) {
      if (!seen[k] && s.fp[k] !== '' && M.syncable(k)) out.push({ k: k, v: null, t: now });
    });
    out.forEach(function (c) { s.lt[c.k] = c.t; s.lf[c.k] = M.fp(c.v); });   // remember when we first noticed it
    return out;
  }

  function mark(s, k, v, t) { s.fp[k] = M.fp(v); s.t[k] = t; delete s.lt[k]; delete s.lf[k]; }

  function push(s, list, keepalive) {
    var chunks = [], cur = [], size = 0;
    list.forEach(function (c) {
      var n = (c.v ? c.v.length : 0) + c.k.length + 40;
      if (cur.length && (cur.length >= 80 || size + n > (keepalive ? 25000 : 1500000))) { chunks.push(cur); cur = []; size = 0; }
      cur.push(c); size += n;
    });
    if (cur.length) chunks.push(cur);
    var chain = Promise.resolve(), stale = [];
    chunks.forEach(function (ch) {
      chain = chain.then(function () {
        return call('POST', '/v1/data', { changes: ch }, keepalive).then(function (r) {
          var by = {}; ch.forEach(function (c) { by[c.k] = c; });
          r.applied.forEach(function (k) { mark(s, k, by[k].v, by[k].t); });
          (r.quota || []).forEach(function (k) { mark(s, k, by[k].v, by[k].t); s.full = 1; });
          (r.stale || []).forEach(function (x) { if (setLocal(x.k, x.v)) { mark(s, x.k, x.v, x.t); stale.push(x.k); } });
        });
      });
    });
    return chain.then(function () { return stale; });
  }

  function pull(s, since) {
    return call('GET', '/v1/data?since=' + since).then(function (r) {
      var changed = [], failRev = Infinity;
      r.items.forEach(function (x) {
        if (!M.syncable(x.k)) return;
        var cur = ls.getItem(x.k), local = s.fp[x.k] !== M.fp(cur) && s.lt[x.k];
        if (local && s.lt[x.k] > x.t) return;                   // a newer local change: it goes up next
        if (cur !== x.v) {
          // storage full: keep the account's copy as it is (never send this old one back) and fetch it again next time
          if (!setLocal(x.k, x.v)) { failRev = Math.min(failRev, x.rev); s.fp[x.k] = M.fp(cur); delete s.lt[x.k]; delete s.lf[x.k]; s.err = 'storage_full'; return; }
          changed.push(x.k);
        }
        mark(s, x.k, x.v, x.t);
      });
      s.rev = failRev < Infinity ? Math.max(0, Math.min(s.rev || 0, failRev - 1)) : Math.max(s.rev || 0, r.rev || 0);
      return { items: r.items, changed: changed };
    });
  }

  // first contact between this browser and the account
  function join(s) {
    var before = {}, size = 0;
    keys().forEach(function (k) { var v = ls.getItem(k); if (v.length <= M.MAX_VALUE) { before[k] = v; size += v.length; } });
    if (size < 1500000 && Object.keys(before).length) {
      try { rawSet.call(ls, BK, JSON.stringify({ at: Date.now(), acct: s.acct, data: before })); } catch (e) { /* no room: the join still loses nothing */ }
    }
    return call('GET', '/v1/data?since=0').then(function (r) {
      var server = {}, ups = [], changed = [], now = Date.now(), failed = false;
      r.items.forEach(function (x) { if (M.syncable(x.k)) server[x.k] = x; });
      Object.keys(before).forEach(function (k) {
        var sv = server[k], lv = { v: before[k], t: 0 };       // an untimed local value: the account's plain values win, lists and objects are united
        var j = M.joinKey(lv, sv ? { v: sv.v, t: sv.t } : null);
        if (!sv || j.v !== sv.v) ups.push({ k: k, v: j.v, t: now });
        if (j.v !== before[k]) {
          if (!setLocal(k, j.v)) { failed = true; s.fp[k] = M.fp(before[k]); s.t[k] = sv ? sv.t : 0; return; }   // stays as it was; fetched again later
          changed.push(k);
        }
        s.fp[k] = M.fp(j.v); s.t[k] = sv ? sv.t : now;
      });
      Object.keys(server).forEach(function (k) {
        if (k in before) return;
        var x = server[k];
        if (x.v != null) { if (!setLocal(k, x.v)) { failed = true; return; } changed.push(k); }
        mark(s, k, x.v, x.t);
      });
      s.rev = failed ? 0 : (r.rev || 0);
      if (failed) s.err = 'storage_full';
      return push(s, ups).then(function () {
        ups.forEach(function (c) { if (s.fp[c.k] !== M.fp(c.v)) mark(s, c.k, c.v, c.t); });
        s.joined = 1;
        return changed;
      });
    });
  }

  function run(opts) {
    opts = opts || {};
    var s = getState();
    if (!s) return Promise.resolve(null);
    if (busy) { again = true; return Promise.resolve(null); }
    busy = true;
    s.fp = s.fp || {}; s.t = s.t || {}; s.lt = s.lt || {}; s.lf = s.lf || {}; delete s.err;
    pack();
    var work = !s.joined
      ? join(s).then(function (changed) { return { first: true, changed: changed }; })
      : (changes(s), pull(s, s.rev || 0)).then(function (p) {        // note local edits first, so a pull never overwrites a newer one
          return push(s, changes(s), opts.keepalive).then(function (stale) { return { changed: p.changed.concat(stale) }; });
        });
    return work.then(function (res) {
      unpack(res.changed);
      s.at = Date.now(); lastErr = s.err || null;      // a full storage is noted, the rest synced
      if (getState()) putState(s);           // not signed out meanwhile
      emit('ek:sync', res);
      if (!res.first && res.changed.length && !opts.quiet) toast();
      return res;
    }, function (e) {
      lastErr = e.code || 'network';
      if (e.code === 'signed_out') { try { rawDel.call(ls, ST); } catch (x) { } emit('ek:signedout'); }
      else { s.err = lastErr; if (getState()) putState(s); emit('ek:sync', { error: lastErr }); }
      return null;
    }).then(function (r) {
      busy = false;
      if (again) { again = false; schedule(1500); }
      return r;
    });
  }
  function locked(opts) {
    if (navigator.locks && navigator.locks.request) return navigator.locks.request('ek-sync', function () { return run(opts); });
    return run(opts);
  }
  // newer data arrived from another device after this page had read its own: offer a refresh, never force one
  var TOAST = { fa: ['داده‌های ذخیره‌شده‌ات از حسابت به‌روز شد.', 'تازه‌سازی'], ckb: ['داتا پاشەکەوتکراوەکانت لە هەژمارەکەتەوە نوێ کرانەوە.', 'نوێکردنەوە'],
                ar: ['تم تحديث بياناتك المحفوظة من حسابك.', 'تحديث'], en: ['Your saved data was updated from your account.', 'Refresh'] };
  function toast() {
    if (document.getElementById('ek-sync-toast') || !document.body) return;
    var l = (document.documentElement.lang || 'fa').slice(0, 3).replace(/[^a-z]/g, ''), t = TOAST[l] || TOAST[l === 'ku' ? 'ckb' : 'fa'];
    var d = document.createElement('div'), b = document.createElement('button'), x = document.createElement('button'), sp = document.createElement('span');
    d.id = 'ek-sync-toast'; d.setAttribute('role', 'status');
    d.style.cssText = 'position:fixed;inset-inline:12px;bottom:calc(76px + env(safe-area-inset-bottom));margin:auto;max-width:460px;z-index:9999;' +
      'display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;background:var(--card,#111);border:1px solid var(--line,#333);' +
      'color:var(--ink,#eee);font:14px/1.5 Vazirmatn,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.45)';
    sp.textContent = t[0]; sp.style.flex = '1';
    b.textContent = t[1]; b.style.cssText = 'border:0;border-radius:999px;padding:6px 14px;background:var(--acc,#f7931a);color:#000;font:inherit;font-weight:700;cursor:pointer';
    b.onclick = function () { location.reload(); };
    x.textContent = '×'; x.setAttribute('aria-label', 'close'); x.style.cssText = 'border:0;background:none;color:inherit;font-size:20px;cursor:pointer;padding:0 4px';
    x.onclick = function () { d.remove(); };
    d.appendChild(sp); d.appendChild(b); d.appendChild(x); document.body.appendChild(d);
  }
  // the earliest planned sync stands: a page that keeps writing can't push it back for ever
  var due = 0;
  function schedule(ms) {
    var at = Date.now() + ms;
    if (timer && due && due <= at) return;
    clearTimeout(timer); due = at;
    timer = setTimeout(function () { timer = null; due = 0; locked(); }, ms);
  }

  // notice the site's own writes (any page) and sync a few seconds later
  function touched(k) { if ((M.syncable(k) || grouped(k)) && getState()) schedule(4000); }
  P.setItem = function (k, v) { var r = rawSet.apply(this, arguments); if (this === ls) touched(k); return r; };
  P.removeItem = function (k) { var r = rawDel.apply(this, arguments); if (this === ls) touched(k); return r; };

  self.EKSync = {
    now: function () { return locked(); },
    state: function () { var s = getState(); return s ? { acct: s.acct, at: s.at || 0, joined: !!s.joined, err: s.err || null, full: !!s.full } : null; },
    start: function (acct) {
      var s = getState();
      if (s && s.acct === acct) return locked();
      putState({ on: 1, acct: acct, rev: 0, fp: {}, t: {}, lt: {}, lf: {}, joined: 0 });
      return locked();
    },
    stop: function () { try { rawDel.call(ls, ST); } catch (e) { } },
    backup: function () { try { var b = JSON.parse(ls.getItem(BK) || 'null'); if (b && Date.now() - b.at > 30 * 864e5) { rawDel.call(ls, BK); return null; } return b; } catch (e) { return null; } },
    restore: function () {     // put back this browser's data from before it joined; the account then gets it as new changes
      var b = this.backup(); if (!b) return false;
      Object.keys(b.data).forEach(function (k) { if (M.syncable(k)) P.setItem.call(ls, k, b.data[k]); });
      return true;
    },
  };

  if (getState()) {
    var go = function () { schedule(1200); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
    setInterval(function () { if (document.visibilityState === 'visible') locked(); }, 90000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') locked({ keepalive: true }); });
  }
})();
