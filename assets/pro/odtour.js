/* ODM's guided tour: one tap walks through the planner a part at a time. Each step lights up one part, says what it is
   for in a sentence or two, and offers Back, Next and Close; arrow keys move, Escape leaves. On a phone the note sits at
   the bottom like a sheet. The first time ODM opens it offers the tour once. Nothing here changes the plan. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  function A() { return P.app; }
  function T(k, a) { return A().T(k, a); }
  var SEEN = 'ek_pro_odtour', TR = P.odTour = {};
  var STEPS = [
    ['acc', function (m) { return m.querySelector('[data-ods="odAcc"]'); }],
    ['ent', function (m) { return m.querySelector('[data-ods="odEnt"]'); }],
    ['stop', function (m) { return m.querySelector('[data-ods="odStop"]'); }],
    ['exit', function (m) { return m.querySelector('[data-ods="odExit"]'); }],
    ['trail', function (m) { return m.querySelector('[data-ods="odTrail"]'); }],
    ['top', function (m) { var t = m.querySelector('.pm-odtop'); return t && t.textContent.trim() ? t : null; }],
    ['res', function (m) { return m.querySelector('.pm-odout .pm-co'); }],
    ['loss', function (m) { var l = m.querySelector('.pm-odout .pm-odl'); return l ? l.closest('table') : null; }],
    ['help', function (m) { return m.querySelector('.pm-odin .pm-odi'); }],
    ['act', function (m) { return m.querySelector('.pm-odact'); }]
  ];
  var CUR = null;
  /* the top of the screen not covered by the site's own fixed bar */
  function freeTop(m) {
    var top = 0, xs = [0.5, 0.2, 0.8];
    [2, 18, 40, 64].forEach(function (y) { xs.forEach(function (f) {
      var e = document.elementFromPoint(innerWidth * f, y);
      for (; e && e !== document.body; e = e.parentElement) {
        if (m && m.contains(e)) break; var ps = getComputedStyle(e).position;
        if (ps === 'fixed' || ps === 'sticky') { top = Math.max(top, e.getBoundingClientRect().bottom); break; }
      }
    }); });
    return top;
  }
  function seen() { try { return !!localStorage.getItem(SEEN); } catch (e) { return true; } }
  function mark() { try { localStorage.setItem(SEEN, '1'); } catch (e) { } }

  /* the button at the top of ODM, and the one-time offer */
  TR.mount = function (box) {
    if (!box || box.querySelector('.pm-odgbar')) return;
    var bar = A().h('<div class="pm-odgbar"></div>'), go = A().h('<button type="button" class="pm-btn sm pm-odgo"></button>');
    go.innerHTML = (P.odh && P.odh.svg ? P.odh.svg('ask') : '') + '<span></span>'; go.querySelector('span').textContent = T('odGuide');
    go.onclick = function () { mark(); if (offer) offer.remove(); TR.start(box); };
    bar.appendChild(go);
    var offer = null;
    if (!seen()) {
      offer = A().h('<div class="pm-odoffer" role="note"><p></p><div class="pm-row"><button type="button" class="pm-btn sm pri" data-a="go"></button><button type="button" class="pm-btn sm" data-a="no"></button></div></div>');
      offer.querySelector('p').textContent = T('odTourOffer');
      offer.querySelector('[data-a="go"]').textContent = T('odTourGo'); offer.querySelector('[data-a="no"]').textContent = T('odTourNo');
      offer.querySelector('[data-a="go"]').onclick = function () { mark(); offer.remove(); offer = null; TR.start(box); };
      offer.querySelector('[data-a="no"]').onclick = function () { mark(); offer.remove(); offer = null; go.focus(); };
      bar.appendChild(offer);
    }
    box.insertBefore(bar, box.firstChild);
  };

  function stop() {
    if (!CUR) return; var c = CUR; CUR = null;
    if (c.tgt) c.tgt.classList.remove('pm-odtgt');
    if (c.bub) c.bub.remove();
    clearInterval(c.watch); window.removeEventListener('keydown', c.key, true); window.removeEventListener('resize', c.pos);
    if (c.body) c.body.removeEventListener('scroll', c.pos);
    document.body.classList.remove('pm-odsheet');
    var g = c.box && c.box.querySelector('.pm-odgo'); if (g && c.box.isConnected) try { g.focus({ preventScroll: true }); } catch (e) { }
  }
  TR.stop = stop;
  TR.active = function () { return CUR ? { i: CUR.i, n: CUR.list.length, k: CUR.list[CUR.i][0] } : null; };

  TR.start = function (box) {
    stop(); if (P.odh && P.odh.close) P.odh.close();
    var modal = box.closest('.pm-modal'); if (!modal) return;
    var list = STEPS.filter(function (s) { return !!s[1](box); }); if (!list.length) return;
    var bub = A().h('<div class="pm-odtour" role="dialog" aria-modal="false" aria-labelledby="pm-odtt"><div class="pm-odth"><small class="pm-num"></small><b id="pm-odtt"></b><button type="button" class="pm-ib" data-a="x"></button></div>' +
      '<p></p><div class="pm-odtd" aria-hidden="true"></div><div class="pm-row"><button type="button" class="pm-btn sm" data-a="back"></button><button type="button" class="pm-btn sm pri" data-a="next"></button></div></div>');
    bub.dir = A().RTL() ? 'rtl' : 'ltr';
    var x = bub.querySelector('[data-a="x"]'); x.innerHTML = A().ic('x'); x.title = T('odTourSkip'); x.setAttribute('aria-label', T('odTourSkip'));
    bub.querySelector('[data-a="back"]').textContent = T('odTourBack');
    list.forEach(function () { bub.querySelector('.pm-odtd').appendChild(document.createElement('i')); });
    modal.appendChild(bub);
    var c = CUR = { box: box, modal: modal, bub: bub, list: list, i: 0, tgt: null, body: box.closest('.pm-mbody') };
    x.onclick = stop;
    bub.querySelector('[data-a="back"]').onclick = function () { go(c.i - 1); };
    bub.querySelector('[data-a="next"]').onclick = function () { if (c.i >= list.length - 1) stop(); else go(c.i + 1); };
    ['pointerdown', 'mousedown', 'touchstart'].forEach(function (n) { bub.addEventListener(n, function (e) { e.stopPropagation(); }, { passive: true }); });
    c.pos = function () { if (CUR === c) place(c); };
    c.key = function (e) {
      if (CUR !== c) return;
      var tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT');
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); stop(); return; }
      if (typing) return;
      var fwd = A().RTL() ? 'ArrowLeft' : 'ArrowRight', bk = A().RTL() ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd) { e.preventDefault(); if (c.i < list.length - 1) go(c.i + 1); }
      else if (e.key === bk) { e.preventDefault(); if (c.i > 0) go(c.i - 1); }
    };
    window.addEventListener('keydown', c.key, true); window.addEventListener('resize', c.pos);
    if (c.body) c.body.addEventListener('scroll', c.pos, { passive: true });
    c.watch = setInterval(function () { if (CUR !== c) return; if (!box.isConnected) stop(); }, 400);
    go(0);
  };

  function go(i) {
    var c = CUR; if (!c) return; i = Math.max(0, Math.min(c.list.length - 1, i)); c.i = i;
    var s = c.list[i], t = s[1](c.box); if (!t) { stop(); return; }
    if (c.tgt) c.tgt.classList.remove('pm-odtgt'); c.tgt = t; t.classList.add('pm-odtgt');
    var b = c.bub, n = c.list.length;
    b.querySelector('small').textContent = T('odTourN', { i: i + 1, n: n });
    b.querySelector('b').textContent = T('odTr_' + s[0] + '_t'); b.querySelector('p').textContent = T('odTr_' + s[0] + '_b');
    var bk = b.querySelector('[data-a="back"]'), nx = b.querySelector('[data-a="next"]');
    bk.disabled = i === 0; nx.textContent = i === n - 1 ? T('odTourDone') : T('odTourNext');
    [].forEach.call(b.querySelectorAll('.pm-odtd i'), function (d, k) { d.className = k === i ? 'on' : k < i ? 'was' : ''; });
    /* bring the part into view first: under the sheet on a phone it goes to the top, elsewhere to the middle */
    var phone = Math.min(innerWidth, c.modal.getBoundingClientRect().width || innerWidth) < 600;
    if (c.body) {
      var br = c.body.getBoundingClientRect(), tr = t.getBoundingClientRect(), vt = Math.max(br.top, freeTop(c.modal)), vh = Math.min(br.bottom, innerHeight) - vt;
      var want = phone ? vt + 12 : vt + Math.max(12, Math.min(80, (vh - tr.height) / 2));
      c.body.scrollTop += tr.top - want;
    }
    place(c);
    try { nx.focus({ preventScroll: true }); } catch (e) { }
  }

  function place(c) {
    var b = c.bub, t = c.tgt, mr = c.modal.getBoundingClientRect(), mb = c.box.closest('.pm-mbox'), br = mb ? mb.getBoundingClientRect() : mr;
    var vw = Math.min(innerWidth, mr.width || innerWidth);
    if (vw < 600) {
      var fb = P.odh && P.odh.freeBottom ? Math.min(P.odh.freeBottom(), mr.bottom) : mr.bottom;
      b.classList.add('sheet'); b.style.left = ''; b.style.top = ''; b.style.width = '';
      b.style.bottom = Math.max(0, mr.bottom - fb) + 'px'; document.body.classList.add('pm-odsheet');
      if (c.body) c.body.style.scrollPaddingBottom = b.offsetHeight + 'px';
      return;
    }
    b.classList.remove('sheet'); b.style.bottom = '';
    var r = t.getBoundingClientRect(), w = Math.min(340, br.width - 24), lo = Math.max(br.top, freeTop(c.modal)) + 8, hi = Math.min(br.bottom, innerHeight) - 8;
    b.style.width = w + 'px'; var ph = b.offsetHeight, y, x, rtl = A().RTL();
    var sideR = br.right - 12 - r.right, sideL = r.left - (br.left + 12);
    if (hi - r.bottom - 10 >= ph) y = r.bottom + 10;
    else if (r.top - lo - 10 >= ph) y = r.top - 10 - ph;
    else if (Math.max(sideR, sideL) >= w + 12) {
      /* no room above or below: beside the part, on the side with room (the results column for a form section) */
      x = sideR >= w + 12 && (!rtl || sideL < w + 12) ? r.right + 12 : r.left - 12 - w;
      y = Math.max(lo, Math.min(hi - ph, Math.max(r.top, lo)));
    }
    else y = Math.max(lo, hi - ph);              /* last resort: low on the screen, so the part's heading stays clear */
    if (x == null) { x = rtl ? r.right - w : r.left; x = Math.max(br.left + 12, Math.min(x, br.right - w - 12)); }
    b.style.left = (x - mr.left) + 'px'; b.style.top = (y - mr.top) + 'px';
  }
})();
