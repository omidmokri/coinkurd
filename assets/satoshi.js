/* entekhab.net — /satoshi/: the story as a chain of blocks.
   Without this script the page is a plain article. With it, on wide screens, one block is shown at a time and the chain
   under it walks through them (buttons, the nodes of the chain, the arrow keys; the address carries the block: #b3).
   The message of block zero is decoded from its real bytes; the values of "today" use the real Bitcoin price
   (one Binance market-data socket through assets/live.js, the site's last recorded price until it connects).
   The figure is an empty outline in a stream of hex digits: there is no face to show, and none is invented. */
(function () {
  'use strict';
  var d = document, de = d.documentElement, w = window;
  var RM = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var WIDE = w.matchMedia ? matchMedia('(min-width:900px)') : { matches: true };
  var AR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  var cur = 0, A = null, fig = null, price = null;
  function lang() { return de.lang === 'en' || de.lang === 'ckb' ? de.lang : 'fa'; }
  function dg(n) { var l = lang(), z = l === 'fa' ? '۰۱۲۳۴۵۶۷۸۹' : l === 'ckb' ? '٠١٢٣٤٥٦٧٨٩' : null; return z ? String(n).replace(/\d/g, function (c) { return z[+c]; }) : String(n); }
  function active() { var b = d.querySelector('[data-rl]:not([hidden]) [data-sx]') || d.querySelector('[data-sx]'); return b; }

  /* ---- the figure */
  function Figure(cv) {
    var g = cv.getContext('2d'), W = 0, H = 0, cw = 14, ch = 18, cols = 0, rows = 0, mask = null, sp = [], of = [], t0 = performance.now(), tm = 0, boost = 0, alive = true, seen = true;
    var HEX = '0123456789abcdef', shape = null;
    function size() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(w.devicePixelRatio || 1, 2); W = Math.max(60, Math.round(r.width)); H = Math.max(60, Math.round(r.height));
      cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / cw); rows = Math.ceil(H / ch);
      /* head and shoulders, nothing more */
      var m = d.createElement('canvas'); m.width = W; m.height = H; var x = m.getContext('2d'), cx = W / 2, u = Math.min(H, W * 1.25);
      shape = function (x) {
        x.beginPath(); x.ellipse(cx, H - u * .62, u * .125, u * .155, 0, 0, Math.PI * 2); x.moveTo(cx - u * .06, H - u * .49); x.lineTo(cx + u * .06, H - u * .49); x.lineTo(cx + u * .075, H - u * .4);
      x.bezierCurveTo(cx + u * .2, H - u * .38, cx + u * .34, H - u * .3, cx + u * .37, H); x.lineTo(cx - u * .37, H);
      x.bezierCurveTo(cx - u * .34, H - u * .3, cx - u * .2, H - u * .38, cx - u * .075, H - u * .4); x.closePath();
      };
      x.fillStyle = '#fff'; shape(x); x.fill();
      var px = x.getImageData(0, 0, W, H).data, c, r2; mask = [];
      function inside(c, r) { var X = Math.min(W - 1, Math.round(c * cw + cw / 2)), Y = Math.min(H - 1, Math.round(r * ch + ch / 2)); return px[(Y * W + X) * 4] > 127; }
      for (c = 0; c < cols; c++) { mask[c] = []; for (r2 = 0; r2 < rows; r2++) mask[c][r2] = inside(c, r2) ? 1 : 0; }
      for (c = 0; c < cols; c++) for (r2 = 0; r2 < rows; r2++) if (mask[c][r2] === 1 && (!mask[c - 1] || !mask[c + 1] || !mask[c - 1][r2] || !mask[c + 1][r2] || !mask[c][r2 - 1])) mask[c][r2] = 2;   /* rim */
      sp = []; of = []; for (c = 0; c < cols; c++) { sp[c] = 3 + ((c * 7919) % 11) * .55; of[c] = (c * 104729) % 97; }
    }
    function draw() {
      var t = (performance.now() - t0) / 1000, c, r, k, a, tr = 14;
      g.clearRect(0, 0, W, H);
      if (shape) { g.save(); shape(g); g.fillStyle = '#000'; g.fill(); g.shadowColor = 'rgba(247,147,26,.9)'; g.shadowBlur = 22; g.strokeStyle = 'rgba(247,147,26,.5)'; g.lineWidth = 1.2; g.stroke(); g.restore(); }   /* a lit edge around nothing */
      g.font = '600 12px "Space Grotesk",ui-monospace,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (c = 0; c < cols; c++) {
        var head = (t * sp[c] + of[c]) % (rows + tr + 6);
        for (r = 0; r < rows; r++) {
          k = mask[c][r]; var dist = head - r, chx = HEX[(c * 31 + r * 17 + Math.floor(t * (k === 2 ? 2 : 5) + of[c])) & 15];
          if (k === 2) { g.fillStyle = 'rgba(255,' + (150 + ((c + r) % 3) * 30) + ',40,' + (.55 + .4 * Math.abs(Math.sin(t * 1.3 + c * .7 + r))).toFixed(2) + ')'; g.fillText(chx, c * cw + cw / 2, r * ch + ch / 2); continue; }
          if (k === 1) continue;                               /* the figure itself stays empty */
          if (dist < 0 || dist > tr) continue;
          a = (1 - dist / tr) * (.34 + boost * .5); if (dist < 1) a = Math.min(1, a * 2.4);
          g.fillStyle = 'rgba(150,215,220,' + a.toFixed(2) + ')'; g.fillText(chx, c * cw + cw / 2, r * ch + ch / 2);
        }
      }
      boost *= .9;
    }
    function loop() { if (!alive) return; if (seen && !d.hidden) draw(); tm = setTimeout(loop, 80); }
    size(); draw();
    if (!RM) loop();
    if ('IntersectionObserver' in w) new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }).observe(cv);
    var rs = 0; w.addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(function () { if (alive && cv.offsetParent) { size(); draw(); } }, 150); });
    return { pulse: function () { boost = 1; if (RM) draw(); }, stop: function () { alive = false; clearTimeout(tm); } };
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
    if (fig && !quiet) fig.pulse();
    if (!quiet) { try { history.replaceState(history.state, '', cur ? '#b' + cur : location.pathname + location.search); } catch (e) { } }
  }
  function build(a) {
    var nav = a.querySelector('.sx-nav'); if (!nav || nav.firstChild) return;
    var bs = a.querySelectorAll('.sx-b'), h = '<button type="button" class="sx-ar" data-go="-1" aria-label="' + nav.getAttribute('data-prev') + '">' + AR + '</button><div class="sx-ticks">';
    [].forEach.call(bs, function (b, i) { var t = b.querySelector('time,.sx-hd span+span'), ttl = b.querySelector('h2'); h += '<button type="button" data-i="' + i + '" aria-label="' + ((t ? t.textContent + ' — ' : '') + (ttl ? ttl.textContent : '')).replace(/"/g, '&quot;') + '" title="' + (ttl ? ttl.textContent.replace(/"/g, '&quot;') : '') + '"></button>'; });
    nav.innerHTML = h + '</div><span class="sx-pos" aria-live="polite"></span><button type="button" class="sx-ar" data-go="1" aria-label="' + nav.getAttribute('data-next') + '">' + AR + '</button>';
    nav.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-go')) show(cur + (+t.getAttribute('data-go'))); else show(+t.getAttribute('data-i'));
    });
  }
  function mount() {
    var a = active(); if (!a) return;
    if (fig) { fig.stop(); fig = null; }
    A = a; a.classList.add('sx-js'); build(a); decoder(a);
    var cv = a.querySelector('.sx-fig canvas'); if (cv && cv.getContext) fig = Figure(cv);
    show(cur, true); values();
  }
  d.addEventListener('keydown', function (e) {
    if (!A || !WIDE.matches || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    var t = e.target; if (t && t.closest && t.closest('input,textarea,select,[contenteditable],#ekm,#ekq,#eks')) return;
    var r = A.getBoundingClientRect(); if (r.bottom < 80 || r.top > w.innerHeight - 80) return;
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
