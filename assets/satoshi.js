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
  /* the map and the candles in the picture come alive: city lights twinkle, payments fly between continents, and a
     wave of light runs along the candles while the last one keeps trading. Positions were measured on the artwork
     (fractions of its width and height), so the effects sit on the drawn map and candles. */
  var FXC = [[0.8081,0.5511,0.0056,0.0233,0],[0.83,0.5622,0.0056,0.02,0],[0.8406,0.5478,0.0056,0.0244,1],[0.8494,0.5533,0.0075,0.0244,0],[0.8606,0.5533,0.0062,0.0178,0],[0.8706,0.51,0.0062,0.0511,0],[0.8806,0.4956,0.0062,0.0222,0],[0.8956,0.4833,0.0062,0.0444,0],[0.9056,0.4189,0.0062,0.0811,0],[0.9169,0.4122,0.0069,0.0489,0],[0.9288,0.43,0.0069,0.0389,1],[0.9462,0.4389,0.0075,0.0167,1],[0.9581,0.3378,0.0069,0.0489,0],[0.9581,0.3833,0.0069,0.0567,1],[0.97,0.3644,0.0062,0.0167,1],[0.9819,0.3144,0.0069,0.0622,0]], FXP = [[0.3131,0.2167],[0.3925,0.42],[0.3512,0.4833],[0.3519,0.1644],[0.3262,0.27],[0.3619,0.2011],[0.3519,0.3911],[0.3669,0.4811],[0.35,0.3722],[0.3562,0.3811],[0.3431,0.4456],[0.3094,0.3144],[0.3238,0.2533],[0.3319,0.1833],[0.3488,0.3878],[0.3431,0.1411],[0.3019,0.3222],[0.3212,0.3578],[0.3888,0.4333],[0.3594,0.4822],[0.3669,0.4856],[0.3562,0.1122],[0.3975,0.4556],[0.355,0.37],[0.3956,0.2733],[0.3731,0.4622],[0.3269,0.26],[0.4062,0.4278],[0.3394,0.1889],[0.3238,0.2922],[0.3787,0.1444],[0.31,0.1367],[0.3412,0.1389],[0.3869,0.4444],[0.395,0.41],[0.3713,0.12],[0.3069,0.3156],[0.3875,0.4533],[0.3581,0.2556],[0.3388,0.3478],[0.3812,0.4633],[0.2981,0.1422],[0.34,0.4056],[0.3219,0.2578],[0.3494,0.4833],[0.3469,0.3644],[0.365,0.3911],[0.3812,0.4144],[0.3581,0.2611],[0.3356,0.3011],[0.4012,0.26],[0.3825,0.4511],[0.3238,0.2567],[0.34,0.3767],[0.3181,0.2822],[0.3262,0.1356],[0.3031,0.3456],[0.3888,0.4156],[0.3362,0.4433],[0.3819,0.1878],[0.4056,0.2444],[0.3406,0.44],[0.3962,0.4622],[0.3288,0.2844],[0.3225,0.2044],[0.3694,0.4711],[0.335,0.2967],[0.3725,0.4622],[0.3606,0.46],[0.3481,0.3933],[0.755,0.3578],[0.7331,0.4444],[0.5838,0.2922],[0.5975,0.3033],[0.5994,0.3011],[0.7662,0.3978],[0.7575,0.4322],[0.7125,0.3189],[0.5825,0.2744],[0.765,0.3911],[0.7412,0.2967],[0.7212,0.3456],[0.7594,0.3522],[0.5919,0.29],[0.5894,0.3089],[0.5894,0.3111],[0.5938,0.2789],[0.7562,0.3622],[0.7331,0.4456],[0.5844,0.2822],[0.5956,0.2889],[0.7344,0.4667],[0.5856,0.31],[0.7656,0.3944],[0.5869,0.2733],[0.7794,0.3833],[0.5806,0.2756],[0.5838,0.3044],[0.7194,0.3211],[0.5881,0.29],[0.5863,0.29],[0.7506,0.4144],[0.5988,0.2956],[0.5869,0.2689],[0.5962,0.2922],[0.5838,0.2967],[0.7225,0.3456],[0.7412,0.4511],[0.5881,0.3067],[0.5825,0.3078],[0.7125,0.3711],[0.5962,0.3],[0.5881,0.2656],[0.5863,0.3144],[0.7331,0.45],[0.5988,0.2844],[0.7344,0.4622],[0.5925,0.2933],[0.7525,0.3589],[0.5806,0.2767],[0.7694,0.3911],[0.585,0.3089],[0.5969,0.2922],[0.7444,0.4278],[0.7569,0.3522],[0.7656,0.3933],[0.5869,0.3078],[0.5906,0.3067],[0.7712,0.2289],[0.5925,0.3056],[0.7738,0.3911],[0.7669,0.3978],[0.8038,0.3778],[0.7919,0.3822],[0.7438,0.4256],[0.78,0.3822],[0.7294,0.3956],[0.7694,0.3967],[0.7825,0.3822],[0.7775,0.3811],[0.7656,0.3956],[0.7981,0.3822],[0.8044,0.3778],[0.7331,0.4467]];
  function Fx(cv) {
    var g = cv.getContext && cv.getContext('2d'); if (!g) return null;
    var W = 0, H = 0, sp = [], k, live = { o: 0, c: 0, t: 0 };
    function size() { var r = cv.getBoundingClientRect(), dpr = Math.min(w.devicePixelRatio || 1, 1.5); W = Math.max(40, r.width); H = Math.max(40, r.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); }
    var ph = FXP.map(function () { return [Math.random() * 6.28, .6 + Math.random() * 1.6]; });
    function spawn() {
      var a = FXP[Math.floor(Math.random() * FXP.length)], b = FXP[Math.floor(Math.random() * FXP.length)];
      if (Math.abs(a[0] - b[0]) < .12) return;
      sp.push({ a: a, b: b, t: 0, d: 1.6 + Math.random() * 1.2 });
    }
    function draw(t, dt) {
      g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      var u = Math.min(W, H) / 506;
      for (k = 0; k < FXP.length; k++) {   /* city lights */
        var q = FXP[k], f = Math.pow(Math.max(0, Math.sin(t * ph[k][1] + ph[k][0])), 6); if (f < .03) continue;
        var x = q[0] * W, y = q[1] * H, r = (1.4 + 3.2 * f) * u, gr = g.createRadialGradient(x, y, 0, x, y, r * 3);
        gr.addColorStop(0, 'rgba(255,236,190,' + (.95 * f).toFixed(2) + ')'); gr.addColorStop(.35, 'rgba(255,170,60,' + (.5 * f).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(247,147,26,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3, 0, 6.283); g.fill();
      }
      if (sp.length < 7 && Math.random() < dt * 1.6) spawn();
      for (k = sp.length - 1; k >= 0; k--) {   /* payments between continents */
        var s = sp[k]; s.t += dt / s.d; if (s.t >= 1) { sp.splice(k, 1); continue; }
        var ax = s.a[0] * W, ay = s.a[1] * H, bx2 = s.b[0] * W, by = s.b[1] * H, cx = (ax + bx2) / 2, cy = Math.max(-.05 * H, Math.min(ay, by) - Math.abs(bx2 - ax) * .55);
        for (var j = 0; j < 14; j++) {
          var e = s.t - j * .018; if (e < 0) break;
          var m = 1 - e, px2 = m * m * ax + 2 * m * e * cx + e * e * bx2, py = m * m * ay + 2 * m * e * cy + e * e * by, al = (1 - j / 14) * Math.sin(s.t * Math.PI);
          g.fillStyle = 'rgba(255,' + (200 - j * 6) + ',90,' + al.toFixed(2) + ')'; g.beginPath(); g.arc(px2, py, (j ? 1.3 : 2.4) * u, 0, 6.283); g.fill();
        }
      }
      for (k = 0; k < FXC.length; k++) {   /* a wave of light along the candles */
        var c = FXC[k], v = Math.pow(Math.max(0, Math.sin(t * 1.7 - k * .42)), 5), cx2 = c[0] * W, cy2 = c[1] * H, cw = Math.max(3, c[2] * W), ch = c[3] * H;
        if (v > .02) { g.fillStyle = (c[4] ? 'rgba(80,230,210,' : 'rgba(255,175,70,') + (.85 * v).toFixed(2) + ')'; g.shadowColor = c[4] ? '#3ee0cc' : '#ffa53a'; g.shadowBlur = 14 * v * u; g.fillRect(cx2 - 1, cy2 - 1, cw + 2, ch + 2); g.shadowBlur = 0; }
      }
      var L = FXC[FXC.length - 1];   /* the last candle keeps trading: a new one grows on top of it */
      if (L) {
        live.t += dt; if (live.t > 5) { live.t = 0; live.o = live.c; }
        live.c += (Math.random() - .45) * dt * 1.4; live.c = Math.max(-.6, Math.min(1.2, live.c));
        var bw = Math.max(3, L[2] * W), x0 = L[0] * W + bw * 2.2, base = L[1] * H, unit = L[3] * H, top = base - live.c * unit, open = base - live.o * unit, up = top < open;
        g.globalCompositeOperation = 'source-over'; g.fillStyle = up ? 'rgba(62,224,204,.95)' : 'rgba(255,150,40,.95)'; g.shadowColor = g.fillStyle; g.shadowBlur = 10 * u;
        g.fillRect(x0, Math.min(top, open), bw, Math.max(2, Math.abs(top - open))); g.fillRect(x0 + bw / 2 - .6, Math.min(top, open) - unit * .25, 1.2, Math.abs(top - open) + unit * .5); g.shadowBlur = 0;
      }
      g.globalCompositeOperation = 'source-over';
    }
    size();
    return { size: size, draw: draw };
  }
  function Hero(a) {
    var box = a.querySelector('.sx-art0'), cv = a.querySelector('.sx-emb'); if (!box || !cv || !cv.getContext) return null;
    var fx = a.querySelector('.sx-fx') ? Fx(a.querySelector('.sx-fx')) : null, t0 = Date.now(), last = t0;
    var g = cv.getContext('2d'), W = 0, H = 0, ps = [], alive = true, seen = true, tm = 0, i;
    function size() { var r = cv.getBoundingClientRect(), dpr = Math.min(w.devicePixelRatio || 1, 1.5); W = Math.max(40, Math.round(r.width)); H = Math.max(40, Math.round(r.height)); cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function born(p, any) { p.x = (.2 + Math.random() * .6) * W; p.y = any ? Math.random() * H : H * (.78 + Math.random() * .22); p.v = 10 + Math.random() * 26; p.r = .6 + Math.random() * 1.7; p.w = Math.random() * 6.28; p.l = 0; p.m = 5 + Math.random() * 7; return p; }
    function frame() {
      if (!alive) return; tm = setTimeout(frame, 40); if (!seen || d.hidden) { last = Date.now(); return; }
      var now = Date.now(); if (fx) fx.draw((now - t0) / 1000, Math.min(.1, (now - last) / 1000)); last = now;
      g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      for (i = 0; i < ps.length; i++) {
        var p = ps[i]; p.l += .04; p.y -= p.v * .04; p.x += Math.sin(p.w + p.l * 1.7) * .35; if (p.l > p.m || p.y < H * .08) born(p);
        var al = Math.sin(Math.min(1, p.l / p.m) * Math.PI) * .8; g.fillStyle = 'rgba(255,' + (150 + (i % 4) * 22) + ',50,' + al.toFixed(2) + ')'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
      }
    }
    size(); for (i = 0; i < (w.innerWidth < 700 ? 22 : 44); i++) ps.push(born({}, true));
    if (!RM) frame(); else if (fx) fx.draw(2.2, 0);
    var io = null; if ('IntersectionObserver' in w) { io = new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }); io.observe(box); }
    var rs = 0, onRs = function () { clearTimeout(rs); rs = setTimeout(function () { if (alive && cv.offsetParent) { size(); if (fx) { fx.size(); if (RM) fx.draw(2.2, 0); } } }, 150); }; w.addEventListener('resize', onRs);
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
