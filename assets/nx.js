/* entekhab.net — interface v3 "Nexus" (preview, ?ui=3): what every page gets on top of the v2 engine.
   The live Bitcoin price in the header (one Binance market-data socket through assets/live.js, with the site's own
   last recorded price shown until it connects — and labelled as such if it never does), and buttons that lean towards the pointer. */
(function () {
  'use strict';
  var d = document, de = d.documentElement, w = window;
  if (!de.classList.contains('ek-v3')) return;
  var RM = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var FINE = !!(w.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lang() { var b = d.querySelector('#langs button.on'), l = (b && b.getAttribute('data-l')) || de.lang || 'fa'; return l === 'ckb' || l === 'en' ? l : 'fa'; }
  function pick(fa, ckb, en) { return { fa: fa, ckb: ckb, en: en }[lang()]; }
  function tri(fa, ckb, en, tag, cls) {
    tag = tag || 'span';
    return '<' + tag + ' class="ek-i' + (cls ? ' ' + cls : '') + '" data-fa="' + esc(fa) + '" data-ckb="' + esc(ckb) + '" data-en="' + esc(en) + '">' + esc(pick(fa, ckb, en)) + '</' + tag + '>';
  }
  function dg(n) { var l = lang(), z = l === 'fa' ? '۰۱۲۳۴۵۶۷۸۹' : l === 'ckb' ? '٠١٢٣٤٥٦٧٨٩' : null; return z ? String(n).replace(/\d/g, function (c) { return z[+c]; }) : String(n); }
  function magnet(el, k) {
    if (!el || !FINE || RM) return;
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * (k || .22)).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * (k || .22)).toFixed(1) + 'px)'; });
    el.addEventListener('pointerleave', function () { el.style.transform = ''; });
  }
  /* a browser that draws without a graphics chip (hardware acceleration off, remote desktop, no driver) pays ~20 ms a frame
     for blurred glass and ~7 ms for the 3D wall — measured on such a machine. It gets the same layout with flat, solid glass. */
  function gpu() {
    var v = null, m; try { v = localStorage.getItem('ek_gpu'); } catch (e) { }
    m = /^(sw|hw):(\d+)$/.exec(v || ''); if (m && Date.now() - (+m[2]) < 864e5) return m[1];
    var r = 'hw';
    try {
      var c = d.createElement('canvas'), g = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!g) r = 'sw'; else {
        var x = g.getExtension('WEBGL_debug_renderer_info'), s = String((x && g.getParameter(x.UNMASKED_RENDERER_WEBGL)) || g.getParameter(g.RENDERER) || '');
        if (/swiftshader|llvmpipe|software|basic render/i.test(s)) r = 'sw';
        var l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext();
      }
    } catch (e) { }
    try { localStorage.setItem('ek_gpu', r + ':' + Date.now()); } catch (e) { }
    return r;
  }
  de.classList.toggle('nx-lite', gpu() === 'sw');
  var tick = null, tickP = null;
  function ticker() { return tickP || (tickP = fetch('/data/ticker.json?v=' + Math.floor(Date.now() / 3e5)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) { tick = j; return j; })); }
  function live() { if (w.liveRefresh) { w.liveRefresh(); return; } if (d.querySelector('script[data-nx-live]')) return; var s = d.createElement('script'); s.src = '/assets/live.js'; s.setAttribute('data-nx-live', '1'); d.body.appendChild(s); }
  function fmtUsd(p) { return '$' + p.toLocaleString('en-US', { maximumFractionDigits: p >= 1000 ? 0 : p >= 1 ? 2 : p >= .01 ? 5 : 8 }); }
  function hhmm(iso) { try { var t = new Date(iso); return ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2); } catch (e) { return ''; } }

  /* until the socket speaks, every live price on the page shows the site's last recorded one (data/ticker.json) */
  function seed() {
    if (!tick || !tick.c) return;
    Object.keys(tick.c).forEach(function (s) {
      var c = tick.c[s];
      [].forEach.call(d.querySelectorAll('[data-live="' + s + '"]'), function (b) { if (!b.dataset.v && (!b.textContent || b.textContent === '—')) b.textContent = fmtUsd(c.p); });
      if (c.ch != null) [].forEach.call(d.querySelectorAll('[data-livechg="' + s + '"]'), function (g) { if (!g.textContent || g.textContent === '—') { g.textContent = (c.ch >= 0 ? '+' : '') + c.ch.toFixed(2) + '%'; g.classList.add(c.ch >= 0 ? 'up' : 'down'); } });
    });
  }
  function chip() {
    var H = d.getElementById('ekh'), tools = H && H.querySelector('.ek-tools'); if (!tools) return;
    var a = d.createElement('a'); a.className = 'nx-tick'; a.href = '/#market';
    a.innerHTML = tri('قیمت زندهٔ بیت‌کوین، باز کردن بازار:', 'نرخی زیندووی بیتکۆین، کردنەوەی بازاڕ:', 'Live Bitcoin price, open the market:', 'span', 'nx-vh') + '<i aria-hidden="true"></i><span class="nx-sym">BTC</span><b data-live="BTC">—</b><span class="nx-chg" data-livechg="BTC"></span>';
    tools.insertBefore(a, tools.firstChild);
    a.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !w.ekDeck) return;
      e.preventDefault(); w.ekDeck.open('market', (w.ekNX && w.ekNX.door && w.ekNX.door('market')) || a);
    });
    ticker().then(function (j) {
      seed();
      /* no socket after a while: say what the number is */
      setTimeout(function () { if (!de.classList.contains('live-on')) a.title = pick('قیمت ثبت‌شدهٔ سایت در ' + hhmm(j.t) + ' — اتصال زنده برقرار نشد', 'نرخی تۆمارکراوی ماڵپەڕ لە ' + hhmm(j.t) + ' — پەیوەندیی زیندوو نەکرا', 'Recorded by the site at ' + hhmm(j.t) + ' — no live connection'); }, 9000);
    }, function () { });
    live();
  }
  w.nxUI = { seed: seed, esc: esc, lang: lang, pick: pick, tri: tri, dg: dg, magnet: magnet, ticker: ticker, live: live, fmtUsd: fmtUsd, hhmm: hhmm, RM: RM, FINE: FINE };
  function init() { chip(); magnet(d.querySelector('#ekh .ek-appb'), .18); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
