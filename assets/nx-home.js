/* entekhab.net — interface v3 "Nexus": the homepage stage.
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
  /* the swap page (/swap/): two arrows passing each other */
  var SWAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h14m0 0-3.5-3.5M18 8l-3.5 3.5M20 16H6m0 0 3.5 3.5M6 16l3.5-3.5"/></svg>';
  var SWORDS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/></svg>';
  /* the morning panel: the sun over the horizon */
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 5v3M4.6 9.6l2 2M19.4 9.6l-2 2M7 22h10"/></svg>';
  var DEF = [
    /* owner 2026-11-24: the eight panels carry the best of the site. One side is the market as it moves, the other is
       what a reader does here: swap, read, learn. Two pages of their own (the swap, the battle) took the places of
       Categories and Library, which stay in the rail below and in the page (np: no panel). */
    { id: 'market', col: 'a', s: ['بازار', 'بازاڕ', 'Market'] },
    { id: 'command', col: 'a', s: ['اتاق فرمان', 'ژووری فەرمان', 'Command room'] },
    { id: 'intel', col: 'a', s: ['داشبورد', 'داشبۆرد', 'Dashboard'] },
    { id: 'battle', col: 'a', href: '/battle/', s: ['نبرد من', 'شەڕی من', 'My Battle'],
      chips: [['اوردربوک', 'ئۆردەربووک', 'Order book'], ['معاملات زنده', 'مامەڵەی زیندوو', 'Live trades'], ['لیکوئیدها', 'لیکویدەکان', 'Liquidations']],
      line: ['گاوها در برابر خرس‌ها · سه‌بعدی', 'گاکان بەرامبەر ورچەکان · سێ‌ڕەهەندی', 'Bulls against bears · in 3D'] },
    /* owner 2026-11-26: "what does a posts archive mean, the visitor has not even started yet". The first panel of this
       side is the visitor's morning instead: the next market-moving release, what the whales moved in a day, and the
       newest headline, with the whole day one tap away (/today/). The archive stays a room, reached from the wire. */
    { id: 'today', col: 'b', href: '/today/', live: 1, s: ['امروزِ تو، در یک نگاه', 'ئەمڕۆی تۆ، بە یەک نیگا', 'Your day at a glance'],
      line: ['همهٔ ۲۴ ساعت در یک صفحه', 'هەموو ٢٤ کاتژمێر لە یەک پەڕەدا', 'The whole 24 hours on one page'] },
    { id: 'feed', np: 1, s: ['آرشیو', 'ئەرشیف', 'Archive'] },
    { id: 'swap', col: 'b', href: '/swap/', s: ['تبدیل رمزارز', 'گۆڕینەوەی دراو', 'Swap'],
      chips: [['بیت‌کوین', 'بیتکۆین', 'Bitcoin'], ['ترون', 'ترۆن', 'Tron'], ['سولانا', 'سۆلانا', 'Solana'], ['اتریوم و BNB', 'ئیتریۆم و BNB', 'Ethereum & BNB']],
      line: ['۴۶ شبکه · از کیف پول خودتان', '٤٦ تۆڕ · لە جزدانی خۆتەوە', '46 networks · from your own wallet'] },
    { id: 'learnmap', col: 'b', s: ['یادگیری', 'فێربوون', 'Learning'] },
    { id: 'coinswall', col: 'b', s: ['کوین‌ها', 'دراوەکان', 'Coins'] },
    { id: 'hall', np: 1, s: ['دسته‌ها', 'پۆلەکان', 'Categories'] },
    { id: 'library', np: 1, s: ['کتابخانه', 'کتێبخانە', 'Library'] }
  ];
  /* owner 2026-11-25: the rail used to repeat the names of the panels standing right above it — Market, Command room,
     Dashboard, Archive, Coins… — so the dock said nothing the first screen did not already say. It now carries the best
     of the site from the menus instead, and only pages whose name appears nowhere on the homepage: no Market, no Swap,
     no Battle, no Learning map, no Coins, Categories or Library, and not "Understanding Bitcoin" either, which is a
     button on the first screen. Satoshi stays, pinned past the separator where it was. Short labels, because this is a
     dock: the full titles live in the header menu (scripts/chrome.py NAV), and these follow its wording. The rooms of
     the homepage are reached from the panels themselves; the rail no longer carries data-d, which the room highlight
     and the arrow keys simply find nothing to mark, exactly as when no room is open. */
  var BEST = [
    ['/heatmap/', 'نقشهٔ حرارتی', 'نەخشەی گەرمی', 'Heatmap'],
    ['/calendar/', 'تقویم اقتصادی', 'ڕۆژژمێری ئابووری', 'Calendar'],
    ['/whales/', 'رادار نهنگ‌ها', 'ڕاداری نەهەنگەکان', 'Whale radar'],
    ['/reality/', 'واقعیت‌سنج', 'ڕاستی‌پێو', 'Reality check'],
    ['/track-record/', 'کارنامهٔ کانال', 'کارنامەی کەناڵ', 'Track record'],
    ['/academy/', 'آکادمی', 'ئەکادیمیا', 'Academy'],
    ['/encyclopedia/', 'دانشنامه', 'زانستنامە', 'Encyclopedia'],
    ['/kids/', 'بیت‌کوین کودکان', 'بیتکۆین بۆ منداڵان', 'For juniors'],
    ['/tools/', 'ابزارها', 'ئامرازەکان', 'Tools'],
    ['/podcast/', 'پادکست', 'پۆدکاست', 'Podcast'],
    ['/me/', 'فضای من', 'بۆشاییی من', 'My space'],
    ['/app/', 'اپلیکیشن‌ها', 'ئەپەکان', 'Apps']
  ];
  var FNG = { 'Extreme Fear': ['ترس شدید', 'ترسی زۆر'], 'Fear': ['ترس', 'ترس'], 'Neutral': ['خنثی', 'بێلایەن'], 'Greed': ['طمع', 'تەماح'], 'Extreme Greed': ['طمع شدید', 'تەماحی زۆر'] };
  function cnt(sel, fa, ckb, en) { var e = d.querySelector(sel), v = e && e.textContent.trim(); return v ? esc(v) + ' ' + pick(fa, ckb, en) : ''; }
  function nfmt(n) { return dg(Number(n).toLocaleString('en-US')).replace(/,/g, U.lang() === 'en' ? ',' : '٬'); }

  /* ------------------------------------------------------------------ build */
  /* index.html already carries this stage as plain markup (the output of the template below, written there by
     scripts/nx_prerender.py together with a hash of it in data-tpl), so a visitor on a slow connection sees it before
     this script arrives. If the template gives the same markup now (same hash), what is on the page is used as it
     stands, including anything other scripts have already filled in (the live price); if not (another language, or
     a newer template than the page was written with), it is rebuilt in place. */
  function h32(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(36); }
  var nx = d.getElementById('nx'), pre = !!nx;
  if (!nx) { nx = d.createElement('section'); nx.className = 'nx'; nx.id = 'nx'; nx.setAttribute('aria-labelledby', 'nx-h'); }
  var cols = { a: '', b: '' }, doors = {}, order = [];
  var rail = BEST.map(function (B) { return '<a href="' + B[0] + '">' + tri(B[1], B[2], B[3]) + '</a>'; }).join('');
  DEF.forEach(function (D) {
    if (D.href) {                                   /* a page of its own: the panel is a plain link to it */
      var hb = ''; (D.chips || []).forEach(function (c) { hb += tri(c[0], c[1], c[2], 'span'); });
      cols[D.col] += '<a class="nx-p nx-pg' + (D.live ? ' nx-td' : '') + '" href="' + D.href + '" data-k="' + D.id + '"><span class="nx-pt">' + tri(D.s[0], D.s[1], D.s[2], 'b', 'ekd-t') + '<i class="nx-go" aria-hidden="true">' + GO + '</i></span>' +
        '<i class="nx-wm" aria-hidden="true">' + (D.id === 'swap' ? SWAP : D.live ? SUN : SWORDS) + '</i><span class="nx-pb">' + (D.live ? '<ul class="nx-fl" data-c="' + D.id + '"></ul>' : '<span class="nx-chips">' + hb + '</span>') + tri(D.line[0], D.line[1], D.line[2], 'span', 'nx-s') + '</span></a>';
        return;
    }
    var sec = d.getElementById(D.id); if (!sec) return;
    var t = sec.querySelector('h2[data-i]'), l = sec.querySelector('p.lead[data-i]'), link = D.id === 'library' ? sec.querySelector('a[href]') : D.id === 'learnmap' ? sec.querySelector('a[href="/map/"]') : null;   /* these two go straight to their page */
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
    if (!D.np) cols[D.col] += '<a class="nx-p" href="' + href + '"' + (link ? '' : ' data-d="' + D.id + '"') + ' data-k="' + D.id + '"><span class="nx-pt">' + title + '<i class="nx-go" aria-hidden="true">' + GO + '</i></span><span class="nx-pb">' + body + '</span></a>';
    if (!link) order.push(D.id);
  });
  var role = hero.querySelector('.role[data-i]');
  var tpl = '<div class="nx-bg" aria-hidden="true"><div class="nx-bgc"></div></div><svg class="nx-links" aria-hidden="true"></svg>' +
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
    '<a class="nx-btn nx-swap" href="/swap/">' + SWAP + tri('تبدیل رمزارز', 'سواپ', 'Swap') + '</a>' +
    '<a class="nx-btn" href="/bitcoin/">' + HOME + tri('درک بیت‌کوین', 'تێگەیشتن لە بیتکۆین', 'Understanding Bitcoin') + '</a></div></div>' +
    '<div class="nx-ps"><div class="nx-col nx-a">' + cols.a + '</div><div class="nx-col nx-b">' + cols.b + '</div></div>';
  if (pre) { var t0 = d.createElement('div'); t0.innerHTML = tpl; if (h32(t0.innerHTML) !== nx.getAttribute('data-tpl')) { nx.classList.add('nx-re'); nx.innerHTML = tpl; } }
  else nx.innerHTML = tpl;
  if (main.firstElementChild !== nx) main.insertBefore(nx, main.firstChild);
  var mid = nx.querySelector('.nx-mid'), nxt = d.getElementById('next'); if (nxt) mid.appendChild(nxt);
  var R = d.createElement('div'); R.id = 'nxr'; R.setAttribute('role', 'navigation');   /* not <nav>: the homepage styles bare nav elements */
  R.innerHTML = '<a class="nxr-home" href="#" data-home>' + HOME + tri('خانه', 'ماڵەوە', 'Home') + '</a>' + rail + '<i class="nxr-sep" aria-hidden="true"></i><a class="nxr-sat" href="/satoshi/">' + tri('ساتوشی', 'ساتۆشی', 'Satoshi') + '</a>' +
    '<a class="nxr-sat" href="/station/">' + tri('جهان انتخاب', 'جیهانی Entekhab', 'Entekhab world') + '</a>';   /* the game world (/station/), owner 2026-11-27 */
  d.body.appendChild(R);
  /* the same glass lens as the header, the footer and the menu: it rides the dock and rests on the section in view */
  (function lens(n) { if (w.ekGlass) w.ekGlass(R, { sel: 'a', on: 'a.on', r: 13, bead: 30 }); else if (n < 40) setTimeout(function () { lens(n + 1); }, 150); })(0);
  function railLabel() { R.setAttribute('aria-label', pick('بهترین‌های سایت', 'باشترینەکانی ماڵپەڕ', 'The best of the site')); }
  railLabel();
  [].forEach.call(nx.querySelectorAll('.nx-p[data-d]'), function (p) { doors[p.getAttribute('data-d')] = p; });
  var panels = [].slice.call(nx.querySelectorAll('.nx-p'));
  function vis(e) { return !!(e && e.offsetParent !== null && e.getClientRects().length); }
  function door(id) { var p = doors[id]; if (vis(p)) return p; var r = R.querySelector('[data-d="' + id + '"]'); return vis(r) ? r : null; }

  /* ------------------------------------------------------------------ the coin */
  var cbox = nx.querySelector('.nx-coin'), coin = null, gx = null, halv = null, nc = navigator.connection || {}, phone = w.innerWidth < 821;
  /* without WebGL (no graphics chip, data saver, a lost context) the still coin is set in motion by assets/nx-cosmos.js
     with the same physics, so it can still be flicked and the galaxy has one motion to follow */
  function still() {
    try { coin = w.nxSpin ? w.nxSpin(cbox, { area: nx, hit: cbox.querySelector('.nx-hit') }) : null; } catch (e) { coin = null; }
    if (!coin && !RM) cbox.classList.add('css');
    if (coin && cur) coin.pause(true);
  }
  function startCoin() {   /* after the page has loaded and is idle: the still coin is already on screen, the 3D one takes over */
    /* the real Earth (owner, 2026-11-27) takes the coin's and the galaxy's place: assets/space/nx-earth.js, same interface */
    if (w.nxEarth && de.classList.contains('ek-earth')) {
      try { coin = w.nxEarth(nx, cbox, { onready: function () { if (cur && coin) coin.pause(true); } }); } catch (e) { coin = null; }
      if (coin) return;
      de.classList.remove('ek-earth');
    }
    try {
      /* a machine without a graphics chip (nx-lite) gets the still coin set in motion straight away: on the one measured
         (2026-11-14) the WebGL coin fell to the watchdog after a second or two of stutter every time, and next to the galaxy
         it would only stutter more */
      if (w.nxCoin && !nc.saveData && !((navigator.deviceMemory || 8) <= 1) && !(de.classList.contains('nx-lite') && w.nxSpin)) coin = w.nxCoin(cbox.querySelector('canvas'), {
        yaw: 0, area: nx, hit: cbox.querySelector('.nx-hit'), dpr: phone ? 1.5 : 2, embers: phone ? 36 : 80,
        onready: function () { cbox.classList.add('gl'); if (cur && coin) coin.pause(true); }, onlost: function () { cbox.classList.remove('gl'); coin = null; still(); }
      });
    } catch (e) { coin = null; }
    if (!coin) still();
    galaxy();
  }
  /* the galaxy under the coin (assets/nx-cosmos.js), in the place of the pedestal: it turns with whichever coin is running */
  function galaxy() {
    if (gx || !w.nxGalaxy) return;
    try { gx = w.nxGalaxy(cbox, { area: nx, motion: function () { return coin && coin.motion ? coin.motion() : null; }, onready: function () { cbox.classList.add('gx'); } }); } catch (e) { gx = null; }
    if (!gx) return;
    if (halv != null) gx.halving(halv);
    if (cur) gx.pause(true);
  }
  (function () {
    var go = function () { (w.requestIdleCallback || function (f) { setTimeout(f, 200); })(startCoin, { timeout: 1500 }); };
    if (d.readyState === 'complete') go(); else w.addEventListener('load', go, { once: true });
  })();
  /* a tap on the coin (not a drag) sets it spinning, and the galaxy flares with it */
  (function () {
    var hit = cbox.querySelector('.nx-hit'), hx = 0, hy = 0; if (!hit) return;
    hit.addEventListener('pointerdown', function (e) { hx = e.clientX; hy = e.clientY; });
    hit.addEventListener('click', function (e) { if (Math.abs(e.clientX - hx) + Math.abs(e.clientY - hy) > 6) return; if (coin) coin.pulse(); if (gx) gx.pulse(); });
  })();
  if (w.nxCursor) { try { w.nxCursor(); } catch (e) { } }

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
  if (FINE && !RM && !de.classList.contains('nx-lite')) {   /* without a graphics chip the wall stands flat (nx.css), so the restyle on every move would buy nothing */
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
    if (gx && !cur) gx.pulse();
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
    if (gx) gx.pause(!!cur);
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
    if (bg && !bgc && w.innerWidth >= 821) bgc = w.nxChart(bg, { sym: 'BTC', tf: '1d', mini: true, n: 150, once: true });
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
    /* the door says what the room holds: the wall carries the channel's own coins and the biggest of the market
       after them, so it counts the wall itself and falls back to the archive's own figure before the wall is built */
    e = nx.querySelector('[data-s=coinswall]');
    if (e) { var nw = d.querySelectorAll('#wall button').length; e.innerHTML = nw ? nfmt(nw) + ' ' + pick('کوین', 'دراو', 'coins') : cnt('#sCoins', 'کوین', 'دراو', 'coins'); }
    e = nx.querySelector('[data-c=coinswall]');
    /* every coin of the wall, not the first nine: the door shows what the room holds. They wrap into rows (nx.css) */
    if (e && !e.firstChild) {
      h = ''; var seen = {};
      [].forEach.call(d.querySelectorAll('#wall img'), function (im) { var s = im.getAttribute('src'); if (!s || seen[s]) return; seen[s] = 1; h += '<img src="' + esc(s) + '" alt="" width="18" height="18" loading="lazy" decoding="async">'; });
      e.innerHTML = h;
    }
    /* the visitor's day: the next release that moves the market, the whales' day, the newest headline */
    try { e = nx.querySelector('[data-c=today]'); h = todayRows(); if (e && h && e.innerHTML !== h) e.innerHTML = h; } catch (x) { }
    /* dashboard: Fear & Greed and dominance, from the page's own market data when it has arrived, else the small ticker file */
    try { var f = X.market.fng, g = X.market.global; if (f && f.value != null) gauge(+f.value, f.class); if (g && g.btc_d != null) dom(g.btc_d); } catch (x) { }
  }
  var TD = { ev: null, wh: null, asked: 0 };
  function tdLoad() {
    if (TD.asked) return; TD.asked = 1; var v = Math.floor(Date.now() / 3e5);
    function get(f, k) { fetch('/data/' + f + '.json?v=' + v).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) { TD[k] = j; fill(); } }, function () { }); }
    get('ecocal', 'ev'); get('whales', 'wh');
  }
  function soon(sec) {
    var m = Math.round(sec / 60), hh = Math.round(sec / 3600), dd = Math.round(sec / 86400);
    return m < 60 ? pick(dg(Math.max(m, 1)) + ' دقیقهٔ دیگر', dg(Math.max(m, 1)) + ' خولەکی تر', 'in ' + Math.max(m, 1) + ' min')
      : hh < 36 ? pick(dg(hh) + ' ساعت دیگر', dg(hh) + ' کاتژمێری تر', 'in ' + hh + ' h')
        : pick(dg(dd) + ' روز دیگر', dg(dd) + ' ڕۆژی تر', 'in ' + dd + ' days');
  }
  function usd(n) { return n >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + Math.round(n / 1e6) + 'M' : ''; }
  function todayRows() {
    var h = '', now = Date.now() / 1000, L = U.lang();
    var ev = TD.ev && TD.ev.events, nx1 = null;
    if (ev) {
      var up = ev.filter(function (x) { return x.t > now && x.t < now + 8 * 86400; }).sort(function (a, b) { return a.t - b.t; });
      nx1 = up.filter(function (x) { return x.i === 'H'; })[0] || up.filter(function (x) { return x.i === 'M'; })[0] || null;
    }
    if (nx1) {
      var nm = (L === 'en' ? '' : nx1.tr && nx1.tr[L === 'ckb' ? 'ckb' : 'fa']) || nx1.n;
      h += '<li class="ev"><span dir="auto">' + esc(nm) + ' · ' + esc(nx1.c) + '</span><small>' + esc(soon(nx1.t - now)) + '</small></li>';
    }
    var wt = TD.wh && TD.wh.totals24, fresh = TD.wh && Date.now() - Date.parse(TD.wh.updated_at) < 6 * 36e5;
    if (wt && fresh) {
      var sum = 0; Object.keys(wt).forEach(function (k) { sum += +wt[k].usd || 0; });
      if (sum) h += '<li class="wh"><span>' + esc(pick('جابه‌جایی نهنگ‌ها در ۲۴ ساعت', 'گواستنەوەی نەهەنگەکان لە ٢٤ کاتژمێردا', 'Whales moved in 24 hours')) + '</span><small>' + esc(usd(sum)) + '</small></li>';
    }
    try {
      var p = VP().slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
      if (p) h += '<li class="nw"><span dir="auto">' + esc(PT(p).title || '') + '</span><small>' + esc(when(p.date)) + '</small></li>';
    } catch (x) { }
    return h;
  }
  setTimeout(tdLoad, 1200);
  function dom(v) { var e = nx.querySelector('[data-s=intel]'); if (e) e.textContent = pick('سهم بیت‌کوین از بازار: ', 'پشکی بیتکۆین لە بازاڕ: ', 'Bitcoin dominance: ') + dg(Number(v).toFixed(1)) + (U.lang() === 'en' ? '%' : '٪'); }
  function net(j) {
    var ul = nx.querySelector('[data-net]'); if (!ul || !j) return; var h = '', n = j.h && j.h.n;
    if (n) {
      var next = Math.ceil((n + 1) / 210000) * 210000, left = next - n, prog = (n - (next - 210000)) / 210000;
      h += '<li><b>' + n.toLocaleString('en-US') + '</b> ' + tri('بلاک', 'بلۆک', 'blocks') + '</li><li><b>' + left.toLocaleString('en-US') + '</b> ' + tri('بلاک تا هاوینگ', 'بلۆک تا هاڵڤینگ', 'blocks to the halving') + '</li>';
      var pg = nx.querySelector('.nx-ped .pg'); if (pg) setTimeout(function () { pg.setAttribute('stroke-dasharray', (prog * 100).toFixed(1) + ' 100'); }, 400);
      halv = prog; if (gx) gx.halving(prog);
    }
    if (j.g && j.g.mcap) h += '<li>' + tri('ارزش کل بازار', 'بەهای گشتیی بازاڕ', 'Total market cap') + ' <b>$' + (j.g.mcap / 1e12).toFixed(2) + 'T</b></li>';
    ul.innerHTML = h; ul.title = pick('ثبت‌شده در ', 'تۆمارکراو لە ', 'Recorded at ') + U.hhmm(j.t);
    if (j.fng && !nx.querySelector('[data-fg] svg')) gauge(+j.fng.v, j.fng.k);
    if (j.g && j.g.btc_d != null && !nx.querySelector('[data-s=intel]').textContent) dom(j.g.btc_d);
  }
  /* ------------------------------------------------------------------ under the stage: the reading floor
     owner 2026-11-27: "from here down to the footer needs a fundamental rethink: the harmony has to come back, one
     professional design that goes with the coloured header menu and the footer". Two things were wrong. The cards were
     grey boxes with a gold tint while the header and the footer wear the site's aurora edge (.br in chrome.css), so the
     middle of the page looked like another site. And six link tiles repeated names that already stand on the first
     screen or in its dock (Understanding Bitcoin, Learning map, Academy, Encyclopedia, Track record), against the rule
     written above BEST. So: no link tiles. What is here is what the first screen cannot hold, the reading.
       1. the week's dossiers: the most-read deep analysis as a lead with its own three-second summary, the next four
          as a numbered list. Ranked by the channel's real view counts, nothing else.
       2. the channel, stream by stream: one frame, a bar with the archive's real figures, three streams side by side
          (tabs on a phone, so the page stays short).
     Both wear the same frame as the footer's boxes: the aurora edge and the drifting clouds, lit only while on screen. */
  var HXA = '<svg class="hx-ar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg>';
  var HXS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
  var HXK = ['#5ef2d6', '#9b7bff', '#ff6fb5', '#ffcf6b', '#7cc8ff'];   /* the aurora of the header and the footer, one colour at a time */
  var hxIO = 'IntersectionObserver' in w ? new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('br-on', e.isIntersecting); }); }, { rootMargin: '60px' }) : null;
  function breathe(root) {
    var ok = false; try { ok = w.CSS && (CSS.supports('mask-composite', 'exclude') || CSS.supports('-webkit-mask-composite', 'xor')); } catch (e) { }
    if (!ok) return;
    [].forEach.call(root.querySelectorAll('.hx-fr'), function (el) {
      if (el.classList.contains('br')) return;
      el.style.setProperty('--br-d', (-Math.random() * 18).toFixed(2) + 's');
      var s = d.createElement('span'); s.className = 'br-neb'; s.setAttribute('aria-hidden', 'true'); el.insertBefore(s, el.firstChild);
      el.classList.add('br'); if (hxIO) hxIO.observe(el); else el.classList.add('br-on');
    });
  }
  /* write a block only when what was built has changed. Comparing with innerHTML does not work: the browser hands the
     markup back re-serialised (an escaped quote comes back as a quote), so every pass looked new and reloaded the pictures. */
  function put(el, h) { if (el._h !== h) { el._h = h; el.innerHTML = h; } }
  function hxTop(id, k, eye, h, l, act, under) {
    return '<div class="hx-top' + (under ? ' hx-scene' : '') + '"><div class="hx-tt"><span class="hx-eye" style="--k:' + k + '"><i></i>' + tri(eye[0], eye[1], eye[2]) + '</span>' +
      tri(h[0], h[1], h[2], 'h2', 'hx-h').replace('<h2 ', '<h2 id="' + id + '" ') + tri(l[0], l[1], l[2], 'p', 'hx-l') + (under || '') + '</div>' + (act || '') + '</div>';
  }
  /* a post's age in whole units a person would say: minutes, hours, then days ("۱۳۰ ساعت پیش" is nobody's sentence) */
  function when(iso) {
    var s = (Date.now() - Date.parse(iso)) / 1000; if (!isFinite(s)) return ''; if (s < 60) s = 60;
    var m = Math.round(s / 60), h = Math.round(s / 3600), dd = Math.round(s / 86400);
    return m < 60 ? pick(dg(m) + ' دقیقه پیش', dg(m) + ' خولەک لەمەوپێش', m + ' min ago')
      : h < 36 ? pick(dg(h) + ' ساعت پیش', dg(h) + ' کاتژمێر لەمەوپێش', h + ' h ago')
        : pick(dg(dd) + ' روز پیش', dg(dd) + ' ڕۆژ لەمەوپێش', dd + ' days ago');
  }
  /* a title as words: the channel opens many titles with a pictograph, which reads as noise in a list of headlines */
  var HXL; try { HXL = new RegExp('^[^\\p{L}\\p{N}«"(\\[]+', 'u'); } catch (e) { HXL = /^[\s -⯿️‌-‏\uD83C-􏰀-\uDFFF]+/; }
  function ttlOf(t) { return String(t.title || '').replace(HXL, '').replace(/\s+/g, ' ').trim(); }
  /* the post's own short summary: the line the channel writes under "in 3 seconds"; else the body after the title */
  function gist(t) {
    var raw = String(t.text || ''), L = raw.split('\n').map(function (x) { return x.replace(/[─-╿_=~*]{2,}/g, '').trim(); }).filter(Boolean), i;
    for (i = 0; i < L.length - 1; i++) if (L[i].indexOf('⚡') >= 0 && L[i].length < 40) return L[i + 1];
    var ttl = String(t.title || '').trim(), body = L.join(' ').replace(/\s+/g, ' '); if (body.indexOf(ttl) === 0) body = body.slice(ttl.length).trim();
    return body.replace(HXL, '');
  }
  function catChip(p) {
    var cn = '', cc = ''; try { var co = catOf(p.category); cn = cname(co); cc = co.color || ''; } catch (e) { }
    return { n: cn, c: /^#[0-9a-f]{3,8}$/i.test(cc) ? cc : '' };
  }
  function meta(p) { return '<time>' + esc(when(p.date)) + '</time>'; }   /* the order is the channel's view count; the count itself is not printed */

  var imp = d.createElement('section'); imp.className = 'hx nxi'; imp.id = 'nxi'; imp.setAttribute('aria-labelledby', 'nxi-h');
  imp.innerHTML = hxTop('nxi-h', HXK[3], ['پرونده‌های تحلیلی', 'دۆسیە شیکارییەکان', 'Analysis dossiers'],
    ['این هفته چه خوانده شد', 'ئەم هەفتەیە چی خوێندرایەوە', 'What was read this week'],
    ['پنج تحلیل عمیقِ هفته، به ترتیب بازدید در کانال. خلاصهٔ هر کدام همین‌جاست؛ متن کامل با یک لمس باز می‌شود.',
      'پێنج شیکاریی قووڵی هەفتە، بەپێی ژمارەی بینین لە کەناڵ. پوختەی هەر یەکێکیان هەر لێرەیە؛ دەقی تەواو بە یەک دەستلێدان دەکرێتەوە.',
      "The week's five deep analyses, ranked by views on the channel. Each summary is right here; one tap opens the full text."],
    '<div class="hx-as" aria-hidden="true"><div class="hx-as-t"><img src="/assets/home/astro.webp" srcset="/assets/home/astro-s.webp 322w, /assets/home/astro.webp 470w" sizes="(max-width:820px) 130px, 270px" alt="" width="470" height="760" decoding="async"><i class="hx-gl a"></i><i class="hx-gl b"></i></div></div>',
    '<a class="hx-act" href="/dossier/">' + tri('همهٔ پرونده‌ها', 'هەموو دۆسیەکان', 'All dossiers') + HXA + '</a>') +
    '<div class="hx-wk"><div class="hx-fr hx-lead"><div class="hx-in" data-lead></div></div><div class="hx-fr hx-rank"><ol class="hx-in" data-rank></ol></div></div>';
  /* owner 2026-11-27: "set the background to something like this [a neon nebula over an alien plain], and the
     astronauts, without a background, watching the mouse move". The nebula is the sky of the whole reading floor: the
     picture at the top, fading into deep space further down (nx.css). The two astronauts stand in the first band. They
     are one flat picture, so "watching" is done the way a picture can do it: the pair turns in depth toward the pointer
     and the light in each visor slides to the side the pointer is on. Nothing moves while the band is off screen, and
     nothing at all under prefers-reduced-motion or when motion is switched off on this device (ek-still). */
  var sky = d.createElement('div'); sky.className = 'hx-sky'; sky.id = 'hx-sky';
  sky.innerHTML = '<div class="hx-neb" aria-hidden="true"></div>';
  nx.parentNode.insertBefore(sky, nx.nextSibling); sky.appendChild(imp);
  (function () {
    var box = imp.querySelector('.hx-as'), t = box && box.firstChild; if (!t) return;
    var gl = box.querySelectorAll('.hx-gl'), tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, on = !('IntersectionObserver' in w);
    var calm = false; try { calm = w.matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) { }
    if (calm) return;
    function frame() {
      raf = 0; cx += (tx - cx) * 0.1; cy += (ty - cy) * 0.1;
      t.style.transform = 'rotateY(' + (cx * 17).toFixed(2) + 'deg) rotateX(' + (-cy * 6).toFixed(2) + 'deg) translate3d(' + (cx * 8).toFixed(1) + 'px,0,0)';
      for (var i = 0; i < gl.length; i++) gl[i].style.transform = 'translate3d(' + (cx * 46).toFixed(1) + '%,' + (cy * 34).toFixed(1) + '%,0)';
      if (Math.abs(tx - cx) > 0.003 || Math.abs(ty - cy) > 0.003) raf = requestAnimationFrame(frame);
    }
    function aim(e) {
      if (!on || de.classList.contains('ek-still')) return;
      var r = box.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / (w.innerWidth * 0.5), y = (e.clientY - (r.top + r.height * 0.14)) / (w.innerHeight * 0.5);
      tx = x < -1 ? -1 : x > 1 ? 1 : x; ty = y < -1 ? -1 : y > 1 ? 1 : y;
      if (!raf) raf = requestAnimationFrame(frame);
    }
    w.addEventListener('pointermove', aim, { passive: true });
    if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { on = es[0].isIntersecting; box.classList.toggle('on', on); }, { rootMargin: '80px' }).observe(box);
    else box.classList.add('on');
  })();
  function pic(p, wd, ht) {
    var src = p.photos[0]; try { src = wp(src, true); } catch (e) { }
    return '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async" width="' + wd + '" height="' + ht + '" onerror="this.parentNode.classList.add(\'no\');this.remove()">';
  }
  function featFill() {
    var lead = imp.querySelector('[data-lead]'), rank = imp.querySelector('[data-rank]'); if (!lead) return;
    var ps; try { ps = VP(); } catch (e) { return; }
    var lim = Date.now() - 7 * 864e5;
    var cand = ps.filter(function (p) { return p.photos && p.photos[0] && /\/deepimg\//.test(p.photos[0]) && Date.parse(p.date) > lim && p.q !== 'low'; })
      .map(function (p) { var t = {}; try { t = PT(p) || {}; } catch (e) { } return { p: p, t: t, ttl: ttlOf(t) }; }).filter(function (x) { return x.ttl; });
    cand.sort(function (a, b) { return (+b.p.views || 0) - (+a.p.views || 0) || (a.p.date < b.p.date ? 1 : -1); });
    imp.hidden = cand.length < 3;                                               /* a ranking of one or two is not a ranking */
    if (cand.length < 3) return;
    var a = cand[0], c = catChip(a.p), g = gist(a.t);
    var h = '<button type="button" class="hx-lb" data-post="' + esc(a.p.id) + '"><span class="hx-po">' + pic(a.p, 540, 675) + '</span>' +
      '<span class="hx-bd"><span class="hx-hx"><span class="hx-r1"><span class="hx-no" aria-hidden="true">' + dg(1) + '</span>' + (c.n ? '<span class="hx-cat"' + (c.c ? ' style="--cc:' + c.c + '"' : '') + '>' + esc(c.n) + '</span>' : '') + meta(a.p) + '</span>' +
      '<b dir="auto">' + esc(a.ttl) + '</b></span>' +
      (g ? '<span class="hx-g"><em>' + esc(pick('در ۳ ثانیه', 'لە ٣ چرکەدا', 'In 3 seconds')) + '</em><span dir="auto">' + esc(g.slice(0, 300)) + '</span></span>' : '') +
      '<span class="hx-cta">' + esc(pick('خواندن پرونده', 'خوێندنەوەی دۆسیە', 'Read the dossier')) + HXA + '</span></span></button>';
    put(lead, h);
    h = '';
    cand.slice(1, 5).forEach(function (x, i) {
      var cc = catChip(x.p);
      h += '<li><button type="button" data-post="' + esc(x.p.id) + '" style="--k:' + HXK[(i + 1) % HXK.length] + '"><span class="hx-n" aria-hidden="true">' + dg(i + 2) + '</span>' +
        '<span class="hx-rt"><span class="hx-m">' + (cc.n ? '<i' + (cc.c ? ' style="--cc:' + cc.c + '"' : '') + '>' + esc(cc.n) + '</i>' : '') + meta(x.p) + '</span><b dir="auto">' + esc(x.ttl) + '</b></span>' +
        '<span class="hx-po sm">' + pic(x.p, 120, 150) + '</span></button></li>';
    });
    put(rank, h);
  }
  imp.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-post]'); if (b) { try { openPost(b.getAttribute('data-post')); } catch (x) { } } });

  var WG = [['news,etf_institutional,regulation', 'خبر و نهادها', 'هەواڵ و دامەزراوەکان', 'News and institutions'], ['technical,onchain,signal', 'تحلیل و آن‌چین', 'شیکاری و ئۆن‌چەین', 'Analysis and on-chain'], ['education,security,products,community', 'آموزش و امنیت', 'فێرکاری و ئاسایش', 'Learning and security']];
  var wire = d.createElement('section'); wire.className = 'hx nxw'; wire.id = 'nxw'; wire.setAttribute('aria-labelledby', 'nxw-h');
  wire.innerHTML = hxTop('nxw-h', HXK[0], ['کانال Coin_Kurd', 'کەناڵی Coin_Kurd', 'The Coin_Kurd channel'],
    ['جریان کانال، دسته‌به‌دسته', 'ڕەوتی کەناڵ، پۆل بە پۆل', 'The channel, stream by stream'],
    ['هر پست حداکثر ۱۵ دقیقه بعد از انتشار این‌جاست؛ با موضوع، کوین و زمانش، و قابل جستجو.',
      'هەر پۆستێک لە ماوەی ١٥ خولەکدا دوای بڵاوبوونەوە لێرەیە؛ بە بابەت، دراو و کاتەکەیەوە، و دەتوانیت بەدوایدا بگەڕێیت.',
      'Every post lands here within 15 minutes of being published, filed by topic, coin and time, and searchable.']) +
    '<div class="hx-fr hx-wire"><div class="hx-in"><div class="hx-bar"><ul class="nxw-k" data-wk></ul>' +
    '<button type="button" class="hx-act sm" data-wall="all">' + HXS + tri('جستجو در آرشیو', 'گەڕان لە ئەرشیف', 'Search the archive') + '</button></div>' +
    '<div class="hx-tabs" role="tablist">' + WG.map(function (g, i) { return '<button type="button" role="tab" id="hx-t' + i + '" aria-controls="hx-c' + i + '" aria-selected="' + (i ? 'false' : 'true') + '" data-tab="' + i + '" style="--k:' + HXK[i] + '">' + tri(g[1], g[2], g[3]) + '</button>'; }).join('') + '</div>' +
    '<div class="hx-cols">' + WG.map(function (g, i) {
      return '<div class="hx-col' + (i ? '' : ' on') + '" id="hx-c' + i + '" role="tabpanel" aria-labelledby="hx-t' + i + '" data-cat="' + g[0] + '" style="--k:' + HXK[i] + '"><div class="hx-hd"><h3>' + tri(g[1], g[2], g[3]) + '</h3><span class="hx-cn" data-wn></span>' +
        '<button type="button" class="hx-all" data-wall="' + g[0].split(',')[0] + '">' + tri('همه', 'هەموو', 'All') + HXA + '</button></div><ol class="hx-list" data-wl></ol></div>';
    }).join('') + '</div></div></div>';
  sky.appendChild(wire);
  breathe(imp); breathe(wire);
  var HXJ = /^(فارسی|کوردی|English|العربية|عربي)(\s|\(|$)/;                   /* a language label left over as a "title": not a headline */
  function wireFill() {
    var ps; try { ps = VP().slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }); } catch (e) { return; }
    [].forEach.call(wire.querySelectorAll('.hx-col'), function (col) {
      var cats = col.getAttribute('data-cat').split(','), h = '', k = 0;
      ps.some(function (p) {
        if (cats.indexOf(p.category) < 0) return false;
        var t = {}; try { t = PT(p) || {}; } catch (e) { }
        var ttl = ttlOf(t); if (ttl.length < 12 || HXJ.test(ttl)) return false;
        var body = gist(t), coins = Array.isArray(p.coins) ? p.coins.slice(0, 3) : [], lg = '';
        coins.forEach(function (c) { if (/^[A-Z0-9]{2,10}$/.test(c)) lg += '<img src="/data/logos/' + c + '.png" alt="' + c + '" title="' + c + '" width="20" height="20" loading="lazy" decoding="async" onerror="this.remove()">'; });
        var cc = catChip(p);
        h += '<li><button type="button" data-post="' + esc(p.id) + '"' + (cc.c ? ' style="--cc:' + cc.c + '"' : '') + '><span class="hx-m">' + (cc.n ? '<i>' + esc(cc.n) + '</i>' : '') + '<time>' + esc(when(p.date)) + '</time>' + (lg ? '<span class="hx-lg">' + lg + '</span>' : '') + '</span><b dir="auto">' + esc(ttl) + '</b>' + (body ? '<span class="hx-x" dir="auto">' + esc(body.slice(0, 150)) + '</span>' : '') + '</button></li>';
        return ++k >= 4;
      });
      var ol = col.querySelector('[data-wl]'); if (h) put(ol, h);
      var n = 0; try { cats.forEach(function (c) { n += S.meta.by_category[c] || 0; }); } catch (e) { }
      col.querySelector('[data-wn]').textContent = n ? nfmt(n) + ' ' + pick('پست', 'پۆست', 'posts') : '';
    });
    var k = wire.querySelector('[data-wk]'), kh = '';
    [['#sPosts', 'پست', 'پۆست', 'posts'], ['#sCats', 'دسته', 'پۆل', 'categories'], ['#sCoins', 'کوین', 'دراو', 'coins']].forEach(function (x) { var e = d.querySelector(x[0]), v = e && e.textContent.trim(); if (v) kh += '<li><b>' + esc(v) + '</b>' + pick(x[1], x[2], x[3]) + '</li>'; });
    /* the three figures above hold a bare number, so .nxw-k b lays them out left-to-right. This one holds a date,
       which is a number AND words: left-to-right would throw the day to the far end, printing "آذر ۱۴۰۵ ۱".
       nxw-dt gives it back the direction of the page it sits on. */
    var up = d.querySelector('#sUpd'), uv = up && up.textContent.trim(); if (uv) kh += '<li><i class="hx-dot" aria-hidden="true"></i>' + pick('آخرین به‌روزرسانی', 'دوایین نوێکردنەوە', 'last update') + '<b class="nxw-dt">' + esc(uv.replace(/^\d{4}-\d{2}-\d{2}\s*/, '')) + '</b></li>';
    put(k, kh);
  }
  wire.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-post]'); if (b) { try { openPost(b.getAttribute('data-post')); } catch (x) { } return; }
    var tb = e.target.closest && e.target.closest('[data-tab]');
    if (tb) {
      var n = tb.getAttribute('data-tab');
      [].forEach.call(wire.querySelectorAll('[data-tab]'), function (x) { x.setAttribute('aria-selected', x === tb ? 'true' : 'false'); });
      [].forEach.call(wire.querySelectorAll('.hx-col'), function (x) { x.classList.toggle('on', x.id === 'hx-c' + n); });
      return;
    }
    var a = e.target.closest && e.target.closest('[data-wall]'); if (a) { open('feed'); }
  });

  var tk = null;
  U.ticker().then(function (j) { tk = j; net(j); U.seed(); }, function () { });
  fill(); wireFill(); featFill(); charts(); U.seed(); U.live();
  [900, 2200, 5000, 10000].forEach(function (ms) { setTimeout(function () { fill(); wireFill(); featFill(); links(); }, ms); });
  new MutationObserver(function () {
    setTimeout(function () {
      railLabel(); fill(); wireFill(); featFill(); if (tk) net(tk);
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
      '<div class="nxm-leg"><b data-sy>BTC/USDT</b><span class="px">—</span><span class="ch"></span><span>O <b data-o></b></span><span>H <b data-h></b></span><span>L <b data-l></b></span><span>C <b data-c></b></span><span>Vol <b data-v></b></span><span data-t></span></div>' +
      '<div class="nxm-cv"></div><div class="nxm-k" data-k></div><div class="nxm-r" data-r></div>' +
      '<p class="nxm-note">' + tri('کندل‌ها مستقیم از دادهٔ عمومی بایننس (جفت‌ارز با تتر) خوانده می‌شوند؛ اگر اتصال برقرار نشود، نمودار همین را می‌گوید و عددی ساخته نمی‌شود. با کشیدن جابه‌جا کنید؛ برای بزرگ‌نمایی با چرخ ماوس، اول روی نمودار کلیک کنید.',
        'مۆمەکان ڕاستەوخۆ لە داتای گشتیی بایننس (جووت لەگەڵ تەتەر) دەخوێنرێنەوە؛ ئەگەر پەیوەندی نەکرێت، هێڵکاری هەمان شت دەڵێت و هیچ ژمارەیەک دروست ناکرێت. بە ڕاکێشان بیجووڵێنە؛ بۆ گەورەکردن بە چەرخی ماوس، سەرەتا کرتە لە هێڵکاری بکە.',
        'Candles are read straight from Binance public market data (USDT pairs); if the connection fails the chart says so and no number is made up. Drag to pan; click the chart first to zoom with the wheel.') + '</p>';
    var pro = d.createElement('a'); pro.className = 'nxm-pro'; pro.href = '/market/';
    pro.innerHTML = '<b>' + tri('بازار زندهٔ کامل', 'بازاڕی زیندووی تەواو', 'The full live market') + '</b><span>' +
      tri('همهٔ کوین‌های بایننس و دلار، طلا و سکه به تومان · تا ۱۶ نمودار · ۱۷ نوع نمودار و ۷۰ اندیکاتور · بازپخش · هشدار قیمت · تقویم اقتصادی با هشدار',
        'هەموو کۆینەکانی بایننس و دۆلار، زێڕ و سکە بە تمەن · تا ١٦ چارت · ١٧ جۆری چارت و ٧٠ ئیندیکاتۆر · دووبارە پەخش · ئاگادارکەرەوەی نرخ · ڕۆژژمێری ئابووری بە ئاگادارکردنەوە',
        'Every Binance coin, plus the dollar, gold and coins in toman · up to 16 charts · 17 chart types and 70 indicators · replay · price alerts · economic calendar with alerts') + '</span><i aria-hidden="true">→</i>';
    box.insertBefore(pro, box.firstChild);
    var map = d.createElement('a'); map.className = 'nxm-pro'; map.href = '/heatmap/';      /* the market map, next to the live market */
    map.innerHTML = '<b>' + tri('نقشهٔ بازار', 'نەخشەی بازاڕ', 'The market map') + '</b><span>' +
      tri('نقشهٔ حرارتی و حباب‌های ۲۵۰ ارز در ۹ تایم‌فریم، دوبعدی و سه‌بعدی · جریان پول · نقدینگی و دفتر سفارش · ETFها',
        'نەخشەی گەرمی و بڵقی ٢٥٠ دراو لە ٩ تایمفرەیمدا، دوو و سێ ڕەهەندی · ڕەوتی پارە · نەختینەیی و دەفتەری داواکاری · ETFەکان',
        'Heatmap and bubbles of 250 coins on nine timeframes, in 2D and 3D · money flow · liquidity and order books · ETFs') + '</span><i aria-hidden="true">→</i>';
    box.insertBefore(map, pro.nextSibling);
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
      if (g === 'sym') pickSym(v); else mk.setTF(v);
    });
    function pickSym(s) {
      mk.setSym(s); q('[data-sy]').textContent = s + '/USDT';
      [].forEach.call(box.querySelectorAll('[data-g=sym] button'), function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-v') === s ? 'true' : 'false'); });
      [].forEach.call(box.querySelectorAll('.nxm-rank tr[data-sym]'), function (x) { x.classList.toggle('on', x.getAttribute('data-sym') === s); });
    }
    /* the most traded coins of the last 24 hours, from the site's own scan of Binance; prices and changes tick live.
       A coin is listed only with its own logo. Choosing one puts it on the chart above. */
    var STB = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDE', 'USD1', 'BFUSD', 'XUSD', 'EUR', 'EURI', 'AEUR', 'RLUSD', 'PYUSD', 'USDP'], rt = 0;
    function rank() {
      var host = box.querySelector('[data-r]'), cs, at = ''; if (!host || host.firstChild) return;
      try { cs = X.market.coins.filter(function (c) { return c && c.qvol > 0 && c.price > 0 && STB.indexOf(c.coin) < 0 && /^[A-Z0-9]{2,10}$/.test(c.coin); }).sort(function (a, b) { return b.qvol - a.qvol; }).slice(0, 12); at = X.market.updated_at; } catch (e) { cs = null; }
      if (!cs || !cs.length) { if (++rt < 6) setTimeout(rank, 2000); return; }
      var h = '<h3>' + tri('پرمعامله‌ترین‌های ۲۴ ساعت گذشته در بایننس', 'زۆرترین مامەڵەکراوەکانی ٢٤ کاتژمێری ڕابردوو لە بایننس', 'Most traded on Binance in the last 24 hours') +
        ' <small>' + tri('قیمت و تغییر زنده‌اند؛ برای دیدن نمودار، ارز را انتخاب کنید', 'نرخ و گۆڕان ڕاستەوخۆن؛ بۆ بینینی هێڵکاری دراوەکە هەڵبژێرە', 'price and change are live; choose a coin to chart it') + '</small></h3>' +
        '<table class="nxm-rank"><thead><tr><th scope="col" class="n">#</th><th scope="col">' + tri('ارز', 'دراو', 'Coin') + '</th><th scope="col">' + tri('قیمت', 'نرخ', 'Price') + '</th><th scope="col">' + tri('۲۴ ساعت', '٢٤ کاتژمێر', '24h') +
        '</th><th scope="col" class="hm">' + tri('۴۸ ساعت اخیر', '٤٨ کاتژمێری دوایی', 'Last 48h') + '</th><th scope="col" class="hm">' + tri('حجم ۲۴ ساعته', 'قەبارەی ٢٤ کاتژمێر', '24h volume') + '</th></tr></thead><tbody>';
      cs.forEach(function (c, i) {
        var sp = c.spark || [], lo = Math.min.apply(null, sp), hi = Math.max.apply(null, sp), pts = '', up = sp.length > 1 && sp[sp.length - 1] >= sp[0];
        sp.forEach(function (v, k) { pts += (k / (sp.length - 1) * 90 + 1).toFixed(1) + ',' + (24 - (hi > lo ? (v - lo) / (hi - lo) : .5) * 22).toFixed(1) + ' '; });
        h += '<tr data-sym="' + c.coin + '"' + (c.coin === 'BTC' ? ' class="on"' : '') + '><td class="n">' + (i + 1) + '</td><td><button type="button" data-sym="' + c.coin + '"><img src="/data/logos/' + c.coin + '.png" alt="" width="24" height="24" loading="lazy" decoding="async">' + c.coin + '</button></td>' +
          '<td class="num"><b data-live="' + c.coin + '">' + U.fmtUsd(c.price) + '</b></td><td class="num"><span data-livechg="' + c.coin + '" class="' + (c.chg24 >= 0 ? 'up' : 'down') + '">' + (c.chg24 == null ? '' : (c.chg24 >= 0 ? '+' : '') + c.chg24.toFixed(2) + '%') + '</span></td>' +
          '<td class="hm">' + (pts ? '<svg viewBox="0 0 92 26" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + (up ? '#34d399' : '#ff5a4d') + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>' : '') + '</td>' +
          '<td class="num hm">$' + w.nxChart.fmtV(c.qvol) + '</td></tr>';
      });
      host.innerHTML = h + '</tbody></table>'; host.title = pick('اسکن بایننس در ', 'سکانی بایننس لە ', 'Binance scan of ') + U.hhmm(at);
      [].forEach.call(host.querySelectorAll('img'), function (im) { im.addEventListener('error', function () { var tr = im.closest('tr'); if (tr) tr.remove(); }); });   /* no logo, no row */
      host.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button[data-sym]'); if (!b) return; pickSym(b.getAttribute('data-sym')); try { box.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' }); } catch (x) { } });
      if (w.liveRefresh) w.liveRefresh();
    }
    rank();
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
