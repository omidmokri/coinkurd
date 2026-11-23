/* entekhab.net — /swap/
 *
 * The only script on the swap page. It does one thing: put Rango's own widget (https://widget.rango.exchange/) into a
 * sandboxed frame. Nothing else runs here, on purpose:
 *
 *   • this page never sees a wallet, a key, a seed phrase or a transaction. The wallet talks to the widget inside the
 *     frame, which is another origin; the browser does not let this page read or change anything in it;
 *   • no analytics, no counters, no other host: the page's Content-Security-Policy allows this file, one stylesheet and
 *     that one frame, and nothing else;
 *   • nothing is listened to: no `message` handler, so nothing outside can talk to this page;
 *   • the settings handed to the widget are rebuilt here field by field from an allow-list and checked again, so a
 *     changed settings block can never point the widget at another server (apiUrl, custom RPCs … are never passed);
 *   • the page refuses to work inside somebody else's frame (click-jacking).
 *
 * Tests: tests/test_swap.js, tests/test_swap.py.
 */
(function (root) {
  'use strict';

  var WIDGET = 'https://widget.rango.exchange/';
  var MAX_PERCENT = 3;                       // Rango's own ceiling for an affiliate fee
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var HEX32 = /^[0-9a-f]{32}$/;
  var REF = /^[A-Za-z0-9_-]{1,32}$/;
  var CHAIN = /^[A-Z][A-Z0-9_]{1,23}$/;
  var EVM = /^0x[0-9a-fA-F]{40}$/;
  var B58 = '[1-9A-HJ-NP-Za-km-z]';
  var OTHER = { SOLANA: new RegExp('^' + B58 + '{32,44}$'), TRON: new RegExp('^T' + B58 + '{33}$') };
  /* the keys Rango publishes in its documentation for trying the widget; they must never run on the live page */
  var TEST = ['c6381a79-2817-4602-83bf-6a641a409e32', 'e24844c5deb5193c1c14840a7af6a40b'];

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }

  /* settings as written by scripts/build_swap.py  →  the object the widget gets, or null when anything is off */
  function config(raw) {
    if (!plain(raw) || raw.enabled !== true) return null;
    if (typeof raw.apiKey !== 'string' || !UUID.test(raw.apiKey) || TEST.indexOf(raw.apiKey) >= 0) return null;
    var wc = raw.walletConnectProjectId;
    if (typeof wc !== 'string' || !HEX32.test(wc) || TEST.indexOf(wc) >= 0) return null;
    var out = { apiKey: raw.apiKey, walletConnectProjectId: wc };
    var a = raw.affiliate;
    if (a !== undefined && a !== null) {
      if (!plain(a)) return null;
      var ref = a.ref === undefined ? '' : a.ref, pct = a.percent === undefined ? 0 : a.percent;
      var ws = a.wallets === undefined ? {} : a.wallets;
      if (typeof ref !== 'string' || (ref !== '' && !REF.test(ref))) return null;
      if (typeof pct !== 'number' || !isFinite(pct) || pct < 0 || pct > MAX_PERCENT) return null;
      if (!plain(ws)) return null;
      var wallets = {}, n = 0;
      for (var k in ws) {
        if (!own(ws, k)) continue;
        var v = ws[k];
        if (!CHAIN.test(k) || typeof v !== 'string') return null;
        if (!(own(OTHER, k) ? OTHER[k].test(v) : EVM.test(v))) return null;
        wallets[k] = v; n++;
      }
      if ((pct > 0 || n > 0) && ref === '') return null;          // a fee with nobody to credit is a mistake, not a setting
      if (ref !== '') {
        out.affiliate = { ref: ref };
        if (pct > 0) out.affiliate.percent = pct;
        if (n > 0) out.affiliate.wallets = wallets;
      }
    }
    out.from = { blockchain: 'BSC' };                              // most of our readers are on BNB Smart Chain; they can change it
    out.language = 'en';                                           // the widget has no Persian or Kurdish
    out.theme = {
      mode: 'dark', singleTheme: true,
      colors: { dark: { background: '#07080a', surface: '#0f1114', neutral: '#1b1e23', primary: '#f7931a', secondary: '#ffb347', foreground: '#f2f2ee', success: '#22c55e', error: '#ef4444' } }
    };
    out.features = { theme: 'hidden' };
    return out;
  }

  /* the frame address, exactly as Rango's own loader builds it: the settings as JSON in ?config=, colours with $ for # */
  function address(cfg) {
    if (!cfg) return null;
    var json = JSON.stringify(cfg, function (k, v) { return typeof v === 'string' && v.charAt(0) === '#' ? '$' + v.slice(1) : v; });
    var u = WIDGET + '?config=' + encodeURIComponent(json);
    return u.length > 6000 ? null : u;
  }

  function framed(w) { try { return w.top !== w.self; } catch (e) { return true; } }

  function frame(doc, url) {
    var f = doc.createElement('iframe');
    f.setAttribute('id', 'sw-frame');
    f.setAttribute('title', 'Rango Exchange');
    /* scripts and its own storage (it is another origin, so that is Rango's storage, not ours); pop-ups for the wallet
       and the block explorer. No top-navigation: the widget cannot take this tab somewhere else. */
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms');
    f.setAttribute('allow', 'clipboard-write');
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.setAttribute('loading', 'eager');
    f.setAttribute('src', url);
    return f;
  }

  function start(win) {
    var doc = win.document, de = doc.documentElement;
    var lang = 'fa';
    try { var l = win.localStorage.getItem('ck_lang'); if (l === 'ckb' || l === 'en' || l === 'fa') lang = l; } catch (e) { }
    de.setAttribute('data-l', lang); de.setAttribute('lang', lang); de.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    var set = function (l) { de.setAttribute('data-l', l); de.setAttribute('lang', l); de.setAttribute('dir', l === 'en' ? 'ltr' : 'rtl'); };
    var bs = doc.querySelectorAll('[data-set-l]');
    for (var i = 0; i < bs.length; i++) bs[i].addEventListener('click', function () {
      var v = this.getAttribute('data-set-l');
      if (v !== 'fa' && v !== 'ckb' && v !== 'en') return;
      set(v); try { win.localStorage.setItem('ck_lang', v); } catch (e) { }
    });
    var box = doc.getElementById('sw-box'), raw = null;
    if (!box) return 'nobox';
    if (framed(win)) { de.setAttribute('data-s', 'framed'); return 'framed'; }
    try { raw = JSON.parse(box.getAttribute('data-c') || 'null'); } catch (e) { raw = null; }
    var url = address(config(raw));
    if (!url) { de.setAttribute('data-s', 'off'); return 'off'; }
    box.appendChild(frame(doc, url));
    de.setAttribute('data-s', 'on');
    return 'on';
  }

  var api = { config: config, address: address, frame: frame, framed: framed, start: start, WIDGET: WIDGET };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root && root.document) start(root);
})(typeof window !== 'undefined' ? window : null);
