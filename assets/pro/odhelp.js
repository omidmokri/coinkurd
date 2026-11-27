/* entekhab.net /market/ — ODM help: every section, field and result of the order planner has its own small icon.
   Hover (mouse), tap or press-and-hold opens a card: what it is, what it is for, an example, the line with the
   user's own numbers when the plan has them, the questions people ask about it, and an ask box.
   The ask box answers from this planner's own guide (the same strings, in the page's language), matched on the
   device; nothing is sent anywhere. When the guide has no answer, "Ask a person on Telegram" copies the question
   and opens the site's Telegram support chat, as the site assistant does. Strings live in i18n.js (odh_*, odhQ*,
   odhA*, odh* UI), so every language the workspace translates gets them. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  var H = P.odh = {};
  var ADMIN = 'Kurdistan_Coin';

  /* one glyph per key; stroke icons on a 24 grid, so each reads as its own thing */
  var G = {
    acc: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4zM5 6l10-3 1 3"/>',
    side: '<path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4"/>',
    contract: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>',
    balance: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    risk: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v5M12 16.5v.5"/>',
    lev: '<path d="M3 15l18-6M12 12l-3 8h6z"/>',
    fee: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
    slip: '<path d="M3 9c3-3 6 3 9 0s6-3 9 0M3 15c3-3 6 3 9 0s6-3 9 0"/>',
    mmode: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14M7 12h1M16 12h1"/>',
    mmr: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5M8 20h8"/>',
    ent: '<path d="M4 5h4v4h4v4h4v4h4"/><path d="M6 13v7M3 17l3 3 3-3"/>',
    gfirst: '<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    gn: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
    gstep: '<path d="M4 4v16M20 4v16M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3"/>',
    gsplit: '<path d="M11 4a8 8 0 1 0 9 9h-9z"/><path d="M14 3a7 7 0 0 1 7 7h-7z"/>',
    stop: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M8 12h8"/>',
    smode: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="7" cy="12" r="2.5"/>',
    sval: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    atrlen: '<path d="M7 3v18M17 5v14"/><rect x="5" y="7" width="4" height="8"/><rect x="15" y="9" width="4" height="5"/>',
    exit: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    trail: '<path d="M3 19c4 0 5-8 9-8s5 3 8-5" stroke-dasharray="2 3"/><path d="M16 5h4v4"/>',
    tmode: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="17" cy="12" r="2.5"/>',
    tval: '<path d="M4 4h16M4 20h16M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3"/>',
    tact: '<path d="M12 3v8"/><path d="M6.3 7a8 8 0 1 0 11.4 0"/>',
    tactv: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    be: '<circle cx="12" cy="12" r="9"/><path d="M8 10h8M8 14h8"/>',
    more: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    frate: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    fiv: '<path d="M6 3h12M6 21h12M7 3v2a5 5 0 0 0 10 0V3M7 21v-2a5 5 0 0 1 10 0v2"/>',
    hours: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    at: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    qty: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    avg: '<path d="M3 12h18"/><circle cx="6" cy="7" r="1.5"/><circle cx="11" cy="16" r="1.5"/><circle cx="16" cy="9" r="1.5"/><circle cx="19" cy="15" r="1.5"/>',
    stopat: '<path d="M12 3v11M8 10l4 4 4-4M4 19h16"/>',
    maxloss: '<path d="M3 6l6 6 4-4 8 9"/><path d="M15 17h6v-6"/>',
    best: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
    notional: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
    margin: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    bep: '<path d="M12 4v16M8 20h8M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z"/>',
    liq: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>',
    funding: '<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>',
    fills: '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    avgso: '<path d="M18 5H6l6 7-6 7h12"/>',
    lossat: '<rect x="3" y="15" width="18" height="5" rx="2"/><path d="M7 15v5M12 3v8M9 8l3 3 3-3"/>',
    exits: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    ends: '<path d="M6 3v6a6 6 0 0 0 12 0V3M12 15v6M3 6l3-3 3 3M15 6l3-3 3 3"/>',
    test: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/>',
    ask: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6M12 17v.5"/>'
  };
  H.KEYS = Object.keys(G).filter(function (k) { return k !== 'ask'; });
  /* the guide's questions, in order, and the item each belongs to (odhQ<i>, odhA<i>) */
  H.FAQ = ['maxloss', 'exits', 'lossat', 'lev', 'liq', 'atrlen', 'fee', 'bep', 'trail', 'ent', 'stop', null, 'side', null];
  /* the planner's own label keys -> help keys */
  H.of = {
    odAcc: 'acc', odEnt: 'ent', odStop: 'stop', odExit: 'exit', odTrail: 'trail', odMore: 'more', odHFills: 'fills', odHExits: 'exits', odHEnds: 'ends', odTestT: 'test',
    rcSide: 'side', rcCt: 'contract', rcBal: 'balance', rcRisk: 'risk', rcLev: 'lev', rcFee: 'fee', rcSlip: 'slip', rcMode: 'mmode', rcMmr: 'mmr',
    odGFirst: 'gfirst', odGN: 'gn', odGStep: 'gstep', odGSplit: 'gsplit', odSMode: 'smode', odSVal: 'sval', odAtrLen: 'atrlen',
    odTMode: 'tmode', odTVal: 'tval', odTAct: 'tact', odTActV: 'tactv', odBE: 'be', plFundRate: 'frate', plFundIv: 'fiv', plHours: 'hours', odAt: 'at',
    rcQty: 'qty', odAvg: 'avg', odStopAt: 'stopat', rcMaxLoss: 'maxloss', odBest: 'best', rcNotional: 'notional', rcMargin: 'margin', rcBE: 'bep', rcLiqS: 'liq', odFund: 'funding',
    odAvgS: 'avgso', odLossS: 'lossat'
  };
  H.svg = function (k) { return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (G[k] || G.ask) + '</svg>'; };

  function A() { return P.app; }
  function T(k, a) { return A().T(k, a); }
  /* what the page's language says, or English; a key that is missing everywhere stays empty */
  function S(k) { var s = T(k); return s === k ? '' : s; }
  function title(k) { return S('odh_' + k + '_t'); }

  /* the user's numbers, set by the planner each time it recalculates */
  H.ctx = null;

  var POP = null, OWNER = null, PIN = false, HOVT = 0, LEAVT = 0, WATCH = 0, SKIP = false;
  var HOVER = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);

  /* an icon button for key k; class adds a tint for sections, fields or results */
  H.btn = function (k) {
    if (!G[k]) return null;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'pm-odi'; b.setAttribute('data-odh', k); b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-label', T('odhAbout', { t: title(k) })); b.innerHTML = H.svg(k);
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (SKIP) { SKIP = false; return; }
      if (POP && OWNER === b && PIN) { close(); return; }
      open(b, true);
    });
    /* press and hold on a touch screen opens it too (and the click that follows the hold is not a second toggle) */
    var hold = 0;
    b.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') return; clearTimeout(hold); hold = setTimeout(function () { SKIP = true; open(b, true); }, 450); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, function () { clearTimeout(hold); setTimeout(function () { SKIP = false; }, 400); }); });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    if (HOVER) {
      b.addEventListener('mouseenter', function () { clearTimeout(LEAVT); if (POP && OWNER === b) return; clearTimeout(HOVT); HOVT = setTimeout(function () { if (!PIN || OWNER !== b) open(b, false); }, 260); });
      b.addEventListener('mouseleave', function () { clearTimeout(HOVT); later(); });
    }
    return b;
  };
  /* put the icon for a planner label key at the end of el (a section heading, a field label, a card's caption) */
  H.tag = function (el, labelKey) { var k = H.of[labelKey]; if (!el || !k) return null; var b = H.btn(k); if (b) el.appendChild(b); return b; };

  function later() { clearTimeout(LEAVT); LEAVT = setTimeout(function () { if (POP && !PIN) close(); }, 220); }

  function fill(s, c) {
    if (!s || !c) return '';
    var out = s.replace(/\{(\w+)\}/g, function (m, k) { return c[k] != null && c[k] !== '' ? c[k] : m; });
    return /\{\w+\}/.test(out) ? '' : out;
  }

  function close(back) {
    clearTimeout(HOVT); clearTimeout(LEAVT); clearInterval(WATCH);
    if (POP) POP.remove(); document.body.classList.remove('pm-odsheet');
    if (OWNER) { OWNER.setAttribute('aria-expanded', 'false'); OWNER.classList.remove('on'); if (back && OWNER.isConnected) try { OWNER.focus(); } catch (e) { } }
    POP = null; OWNER = null; PIN = false;
  }
  H.close = close;
  H.isOpen = function () { return !!POP; };

  function el(tag, cls, txt) { var x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }

  function open(b, pin) {
    var k = b.getAttribute('data-odh');
    if (POP && OWNER === b) { if (pin && !PIN) { PIN = true; POP.classList.add('pin'); } return; }
    close();
    var host = b.closest('.pm-modal') || document.body, rtl = A().RTL();
    var p = el('div', 'pm-odpop' + (pin ? ' pin' : '')); p.setAttribute('role', 'dialog'); p.dir = rtl ? 'rtl' : 'ltr';
    p.setAttribute('data-odh', k); p.id = 'pm-odpop';
    var hd = el('div', 'pm-odph'), ic = el('span', 'pm-odpi'); ic.innerHTML = H.svg(k); hd.appendChild(ic);
    var tt = el('b', '', title(k)); tt.id = 'pm-odpt'; hd.appendChild(tt); p.setAttribute('aria-labelledby', 'pm-odpt');
    var x = el('button', 'pm-ib pm-odpx'); x.type = 'button'; x.setAttribute('aria-label', T('odhClose')); x.innerHTML = A().ic ? A().ic('x') : '×';
    x.onclick = function (e) { e.stopPropagation(); close(true); }; hd.appendChild(x); p.appendChild(hd);
    var bd = el('div', 'pm-odpb'); p.appendChild(bd);
    [['w', 'odhWhat'], ['y', 'odhWhy']].forEach(function (f) { var s = S('odh_' + k + '_' + f[0]); if (!s) return; var r = el('p', 'pm-odpr'); r.appendChild(el('strong', '', T(f[1]))); r.appendChild(document.createTextNode(' ' + s)); bd.appendChild(r); });
    var ex = S('odh_' + k + '_e'); if (ex) { var e1 = el('div', 'pm-odpe'); e1.appendChild(el('strong', '', T('odhEx'))); e1.appendChild(el('span', '', ex)); e1.lastChild.dir = 'auto'; bd.appendChild(e1); }
    var me = fill(S('odh_' + k + '_n'), H.ctx); if (me) { var e2 = el('div', 'pm-odpy'); e2.appendChild(el('strong', '', T('odhYours'))); e2.appendChild(el('span', '', me)); e2.lastChild.dir = 'auto'; bd.appendChild(e2); }
    /* the guide's questions about this item, opened in place */
    var qs = []; H.FAQ.forEach(function (fk, i) { if (fk === k) qs.push(i); });
    if (qs.length) {
      var sw = el('div', 'pm-odpq'); sw.appendChild(el('strong', '', T('odhSee')));
      qs.forEach(function (i) { sw.appendChild(faqEl(i)); }); bd.appendChild(sw);
    }
    /* the ask box */
    var f = el('form', 'pm-odpa'); f.setAttribute('role', 'search');
    var lb = el('label', 'pm-odpal'); lb.innerHTML = H.svg('ask'); lb.appendChild(el('span', '', T('odhAsk'))); lb.htmlFor = 'pm-odpin';
    var row = el('div', 'pm-odpar'), q = el('input', 'pm-in'); q.id = 'pm-odpin'; q.type = 'text'; q.maxLength = 200; q.autocomplete = 'off'; q.placeholder = T('odhAskPh'); q.dir = 'auto'; q.setAttribute('enterkeyhint', 'send');
    var go = el('button', 'pm-btn sm pri', T('odhSend')); go.type = 'submit'; row.appendChild(q); row.appendChild(go);
    var res = el('div', 'pm-odpres'); res.setAttribute('aria-live', 'polite');
    f.appendChild(lb); f.appendChild(row); f.appendChild(res);
    f.onsubmit = function (e) { e.preventDefault(); answer(q.value, k, res); };
    bd.appendChild(f);
    bd.appendChild(el('p', 'pm-odpn', T('odhNote')));
    p.addEventListener('mouseenter', function () { clearTimeout(LEAVT); });
    p.addEventListener('mouseleave', function () { if (!PIN) later(); });
    /* a click, a focus or typing inside pins it, so it does not vanish while the mouse moves to the ask box */
    ['pointerdown', 'focusin'].forEach(function (ev) { p.addEventListener(ev, function () { if (!PIN) { PIN = true; p.classList.add('pin'); } }); });
    p.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    host.appendChild(p); POP = p; OWNER = b; PIN = !!pin; b.setAttribute('aria-expanded', 'true'); b.classList.add('on');
    place(p, b, host);
    if (pin && !HOVER) { /* a phone: the card is a sheet at the bottom; focus its title so a screen reader reads it */ tt.tabIndex = -1; try { tt.focus({ preventScroll: true }); } catch (e) { } }
    WATCH = setInterval(function () { if (!b.isConnected) close(); }, 500);
  }

  function faqEl(i) {
    var d = el('details', 'pm-odpf'), s = el('summary', '', S('odhQ' + i)); d.appendChild(s); var a = el('p', '', S('odhA' + i)); a.dir = 'auto'; d.appendChild(a); return d;
  }

  /* the bottom edge nothing fixed covers: the site's own bar along the bottom of a phone screen sits above the planner */
  function freeBottom() {
    var y = innerHeight, x = innerWidth / 2, n = document.elementFromPoint ? document.elementFromPoint(x, innerHeight - 4) : null;
    for (var k = 0; n && k < 12; k++, n = n.parentElement) {
      if (n.id === 'pro' || n.classList && n.classList.contains('pm-modal')) break;
      if (getComputedStyle(n).position === 'fixed') { y = Math.min(y, n.getBoundingClientRect().top); break; }
    }
    return y;
  }
  /* beside the icon on a wide screen, kept inside the planner window and the screen; a sheet along the bottom on a narrow one */
  function place(p, b, host) {
    var hr = host.getBoundingClientRect(), r = b.getBoundingClientRect(), vw = Math.min(innerWidth, hr.width || innerWidth);
    if (vw < 600) {
      var fb = Math.min(freeBottom(), hr.bottom), top = Math.max(hr.top, 0) + 40;
      p.classList.add('sheet'); p.style.bottom = Math.max(0, hr.bottom - fb) + 'px'; p.style.maxHeight = Math.max(200, Math.min((fb - top), (fb - Math.max(hr.top, 0)) * 0.78)) + 'px';
      document.body.classList.add('pm-odsheet'); return;
    }
    var mb = b.closest('.pm-mbox'), br = mb ? mb.getBoundingClientRect() : hr;
    var lo = Math.max(br.top, 0, hr.top), hi = Math.min(br.bottom, innerHeight, hr.bottom, freeBottom());
    var w = Math.min(360, vw - 16), ph, x, y;
    p.style.width = w + 'px'; p.style.maxHeight = ''; ph = p.offsetHeight;
    x = A().RTL() ? r.right - w : r.left; x = Math.max(br.left + 8, Math.min(x, br.right - w - 8)) - hr.left;
    var below = hi - r.bottom - 8, above = r.top - lo - 8;
    if (below >= Math.min(ph, 260) || below >= above) { var mh = Math.max(160, below); y = r.bottom + 6; if (ph > mh) ph = mh; p.style.maxHeight = mh + 'px'; }
    else { var mh2 = Math.max(160, above); if (ph > mh2) ph = mh2; p.style.maxHeight = mh2 + 'px'; y = r.top - 6 - ph; }
    p.style.left = x + 'px'; p.style.top = (y - hr.top) + 'px';
  }

  /* ---- the ask box: the guide's own text, matched on this device */
  var NORM = [[/[ي]/g, 'ی'], [/[ك]/g, 'ک'], [/[ة]/g, 'ه'], [/[أإآ]/g, 'ا'], [/[ۆ]/g, 'و'], [/[ێ]/g, 'ی'], [/[ڵ]/g, 'ل'], [/[ڕ]/g, 'ر'], [/[ً-ٰٟ‌‍ـ]/g, '']];
  function norm(s) {
    s = String(s || '').toLowerCase();
    try { s = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch (e) { }
    NORM.forEach(function (r) { s = s.replace(r[0], r[1]); });
    s = s.replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x660); }).replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 0x6F0); });
    return s;
  }
  /* words of 2+ letters (and R, the planner's unit of risk); short words that carry no meaning in the four site languages are dropped */
  var STOP = {};
  ('the a an is are was what why how do does i my me it this that of to in on for and or if at be can with ' +
    'چی چه چرا چطور چگونه است هست را به از در که این آن من یه یک با برای و یا اگر هم می ' +
    'چییە بۆچی چۆن ئەم ئەو لە بە و یان من ئایا دەکات ' +
    'ما لماذا كيف هل هذا هذه في من الى على او و ان لي').split(/\s+/).forEach(function (w) { STOP[norm(w)] = 1; });
  function words(s) { return norm(s).split(/[^\p{L}\p{N}]+/u).filter(function (w) { return (w.length >= 2 || w === 'r') && !STOP[w]; }); }
  function hit(qw, tw) {
    if (qw === tw) return 1;
    if (qw.length >= 3 && tw.length >= 3 && (tw.indexOf(qw) === 0 || qw.indexOf(tw) === 0)) return 0.7;
    return 0;
  }
  function score(qws, text, wt) {
    var tws = words(text), s = 0;
    qws.forEach(function (q) { var best = 0; for (var i = 0; i < tws.length; i++) { var v = hit(q, tws[i]); if (v > best) best = v; if (best === 1) break; } s += best * wt; });
    return s;
  }
  /* every answer the guide has: its questions first (they are written as answers), then each item's own text */
  H.search = function (q, cur) {
    var qws = words(q); if (!qws.length) return [];
    var out = [];
    H.FAQ.forEach(function (fk, i) {
      var s = score(qws, S('odhQ' + i), 2) + score(qws, S('odhA' + i), 1) + (fk ? score(qws, title(fk), 1) : 0);
      if (fk && fk === cur) s *= 1.4; out.push({ kind: 'q', i: i, k: fk, s: s });
    });
    H.KEYS.forEach(function (k) {
      var s = score(qws, title(k), 2.2) + score(qws, S('odh_' + k + '_w'), 1) + score(qws, S('odh_' + k + '_y'), 0.8) + score(qws, S('odh_' + k + '_e'), 0.5);
      if (k === cur) s *= 1.4; out.push({ kind: 'k', k: k, s: s });
    });
    var need = Math.max(1, Math.min(2, qws.length * 0.5));
    return out.filter(function (o) { return o.s >= need; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
  };

  function answer(q, cur, res) {
    res.innerHTML = ''; q = String(q || '').trim().slice(0, 200); if (!q) return;
    var got = H.search(q, cur);
    if (got.length) {
      res.appendChild(el('p', 'pm-odpm', T('odhFound')));
      got.forEach(function (o, n) {
        var c = el('div', 'pm-odpc');
        if (o.kind === 'q') { c.appendChild(el('b', '', S('odhQ' + o.i))); var a = el('p', '', S('odhA' + o.i)); a.dir = 'auto'; c.appendChild(a); }
        else {
          var hb = el('b', ''); var ii = el('span', 'pm-odpi sm'); ii.innerHTML = H.svg(o.k); hb.appendChild(ii); hb.appendChild(document.createTextNode(title(o.k))); c.appendChild(hb);
          var w = el('p', '', S('odh_' + o.k + '_w')); w.dir = 'auto'; c.appendChild(w);
          var e = S('odh_' + o.k + '_e'); if (e) { var ep = el('p', 'pm-odpce', T('odhEx') + ': ' + e); ep.dir = 'auto'; c.appendChild(ep); }
        }
        if (n) c.classList.add('more');
        res.appendChild(c);
      });
    } else res.appendChild(el('p', 'pm-odpm', T('odhNone')));
    var tg = el('button', 'pm-btn sm pm-odptg', '✈ ' + T('odhTg')); tg.type = 'button';
    tg.onclick = function () { H.toTelegram(q, cur); };
    res.appendChild(tg);
    /* the answer comes into view inside the card */
    try { (res.firstChild || res).scrollIntoView({ block: 'nearest' }); } catch (e) { }
  }

  /* hand the question to a person: copied with the item's name, then the site's Telegram support chat opens */
  H.toTelegram = function (q, cur) {
    var txt = T('odhTgPre', { t: title(cur) || 'ODM' }) + '\n' + String(q || '').slice(0, 500);
    try { if (navigator.clipboard) navigator.clipboard.writeText(txt); } catch (e) { }
    H.lastCopy = txt;
    if (A().toast) A().toast(T('odhCopied'));
    var a = document.createElement('a'); a.href = 'https://t.me/' + ADMIN; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  };

  /* Escape closes the card before it closes the planner; a click outside closes a pinned card */
  window.addEventListener('keydown', function (e) { if (POP && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } }, true);
  /* the planner scrolls under a card that sits beside its icon: follow the icon, or close once it leaves the view */
  window.addEventListener('scroll', function (e) {
    if (!POP || !OWNER || POP.classList.contains('sheet') || POP.contains(e.target)) return;
    var r = OWNER.getBoundingClientRect(), sc = OWNER.closest('.pm-mbody'), v = sc ? sc.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    if (r.bottom < v.top || r.top > v.bottom) { close(); return; }
    place(POP, OWNER, POP.parentNode);
  }, true);
  window.addEventListener('pointerdown', function (e) { if (!POP) return; if (POP.contains(e.target) || (OWNER && OWNER.contains(e.target))) return; if (e.target.closest && e.target.closest('.pm-odi')) return; close(); }, true);
  P.odhReady = true;
})();
