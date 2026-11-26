/* entekhab.net — the Observatory: the rare indicators (/charts/rare/ and /charts/rare/<page>/).
   Every figure is computed by scripts/obs_rare.py and written to /data/obs/rare/<id>.json with its own chart
   description (panes, series, colours, labels in four languages), its tiles and its one-line reading; this file only
   draws what the file describes. The list of pages comes from the page itself (<script type="application/json"
   id="rr-list">, written by scripts/rare_pages.py), so a page added there needs nothing here.
   Text from the files is always escaped; colours are taken only when they look like a colour. */
(function () {
  'use strict';
  var OB = window.OB, T = OB.T, esc = OB.esc, $ = OB.$, d = document, w = window;
  var DAY = 864e5, YEAR = 365.25 * DAY;
  var RANGES = ['1y', '2y', '4y', '8y', 'all'], RYEARS = { '1y': 1, '2y': 2, '4y': 4, '8y': 8 };
  var COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+\s*(,\s*[0-9.]+\s*)?\))$/;
  var INK = '#eef1ff';

  /* this file's own words (the shared strings stay in i18n.js) */
  var RS = {
    fa: { read: 'خوانش امروز', other: 'شاخص‌های کمیاب دیگر', all: 'همهٔ شاخص‌های کمیاب', asof: 'دادهٔ روز {d}', src: 'منبع: {s}', variant: 'نمایش',
      today: 'امروز', dago: '{n} روز پیش', dlater: '{n} روز بعد', none: 'هنوز ساخته نشده؛ در به‌روزرسانی بعدی می‌آید', open: 'باز کردن',
      wait: 'در انتظار داده' },
    ckb: { read: 'خوێندنەوەی ئەمڕۆ', other: 'پێوەرە دەگمەنەکانی تر', all: 'هەموو پێوەرە دەگمەنەکان', asof: 'داتای ڕۆژی {d}', src: 'سەرچاوە: {s}', variant: 'پیشاندان',
      today: 'ئەمڕۆ', dago: '{n} ڕۆژ لەمەوبەر', dlater: '{n} ڕۆژ دواتر', none: 'هێشتا دروست نەکراوە؛ لە نوێکردنەوەی داهاتوودا دێت', open: 'کردنەوە',
      wait: 'چاوەڕێی داتا' },
    ar: { read: 'قراءة اليوم', other: 'مؤشرات نادرة أخرى', all: 'كل المؤشرات النادرة', asof: 'بيانات يوم {d}', src: 'المصدر: {s}', variant: 'العرض',
      today: 'اليوم', dago: 'قبل {n} يومًا', dlater: 'بعد {n} يومًا', none: 'لم يُنشأ بعد؛ يأتي في التحديث القادم', open: 'فتح',
      wait: 'بانتظار البيانات' },
    en: { read: "Today's reading", other: 'More rare indicators', all: 'All rare indicators', asof: 'Data for {d}', src: 'Source: {s}', variant: 'Show',
      today: 'today', dago: '{n} days ago', dlater: '{n} days later', none: 'Not built yet; it arrives with the next update', open: 'Open',
      wait: 'Waiting for data' }
  };
  function R(k, a) {
    var s = (RS[OB.lang()] || RS.en)[k] || RS.en[k] || k;
    if (a) s = s.replace(/\{(\w+)\}/g, function (_, n) { return a[n] == null ? '' : a[n]; });
    return OB.lang() === 'en' ? s : OB.loc(s);
  }
  /* a {fa, ckb, ar, en} label from a file, in the reader's language, digits in its own script for prose */
  function tx(o, prose) {
    if (o == null) return '';
    if (typeof o === 'string') return o;
    var s = o[OB.lang()] || o.en || '';
    return prose && OB.lang() !== 'en' ? OB.loc(s) : s;
  }
  function col(c, def) { return typeof c === 'string' && COLOR.test(c) ? c : def || INK; }
  function unpack(c, n) {
    var out = new Array(n), i; for (i = 0; i < n; i++) out[i] = null;
    if (!c || !c.v) return out;
    for (i = 0; i < c.v.length; i++) { var k = (c.o | 0) + i; if (k >= 0 && k < n) out[k] = typeof c.v[i] === 'number' && isFinite(c.v[i]) ? c.v[i] : null; }
    return out;
  }
  function clen(cols) { var n = 0; Object.keys(cols || {}).forEach(function (k) { var c = cols[k]; if (c && c.v) n = Math.max(n, (c.o | 0) + c.v.length); }); return n; }
  function ms(iso) { var t = Date.parse(String(iso) + 'T00:00:00Z'); return isFinite(t) ? t : null; }
  var FMT = {
    num: function (v) { return OB.compact(v); },
    usd: function (v) { return v == null || !isFinite(v) ? '—' : (v < 0 ? '-$' : '$') + OB.fmtP(Math.abs(v)); },
    pct: function (v) { return v == null || !isFinite(v) ? '—' : v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2) + '%'; },
    x: function (v) { return v == null || !isFinite(v) ? '—' : v.toFixed(Math.abs(v) >= 10 ? 1 : Math.abs(v) >= 1 ? 2 : 3) + '×'; }
  };
  var TYPES = { line: 1, area: 1, step: 1, bars: 1 };

  /* ---------------------------------------------------------------- the list of pages, from the page itself */
  var LIST = null;
  function list() {
    if (LIST) return LIST;
    LIST = { groups: [], pages: [] };
    try { var el = d.getElementById('rr-list'); if (el) LIST = JSON.parse(el.textContent); } catch (e) { }
    if (!LIST.pages) LIST.pages = [];
    return LIST;
  }
  function navHtml(id) {
    var L = list(), ps = L.pages; if (!ps.length) return '';
    var k = 0; ps.forEach(function (p, i) { if (p.id === id) k = i; });
    var chips = ps.map(function (p) {
      return '<a class="rr-chip' + (p.id === id ? ' on" aria-current="page' : '') + '" href="' + esc(p.path) + '">' + esc(tx(p.t, true)) + '</a>';
    }).join('');
    return '<nav class="rr-nav" aria-label="' + esc(R('other')) + '"><a class="rr-all" href="/charts/rare/">' + OB.icon('grid') + '<span>' + esc(R('all')) + '</span></a>' +
      '<div class="rr-chips" data-k="' + k + '">' + chips + '</div></nav>';
  }
  function centreChip(el) {
    var nav = $('.rr-chips', el), on = $('.rr-chip.on', el);
    if (nav && on && nav.scrollWidth > nav.clientWidth) { var ra = on.getBoundingClientRect(), rb = nav.getBoundingClientRect(); nav.scrollLeft += (ra.left + ra.width / 2) - (rb.left + rb.width / 2); }
  }

  /* ---------------------------------------------------------------- one indicator page */
  var V = { seq: 0 };
  function tileHtml(t) {
    var sub = t.s == null ? '' : typeof t.s === 'string' ? t.s : tx(t.s, true);
    return '<div class="ob-tile"><small>' + esc(tx(t.l, true)) + '</small><b class="ob-n">' + esc(t.v == null ? '—' : String(t.v)) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
  }
  function tableHtml(tb) {
    if (!tb || !tb.head || !tb.rows || !tb.rows.length) return '';
    return '<div class="ob-tblw"><table class="ob-grid rr-tbl"><thead><tr>' + tb.head.map(function (h) { return '<th>' + esc(tx(h, true)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      tb.rows.slice(0, 60).map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i ? ' class="ob-n"' : '') + '>' + esc(c == null ? '—' : String(c)) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>';
  }
  function status(html, cls) { var s = $('#ob-status', V.el); if (s) { s.innerHTML = html || ''; s.className = 'ob-status' + (cls ? ' ' + cls : ''); s.hidden = !html; } }
  function save() { OB.store.set('ob_rare_' + V.id, { v: V.vk, range: V.range }); }

  /* the columns of what is shown: [{ t0 (ms), step (ms), n, cols: {key: array} }] or the numeric-x columns */
  function frame(D) {
    if (D.xcols) {
      var x = (D.xcols.x || []).filter(function (v) { return typeof v === 'number'; });
      return { num: true, x: x, cols: D.xcols };
    }
    if (D.variants) {
      var vs = D.variants, v = null;
      vs.forEach(function (o) { if (o.key === V.vk) v = o; });
      if (!v) { v = vs[0]; V.vk = v ? v.key : null; }
      if (!v) return null;
      var n = clen(v.cols), c = {};
      Object.keys(v.cols).forEach(function (k) { c[k] = unpack(v.cols[k], n); });
      return { t0: ms(v.t0), step: (v.step || 1) * DAY, n: n, cols: c };
    }
    var n2 = D.n || clen(D.cols), c2 = {};
    Object.keys(D.cols || {}).forEach(function (k) { c2[k] = unpack(D.cols[k], n2); });
    return { t0: ms(D.t0), step: DAY, n: n2, cols: c2 };
  }
  function seriesData(F, key) {
    var a = F.cols[key], out = [];
    if (!a) return out;
    if (F.num) { for (var i = 0; i < F.x.length && i < a.length; i++) if (typeof a[i] === 'number' && isFinite(a[i])) out.push([F.x[i], a[i]]); return out; }
    for (var j = 0; j < a.length; j++) if (a[j] != null) out.push([F.t0 + j * F.step, a[j]]);
    return out;
  }
  function lastT(F) {
    var t = -Infinity;
    Object.keys(F.cols).forEach(function (k) { var a = F.cols[k]; for (var j = a.length - 1; j >= 0; j--) if (a[j] != null) { if (F.t0 + j * F.step > t) t = F.t0 + j * F.step; break; } });
    return t;
  }
  function firstT(F) {
    var t = Infinity;
    Object.keys(F.cols).forEach(function (k) { var a = F.cols[k]; for (var j = 0; j < a.length; j++) if (a[j] != null) { if (F.t0 + j * F.step < t) t = F.t0 + j * F.step; break; } });
    return t;
  }
  function vline(v, F) {
    var x = typeof v.x === 'number' ? v.x : ms(v.x);
    if (x == null) return null;
    return { x: x, color: col(v.color, 'rgba(238,241,255,.55)'), label: tx(v.label, true), dash: true };
  }
  function panes(D, F) {
    var view = D.view || {};
    return (view.panes || []).map(function (p, ix) {
      var f = FMT[p.fmt] || FMT.num;
      var ser = (p.series || []).map(function (s) {
        return { name: tx(s.name, true), type: TYPES[s.type] ? s.type : 'line', color: col(s.color), neg: s.neg ? col(s.neg) : undefined,
          width: typeof s.width === 'number' ? Math.min(4, Math.max(1, s.width)) : undefined, data: seriesData(F, s.k), fmt: f };
      }).filter(function (s) { return s.data.length; });
      var o = { weight: typeof p.weight === 'number' ? p.weight : 2, log: !!p.log, zero: !!p.zero, title: tx(p.title, true), fmt: f, series: ser,
        marks: (p.marks || []).filter(function (m) { return typeof m.y === 'number'; }).map(function (m) { return { y: m.y, color: col(m.color, 'rgba(143,154,199,.8)'), label: tx(m.label, true) }; }),
        zones: (p.zones || []).filter(function (z) { return typeof z.y0 === 'number' && typeof z.y1 === 'number'; }).map(function (z) { return { y0: z.y0, y1: z.y1, color: col(z.color, 'rgba(255,255,255,.05)') }; }) };
      if (ix === 0) o.vlines = (view.vlines || []).map(function (v) { return vline(v, F); }).filter(Boolean);
      return o;
    });
  }
  function dayTxt(n) { return n === 0 ? R('today') : n < 0 ? R('dago', { n: -n }) : R('dlater', { n: n }); }
  function render() {
    var D = V.D; if (!D) return;
    var F = V.F = frame(D); if (!F) return;
    var el = V.el;
    $('#ob-tiles', el).innerHTML = (D.tiles || []).map(tileHtml).join('');
    var rd = $('#rr-read', el);
    rd.innerHTML = D.read ? '<small>' + esc(R('read')) + '</small><p>' + esc(tx(D.read, true)) + '</p>' : ''; rd.hidden = !D.read;
    var tb = $('#ob-tbl', el), th = tableHtml(D.table); tb.innerHTML = th; tb.hidden = !th;
    var title = tx(list().pages.filter(function (p) { return p.id === V.id; }).map(function (p) { return p.t; })[0] || '', false);
    V.sub = (D.asof || '') + (V.vk ? ' · ' + V.vk : '');
    if (F.num) {
      V.ts.set({ daily: true, label: title, xmode: 'num', panes: panes(D, F),
        xfmt: function (x) { var r = Math.round(x); return [r === 0 ? R('today') : (r > 0 ? '+' : '') + r, '']; },
        xtip: function (x) { return dayTxt(Math.round(x)); } });
    } else {
      var tEnd = lastT(F), tStart = firstT(F), yrs = RYEARS[V.range];
      var t0 = yrs ? Math.max(tStart, tEnd - yrs * YEAR) : tStart, span = Math.max(DAY, tEnd - t0);
      V.ts.set({ daily: F.step === DAY, label: title, view: [t0, tEnd + span * 0.02], panes: panes(D, F) });
    }
    var note = [tx(D.note, true)];
    if (D.asof) note.push(R('asof', { d: OB.fmtDate(ms(D.asof)) }));
    if (D.source) note.push(R('src', { s: D.source }));
    $('#ob-note', el).textContent = note.join(' · ');
    if (D.variants) OB.ui.setSeg(el, 'rr-var', V.vk);
    if (!F.num) OB.ui.setSeg(el, 'ob-r', V.range);
  }
  function load(force) {
    var seq = ++V.seq;
    status('<span class="ob-spin"></span>' + esc(T('loading3')));
    OB.getJSON('/data/obs/rare/' + encodeURIComponent(V.id) + '.json' + (force ? '?t=' + Date.now() : ''), 20000).then(function (D) {
      if (seq !== V.seq) return;
      V.D = D; status('');
      tools();
      render();
    }, function (e) {
      if (seq !== V.seq) return;
      var nf = e && e.status === 404;
      status('<b>' + esc(nf ? R('wait') : T('err_file')) + '</b><br><span>' + esc(nf ? R('none') : T('err_file_d')) + '</span><br><button type="button" class="ob-btn" id="ob-retry">' + esc(T('retry')) + '</button>', 'err');
    });
  }
  function tools() {
    var D = V.D, el = V.el, box = $('#rr-tools', el), h = '';
    if (D.variants && D.variants.length > 1) {
      if (!D.variants.some(function (v) { return v.key === V.vk; })) V.vk = D.variants[0].key;
      h += '<label class="ob-lbl"><span>' + esc(R('variant')) + '</span>' + OB.ui.seg('rr-var', D.variants.map(function (v) { return [v.key, tx(v.label) || v.key]; }), V.vk, 'ob-num rr-var') + '</label>';
    }
    if (!D.xcols) h += '<label class="ob-lbl"><span>' + esc(T('range')) + '</span>' + OB.ui.seg('ob-r', RANGES.map(function (k) { return [k, T('cr_' + k)]; }), V.range, 'ob-rng') + '</label>';
    box.innerHTML = h;
  }
  function exportCsv() {
    var D = V.D, F = V.F; if (!D || !F) return;
    var keys = [], names = [];
    ((D.view || {}).panes || []).forEach(function (p) { (p.series || []).forEach(function (s) { if (F.cols[s.k] && keys.indexOf(s.k) < 0) { keys.push(s.k); names.push(tx(s.name)); } }); });
    var rows = [[F.num ? 'day' : 'date'].concat(names)];
    var n = F.num ? F.x.length : F.n;
    for (var i = 0; i < n; i++) {
      var r = [F.num ? F.x[i] : new Date(F.t0 + i * F.step).toISOString().slice(0, 10)], any = false;
      keys.forEach(function (k) { var v = F.cols[k][i]; if (typeof v === 'number' && isFinite(v)) any = true; r.push(typeof v === 'number' && isFinite(v) ? v : ''); });
      if (any) rows.push(r);
    }
    OB.csv('entekhab-rare-' + V.id + (V.vk ? '-' + V.vk.toLowerCase() : '') + '.csv', rows);
  }
  function mount(id, el) {
    V.id = id; V.el = el; V.D = null;
    var st = OB.store.get('ob_rare_' + id, {}) || {}, q = new URLSearchParams(location.search);
    V.range = RANGES.indexOf(q.get('range')) >= 0 ? q.get('range') : RANGES.indexOf(st.range) >= 0 ? st.range : 'all';
    V.vk = /^[A-Za-z0-9]{1,12}$/.test(q.get('v') || '') ? q.get('v') : typeof st.v === 'string' ? st.v : null;
    el.innerHTML = navHtml(id) + '<div class="ob-tools"><span id="rr-tools" class="rr-tools"></span>' + OB.ui.acts(true) + '</div>' +
      '<div class="ob-tiles" id="ob-tiles"></div><div class="rr-read" id="rr-read" hidden></div>' +
      '<div class="ob-tsbox"><div class="ob-ts" id="ob-ts"></div><div class="ob-status" id="ob-status"></div></div>' +
      '<div class="ob-tblbox" id="ob-tbl" hidden></div><p class="ob-note" id="ob-note"></p>';
    centreChip(el);
    V.ts = new OB.TS($('#ob-ts', el));
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      var seg = b.parentNode && b.parentNode.classList.contains('ob-seg') ? b.parentNode.id : null, v = b.getAttribute('data-v');
      if (seg === 'rr-var' && v !== V.vk) { V.vk = v; save(); render(); }
      else if (seg === 'ob-r' && v !== V.range && RANGES.indexOf(v) >= 0) { V.range = v; save(); render(); }
      else if (b.id === 'ob-refresh' || b.id === 'ob-retry') load(true);
      else if (b.id === 'ob-full') OB.fullscreen(d.getElementById('ob'));
      else if (b.id === 'ob-png') { if (V.D) V.ts.png(tx((list().pages.filter(function (p) { return p.id === V.id; })[0] || {}).t), V.sub, 'entekhab-rare-' + V.id + '.png'); }
      else if (b.id === 'ob-share') OB.ui.share({ v: V.D && V.D.variants ? V.vk : null, range: V.D && !V.D.xcols ? V.range : null });
      else if (b.id === 'ob-csv') exportCsv();
    };
    load();
  }
  function unmount() { V.seq++; if (V.ts) V.ts.destroy(); V.ts = null; V.D = null; V.F = null; }

  /* ---------------------------------------------------------------- the index: every page with its reading of today */
  function mountIndex(el) {
    var L = list(), seq = ++V.seq;
    function cards(now) {
      var pages = (now && now.pages) || {};
      return (L.groups || []).map(function (g) {
        var ps = L.pages.filter(function (p) { return p.g === g.k; });
        if (!ps.length) return '';
        return '<h2 class="ob-hsec">' + esc(tx(g.t, true)) + '</h2><div class="ob-hub ob-hubf rr-cards">' + ps.map(function (p) {
          var r = pages[p.id];
          return '<a class="ob-hc rr-card" href="' + esc(p.path) + '"><b>' + esc(tx(p.t, true)) + '</b><small>' + esc(tx(p.d, true)) + '</small>' +
            '<span class="rr-now' + (r ? '' : ' wait') + '">' + esc(r ? tx(r.read, true) : now ? R('none') : '…') + '</span>' +
            (r && r.asof ? '<i class="rr-asof">' + esc(R('asof', { d: OB.fmtDate(ms(r.asof)) })) + '</i>' : '') + '</a>';
        }).join('') + '</div>';
      }).join('');
    }
    el.innerHTML = '<div class="rr-index" id="rr-index">' + cards(null) + '</div><p class="ob-note">' + esc(tx({ fa: 'آموزشی است، توصیهٔ مالی نیست.', ckb: 'فێرکارییە، ئامۆژگاریی دارایی نییە.', ar: 'للتعلّم فقط، وليس نصيحة مالية.', en: 'Educational, not financial advice.' })) + '</p>';
    OB.getJSON('/data/obs/rare_now.json', 15000).then(function (now) {
      if (seq !== V.seq) return; var box = $('#rr-index', el); if (box) box.innerHTML = cards(now || {});
    }, function () { if (seq !== V.seq) return; var box = $('#rr-index', el); if (box) box.innerHTML = cards({}); });
  }

  OB.views.rare = { mount: mountIndex, unmount: function () { V.seq++; } };
  list().pages.forEach(function (p) {
    if (/^[a-z0-9]{2,20}$/.test(p.id)) OB.views['r_' + p.id] = { mount: function (el) { mount(p.id, el); }, unmount: unmount };
  });
  OB._rare = { V: V, list: list, frame: frame };
})();
