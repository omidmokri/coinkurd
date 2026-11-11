/* entekhab.net — interface v3 "Nexus": the homepage stage (preview, ?ui=3).
   The first screen is one room: the coin in the middle (assets/nx-coin.js), the sections of the page around it as glass panels
   with a live preview each, and a rail at the bottom that reaches every one of them. A panel opens into its full-screen room
   (the v2 engine in assets/ui2.js keeps the history, the address and the focus). Every number shown is real: the exchange's
   socket, the site's own data files, or nothing. The old sections stay in the page; nothing is removed. */
(function () {
  'use strict';
  var d = document, de = d.documentElement, w = window, U = w.nxUI;
  if (!U || !de.classList.contains('ek-v3') || !de.classList.contains('ek-deck')) return;
  var main = d.getElementById('top'), hero = main && main.querySelector('.hero');
  if (!main || !hero) return;
  var esc = U.esc, pick = U.pick, tri = U.tri, dg = U.dg, RM = U.RM, FINE = U.FINE;
  var GO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/></svg>';
  var HOME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M10 8h3.2a2 2 0 0 1 0 4H10m0 0h3.8a2 2 0 0 1 0 4H10M10 8v8M11.5 6.5V8M11.5 16v1.5"/></svg>';
  var DEF = [
    { id: 'market', col: 'a', s: ['بازار', 'بازاڕ', 'Market'] },
    { id: 'command', col: 'a', s: ['اتاق فرمان', 'ژووری فەرمان', 'Command room'] },
    { id: 'intel', col: 'a', s: ['داشبورد', 'داشبۆرد', 'Dashboard'] },
    { id: 'coinswall', col: 'a', s: ['کوین‌ها', 'دراوەکان', 'Coins'] },
    { id: 'feed', col: 'b', s: ['آرشیو', 'ئەرشیف', 'Archive'], own: [['آرشیو پست‌های کانال', 'ئەرشیفی پۆستەکانی کەناڵ', 'Channel archive']] },
    { id: 'hall', col: 'b', s: ['دسته‌ها', 'پۆلەکان', 'Categories'] },
    { id: 'learnmap', col: 'b', s: ['یادگیری', 'فێربوون', 'Learning'] },
    { id: 'library', col: 'b', s: ['کتابخانه', 'کتێبخانە', 'Library'] }
  ];
  var FNG = { 'Extreme Fear': ['ترس شدید', 'ترسی زۆر'], 'Fear': ['ترس', 'ترس'], 'Neutral': ['خنثی', 'بێلایەن'], 'Greed': ['طمع', 'تەماح'], 'Extreme Greed': ['طمع شدید', 'تەماحی زۆر'] };
  function cnt(sel, fa, ckb, en) { var e = d.querySelector(sel), v = e && e.textContent.trim(); return v ? esc(v) + ' ' + pick(fa, ckb, en) : ''; }
  function nfmt(n) { return dg(Number(n).toLocaleString('en-US')).replace(/,/g, U.lang() === 'en' ? ',' : '٬'); }

  /* ------------------------------------------------------------------ build */
  var nx = d.createElement('section'); nx.className = 'nx'; nx.id = 'nx'; nx.setAttribute('aria-labelledby', 'nx-h');
  var cols = { a: '', b: '' }, rail = '', doors = {}, order = [];
  DEF.forEach(function (D) {
    var sec = d.getElementById(D.id); if (!sec) return;
    var t = sec.querySelector('h2[data-i]'), l = sec.querySelector('p.lead[data-i]'), link = D.id === 'library' && sec.querySelector('a[href]');
    var title = D.own ? tri(D.own[0][0], D.own[0][1], D.own[0][2], 'b', 'ekd-t') : t ? '<b class="ekd-t" data-i="' + esc(t.getAttribute('data-i')) + '">' + t.innerHTML + '</b>' : tri(D.s[0], D.s[1], D.s[2], 'b', 'ekd-t');
    var lead = l ? '<span class="nx-l" data-i="' + esc(l.getAttribute('data-i')) + '">' + l.innerHTML + '</span>' : '';
    var body = '';
    if (D.id === 'market') body = '<span class="nx-mk"><b data-live="BTC">—</b><span data-livechg="BTC"></span></span><span class="nx-mc"></span><span class="nx-st" data-st="mini"><i></i><span></span></span>';
    else if (D.id === 'command') body = '<span class="nx-chips" data-c="command"></span><span class="nx-s" data-s="command"></span>';
    else if (D.id === 'intel') body = '<span class="nx-fg" data-fg></span><span class="nx-l" data-s="intel"></span>';
    else if (D.id === 'coinswall') body = '<span class="nx-lg" data-c="coinswall"></span><span class="nx-s" data-s="coinswall"></span>';
    else if (D.id === 'feed') body = '<ul class="nx-fl" data-c="feed"></ul><span class="nx-s" data-s="feed"></span>';
    else if (D.id === 'hall') body = '<span class="nx-chips" data-c="hall"></span><span class="nx-s" data-s="hall"></span>';
    else if (D.id === 'learnmap') body = '<span class="nx-chips" data-c="learnmap"></span>' + lead;
    else body = lead;
    var href = link ? esc(link.getAttribute('href')) : '#' + D.id;
    cols[D.col] += '<a class="nx-p" href="' + href + '"' + (link ? '' : ' data-d="' + D.id + '"') + ' data-k="' + D.id + '"><span class="nx-pt">' + title + '<i class="nx-go" aria-hidden="true">' + GO + '</i></span><span class="nx-pb">' + body + '</span></a>';
    rail += '<a href="' + href + '"' + (link ? '' : ' data-d="' + D.id + '"') + '>' + tri(D.s[0], D.s[1], D.s[2]) + '</a>';
    if (!link) order.push(D.id);
  });
  var role = hero.querySelector('.role[data-i]');
  nx.innerHTML = '<div class="nx-bg" aria-hidden="true"><div class="nx-bgc"></div></div><svg class="nx-links" aria-hidden="true"></svg>' +
    '<div class="nx-mid"><div class="nx-coin"><span class="nx-c3" aria-hidden="true"><img src="/assets/coin-front.webp" alt="" width="512" height="512" fetchpriority="high" decoding="async"><img src="/assets/coin-back.webp" alt="" width="512" height="512" decoding="async"></span>' +
    '<canvas aria-hidden="true"></canvas><i class="nx-hit" aria-hidden="true"></i>' +
    '<div class="nx-ped" aria-hidden="true"><svg viewBox="0 0 460 110"><defs><radialGradient id="nxpg"><stop offset="0" stop-color="#ffb347" stop-opacity=".95"/><stop offset=".45" stop-color="#f7931a" stop-opacity=".42"/><stop offset="1" stop-color="#f7931a" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="nxpl" x1="0" x2="1"><stop offset="0" stop-color="#a65a07"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#a65a07"/></linearGradient></defs>' +
    '<ellipse cx="230" cy="55" rx="228" ry="52" fill="url(#nxpg)" opacity=".5"/><ellipse cx="230" cy="55" rx="150" ry="30" fill="url(#nxpg)"/>' +
    '<ellipse cx="230" cy="55" rx="205" ry="42" fill="none" stroke="rgba(255,255,255,.16)"/><ellipse class="pg" cx="230" cy="55" rx="205" ry="42" fill="none" stroke="url(#nxpl)" stroke-width="2.6" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>' +
    '<ellipse cx="230" cy="55" rx="170" ry="33" fill="none" stroke="rgba(247,147,26,.5)" stroke-dasharray="2 7"/></svg></div></div>' +
    tri('آیندهٔ پول، انتخابِ توست', 'داهاتووی پارە، هەڵبژاردنی تۆیە', 'The future of money is your choice', 'h1', 'nx-h1').replace('<h1 ', '<h1 id="nx-h" ') +
    (role ? '<p class="nx-role" data-i="' + esc(role.getAttribute('data-i')) + '">' + role.innerHTML + '</p>' : '') +
    '<ul class="nx-net" data-net></ul>' +
    '<div class="nx-cta"><a class="nx-btn p" href="#market" data-d="market">' + tri('ورود به بازار زنده', 'چوونە ناو بازاڕی زیندوو', 'Enter the live market') + '</a>' +
    '<a class="nx-btn" href="/satoshi/">' + HOME + tri('داستان ساتوشی', 'چیرۆکی ساتۆشی', 'Satoshi’s story') + '</a></div></div>' +
    '<div class="nx-ps"><div class="nx-col nx-a">' + cols.a + '</div><div class="nx-col nx-b">' + cols.b + '</div></div>';
  main.insertBefore(nx, main.firstChild);
  var mid = nx.querySelector('.nx-mid'), nxt = d.getElementById('next'); if (nxt) mid.appendChild(nxt);
  var R = d.createElement('div'); R.id = 'nxr'; R.setAttribute('role', 'navigation');   /* not <nav>: the homepage styles bare nav elements */
  R.innerHTML = '<a class="nxr-home" href="#" data-home>' + HOME + tri('خانه', 'ماڵەوە', 'Home') + '</a>' + rail + '<i class="nxr-sep" aria-hidden="true"></i><a class="nxr-sat" href="/satoshi/">' + tri('ساتوشی', 'ساتۆشی', 'Satoshi') + '</a>';
  d.body.appendChild(R);
  function railLabel() { R.setAttribute('aria-label', pick('بخش‌های صفحهٔ اصلی', 'بەشەکانی پەڕەی سەرەکی', 'Homepage sections')); }
  railLabel();
  [].forEach.call(nx.querySelectorAll('.nx-p[data-d]'), function (p) { doors[p.getAttribute('data-d')] = p; });
  var panels = [].slice.call(nx.querySelectorAll('.nx-p'));
  function vis(e) { return !!(e && e.offsetParent !== null && e.getClientRects().length); }
  function door(id) { var p = doors[id]; if (vis(p)) return p; var r = R.querySelector('[data-d="' + id + '"]'); return vis(r) ? r : null; }

  /* ------------------------------------------------------------------ the coin */
  var cbox = nx.querySelector('.nx-coin'), coin = null, nc = navigator.connection || {}, phone = w.innerWidth < 821;
  function startCoin() {   /* after the page has loaded and is idle: the still coin is already on screen, the 3D one takes over */
    try {
      if (w.nxCoin && !nc.saveData && !((navigator.deviceMemory || 8) <= 1)) coin = w.nxCoin(cbox.querySelector('canvas'), {
        yaw: 0, area: nx, hit: cbox.querySelector('.nx-hit'), dpr: phone ? 1.5 : 2, embers: phone ? 36 : 80,
        onready: function () { cbox.classList.add('gl'); if (cur && coin) coin.pause(true); }, onlost: function () { cbox.classList.remove('gl'); if (!RM) cbox.classList.add('css'); coin = null; }
      });
    } catch (e) { coin = null; }
    if (!coin && !RM) cbox.classList.add('css');
  }
  (function () {
    var go = function () { (w.requestIdleCallback || function (f) { setTimeout(f, 200); })(startCoin, { timeout: 1500 }); };
    if (d.readyState === 'complete') go(); else w.addEventListener('load', go, { once: true });
  })();

  /* ------------------------------------------------------------------ light paths from the coin to the panels */
  var svg = nx.querySelector('.nx-links'), paths = {};
  function links() {
    if (!vis(svg) || w.innerWidth < 1100) { svg.innerHTML = ''; paths = {}; return; }
    var B = nx.getBoundingClientRect(), c = cbox.getBoundingClientRect(), cx = c.left + c.width / 2 - B.left, cy = c.top + c.height / 2 - B.top, h = '';
    panels.forEach(function (p, i) {
      var b = p.getBoundingClientRect(), right = b.left + b.width / 2 > B.left + B.width / 2, x = (right ? b.left : b.right) - B.left, y = b.top + b.height / 2 - B.top;
      var sx = cx + (right ? 1 : -1) * c.height * .37, sy = cy + (y - cy) * .16, mx = (sx + x) / 2;
      h += '<path data-k="' + p.getAttribute('data-k') + '" d="M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + 'C' + mx.toFixed(1) + ' ' + sy.toFixed(1) + ' ' + mx.toFixed(1) + ' ' + y.toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + '"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.5"/>';
    });
    svg.innerHTML = h; paths = {};
    [].forEach.call(svg.querySelectorAll('path'), function (p) { paths[p.getAttribute('data-k')] = p; });
  }
  var lt = 0; function linksSoon() { clearTimeout(lt); lt = setTimeout(links, 90); }
  w.addEventListener('resize', linksSoon);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(linksSoon);
  links(); [300, 1200, 3000].forEach(function (ms) { setTimeout(links, ms); });

  /* ------------------------------------------------------------------ pointer: the wall of glass and the coin follow it; a panel under it lights up */
  if (FINE && !RM) {
    var pr = 0;
    nx.addEventListener('pointermove', function (e) {
      if (pr) return; pr = requestAnimationFrame(function () { pr = 0; var b = nx.getBoundingClientRect(); nx.style.setProperty('--mx', (((e.clientX - b.left) / b.width - .5) * 2).toFixed(3)); });
    }, { passive: true });
    nx.addEventListener('pointerleave', function () { nx.style.setProperty('--mx', 0); });
  }
  function lit(p, on) {
    var k = p.getAttribute('data-k'), pa = paths[k]; if (pa) pa.classList.toggle('on', on);
    if (!coin) return;
    if (on) { var b = p.getBoundingClientRect(), right = b.left + b.width / 2 > w.innerWidth / 2; coin.face(true); coin.set({ glow: .8, heat: .5, bias: right ? .5 : -.5 }); }
    else { coin.face(false); coin.set({ glow: .2, heat: 0, bias: 0 }); }
  }
  panels.forEach(function (p) {
    p.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') lit(p, true); });
    p.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') lit(p, false); });
    p.addEventListener('focus', function () { if (p.matches(':focus-visible')) lit(p, true); });
    p.addEventListener('blur', function () { lit(p, false); });
    if (FINE) p.addEventListener('pointermove', function (e) { var b = p.getBoundingClientRect(); p.style.setProperty('--gx', (e.clientX - b.left) + 'px'); p.style.setProperty('--gy', (e.clientY - b.top) + 'px'); }, { passive: true });
  });
  [].forEach.call(nx.querySelectorAll('.nx-btn'), function (b) { U.magnet(b, .2); });

  /* ------------------------------------------------------------------ rooms */
  var cur = null;
  function open(id, from) {
    if (!w.ekDeck) { location.hash = id; return; }
    if (coin && !cur) coin.pulse();
    w.ekDeck.open(id, from || door(id));
  }
  function plain(e) { return !(e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey); }
  nx.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-d]'); if (!a || !plain(e)) return;
    e.preventDefault(); var id = a.getAttribute('data-d'), p = a.classList.contains('nx-p') ? a : door(id);
    if (p && p.classList.contains('nx-p')) p.classList.add('go');
    setTimeout(function () { open(id, p); }, coin && !RM && !cur ? 140 : 0);      /* the coin answers first */
  });
  R.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a'); if (!a || !plain(e)) return;
    if (a.hasAttribute('data-home')) { e.preventDefault(); if (w.ekDeck) w.ekDeck.close(); return; }
    var id = a.getAttribute('data-d'); if (!id) return;
    e.preventDefault(); open(id, cur ? null : a);
  });
  function sync(id) {
    cur = id || null; de.classList.toggle('nx-room', !!cur);
    [].forEach.call(R.querySelectorAll('a[data-d]'), function (a) { var on = a.getAttribute('data-d') === cur; a.classList.toggle('on', on); if (on) { a.setAttribute('aria-current', 'true'); try { a.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (x) { } } else a.removeAttribute('aria-current'); });
    if (coin) coin.pause(!!cur);
    if (!cur) { panels.forEach(function (p) { p.classList.remove('go'); lit(p, false); }); setTimeout(links, 700); }
    if (cur === 'market') market();
  }
  w.addEventListener('ek:room', function (e) { sync(e.detail && e.detail.id); });
  /* in a room the arrow keys walk to the next one, in the order of the rail */
  d.addEventListener('keydown', function (e) {
    if (!cur || !w.ekDeck || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    var t = e.target; if (t && t.closest && t.closest('input,textarea,select,[contenteditable],.nxc-cv,[role=tablist],[role=slider]')) return;
    if (d.querySelector('#modal.open,#ekq.open,#eks.open,#ekm.open,#ask-panel.on')) return;
    var fwd = (e.key === 'ArrowRight') === (de.dir !== 'rtl'), i = order.indexOf(cur); if (i < 0) return;
    e.preventDefault(); w.ekDeck.swap(order[(i + (fwd ? 1 : -1) + order.length) % order.length]);
  });

  /* ------------------------------------------------------------------ live previews (only real numbers) */
  var mini = null, bgc = null;
  function stText(state, f) {
    var at = f && f.at ? U.hhmm(f.at) : '';
    return state === 'live' ? pick('زنده از بایننس', 'ڕاستەوخۆ لە بایننس', 'Live from Binance')
      : state === 'poll' ? pick('هر ۲۰ ثانیه تازه می‌شود', 'هەر ٢٠ چرکە نوێ دەبێتەوە', 'Refreshed every 20 seconds')
        : state === 'snap' ? pick('دادهٔ ثبت‌شدهٔ سایت در ' + at + ' — اتصال به صرافی برقرار نشد', 'داتای تۆمارکراوی ماڵپەڕ لە ' + at + ' — پەیوەندی بە بۆرسەوە نەکرا', 'Site snapshot of ' + at + ' — the exchange could not be reached')
          : state === 'fail' ? pick('داده‌ای در دسترس نیست — اتصال به صرافی برقرار نشد', 'داتا بەردەست نییە — پەیوەندی بە بۆرسەوە نەکرا', 'No data — the exchange could not be reached')
            : pick('در حال اتصال…', 'پەیوەندی دەکرێت…', 'Connecting…');
  }
  function stSet(el, state, f) { if (!el) return; el.className = el.className.replace(/\s(live|poll|snap|fail|wait|load)\b/g, '') + ' ' + state; var t = el.querySelector('span'); if (t) t.textContent = stText(state, f); el._s = [state, f]; }
  function charts() {
    if (!w.nxChart) return;
    var mc = nx.querySelector('.nx-mc'), st = nx.querySelector('[data-st=mini]');
    if (mc && !mini) mini = w.nxChart(mc, { sym: 'BTC', tf: '1h', mini: true, n: 40, onState: function (s, f) { stSet(st, s, f); } });
    var bg = nx.querySelector('.nx-bgc');
    if (bg && !bgc && w.innerWidth >= 821) bgc = w.nxChart(bg, { sym: 'BTC', tf: '1d', mini: true, n: 150 });
  }
  function gauge(v, k) {
    var box = nx.querySelector('[data-fg]'); if (!box || !(v >= 0)) return;
    var a = Math.PI * (1 - v / 100), x = 44 + Math.cos(a) * 30, y = 46 - Math.sin(a) * 30, nm = FNG[k], lab = U.lang() === 'en' || !nm ? (k || '') : nm[U.lang() === 'ckb' ? 1 : 0];
    box.innerHTML = '<svg viewBox="0 0 88 50" aria-hidden="true"><defs><linearGradient id="nxfg" x1="0" x2="1"><stop offset="0" stop-color="#ff5a4d"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#34d399"/></linearGradient></defs>' +
      '<path d="M8 46A36 36 0 0 1 80 46" fill="none" stroke="url(#nxfg)" stroke-width="6" stroke-linecap="round" opacity=".9"/><path d="M44 46L' + x.toFixed(1) + ' ' + y.toFixed(1) + '" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="44" cy="46" r="3.6" fill="#fff"/></svg>' +
      '<span><b>' + dg(v) + '</b><span>' + esc(pick('ترس و طمع', 'ترس و تەماح', 'Fear & Greed') + ': ' + lab) + '</span></span>';
  }
  function fill() {
    var e, h;
    /* command: a few of its tools by name, and how many there are */
    e = nx.querySelector('[data-c=command]');
    if (e && !e.firstChild) { h = ''; [].slice.call(d.querySelectorAll('#command .ccT b[data-i]'), 0, 4).forEach(function (b) { h += '<span data-i="' + esc(b.getAttribute('data-i')) + '">' + b.innerHTML + '</span>'; }); e.innerHTML = h; }
    e = nx.querySelector('[data-s=command]'); if (e) { var n = d.querySelectorAll('#command .ccT').length; e.textContent = n ? pick(dg(n) + ' ابزار زنده', dg(n) + ' ئامرازی زیندوو', n + ' live tools') : ''; }
    e = nx.querySelector('[data-c=learnmap]');
    if (e && !e.firstChild) { h = ''; [].slice.call(d.querySelectorAll('#learnmap .lmchip b[data-i]'), 0, 4).forEach(function (b) { h += '<span data-i="' + esc(b.getAttribute('data-i')) + '">' + b.innerHTML + '</span>'; }); e.innerHTML = h; }
    e = nx.querySelector('[data-c=hall]');
    if (e) { h = ''; [].slice.call(d.querySelectorAll('#hallGrid .tile b'), 0, 4).forEach(function (b) { h += '<span>' + esc(b.textContent) + '</span>'; }); if (h && e.innerHTML !== h) e.innerHTML = h; }
    e = nx.querySelector('[data-s=hall]'); if (e) e.innerHTML = cnt('#sCats', 'دسته', 'پۆل', 'categories');
    e = nx.querySelector('[data-s=coinswall]'); if (e) e.innerHTML = cnt('#sCoins', 'کوین', 'دراو', 'coins');
    e = nx.querySelector('[data-c=coinswall]');
    if (e && !e.firstChild) { h = ''; var seen = {}; [].forEach.call(d.querySelectorAll('#wall img'), function (im) { var s = im.getAttribute('src'); if (!s || seen[s] || Object.keys(seen).length >= 9) return; seen[s] = 1; h += '<img src="' + esc(s) + '" alt="" width="28" height="28" loading="lazy" decoding="async">'; }); e.innerHTML = h; }
    /* archive: the newest posts and how many there are in all */
    try {
      var ps = VP().slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 4); h = '';
      ps.forEach(function (p) { h += '<li><span dir="auto">' + esc(PT(p).title || '') + '</span><small>' + esc(ago(p.date)) + '</small></li>'; });
      e = nx.querySelector('[data-c=feed]'); if (e && h && e.innerHTML !== h) e.innerHTML = h;
      e = nx.querySelector('[data-s=feed]'); var c = S.meta && S.meta.count; if (e && c) e.textContent = nfmt(c) + ' ' + pick('پست', 'پۆست', 'posts');
    } catch (x) { }
    /* dashboard: Fear & Greed and dominance, from the page's own market data when it has arrived, else the small ticker file */
    try { var f = X.market.fng, g = X.market.global; if (f && f.value != null) gauge(+f.value, f.class); if (g && g.btc_d != null) dom(g.btc_d); } catch (x) { }
  }
  function dom(v) { var e = nx.querySelector('[data-s=intel]'); if (e) e.textContent = pick('سهم بیت‌کوین از بازار: ', 'پشکی بیتکۆین لە بازاڕ: ', 'Bitcoin dominance: ') + dg(Number(v).toFixed(1)) + (U.lang() === 'en' ? '%' : '٪'); }
  function net(j) {
    var ul = nx.querySelector('[data-net]'); if (!ul || !j) return; var h = '', n = j.h && j.h.n;
    if (n) {
      var next = Math.ceil((n + 1) / 210000) * 210000, left = next - n, prog = (n - (next - 210000)) / 210000;
      h += '<li><b>' + n.toLocaleString('en-US') + '</b> ' + tri('بلاک', 'بلۆک', 'blocks') + '</li><li><b>' + left.toLocaleString('en-US') + '</b> ' + tri('بلاک تا هاوینگ', 'بلۆک تا هاڵڤینگ', 'blocks to the halving') + '</li>';
      var pg = nx.querySelector('.nx-ped .pg'); if (pg) setTimeout(function () { pg.setAttribute('stroke-dasharray', (prog * 100).toFixed(1) + ' 100'); }, 400);
    }
    if (j.g && j.g.mcap) h += '<li>' + tri('ارزش کل بازار', 'بەهای گشتیی بازاڕ', 'Total market cap') + ' <b>$' + (j.g.mcap / 1e12).toFixed(2) + 'T</b></li>';
    ul.innerHTML = h; ul.title = pick('ثبت‌شده در ', 'تۆمارکراو لە ', 'Recorded at ') + U.hhmm(j.t);
    if (j.fng && !nx.querySelector('[data-fg] svg')) gauge(+j.fng.v, j.fng.k);
    if (j.g && j.g.btc_d != null && !nx.querySelector('[data-s=intel]').textContent) dom(j.g.btc_d);
  }
  var tk = null;
  U.ticker().then(function (j) { tk = j; net(j); U.seed(); }, function () { });
  fill(); charts(); U.seed(); U.live();
  [900, 2200, 5000, 10000].forEach(function (ms) { setTimeout(function () { fill(); links(); }, ms); });
  new MutationObserver(function () {
    setTimeout(function () {
      railLabel(); fill(); if (tk) net(tk);
      [].forEach.call(d.querySelectorAll('.nx-st,.nxm-st'), function (el) { if (el._s) stSet(el, el._s[0], el._s[1]); });
      if (w.ekChrome && w.ekChrome.label) w.ekChrome.label(U.lang());
      linksSoon();
    }, 80);
  }).observe(de, { attributes: true, attributeFilter: ['lang'] });

  /* ------------------------------------------------------------------ the market room: the site's own candles, built when the room is first opened */
  var mk = null;
  function market() {
    var sec = d.getElementById('market'); if (!sec || mk || !w.nxChart) return;
    var SY = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'], TFS = [['15m', '۱۵ دقیقه', '١٥ خولەک', '15m'], ['1h', '۱ ساعت', '١ کاتژمێر', '1h'], ['4h', '۴ ساعت', '٤ کاتژمێر', '4h'], ['1d', 'روزانه', 'ڕۆژانە', '1D'], ['1w', 'هفتگی', 'هەفتانە', '1W']];
    var box = d.createElement('div'); box.className = 'nxm'; box.id = 'nxm';
    box.innerHTML = '<div class="nxm-bar"><div class="nxm-seg" role="group" data-g="sym">' + SY.map(function (s, i) { return '<button type="button" data-v="' + s + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + s + '</button>'; }).join('') + '</div>' +
      '<div class="nxm-seg" role="group" data-g="tf">' + TFS.map(function (t) { return '<button type="button" data-v="' + t[0] + '" aria-pressed="' + (t[0] === '1h' ? 'true' : 'false') + '">' + tri(t[1], t[2], t[3]) + '</button>'; }).join('') + '</div>' +
      '<div class="nxm-seg" role="group" data-g="zoom"><button type="button" data-v="in" data-afa="بزرگ‌نمایی" data-ackb="گەورەکردن" data-aen="Zoom in">+</button><button type="button" data-v="out" data-afa="کوچک‌نمایی" data-ackb="بچووککردن" data-aen="Zoom out">−</button></div>' +
      '<span class="nxm-st" role="status"><i></i><span></span></span></div>' +
      '<div class="nxm-leg"><span class="px">—</span><span class="ch"></span><span>O <b data-o></b></span><span>H <b data-h></b></span><span>L <b data-l></b></span><span>C <b data-c></b></span><span>Vol <b data-v></b></span><span data-t></span></div>' +
      '<div class="nxm-cv"></div><div class="nxm-k" data-k></div>' +
      '<p class="nxm-note">' + tri('کندل‌ها مستقیم از دادهٔ عمومی بایننس (جفت‌ارز با تتر) خوانده می‌شوند؛ اگر اتصال برقرار نشود، نمودار همین را می‌گوید و عددی ساخته نمی‌شود. با کشیدن جابه‌جا کنید؛ برای بزرگ‌نمایی با چرخ ماوس، اول روی نمودار کلیک کنید.',
        'مۆمەکان ڕاستەوخۆ لە داتای گشتیی بایننس (جووت لەگەڵ تەتەر) دەخوێنرێنەوە؛ ئەگەر پەیوەندی نەکرێت، هێڵکاری هەمان شت دەڵێت و هیچ ژمارەیەک دروست ناکرێت. بە ڕاکێشان بیجووڵێنە؛ بۆ گەورەکردن بە چەرخی ماوس، سەرەتا کرتە لە هێڵکاری بکە.',
        'Candles are read straight from Binance public market data (USDT pairs); if the connection fails the chart says so and no number is made up. Drag to pan; click the chart first to zoom with the wheel.') + '</p>';
    var h2 = sec.querySelector('h2'), before = (h2 && h2.nextSibling) || sec.querySelector('#mini'); if (before) sec.insertBefore(box, before); else sec.appendChild(box);   /* right under the title; the section's own TradingView widgets follow */
    var leg = box.querySelector('.nxm-leg'), st = box.querySelector('.nxm-st'), F = w.nxChart.fmtP;
    function q(a) { return leg.querySelector(a); }
    mk = w.nxChart(box.querySelector('.nxm-cv'), {
      sym: 'BTC', tf: '1h', n: w.innerWidth < 600 ? 48 : 96,
      onState: function (s, f) {
        stSet(st, s, f);
        var cvb = box.querySelector('.nxm-cv'), m = cvb.querySelector('.nxm-msg');
        if (s === 'fail') { if (!m) { m = d.createElement('div'); m.className = 'nxm-msg'; cvb.appendChild(m); } m.textContent = stText('fail'); } else if (m) m.remove();
      },
      onData: function (l) { q('.px').textContent = F(l[4]); },
      onHover: function (c, p) {
        var ch = c[1] ? (c[4] / c[1] - 1) * 100 : 0, e = q('.ch'); e.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%'; e.className = 'ch ' + (ch >= 0 ? 'up' : 'down');
        q('[data-o]').textContent = F(c[1]); q('[data-h]').textContent = F(c[2]); q('[data-l]').textContent = F(c[3]); q('[data-c]').textContent = F(c[4]); q('[data-v]').textContent = w.nxChart.fmtV(c[5]);
        var t = new Date(c[0] * 1000); q('[data-t]').textContent = t.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      }
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-v]'); if (!b) return; var g = b.parentNode.getAttribute('data-g'), v = b.getAttribute('data-v');
      if (g === 'zoom') { mk.zoom(v === 'in' ? 1 / 1.3 : 1.3); return; }
      [].forEach.call(b.parentNode.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      if (g === 'sym') mk.setSym(v); else mk.setTF(v);
    });
    function kp(j) {
      var k = box.querySelector('[data-k]'), g = j && j.g, h = ''; if (!k || !j) return;
      function cell(lab, val) { h += '<div><small>' + lab + '</small><b>' + val + '</b></div>'; }
      cell(tri('تغییر ۲۴ ساعتهٔ بیت‌کوین', 'گۆڕانی ٢٤ کاتژمێری بیتکۆین', 'Bitcoin, 24h change'), '<span data-livechg="BTC">' + (j.c && j.c.BTC && j.c.BTC.ch != null ? (j.c.BTC.ch >= 0 ? '+' : '') + j.c.BTC.ch.toFixed(2) + '%' : '—') + '</span>');
      if (g) {
        cell(tri('ارزش کل بازار', 'بەهای گشتیی بازاڕ', 'Total market cap'), '$' + (g.mcap / 1e12).toFixed(2) + 'T' + (g.mcap_chg24 != null ? ' <span class="' + (g.mcap_chg24 >= 0 ? 'up' : 'down') + '" style="font-size:.78em">' + (g.mcap_chg24 >= 0 ? '+' : '') + g.mcap_chg24.toFixed(2) + '%</span>' : ''));
        if (g.vol) cell(tri('حجم معاملات ۲۴ ساعت', 'قەبارەی مامەڵەی ٢٤ کاتژمێر', '24h volume'), '$' + (g.vol / 1e9).toFixed(1) + 'B');
        if (g.btc_d != null) cell(tri('سهم بیت‌کوین', 'پشکی بیتکۆین', 'Bitcoin dominance'), Number(g.btc_d).toFixed(1) + '%');
      }
      if (j.fng) { var nm = FNG[j.fng.k]; cell(tri('ترس و طمع', 'ترس و تەماح', 'Fear & Greed'), j.fng.v + ' <span style="font:600 .78em var(--ek-font);color:rgba(255,255,255,.6)">' + (nm ? tri(nm[0], nm[1], j.fng.k) : esc(j.fng.k || '')) + '</span>'); }
      k.innerHTML = h; k.title = pick('ثبت‌شده در ', 'تۆمارکراو لە ', 'Recorded at ') + U.hhmm(j.t);
      U.seed(); if (w.liveRefresh) w.liveRefresh();
    }
    if (tk) kp(tk); else U.ticker().then(kp, function () { });
    if (w.ekChrome && w.ekChrome.label) w.ekChrome.label(U.lang());
  }

  /* the order of the rail is the order of "next" and "previous" everywhere */
  function adopt() { if (!w.ekDeck) return false; var ids = w.ekDeck.ids; ids.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); }); order = ids.slice(); sync(w.ekDeck.cur()); return true; }
  w.ekNX = { door: door, open: open };
  if (!adopt()) setTimeout(adopt, 0);
  if (w.ekChrome && w.ekChrome.label) w.ekChrome.label(U.lang());
})();
