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
  var LANGS = null, ME = null, FLAGS = {};

  /* ------------------------------------------------------------------ the globe and its panel */
  /* The pill is the one /market/ already uses (.pm-hglobe): same gradient, height, corner, weight and gap, so the
     two headers read as one. What is added is only attention: the globe turns, a sheen crosses it now and then, and
     a ring breathes around it until the reader has opened it once. */
  var CSS = '.ekw-globe{position:relative;display:inline-flex;align-items:center;gap:4px;height:30px;padding:0 9px;'
    + 'border:0;border-radius:9px;cursor:pointer;font:700 .78rem/1 inherit;color:#e0ddd9;overflow:hidden;'
    + 'background-image:linear-gradient(135deg,#835700,#b47208 55%,#b36e0e);vertical-align:middle;flex:0 0 auto}'
    + '.ekw-globe>svg{width:15px;height:15px;display:block;flex:0 0 auto}'
    + '.ekw-globe>b{font:inherit;letter-spacing:.2px}'
    + '.ekw-globe::after{content:"";position:absolute;top:0;bottom:0;width:38%;left:-45%;pointer-events:none;'
    + 'background:linear-gradient(100deg,transparent,rgba(255,255,255,.42),transparent);animation:ekw-sheen 5.5s ease-in-out infinite}'
    + '@keyframes ekw-sheen{0%,62%{left:-45%}88%,100%{left:115%}}'
    + '.ekw-globe.ekw-new{box-shadow:0 0 0 0 rgba(247,169,26,.65);animation:ekw-ring 2.6s ease-out infinite}'
    + '@keyframes ekw-ring{0%{box-shadow:0 0 0 0 rgba(247,169,26,.6)}70%{box-shadow:0 0 0 9px rgba(247,169,26,0)}100%{box-shadow:0 0 0 0 rgba(247,169,26,0)}}'
    + '.ekw-globe:hover{filter:brightness(1.14)}'
    + '.ekw-globe:hover .ekw-spin{animation-duration:2.2s}'
    + '.ekw-spin{transform-origin:12px 12px;animation:ekw-turn 11s linear infinite}'
    + '@media (prefers-reduced-motion:reduce){.ekw-spin,.ekw-globe::after,.ekw-globe.ekw-new{animation:none}}'
    + '.ekw-wrap{position:fixed;inset:0;z-index:2147483000;background:rgba(6,5,2,.74);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.ekw-panel{width:min(580px,100%);max-height:min(76vh,640px);display:flex;flex-direction:column;border-radius:18px;overflow:hidden;'
    + 'background:linear-gradient(160deg,#17120a,#0d0b07);border:1px solid rgba(247,169,26,.34);box-shadow:0 24px 70px rgba(0,0,0,.65);color:#f2ead9}'
    + '.ekw-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(247,169,26,.2)}'
    + '.ekw-head b{font-size:15px;font-weight:700;flex:1;text-align:start}'
    + '.ekw-head span{font-size:12px;color:#b9a67e}'
    + '.ekw-head button{background:transparent;border:0;color:#b9a67e;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:8px}'
    + '.ekw-head button:hover{color:#fff;background:rgba(255,255,255,.08)}'
    + '.ekw-search{margin:12px 16px 4px;padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#f2ead9;font:inherit;font-size:14px;outline:0}'
    + '.ekw-search:focus{border-color:rgba(247,169,26,.6)}'
    + '.ekw-sec{padding:10px 16px 2px;font-size:11px;color:#9b8a66;letter-spacing:.4px;text-align:start}'
    + '.ekw-list{overflow:auto;padding:4px 10px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:6px}'
    + '.ekw-list button{display:flex;align-items:center;gap:10px;padding:8px 11px;border-radius:11px;border:1px solid transparent;'
    + 'background:rgba(255,255,255,.04);color:#f2ead9;cursor:pointer;font:inherit;text-align:start;transition:background .15s,border-color .15s,transform .12s}'
    + '.ekw-list button:active{transform:scale(.97)}'
    + '.ekw-flag{width:26px;height:26px;border-radius:50%;object-fit:cover;flex:0 0 auto;display:block;'
    + 'box-shadow:0 0 0 1px rgba(255,255,255,.22),0 2px 6px rgba(0,0,0,.45)}'
    + '.ekw-txt{display:flex;flex-direction:column;gap:1px;min-width:0}'
    + '.ekw-list button:hover{background:rgba(247,169,26,.16);border-color:rgba(247,169,26,.5)}'
    + '.ekw-list button.on{background:rgba(247,169,26,.22);border-color:rgba(247,169,26,.8)}'
    + '.ekw-list .n{font-size:14px}.ekw-list .e{font-size:11px;color:#a89770}'
    + '.ekw-foot{padding:10px 16px;border-top:1px solid rgba(247,169,26,.2);font-size:12px;color:#9b8a66;text-align:start}'
    + '.ekw-foot button{background:transparent;border:0;color:#f7a91a;cursor:pointer;font:inherit;padding:0;text-decoration:underline}'
    + 'html.ek-tr-wait body{opacity:0!important}';

  var GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff6e4" stroke-width="1.7" stroke-linecap="round">'
    + '<circle cx="12" cy="12" r="9.2"/>'
    + '<g class="ekw-spin"><ellipse cx="12" cy="12" rx="4" ry="9.2"/><path d="M3.1 9.2h17.8M3.1 14.8h17.8"/></g>'
    + '</svg>';

  var T = {   /* the panel's own words, in the site's four languages */
    ckb: { t: 'زمان', s: 'زمان بگەڕێ…', b: 'گەڕانەوە بۆ زمانەکانی ماڵپەڕ', o: 'زمانەکانی ماڵپەڕ', m: 'زمانی تر' },
    fa: { t: 'زبان', s: 'جست‌وجوی زبان…', b: 'بازگشت به زبان‌های خود سایت', o: 'زبان‌های سایت', m: 'زبان‌های دیگر' },
    ar: { t: 'اللغة', s: 'ابحث عن لغة…', b: 'العودة إلى لغات الموقع', o: 'لغات الموقع', m: 'لغات أخرى' },
    en: { t: 'Language', s: 'Search a language…', b: 'Back to the site’s own languages', o: 'The site’s languages', m: 'More languages' }
  };
  function words() { var l = de.getAttribute('lang') || ls.get('ck_lang') || 'en'; return T[l] || T.en; }

  function style() { if (d.getElementById('ek-i18n-s')) return; var s = d.createElement('style'); s.id = 'ek-i18n-s'; s.textContent = CSS; (d.head || de).appendChild(s); }

  /* The site's own languages come first in the panel, Persian and Arabic among them; picking one simply clicks the
     real button the header already has, so nothing about the site's own switching is reimplemented here. */
  function siteLangs() {
    var box = d.querySelector('#langs,.ek-lang,.lsw');
    if (!box) return [];
    return [].map.call(box.querySelectorAll('button[data-l]'), function (b) {
      return { code: b.getAttribute('data-l'), native: (b.textContent || '').trim(), btn: b, on: b.classList.contains('on') };
    }).filter(function (x) { return x.code && x.native; });
  }

  function openPanel() {
    if (!LANGS || !LANGS.length || d.querySelector('.ekw-wrap')) return;
    var W = words(), own = siteLangs();
    var wrap = d.createElement('div'); wrap.className = 'ekw-wrap'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    var dir = (de.getAttribute('dir') === 'rtl') ? 'rtl' : 'ltr';
    wrap.innerHTML = '<div class="ekw-panel" dir="' + dir + '"><div class="ekw-head"><b></b><span></span>'
      + '<button type="button" aria-label="close">×</button></div>'
      + '<input class="ekw-search" type="search" autocomplete="off">'
      + '<div class="ekw-sec ekw-sec1"></div><div class="ekw-list ekw-own"></div>'
      + '<div class="ekw-sec ekw-sec2"></div><div class="ekw-list ekw-more"></div>'
      + '<div class="ekw-foot"></div></div>';
    wrap.querySelector('.ekw-head b').textContent = W.t;
    wrap.querySelector('.ekw-head span').textContent = (own.length + LANGS.length) + '';
    wrap.querySelector('.ekw-search').setAttribute('placeholder', W.s);
    wrap.querySelector('.ekw-sec1').textContent = W.o;
    wrap.querySelector('.ekw-sec2').textContent = W.m;

    function card(code, native, english, active) {
      var b = d.createElement('button'); b.type = 'button'; b.setAttribute('data-code', code); b.setAttribute('lang', code);
      if (active) b.className = 'on';
      b.innerHTML = '<img class="ekw-flag" alt="" loading="lazy" width="26" height="26">'
        + '<span class="ekw-txt"><span class="n"></span><span class="e"></span></span>';
      var f = FLAGS[code], img = b.querySelector('.ekw-flag');
      if (f) img.src = f; else img.remove();
      b.querySelector('.n').textContent = native;
      b.querySelector('.e').textContent = english || '';
      return b;
    }
    var ownList = wrap.querySelector('.ekw-own'), moreList = wrap.querySelector('.ekw-more');
    own.forEach(function (x) { x.el = card(x.code, x.native, '', !ON && x.on); x.el.setAttribute('data-own', '1'); ownList.appendChild(x.el); });
    LANGS.forEach(function (L) { L.el = card(L.code, L.native, L.english, L.code === CODE); moreList.appendChild(L.el); });

    var foot = wrap.querySelector('.ekw-foot');
    if (ON) { var back = d.createElement('button'); back.type = 'button'; back.textContent = W.b; back.setAttribute('data-back', '1'); foot.appendChild(back); }
    d.body.appendChild(wrap);
    wrap.querySelector('.ekw-search').focus();

    wrap.addEventListener('input', function (e) {
      var q = (e.target.value || '').trim().toLowerCase();
      function show(x, hay) { x.el.style.display = (!q || hay.indexOf(q) >= 0) ? '' : 'none'; }
      own.forEach(function (x) { show(x, (x.native + ' ' + x.code).toLowerCase()); });
      LANGS.forEach(function (L) { show(L, (L.native + ' ' + L.english + ' ' + L.code).toLowerCase()); });
    });

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('.ekw-head button')) { wrap.remove(); return; }
      if (e.target.closest('[data-back]')) { ls.set('ek_l', null); location.reload(); return; }
      var b = e.target.closest('button[data-code]'); if (!b) return;
      var c = b.getAttribute('data-code');
      if (b.hasAttribute('data-own')) {          /* one of the site's own: let its real button do the work */
        ls.set('ek_l', null);
        var real = null;
        own.forEach(function (x) { if (x.code === c) real = x.btn; });
        wrap.remove();
        if (real) { real.style.display = ''; real.click(); real.style.display = 'none'; }
        else location.reload();
        return;
      }
      ls.set('ek_l', c); ls.set('ek_ar', null); ls.set('ck_lang', 'en');
      var en = d.querySelector('link[rel="alternate"][hreflang="en"]');
      if (en && en.getAttribute('href')) { try { var u = new URL(en.getAttribute('href'), location.href); if (u.pathname !== location.pathname) { location.href = u.href; return; } } catch (err) { } }
      location.reload();
    });
    w.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { wrap.remove(); w.removeEventListener('keydown', esc); } });
  }

  /* The site's own Persian and Arabic live inside the globe now, so the bar carries only Kurdish and English and
     reads the same on every page. Their buttons are not removed, only hidden: the panel clicks the real ones, so
     the switch keeps working exactly as the site already wrote it. */
  var INSIDE = ['fa', 'ar'];
  function seen() { return ls.get('ekw_seen') === '1'; }

  function count(box) {
    var own = box.querySelectorAll('button[data-l]').length;
    return own + (LANGS ? LANGS.length : 0);
  }

  function globe() {
    if (!LANGS || !LANGS.length) return;
    [].forEach.call(d.querySelectorAll('#langs,.ek-lang,.lsw'), function (box) {
      INSIDE.forEach(function (l) {
        var b = box.querySelector('button[data-l="' + l + '"]');
        if (b && b.style.display !== 'none') b.style.display = 'none';
      });
      var g = box.querySelector('.ekw-globe');
      if (!g) {
        g = d.createElement('button'); g.type = 'button'; g.className = 'ekw-globe';
        g.setAttribute('title', words().t); g.setAttribute('aria-label', words().t);
        g.innerHTML = GLOBE + '<b></b>';
        g.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          ls.set('ekw_seen', '1'); g.classList.remove('ekw-new');
          openPanel();
        });
        box.insertBefore(g, box.firstChild);          /* the same place /market/ keeps it */
      }
      g.querySelector('b').textContent = count(box);
      g.classList.toggle('ekw-new', !seen());
    });
  }

  /* leaving for one of the site's own four: drop the chosen language first */
  w.addEventListener('click', function (ev) {
    if (!ON) return;
    var b = ev.target.closest && ev.target.closest('button[data-l]');
    if (!b || !b.closest('#langs,.ek-lang,.lsw')) return;
    ls.set('ek_l', null);
  }, true);

  function boot() {
    style(); globe();
    /* the header rebuilds itself (the menu, the tab bar): put the globe back whenever it does */
    try {
      var mo = new MutationObserver(function () { if (!tick) tick = setTimeout(function () { tick = 0; globe(); }, 60); });
      [].forEach.call(d.querySelectorAll('#langs,.ek-lang,.lsw'), function (b) { mo.observe(b, { childList: true }); });
      if (d.body) mo.observe(d.body, { childList: true, subtree: true });
    } catch (e) { }
  }
  var tick = 0;
  fetch('/i18n/langs.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    LANGS = (j && j.ready) || [];
    FLAGS = (j && j.flags) || {};
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
