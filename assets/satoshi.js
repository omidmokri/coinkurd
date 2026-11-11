/* entekhab.net — /satoshi/: the story as a chain of blocks.
   Without this script the page is a plain article. With it, on wide screens, one block is shown at a time and the chain
   under it walks through them (buttons, the nodes of the chain, the arrow keys; the address carries the block: #b3).
   The message of block zero is decoded from its real bytes; the values of "today" use the real Bitcoin price
   (one Binance market-data socket through assets/live.js, the site's last recorded price until it connects).
   The picture at the top is the site owner's own artwork (a hooded figure whose face stays in shadow); embers and
   a slow drift keep it alive. The lower half of the page ("Bitcoin, right now") is assets/btc-live.js. */
(function () {
  'use strict';
  var d = document, de = d.documentElement, w = window;
  var RM = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var WIDE = w.matchMedia ? matchMedia('(min-width:900px)') : { matches: true };
  var AR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  var cur = 0, A = null, fig = null, price = null, bx = null;
  function lang() { return de.lang === 'en' || de.lang === 'ckb' ? de.lang : 'fa'; }
  function dg(n) { var l = lang(), z = l === 'fa' ? '۰۱۲۳۴۵۶۷۸۹' : l === 'ckb' ? '٠١٢٣٤٥٦٧٨٩' : null; return z ? String(n).replace(/\d/g, function (c) { return z[+c]; }) : String(n); }
  function active() { var b = d.querySelector('[data-rl]:not([hidden]) [data-sx]') || d.querySelector('[data-sx]'); return b; }

  /* ---- the picture: embers rise in front of it and it leans a little towards the pointer */
  function Hero(a) {
    var box = a.querySelector('.sx-art0'), cv = a.querySelector('.sx-emb'); if (!box || !cv || !cv.getContext) return null;
    var g = cv.getContext('2d'), W = 0, H = 0, ps = [], alive = true, seen = true, tm = 0, i;
    function size() { var r = cv.getBoundingClientRect(), dpr = Math.min(w.devicePixelRatio || 1, 1.5); W = Math.max(40, Math.round(r.width)); H = Math.max(40, Math.round(r.height)); cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function born(p, any) { p.x = (.2 + Math.random() * .6) * W; p.y = any ? Math.random() * H : H * (.78 + Math.random() * .22); p.v = 10 + Math.random() * 26; p.r = .6 + Math.random() * 1.7; p.w = Math.random() * 6.28; p.l = 0; p.m = 5 + Math.random() * 7; return p; }
    function frame() {
      if (!alive) return; tm = setTimeout(frame, 40); if (!seen || d.hidden) return;
      g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      for (i = 0; i < ps.length; i++) {
        var p = ps[i]; p.l += .04; p.y -= p.v * .04; p.x += Math.sin(p.w + p.l * 1.7) * .35; if (p.l > p.m || p.y < H * .08) born(p);
        var al = Math.sin(Math.min(1, p.l / p.m) * Math.PI) * .8; g.fillStyle = 'rgba(255,' + (150 + (i % 4) * 22) + ',50,' + al.toFixed(2) + ')'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
      }
    }
    size(); for (i = 0; i < (w.innerWidth < 700 ? 22 : 44); i++) ps.push(born({}, true));
    if (!RM) frame();
    var io = null; if ('IntersectionObserver' in w) { io = new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }); io.observe(box); }
    var rs = 0, onRs = function () { clearTimeout(rs); rs = setTimeout(function () { if (alive && cv.offsetParent) size(); }, 150); }; w.addEventListener('resize', onRs);
    var mv = function (e) { var r = box.getBoundingClientRect(); box.style.setProperty('--px', (((e.clientX - r.left) / r.width - .5) * 2).toFixed(3)); box.style.setProperty('--py', (((e.clientY - r.top) / r.height - .5) * 2).toFixed(3)); };
    if (!RM && w.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) box.addEventListener('pointermove', mv, { passive: true });
    return { stop: function () { alive = false; clearTimeout(tm); if (io) io.disconnect(); w.removeEventListener('resize', onRs); box.removeEventListener('pointermove', mv); } };
  }

  /* ---- block zero: its message, from its bytes */
  function hexOf(s) { var o = []; for (var i = 0; i < s.length; i++) o.push(('0' + s.charCodeAt(i).toString(16)).slice(-2)); return o.join(' '); }
  function decoder(root) {
    var code = root.querySelector('.sx-msg'), btn = root.querySelector('[data-dec]'); if (!code || !btn || btn._on) return;
    var msg = code.getAttribute('data-msg'), hex = hexOf(msg), shown = 'hex', tm = 0;
    btn._on = 1; btn.hidden = false; code.textContent = hex; code.classList.add('hex');
    btn.addEventListener('click', function () {
      clearInterval(tm);
      if (shown === 'hex') {
        shown = 'txt'; btn.textContent = btn.getAttribute('data-b'); code.classList.remove('hex');
        if (RM) { code.textContent = msg; return; }
        var i = 0, parts = hex.split(' ');
        tm = setInterval(function () { i += 2; if (i >= msg.length) { i = msg.length; clearInterval(tm); } code.textContent = msg.slice(0, i) + (i < msg.length ? ' ' + parts.slice(i, i + 10).join(' ') : ''); }, 28);
      } else { shown = 'hex'; btn.textContent = btn.getAttribute('data-a'); code.textContent = hex; code.classList.add('hex'); }
    });
  }

  /* ---- today's values: real price only */
  function money(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  function values() {
    [].forEach.call(d.querySelectorAll('[data-mul]'), function (b) { if (price) b.textContent = money(price * +b.getAttribute('data-mul')); });
    var days = Math.floor((Date.now() - Date.UTC(2009, 0, 3, 18, 15, 5)) / 864e5);
    [].forEach.call(d.querySelectorAll('[data-days]'), function (b) { b.textContent = days.toLocaleString('en-US'); });
  }
  function feed() {
    var probe = d.createElement('b'); probe.setAttribute('data-live', 'BTC'); probe.hidden = true; d.body.appendChild(probe);
    fetch('/data/ticker.json?v=' + Math.floor(Date.now() / 3e5)).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      if (!price && j.c && j.c.BTC) { price = j.c.BTC.p; values(); }
      if (j.h && j.h.n) [].forEach.call(d.querySelectorAll('[data-height]'), function (b) { b.textContent = j.h.n.toLocaleString('en-US'); });
    }).catch(function () { });
    if (w.liveRefresh) w.liveRefresh(); else { var s = d.createElement('script'); s.src = '/assets/live.js'; d.body.appendChild(s); }
    setInterval(function () { var v = +probe.dataset.v; if (v > 0 && v !== price) { price = v; values(); } }, 2000);
    values();
  }

  /* ---- the player */
  function show(i, quiet) {
    if (!A) return; var bs = A.querySelectorAll('.sx-b'), last = bs.length - 1; cur = Math.max(0, Math.min(last, i));
    [].forEach.call(bs, function (b, k) { b.classList.toggle('on', k === cur); if (A.classList.contains('sx-js') && WIDE.matches) { if (k === cur) b.removeAttribute('inert'); else b.setAttribute('inert', ''); } else b.removeAttribute('inert'); });
    [].forEach.call(A.querySelectorAll('.sx-ticks button'), function (b, k) { b.classList.toggle('on', k === cur); b.classList.toggle('done', k <= cur); if (k === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    var pos = A.querySelector('.sx-pos'); if (pos) pos.textContent = dg(cur) + ' / ' + dg(last);
    var p = A.querySelector('.sx-ar[data-go="-1"]'), n = A.querySelector('.sx-ar[data-go="1"]'); if (p) p.disabled = cur === 0; if (n) n.disabled = cur === last;
    if (!quiet) { try { history.replaceState(history.state, '', cur ? '#b' + cur : location.pathname + location.search); } catch (e) { } }
  }
  function build(a) {
    var nav = a.querySelector('.sx-nav'); if (!nav || nav.firstChild) return;
    var bs = a.querySelectorAll('.sx-b'), h = '<button type="button" class="sx-ar" data-go="-1" aria-label="' + nav.getAttribute('data-prev') + '">' + AR + '</button><div class="sx-ticks">';
    [].forEach.call(bs, function (b, i) { var t = b.querySelector('time,.sx-hd span+span'), ttl = b.querySelector('h3'); h += '<button type="button" data-i="' + i + '" aria-label="' + ((t ? t.textContent + ' — ' : '') + (ttl ? ttl.textContent : '')).replace(/"/g, '&quot;') + '" title="' + (ttl ? ttl.textContent.replace(/"/g, '&quot;') : '') + '"></button>'; });
    nav.innerHTML = h + '</div><span class="sx-pos" aria-live="polite"></span><button type="button" class="sx-ar" data-go="1" aria-label="' + nav.getAttribute('data-next') + '">' + AR + '</button>';
    nav.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-go')) show(cur + (+t.getAttribute('data-go'))); else show(+t.getAttribute('data-i'));
    });
  }
  function mount() {
    var a = active(); if (!a) return;
    if (fig) { fig.stop(); fig = null; }
    if (bx) { bx.stop(); bx = null; }
    A = a; a.classList.add('sx-js'); build(a); decoder(a);
    fig = Hero(a);
    if (w.btcLive) bx = w.btcLive(a.querySelector('[data-bx-root]'));
    show(cur, true); values();
  }
  d.addEventListener('keydown', function (e) {
    if (!A || !WIDE.matches || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    var t = e.target; if (t && t.closest && t.closest('input,textarea,select,[contenteditable],#ekm,#ekq,#eks')) return;
    var st = A.querySelector('.sx-story'), r = (st || A).getBoundingClientRect(); if (r.bottom < 120 || r.top > w.innerHeight - 120) return;   /* only while the story is on screen */
    e.preventDefault(); show(cur + ((e.key === 'ArrowRight') === (de.dir !== 'rtl') ? 1 : -1));
  });
  function init() {
    var m = /^#b(\d+)$/.exec(location.hash); if (m) cur = +m[1];
    mount(); feed();
    w.addEventListener('ek-lang', function () { setTimeout(mount, 30); });
    w.addEventListener('hashchange', function () { var m = /^#b(\d+)$/.exec(location.hash); if (m) show(+m[1], true); });
    if (WIDE.addEventListener) WIDE.addEventListener('change', function () { show(cur, true); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
