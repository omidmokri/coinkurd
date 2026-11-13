/* entekhab.net — /calendar/ «تقویم اقتصادی» (fa · ckb · en; Arabic via /assets/ar.js).
   Needs /assets/ui.js (I, T, lang, uiLang, esc, j, V, ls). Data, all same-origin:
     /data/ecocal.json       every currency's releases (ForexFactory feed, kept as 26 weeks of history; b1/b4 = BTC % 1h/4h)
     /data/econ_actual.json  official actuals of the red US releases (BLS / the Fed's statement) — scripts/econ_live.py
     /data/fed.json          current target range + Kalshi odds per FOMC meeting + their history — scripts/econ_live.py
   Personal state only in localStorage: ek_cal (filters, time zone), ek_cal_rem (reminders). */
(function () {
  'use strict';
  var d = document, w = window;
  var CAL = null, ACT = {}, FED = null, KINDS = w.CAL_KINDS || [];
  var BOT = 'https://t.me/Kurd_kurdistan_bot?start=ec', TOPIC = 'https://t.me/Coin_Kurd_Group/47540', PAGE = 'https://entekhab.net/calendar/';
  var CURS = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'NZD', 'CHF'];
  var FLAG = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CNY: '🇨🇳', CAD: '🇨🇦', AUD: '🇦🇺', NZD: '🇳🇿', CHF: '🇨🇭', ALL: '🌐' };
  /* which way "higher than forecast" points for the Fed: +1 hawkish (usually bad for bitcoin), -1 dovish (scripts/econ_src.py) */
  var DIR = { 'CPI m/m': 1, 'Core CPI m/m': 1, 'CPI y/y': 1, 'Core CPI y/y': 1, 'PPI m/m': 1, 'Core PPI m/m': 1, 'Non-Farm Employment Change': 1,
    'Unemployment Rate': -1, 'Average Hourly Earnings m/m': 1, 'Federal Funds Rate': 1, 'Retail Sales m/m': 1, 'Core Retail Sales m/m': 1,
    'Advance GDP q/q': 1, 'Prelim GDP q/q': 1, 'Final GDP q/q': 1, 'ISM Manufacturing PMI': 1, 'ISM Services PMI': 1, 'Unemployment Claims': -1,
    'Core PCE Price Index m/m': 1, 'JOLTS Job Openings': 1, 'ADP Non-Farm Employment Change': 1 };
  var OUTS = ['C26', 'C25', 'H0', 'H25', 'H26'], OUT_BP = { C26: -50, C25: -25, H0: 0, H25: 25, H26: 50 };
  var OUT_COL = { C26: '#22c55e', C25: '#86efac', H0: '#a3a3a3', H25: '#fb923c', H26: '#ef4444' };

  /* ------------------------------------------------------------------ language & time */
  var LG = function () { return (lang === 'ckb' || lang === 'en' || lang === 'ar') ? lang : 'fa'; };
  function tr(k, v) { var s = T(k); if (s == null) return ''; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  var DAYS = { fa: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'], ckb: ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'],
    ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
  var MONS = { fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
    ckb: ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'],
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
  var ST = ls.get('ek_cal', null) || {};
  if (!ST.tz) ST.tz = LG() === 'fa' ? 'teh' : (LG() === 'en' ? 'loc' : 'erb');
  if (!ST.imp) ST.imp = ['H', 'M'];
  if (!ST.cur) ST.cur = [];          // empty = all
  if (ST.crypto == null) ST.crypto = false;
  ST.q = ''; ST.wk = 0;
  function save() { ls.set('ek_cal', { tz: ST.tz, imp: ST.imp, cur: ST.cur, crypto: ST.crypto }); }
  function off() { return ST.tz === 'teh' ? 210 : ST.tz === 'erb' ? 180 : ST.tz === 'utc' ? 0 : -new Date().getTimezoneOffset(); }
  function L(t) { return new Date((t + off() * 60) * 1000); }        // "local" date in the chosen zone, read with getUTC*
  function hm(t) { var x = L(t); return ('0' + x.getUTCHours()).slice(-2) + ':' + ('0' + x.getUTCMinutes()).slice(-2); }
  function dayKey(t) { var x = L(t); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()) / 864e5; }
  function dayName(dk) { var x = new Date(dk * 864e5); return DAYS[LG()][x.getUTCDay()] + ' ' + x.getUTCDate() + ' ' + MONS[LG()][x.getUTCMonth()]; }
  function dateShort(t) { var x = L(t); return x.getUTCDate() + ' ' + MONS[LG()][x.getUTCMonth()] + ' ' + x.getUTCFullYear(); }
  function weekStart(dk) { var dow = new Date(dk * 864e5).getUTCDay(); return dk - ((dow + 1) % 7); }    // Saturday
  function now() { return Date.now() / 1000; }
  function dur(s) {
    s = Math.max(0, Math.round(s)); var dd = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return (dd ? dd + T('d_short') + ' ' : '') + (h || dd ? h + T('h_short') + ' ' : '') + m + T('m_short');
  }
  function title(e) { var t = e.tr || {}; return LG() === 'en' ? e.n : (t[LG()] || (LG() === 'ar' ? t.ar : null) || e.n); }
  function key(e) { return e.t + '|' + e.c + '|' + e.n; }
  function act(e) { return ACT[key(e)] || null; }
  function num(s) { var m = String(s == null ? '' : s).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  function surprise(e) {
    var a = act(e), dir = DIR[e.n]; if (!a || !dir) return null;
    var x = num(a.a), f = num(e.f); if (x == null || f == null) return null;
    return Math.abs(x - f) < 1e-9 ? 0 : (x > f ? dir : -dir);
  }
  function pct(v, dg) { return v == null || isNaN(v) ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(dg == null ? 2 : dg) + '%'; }
  function kindOf(e) { if (e.c !== 'USD') return null; for (var i = 0; i < KINDS.length; i++) if (e.n.indexOf(KINDS[i][0]) >= 0) return KINDS[i][1]; return null; }
  function moves(e) { return e.c === 'USD' && (e.i === 'H' || e.i === 'M') || /FOMC|Powell|Fed /.test(e.n); }

  /* ------------------------------------------------------------------ filters */
  function pass(e) {
    if (ST.imp.indexOf(e.i) < 0) return false;
    if (ST.cur.length && ST.cur.indexOf(e.c) < 0 && !(e.c === 'ALL')) return false;
    if (ST.crypto && !moves(e)) return false;
    if (ST.q) { var q = ST.q.toLowerCase(); if ((e.n + ' ' + title(e) + ' ' + e.c).toLowerCase().indexOf(q) < 0) return false; }
    return true;
  }
  function drawFilters() {
    var box = d.getElementById('ecF'); if (!box) return;
    var tz = ['teh', 'erb', 'utc', 'loc'].map(function (z) { return '<button type="button" data-tz="' + z + '" class="' + (ST.tz === z ? 'on' : '') + '">' + esc(T('tz_' + z)) + '</button>'; }).join('');
    var imp = ['H', 'M', 'L', 'X'].map(function (i) { return '<button type="button" data-imp="' + i + '" class="imp' + i + (ST.imp.indexOf(i) >= 0 ? ' on' : '') + '"><i></i>' + esc(T('imp_' + i)) + '</button>'; }).join('');
    var cur = '<button type="button" data-cur="" class="' + (ST.cur.length ? '' : 'on') + '">' + esc(T('f_all')) + '</button>' +
      CURS.map(function (c) { return '<button type="button" data-cur="' + c + '" class="' + (ST.cur.indexOf(c) >= 0 ? 'on' : '') + '">' + FLAG[c] + ' ' + c + '</button>'; }).join('');
    box.innerHTML = '<div class="row"><span class="lb">' + esc(T('tz')) + '</span><div class="seg">' + tz + '</div></div>' +
      '<div class="row"><span class="lb">' + esc(T('f_imp')) + '</span><div class="chips">' + imp + '</div></div>' +
      '<div class="row"><span class="lb">' + esc(T('f_cur')) + '</span><div class="chips">' + cur + '</div></div>' +
      '<div class="row"><label class="tg"><input type="checkbox" id="ecCrypto"' + (ST.crypto ? ' checked' : '') + '> ' + esc(T('f_crypto')) + '</label>' +
      '<input type="search" id="ecQ" placeholder="' + esc(T('f_search')) + '" value="' + esc(ST.q) + '"></div>';
  }
  function wireFilters() {
    var box = d.getElementById('ecF'); if (!box) return;
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.tz) { ST.tz = b.dataset.tz; }
      else if (b.dataset.imp) { var i = ST.imp.indexOf(b.dataset.imp); if (i >= 0) { if (ST.imp.length > 1) ST.imp.splice(i, 1); } else ST.imp.push(b.dataset.imp); }
      else if (b.dataset.cur !== undefined) {
        var c = b.dataset.cur; if (!c) ST.cur = []; else { var k = ST.cur.indexOf(c); if (k >= 0) ST.cur.splice(k, 1); else ST.cur.push(c); }
      } else return;
      save(); drawFilters(); drawList(); drawHero();
    });
    box.addEventListener('change', function (ev) { if (ev.target.id === 'ecCrypto') { ST.crypto = ev.target.checked; save(); drawList(); } });
    box.addEventListener('input', function (ev) { if (ev.target.id === 'ecQ') { ST.q = ev.target.value.trim(); drawList(); } });
  }

  /* ------------------------------------------------------------------ hero: next red release + volatile window */
  function drawHero() {
    var box = d.getElementById('ecNext'); if (!box) return;
    if (!CAL) { box.innerHTML = '<p class="ec-note">' + esc(T(CAL === false ? 'nodata' : 'loading')) + '</p>'; return; }
    var n = now(), ev = CAL.events, next = null, hot = [];
    ev.forEach(function (e) {
      if (e.i !== 'H') return;
      if (e.t > n && (!next || e.t < next.t)) next = e;
      if (Math.abs(e.t - n) <= 1800) hot.push(e);
    });
    var h = '';
    if (next) {
      var same = ev.filter(function (e) { return e.i === 'H' && e.t === next.t; });
      h += '<div class="ec-cd"><span class="k">' + esc(T('next')) + '</span><b class="v" id="ecCd">' + esc(dur(next.t - n)) + '</b>' +
        '<span class="n">' + (FLAG[next.c] || '') + ' ' + same.map(function (e) { return esc(title(e)); }).join(' · ') + '</span>' +
        '<span class="t">' + esc(dayName(dayKey(next.t)) + ' · ' + hm(next.t)) + '</span></div>';
    }
    h += '<div class="ec-clock"><span class="k">' + esc(T('now_tz')) + ' · ' + esc(T('tz_' + ST.tz)) + '</span><b class="v">' + esc(hm(n)) + '</b></div>';
    if (hot.length) {
      var e0 = hot[0];
      h += '<div class="ec-hot">' + esc(tr('live_win', { n: title(e0), w: e0.t > n ? T('in') + ' ' + dur(e0.t - n) : tr('mins_ago', { m: Math.round((n - e0.t) / 60) }) })) + '</div>';
    }
    box.innerHTML = h;
  }

  /* ------------------------------------------------------------------ the week */
  function weekRange() {
    var ws = weekStart(dayKey(now())) + 7 * ST.wk;
    return [ws, ws + 7];
  }
  function drawWeekNav() {
    var box = d.getElementById('ecWk'); if (!box) return;
    var r = weekRange(), a = new Date(r[0] * 864e5), b = new Date((r[1] - 1) * 864e5);
    var lbl = a.getUTCDate() + ' ' + MONS[LG()][a.getUTCMonth()] + ' – ' + b.getUTCDate() + ' ' + MONS[LG()][b.getUTCMonth()];
    var minT = CAL && CAL.events.length ? CAL.events[0].t : now(), maxT = CAL && CAL.events.length ? CAL.events[CAL.events.length - 1].t : now();
    var canPrev = r[0] > dayKey(minT), canNext = r[1] <= dayKey(maxT);
    box.innerHTML = '<button type="button" data-w="-1"' + (canPrev ? '' : ' disabled') + '>‹ ' + esc(T('wk_prev')) + '</button>' +
      '<button type="button" data-w="0" class="' + (ST.wk === 0 ? 'on' : '') + '">' + esc(T('wk_this')) + '</button>' +
      '<button type="button" data-w="1"' + (canNext ? '' : ' disabled') + '>' + esc(T('wk_next')) + ' ›</button><span class="lbl">' + esc(lbl) + '</span>';
  }
  function cellAct(e) {
    var a = act(e); if (!a) return '<span class="mut">—</span>';
    var s = surprise(e), cls = s === 1 ? 'hawk' : s === -1 ? 'dove' : 'flat';
    return '<b class="a ' + cls + '" title="' + esc(s === 1 ? T('hawk') : s === -1 ? T('dove') : '') + '">' + esc(a.a) + '</b>';
  }
  function cellBtc(e) {
    if (e.b1 == null && e.b4 == null) return '<span class="mut">—</span>';
    var f = function (v) { return v == null ? '—' : '<span class="' + (v >= 0 ? 'up' : 'dn') + '">' + pct(v, 1) + '</span>'; };
    return f(e.b1) + ' / ' + f(e.b4);
  }
  function drawList() {
    drawWeekNav();
    var box = d.getElementById('ecList'); if (!box) return;
    if (!CAL) { box.innerHTML = '<p class="ec-note">' + esc(T(CAL === false ? 'nodata' : 'loading')) + '</p>'; return; }
    var r = weekRange(), td = dayKey(now()), n = now();
    var ev = CAL.events.filter(function (e) { var k = dayKey(e.t); return k >= r[0] && k < r[1] && pass(e); });
    if (!ev.length) { box.innerHTML = '<p class="ec-note">' + esc(T('empty')) + '</p>'; return; }
    var h = '<div class="ec-th"><span>' + esc(T('c_time')) + '</span><span>' + esc(T('c_cur')) + '</span><span>' + esc(T('c_event')) + '</span><span>' +
      esc(T('c_act')) + '</span><span>' + esc(T('c_fc')) + '</span><span>' + esc(T('c_prev')) + '</span><span>' + esc(T('c_btc')) + '</span><span></span></div>';
    var last = null, nowDrawn = false, rem = rems();
    ev.forEach(function (e, i) {
      var dk = dayKey(e.t);
      if (dk !== last) {
        last = dk;
        h += '<div class="ec-day' + (dk === td ? ' today' : '') + '">' + esc(dayName(dk)) + (dk === td ? ' · ' + esc(T('today')) : dk === td + 1 ? ' · ' + esc(T('tomorrow')) : '') + '</div>';
      }
      if (!nowDrawn && e.t > n && dk === td) { h += '<div class="ec-now" id="ecNowLine"><span>' + esc(hm(n)) + '</span></div>'; nowDrawn = true; }
      var k = key(e), on = rem.some(function (x) { return x.k === k; }), past = e.t < n;
      var allDay = e.i === 'X' || (L(e.t).getUTCHours() === 0 && L(e.t).getUTCMinutes() === 0 && e.i === 'X');
      h += '<div class="ec-row imp' + e.i + (past ? ' past' : '') + '" data-i="' + i + '" tabindex="0">' +
        '<span class="tm">' + (allDay ? esc(T('all_day')) : esc(hm(e.t))) + '</span>' +
        '<span class="cu">' + (FLAG[e.c] || '') + ' ' + esc(e.c) + '</span>' +
        '<span class="ev"><i class="dot"></i>' + esc(title(e)) + '</span>' +
        '<span class="ac" data-l="' + esc(T('c_act')) + '">' + cellAct(e) + '</span>' +
        '<span class="fc" data-l="' + esc(T('c_fc')) + '">' + esc(e.f || '—') + '</span>' +
        '<span class="pv" data-l="' + esc(T('c_prev')) + '">' + esc(e.p || '—') + '</span>' +
        '<span class="bt" data-l="₿">' + cellBtc(e) + '</span>' +
        '<span class="bl">' + (past ? '' : '<button type="button" class="bell' + (on ? ' on' : '') + '" data-bell="' + i + '" aria-label="' + esc(T('bell')) + '">' + (on ? '🔔' : '🔕') + '</button>') + '</span>' +
        '</div><div class="ec-det" id="ecDet' + i + '" hidden></div>';
    });
    box.innerHTML = h;
    box._ev = ev;
  }
  function detail(e) {
    var k = kindOf(e), dir = DIR[e.n], x = [];
    if (k) {
      var t = k[LG()] || k.en;
      x.push('<h4>' + esc(T('d_what')) + '</h4><p>' + esc(t[0]) + '</p><h4>' + esc(T('d_crypto')) + '</h4><p>' + esc(t[1]) + '</p>');
    } else if (e.c !== 'USD') x.push('<p>' + esc(tr('d_other', { c: e.c })) + '</p>');
    if (e.c === 'USD') x.push('<h4>' + esc(T('d_read')) + '</h4><p>' + esc(T(dir === 1 ? 'read_up' : dir === -1 ? 'read_dn' : 'read_none')) + '</p>');
    var a = act(e);
    if (a) {
      var s = surprise(e);
      x.push('<p class="ec-res">' + esc(T('c_act')) + ': <b>' + esc(a.a) + '</b>' + (s != null ? ' — ' + esc(T(s === 0 ? 'd_inline' : (num(a.a) > num(e.f) ? 'd_beat' : 'd_miss'))) +
        (s ? ' · <span class="' + (s > 0 ? 'hawk' : 'dove') + '">' + esc(T(s > 0 ? 'hawk' : 'dove')) + '</span>' : '') : '') + '</p><p class="ec-note">' + esc(tr('src_act', { s: a.src === 'Fed' ? 'Federal Reserve' : 'BLS' })) + '</p>');
    }
    var past = CAL.events.filter(function (y) { return y.c === e.c && y.n === e.n && y.t < Math.min(e.t, now()); }).sort(function (p, q) { return q.t - p.t; }).slice(0, 10);
    x.push('<h4>' + esc(T('d_hist')) + '</h4>');
    if (!past.length) x.push('<p class="ec-note">' + esc(T('d_hist_none')) + '</p>');
    else {
      var cols = T('d_cols').split('|');
      x.push('<div class="ec-hist"><div class="hh">' + cols.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
        past.map(function (y) {
          var ya = act(y);
          return '<div><span>' + esc(dateShort(y.t)) + '</span><span>' + (ya ? '<b>' + esc(ya.a) + '</b>' : '—') + '</span><span>' + esc(y.f || '—') + '</span><span>' +
            (y.b1 == null ? '—' : '<span class="' + (y.b1 >= 0 ? 'up' : 'dn') + '">' + pct(y.b1, 2) + '</span>') + '</span><span>' +
            (y.b4 == null ? '—' : '<span class="' + (y.b4 >= 0 ? 'up' : 'dn') + '">' + pct(y.b4, 2) + '</span>') + '</span></div>';
        }).join('') + '</div>');
      var b1 = past.filter(function (y) { return y.b1 != null; }).map(function (y) { return y.b1; });
      if (b1.length >= 2) {
        var m = b1.reduce(function (s, v) { return s + Math.abs(v); }, 0) / b1.length, up = b1.filter(function (v) { return v > 0; }).length;
        x.push('<p class="ec-note">' + esc(tr('d_avg', { m: m.toFixed(2), n: b1.length, u: up })) + '</p>' + spark(b1.slice().reverse()));
      }
    }
    return x.join('');
  }
  function spark(vals) {
    var W = 260, H = 60, mx = Math.max.apply(null, vals.map(Math.abs).concat([0.5])), bw = W / vals.length;
    var s = '<svg class="ec-spark" viewBox="0 0 ' + W + ' ' + H + '" style="direction:ltr" aria-hidden="true"><line x1="0" x2="' + W + '" y1="' + H / 2 + '" y2="' + H / 2 + '" stroke="rgba(255,255,255,.2)"/>';
    vals.forEach(function (v, i) { var h = Math.abs(v) / mx * (H / 2 - 3); s += '<rect x="' + (i * bw + 2).toFixed(1) + '" width="' + (bw - 4).toFixed(1) + '" y="' + (v >= 0 ? H / 2 - h : H / 2).toFixed(1) + '" height="' + Math.max(1, h).toFixed(1) + '" fill="' + (v >= 0 ? '#22c55e' : '#ef4444') + '" rx="2"/>'; });
    return s + '</svg>';
  }
  function wireList() {
    var box = d.getElementById('ecList'); if (!box) return;
    box.addEventListener('click', function (ev) {
      var bl = ev.target.closest('[data-bell]');
      if (bl) { ev.stopPropagation(); openBell(box._ev[+bl.dataset.bell], bl); return; }
      var row = ev.target.closest('.ec-row'); if (!row) return;
      var i = +row.dataset.i, det = d.getElementById('ecDet' + i);
      if (!det) return;
      if (det.hidden) { det.innerHTML = detail(box._ev[i]); det.hidden = false; row.classList.add('open'); } else { det.hidden = true; row.classList.remove('open'); }
    });
    box.addEventListener('keydown', function (ev) { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('ec-row')) { ev.preventDefault(); ev.target.click(); } });
    var wk = d.getElementById('ecWk');
    if (wk) wk.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b || b.disabled) return;
      var v = +b.dataset.w; ST.wk = v === 0 ? 0 : ST.wk + v; drawList();
    });
  }

  /* ------------------------------------------------------------------ reminders: browser, .ics, Telegram */
  function rems() { return ls.get('ek_cal_rem', []).filter(function (x) { return x.t > now() - 3600; }); }
  function setRems(a) { ls.set('ek_cal_rem', a); }
  var POP = null;
  function closePop() { if (POP) { POP.remove(); POP = null; } }
  function openBell(e, anchor) {
    closePop();
    var on = rems().some(function (x) { return x.k === key(e); });
    POP = d.createElement('div'); POP.className = 'ec-pop'; POP.setAttribute('role', 'dialog');
    POP.innerHTML = '<b>' + esc(T('rem_h')) + '</b><span class="n">' + esc(title(e)) + ' · ' + esc(hm(e.t)) + '</span>' +
      [15, 30, 60].map(function (m) { return '<button type="button" data-m="' + m + '">⏰ ' + esc(T('rem_' + m)) + '</button>'; }).join('') +
      '<button type="button" data-ics="1">📅 ' + esc(T('rem_ics')) + '</button>' +
      '<a class="btn" href="' + BOT + '" target="_blank" rel="noopener">✈️ ' + esc(T('rem_tg')) + '</a>' +
      (on ? '<button type="button" data-off="1" class="off">✕ ' + esc(T('rem_off')) + '</button>' : '');
    d.body.appendChild(POP);
    var r = anchor.getBoundingClientRect(), pw = Math.min(300, w.innerWidth - 24);
    POP.style.width = pw + 'px';
    POP.style.top = (w.scrollY + r.bottom + 6) + 'px';
    POP.style.left = Math.max(12, Math.min(w.innerWidth - pw - 12, r.left + r.width / 2 - pw / 2)) + 'px';
    POP.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.m) {
        var m = +b.dataset.m, a = rems().filter(function (x) { return x.k !== key(e); });
        a.push({ k: key(e), t: e.t, n: e.n, tr: e.tr || {}, m: m }); setRems(a);
        if (w.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (x) { } }
        toast(tr('rem_set', { m: m }) + (w.Notification && Notification.permission === 'denied' ? ' ' + T('rem_perm') : ''));
        closePop(); drawList(); drawRems();
      } else if (b.dataset.ics) { ics([e]); closePop(); }
      else if (b.dataset.off) { setRems(rems().filter(function (x) { return x.k !== key(e); })); toast(T('rem_off')); closePop(); drawList(); drawRems(); }
    });
  }
  d.addEventListener('click', function (ev) { if (POP && !ev.target.closest('.ec-pop') && !ev.target.closest('[data-bell]')) closePop(); });
  d.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closePop(); });
  function toast(msg) {
    var t = d.createElement('div'); t.className = 'ec-toast'; t.textContent = msg; d.body.appendChild(t);
    setTimeout(function () { t.classList.add('in'); }, 10); setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 400); }, 5200);
  }
  function beep() {
    try {
      var A = new (w.AudioContext || w.webkitAudioContext)(), o = A.createOscillator(), g = A.createGain();
      o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(A.destination);
      g.gain.setValueAtTime(0.0001, A.currentTime); g.gain.exponentialRampToValueAtTime(0.25, A.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime + 0.9);
      o.start(); o.stop(A.currentTime + 1);
    } catch (x) { }
  }
  function checkRems() {
    var a = ls.get('ek_cal_rem', []), n = now(), changed = false;
    a.forEach(function (x) {
      if (!x.fired && n >= x.t - x.m * 60 && n < x.t + 60) {
        x.fired = 1; changed = true;
        var nm = LG() === 'en' ? x.n : ((x.tr || {})[LG()] || x.n), msg = tr('rem_fire', { m: Math.max(0, Math.round((x.t - n) / 60)), n: nm });
        toast(msg); beep();
        if (w.Notification && Notification.permission === 'granted') { try { new Notification('entekhab.net', { body: msg, tag: x.k, icon: '/assets/icon-192.png' }); } catch (y) { } }
      }
    });
    a = a.filter(function (x) { return x.t > n - 6 * 3600; });
    if (changed || a.length !== ls.get('ek_cal_rem', []).length) setRems(a);
  }
  function drawRems() {
    var box = d.getElementById('ecRem'); if (!box) return;
    var a = rems().filter(function (x) { return x.t > now(); }).sort(function (p, q) { return p.t - q.t; });
    box.innerHTML = '<h3>' + esc(T('rem_list')) + '</h3>' + (a.length ? '<ul>' + a.map(function (x) {
      var nm = LG() === 'en' ? x.n : ((x.tr || {})[LG()] || x.n);
      return '<li><span>' + esc(dayName(dayKey(x.t)) + ' · ' + hm(x.t)) + '</span> <b>' + esc(nm) + '</b> <small>(' + x.m + ' ' + esc(T('m_short')) + ')</small></li>';
    }).join('') + '</ul>' : '<p class="ec-note">' + esc(T('rem_none')) + '</p>');
  }
  function icsDate(t) { return new Date(t * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function ics(list) {
    var L2 = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//entekhab.net//calendar//FA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    list.forEach(function (e) {
      var desc = (e.f ? 'Forecast: ' + e.f + '\n' : '') + (e.p ? 'Previous: ' + e.p + '\n' : '') + PAGE;
      L2.push('BEGIN:VEVENT', 'UID:' + e.t + '-' + e.c + '-' + e.n.replace(/[^A-Za-z0-9]/g, '') + '@entekhab.net', 'DTSTAMP:' + icsDate(now()),
        'DTSTART:' + icsDate(e.t), 'DTEND:' + icsDate(e.t + 900), 'SUMMARY:' + icsEsc((e.i === 'H' ? '🔴 ' : '') + e.c + ' · ' + title(e)),
        'DESCRIPTION:' + icsEsc(desc), 'URL:' + PAGE, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title(e)), 'TRIGGER:-PT30M', 'END:VALARM', 'END:VEVENT');
    });
    L2.push('END:VCALENDAR');
    var blob = new Blob([L2.join('\r\n')], { type: 'text/calendar;charset=utf-8' }), a = d.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = list.length === 1 ? 'entekhab-' + list[0].c + '-' + list[0].t + '.ics' : 'entekhab-week.ics';
    d.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function wireIcsWeek() {
    var b = d.getElementById('ecIcsWeek'); if (!b) return;
    b.onclick = function () {
      if (!CAL) return;
      var r = weekRange(), list = CAL.events.filter(function (e) { var k = dayKey(e.t); return e.c === 'USD' && e.i === 'H' && e.t > now() && k >= r[0] && k < r[1]; });
      if (!list.length) list = CAL.events.filter(function (e) { return e.c === 'USD' && e.i === 'H' && e.t > now(); }).slice(0, 12);
      if (list.length) ics(list); else toast(T('empty'));
    };
  }

  /* ------------------------------------------------------------------ the Fed */
  function drawFed() {
    var box = d.getElementById('ecFed'); if (!box) return;
    if (!FED || !(FED.meetings || []).length) { box.innerHTML = '<p class="ec-note">' + esc(T(FED === false ? 'nodata' : 'loading')) + '</p>'; return; }
    var n = now(), ms = FED.meetings.filter(function (m) { return m.date > n - 3600; });
    if (!ms.length) { box.innerHTML = '<p class="ec-note">' + esc(T('nodata')) + '</p>'; return; }
    var m0 = ms[0], r = FED.rate || {}, best = OUTS.slice().sort(function (a, b) { return m0.p[b] - m0.p[a]; })[0];
    var h = '<div class="ec-cards">';
    if (r.hi != null) h += '<div><span class="k">' + esc(T('fed_rate')) + '</span><b class="v">' + r.lo + '–' + r.hi + '%</b>' +
      (r.move ? '<span class="s">' + esc(tr('fed_last', { m: T('m_' + r.move), d: dateShort(r.date) })) + '</span>' : '') + '</div>';
    h += '<div><span class="k">' + esc(T('fed_next')) + '</span><b class="v">' + esc(dateShort(m0.date)) + '</b><span class="s">' + esc(T('in') + ' ' + dur(m0.date - n)) + '</span></div>';
    h += '<div><span class="k">' + esc(T('fed_likely')) + '</span><b class="v" style="color:' + OUT_COL[best] + '">' + esc(T('o_' + best)) + '</b><span class="s">' + m0.p[best].toFixed(0) + '%</span></div>';
    h += '<div><span class="k">' + esc(T('fed_exp')) + '</span><b class="v">' + (m0.exp > 0 ? '+' : '') + esc(tr('fed_bp', { b: m0.exp })) + '</b></div></div>';
    /* bars for the next meeting */
    h += '<div class="ec-bars">' + OUTS.map(function (k) {
      var v = m0.p[k] || 0;
      return '<div class="br"><span class="l">' + esc(T('o_' + k)) + '</span><span class="t"><i style="width:' + Math.max(v, .4) + '%;background:' + OUT_COL[k] + '"></i></span><b>' + v.toFixed(1) + '%</b></div>';
    }).join('') + '</div>';
    /* table of meetings */
    var cols = T('fed_cols').split('|'), cum = r.hi != null ? +r.hi : null, path = [];
    h += '<h3>' + esc(T('fed_tbl')) + '</h3><div class="ec-tw"><table class="ec-ft"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    ms.forEach(function (m) {
      var mx = Math.max.apply(null, OUTS.map(function (k) { return m.p[k] || 0; }));
      h += '<tr><td>' + esc(dateShort(m.date)) + '</td>' + OUTS.map(function (k) {
        var v = m.p[k] || 0, a = Math.min(.85, v / 100 + .05);
        return '<td style="background:' + hexA(OUT_COL[k], v >= 1 ? a : 0) + (v === mx ? ';font-weight:800' : '') + '">' + (v >= .5 ? v.toFixed(0) + '%' : '·') + '</td>';
      }).join('') + '<td dir="ltr">' + (m.exp > 0 ? '+' : '') + m.exp + '</td></tr>';
      if (cum != null) { cum += m.exp / 100; path.push([m.date, cum]); }
    });
    h += '</tbody></table></div>';
    if (path.length >= 2) h += '<h3>' + esc(T('fed_path')) + '</h3>' + pathChart(r.hi, path) + '<p class="ec-note">' + esc(T('fed_path_note')) + '</p>';
    var hist = (FED.hist || {})[m0.ticker] || [];
    h += '<h3>' + esc(T('fed_histh')) + '</h3>' + (hist.length >= 3 ? histChart(hist) : '<p class="ec-note">' + esc(T('fed_hist_few')) + '</p>');
    h += '<p class="ec-note">' + esc(tr('fed_src', { t: FED.t ? dateShort(FED.t) + ' ' + hm(FED.t) : '—' })) + '</p>';
    box.innerHTML = h;
  }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a.toFixed(2) + ')'; }
  function pathChart(start, path) {
    var W = 640, H = 200, P = 34, pts = [[path[0][0] - 30 * 86400, +start]].concat(path);
    var ys = pts.map(function (p) { return p[1]; }), lo = Math.min.apply(null, ys) - .15, hi = Math.max.apply(null, ys) + .15;
    var x0 = pts[0][0], x1 = pts[pts.length - 1][0];
    var X = function (t) { return P + (t - x0) / (x1 - x0) * (W - 2 * P); }, Y = function (v) { return H - P + 10 - (v - lo) / (hi - lo) * (H - 2 * P); };
    var s = '<svg class="ec-chart" viewBox="0 0 ' + W + ' ' + H + '" style="direction:ltr" role="img" aria-label="' + esc(T('fed_path')) + '">';
    for (var g = Math.ceil(lo * 4) / 4; g <= hi; g += .25) s += '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '" stroke="rgba(255,255,255,.08)"/><text x="4" y="' + (Y(g) + 4).toFixed(1) + '" fill="#9a9a94" font-size="11">' + g.toFixed(2) + '%</text>';
    var dpath = 'M' + X(pts[0][0]).toFixed(1) + ' ' + Y(pts[0][1]).toFixed(1);
    for (var i = 1; i < pts.length; i++) dpath += 'H' + X(pts[i][0]).toFixed(1) + 'V' + Y(pts[i][1]).toFixed(1);
    s += '<path d="' + dpath + 'H' + (W - P) + '" fill="none" stroke="#f7931a" stroke-width="2.5"/>';
    path.forEach(function (p) {
      var x = new Date(p[0] * 1000);
      s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="4" fill="#f7931a"/><text x="' + X(p[0]).toFixed(1) + '" y="' + (H - 6) + '" fill="#9a9a94" font-size="10" text-anchor="middle">' + (MONS.en[x.getUTCMonth()]) + ' ' + String(x.getUTCFullYear()).slice(2) + '</text>' +
        '<text x="' + X(p[0]).toFixed(1) + '" y="' + (Y(p[1]) - 9).toFixed(1) + '" fill="#ffd27a" font-size="10" text-anchor="middle">' + p[1].toFixed(2) + '</text>';
    });
    return s + '</svg>';
  }
  function histChart(hist) {
    var W = 640, H = 210, P = 34, t0 = hist[0][0], t1 = hist[hist.length - 1][0] || t0 + 1;
    var X = function (t) { return P + (t - t0) / Math.max(1, t1 - t0) * (W - 2 * P); }, Y = function (v) { return H - P - v / 100 * (H - 2 * P); };
    var s = '<svg class="ec-chart" viewBox="0 0 ' + W + ' ' + H + '" style="direction:ltr" role="img" aria-label="' + esc(T('fed_histh')) + '">';
    [0, 25, 50, 75, 100].forEach(function (g) { s += '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + Y(g) + '" y2="' + Y(g) + '" stroke="rgba(255,255,255,.08)"/><text x="4" y="' + (Y(g) + 4) + '" fill="#9a9a94" font-size="11">' + g + '%</text>'; });
    OUTS.forEach(function (k, idx) {
      var col = idx + 1, mx = Math.max.apply(null, hist.map(function (r) { return r[col]; }));
      if (mx < 3) return;
      s += '<polyline fill="none" stroke="' + OUT_COL[k] + '" stroke-width="2.2" points="' + hist.map(function (r) { return X(r[0]).toFixed(1) + ',' + Y(r[col]).toFixed(1); }).join(' ') + '"/>';
      var lr = hist[hist.length - 1];
      s += '<text x="' + (W - P + 2) + '" y="' + (Y(lr[col]) + 4).toFixed(1) + '" fill="' + OUT_COL[k] + '" font-size="10">' + lr[col].toFixed(0) + '</text>';
    });
    var a = new Date(t0 * 1000), b = new Date(t1 * 1000);
    s += '<text x="' + P + '" y="' + (H - 8) + '" fill="#9a9a94" font-size="10">' + a.getUTCDate() + ' ' + MONS.en[a.getUTCMonth()] + '</text><text x="' + (W - P) + '" y="' + (H - 8) + '" fill="#9a9a94" font-size="10" text-anchor="end">' + b.getUTCDate() + ' ' + MONS.en[b.getUTCMonth()] + '</text>';
    s += '</svg><div class="ec-leg">' + OUTS.map(function (k) { return '<span><i style="background:' + OUT_COL[k] + '"></i>' + esc(T('o_' + k)) + '</span>'; }).join('') + '</div>';
    return s;
  }

  /* ------------------------------------------------------------------ boot */
  function drawAge() {
    var b = d.getElementById('ecAge'); if (!b || !CAL || !CAL.updated_at) return;
    var t = Date.parse(CAL.updated_at) / 1000; if (!t) return;
    b.textContent = tr('data_age', { t: dateShort(t) + ' ' + hm(t) });
  }
  function renderAll() { drawFilters(); drawHero(); drawList(); drawFed(); drawRems(); drawAge(); }
  function load() {
    return Promise.all([j('/data/ecocal.json' + V()), j('/data/econ_actual.json' + V()), j('/data/fed.json' + V())]).then(function (r) {
      if (r[0] && r[0].events) { CAL = r[0]; CAL.events.sort(function (a, b) { return a.t - b.t; }); } else if (!CAL) CAL = false;
      ACT = (r[1] && r[1].v) || ACT;
      FED = r[2] || (FED || false);
    });
  }
  function boot() {
    if (typeof uiLang === 'function') uiLang(renderAll); else renderAll();
    wireFilters(); wireList(); wireIcsWeek();
    load().then(function () {
      renderAll();
    });
    setInterval(function () { drawHero(); checkRems(); }, 15000);
    setInterval(function () { load().then(function () { drawList(); drawFed(); drawAge(); }); }, 5 * 60000);
    checkRems();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
