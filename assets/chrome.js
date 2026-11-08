/* entekhab.net — site chrome runtime (no dependencies).
   Language labels for header/footer, mega menus, mobile "all sections" sheet, search, active links, app prompts. */
(function () {
  'use strict';
  var d = document, de = d.documentElement, H = d.getElementById('ekh'), F = d.getElementById('ekf'), B = d.getElementById('ekb');
  if (!H) return;
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  };
  /* clickjacking protection: GitHub Pages cannot send X-Frame-Options / frame-ancestors */
  if (window.top !== window.self) { try { window.top.location.href = location.href; } catch (e) { d.body && (d.body.style.display = 'none'); } }
  var UA = navigator.userAgent || '', APP = /EntekhabApp/i.test(UA);
  if (APP) de.classList.add('ek-app');
  var X = function (n) { var m = { close: '<path d="M6 6l12 12M18 6 6 18"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>', swords: '<path d="M3 3h4l10 10"/><path d="m14.5 15.5 2.5 2.5"/><path d="M21 3h-4L7 13"/><path d="m9.5 15.5-2.5 2.5"/><path d="m5 15 4 4"/><path d="m19 15-4 4"/><path d="m3.5 20.5 2-2"/><path d="m20.5 20.5-2-2"/>', down: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>' }; return '<svg class="ek-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + m[n] + '</svg>'; };
  var tri = function (fa, ckb, en, tag, cls) { tag = tag || 'span'; return '<' + tag + ' class="ek-i' + (cls ? ' ' + cls : '') + '" data-fa="' + fa + '" data-ckb="' + ckb + '" data-en="' + en + '">' + fa + '</' + tag + '>'; };

  /* ---------- language ---------- */
  var cur = function () { var l = (de.getAttribute('lang') || 'fa').toLowerCase(); return (l.indexOf('ckb') === 0 || l === 'ku') ? 'ckb' : l.indexOf('en') === 0 ? 'en' : 'fa'; };
  var chromeLang = null;
  function label(l) {
    chromeLang = l;
    var all = d.querySelectorAll('.ek-i'), i, v;
    for (i = 0; i < all.length; i++) { v = all[i].getAttribute('data-' + l); if (v != null && all[i].textContent !== v) all[i].textContent = v; }
    var ar = d.querySelectorAll('[data-a' + l + ']');
    for (i = 0; i < ar.length; i++) { v = ar[i].getAttribute('data-a' + l); ar[i].setAttribute('aria-label', v); ar[i].setAttribute('title', v); }
    var bs = d.querySelectorAll('#langs button,#eks .ek-lang button');
    for (i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-l') === l);
    var sk = d.querySelector('.ek-skip'); if (sk) sk.textContent = { fa: 'پرش به محتوا', ckb: 'بازدان بۆ ناوەڕۆک', en: 'Skip to content' }[l];
    var q = d.querySelector('#ekq input'); if (q) q.placeholder = PH[l];
  }
  var PH = { fa: 'جستجو در مطالب، کوین‌ها و اصطلاحات…', ckb: 'گەڕان لە بابەت، دراو و زاراوەکان…', en: 'Search posts, coins and terms…' };
  /* pages with their own i18n (homepage, tool pages) switch <html lang>; we follow it */
  var pageI18n = !!(window.uiLang || window.I18N || d.querySelector('[data-t],[data-i]'));
  try { new MutationObserver(function () { label(cur()); }).observe(de, { attributes: true, attributeFilter: ['lang'] }); } catch (e) { }
  function setLang(l) {
    if (pageI18n) return; // the page's own handler on #langs does the work and changes <html lang>
    var alt = d.querySelector('link[rel="alternate"][hreflang="' + l + '"]'), href = alt && alt.getAttribute('href');
    ls.set('ck_lang', l);
    if (href) { try { var u = new URL(href, location.href); if (u.pathname !== location.pathname) { location.href = u.href; return; } } catch (e) { } }
    label(l);
  }
  var LG = d.getElementById('langs');
  if (LG) LG.addEventListener('click', function (e) { var b = e.target.closest('button[data-l]'); if (b) setLang(b.getAttribute('data-l')); });

  /* ---------- mega menus ---------- */
  var mis = [].slice.call(H.querySelectorAll('.ek-mi')), tOpen = null, tClose = null;
  function shut(ex) { mis.forEach(function (m) { if (m !== ex) { m.classList.remove('open'); m.querySelector('.ek-mt').setAttribute('aria-expanded', 'false'); } }); }
  function open(m) { shut(m); m.classList.add('open'); m.querySelector('.ek-mt').setAttribute('aria-expanded', 'true'); }
  var hover = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  mis.forEach(function (m) {
    var bt = m.querySelector('.ek-mt');
    if (hover) {
      m.addEventListener('mouseenter', function () { clearTimeout(tClose); clearTimeout(tOpen); tOpen = setTimeout(function () { open(m); }, 70); });
      m.addEventListener('mouseleave', function () { clearTimeout(tOpen); tClose = setTimeout(function () { m.classList.remove('open'); bt.setAttribute('aria-expanded', 'false'); }, 220); });
    }
    bt.addEventListener('click', function (e) { e.stopPropagation(); if (m.classList.contains('open')) shut(); else open(m); });
    bt.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); open(m); var f = m.querySelector('.ek-it'); f && f.focus(); } });
    m.addEventListener('focusout', function (e) { if (!m.contains(e.relatedTarget)) { m.classList.remove('open'); bt.setAttribute('aria-expanded', 'false'); } });
  });
  d.addEventListener('click', function (e) { if (!e.target.closest('.ek-mi')) shut(); });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var o = H.querySelector('.ek-mi.open'); shut(); if (o) o.querySelector('.ek-mt').focus(); closeSheet(); closeSearch(); }
    if (e.key === '/' && !/input|textarea|select/i.test((e.target.tagName || '')) && !e.target.isContentEditable) { e.preventDefault(); openSearch(); }
  });
  addEventListener('scroll', function () { H.classList.toggle('ek-sc', scrollY > 4); }, { passive: true });

  /* ---------- active links ---------- */
  var path = location.pathname.replace(/index\.html$/, '');
  function score(href) {
    if (!href || href.charAt(0) === '#' || /^https?:|^mailto:/.test(href)) return 0;
    if (href.indexOf('#') > 0) return 0;
    var u = href.split('?')[0];
    if (u === '/') return path === '/' ? 1 : 0;
    var p = path.replace(/^\/(en|ckb)\//, '/');
    return p.indexOf(u) === 0 ? u.length : 0;
  }
  function markActive(scope, sel) {
    var best = null, bs = 0;
    [].forEach.call(scope.querySelectorAll(sel), function (a) { var s = score(a.getAttribute('href')); if (s > bs) { bs = s; best = a; } });
    if (best) { best.classList.add('on'); best.setAttribute('aria-current', 'page'); var mi = best.closest('.ek-mi'); if (mi) mi.classList.add('on'); }
  }
  markActive(H, '.ek-it,.ek-ml');
  if (B) markActive(B, '.ek-tab');

  /* ---------- "all sections" sheet (mobile) ---------- */
  var S = null, Q = null;
  function buildSheet() {
    S = d.createElement('div'); S.id = 'eks'; S.setAttribute('role', 'dialog'); S.setAttribute('aria-modal', 'true');
    var h = '<div class="ek-bd" data-x></div><div class="ek-sh"><div class="ek-grab"></div><div class="ek-hd">' + tri('همهٔ بخش‌ها', 'هەموو بەشەکان', 'All sections', 'b') +
      '<button class="ek-x" type="button" data-x aria-label="close">' + X('close') + '</button></div>';
    var battle = H.querySelector('.ek-ml.ek-hot');
    mis.forEach(function (m, i) {
      h += '<h4>' + m.querySelector('.ek-mt .ek-i').outerHTML + '</h4><div class="ek-tiles">';
      if (i === 0 && battle) h += '<a class="ek-tile ek-hot" href="' + battle.getAttribute('href') + '">' + X('swords') + battle.querySelector('.ek-i').outerHTML + '</a>';
      [].forEach.call(m.querySelectorAll('.ek-it'), function (a) {
        var t = a.querySelector('.ek-tt').cloneNode(true); t.className = 'ek-i';
        h += '<a class="ek-tile" href="' + a.getAttribute('href') + '"' + (a.target ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + a.querySelector('.ek-ic').innerHTML + t.outerHTML + '</a>';
      });
      h += '</div>';
    });
    var soc = F && F.querySelector('.ekf-soc'), apps = F && F.querySelector('.ekf-apps');
    if (soc) h += '<h4>' + F.querySelector('.ekf-h').outerHTML + '</h4><div class="ek-socs">' + soc.innerHTML + '</div>';
    h += '<h4>' + tri('زبان و اپلیکیشن', 'زمان و ئەپ', 'Language & app') + '</h4><div class="ek-row"><div class="ek-lang"><button type="button" data-l="fa">فارسی</button><button type="button" data-l="ckb">کوردی</button><button type="button" data-l="en">English</button></div>' +
      (apps ? '<div class="ekf-apps">' + apps.innerHTML + '</div>' : '') + '</div></div>';
    S.innerHTML = h; d.body.appendChild(S);
    S.addEventListener('click', function (e) {
      if (e.target.closest('[data-x]')) { closeSheet(); return; }
      var b = e.target.closest('.ek-lang button[data-l]');
      if (b) { var hb = d.querySelector('#langs button[data-l="' + b.getAttribute('data-l') + '"]'); hb && hb.click(); return; }
      if (e.target.closest('a')) closeSheet();
    });
    /* swipe down to close */
    var sh = S.querySelector('.ek-sh'), y0 = null, dy = 0;
    sh.addEventListener('touchstart', function (e) { if (sh.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
    sh.addEventListener('touchmove', function (e) { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    sh.addEventListener('touchend', function () { if (y0 == null) return; sh.style.transform = ''; if (dy > 90) closeSheet(); y0 = null; });
    markActive(S, '.ek-tile');
    label(chromeLang || cur());
  }
  var lastFocus = null;
  function openSheet() { if (!S) buildSheet(); lastFocus = d.activeElement; S.classList.add('open'); d.body.style.overflow = 'hidden'; setTimeout(function () { var x = S.querySelector('.ek-x'); x && x.focus(); }, 60); }
  function closeSheet() { if (!S || !S.classList.contains('open')) return; S.classList.remove('open'); d.body.style.overflow = ''; lastFocus && lastFocus.focus && lastFocus.focus(); }
  if (B) B.addEventListener('click', function (e) { if (e.target.closest('.ek-all')) { e.preventDefault(); openSheet(); } });

  /* ---------- search ---------- */
  function buildSearch() {
    Q = d.createElement('div'); Q.id = 'ekq'; Q.setAttribute('role', 'dialog'); Q.setAttribute('aria-modal', 'true');
    Q.innerHTML = '<div class="ek-bd" data-x></div><form role="search" action="/" method="get"><input type="search" name="q" autocomplete="off" enterkeyhint="search" maxlength="80" aria-label="search">' +
      '<button type="submit">' + X('search') + '</button></form><div class="ek-qh"><a href="/?q=BTC">BTC</a><a href="/?q=ETH">ETH</a><a href="/?q=هاوینگ">هاوینگ</a><a href="/glossary/">' +
      tri('واژه‌نامه', 'فەرهەنگ', 'Glossary') + '</a><a href="/coins/">' + tri('کوین‌ها', 'دراوەکان', 'Coins') + '</a></div>';
    d.body.appendChild(Q);
    Q.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) closeSearch(); });
    Q.querySelector('form').addEventListener('submit', function (e) {
      var v = (Q.querySelector('input').value || '').trim().slice(0, 80);
      if (!v) { e.preventDefault(); return; }
      if (path === '/' && typeof window.ekSearch === 'function') { e.preventDefault(); window.ekSearch(v); closeSearch(); }
    });
    label(chromeLang || cur());
  }
  function openSearch() { if (!Q) buildSearch(); Q.classList.add('open'); setTimeout(function () { Q.querySelector('input').focus(); }, 30); }
  function closeSearch() { if (Q) Q.classList.remove('open'); }
  var sb = H.querySelector('.ek-sb'); if (sb) sb.addEventListener('click', openSearch);
  window.ekChrome = { openSearch: openSearch, openSheet: openSheet, label: label };

  /* ---------- read aloud: everything happens on the visitor's command ----------
     header button -> menu (whole page / pick a section), selecting text -> a speaker bubble,
     Alt+R reads the selection or the page (or pauses), Esc stops. The engine (assets/reader.js)
     and its voices load only on first use. The AudioContext is created here, inside the click or
     key press, because browsers only let audio start from a user gesture. */
  var RDV = '9', rdP = null, SPK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var RDT = {
    fa: { page: 'خواندن کل صفحه', pick: 'انتخاب یک بخش برای خواندن', stop: 'توقف خواندن', sel: 'خواندن متن انتخاب‌شده', tip: 'یا هر متنی را انتخاب کنید و دکمهٔ بلندگو را بزنید. میان‌بُر: Alt+R، توقف: Esc' },
    ckb: { page: 'خوێندنەوەی هەموو پەڕەکە', pick: 'هەڵبژاردنی بەشێک بۆ خوێندنەوە', stop: 'ڕاگرتنی خوێندنەوە', sel: 'خوێندنەوەی دەقی هەڵبژێردراو', tip: 'یان هەر دەقێک هەڵبژێرە و دوگمەی بڵندگۆ دابگرە. کورتەڕێ: Alt+R، ڕاگرتن: Esc' },
    en: { page: 'Read the whole page', pick: 'Pick a section to read', stop: 'Stop reading', sel: 'Read the selected text', tip: 'Or select any text and tap the speaker. Shortcut: Alt+R, stop: Esc' }
  };
  function rdt() { return RDT[chromeLang || cur()] || RDT.fa; }
  function gesture() { try { var A = window.AudioContext || window.webkitAudioContext; if (!window.__ekAC && A) window.__ekAC = new A(); if (window.__ekAC) window.__ekAC.resume(); } catch (e) { } }
  function reader() { gesture(); return rdP || (rdP = import('/assets/reader.js?v=' + RDV).then(function (m) { return m.default; }, function (e) { rdP = null; throw e; })); }
  function selRange() {
    var s = window.getSelection && getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null;
    if (String(s).trim().length < 2) return null;
    var r = s.getRangeAt(0), a = r.commonAncestorContainer; a = a.nodeType === 1 ? a : a.parentNode;
    if (!a || a.closest('input,textarea,[contenteditable="true"],#ekh,.ek-rd,.ek-rd-menu')) return null;
    return r;
  }
  var rdMenu = null, rdb = H.querySelector('.ek-rdb');
  function closeRdMenu() { if (rdMenu) rdMenu.classList.remove('on'); if (rdb) rdb.setAttribute('aria-expanded', 'false'); }
  function openRdMenu() {
    var T = rdt();
    if (!rdMenu) {
      rdMenu = d.createElement('div'); rdMenu.className = 'ek-rd-menu'; rdMenu.setAttribute('role', 'menu');
      d.body.appendChild(rdMenu);
      d.addEventListener('click', function (e) { if (rdMenu.classList.contains('on') && !rdMenu.contains(e.target) && !(rdb && rdb.contains(e.target))) closeRdMenu(); });
    }
    var sel = selRange(), items = [];
    if (sel) items.push(['sel', T.sel]);
    items.push(['page', T.page], ['pick', T.pick]);
    var stopBtn = d.querySelector('.ek-rd.on') ? '<button type="button" role="menuitem" data-a="stop">' + T.stop + '</button>' : '';
    rdMenu.innerHTML = stopBtn + items.map(function (x) { return '<button type="button" role="menuitem" data-a="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '<p>' + T.tip + '</p>';
    rdMenu.setAttribute('dir', (chromeLang || cur()) === 'en' ? 'ltr' : 'rtl');
    var keep = sel ? sel.cloneRange() : null;
    [].forEach.call(rdMenu.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-a'); closeRdMenu();
        reader().then(function (R) { if (a === 'stop') R.stop(); else if (a === 'page') R.page(); else if (a === 'pick') R.pick(); else if (a === 'sel' && keep) R.range(keep); });
      });
    });
    var r = rdb.getBoundingClientRect(), w = 250;
    rdMenu.style.top = Math.round(r.bottom + 8) + 'px';
    rdMenu.style.left = Math.round(Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))) + 'px';
    rdMenu.classList.add('on'); rdb.setAttribute('aria-expanded', 'true');
    var f = rdMenu.querySelector('button'); if (f) f.focus();
  }
  if (rdb) rdb.addEventListener('click', function (e) { e.stopPropagation(); gesture(); if (rdMenu && rdMenu.classList.contains('on')) closeRdMenu(); else openRdMenu(); });
  var bub = null, bubT = 0;
  function placeBub() {
    var r = selRange();
    if (!r) { if (bub) bub.classList.remove('on'); return; }
    if (!bub) {
      bub = d.createElement('button'); bub.type = 'button'; bub.className = 'ek-rd-bub'; bub.innerHTML = SPK;
      bub.addEventListener('mousedown', function (e) { e.preventDefault(); });          /* keep the selection */
      bub.addEventListener('click', function () { var s = selRange(); bub.classList.remove('on'); if (s) { var k = s.cloneRange(); reader().then(function (R) { R.range(k); }); } });
      d.body.appendChild(bub);
    }
    bub.setAttribute('aria-label', rdt().sel); bub.title = rdt().sel;
    var rs = r.getClientRects(), b = rs.length ? rs[rs.length - 1] : r.getBoundingClientRect();
    var x = ((chromeLang || cur()) === 'en' ? b.right : b.left) - 19;
    bub.style.left = Math.round(Math.max(8, Math.min(innerWidth - 46, x)) + scrollX) + 'px';
    bub.style.top = Math.round(b.bottom + 10 + scrollY) + 'px';
    bub.classList.add('on');
  }
  d.addEventListener('selectionchange', function () { clearTimeout(bubT); bubT = setTimeout(placeBub, 260); });
  d.addEventListener('keydown', function (e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyR') {
      e.preventDefault(); var s = selRange(), k = s ? s.cloneRange() : null;
      reader().then(function (R) { if (k) R.range(k); else if (R.playing) R.toggle(); else R.page(); });
    } else if (e.key === 'Escape') {
      closeRdMenu();
      if (rdP) rdP.then(function (R) { if (R.playing) R.stop(); });
    }
  });

  /* ---------- footer ---------- */
  if (F) {
    var yr = F.querySelector('.ek-yr'); if (yr) yr.textContent = new Date().getFullYear();
    var mq = window.matchMedia ? matchMedia('(max-width:640px)') : { matches: false };
    var cols = [].slice.call(F.querySelectorAll('.ekf-col'));
    var acc = function () { cols.forEach(function (c) { if (mq.matches) c.removeAttribute('open'); else c.setAttribute('open', ''); }); };
    acc(); if (mq.addEventListener) mq.addEventListener('change', acc); else if (mq.addListener) mq.addListener(acc);
    cols.forEach(function (c) { c.querySelector('summary').addEventListener('click', function (e) { if (!mq.matches) e.preventDefault(); }); });
  }

  /* ---------- web app install (PWA) + Android app prompt ---------- */
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.EK_PWA = e; d.dispatchEvent(new Event('ek:pwa')); });
  if (!APP && /Android/i.test(UA) && path.indexOf('/app/') !== 0 && !/[?&]noapp/.test(location.search)) {
    var t0 = +ls.get('ek_app_dismiss') || 0;
    if (Date.now() - t0 > 14 * 864e5) setTimeout(function () {
      var a = d.createElement('div'); a.id = 'eka'; a.setAttribute('role', 'dialog');
      a.innerHTML = '<img src="/assets/icon-192.png" alt="" width="42" height="42"><p>' + tri('اپ اندروید انتخاب', 'ئەپی ئەندرۆیدی Entekhab', 'Entekhab for Android', 'b') +
        tri('سریع‌تر، تمام‌صفحه و بدون نوار مرورگر', 'خێراتر، پڕشاشە و بێ شریتی وێبگەڕ', 'Faster, full screen, no browser bar') + '</p><a href="/app/">' + tri('دانلود', 'داگرتن', 'Get it') +
        '</a><button type="button" aria-label="close">' + X('close') + '</button>';
      d.body.appendChild(a); label(chromeLang || cur());
      a.querySelector('button').addEventListener('click', function () { ls.set('ek_app_dismiss', String(Date.now())); a.remove(); });
    }, 2600);
  }

  /* ---------- inside the Android app: offer the newer APK when /app/app.json lists one ---------- */
  var mv = UA.match(/EntekhabApp\/(\d+(?:\.\d+)*)/);
  if (mv) setTimeout(function () {
    var cmpV = function (a, b) { a = a.split('.'); b = b.split('.'); for (var i = 0; i < Math.max(a.length, b.length); i++) { var x = +a[i] || 0, y = +b[i] || 0; if (x !== y) return x > y ? 1 : -1; } return 0; };
    fetch('/app/app.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !/^\d+(\.\d+)*$/.test(j.version || '') || !/^[\w.-]+\.apk$/.test(j.file || '') || cmpV(j.version, mv[1]) <= 0) return;
      var seen = String(ls.get('ek_upd_seen') || '').split('|');
      if (seen[0] === j.version && Date.now() - (+seen[1] || 0) < 3 * 864e5) return;
      var a = d.createElement('div'); a.id = 'eka'; a.className = 'ek-upd'; a.setAttribute('role', 'dialog');
      a.innerHTML = '<img src="/assets/icon-192.png" alt="" width="42" height="42"><p>' + tri('نسخهٔ تازهٔ اپ آماده است', 'وەشانی نوێی ئەپ ئامادەیە', 'App update available', 'b') +
        tri('نسخهٔ ' + j.version + ' — روی نسخهٔ فعلی نصب می‌شود', 'وەشانی ' + j.version + ' — لەسەر وەشانی ئێستا دادەمەزرێت', 'Version ' + j.version + ' installs over this one') + '</p><a href="/app/' + j.file + '">' +
        tri('به‌روزرسانی', 'نوێکردنەوە', 'Update') + '</a><button type="button" aria-label="close">' + X('close') + '</button>';
      d.body.appendChild(a); label(chromeLang || cur());
      var bye = function () { ls.set('ek_upd_seen', j.version + '|' + Date.now()); a.remove(); };
      a.querySelector('button').addEventListener('click', bye); a.querySelector('a').addEventListener('click', bye);
    }).catch(function () {});
  }, 3000);

  /* the support assistant on every page — it used to live on the homepage alone */
  if (!window.__ekAsk && !d.querySelector('script[src*="/assets/ask.js"]')) {
    var ac = d.createElement('link'); ac.rel = 'stylesheet'; ac.href = '/assets/ask.css?v=2'; d.head.appendChild(ac);
    var as = d.createElement('script'); as.src = '/assets/ask.js?v=2'; as.defer = true; d.body.appendChild(as);
  }

  label(pageI18n ? cur() : (de.getAttribute('lang') ? cur() : (ls.get('ck_lang') || 'fa')));
})();
