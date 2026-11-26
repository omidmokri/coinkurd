/* entekhab.net — the optional sign-in panel of «فضای من» (/me/).
   Signed out, the site is untouched; this panel only offers the choice. Built with DOM calls only (no innerHTML with
   data), every answer of the account service is shown as text. */
(function () {
  'use strict';
  var A = self.EK_ACCT || {}, API = A.api, T = self.EK_ACCT_T, root = document.getElementById('ek-acct');
  if (!root || !T) return;
  var preview = !API && /[?&]acct=preview(&|$)/.test(location.search);
  if (!API && !preview) return;
  var UA = navigator.userAgent || '';
  var inApp = /; wv\)|FBAN|FBAV|Instagram|Line\/|Telegram|MicroMessenger/i.test(UA);
  var hasPasskey = !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
  var me = null, msg = null, busy = false, pend = null, entered = false, msgShown = null, confirmDel = false, emailOpen = false, pendingEmail = null, lastResult = null;

  function lang() {
    var l = (document.documentElement.lang || 'fa').toLowerCase();
    if (l === 'ku' || l.indexOf('ckb') === 0) return 'ckb';
    return T[l] ? l : (l === 'fa' ? 'fa' : 'en');
  }
  function t() { return T[lang()]; }
  function errText(code) { var e = t().e; return e[code] || e.default; }

  // ------------------------------------------------------------ small DOM helpers
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { n.addEventListener(ev, attrs.on[ev]); });
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  // The marks of the sign-in services, drawn as each service publishes them (Google's four-colour G, GitHub's mark,
  // Telegram's plane in its circle, the Ethereum diamond); passkey and email are plain pictograms. Constant markup only.
  var SVGNS = 'http://www.w3.org/2000/svg', gid = 0;
  var MARK = {
    google: '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
    github: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>',
    telegram: '<svg viewBox="0 0 240 240"><defs><linearGradient id="GID" x1="120" y1="240" x2="120" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1d93d2"/><stop offset="1" stop-color="#38b0e3"/></linearGradient></defs><circle cx="120" cy="120" r="120" fill="url(#GID)"/><path fill="#c8daea" d="M81.23 128.77l14.24 39.41s1.78 3.69 3.69 3.69 30.25-29.5 30.25-29.5l31.53-60.89-79.2 37.12z"/><path fill="#a9c6d8" d="M100.11 138.88l-2.73 29.05s-1.15 8.9 7.75 0 17.42-15.77 17.42-15.77"/><path fill="#fff" d="M81.49 130.18L52.2 120.64s-3.5-1.42-2.37-4.64c.23-.67.7-1.23 2.1-2.2 6.49-4.52 120.1-45.36 120.1-45.36s3.21-1.08 5.1-.36a2.77 2.77 0 0 1 1.89 2.06 9.36 9.36 0 0 1 .25 2.58c-.01.75-.1 1.45-.17 2.54-.69 11.17-21.4 94.5-21.4 94.5s-1.24 4.87-5.68 5.04a8.13 8.13 0 0 1-5.92-2.3c-8.71-7.49-38.82-27.72-45.47-32.17a1.27 1.27 0 0 1-.55-.9c-.09-.47.42-1.05.42-1.05s52.42-46.6 53.82-51.5c.1-.37-.3-.56-.85-.4-3.48 1.29-63.84 39.41-70.5 43.61a3.21 3.21 0 0 1-1.48.09z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><path fill="#fff" fill-opacity=".62" d="M12 0 4.64 12.22 12 16.57l7.36-4.35z"/><path fill="#fff" d="M12 17.97 4.58 13.62 12 24l7.37-10.38z"/><path fill="#fff" fill-opacity=".9" d="M12 0v16.57l7.36-4.35z"/></svg>',
    passkey: '<svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" fill="#06262b"/><path fill="#06262b" d="M2 19.5C2 15.9 5.1 13 9 13c1.2 0 2.3.27 3.3.75A5.9 5.9 0 0 0 11 17.5c0 1 .25 1.95.7 2.8V21H3a1 1 0 0 1-1-1z"/><path fill="#06262b" d="M17.5 12.5a3.5 3.5 0 0 1 1.1 6.83V20l-1.1 1.2-1.1-1.2v-.7l.7-.7-.7-.7v-.27a3.5 3.5 0 0 1 1.1-6.83zm0 1.8a.95.95 0 1 0 0 1.9.95.95 0 0 0 0-1.9z"/></svg>',
    email: '<svg viewBox="0 0 24 24"><path fill="#2a1600" d="M3.5 5h17A1.5 1.5 0 0 1 22 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 17.5v-11A1.5 1.5 0 0 1 3.5 5zm.6 2.2v9.6h15.8V7.2L12 12.4zM5.9 7 12 11l6.1-4z"/></svg>',
  };
  function icon(p, big) {
    var src = MARK[p]; if (!src) return null;
    if (p === 'telegram') src = src.replace(/GID/g, 'ek-tg' + (++gid));
    var svg = document.importNode(new DOMParser().parseFromString(src.replace('<svg ', '<svg xmlns="' + SVGNS + '" '), 'image/svg+xml').documentElement, true);
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    return el('span', { class: 'ek-ac-logo ek-ac-l-' + p + (big ? ' big' : ''), 'aria-hidden': 'true' }, [svg]);
  }

  // ------------------------------------------------------------ talking to the account service
  function call(method, path, body) {
    if (preview) return Promise.reject(Object.assign(new Error('preview'), { code: 'preview' }));
    return fetch(API + path, { method: method, credentials: 'include', cache: 'no-store',
      headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.error || 'failed'); e.code = j.error || 'default'; throw e; }
          return j;
        });
      }, function () { var e = new Error('network'); e.code = 'network'; throw e; });
  }
  function say(kind, text) { msg = { kind: kind, text: text }; render(); }
  // a message that follows the page language if it changes while shown
  function mt(k) { return function () { return t().m[k]; }; }
  function et(c) { return function () { return errText(c); }; }
  function fail(e) { busy = false; pend = null; say('err', e && e.code === 'preview' ? t().preview : errText(e && e.code)); }

  function load() {
    if (preview) { me = { signedIn: false, providers: { google: true, github: true, telegram: true, wallet: true, passkey: true, email: true } }; render(); return Promise.resolve(); }
    return call('GET', '/v1/me').then(function (j) {
      me = j;
      var S = self.EKSync;
      if (!j.signedIn && S && S.state()) S.stop();
      if (j.signedIn && S) {
        var st = S.state();
        if (!st || st.acct !== j.account) {
          // a brand-new account has nothing to lose: join at once. An existing one: ask first.
          if (lastResult === 'new' || lastResult === 'joined' || lastResult === 'linked') return join(j.account);
          me.askJoin = true;
        }
      }
      render();
    }, function (e) { me = me || { signedIn: false, providers: {} , down: true }; fail(e); });
  }

  function join(acct) {
    var S = self.EKSync;
    me.askJoin = false; busy = true; render();
    return S.start(acct).then(function (r) {
      busy = false;
      if (r && r.first && r.changed && r.changed.length) {
        try { sessionStorage.setItem('ek_acct_msg', lastResult || 'in'); } catch (e) { }
        location.reload(); return;
      }
      render();
    });
  }

  function back() { var r = location.pathname + (location.search.replace(/[?&](tgf|acct)=[^&]*/g, '').replace(/^&/, '?')); return r.length > 1 ? r : '/me/'; }
  function done(result) {
    busy = false; lastResult = result;
    if (T.fa.m[result]) msg = { kind: 'ok', text: mt(result) };
    return load();
  }

  // ------------------------------------------------------------ the sign-in methods
  function mode() { return me && me.signedIn ? 'link' : 'login'; }
  // remember that this tab started a sign-in, so a result in the address is only trusted when it was asked for
  function leaving(url) { try { sessionStorage.setItem('ek_acct_wait', String(Date.now())); } catch (e) { } location.href = url; }
  function oauth(p) {
    if (mode() === 'login') { busy = true; render(); leaving(API + '/v1/auth/' + p + '/start?mode=login&return=' + encodeURIComponent('/me/')); return; }
    busy = true; render();          // adding a method to the account starts from a POST only
    call('POST', '/v1/auth/' + p + '/start', { mode: 'link', ret: '/me/' }).then(function (j) {
      var ok = p === 'github' ? /^https:\/\/github\.com\/login\/oauth\/authorize\?/ : /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/;
      if (!ok.test(j.url)) throw Object.assign(new Error('x'), { code: 'default' });
      leaving(j.url);
    }).catch(fail);
  }
  var START = {
    github: function () { oauth('github'); },
    google: function () { oauth('google'); },
    telegram: function () {
      busy = true; render();
      call('POST', '/v1/auth/telegram/start', { mode: mode(), ret: '/me/' }).then(function (j) {
        if (!/^https:\/\/oauth\.telegram\.org\/auth\?/.test(j.url)) throw Object.assign(new Error('x'), { code: 'default' });
        leaving(j.url);
      }).catch(fail);
    },
    wallet: function () {
      var eth = window.ethereum;
      if (!eth || !eth.request) { say('info', t().noWallet); return; }
      busy = true; say('info', t().walletNote);
      var address;
      eth.request({ method: 'eth_requestAccounts' }).then(function (a) {
        address = a && a[0];
        if (!/^0x[0-9a-fA-F]{40}$/.test(address || '')) throw Object.assign(new Error('x'), { code: 'cancelled' });
        return eth.request({ method: 'eth_chainId' }).catch(function () { return '0x1'; });
      }).then(function (cid) {
        return call('POST', '/v1/auth/wallet/start', { address: address, chainId: parseInt(cid, 16) || 1, mode: mode(), ret: '/me/' });
      }).then(function (j) {
        var bytes = new TextEncoder().encode(j.message), hex = '0x';
        for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
        return eth.request({ method: 'personal_sign', params: [hex, address] }).then(function (sig) {
          return call('POST', '/v1/auth/wallet/verify', { flow: j.flow, signature: sig });
        }, function () { throw Object.assign(new Error('x'), { code: 'cancelled' }); });
      }).then(function (r) { return done(r.result); }).catch(function (e) { fail(e && e.code ? e : { code: 'cancelled' }); });
    },
    passkey: function () { passkeyLogin(); },
    email: function () { emailOpen = !emailOpen; render(); var i = root.querySelector('input[type=email]'); if (i) i.focus(); },
  };

  function b64uToBuf(s) { var b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); var u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
  function bufToB64u(buf) { var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

  function passkeyCreate() {
    busy = true; render();
    call('POST', '/v1/auth/passkey/register/start', { ret: '/me/' }).then(function (j) {
      var o = j.options;
      o.challenge = b64uToBuf(o.challenge); o.user.id = b64uToBuf(o.user.id);
      o.excludeCredentials = (o.excludeCredentials || []).map(function (c) { return { type: c.type, id: b64uToBuf(c.id) }; });
      return navigator.credentials.create({ publicKey: o }).then(function (c) {
        return call('POST', '/v1/auth/passkey/register/verify', { flow: j.flow, credential: { id: c.id, rawId: bufToB64u(c.rawId), type: c.type,
          response: { clientDataJSON: bufToB64u(c.response.clientDataJSON), attestationObject: bufToB64u(c.response.attestationObject) } } });
      }, function (e) { throw Object.assign(new Error('x'), { code: e && e.name === 'InvalidStateError' ? 'exists' : 'cancelled' }); });
    }).then(function (r) { return done(r.result); }).catch(fail);
  }
  function passkeyLogin() {
    busy = true; render();
    call('POST', '/v1/auth/passkey/login/start', { ret: '/me/' }).then(function (j) {
      var o = j.options; o.challenge = b64uToBuf(o.challenge);
      return navigator.credentials.get({ publicKey: o }).then(function (c) {
        return call('POST', '/v1/auth/passkey/login/verify', { flow: j.flow, credential: { id: c.id, rawId: bufToB64u(c.rawId), type: c.type,
          response: { clientDataJSON: bufToB64u(c.response.clientDataJSON), authenticatorData: bufToB64u(c.response.authenticatorData),
            signature: bufToB64u(c.response.signature), userHandle: c.response.userHandle ? bufToB64u(c.response.userHandle) : null } } });
      }, function () { throw Object.assign(new Error('x'), { code: 'cancelled' }); });
    }).then(function (r) { return done(r.result); }).catch(fail);
  }

  function sendEmail(input) {
    var v = (input.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { say('err', errText('bad_email')); return; }
    busy = true; render();
    call('POST', '/v1/auth/email/start', { email: v, mode: mode(), ret: '/me/', lang: lang() })
      .then(function () { busy = false; emailOpen = false; say('ok', t().emailSent); }).catch(fail);
  }

  // ------------------------------------------------------------ coming back from a sign-in
  function arrivals() {
    var h = location.hash, q = new URLSearchParams(location.search), clean = false, job = null;
    var m = /[#&]ek_auth=([a-z_]+)/.exec(h);
    var asked = false;
    try { var w = +sessionStorage.getItem('ek_acct_wait'); sessionStorage.removeItem('ek_acct_wait'); asked = w > 0 && Date.now() - w < 15 * 60000; } catch (e) { }
    if (m) {
      clean = true;
      if (m[1].indexOf('err_') === 0) msg = { kind: 'err', text: et(m[1].slice(4)) };
      else if (asked) { lastResult = m[1]; if (T.fa.m[m[1]]) msg = { kind: 'ok', text: mt(m[1]) }; }   // a result nobody asked for changes nothing
    }
    var tg = /[#&]tgAuthResult=([A-Za-z0-9_\-+/=%]+)/.exec(h), tgf = q.get('tgf');
    if (tg && tgf) {
      clean = true;
      job = function () {
        var auth;
        try { var s = decodeURIComponent(tg[1]).replace(/-/g, '+').replace(/_/g, '/'); auth = JSON.parse(atob(s + '==='.slice((s.length + 3) % 4))); }
        catch (e) { return Promise.reject({ code: 'bad_proof' }); }
        return call('POST', '/v1/auth/telegram/verify', { flow: tgf, auth: auth }).then(function (r) { lastResult = r.result; msg = { kind: 'ok', text: mt(T.fa.m[r.result] ? r.result : 'in') }; });
      };
    } else if (tgf) clean = true;
    var em = /[#&]ek_email=([A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{43})/.exec(h);
    if (em) { clean = true; pendingEmail = { flow: em[1], token: em[2] }; }
    try { var sm = sessionStorage.getItem('ek_acct_msg'); if (sm) { sessionStorage.removeItem('ek_acct_msg'); if (T.fa.m[sm]) msg = { kind: 'ok', text: mt(sm) }; } } catch (e) { }
    if (clean) history.replaceState(null, '', back());
    return job;
  }

  // ------------------------------------------------------------ actions while signed in
  function unlink(ref) { busy = true; render(); call('POST', '/v1/unlink', { ref: ref }).then(function () { busy = false; return load(); }).catch(fail); }
  function signOut(note, all) {
    busy = true; render();
    return call('POST', '/v1/logout', { all: !!all }).catch(function () { }).then(function () {
      if (self.EKSync) self.EKSync.stop();
      busy = false; me = null; msg = { kind: 'ok', text: mt(note || (all ? 'outAll' : 'signedOut')) }; return load();
    });
  }
  // a shared device: first make sure the account has everything, then sign out and take this account's data off the browser
  function signOutWipe() {
    var S = self.EKSync; busy = true; render();
    S.now().then(function () {
      var st = S.state();
      if (!st || st.err) throw Object.assign(new Error('x'), { code: 'network' });
      return call('POST', '/v1/logout', {});
    }).then(function () {
      S.stop();
      var M = self.EKMerge, ls = localStorage, ks = [];
      for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (M && M.syncable(k)) ks.push(k); }
      ks.forEach(function (k) { ls.removeItem(k); });
      ls.removeItem('ek_sync_backup');
      busy = false; me = null; msg = { kind: 'ok', text: mt('wiped') }; return load();
    }).catch(fail);
  }
  function del() {
    busy = true; render();
    call('POST', '/v1/account/delete', { confirm: 'delete' }).then(function () {
      if (self.EKSync) self.EKSync.stop();
      busy = false; confirmDel = false; msg = { kind: 'ok', text: mt('deleted') }; return load();
    }).catch(fail);
  }
  function download() {
    call('GET', '/v1/data?since=0').then(function (j) {
      var data = {}; j.items.forEach(function (x) { if (x.v != null) data[x.k] = x.v; });
      var a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ site: 'entekhab.net', exported: new Date().toISOString(), data: data }, null, 1)], { type: 'application/json' })),
        download: 'entekhab-account-data.json' });
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }).catch(fail);
  }

  // ------------------------------------------------------------ drawing
  function btn(label, onclick, cls, p) {
    return el('button', { type: 'button', class: 'ek-ac-b' + (cls ? ' ' + cls : ''), disabled: busy, on: { click: onclick } }, [p ? icon(p) : null, el('span', { text: label })]);
  }
  // one tile per sign-in service: its mark large in a lit disc, "continue with" over the service's own name
  function tile(p, onclick, i) {
    var L = t(), on = busy && pend === p, open = p === 'email' && emailOpen;
    return el('button', { type: 'button', class: 'ek-ac-t ek-ac-t-' + p + (on ? ' is-busy' : '') + (open ? ' is-on' : ''), style: '--i:' + i, disabled: busy,
      'aria-busy': on ? 'true' : false, 'aria-expanded': p === 'email' ? String(!!open) : false,
      on: { click: function () { if (preview) { say('info', L.preview); return; } msg = null; pend = p; onclick(); } } },
      [el('span', { class: 'ek-ac-disc' }, [icon(p, true), el('i', { class: 'ek-ac-spin', 'aria-hidden': 'true' })]),
       el('span', { class: 'ek-ac-tx' }, [el('small', { text: L.cont + ' ' }), el('b', { text: L.n[p] })])]);
  }
  function methodButtons(linked) {
    var P = (me && me.providers) || {}, grid = el('div', { class: 'ek-ac-grid' + (linked ? ' sm' : '') }), i = 0;
    ['google', 'github', 'telegram', 'wallet', 'passkey', 'email'].forEach(function (p) {
      if (!P[p]) return;
      if (p === 'google' && inApp) return;
      if (p === 'passkey' && !hasPasskey) return;
      if (linked && linked[p] && p !== 'passkey' && p !== 'wallet') return;
      grid.appendChild(tile(p, p === 'passkey' && me && me.signedIn ? passkeyCreate : START[p], i++));
    });
    return grid;
  }
  function hero(L) {
    var orb = el('span', { class: 'ek-ac-orb', 'aria-hidden': 'true' }, [el('i', { class: 'r1' }), el('i', { class: 'r2' }), el('i', { class: 'dot d1' }), el('i', { class: 'dot d2' }), el('i', { class: 'dot d3' })]);
    var s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ek-ac-sync');
    var pa = document.createElementNS(SVGNS, 'path'); pa.setAttribute('fill', 'currentColor');
    pa.setAttribute('d', 'M12 4a8 8 0 0 1 7.5 5.2l1.6-.9.6 5.2-4.8-2 1.5-.9A5.9 5.9 0 0 0 6.2 10.3L4.3 9.7A8 8 0 0 1 12 4zm-7.7 6.3 4.8 2-1.5.9a5.9 5.9 0 0 0 10.2.5l1.9.6A8 8 0 0 1 4.5 14.8l-1.6.9z');
    s.appendChild(pa); orb.appendChild(s);
    return el('div', { class: 'ek-ac-hero' }, [orb, el('div', { class: 'ek-ac-ht' }, [el('span', { class: 'ek-ac-kick', text: L.title }), el('h3', { text: L.hero }),
      el('ul', { class: 'ek-ac-chips' }, L.chips.map(function (c) { return el('li', { text: c }); }))])]);
  }
  function render() {
    var L = t(), dir = lang() === 'en' ? 'ltr' : 'rtl';
    root.hidden = false; root.setAttribute('dir', dir);
    root.textContent = '';
    var card = el('div', { class: 'card ek-ac' + (me && !me.signedIn ? ' ek-ac-out' : '') });
    if (me && !entered) { card.classList.add('ek-ac-enter'); entered = true; }
    if (!busy) pend = null;
    if (!me || !me.signedIn) card.appendChild(hero(L)); else card.appendChild(el('h3', { class: 'ek-ac-h', text: L.title }));
    if (!me) { card.appendChild(el('p', { class: 'ek-ac-mute', text: '…' })); root.appendChild(card); return; }

    if (pendingEmail) {
      var box = el('div', { class: 'ek-ac-box' }, [el('b', { text: L.emailConfirmT }),
        btn(L.emailConfirmGo, function () {
          var pe = pendingEmail; pendingEmail = null; busy = true; render();
          call('POST', '/v1/auth/email/verify', { flow: pe.flow, token: pe.token }).then(function (r) { return done(r.result); }).catch(fail);
        }, 'p', 'email')]);
      card.appendChild(box);
    }

    if (!me.signedIn) {
      card.appendChild(el('p', { class: 'ek-ac-pick', text: L.pick }));
      card.appendChild(methodButtons(null)); mailForm(card, L);
      if (me.providers && me.providers.passkey && hasPasskey)
        card.appendChild(el('button', { type: 'button', class: 'ek-ac-new', disabled: busy, on: { click: function () { if (preview) { say('info', L.preview); return; } msg = null; passkeyCreate(); } } },
          [el('span', { class: 'ek-ac-plus', 'aria-hidden': 'true', text: '+' }), el('span', { text: L.passkeyNew })]));
      card.appendChild(el('p', { class: 'ek-ac-lead', text: L.lead }));
      if (inApp && me.providers && me.providers.google) card.appendChild(el('p', { class: 'ek-ac-mute', text: L.inApp }));
    } else if (me.askJoin) {
      card.appendChild(el('div', { class: 'ek-ac-box' }, [el('b', { text: L.joinT }), el('p', { text: L.joinB }), methodList(false),
        el('div', { class: 'ek-ac-row' }, [btn(L.joinGo, function () { join(me.account); }, 'p'), btn(L.joinNo, function () { signOut(); })])]));
    } else {
      var st = self.EKSync && self.EKSync.state();
      var when = st && st.at ? new Date(st.at).toLocaleString(lang() === 'en' ? 'en-GB' : lang() === 'ar' ? 'ar' : 'fa-IR', { dateStyle: 'medium', timeStyle: 'short' }) : L.never;
      card.appendChild(el('div', { class: 'ek-ac-in' }, [el('span', { class: 'ek-ac-tick', 'aria-hidden': 'true' }),
        el('div', null, [el('b', { class: 'ek-ac-ok', text: L.signedIn }), el('span', { class: 'ek-ac-mute' }, [L.synced + ': ', busy ? L.syncing : when])])]));
      if (st && st.full) card.appendChild(el('p', { class: 'ek-ac-warn', text: L.full }));
      card.appendChild(el('h4', { text: L.methodsT }));
      card.appendChild(methodList(true));
      card.appendChild(el('h4', { text: L.addT }));
      var linked = {}; (me.methods || []).forEach(function (x) { linked[x.provider] = 1; });
      card.appendChild(methodButtons(linked)); mailForm(card, L);
      var act = el('div', { class: 'ek-ac-row ek-ac-act' }, [
        btn(L.syncNow, function () { busy = true; render(); self.EKSync.now().then(function () { busy = false; say('ok', L.m.synced); }); }),
        btn(L.download, download),
        btn(L.signOut, function () { signOut(); }),
      ]);
      var outs = el('div', { class: 'ek-ac-outs' }, [
        el('button', { type: 'button', class: 'ek-ac-link', disabled: busy, on: { click: signOutWipe }, text: L.outWipe }),
        el('p', { class: 'ek-ac-mute', text: L.wipeNote }),
        el('button', { type: 'button', class: 'ek-ac-link', disabled: busy, on: { click: function () { signOut(null, true); } }, text: L.outAll }),
      ]);
      var bk = self.EKSync && self.EKSync.backup();
      if (bk) act.appendChild(btn(L.backup, function () { if (self.EKSync.restore()) { self.EKSync.now(); try { sessionStorage.setItem('ek_acct_msg', 'restored'); } catch (e) { } location.reload(); } }));
      card.appendChild(act);
      card.appendChild(el('p', { class: 'ek-ac-mute', text: L.signOutNote }));
      card.appendChild(outs);
      if (!confirmDel) card.appendChild(el('button', { type: 'button', class: 'ek-ac-link ek-ac-danger', disabled: busy, on: { click: function () { confirmDel = true; render(); } }, text: L.del }));
      else card.appendChild(el('div', { class: 'ek-ac-box ek-ac-dbox' }, [el('p', { text: L.delConfirm }),
        el('div', { class: 'ek-ac-row' }, [btn(L.delGo, del, 'd'), btn(L.cancel, function () { confirmDel = false; render(); })])]));
    }

    if (msg && !(me && me.askJoin && msg.kind === 'ok')) card.appendChild(el('p', { class: 'ek-ac-msg ek-ac-' + msg.kind + (msgShown !== msg ? ' pop' : ''), role: msg.kind === 'err' ? 'alert' : 'status', text: typeof msg.text === 'function' ? msg.text() : msg.text }));
    msgShown = msg;
    if (preview) card.appendChild(el('p', { class: 'ek-ac-warn', text: L.preview }));
    card.appendChild(el('details', { class: 'ek-ac-priv' }, [el('summary', { text: L.privacyT }), el('p', { text: L.privacyB })]));
    root.appendChild(card);
  }
  function mailForm(card, L) {
    if (!emailOpen) return;
    {
      var inp = el('input', { type: 'email', autocomplete: 'email', inputmode: 'email', dir: 'ltr', placeholder: L.emailPh, maxlength: '254', 'aria-label': L.emailPh,
        on: { keydown: function (ev) { if (ev.key === 'Enter') sendEmail(inp); } } });
      card.appendChild(el('div', { class: 'ek-ac-row ek-ac-mail' }, [inp, btn(L.emailSend, function () { if (preview) { say('info', L.preview); return; } sendEmail(inp); }, 'p')]));
    }
  }
  function methodList(removable) {
    var L = t(), ul = el('ul', { class: 'ek-ac-list' }), list = (me && me.methods) || [];
    list.forEach(function (x) {
      var li = el('li', null, [icon(x.provider) || el('span', { class: 'ek-ac-logo' }), el('span', { class: 'ek-ac-pn', text: L.n[x.provider] || x.provider }), el('bdi', { class: 'ek-ac-lb', dir: 'ltr', text: x.label || '' })]);
      if (removable && list.length > 1) li.appendChild(el('button', { type: 'button', class: 'ek-ac-link', disabled: busy, on: { click: function () { unlink(x.ref); } }, text: L.remove }));
      ul.appendChild(li);
    });
    return ul;
  }

  // coming back with the browser's Back button after leaving for a sign-in: the page is live again
  window.addEventListener('pageshow', function (ev) { if (ev.persisted && busy) { busy = false; pend = null; render(); } });
  new MutationObserver(function () { render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('ek:sync', function () { if (me && me.signedIn && !busy) render(); });
  window.addEventListener('ek:signedout', function () { load(); });

  var job = arrivals();
  render();
  (job ? job().catch(function (e) { msg = { kind: 'err', text: et(e && e.code) }; }) : Promise.resolve()).then(load);
})();
