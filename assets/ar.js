/* entekhab.net — Arabic (Modern Standard). The site is built in Persian, Sorani and English; in Arabic the reader
   gets the English page, translated here string by string from the dictionaries scripts/i18n_ar.py writes
   (/i18n/ar/common.json, /i18n/ar/page/<page>.json, /i18n/ar/js/<script>.json). Numbers in a text are matched as
   {1}, {2}…, so "2,191 transactions" uses the entry "{1} transactions"; text the scripts write later is translated
   as it appears. Recent posts have real Arabic pages (/ar/p/<id>/); the encyclopedia stays in its three languages.
   A string with no entry yet stays in English (the dictionaries fill as the site's runs translate them). */
(function () {
  'use strict';
  var d = document, de = d.documentElement, w = window;
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } } };
  var PATH = location.pathname, ENC = /^\/encyclopedia\//.test(PATH), AR_PAGE = (de.getAttribute('lang') || '') === 'ar';
  var PUBLIC = !!d.querySelector('#langs button[data-l="ar"]:not([hidden])') || ls.get('ek_ar_test') === '1';
  var ON = ls.get('ek_ar') === '1' || AR_PAGE;

  /* ---- the switch: «ع» next to فا / کو / EN */
  function buttons() {
    if (!PUBLIC) return;
    [].forEach.call(d.querySelectorAll('#langs,.ek-lang,.lsw'), function (box) {
      var b = box.querySelector('button[data-l="ar"]');
      if (!b) { b = d.createElement('button'); b.type = 'button'; b.setAttribute('data-l', 'ar'); b.setAttribute('lang', 'ar'); b.textContent = box.classList.contains('lsw') ? 'العربية' : 'ع'; box.appendChild(b); }
      b.hidden = false;
      if (ON) [].forEach.call(box.querySelectorAll('button[data-l]'), function (x) { x.classList.toggle('on', x.getAttribute('data-l') === 'ar'); });
    });
  }
  function alt(l) { var a = d.querySelector('link[rel="alternate"][hreflang="' + l + '"]'); return a && a.getAttribute('href'); }
  function go(href) { try { var u = new URL(href, location.href); if (u.pathname !== location.pathname) { location.href = u.href; return true; } } catch (e) { } return false; }
  w.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button[data-l]'); if (!b || !b.closest('#langs,.ek-lang,.lsw')) return;
    var l = b.getAttribute('data-l');
    if (l === 'ar') {
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (ON && !AR_PAGE) return;
      ls.set('ek_ar', '1'); ls.set('ck_lang', 'en');
      if (go(alt('ar') || alt('en') || location.href)) return;
      location.reload();
    } else if (ON) {   /* leaving Arabic: the page reloads in the chosen language (its English copy was rewritten) */
      ev.preventDefault(); ev.stopImmediatePropagation();
      ls.set('ek_ar', null); ls.set('ck_lang', l);
      if (go(alt(l) || (AR_PAGE ? '/p/' + (PATH.match(/\/p\/([^/]+)/) || [])[1] + '/' : location.href))) return;
      location.reload();
    }
  }, true);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', buttons); else buttons();
  if (!ON) return;

  function unwait() { de.classList.remove('ek-ar-wait'); }
  function toast(m) {
    var t = d.createElement('div'); t.className = 'ek-rd-toast on'; t.setAttribute('role', 'status'); t.dir = 'rtl'; t.lang = 'ar'; t.textContent = m;
    d.body.appendChild(t); setTimeout(function () { t.classList.remove('on'); }, 6000);
  }
  if (ENC) { de.classList.remove('ek-ar'); de.dir = de.lang === 'en' ? 'ltr' : de.dir; unwait(); toast('الموسوعة متاحة بالفارسية والكردية والإنجليزية فقط.'); return; }
  /* a post: its Arabic page when there is one, otherwise its English one */
  if (!AR_PAGE && /\/p\/[^/]+\/?$/.test(PATH)) { var to = alt('ar') || (de.lang !== 'en' && alt('en')); if (to && go(to)) return; }

  de.classList.add('ek-ar'); de.dir = 'rtl';
  var st = d.createElement('style');
  st.textContent = 'html.ek-ar body{font-family:Vazirmatn,Tahoma,"Segoe UI",sans-serif}html.ek-ar [data-l="ar"]{font-family:Vazirmatn,Tahoma,sans-serif}';
  d.head.appendChild(st);

  /* ---- the dictionaries */
  var M = {}, TP = [], memo = {}, nmemo = 0;
  function key(u) { u = u.replace(/^\/+|\/+$/g, '') || 'home'; return u.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 120); }
  var page = PATH.replace(/index\.html$/, '').replace(/\.html$/, '');
  var urls = ['/i18n/ar/common.json', '/i18n/ar/page/' + key(page) + '.json'];
  [].forEach.call(d.querySelectorAll('script[src^="/assets/"]'), function (s) { var m = s.getAttribute('src').match(/^\/assets\/([\w.-]+)\.js/); if (m && m[1] !== 'ar') urls.push('/i18n/ar/js/' + m[1] + '.json'); });
  var NUM = /(^|[^A-Za-z{0-9])(\d[\d,]*(?:\.\d+)?)/g;
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function add(dict) {
    for (var k in dict) {
      if (M[k]) continue; M[k] = dict[k];
      if (/\{\d+\}/.test(k) && /[A-Za-z]{2}/.test(k.replace(/\{\d+\}/g, ''))) {
        var order = [], re = esc(k).replace(/\\\{(\d+)\\\}/g, function (m, n) { order.push(+n); return '(.+?)'; });
        try { TP.push([new RegExp('^' + re + '$'), dict[k], order]); } catch (e) { }
      }
    }
  }
  function fill(a, vals) { return a.replace(/\{(\d+)\}/g, function (m, i) { return vals[i - 1] != null ? vals[i - 1] : m; }); }
  function look(t) {
    var nums = [], k = t.replace(NUM, function (m, p, n) { nums.push(n); return p + '{' + nums.length + '}'; });
    if (M[k]) return fill(M[k], nums);
    for (var i = 0; i < TP.length; i++) { var m = TP[i][0].exec(t); if (m) { var v = []; for (var j = 0; j < TP[i][2].length; j++) v[TP[i][2][j] - 1] = m[j + 1]; return fill(TP[i][1], v); } }
    return null;
  }
  /* dates and times the scripts write ("3 h ago", "12 Nov 26, 11:13", "Nov 12, 2026") */
  var MON = { Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل', May: 'مايو', Jun: 'يونيو', Jul: 'يوليو', Aug: 'أغسطس', Sep: 'سبتمبر', Sept: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر',
    January: 'يناير', February: 'فبراير', March: 'مارس', April: 'أبريل', June: 'يونيو', July: 'يوليو', August: 'أغسطس', September: 'سبتمبر', October: 'أكتوبر', November: 'نوفمبر', December: 'ديسمبر' };
  var UNIT = { s: 'ثانية', sec: 'ثانية', m: 'دقيقة', min: 'دقيقة', mins: 'دقيقة', h: 'ساعة', hr: 'ساعة', hrs: 'ساعة', d: 'يوم', day: 'يوم', days: 'يوم', w: 'أسبوع', mo: 'شهر', y: 'سنة' };
  function rules(t) {
    var r = t, hit = false;
    r = r.replace(/\b(\d+)\s?(s|sec|m|min|mins|h|hr|hrs|d|day|days|w|mo|y)\b( ago)?/g, function (m, n, u, ago) { hit = true; return ago ? 'قبل ' + n + ' ' + UNIT[u] : n + ' ' + UNIT[u]; });
    r = r.replace(/\b(January|February|March|April|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b/g, function (m) { hit = true; return MON[m]; });
    r = r.replace(/\bjust now\b/gi, function () { hit = true; return 'الآن'; }).replace(/\bUpdated:/g, function () { hit = true; return 'آخر تحديث:'; });
    return hit && !/[A-Za-z]{3}/.test(r.replace(/UTC|GMT|BTC|ETH|USD|USDT|USDC/g, '')) ? r : null;
  }
  var EDGE = /^[^A-Za-z0-9{$£€]+|[\s:·↗↓→←…]+$/g;
  function tr(raw) {
    var t = raw.replace(/\s+/g, ' ').trim();
    if (!t || t.length > 4000 || !/[A-Za-z]{2}/.test(t)) return null;
    if (memo.hasOwnProperty(t)) return memo[t];
    var r = look(t);
    if (r == null) {   /* an emoji or bullet in front, a colon or arrow behind */
      var core = t.replace(EDGE, '');
      if (core && core !== t) { var c = look(core); if (c != null) { var i0 = t.indexOf(core); r = t.slice(0, i0) + c + t.slice(i0 + core.length); } }
    }
    if (r == null && t.indexOf(' · ') > 0) {   /* "Block #975,541 · 2,077 tx": each part on its own */
      var parts = t.split(' · '), any = false;
      for (var j = 0; j < parts.length; j++) { var q = look(parts[j].replace(EDGE, '')) || rules(parts[j]); if (q != null) { var c0 = parts[j].replace(EDGE, ''), i1 = parts[j].indexOf(c0); parts[j] = c0 && !rules(parts[j]) ? parts[j].slice(0, i1) + q + parts[j].slice(i1 + c0.length) : q; any = true; } }
      if (any) r = parts.join(' · ');
    }
    if (r == null) r = rules(t);
    if (nmemo++ > 20000) { memo = {}; nmemo = 0; }
    return (memo[t] = r);
  }

  /* ---- the page */
  var SKIP = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1, NOSCRIPT: 1, KBD: 1 };
  function ok(el) {
    for (var e = el; e && e !== d.body; e = e.parentNode) {
      if (e.nodeType !== 1) continue;
      if (SKIP[e.tagName] || e.getAttribute('translate') === 'no' || e.classList.contains('notranslate')) return false;
      var lg = e.getAttribute('lang'); if (lg) return lg === 'en' || lg === 'ar';
    }
    return true;
  }
  var ATTR = ['placeholder', 'title', 'aria-label', 'alt'];
  function textNode(n) {
    var v = n.nodeValue; if (!v || !/[A-Za-z]/.test(v) || !ok(n.parentNode)) return;
    var r = tr(v); if (r == null) return;
    var lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
    n.nodeValue = lead + r + trail;
  }
  function el(e) {
    if (e.nodeType !== 1 || !ok(e)) return;
    for (var i = 0; i < ATTR.length; i++) { var v = e.getAttribute(ATTR[i]); if (v && /[A-Za-z]/.test(v)) { var r = tr(v); if (r != null) e.setAttribute(ATTR[i], r); } }
    if (e.getAttribute('dir') === 'ltr' && (e.getAttribute('lang') === 'en' || e.getAttribute('data-lang') === 'en' || e.getAttribute('data-rl') === 'en')) { e.setAttribute('dir', 'rtl'); e.setAttribute('lang', 'ar'); }
  }
  function walk(root) {
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1) return;
    el(root);
    var it = d.createTreeWalker(root, 5, null), n;   /* elements and text */
    while ((n = it.nextNode())) { if (n.nodeType === 3) textNode(n); else el(n); }
  }
  var pend = [], sched = 0;
  function flush() {
    sched = 0; var p = pend; pend = [];
    for (var i = 0; i < p.length; i++) if (p[i].isConnected) walk(p[i]);
    if (de.dir !== 'rtl') de.dir = 'rtl';
    buttons();
  }
  function queue(n) { pend.push(n); if (!sched) sched = (w.requestAnimationFrame || setTimeout)(flush); }
  function title() { var r = tr(d.title); if (r) d.title = r; }

  Promise.all(urls.map(function (u) { return fetch(u).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); })).then(function (all) {
    all.forEach(add);
    walk(d.body); title(); buttons(); unwait();
    /* the latest headlines and post titles: after the page itself, so they never hold it up */
    fetch('/i18n/ar/feed.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (f) { add(f); memo = {}; walk(d.body); }).catch(function () { });
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'characterData') queue(m.target);
        else if (m.type === 'attributes') queue(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) queue(m.addedNodes[j]);
      }
    }).observe(d.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR.concat(['data-lang', 'hidden']) });
    new MutationObserver(function () { if (de.dir !== 'rtl') de.dir = 'rtl'; title(); }).observe(de, { attributes: true, attributeFilter: ['dir', 'lang'] });
    var tt = d.querySelector('title'); if (tt) new MutationObserver(title).observe(tt, { childList: true });
  });
})();
