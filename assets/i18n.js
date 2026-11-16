/* entekhab.net — the site in the other 43 languages.

   The menu keeps the site's own four (کوردی · فارسی · العربية · English). Beside them turns a globe: it opens the
   rest, and a reader who picks one gets the English page translated here string by string from the dictionaries
   scripts/i18n_site.py writes (/i18n/<code>/common.json, /page/<page>.json, /js/<script>.json). Numbers are matched
   as {1}, {2}…, so "2,191 transactions" uses the entry "{1} transactions", and text the page's own scripts write
   later is translated as it appears. A string with no entry yet stays in English.

   Arabic has its own layer (assets/ar.js) and is untouched by this one; the two never run together. The globe only
   offers a language once enough of the site is translated into it (/i18n/langs.json). The encyclopedia stays in its
   own three languages. */
/* Every class and id here starts with ekw- (or ek-tr-/ek-i18n- for the ids): the site already uses ek-gl on
   twenty-one of its own menu and footer elements, and a styling rule meant for this globe collapsed all of them.
   Check a name against the live pages before adding one. */
(function () {
  'use strict';
  var d = document, de = d.documentElement, w = window;
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
             set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } } };
  var PATH = location.pathname, ENC = /^\/encyclopedia\//.test(PATH);
  var CODE = ls.get('ek_l') || '';
  var ON = !!CODE && !ENC && ls.get('ek_ar') !== '1';
  var LANGS = null, ME = null;

  /* ------------------------------------------------------------------ the globe and its panel */
  var CSS = '.ekw-globe{position:relative;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;'
    + 'padding:0;border:0;border-radius:50%;cursor:pointer;background:transparent;vertical-align:middle;flex:0 0 auto}'
    + '.ekw-globe::after{content:"";position:absolute;inset:-3px;border-radius:50%;background:radial-gradient(circle at 50% 50%,rgba(56,214,255,.35),transparent 70%);opacity:0;transition:opacity .25s}'
    + '.ekw-globe:hover::after,.ekw-globe:focus-visible::after{opacity:1}'
    + '.ekw-globe svg{width:26px;height:26px;display:block;filter:drop-shadow(0 0 4px rgba(56,214,255,.55))}'
    + '.ekw-globe .ekw-spin{animation:ekw-spinin 9s linear infinite}.ekw-globe:hover .ekw-spin{animation-duration:3.5s}'
    + '@keyframes ekw-spinin{from{transform:translateX(0)}to{transform:translateX(-36px)}}'
    + '@media (prefers-reduced-motion:reduce){.ekw-globe .ekw-spin{animation:none}}'
    + '.ekw-globe.on{box-shadow:0 0 0 2px rgba(56,214,255,.9)}'
    + '.ekw-wrap{position:fixed;inset:0;z-index:2147483000;background:rgba(6,10,18,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.ekw-panel{width:min(560px,100%);max-height:min(74vh,620px);display:flex;flex-direction:column;border-radius:18px;overflow:hidden;'
    + 'background:linear-gradient(160deg,#0d1726,#0a1020);border:1px solid rgba(56,214,255,.28);box-shadow:0 24px 70px rgba(0,0,0,.6);color:#e8f1ff}'
    + '.ekw-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(56,214,255,.18)}'
    + '.ekw-head b{font-size:15px;font-weight:600;flex:1;text-align:start}'
    + '.ekw-head button{background:transparent;border:0;color:#9fb6d4;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:8px}'
    + '.ekw-head button:hover{color:#fff;background:rgba(255,255,255,.08)}'
    + '.ekw-search{margin:12px 16px 4px;padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#e8f1ff;font:inherit;font-size:14px;outline:0}'
    + '.ekw-search:focus{border-color:rgba(56,214,255,.6)}'
    + '.ekw-list{overflow:auto;padding:8px 10px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}'
    + '.ekw-list button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:9px 11px;border-radius:11px;border:1px solid transparent;'
    + 'background:rgba(255,255,255,.04);color:#e8f1ff;cursor:pointer;font:inherit;text-align:start;transition:background .15s,border-color .15s}'
    + '.ekw-list button:hover{background:rgba(56,214,255,.14);border-color:rgba(56,214,255,.45)}'
    + '.ekw-list button.on{background:rgba(56,214,255,.2);border-color:rgba(56,214,255,.75)}'
    + '.ekw-list .n{font-size:14px}.ekw-list .e{font-size:11px;color:#8fa8c8}'
    + '.ekw-foot{padding:10px 16px;border-top:1px solid rgba(56,214,255,.18);font-size:12px;color:#8fa8c8;text-align:start}'
    + '.ekw-foot button{background:transparent;border:0;color:#38d6ff;cursor:pointer;font:inherit;padding:0;text-decoration:underline}'
    + 'html.ek-tr-wait body{opacity:0!important}';

  var GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs>'
    + '<clipPath id="ekgc"><circle cx="12" cy="12" r="10"/></clipPath>'
    + '<linearGradient id="ekgg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3b63"/><stop offset="1" stop-color="#0a1c33"/></linearGradient></defs>'
    + '<circle cx="12" cy="12" r="10" fill="url(#ekgg)"/>'
    + '<g clip-path="url(#ekgc)"><g class="ekw-spin" fill="#38d6ff" fill-opacity=".92">'
    /* two copies of the same land, 36 apart, so the spin loops without a seam */
    + '<path d="M3 7h5l2 2-3 2 1 3-3 1-2-3zM13 6h6l2 3-3 1-1 3-4-2 1-3zM9 16h7l2 3-5 2-5-2z"/>'
    + '<path d="M39 7h5l2 2-3 2 1 3-3 1-2-3zM49 6h6l2 3-3 1-1 3-4-2 1-3zM45 16h7l2 3-5 2-5-2z"/>'
    + '</g></g>'
    + '<circle cx="12" cy="12" r="10" fill="none" stroke="#38d6ff" stroke-opacity=".85" stroke-width="1.3"/>'
    + '<ellipse cx="12" cy="12" rx="4.4" ry="10" fill="none" stroke="#38d6ff" stroke-opacity=".45" stroke-width=".8"/>'
    + '<path d="M2.4 9h19.2M2.4 15h19.2" stroke="#38d6ff" stroke-opacity=".45" stroke-width=".8" fill="none"/></svg>';

  var T = {   /* the panel's own words, in the site's four languages */
    ckb: { t: 'زمانی تر', s: 'زمان بگەڕێ…', b: 'گەڕانەوە بۆ زمانەکانی ماڵپەڕ', n: 'ماڵپەڕ بە' },
    fa: { t: 'زبان‌های دیگر', s: 'جست‌وجوی زبان…', b: 'بازگشت به زبان‌های خود سایت', n: 'سایت به' },
    ar: { t: 'لغات أخرى', s: 'ابحث عن لغة…', b: 'العودة إلى لغات الموقع', n: 'الموقع بـ' },
    en: { t: 'More languages', s: 'Search a language…', b: 'Back to the site’s own languages', n: 'The site in' }
  };
  function words() { var l = de.getAttribute('lang') || ls.get('ck_lang') || 'en'; return T[l] || T.en; }

  function style() { if (d.getElementById('ek-i18n-s')) return; var s = d.createElement('style'); s.id = 'ek-i18n-s'; s.textContent = CSS; (d.head || de).appendChild(s); }

  function openPanel() {
    if (!LANGS || !LANGS.length || d.querySelector('.ekw-wrap')) return;
    var W = words();
    var wrap = d.createElement('div'); wrap.className = 'ekw-wrap'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    var dir = (de.getAttribute('dir') === 'rtl') ? 'rtl' : 'ltr';
    wrap.innerHTML = '<div class="ekw-panel" dir="' + dir + '"><div class="ekw-head"><b></b><button type="button" aria-label="close">×</button></div>'
      + '<input class="ekw-search" type="search" autocomplete="off"><div class="ekw-list"></div>'
      + '<div class="ekw-foot"></div></div>';
    wrap.querySelector('.ekw-head b').textContent = W.t;
    wrap.querySelector('.ekw-search').setAttribute('placeholder', W.s);
    var list = wrap.querySelector('.ekw-list');
    LANGS.forEach(function (L) {
      var b = d.createElement('button'); b.type = 'button'; b.setAttribute('data-code', L.code); b.setAttribute('lang', L.code);
      if (L.code === CODE) b.className = 'on';
      b.innerHTML = '<span class="n"></span><span class="e"></span>';
      b.querySelector('.n').textContent = L.native; b.querySelector('.e').textContent = L.english;
      list.appendChild(b);
    });
    var foot = wrap.querySelector('.ekw-foot');
    if (ON) { var back = d.createElement('button'); back.type = 'button'; back.textContent = W.b; back.setAttribute('data-back', '1'); foot.appendChild(back); }
    else foot.textContent = W.n + ' ' + LANGS.length + '+';
    d.body.appendChild(wrap);
    wrap.querySelector('.ekw-search').focus();
    wrap.addEventListener('input', function (e) {
      var q = (e.target.value || '').trim().toLowerCase();
      [].forEach.call(list.children, function (b) {
        var L = LANGS[[].indexOf.call(list.children, b)];
        b.style.display = (!q || L.native.toLowerCase().indexOf(q) >= 0 || L.english.toLowerCase().indexOf(q) >= 0 || L.code.indexOf(q) === 0) ? '' : 'none';
      });
    });
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('.ekw-head button')) { wrap.remove(); return; }
      if (e.target.closest('[data-back]')) { ls.set('ek_l', null); location.reload(); return; }
      var b = e.target.closest('button[data-code]'); if (!b) return;
      var c = b.getAttribute('data-code');
      ls.set('ek_l', c); ls.set('ek_ar', null); ls.set('ck_lang', 'en');
      var en = d.querySelector('link[rel="alternate"][hreflang="en"]');
      if (en && en.getAttribute('href')) { try { var u = new URL(en.getAttribute('href'), location.href); if (u.pathname !== location.pathname) { location.href = u.href; return; } } catch (err) { } }
      location.reload();
    });
    w.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { wrap.remove(); w.removeEventListener('keydown', esc); } });
  }

  function globe() {
    if (!LANGS || !LANGS.length) return;
    [].forEach.call(d.querySelectorAll('#langs,.ek-lang,.lsw'), function (box) {
      if (box.querySelector('.ekw-globe')) { box.querySelector('.ekw-globe').classList.toggle('on', ON); return; }
      var b = d.createElement('button'); b.type = 'button'; b.className = 'ekw-globe' + (ON ? ' on' : '');
      b.setAttribute('aria-label', words().t); b.setAttribute('title', words().t); b.innerHTML = GLOBE;
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openPanel(); });
      box.appendChild(b);
    });
  }

  /* leaving for one of the site's own four: drop the chosen language first */
  w.addEventListener('click', function (ev) {
    if (!ON) return;
    var b = ev.target.closest && ev.target.closest('button[data-l]');
    if (!b || !b.closest('#langs,.ek-lang,.lsw')) return;
    ls.set('ek_l', null);
  }, true);

  function boot() { style(); globe(); }
  fetch('/i18n/langs.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    LANGS = (j && j.ready) || [];
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === CODE) ME = LANGS[i];
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
    if (ON && ME) translate();
    else de.classList.remove('ek-tr-wait');
  }).catch(function () { de.classList.remove('ek-tr-wait'); });

  /* ------------------------------------------------------------------ the page, string by string */
  function translate() {
    de.setAttribute('lang', CODE); de.setAttribute('dir', ME.dir);
    function fixdir() { if (d.body && d.body.getAttribute('dir') && d.body.getAttribute('dir') !== ME.dir) d.body.setAttribute('dir', ME.dir); }
    var M = {}, TB = {}, memo = {}, nmemo = 0, DONE = {};
    function key(u) { u = u.replace(/^\/+|\/+$/g, '') || 'home'; return u.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 120); }
    var page = PATH.replace(/index\.html$/, '').replace(/\.html$/, '');
    var base = '/i18n/' + CODE + '/';
    var urls = [base + 'common.json', base + 'page/' + key(page) + '.json'];
    [].forEach.call(d.querySelectorAll('script[src^="/assets/"]'), function (s) {
      var m = s.getAttribute('src').match(/^\/assets\/([\w.-]+)\.js/);
      if (m && m[1] !== 'i18n' && m[1] !== 'ar') urls.push(base + 'js/' + m[1] + '.json');
    });
    var NUM = /(^|[^A-Za-z{0-9])(\d[\d,]*(?:\.\d+)?)/g;
    function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function add(dict) {
      for (var k in dict) {
        if (M[k]) continue; M[k] = dict[k];
        if (/\{\d+\}/.test(k) && /[A-Za-z]{2}/.test(k.replace(/\{\d+\}/g, ''))) {
          var order = [], re = esc(k).replace(/\\\{(\d+)\\\}/g, function (m, n) { order.push(+n); return '(.+?)'; });
          var lits = k.split(/\{\d+\}/).filter(function (x) { return x.trim(); });
          var lw = ((lits[0] || '').toLowerCase().match(/[a-z0-9$#%+.-]+/) || [''])[0];
          try { (TB[lw] || (TB[lw] = [])).push([new RegExp('^' + re + '$'), dict[k], order, lits]); } catch (e) { }
        }
      }
    }
    function fill(a, vals) { return a.replace(/\{(\d+)\}/g, function (m, i) { return vals[i - 1] != null ? vals[i - 1] : m; }); }
    function tryT(L, t) {
      for (var i = 0; i < L.length; i++) {
        var tp = L[i], at = 0, ok2 = true;
        for (var q = 0; q < tp[3].length; q++) { var f = t.indexOf(tp[3][q], at); if (f < 0) { ok2 = false; break; } at = f + tp[3][q].length; }
        if (!ok2) continue;
        var m = tp[0].exec(t); if (m) { var v = []; for (var j = 0; j < tp[2].length; j++) v[tp[2][j] - 1] = m[j + 1]; return fill(tp[1], v); }
      }
      return null;
    }
    function look(t) {
      var nums = [], k = t.replace(NUM, function (m, p, n) { nums.push(n); return p + '{' + nums.length + '}'; });
      if (M[k]) return fill(M[k], nums);
      if (t.length > 400) return null;
      var ws = {}, lt = t.toLowerCase(); lt.replace(/[a-z0-9$#%+.-]+/g, function (x) { ws[x] = 1; return x; }); ws[''] = 1;
      for (var w0 in ws) { var L = TB[w0]; if (L) { var r = tryT(L, t); if (r != null) return r; } }
      return null;
    }
    var EDGE = /^[^A-Za-z0-9{$£€]+|[\s:·↗↓→←…]+$/g;
    function tr(raw) {
      var t = raw.replace(/\s+/g, ' ').trim();
      if (!t || t.length > 4000 || !/[A-Za-z]{2}/.test(t)) return null;
      if (memo.hasOwnProperty(t)) return memo[t];
      var r = look(t);
      if (r == null) { var core = t.replace(EDGE, ''); if (core && core !== t) { var c = look(core); if (c != null) { var i0 = t.indexOf(core); r = t.slice(0, i0) + c + t.slice(i0 + core.length); } } }
      if (nmemo++ > 20000) { memo = {}; DONE = {}; nmemo = 0; }
      return (memo[t] = r);
    }
    var SKIP = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1, NOSCRIPT: 1, KBD: 1 };
    function ok(el2) {
      for (var e = el2; e && e !== d.body; e = e.parentNode) {
        if (e.nodeType !== 1) continue;
        if (SKIP[e.tagName] || e.hasAttribute('data-l') || e.classList.contains('ekw-panel') || e.getAttribute('translate') === 'no' || e.classList.contains('notranslate')) return false;
        var lg = e.getAttribute('lang'); if (lg) return lg === 'en' || lg === CODE;
      }
      return true;
    }
    var ATTR = ['placeholder', 'title', 'aria-label', 'alt'];
    function textNode(n) {
      var v = n.nodeValue; if (!v || !/[A-Za-z]/.test(v) || !ok(n.parentNode)) return;
      if (DONE.hasOwnProperty(v)) return;
      var r = tr(v); if (r == null) return;
      var nv = v.match(/^\s*/)[0] + r + v.match(/\s*$/)[0];
      if (nv !== v) { DONE[nv] = 1; n.nodeValue = nv; }
    }
    function el(e) {
      if (e.nodeType !== 1 || !ok(e)) return;
      for (var i = 0; i < ATTR.length; i++) {
        var v = e.getAttribute(ATTR[i]);
        if (v && /[A-Za-z]/.test(v) && !DONE.hasOwnProperty(v)) { var r = tr(v); if (r != null && r !== v) { DONE[r] = 1; e.setAttribute(ATTR[i], r); } }
      }
    }
    function walk(root) {
      if (root.nodeType === 3) { textNode(root); return; }
      if (root.nodeType !== 1) return;
      el(root);
      var it = d.createTreeWalker(root, 5, null), n;
      while ((n = it.nextNode())) { if (n.nodeType === 3) textNode(n); else el(n); }
    }
    var pend = [], sched = 0;
    function flush() { sched = 0; var p = pend; pend = []; for (var i = 0; i < p.length; i++) if (p[i].isConnected) walk(p[i]); fixdir(); globe(); }
    function queue(n) { pend.push(n); if (!sched) sched = (w.requestAnimationFrame || setTimeout)(flush); }
    function title() { if (DONE.hasOwnProperty(d.title)) return; var r = tr(d.title); if (r && r !== d.title) { DONE[r] = 1; d.title = r; } }

    Promise.all(urls.map(function (u) { return fetch(u).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); })).then(function (all) {
      all.forEach(add);
      function run() {
        walk(d.body); title(); fixdir(); globe(); de.classList.remove('ek-tr-wait');
        new MutationObserver(function (ms) {
          for (var i = 0; i < ms.length; i++) {
            var m = ms[i];
            if (m.type === 'childList') { for (var j = 0; j < m.addedNodes.length; j++) queue(m.addedNodes[j]); }
            else if (m.type === 'characterData') queue(m.target);
            else if (m.type === 'attributes' && m.target) queue(m.target);
          }
        }).observe(d.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
      }
      if (d.body) run(); else d.addEventListener('DOMContentLoaded', run);
    }).catch(function () { de.classList.remove('ek-tr-wait'); });
  }
})();
