/* entekhab.net — interface v2 (preview): floating header island, full-screen menu, homepage sections as full-screen panels.
   Runs only when <html> carries .ek-v2 (set before first paint by the switch in scripts/chrome.py, UI2).
   It builds on the shared chrome that is already in the page (#ekh header, #ekb tab bar, #ekf footer): the menu is made
   from the header's own links, so every address stays where it was and nothing is fetched to open it.
   No library; plain CSS transitions. With "reduce motion" everything simply appears. */
(function () {
  'use strict';
  var d = document, de = d.documentElement, w = window;
  if (!de.classList.contains('ek-v2')) return;
  var RM = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var FINE = !!(w.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches);
  var DESK = w.matchMedia ? matchMedia('(min-width:900px)') : { matches: true };
  var H, B, M = null, opener = null, afterClose = null, deckSync = null, restInk = function () { };
  var IC = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    q: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lang() {
    var b = d.querySelector('#langs button.on'), l = b ? b.getAttribute('data-l') : (de.getAttribute('lang') || 'fa').toLowerCase();
    return (l.indexOf('ckb') === 0 || l === 'ku') ? 'ckb' : l.indexOf('en') === 0 ? 'en' : 'fa';
  }
  function pick(fa, ckb, en) { return { fa: fa, ckb: ckb, en: en }[lang()]; }
  function tri(fa, ckb, en, tag, cls) {
    tag = tag || 'span';
    return '<' + tag + ' class="ek-i' + (cls ? ' ' + cls : '') + '" data-fa="' + esc(fa) + '" data-ckb="' + esc(ckb) + '" data-en="' + esc(en) + '">' + esc(pick(fa, ckb, en)) + '</' + tag + '>';
  }
  function dg(n) { var l = lang(), z = l === 'fa' ? '۰۱۲۳۴۵۶۷۸۹' : l === 'ckb' ? '٠١٢٣٤٥٦٧٨٩' : null; return z ? String(n).replace(/\d/g, function (c) { return z.charAt(+c); }) : String(n); }
  function norm(t) { return String(t || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[ً-ٰٟ‌‍]/g, ''); }
  /* everything except the open layer is taken out of reach of keyboard and screen readers */
  function setInert(keep, on, only) {
    [].forEach.call(only || d.body.children, function (c) {
      if (c === keep || c.tagName === 'SCRIPT' || c.id === 'ekpv') return;
      if (on) { if (!c.inert) { c.inert = true; c.setAttribute('data-eki', ''); } }
      else if (c.hasAttribute('data-eki')) { c.inert = false; c.removeAttribute('data-eki'); }
    });
  }
  function lock(on) {
    if (on && !de.classList.contains('ek-lock')) { var sb = w.innerWidth - de.clientWidth; de.style.setProperty('--u-sb', (sb > 0 ? sb : 0) + 'px'); }
    de.classList.toggle('ek-lock', !!on);
  }
  function trap(box, e) {   /* browsers without `inert`: keep Tab inside the layer */
    if (e.key !== 'Tab') return;
    var f = [].filter.call(box.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'), function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && d.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && d.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  /* a link chosen inside a layer replaces the layer's own history entry, so Back returns to the page, not to a closed layer */
  function go(href) { try { if (history.state && history.state.ek) { location.replace(href); return; } } catch (e) { } location.href = href; }
  function plain(e) { return !(e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey); }

  /* ================================================================== header island */
  function island() {
    var nav = H.querySelector('.ek-nav'), tools = H.querySelector('.ek-tools');
    if (!tools) return;
    var mb = d.createElement('button'); mb.type = 'button'; mb.className = 'ek-menu';
    mb.setAttribute('aria-haspopup', 'dialog'); mb.setAttribute('aria-expanded', 'false'); mb.setAttribute('aria-controls', 'ekm');
    mb.setAttribute('data-afa', 'منو'); mb.setAttribute('data-ackb', 'مێنیو'); mb.setAttribute('data-aen', 'Menu');   /* on phones the word is hidden: the name stays */
    mb.innerHTML = tri('منو', 'مێنیو', 'Menu') + '<i class="ek-bars" aria-hidden="true"><b></b><b></b></i>';
    tools.appendChild(mb);
    mb.addEventListener('click', function () { openMenu(null, mb); });
    var lg = d.createElement('button'); lg.type = 'button'; lg.className = 'ek-ib ek-lg1';
    lg.setAttribute('data-afa', 'زبان'); lg.setAttribute('data-ackb', 'زمان'); lg.setAttribute('data-aen', 'Language');
    tools.insertBefore(lg, tools.firstChild);
    lg.addEventListener('click', function () { openMenu(null, lg, true); });
    /* the top-level items open the same full-screen menu on their own category (the old drop-down panels are hidden) */
    H.addEventListener('click', function (e) {
      var bt = e.target.closest && e.target.closest('.ek-mt'); if (!bt) return;
      e.preventDefault(); e.stopPropagation(); openMenu(bt.parentNode.getAttribute('data-k'), bt);
    }, true);
    d.addEventListener('mouseenter', function (e) { var t = e.target; if (t && t.nodeType === 1 && t.classList.contains('ek-mi')) e.stopPropagation(); }, true);
    /* one highlight that slides to the item under the pointer and rests on the current section */
    if (nav && FINE) {
      var ink = d.createElement('i'); ink.className = 'ek-ink'; ink.setAttribute('aria-hidden', 'true'); nav.insertBefore(ink, nav.firstChild);
      var first = true;
      var move = function (el) {
        var a = el.getBoundingClientRect(), b = nav.getBoundingClientRect();
        if (first) { ink.style.transition = 'none'; first = false; setTimeout(function () { ink.style.transition = ''; }, 40); }
        ink.style.width = a.width + 'px'; ink.style.transform = 'translateX(' + (a.left - b.left) + 'px)'; ink.style.opacity = 1;
      };
      restInk = function () { var a = nav.querySelector('.ek-mi.on>.ek-mt,.ek-ml.on'); if (a && a.offsetParent) move(a); else ink.style.opacity = 0; };
      nav.addEventListener('pointerover', function (e) { var t = e.target.closest && e.target.closest('.ek-mt,.ek-ml'); if (t) move(t); });
      nav.addEventListener('pointerleave', restInk);
      nav.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('.ek-mt,.ek-ml'); if (t) move(t); });
      nav.addEventListener('focusout', function () { setTimeout(function () { if (!nav.contains(d.activeElement)) restInk(); }, 0); });
      H.addEventListener('transitionend', function (e) { if (e.propertyName === 'max-width') restInk(); });
      w.addEventListener('resize', restInk);
      restInk(); setTimeout(restInk, 600);
      if (d.fonts && d.fonts.ready) d.fonts.ready.then(restInk);
    }
    if (B) B.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.ek-all'); if (!a) return;
      e.preventDefault(); e.stopPropagation(); openMenu(null, a);
    }, true);
  }

  /* ================================================================== full-screen menu */
  var PH = { fa: 'نام ابزار، صفحه یا موضوع را بنویس…', ckb: 'ناوی ئامراز، پەڕە یان بابەت بنووسە…', en: 'Type a tool, page or topic…' };
  var index = [], cats = [], panes = {}, curK = null, hov = null;
  function buildMenu() {
    M = d.createElement('div'); M.id = 'ekm'; M.setAttribute('role', 'dialog'); M.setAttribute('aria-modal', 'true');
    var groups = [].slice.call(H.querySelectorAll('.ek-mi')), cl = '', pl = '', i = 0;
    groups.forEach(function (g) {
      var k = g.getAttribute('data-k'), t = g.querySelector('.ek-mt .ek-i'), its = g.querySelectorAll('.ek-it'), mg = g.querySelector('.ek-mg');
      if (!k || !t || !mg) return;
      cl += '<button type="button" class="ekm-cat" data-k="' + esc(k) + '" aria-expanded="false" aria-controls="ekm-p-' + esc(k) + '" style="--i:' + (i++) + '">' +
        tri(t.getAttribute('data-fa'), t.getAttribute('data-ckb'), t.getAttribute('data-en'), 'span', 'ekm-ct') + '<small data-n="' + its.length + '"></small></button>';
      pl += '<div class="ekm-pane" id="ekm-p-' + esc(k) + '" data-k="' + esc(k) + '"><div class="ekm-pi' + (its.length > 9 ? ' many' : '') + '">' + mg.innerHTML + '</div></div>';
    });
    var hot = H.querySelector('.ek-ml.ek-hot');
    if (hot) cl += '<a class="ekm-cat ekm-hot" href="' + esc(hot.getAttribute('href')) + '" style="--i:' + (i++) + '">' + hot.innerHTML + '</a>';
    var brand = H.querySelector('.ek-brand'), apps = d.querySelector('#ekf .ekf-apps'), soc = d.querySelector('#ekf .ekf-soc');
    M.innerHTML = '<div class="ekm-bg"></div><div class="ekm-in">' +
      '<div class="ekm-top">' + (brand ? brand.outerHTML : '') +
      '<form class="ekm-q" role="search" action="/" method="get">' + IC.q + '<input type="search" name="q" autocomplete="off" enterkeyhint="search" maxlength="80" data-afa="جستجو در منو" data-ackb="گەڕان لە مێنیو" data-aen="Search the menu"></form>' +
      '<button type="button" class="ekm-x">' + tri('بستن', 'داخستن', 'Close') + IC.x + '</button></div>' +
      '<div class="ekm-main"><div class="ekm-cats">' + cl + '</div><div class="ekm-panes">' + pl +
      '<div class="ekm-pane ekm-res" id="ekm-res"><div class="ekm-pi"></div></div></div></div>' +
      '<div class="ekm-foot"><div class="ekm-lang" role="group"><button type="button" data-l="fa" lang="fa">فارسی</button>' +
      '<button type="button" data-l="ckb" lang="ckb">کوردی</button><button type="button" data-l="en" lang="en">English</button></div>' +
      (apps ? '<div class="ekm-apps">' + apps.innerHTML + '</div>' : '') + (soc ? '<div class="ekm-soc">' + soc.innerHTML + '</div>' : '') + '</div></div>';
    d.body.appendChild(M);
    cats = [].slice.call(M.querySelectorAll('.ekm-cat[data-k]'));
    [].forEach.call(M.querySelectorAll('.ekm-pane[data-k]'), function (p) {
      panes[p.getAttribute('data-k')] = p;
      [].forEach.call(p.querySelectorAll('.ek-it'), function (a, n) {
        a.style.setProperty('--i', n);
        var s = a.querySelectorAll('.ek-i'), txt = '';
        [].forEach.call(s, function (x) { txt += ' ' + x.getAttribute('data-fa') + ' ' + x.getAttribute('data-ckb') + ' ' + x.getAttribute('data-en'); });
        index.push({ a: a, t: norm(txt + ' ' + a.getAttribute('href')) });
      });
    });
    [].forEach.call(M.querySelectorAll('img[loading]'), function (im) { im.removeAttribute('loading'); });

    M.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('.ekm-x')) { closeMenu(); return; }
      var c = t.closest('.ekm-cat[data-k]');
      if (c) { var k = c.getAttribute('data-k'); if (!DESK.matches && curK === k && !M.classList.contains('q')) activate(null); else { clearQ(); activate(k); } return; }
      var lb = t.closest('.ekm-lang button[data-l]');
      if (lb) { var l = lb.getAttribute('data-l'); closeMenu(function () { var o = d.querySelector('#langs button[data-l="' + l + '"]'); if (o) o.click(); }); return; }
      var a = t.closest('a[href]');
      if (a && plain(e) && a.target !== '_blank') { e.preventDefault(); go(a.href); }
    });
    if (FINE) cats.forEach(function (c) {
      c.addEventListener('pointerenter', function () { if (!DESK.matches || M.classList.contains('q')) return; clearTimeout(hov); hov = setTimeout(function () { activate(c.getAttribute('data-k')); }, 70); });
      c.addEventListener('pointerleave', function () { clearTimeout(hov); });
    });
    M.addEventListener('focusin', function (e) { var c = e.target.closest && e.target.closest('.ekm-cat[data-k]'); if (c && DESK.matches && !M.classList.contains('q')) activate(c.getAttribute('data-k')); });
    M.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
      trap(M, e);
      var c = e.target.closest && e.target.closest('.ekm-cat');
      if (c && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        var all = [].slice.call(M.querySelectorAll('.ekm-cat')), n = all.indexOf(c) + (e.key === 'ArrowDown' ? 1 : -1);
        if (all[n]) { e.preventDefault(); all[n].focus(); }
      }
    });
    var inp = M.querySelector('.ekm-q input'), form = M.querySelector('.ekm-q'), res = M.querySelector('#ekm-res .ekm-pi');
    inp.addEventListener('input', function () { filter(inp.value); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = (inp.value || '').trim().slice(0, 80); if (!v) return;
      var f = res.querySelector('a[href]'); if (f) go(f.href);
    });
    function clearQ() { if (inp.value) inp.value = ''; M.classList.remove('q'); panes._r.classList.remove('on'); }
    function filter(v) {
      var qs = norm(v).split(/\s+/).filter(Boolean);
      if (!qs.length) { clearQ(); activate(curK || firstK()); return; }
      var hit = index.filter(function (x) { return qs.every(function (q) { return x.t.indexOf(q) >= 0; }); }).slice(0, 12), h = '';
      hit.forEach(function (x, n) { var c = x.a.cloneNode(true); c.style.setProperty('--i', n); c.classList.remove('ekg'); h += c.outerHTML; });
      var qv = v.trim().slice(0, 80);
      h += '<a class="ekm-sq" style="--i:' + hit.length + '" href="/?q=' + encodeURIComponent(qv) + '">' + IC.q + '<span>' +
        esc(pick('جستجوی «' + qv + '» در پست‌ها و کوین‌ها', 'گەڕان بۆ «' + qv + '» لە پۆست و دراوەکان', 'Search posts and coins for “' + qv + '”')) + '</span></a>';
      res.innerHTML = h;
      M.classList.add('q');
      for (var k in panes) panes[k].classList.toggle('on', k === '_r');
      cats.forEach(function (c) { c.classList.remove('on'); c.setAttribute('aria-expanded', 'false'); });
      roving();
    }
    panes._r = M.querySelector('#ekm-res');
    M._clearQ = clearQ;
    layout();
    if (DESK.addEventListener) DESK.addEventListener('change', layout); else if (DESK.addListener) DESK.addListener(layout);
    if (w.ekChrome && w.ekChrome.label) w.ekChrome.label(lang());
  }
  /* wide screens: categories beside one pane; narrow screens: each pane opens under its category */
  function layout() {
    if (!M) return;
    var box = M.querySelector('.ekm-panes');
    cats.forEach(function (c) { var p = panes[c.getAttribute('data-k')]; if (!p) return; if (DESK.matches) box.insertBefore(p, panes._r); else c.parentNode.insertBefore(p, c.nextSibling); });
    roving();
  }
  function firstK() { var a = H.querySelector('.ek-mi.on'); return (a && a.getAttribute('data-k')) || (cats[0] && cats[0].getAttribute('data-k')); }
  function activate(k) {
    curK = k;
    cats.forEach(function (c) { var on = c.getAttribute('data-k') === k; c.classList.toggle('on', on); c.setAttribute('aria-expanded', on ? 'true' : 'false'); });
    for (var x in panes) panes[x].classList.toggle('on', x === k);
    roving();
  }
  /* wide screens: the category list is one Tab stop (the arrow keys move inside it), so Tab goes on into the open pane */
  function roving() {
    var all = [].slice.call(M.querySelectorAll('.ekm-cat')), one = M.querySelector('.ekm-cat.on') || all[0];
    all.forEach(function (c) { if (DESK.matches && c !== one) c.setAttribute('tabindex', '-1'); else c.removeAttribute('tabindex'); });
  }
  function syncLang() {
    var l = lang(), lg = H && H.querySelector('.ek-lg1');
    if (lg) lg.textContent = { fa: 'فا', ckb: 'کو', en: 'EN' }[l];
    if (!M) return;
    M.setAttribute('aria-label', pick('منوی سایت', 'مێنیوی ماڵپەڕ', 'Site menu'));
    M.querySelector('.ekm-lang').setAttribute('aria-label', pick('زبان', 'زمان', 'Language'));
    [].forEach.call(M.querySelectorAll('.ekm-lang button'), function (b) { var on = b.getAttribute('data-l') === l; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var q = M.querySelector('.ekm-q input'); if (q) q.placeholder = PH[l];
    [].forEach.call(M.querySelectorAll('.ekm-cat small[data-n]'), function (s) { s.textContent = dg(s.getAttribute('data-n')); });
  }
  function openMenu(k, from, toLang) {
    if (!M) buildMenu();
    if (M.classList.contains('open')) return;
    opener = from || d.activeElement;
    var r = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
    if (r && !r.width) r = null;
    M.style.setProperty('--mx', (r ? r.left + r.width / 2 : w.innerWidth / 2) + 'px');
    M.style.setProperty('--my', (r ? r.top + r.height / 2 : 40) + 'px');
    layout(); syncLang(); M._clearQ();
    activate(k || (DESK.matches ? firstK() : (H.querySelector('.ek-mi.on') ? firstK() : null)));
    M.classList.remove('closing'); void M.offsetWidth; M.classList.add('open');
    lock(true); de.classList.add('ek-mopen'); setInert(M, true);
    var mb = H.querySelector('.ek-menu'); if (mb) mb.setAttribute('aria-expanded', 'true');
    try { history.pushState({ ek: 'menu' }, ''); } catch (e) { }
    setTimeout(function () {
      var f = toLang ? M.querySelector('.ekm-lang .on') : (M.querySelector('.ekm-cat.on') || M.querySelector('.ekm-cat') || M.querySelector('.ekm-x'));
      if (f) { try { f.focus({ preventScroll: !toLang }); } catch (e) { f.focus(); } }
    }, RM ? 0 : 120);
  }
  function closeMenu(cb, fromHistory) {
    if (!M || !M.classList.contains('open')) { if (cb) cb(); return; }
    M.classList.remove('open'); M.classList.add('closing');
    de.classList.remove('ek-mopen'); lock(d.getElementById('ekp') && d.getElementById('ekp').classList.contains('open')); setInert(M, false);
    setTimeout(function () { M.classList.remove('closing'); }, RM ? 0 : 440);
    var mb = H.querySelector('.ek-menu'); if (mb) mb.setAttribute('aria-expanded', 'false');
    if (opener && opener.focus) { try { opener.focus({ preventScroll: true }); } catch (e) { } }
    var mine = false; try { mine = !!(history.state && history.state.ek === 'menu'); } catch (e) { }
    if (!fromHistory && mine) { afterClose = cb || null; history.back(); }
    else if (cb) cb();
  }

  /* ================================================================== homepage: section index + panel */
  function deck() {
    if (!de.classList.contains('ek-deck')) return;
    var main = d.getElementById('top'), hero = main && main.querySelector('.hero');
    if (!main || !hero) { de.classList.remove('ek-deck'); return; }
    var DEF = ['command', 'intel', 'learnmap', 'market', 'hall', 'feed', 'coinswall', 'library'];
    var OWN = {
      feed: [['آرشیو پست‌های کانال', 'ئەرشیفی پۆستەکانی کەناڵ', 'Channel archive'],
        ['همهٔ پست‌های Coin_Kurd با فیلتر دسته، نوع، زمان و جستجو', 'هەموو پۆستەکانی Coin_Kurd بە فلتەری پۆل، جۆر، کات و گەڕان', 'Every Coin_Kurd post, filtered by category, kind, time or search']]
    };
    function cnt(sel, fa, ckb, en) { var e = d.querySelector(sel), v = e && e.textContent.trim(); return v ? esc(v) + ' ' + pick(fa, ckb, en) : ''; }
    var STAT = {
      command: function () { var n = main.querySelectorAll('.ccT').length || d.querySelectorAll('#ekp .ccT').length; return n ? pick(dg(n) + ' ابزار زنده', dg(n) + ' ئامرازی زیندوو', n + ' live tools') : ''; },
      intel: function () { var b = d.querySelector('#fngBox .big'), v = b ? parseInt(b.textContent, 10) : NaN; return v >= 0 ? pick('ترس و طمع ' + dg(v), 'ترس و تەماح ' + dg(v), 'Fear & Greed ' + v) : ''; },
      market: function () {
        try {
          var c = (X.market.coins || []).filter(function (x) { return x.coin === 'BTC'; })[0]; if (!c || !c.price) return '';
          var up = c.chg24 >= 0;
          return '<bdi dir="ltr">BTC $' + Math.round(c.price).toLocaleString('en-US') + (c.chg24 == null ? '' : ' <i class="' + (up ? 'up' : 'dn') + '" style="font-style:normal">' + (up ? '▲' : '▼') + ' ' + Math.abs(c.chg24).toFixed(2) + '%</i>') + '</bdi>';
        } catch (e) { return ''; }
      },
      hall: function () { return cnt('#sCats', 'دسته', 'پۆل', 'categories'); },
      feed: function () {
        try { var n = S.meta.count; if (n) return dg(Number(n).toLocaleString('en-US')).replace(/,/g, lang() === 'en' ? ',' : '٬') + ' ' + pick('پست', 'پۆست', 'posts'); } catch (e) { }
        return cnt('#sPosts', 'پست', 'پۆست', 'posts');
      },
      coinswall: function () { return cnt('#sCoins', 'کوین', 'دراو', 'coins'); }
    };
    var nav = d.createElement('div'); nav.className = 'ekd'; nav.id = 'ekd'; nav.setAttribute('role', 'navigation');
    var navLabel = function () { nav.setAttribute('aria-label', pick('بخش‌های صفحهٔ اصلی', 'بەشەکانی پەڕەی سەرەکی', 'Homepage sections')); };
    navLabel();
    var ids = [], h = '';
    DEF.forEach(function (id) {
      var sec = d.getElementById(id); if (!sec) return;
      var t = sec.querySelector('h2[data-i]'), l = sec.querySelector('p.lead[data-i]'), own = OWN[id], link = id === 'library' && sec.querySelector('a[href]');
      if (!t && !own) return;
      var title = t ? '<b class="ekd-t" data-i="' + esc(t.getAttribute('data-i')) + '">' + t.innerHTML + '</b>' : tri(own[0][0], own[0][1], own[0][2], 'b', 'ekd-t');
      var lead = l ? '<span class="ekd-l" data-i="' + esc(l.getAttribute('data-i')) + '">' + l.innerHTML + '</span>' : own ? tri(own[1][0], own[1][1], own[1][2], 'span', 'ekd-l') : '';
      if (!link) ids.push(id);
      h += '<a class="ekd-row" ' + (link ? 'href="' + esc(link.getAttribute('href')) + '"' : 'href="#' + id + '" data-d="' + id + '"') + '>' + title + lead + '<span class="ekd-s" data-s="' + id + '"></span></a>';
    });
    if (!ids.length) { de.classList.remove('ek-deck'); return; }
    nav.innerHTML = h;
    var mq = main.querySelector('.marquee');
    (mq || hero).parentNode.insertBefore(nav, (mq || hero).nextSibling);
    function stats() { [].forEach.call(nav.querySelectorAll('.ekd-s'), function (s) { var f = STAT[s.getAttribute('data-s')], v = f ? f() : ''; if (s.innerHTML !== v) s.innerHTML = v; }); }
    stats(); [1500, 4000, 9000].forEach(function (ms) { setTimeout(stats, ms); });
    function rowOf(id) { var x = w.ekNX && w.ekNX.door && w.ekNX.door(id); return x || nav.querySelector('[data-d="' + id + '"]'); }
    function tell(id, from) { try { w.dispatchEvent(new CustomEvent('ek:room', { detail: { id: id, from: from || null } })); } catch (e) { } }
    function edges(b) {   /* the layer grows out of, and shrinks back into, the box it was opened from */
      var W = w.innerWidth, Hh = w.innerHeight, c = function (v, m) { return Math.max(0, Math.min(m, v)) + 'px'; };
      P.style.setProperty('--pt', b ? c(b.top, Hh) : '45%'); P.style.setProperty('--pb', b ? c(Hh - b.bottom, Hh) : '45%');
      P.style.setProperty('--pl', b ? c(b.left, W) : '0px'); P.style.setProperty('--pr', b ? c(W - b.right, W) : '0px');
    }

    var P = null, body = null, title = null, cur = null, ph = {}, pushed = false, tClose = null, last = null;
    function buildPanel() {
      P = d.createElement('div'); P.id = 'ekp'; P.setAttribute('role', 'dialog'); P.setAttribute('aria-modal', 'true'); P.setAttribute('aria-labelledby', 'ekp-t');
      P.innerHTML = '<div class="ekp-bar"><button type="button" class="ekp-back">' + IC.back + tri('خانه', 'ماڵەوە', 'Home') + '</button><b id="ekp-t"></b>' +
        '<div class="ekp-nav"><button type="button" data-go="-1" data-afa="بخش قبلی" data-ackb="بەشی پێشوو" data-aen="Previous section">' + IC.back + '</button>' +
        '<button type="button" data-go="1" data-afa="بخش بعدی" data-ackb="بەشی دواتر" data-aen="Next section">' + IC.back + '</button></div>' +
        '<button type="button" class="ekp-x" data-afa="بستن" data-ackb="داخستن" data-aen="Close">' + IC.x + '</button></div><div class="ekp-body" tabindex="-1"></div>';
      d.body.appendChild(P);
      body = P.querySelector('.ekp-body'); title = P.querySelector('#ekp-t');
      P.addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('.ekp-back') || t.closest('.ekp-x')) { closeDoor(); return; }
        var g = t.closest('[data-go]');
        if (g) { var n = (ids.indexOf(cur) + (+g.getAttribute('data-go')) + ids.length) % ids.length; swap(ids[n]); }
      });
      d.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || e.defaultPrevented || !P.classList.contains('open')) return;
        /* whatever lies on top of the panel (post reader, search, menu, assistant) closes first */
        if (d.querySelector('#modal.open,#ekq.open,#eks.open,#ekm.open,#ask-panel.on')) return;
        e.preventDefault(); closeDoor();
      });
      if (w.ekChrome && w.ekChrome.label) w.ekChrome.label(lang());
    }
    function restore(id) { var sec = d.getElementById(id), mark = ph[id]; if (sec && mark && mark.parentNode) mark.parentNode.insertBefore(sec, mark); }
    function base(on) { setInert(P, on, [H, main, d.getElementById('ekf'), B].filter(Boolean)); }
    function show(id, from) {
      var sec = d.getElementById(id); if (!sec) return;
      if (!P) buildPanel();
      clearTimeout(tClose);
      if (cur && cur !== id) restore(cur);
      if (!ph[id]) { ph[id] = d.createComment('ekd:' + id); sec.parentNode.insertBefore(ph[id], sec); }
      body.appendChild(sec); cur = id; body.scrollTop = 0;
      var r = rowOf(id), rt = r && r.querySelector('.ekd-t');
      title.textContent = rt ? rt.textContent : '';
      sec.classList.add('v'); [].forEach.call(sec.querySelectorAll('.reveal'), function (x) { x.classList.add('v'); });
      if (!P.classList.contains('open')) {
        last = d.activeElement;
        edges(from && from.getBoundingClientRect ? from.getBoundingClientRect() : null);
        void P.offsetWidth; P.classList.add('open'); lock(true); base(true);
        setTimeout(function () { try { body.focus({ preventScroll: true }); } catch (e) { } }, RM ? 0 : 200);
      } else if (!P.contains(d.activeElement)) { try { body.focus({ preventScroll: true }); } catch (e) { } }
      setTimeout(function () { try { w.dispatchEvent(new Event('resize')); } catch (e) { } }, 80);
      tell(id);
    }
    function hide() {
      if (!P || !P.classList.contains('open')) return;
      var r = cur && rowOf(cur), b = r ? r.getBoundingClientRect() : null, id = cur;
      if (b && (b.width || b.height)) edges(b);
      P.classList.remove('open'); lock(false); base(false); tell(null, id);
      [].forEach.call(nav.querySelectorAll('.ekd-row.go'), function (x) { x.classList.remove('go'); });
      clearTimeout(tClose);
      tClose = setTimeout(function () { restore(id); if (cur === id) cur = null; }, RM ? 0 : 520);
      var f = r || last; if (f && f.focus) { try { f.focus({ preventScroll: true }); } catch (e) { } }
    }
    function swap(id) {
      try { history.replaceState(pushed ? { ek: 'panel' } : null, '', '#' + id); } catch (e) { }
      show(id);
    }
    function openDoor(id, from) {
      if (P && P.classList.contains('open')) { swap(id); return; }
      try { history.pushState({ ek: 'panel' }, '', '#' + id); pushed = true; } catch (e) { }
      show(id, from);
    }
    function closeDoor() {
      if (pushed) { pushed = false; history.back(); return; }      /* popstate → deckSync → hide */
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
      hide();
    }
    deckSync = function () {
      var id = (location.hash || '').slice(1);
      if (ids.indexOf(id) >= 0) show(id, rowOf(id));
      else if (!/^p\d+$/.test(id)) { pushed = false; hide(); }
    };
    nav.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.ekd-row[data-d]'); if (!a || !plain(e)) return;
      e.preventDefault(); a.classList.add('go'); openDoor(a.getAttribute('data-d'), a);
    });
    /* the page's own "jump to the feed" (category tiles, coin wall, search) now opens the archive panel */
    w.scrollFeed = function () {
      openDoor('feed', rowOf('feed'));
      setTimeout(function () { if (body) body.scrollTop = 0; }, 0);
    };
    /* the post reader used to drop the address back to "/": keep the open section in it */
    if (typeof w.closeModal === 'function') {
      var cm = w.closeModal;
      w.closeModal = function () {
        cm.apply(this, arguments);
        if (cur && P && P.classList.contains('open')) { try { history.replaceState(pushed ? { ek: 'panel' } : null, '', '#' + cur); } catch (e) { } }
      };
    }
    new MutationObserver(function () { setTimeout(function () { stats(); navLabel(); if (cur && title) { var r = rowOf(cur), rt = r && r.querySelector('.ekd-t'); if (rt) title.textContent = rt.textContent; } }, 60); })
      .observe(de, { attributes: true, attributeFilter: ['lang'] });
    w.ekDeck = { open: openDoor, close: closeDoor, swap: swap, ids: ids, cur: function () { return cur; } };
    deckSync();
    /* a search link (/?q=…) lands in the archive: the page's own jump may have been taken before this script ran */
    if (/[?&]q=[^&]/.test(location.search)) setTimeout(function () { if (cur !== 'feed') openDoor('feed', rowOf('feed')); }, 900);
  }

  /* ================================================================== preview note, prefetch, start */
  function note() {
    try { if (sessionStorage.getItem('ek_pv_x')) return; } catch (e) { }
    var n = d.createElement('div'); n.id = 'ekpv';
    n.innerHTML = '<div role="status">' + tri('پیش‌نمایش طراحی جدید', 'پێشبینینی دیزاینی نوێ', 'New design preview') +
      '<a href="?ui=1">' + tri('بازگشت به طراحی فعلی', 'گەڕانەوە بۆ دیزاینی ئێستا', 'Back to current design') + '</a>' +
      '<button type="button" data-afa="بستن این یادداشت" data-ackb="داخستنی ئەم تێبینییە" data-aen="Hide this note">' + IC.x + '</button></div>';
    d.body.appendChild(n);
    n.querySelector('a').addEventListener('click', function (e) { e.preventDefault(); var u = new URL(location.href); u.searchParams.set('ui', '1'); u.hash = ''; location.href = u.href; });
    n.querySelector('button').addEventListener('click', function () { try { sessionStorage.setItem('ek_pv_x', '1'); } catch (e) { } n.remove(); });
  }
  function prefetch() {   /* the next page starts loading when the finger or mouse button goes down; skipped on data-saver and slow links */
    var c = navigator.connection || {};
    if (c.saveData || /2g/.test(c.effectiveType || '')) return;
    try {
      if (!(w.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules'))) return;
      var s = d.createElement('script'); s.type = 'speculationrules';
      s.textContent = JSON.stringify({ prefetch: [{ where: { and: [{ href_matches: '/*' }, { not: { selector_matches: '[target=_blank],[download]' } }] }, eagerness: 'conservative' }] });
      d.head.appendChild(s);
    } catch (e) { }
  }
  function init() {
    H = d.getElementById('ekh'); B = d.getElementById('ekb');
    if (!H) return;
    island(); syncLang();
    try {
      new MutationObserver(function () { syncLang(); setTimeout(restInk, 80); }).observe(de, { attributes: true, attributeFilter: ['lang'] });
      var lgs = d.getElementById('langs'); if (lgs) new MutationObserver(function () { syncLang(); setTimeout(restInk, 80); }).observe(lgs, { attributes: true, subtree: true, attributeFilter: ['class'] });
    } catch (e) { }
    w.addEventListener('popstate', function () {
      if (M && M.classList.contains('open')) closeMenu(null, true);
      if (afterClose) { var f = afterClose; afterClose = null; f(); }
      if (deckSync) deckSync();
    });
    w.addEventListener('hashchange', function () { if (M && M.classList.contains('open')) closeMenu(null, true); if (deckSync) deckSync(); });
    w.addEventListener('pageshow', function (e) { if (e.persisted && M && M.classList.contains('open')) closeMenu(null, true); });
    /* a page that has no transition of its own (the encyclopedia, the current design after "back to current design")
       would only log that it dropped ours: do not start one towards it */
    w.addEventListener('pageswap', function (e) {
      var t = e.viewTransition; if (!t) return;
      ['ready', 'finished'].forEach(function (k) { if (t[k] && t[k].catch) t[k].catch(function () { }); });
      try {
        var u = new URL(e.activation.entry.url);
        if (/^\/(encyclopedia|bot|survey)\//.test(u.pathname) || u.pathname === '/offline.html' || /[?&]ui=1(&|$)/.test(u.search)) t.skipTransition();
      } catch (x) { }
    });
    try { deck(); } catch (e) { de.classList.remove('ek-deck'); if (w.console) console.error(e); }
    if (w.ekChrome && w.ekChrome.label) w.ekChrome.label(lang());
    note(); prefetch();
    w.ekUI2 = { openMenu: openMenu, closeMenu: closeMenu };
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
