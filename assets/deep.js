/* entekhab.net — "Deep": what the depth layer does (the look is in assets/deep.css). Runs on every page except the
   homepage and the full-screen apps (the switch is in scripts/chrome.py). Five small parts, each on its own: if one
   cannot run, the page is exactly the page it was.

     1. arriving   — a block below the first screen rises into place the first time it is reached
     2. light      — a surface takes a little light where the pointer is (mouse only)
     3. progress   — a line under the top edge shows how far down a long page the reader is
     4. rail       — on wide screens, a rail of marks for the sections of a long page (click to go, hover to read)
     5. search     — Ctrl/⌘+K opens the site's search; while typing it lists sections, coins, terms, lessons, indicators, encyclopedia
   Nothing is stored and nothing is sent anywhere; the page index is the site's own /search.json. */
(function () {
  'use strict';
  var w = window, d = document, de = d.documentElement;
  if (!de.classList.contains('ek-deep') || w.ekDeep) return;
  w.ekDeep = { v: 1 };
  var RM = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function lite() { return de.classList.contains('nx-lite'); }
  function rtl() { return (de.getAttribute('dir') || '').toLowerCase() === 'rtl'; }
  function lang() {
    var l = (de.getAttribute('lang') || 'fa').toLowerCase();
    return (l.indexOf('ckb') === 0 || l === 'ku') ? 'ckb' : l.indexOf('en') === 0 ? 'en' : l.indexOf('ar') === 0 ? 'ar' : 'fa';
  }
  function T(o) { return o[lang()] || o.en; }
  function safe(f) { try { f(); } catch (e) { } }
  function debounce(f, ms) { var t; return function () { clearTimeout(t); t = setTimeout(f, ms); }; }

  /* the page's own content: <main>, or on the hand-written pages whatever stands between the header and the footer */
  function roots() {
    var m = d.querySelectorAll('main');
    if (m.length) return [].slice.call(m);
    var out = [], n = d.getElementById('ek-main');
    for (n = n && n.nextElementSibling; n; n = n.nextElementSibling) {
      if (n.id === 'ekb' || n.id === 'ekf') break;
      if (!/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(n.tagName)) out.push(n);
    }
    return out;
  }

  /* ---------------------------------------------------------------- 1. arriving */
  function arriving() {
    if (RM || lite() || !('IntersectionObserver' in w)) return;
    var vh = w.innerHeight, list = [];
    function skip(k) {
      if (/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT|DIALOG|BR|HR)$/.test(k.tagName) || k.hidden) return true;
      if (/^(ek|ds-)/.test(k.id || '') || /(^|\s)(modal|ek-credit)(\s|$)/.test(typeof k.className === 'string' ? k.className : '')) return true;
      var p = getComputedStyle(k).position;
      return p === 'fixed' || p === 'sticky';
    }
    function collect(el, depth) {
      for (var i = 0, ks = el.children; i < ks.length && list.length < 140; i++) {
        var k = ks[i], r = k.getBoundingClientRect();
        if ((!r.width && !r.height) || skip(k)) continue;
        if (r.top < vh * 0.94) {                       /* already (partly) in sight: leave it, but look inside a block that runs on below */
          if (depth < 2 && r.bottom > vh * 1.15 && k.children.length > 1) collect(k, depth + 1);
        } else if (depth < 2 && r.height > vh * 1.5 && k.children.length > 1) collect(k, depth + 1);   /* a very tall block arrives part by part */
        else list.push(k);
      }
    }
    roots().forEach(function (r) { collect(r, 0); });
    if (!list.length) return;
    var io = new IntersectionObserver(function (es) {
      var n = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, wait = Math.min(n++, 5) * 0.06;
        io.unobserve(el);
        el.style.setProperty('--ds-d', wait + 's');
        el.classList.add('ds-in');
        setTimeout(function () { el.classList.remove('ds-rv', 'ds-in'); el.style.removeProperty('--ds-d'); }, 950 + wait * 1000);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.04 });
    list.forEach(function (el) { el.classList.add('ds-rv'); io.observe(el); });
    /* a block that never meets the viewport (a tab that stays closed, a print) must never stay hidden */
    addEventListener('beforeprint', function () { list.forEach(function (el) { el.classList.remove('ds-rv', 'ds-in'); }); });
    w.ekDeep.shown = function () { list.forEach(function (el) { el.classList.remove('ds-rv', 'ds-in'); }); io.disconnect(); };
  }

  /* ---------------------------------------------------------------- 2. light under the pointer */
  var LIT = '.kpi,.rc-kpi,.card,.pulse>div,.gt,.lv,.tr-card,.oc-card,.dv-c,.lbc,.pc-ep,.mp-card,.td-k,.ac-kpi,.ibox,.nums>div,.fd,main details';
  function light() {
    if (lite() || !w.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var ev = null, raf = 0;
    function tick() {
      raf = 0;
      var t = ev && ev.target;
      if (!t || !t.closest) return;
      var c = t.closest(LIT);
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--ds-x', Math.round(ev.clientX - r.left) + 'px');
      c.style.setProperty('--ds-y', Math.round(ev.clientY - r.top) + 'px');
    }
    d.addEventListener('pointermove', function (e) { ev = e; if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  }

  /* ---------------------------------------------------------------- 3. progress */
  function progress() {
    var bar = d.createElement('div'), raf = 0;
    bar.id = 'ds-prog'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i>';
    d.body.appendChild(bar);
    var fill = bar.firstChild;
    function up() {
      raf = 0;
      var max = de.scrollHeight - w.innerHeight, y = w.pageYOffset || de.scrollTop || 0, long = max > w.innerHeight * 1.2;
      bar.classList.toggle('on', long && y > 12);
      if (long) fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, y / max)).toFixed(4) + ')';
    }
    function ask() { if (!raf) raf = requestAnimationFrame(up); }
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask, { passive: true });
    up();
  }

  /* ---------------------------------------------------------------- 4. rail of sections */
  function rail() {
    var el = null, heads = [], links = [], raf = 0, seq = 0;
    var NAME = { fa: 'بخش‌های این صفحه', ckb: 'بەشەکانی ئەم پەڕەیە', ar: 'أقسام هذه الصفحة', en: 'Sections of this page' };
    function find() {
      var out = [];
      roots().forEach(function (r) {
        [].forEach.call(r.querySelectorAll('h2'), function (h) {
          if (h.offsetParent === null || !h.textContent.replace(/\s+/g, '')) return;            /* hidden (another language, a closed tab) or empty */
          if (h.closest('details:not([open]),dialog,.modal,[hidden],[aria-hidden="true"]')) return;
          out.push(h);
        });
      });
      return out.slice(0, 22);
    }
    function mark() {
      raf = 0;
      if (!el) return;
      var on = -1, line = w.innerHeight * 0.34;
      for (var i = 0; i < heads.length; i++) if (heads[i].getBoundingClientRect().top < line) on = i;
      var f = d.getElementById('ekf');                      /* the rail belongs to the text: it steps aside when the footer comes up */
      el.classList.toggle('off', !!f && f.getBoundingClientRect().top < w.innerHeight * 0.78);
      links.forEach(function (a, i) { a.classList.toggle('on', i === on); if (i === on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    function build() {
      if (el) { el.remove(); el = null; }
      heads = []; links = [];
      if (w.innerWidth < 1100 || de.scrollHeight < w.innerHeight * 2.2) return;
      var hs = find();
      if (hs.length < 3) return;
      /* the rail lives in the free margin on the far side of the text; no margin, no rail */
      var box = (hs[0].closest('main') || roots()[0] || d.body).getBoundingClientRect();
      if ((rtl() ? box.left : w.innerWidth - box.right) < 70) return;
      el = d.createElement('nav'); el.id = 'ds-rail'; el.setAttribute('aria-label', T(NAME));
      hs.forEach(function (h) {
        if (!h.id) h.id = 'ds-s' + (++seq);
        var a = d.createElement('a'), s = d.createElement('span'), txt = h.textContent.replace(/\s+/g, ' ').trim();
        a.href = '#' + h.id; s.textContent = txt.length > 64 ? txt.slice(0, 62) + '…' : txt;
        a.appendChild(s); a.appendChild(d.createElement('i'));
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var head = parseFloat(getComputedStyle(de).getPropertyValue('--ekh')) || 76;
          w.scrollTo({ top: h.getBoundingClientRect().top + (w.pageYOffset || 0) - head - 22, behavior: RM ? 'auto' : 'smooth' });
        });
        el.appendChild(a); links.push(a);
      });
      heads = hs;
      d.body.appendChild(el);
      mark();
    }
    var again = debounce(build, 220);
    addEventListener('scroll', function () { if (el && !raf) raf = requestAnimationFrame(mark); }, { passive: true });
    addEventListener('resize', again, { passive: true });
    addEventListener('load', function () { setTimeout(build, 900); });          /* pages that draw themselves from data are taller by then */
    try { new MutationObserver(again).observe(de, { attributes: true, attributeFilter: ['lang', 'dir'] }); } catch (e) { }
    build();
  }

  /* ---------------------------------------------------------------- 5. search that answers while you type */
  function search() {
    var Q = null, box = null, ul = null, inp = null, idx = null, site = null, asked = false, sel = -1;
    var L = {
      arch: { fa: 'جستجو در آرشیو پست‌ها', ckb: 'گەڕان لە ئەرشیڤی پۆستەکان', ar: 'ابحث في أرشيف المنشورات', en: 'Search the post archive' },
      coin: { fa: 'صفحهٔ کوین: قیمت، تحلیل و پست‌ها', ckb: 'پەڕەی دراو: نرخ، شیکاری و پۆستەکان', ar: 'صفحة العملة: السعر والتحليل والمنشورات', en: 'Coin page: price, analysis and posts' },
      list: { fa: 'نتیجه‌ها', ckb: 'ئەنجامەکان', ar: 'النتائج', en: 'Results' },
      sec: { fa: 'بخش‌های سایت', ckb: 'بەشەکانی ماڵپەڕ', ar: 'أقسام الموقع', en: 'Sections' },
      coins: { fa: 'کوین‌ها', ckb: 'دراوەکان', ar: 'العملات', en: 'Coins' },
      term: { fa: 'واژه‌نامه', ckb: 'فەرهەنگ', ar: 'المعجم', en: 'Glossary' },
      lesson: { fa: 'درس‌های آکادمی', ckb: 'وانەکانی ئەکادیمیا', ar: 'دروس الأكاديمية', en: 'Academy lessons' },
      enc: { fa: 'دانشنامه', ckb: 'ئینسایکلۆپیدیا', ar: 'الموسوعة', en: 'Encyclopedia' },
      ind: { fa: 'اندیکاتورها', ckb: 'ئیندیکاتۆرەکان', ar: 'المؤشرات', en: 'Indicators' },
      dna: { fa: 'DNA ارزها', ckb: 'DNAی دراوەکان', ar: 'DNA العملات', en: 'Coin DNA' },
      more: { fa: 'همه', ckb: 'هەموو', ar: 'الكل', en: 'All' }
    };
    /* one spelling for matching: Arabic/Persian/Kurdish letter variants, no joiners or marks, Latin in lower case */
    function norm(s) {
      return String(s || '').toLowerCase().replace(/[ً-ٰٟ‌‍ـ]/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
        .replace(/[ھە]/g, 'ه').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
    }
    function index() {
      var seen = {}, out = [];
      [].forEach.call(d.querySelectorAll('#ekh .ek-it,#ekf .ekf-col a,#ekf .ekf-lg a'), function (a) {
        var h = a.getAttribute('href');
        if (!h || h.charAt(0) === '#' || seen[h]) return;
        var t = a.querySelector('.ek-tt') || a.querySelector('.ek-i') || a, s = a.querySelector('.ek-ds'), ds = t.dataset || {}, dd = (s && s.dataset) || {};
        seen[h] = 1;
        out.push({ h: h, a: a, t: t, s: s, k: norm([h.replace(/[\/-]/g, ' '), ds.fa, ds.ckb, ds.en, t.textContent].join(' ')), k2: s ? norm([dd.fa, dd.ckb, dd.en, s.textContent].join(' ')) : '' });
      });
      return out;
    }
    function row(href, title, sub, cls, ext) {
      var li = d.createElement('li'), a = d.createElement('a'), b = d.createElement('b'), sm = d.createElement('small'), k = d.createElement('kbd');
      li.setAttribute('role', 'option'); if (cls) li.className = cls;
      a.href = href; if (ext) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      b.textContent = title; sm.textContent = sub || ''; k.textContent = '↵';
      a.appendChild(b); a.appendChild(sm); a.appendChild(k); li.appendChild(a);
      return li;
    }
    function pick(n) {
      var items = ul.querySelectorAll('li[role=option]');
      sel = n < -1 ? items.length - 1 : n >= items.length ? -1 : n;
      for (var i = 0; i < items.length; i++) { items[i].classList.toggle('on', i === sel); items[i].setAttribute('aria-selected', i === sel ? 'true' : 'false'); }
      if (sel >= 0 && items[sel].scrollIntoView) items[sel].scrollIntoView({ block: 'nearest' });
    }
    function head(lb, n) {
      var li = d.createElement('li'); li.className = 'ds-qh'; li.setAttribute('role', 'presentation');
      li.textContent = T(lb) + (n > 0 ? ' · ' + n : '');
      ul.appendChild(li);
    }
    function render() {
      var raw = (inp.value || '').trim().slice(0, 80), q = norm(raw);
      ul.textContent = ''; sel = -1;
      if (q.length < 2) { box.classList.remove('on'); return; }
      idx = idx || index();
      var toks = q.split(' '), hits = [];
      idx.forEach(function (it, n) {
        var sc = 0;
        for (var i = 0; i < toks.length; i++) {
          if (it.k.indexOf(toks[i]) >= 0) sc += 3; else if (it.k2.indexOf(toks[i]) >= 0) sc += 1; else { sc = 0; break; }
        }
        if (sc) hits.push({ it: it, sc: sc + (it.k.indexOf(q) >= 0 ? 2 : 0), n: n });
      });
      hits.sort(function (a, b) { return b.sc - a.sc || a.n - b.n; });
      /* the site's own pages, by kind: /search.json (scripts/build_links.py), loaded once */
      var groups = { coin: [], term: [], lesson: [], enc: [], ind: [], dna: [] };
      if (site) site.forEach(function (r, n) {
        var sc = 0;
        for (var i = 0; i < toks.length; i++) {
          if (r.n.indexOf(toks[i]) >= 0) sc += 3; else if (r.a.indexOf(toks[i]) >= 0) sc += 1; else { sc = 0; break; }
        }
        if (!sc) return;
        if (r.n === q) sc += 6; else if (r.n.indexOf(q) === 0) sc += 3;
        if (groups[r.t]) groups[r.t].push({ r: r, sc: sc, n: n });
      });
      var per = q.length < 3 ? 3 : 4;
      if (hits.length) { head(L.sec, 0); hits.slice(0, 4).forEach(function (h) { var it = h.it; ul.appendChild(row(it.h, it.t.textContent.trim(), it.s ? it.s.textContent.trim() : '', '', /^https?:/.test(it.h))); }); }
      ['coin', 'term', 'lesson', 'ind', 'dna', 'enc'].forEach(function (k) {
        var g = groups[k];
        if (!g.length) return;
        g.sort(function (a, b) { return b.sc - a.sc || a.n - b.n; });
        head(L[k === 'coin' ? 'coins' : k], g.length);
        g.slice(0, per).forEach(function (h) { ul.appendChild(row(h.r.u, h.r.N, h.r.A, k === 'coin' ? 'ds-qc' : '')); });
      });
      head(L.more, 0);
      ul.appendChild(row('/?q=' + encodeURIComponent(raw), '«' + raw + '»', T(L.arch), 'ds-qa'));
      ul.setAttribute('aria-label', T(L.list));
      box.classList.add('on');
    }
    function hook() {
      Q = d.getElementById('ekq');
      if (!Q || Q.dsHook) return;
      inp = Q.querySelector('input'); var form = Q.querySelector('form');
      if (!inp || !form) return;
      Q.dsHook = 1;
      box = d.createElement('div'); box.className = 'ds-qr'; ul = d.createElement('ul'); ul.setAttribute('role', 'listbox'); box.appendChild(ul);
      form.parentNode.insertBefore(box, form.nextSibling);
      inp.addEventListener('input', render);
      inp.addEventListener('keydown', function (e) {
        if (!box.classList.contains('on')) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); pick(sel + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); pick(sel - 1); }
        else if (e.key === 'Enter' && sel >= 0) { var o = ul.querySelectorAll('li[role=option]')[sel], a = o && o.querySelector('a'); if (a) { e.preventDefault(); a.click(); } }
      });
      if (!asked) {                                         /* the site's own index of pages, fetched once, the first time search is opened */
        asked = true;
        safe(function () {
          fetch('/search.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
            if (!j || !j.r) return;
            site = j.r.map(function (x) { return { t: x[0], u: x[1], N: x[2], A: x[3] || '', n: norm(x[2]), a: norm(x[3] || '') }; });
            if (inp.value) render();
          }).catch(function () { });
        });
      }
      if (inp.value) render();
    }
    /* the site builds its search box the first time it is opened (assets/chrome.js); the results list joins it then */
    hook();
    if (!Q || !Q.dsHook) safe(function () {
      var mo = new MutationObserver(function () { hook(); if (Q && Q.dsHook) mo.disconnect(); });
      mo.observe(d.body, { childList: true });
    });
    d.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K')) {
        if (w.ekChrome && w.ekChrome.openSearch) { e.preventDefault(); w.ekChrome.openSearch(); }
      }
    });
  }

  /* ---------------------------------------------------------------- 6. a moving picture behind the top of some pages
     The owner's own clips (assets/bg/): 000 — lines of light running to the floor, for the pages that test claims
     against data; 006 — a reader turning into what he reads, for the academy. They sit behind the first screen only,
     fade into the page, never carry sound, and stay a still picture on a slow or lite device, when the visitor asked for
     less motion or for less data (Save-Data), and while the tab is hidden. */
  var BANDS = [
    { re: /^\/(track-record|reality|ledger|iran-friction|hype|silent-exit|iran-correlation)(\/|$)/, v: '000', cls: 'beam' },
    { re: /^\/academy\/?$/, v: '006', cls: 'reader' }
  ];
  function band() {
    var p = location.pathname, b = null;
    for (var i = 0; i < BANDS.length; i++) if (BANDS[i].re.test(p)) { b = BANDS[i]; break; }
    if (!b) return;
    var still = RM || lite() || !!(navigator.connection && navigator.connection.saveData);
    var wrap = d.createElement('div'); wrap.className = 'ds-band ds-' + b.cls; wrap.setAttribute('aria-hidden', 'true');
    var v = d.createElement('video');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.preload = 'none'; v.poster = '/assets/bg/' + b.v + '.jpg'; v.disablePictureInPicture = true; v.tabIndex = -1;
    wrap.appendChild(v);
    d.body.insertBefore(wrap, d.body.firstChild);
    de.classList.add('ds-has-band');
    if (still) return;
    function go() {
      if (!v.src) { v.src = '/assets/bg/' + b.v + '.mp4'; }
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () { });
    }
    d.addEventListener('visibilitychange', function () { if (d.hidden) v.pause(); else if (v.src) go(); });
    if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { if (w.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 400); } else if (v.src) v.pause(); }); }).observe(wrap);
    else setTimeout(go, 800);
  }

  /* ---------------------------------------------------------------- 7. a title that ripples under the pointer ([data-ds-ripple], mouse only) */
  function ripple() {
    var els = d.querySelectorAll('[data-ds-ripple]');
    if (!els.length || RM || lite() || !w.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var ns = 'http://www.w3.org/2000/svg', svg = d.createElementNS(ns, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.position = 'absolute';
    svg.innerHTML = '<filter id="ds-rip" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="2" seed="3" result="n"/>'
      + '<feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
    d.body.appendChild(svg);
    var dm = svg.querySelector('feDisplacementMap'), tb = svg.querySelector('feTurbulence'), amp = 0, target = 0, raf = 0, t = 0;
    function tick() {
      amp += (target - amp) * 0.12; t += 0.02;
      dm.setAttribute('scale', amp.toFixed(2));
      tb.setAttribute('baseFrequency', (0.012 + Math.sin(t) * 0.004).toFixed(4) + ' ' + (0.06 + Math.cos(t * 1.3) * 0.015).toFixed(4));
      if (amp > 0.05 || target > 0) raf = requestAnimationFrame(tick); else { raf = 0; dm.setAttribute('scale', '0'); }
    }
    [].forEach.call(els, function (el) {
      el.style.filter = 'url(#ds-rip)';
      var last = 0;
      el.addEventListener('pointermove', function (e) { var sp = Math.min(1, Math.abs(e.movementX || 0) / 18 + 0.35); target = 16 * sp; last = Date.now(); if (!raf) raf = requestAnimationFrame(tick); setTimeout(function () { if (Date.now() - last > 140) target = 0; }, 160); });
      el.addEventListener('pointerleave', function () { target = 0; });
    });
  }

  function start() { [band, arriving, light, progress, rail, search, ripple].forEach(safe); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
