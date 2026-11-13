/* entekhab.net — /bitcoin/ «درک بیت‌کوین» (fa · ckb · en; Arabic via /assets/ar.js).
   Needs /assets/ui.js (I, T, lang, uiLang, esc, j, V, share).
   Every figure about supply, rewards and halvings is computed here from Bitcoin's own rule (Bitcoin Core,
   validation.cpp GetBlockSubsidy: 50 BTC in satoshis, shifted right once per 210,000 blocks). Live values come from
   mempool.space in the browser and fall back to the site's own /data/btcinfo.json. The "probable price" column is the
   author's (Coin Kurd's) model and is always labelled as such. */
(function () {
  'use strict';
  var d = document, w = window;
  var COIN = 1e8, INT = 210000, NOW_Y = new Date().getUTCFullYear();

  /* ------------------------------------------------------------------ Bitcoin's rule */
  function subN(n) { return n >= 64 ? 0 : Math.floor(5e9 / Math.pow(2, n)); }          // == (50*COIN) >> n
  function supplyAt(h) { var s = 0; for (var n = 0; n < 64; n++) { var a = n * INT, b = a + INT; if (h <= a) break; s += subN(n) * (Math.min(h, b) - a); } return s; } // sats issued by blocks [0,h)
  var MAX = supplyAt(64 * INT);                                                              // 2,099,999,997,690,000 sats
  function eraYear(n) { return n === 0 ? 2009 : 2012 + 4 * (n - 1); }                       // the table's "estimated year" convention
  function eraOfYear(y) { return y < 2012 ? 0 : Math.min(33, Math.floor((y - 2012) / 4) + 1); }
  var BIN0 = (5e9).toString(2);                                                              // 33 binary digits

  /* the author's model: one price per halving year (index = halving number). 2012–2024 = the price on the day. */
  var MODEL = [0, 12, 651, 8821, 64969, 222043, 683898, 1770342, 4035256, 8346133, 15988655, 28787728, 49245346, 80695548,
    127476783, 195121923, 290566175, 422373112, 600979056, 838955983, 1151293181, 1555697812, 2072914569, 2727064601,
    3546003842, 4561700933, 5810634848, 7334212405, 9179205768, 11398210098, 14050121461, 17200635147, 20922764488, 25297380326];
  function modelAt(y) {                                         // log-linear between the model's halving years
    if (y >= 2140) return MODEL[33];
    var n = eraOfYear(y); if (n < 1) return null;
    var y0 = eraYear(n), y1 = eraYear(n + 1), p0 = MODEL[n], p1 = MODEL[Math.min(33, n + 1)];
    return p0 * Math.pow(p1 / p0, (y - y0) / (y1 - y0));
  }
  function modelYearOf(p) {                                     // first (fractional) year the model reaches price p
    for (var n = 2; n <= 33; n++) if (MODEL[n] >= p) { var a = MODEL[n - 1], b = MODEL[n]; return eraYear(n - 1) + 4 * Math.log(p / a) / Math.log(b / a); }
    return null;
  }
  function yearOfSupply(btc) {                                  // (fractional) year the circulating supply passes btc
    var t = btc * COIN, lo = 0, hi = 64 * INT;
    while (lo < hi) { var m = Math.floor((lo + hi) / 2); if (supplyAt(m + 1) >= t) hi = m; else lo = m + 1; }
    var n = Math.floor(lo / INT); return eraYear(n) + (n === 0 ? 3.9 : 4) * ((lo - n * INT) / INT);
  }

  /* monthly closes since July 2010 (mempool.space historical prices; weekly samples until 2021, hourly after),
     snapshot of 2026-11-12. Newer months come from the site's weekly candles and the live price. */
  var HIST = '201007:.0505,201008:.064,201009:.0622,201010:.115,201011:.27,201012:.263,201101:.4799,201102:.89,201103:.8275,201104:1.63,201105:8.4,201106:16.45,201107:13.98,201108:9.07,201109:5.33,201110:3.27,201111:2.48,201112:4.22,201201:5.38,201202:4.92,201203:4.55,201204:4.9,201205:5.14,201206:6.35,201207:8.71,201208:10.61,201209:12.19,201210:10.7,201211:12.48,201212:13.45,201301:17.95,201302:29.89,201303:71.93,201304:134,201305:134,201306:108,201307:98.78,201308:122,201309:144,201310:264,201311:1080,201312:759,201401:803,201402:681,201403:448,201404:448,201405:640,201406:647,201407:584,201408:525,201409:393,201410:348,201411:380,201412:319,201501:228,201502:269,201503:248,201504:227,201505:227,201506:265,201507:281,201508:230,201509:236,201510:409,201511:360,201512:430,201601:368,201602:421,201603:424,201604:448,201605:537,201606:677,201607:566,201608:574,201609:615,201610:747,201611:743,201612:1133,201701:989,201702:1222,201703:1141,201704:1514,201705:2295,201706:2614,201707:2701,201708:4660,201709:4218,201710:6741,201711:13738,201712:15186,201801:10100,201802:10308,201803:6790,201804:9217,201805:7660,201806:6584,201807:7604,201808:6687,201809:6464,201810:6308,201811:3691,201812:3886,201901:3367,201902:3852,201903:4972,201904:5324,201905:7787,201906:11980,201907:10090,201908:10585,201909:8382,201910:9338,201911:7191,201912:7174,202001:9616,202002:8759,202003:6663,202004:9166,202005:9664,202006:9235,202007:11746,202008:11397,202009:10775,202010:14163,202011:19231,202012:36877,202101:37671,202102:50400,202103:58786,202104:57497,202105:37565,202106:35046,202107:39749,202108:48872,202109:55350,202110:62943,202111:57238,202112:43410,202201:36903,202202:44691,202203:45264,202204:37966,202205:31726,202206:19259,202207:23310,202208:20052,202209:19427,202210:20498,202211:17171,202212:16529,202301:23134,202302:23180,202303:28534,202304:29400,202305:27177,202306:30489,202307:29214,202308:26053,202309:27009,202310:34549,202311:37700,202312:42297,202401:42634,202402:61259,202403:70981,202404:60531,202405:67473,202406:62810,202407:64967,202408:59022,202409:63515,202410:70372,202411:96520,202412:93318,202501:102239,202502:84082,202503:82381,202504:94122,202505:104680,202506:107167,202507:116072,202508:108899,202509:113962,202510:109529,202511:91261,202512:87589,202601:78051,202602:67114,202603:68109,202604:76226,202605:73853,202606:58548,202607:62887,202608:78578,202609:83633,202610:77434,202611:71682'
    .split(',').map(function (s) { var p = s.split(':'); return [+p[0], +p[1]]; });
  /* days at each price decade (floor(log10 price)), first market price 2010-07-19 → 2026-11-12, same source */
  var DIST = { to: Date.UTC(2026, 10, 12) / 864e5, b: { '-2': 91, '-1': 175, '0': 413, '1': 364, '2': 1333, '3': 1127, '4': 2241, '5': 217 } };
  var HALV = [[1, 1354116278], [2, 1468082773], [3, 1589225023], [4, 1713571767]];      // block timestamps of halvings 1–4
  var FILMS = w.BK_FILMS || {};                                                          // set in the page when the films ship

  /* ------------------------------------------------------------------ language helpers */
  var LG = function () { return (typeof lang !== 'undefined' && (lang === 'ckb' || lang === 'en')) ? lang : (typeof lang !== 'undefined' && lang === 'ar' ? 'en' : 'fa'); };
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩' };
  function loc(s) {                                             // digits of the reader's language, in prose
    var g = DIG[LG()]; if (!g) return String(s);
    return String(s).replace(/\d[\d,]*(\.\d+)?/g, function (m) { return m.replace(/\d/g, function (c) { return g[+c]; }).replace(/,/g, '٬').replace(/\./g, '٫'); });
  }
  function nf(n, dg) { return n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dg || 0, maximumFractionDigits: dg || 0 }); }
  function nl(n, dg) { return loc(nf(n, dg)); }                 // localized number for prose
  function pc(v, dg) { return loc(Number(v).toFixed(dg == null ? 2 : dg)) + (LG() === 'en' ? '%' : '٪'); }
  function trim(x, dg) { return Number(x).toFixed(dg).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''); }
  function unitB() { return LG() === 'en' ? 'BTC' : LG() === 'ckb' ? 'بیتکۆین' : 'بیت‌کوین'; }
  function unitS() { return LG() === 'en' ? 'sats' : LG() === 'ckb' ? 'ساتۆشی' : 'ساتوشی'; }
  function bd(x) { return '<bdi>' + x + '</bdi>'; }
  function tr(k, v) { var s = T(k); if (s == null) return ''; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  function btcStr(sats) {                                       // shortest exact BTC string of a satoshi amount
    var s = (sats / COIN).toFixed(8).replace(/0+$/, '').replace(/\.$/, ''); return s;
  }
  function usdShort(v) {
    if (v == null || isNaN(v)) return '—';
    var a = Math.abs(v), L = LG();
    var U = { fa: [[1e12, ' تریلیون'], [1e9, ' میلیارد'], [1e6, ' میلیون']], ckb: [[1e12, ' تریلیۆن'], [1e9, ' ملیار'], [1e6, ' ملیۆن']], en: [[1e12, ' trillion'], [1e9, ' billion'], [1e6, ' million']] }[L];
    for (var i = 0; i < U.length; i++) if (a >= U[i][0]) return loc(trim(v / U[i][0], v / U[i][0] >= 100 ? 0 : 2)) + U[i][1];
    return nl(v, a < 10 ? 2 : 0);
  }
  var MON = {
    fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
    ckb: ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  function dateL(ms) {
    var t = new Date(ms), L = LG(), s = (L === 'ckb' ? '' : '') + t.getUTCDate() + (L === 'ckb' ? 'ی ' : ' ') + MON[L][t.getUTCMonth()] + (L === 'ckb' ? 'ی ' : ' ') + t.getUTCFullYear();
    if (L === 'en') s = t.getUTCDate() + ' ' + MON.en[t.getUTCMonth()] + ' ' + t.getUTCFullYear();
    var out = loc(s);
    if (L === 'fa') { try { out += ' (' + new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(t) + ')'; } catch (e) { } }
    return out;
  }
  var $q = function (s, r) { return (r || d).querySelector(s); }, $a = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };
  function set(id, html) { var e = d.getElementById(id); if (e && e.innerHTML !== html) e.innerHTML = html; }

  /* ------------------------------------------------------------------ live state */
  var S = { h: null, hash: null, price: null, hr: null, diff: null, t: null, src: 'wait' };
  var CANDLE = { d: null, w: null };
  function get(u, txt) {
    var c = w.AbortController ? new AbortController() : null, to = setTimeout(function () { if (c) c.abort(); }, 8000);
    return fetch(u, c ? { signal: c.signal, cache: 'no-store' } : { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return txt ? r.text() : r.json(); })
      .finally(function () { clearTimeout(to); });
  }
  function saved() {
    return get('/data/btcinfo.json' + (typeof V === 'function' ? V() : '')).then(function (x) {
      var b = (x.blocks || [])[0];
      if (b && (S.h == null || b.height > S.h)) { S.h = b.height; S.hash = b.id; }
      if (S.price == null && x.price) S.price = x.price;
      if (S.hr == null) S.hr = x.hashrate; if (S.diff == null) S.diff = x.difficulty;
      S.t = x.t; if (S.src === 'wait') S.src = 'saved';
    }).catch(function () { });
  }
  function live() {
    var M = 'https://mempool.space/api';
    var a = get(M + '/blocks/tip/height', 1).then(function (v) { v = parseInt(v, 10); if (v > 0) S.h = v; });
    var b = get(M + '/blocks/tip/hash', 1).then(function (v) { if (/^0{8}[0-9a-f]{56}$/.test(v)) S.hash = v; });
    var c = get(M + '/v1/prices').then(function (v) { if (v && v.USD > 0) S.price = v.USD; })
      .catch(function () { return get('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT').then(function (v) { var p = parseFloat(v.price); if (p > 0) S.price = p; }); });
    var e = get(M + '/v1/mining/hashrate/3d').then(function (v) { if (v.currentHashrate) S.hr = v.currentHashrate; if (v.currentDifficulty) S.diff = v.currentDifficulty; });
    return Promise.allSettled([a, b, c, e]).then(function (r) { if (r[0].status === 'fulfilled') S.src = 'live'; });
  }
  function candles() {
    get('/data/candles/BTC_1d.json').then(function (x) { CANDLE.d = ((x.s || {}).BTC || {})['1d'] || null; drawDist(); }).catch(function () { });
    get('/data/candles/BTC_1w.json').then(function (x) { CANDLE.w = ((x.s || {}).BTC || {})['1w'] || null; drawChart(); }).catch(function () { });
  }

  /* ------------------------------------------------------------------ derived numbers */
  function now() {
    var h = S.h; if (h == null) return null;
    var n = Math.floor(h / INT), sup = supplyAt(h + 1), sb = subN(n), next = (n + 1) * INT, left = next - h;
    return { h: h, n: n, sup: sup, sb: sb, next: next, left: left, eta: Date.now() + left * 6e5, p: S.price,
      leftH: subN(n) * (next - (h + 1)), infl: sb * 52560 / sup, inflN: subN(n + 1) * 52560 / (sup + subN(n) * (next - h - 1)) };
  }

  /* ------------------------------------------------------------------ hero: quick numbers + the halving clock */
  function drawClock(N) {
    var el = d.getElementById('bkClock'); if (!el) return;
    var done = N ? N.n : 4, frac = N ? 1 - N.left / INT : 0, cx = 200, cy = 200, R1 = 186, R0 = 168, gap = 1.6, h = '';
    h += '<defs><linearGradient id="bkg" x1="0" x2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#f7931a"/></linearGradient></defs>';
    for (var i = 0; i < 33; i++) {
      var a0 = (-90 + i * 360 / 33 + gap / 2) * Math.PI / 180, a1 = (-90 + (i + 1) * 360 / 33 - gap / 2) * Math.PI / 180;
      var p = function (r, a) { return (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2); };
      var cls = i < done ? 'done' : i === done ? 'now' : '';
      h += '<path class="bk-notch ' + cls + '" d="M' + p(R0, a0) + 'L' + p(R1, a0) + 'A' + R1 + ' ' + R1 + ' 0 0 1 ' + p(R1, a1) + 'L' + p(R0, a1) + 'A' + R0 + ' ' + R0 + ' 0 0 0 ' + p(R0, a0) + 'Z"><title>' +
        esc(tr('s_chart_hv', { n: loc(i + 1) })) + ' · ~' + loc(eraYear(i + 1)) + '</title></path>';
    }
    var r = 156, a = -Math.PI / 2, b = a + Math.max(.001, frac) * 2 * Math.PI, large = frac > .5 ? 1 : 0;
    h += '<circle cx="200" cy="200" r="' + r + '" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="4"/>';
    h += '<path d="M' + (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + (cx + r * Math.cos(b)).toFixed(2) + ' ' + (cy + r * Math.sin(b)).toFixed(2) + '" fill="none" stroke="url(#bkg)" stroke-width="4" stroke-linecap="round"/>';
    el.querySelector('svg').innerHTML = h;
    var cap = el.querySelector('.cap');
    if (cap) cap.innerHTML = N ? '<b>' + nf(N.left) + '</b> ' + esc(LG() === 'en' ? 'blocks' : LG() === 'ckb' ? 'بلۆک' : 'بلاک') + ' ' + esc(T('hero_next')) : esc(T('hero_ring'));
  }
  function drawHero(N) {
    var q = d.getElementById('bkQuick'); if (!q) return;
    var cd = N ? countdown(N.left * 6e5, 1) : '—';
    var cells = [
      [T('g_height'), N ? nf(N.h) : '—', N ? tr('h_prog_now') + ': ' + loc(eraYear(N.n)) + '–' + loc(eraYear(N.n + 1)) : ''],
      [T('g_pct'), N ? (N.sup / MAX * 100).toFixed(2) + '%' : '—', N ? nl(N.sup / COIN, 0) + ' / ' + loc('21,000,000') : ''],
      [T('g_to'), N ? nf(N.left) : '—', cd],
      [T('g_rusd'), N && N.p ? '$' + nf(N.sb / COIN * N.p) : '—', N ? loc(btcStr(N.sb)) + ' BTC' : '']
    ];
    q.innerHTML = cells.map(function (c) { return '<div class="bk-q"><small>' + esc(c[0]) + '</small><b>' + esc(c[1]) + '</b><i>' + esc(c[2]) + '</i></div>'; }).join('');
  }
  function countdown(ms, short) {
    var m = Math.max(0, Math.round(ms / 6e4)), dd = Math.floor(m / 1440), hh = Math.floor(m % 1440 / 60), mm = m % 60;
    return loc(dd) + ' ' + T('days') + ' · ' + loc(hh) + ' ' + T('hours') + (short ? '' : ' · ' + loc(mm) + ' ' + T('mins'));
  }

  /* ------------------------------------------------------------------ at a glance (bitcoinblockhalf-style) */
  function drawGlance(N) {
    var g = d.getElementById('bkGlance'); if (!g) return;
    var p = N && N.p, cells;
    if (!N) cells = [];
    else cells = [
      ['g_circ', nf(N.sup / COIN, 0) + ' BTC', '', 'hl', (N.sup / MAX * 100)],
      ['g_cap', '21,000,000 BTC', T('g_cap_s')],
      ['g_pct', (N.sup / MAX * 100).toFixed(2) + '%', ''],
      ['g_left', nf((MAX - N.sup) / COIN, 0) + ' BTC', T('g_left_s')],
      ['g_lefth', nf(N.leftH / COIN, 0) + ' BTC', ''],
      ['g_height', nf(N.h), ''],
      ['g_to', nf(N.left), countdown(N.left * 6e5)],
      ['g_eta', '', dateL(N.eta) + ' — ' + T('g_eta_s'), 'hl'],
      ['g_reward', loc(btcStr(N.sb)) + ' BTC', tr('g_reward_s', { next: loc(btcStr(subN(N.n + 1))) })],
      ['g_rusd', p ? '$' + nf(N.sb / COIN * p) : '—', ''],
      ['g_day', nf(N.sb * 144 / COIN, 0) + ' BTC', tr('g_day_s', { next: nl(subN(N.n + 1) * 144 / COIN, 0) })],
      ['g_infl', (N.infl * 100).toFixed(2) + '%', tr('g_infl_s', { next: pc(N.inflN * 100) })],
      ['g_price', p ? '$' + nf(p) : '—', ''],
      ['g_mcap', p ? '$' + nf(N.sup / COIN * p / 1e9, 0) + 'B' : '—', p ? usdShort(N.sup / COIN * p) + (LG() === 'en' ? ' dollars' : LG() === 'ckb' ? ' دۆلار' : ' دلار') : ''],
      ['g_hash', S.hr ? nf(S.hr / 1e18, 0) + ' EH/s' : '—', S.diff ? tr('g_hash_s', { d: (S.diff / 1e12).toFixed(2) + ' T' }) : ''],
      ['g_halv', nf(N.n) + ' / 33', T('g_halv_s')]
    ];
    g.innerHTML = cells.map(function (c) {
      var big = c[0] === 'g_eta' ? '' : '<b>' + esc(c[1]) + '</b>';
      var eta = c[0] === 'g_eta' ? '<b style="font-family:inherit;direction:inherit;font-size:1.02rem;white-space:normal">' + esc(dateL(N.eta)) + '</b><i>' + esc(T('g_eta_s')) + '</i>' : '';
      var bar = c[4] != null ? '<div class="bk-bar"><span style="width:' + c[4].toFixed(2) + '%"></span></div>' : '';
      return '<div class="bk-st ' + (c[3] || '') + '"><small>' + esc(T(c[0])) + '</small>' + big + eta + (c[0] === 'g_eta' ? '' : '<i>' + esc(c[2] || '') + '</i>') + bar + '</div>';
    }).join('');
    var st = d.getElementById('bkStat');
    if (st) { st.className = 'bk-stat ' + S.src; st.textContent = S.src === 'live' ? T('g_live') : S.src === 'saved' ? tr('g_saved', { t: S.t ? loc(S.t.slice(11, 16)) + ' UTC' : '' }) : T('g_wait'); }
  }

  /* ------------------------------------------------------------------ halving explained: binary table, stacks, dots */
  function drawBin(N) {
    var el = d.getElementById('bkBin'); if (!el) return;
    var cols = T('h_bin_cols').split('|'), cur = N ? N.n : 4, h = '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (var n = 0; n <= 33; n++) {
      var keep = BIN0.slice(0, 33 - n), drop = BIN0.slice(33 - n), s = subN(n);
      var cls = n < cur ? 'past' : n === cur ? 'now' : s === 0 ? 'zero' : '';
      h += '<tr class="' + cls + '"><td>' + n + '</td><td>' + nf(n * INT) + '</td><td class="b"><u>' + (keep || '0') + '</u><s>' + drop + '</s></td><td>' + nf(s) + '</td><td>' + btcStr(s) + '</td><td>~' + eraYear(n) + '</td></tr>';
    }
    el.innerHTML = h + '</tbody></table>';
  }
  function drawStacks(N) {
    var el = d.getElementById('bkStacks'); if (!el) return;
    var W = Math.max(300, el.clientWidth || 600), H = Math.round(Math.min(300, Math.max(210, W * .42))), vals = [0, 1, 2, 3, 4, 5], cur = N ? N.n : 4;
    var colW = W / vals.length, coinW = Math.min(76, colW * .62), th = Math.max(3.2, Math.min(5.6, (H - 70) / 33)), base = H - 34, s = '';
    s += '<defs><linearGradient id="bkcg" x1="0" x2="1"><stop offset="0" stop-color="#c26a00"/><stop offset=".45" stop-color="#ffb347"/><stop offset=".55" stop-color="#ffd27a"/><stop offset="1" stop-color="#b05f00"/></linearGradient></defs>';
    vals.forEach(function (n, i) {
      var cx = colW * (i + .5), coins = Math.round(subN(n) / subN(5)), fut = n > cur;
      for (var k = 0; k < coins; k++) {
        var y = base - k * th;
        s += '<ellipse cx="' + cx.toFixed(1) + '" cy="' + (y + th * .5).toFixed(1) + '" rx="' + (coinW / 2).toFixed(1) + '" ry="' + (th * 1.25).toFixed(1) + '" fill="' + (fut ? 'none' : 'url(#bkcg)') + '" stroke="' + (fut ? '#ffd27a' : 'rgba(80,40,0,.55)') + '" stroke-width="' + (fut ? 1.2 : .6) + '"' + (fut ? ' stroke-dasharray="3 3"' : '') + '/>';
      }
      var top = base - coins * th - th * 1.6;
      s += '<text x="' + cx.toFixed(1) + '" y="' + (top - 8).toFixed(1) + '" text-anchor="middle" fill="#fff" font-size="' + Math.max(12, Math.min(16, colW * .17)).toFixed(0) + '" font-weight="700" style="direction:ltr">' + btcStr(subN(n)) + '</text>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" fill="' + (n === cur ? '#ffd27a' : '#8d8f93') + '" font-size="13" style="direction:ltr">' + loc(eraYear(n)) + '</text>';
    });
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(T('h_stack_h')) + '">' + s + '</svg>';
  }
  function drawDots(N) {
    var el = d.getElementById('bkDots'); if (!el) return;
    var cur = N ? N.n : 4, h = '';
    for (var i = 1; i <= 33; i++) {
      var cls = i <= cur ? 'done' : i === cur + 1 ? 'now' : '';
      if (i === 33) cls += ' last';
      h += '<span class="bk-dot ' + cls + '" title="' + esc(tr('s_chart_hv', { n: loc(i) }) + ' · ~' + loc(eraYear(i)) + ' · ' + btcStr(subN(i)) + ' BTC') + '"></span>';
    }
    el.innerHTML = h;
  }

  /* ------------------------------------------------------------------ eras: nested halves (area = coins of the era) */
  function drawEras(N) {
    var el = d.getElementById('bkEras'); if (!el) return;
    var W = Math.max(300, el.clientWidth || 800), H = Math.round(W / Math.SQRT2), cur = N ? N.n : 4, x = 0, y = 0, w0 = W, h0 = H, s = '', L = LG();
    var dirs = ['L', 'T', 'R', 'B'], arcs = '';
    for (var n = 0; n < 33; n++) {
      var r, dir = dirs[n % 4];
      if (dir === 'L') { r = [x, y, w0 / 2, h0]; x += w0 / 2; w0 /= 2; }
      else if (dir === 'T') { r = [x, y, w0, h0 / 2]; y += h0 / 2; h0 /= 2; }
      else if (dir === 'R') { r = [x + w0 / 2, y, w0 / 2, h0]; w0 /= 2; }
      else { r = [x, y + h0 / 2, w0, h0 / 2]; h0 /= 2; }
      var past = n < cur, isNow = n === cur, op = past ? Math.max(.18, .9 - n * .14) : isNow ? 1 : .06;
      var fill = isNow ? 'url(#bkeg)' : past ? 'rgba(247,147,26,' + op.toFixed(2) + ')' : 'rgba(255,255,255,' + Math.max(.02, .07 - (n - cur) * .006).toFixed(3) + ')';
      s += '<rect x="' + r[0].toFixed(2) + '" y="' + r[1].toFixed(2) + '" width="' + r[2].toFixed(2) + '" height="' + r[3].toFixed(2) + '" fill="' + fill + '" stroke="rgba(7,8,10,.9)" stroke-width="' + Math.max(.4, 2.2 - n * .25).toFixed(2) + '"><title>' +
        esc(tr('e_era', { n: loc(n + 1) }) + ' · ' + loc(eraYear(n)) + '–' + loc(eraYear(n + 1)) + ' · ' + tr('e_coins', { c: nl(subN(n) * INT / COIN, n < 9 ? 0 : 4) })) + '</title></rect>';
      // a quarter-ellipse through each box, so the halves read as one spiral
      var ax, ay, bx, by, sw;
      if (dir === 'L') { ax = r[0]; ay = r[1] + r[3]; bx = r[0] + r[2]; by = r[1]; }
      else if (dir === 'T') { ax = r[0]; ay = r[1]; bx = r[0] + r[2]; by = r[1] + r[3]; }
      else if (dir === 'R') { ax = r[0] + r[2]; ay = r[1]; bx = r[0]; by = r[1] + r[3]; }
      else { ax = r[0] + r[2]; ay = r[1] + r[3]; bx = r[0]; by = r[1]; }
      sw = 1;
      if (n < 14) arcs += (n === 0 ? 'M' + ax.toFixed(2) + ' ' + ay.toFixed(2) : '') + 'A' + r[2].toFixed(2) + ' ' + r[3].toFixed(2) + ' 0 0 ' + sw + ' ' + bx.toFixed(2) + ' ' + by.toFixed(2);
      var fs = Math.min(r[2], r[3]) * (n === 0 ? .12 : .16);
      if (fs >= 10.5) {
        var tx = r[0] + r[2] / 2, ty = r[1] + r[3] / 2, col = isNow ? '#1a1004' : '#fff';
        s += '<text x="' + tx.toFixed(1) + '" y="' + (ty - fs * .25).toFixed(1) + '" text-anchor="middle" fill="' + col + '" font-size="' + fs.toFixed(1) + '" font-weight="800">' + esc(loc(eraYear(n)) + '–' + loc(eraYear(n + 1))) + '</text>';
        s += '<text x="' + tx.toFixed(1) + '" y="' + (ty + fs * 1.05).toFixed(1) + '" text-anchor="middle" fill="' + col + '" fill-opacity=".85" font-size="' + (fs * .72).toFixed(1) + '">' + esc(n < 3 ? usdShort(subN(n) * INT / COIN).replace(/\$/, '') : nl(subN(n) * INT / COIN, 0)) + ' BTC' + (isNow ? ' · ' + T('e_now') : '') + '</text>';
      }
    }
    var defs = '<defs><linearGradient id="bkeg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#f7931a"/></linearGradient></defs>';
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(T('e_h')) + '" style="direction:ltr">' + defs + s +
      '<path d="' + arcs + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.4" stroke-dasharray="4 5"/></svg>';
    var leg = d.getElementById('bkErasLeg');
    if (leg) {
      var rows = [];
      for (var k = 0; k < 6; k++) rows.push('<span>' + bd('<b>' + loc(eraYear(k)) + '–' + loc(eraYear(k + 1)) + '</b>') + ' · ' + bd(nl(subN(k) * INT / COIN, 0) + ' ' + unitB()) + ' · ' + bd(loc(trim(100 / Math.pow(2, k + 1), 4)) + (LG() === 'en' ? '%' : '٪')) + '</span>');
      rows.push('<span>' + esc(T('e_rest')) + '</span>');
      leg.innerHTML = rows.join('');
    }
  }

  /* ------------------------------------------------------------------ the full table */
  var tableOpen = false;
  function drawTable(N) {
    var el = d.getElementById('bkTable'); if (!el) return;
    var cols = T('t_cols').split('|'), cur = N ? N.n : 4, h = '<table class="bk-t"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (var n = 0; n <= 33; n++) {
      var s = subN(n), sup = supplyAt(n * INT), cls = n < cur ? 'past' : n === cur ? 'now' : '', price;
      if (n === 0) price = '<td>—</td>';
      else if (n <= 4) price = '<td>' + nf(MODEL[n]) + '</td>';
      else price = '<td class="model">' + nf(MODEL[n]) + '</td>';
      if (!tableOpen && n > 12) cls += ' hide';
      h += '<tr class="' + cls + '"><td>' + n + '</td><td>' + eraYear(n) + '</td><td>' + nf(n * INT) + '</td><td>' + (s / COIN).toFixed(8) + '</td><td>' + nf(s) + '</td><td>' + nf(sup / COIN, 4) + '</td><td>' + trim(sup / MAX * 100, n >= 16 ? 8 : 6) + '%</td>' + price + '</tr>';
    }
    el.innerHTML = h + '</tbody></table>';
    var b = d.getElementById('bkMore'); if (b) b.textContent = tableOpen ? T('t_less') : T('t_more');
  }

  /* ------------------------------------------------------------------ scarcity: price chart, days per range, proof of work */
  function months() {
    var m = HIST.slice(), last = m[m.length - 1][0], add = {};
    (CANDLE.w || []).forEach(function (c) { var t = new Date(c[0] * 1000), k = t.getUTCFullYear() * 100 + t.getUTCMonth() + 1; if (k > last) add[k] = c[4]; });
    Object.keys(add).sort().forEach(function (k) { m.push([+k, add[k]]); });
    if (S.price) { var t = new Date(), k = t.getUTCFullYear() * 100 + t.getUTCMonth() + 1; if (m[m.length - 1][0] === k) m[m.length - 1] = [k, S.price]; else if (k > m[m.length - 1][0]) m.push([k, S.price]); }
    return m;
  }
  function drawChart() {
    var el = d.getElementById('bkChart'); if (!el) return;
    var N = now(), M = months(), W = Math.max(300, el.clientWidth || 900), H = Math.round(Math.min(440, Math.max(260, W * .5)));
    var padL = W < 520 ? 44 : 56, padR = 14, padT = 30, padB = 30;
    var t0 = Date.UTC(2010, 6, 1), etaNext = N ? N.eta : Date.UTC(2028, 3, 12), t1 = Math.max(etaNext + 90 * 864e5, Date.now() + 90 * 864e5);
    var X = function (t) { return padL + (t - t0) / (t1 - t0) * (W - padL - padR); }, lo = -2, hi = 6;
    var Y = function (p) { return padT + (hi - Math.log10(p)) / (hi - lo) * (H - padT - padB); };
    var mt = function (k) { return Date.UTC(Math.floor(k / 100), k % 100 - 1, 28); };
    var s = '<defs><linearGradient id="bkag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7931a" stop-opacity=".45"/><stop offset="1" stop-color="#f7931a" stop-opacity="0"/></linearGradient></defs>';
    var labs = ['1¢', '10¢', '$1', '$10', '$100', '$1K', '$10K', '$100K', '$1M'];
    for (var e = lo; e <= hi; e++) {
      var yy = Y(Math.pow(10, e)).toFixed(1);
      s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '" stroke="rgba(255,255,255,.07)"/>';
      s += '<text x="' + (padL - 6) + '" y="' + (+yy + 4) + '" text-anchor="end" fill="#8d8f93" font-size="11">' + labs[e - lo] + '</text>';
    }
    for (var yr = 2011; yr <= new Date(t1).getUTCFullYear(); yr += (W < 600 ? 3 : 2)) {
      var xx = X(Date.UTC(yr, 0, 1)); if (xx > W - padR) break;
      s += '<text x="' + xx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#8d8f93" font-size="11">' + loc(yr) + '</text>';
    }
    HALV.forEach(function (hv) {
      var xx = X(hv[1] * 1000).toFixed(1);
      s += '<line x1="' + xx + '" x2="' + xx + '" y1="' + padT + '" y2="' + (H - padB) + '" stroke="#ffd27a" stroke-opacity=".55" stroke-width="1.2"/>';
      s += '<text x="' + xx + '" y="' + (padT - 10) + '" text-anchor="middle" fill="#ffd27a" font-size="11" font-weight="700">' + esc(W < 560 ? loc(hv[0]) : tr('s_chart_hv', { n: loc(hv[0]) })) + '</text>';
    });
    var xn = X(etaNext).toFixed(1);
    s += '<line x1="' + xn + '" x2="' + xn + '" y1="' + padT + '" y2="' + (H - padB) + '" stroke="#ffd27a" stroke-opacity=".7" stroke-dasharray="4 4"/>';
    s += '<text x="' + xn + '" y="' + (padT - 10) + '" text-anchor="end" fill="#ffd27a" font-size="11">' + esc(W < 560 ? loc(5) : T('s_chart_next')) + '</text>';
    var path = '', area = '';
    M.forEach(function (m, i) { var px = X(mt(m[0])).toFixed(1), py = Y(m[1]).toFixed(1); path += (i ? 'L' : 'M') + px + ' ' + py; });
    var lx = X(mt(M[M.length - 1][0])).toFixed(1);
    area = path + 'L' + lx + ' ' + (H - padB) + 'L' + X(mt(M[0][0])).toFixed(1) + ' ' + (H - padB) + 'Z';
    s += '<path d="' + area + '" fill="url(#bkag)"/><path d="' + path + '" fill="none" stroke="#f7931a" stroke-width="2" stroke-linejoin="round"/>';
    var lp = M[M.length - 1];
    s += '<circle cx="' + lx + '" cy="' + Y(lp[1]).toFixed(1) + '" r="4.5" fill="#fff" stroke="#f7931a" stroke-width="2"/>';
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(T('s_chart_h')) + '" style="direction:ltr">' + s +
      '<line class="cx" x1="0" x2="0" y1="' + padT + '" y2="' + (H - padB) + '" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3" style="display:none"/></svg><div class="bk-tip"></div>';
    var svg = el.querySelector('svg'), tip = el.querySelector('.bk-tip'), cx = svg.querySelector('.cx');
    function move(ev) {
      var r = svg.getBoundingClientRect(), px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left, k = px * W / r.width;
      var best = null, bd = 1e9; M.forEach(function (m) { var dx = Math.abs(X(mt(m[0])) - k); if (dx < bd) { bd = dx; best = m; } });
      if (!best) return;
      var bx = X(mt(best[0])), by = Y(best[1]);
      cx.setAttribute('x1', bx); cx.setAttribute('x2', bx); cx.style.display = '';
      tip.style.left = (bx / W * r.width) + 'px'; tip.style.top = (by / H * r.height) + 'px'; tip.style.opacity = 1;
      tip.textContent = Math.floor(best[0] / 100) + '-' + String(best[0] % 100).padStart(2, '0') + '  $' + nf(best[1], best[1] < 10 ? 2 : 0);
    }
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', function () { tip.style.opacity = 0; cx.style.display = 'none'; });
  }
  function drawDist() {
    var el = d.getElementById('bkDist'); if (!el) return;
    var b = {}, k; for (k in DIST.b) b[k] = DIST.b[k];
    var to = DIST.to, seen = {};
    (CANDLE.d || []).forEach(function (c) { var day = Math.floor(c[0] / 86400); if (day > DIST.to && !seen[day] && c[4] > 0) { seen[day] = 1; var e = Math.floor(Math.log10(c[4])); b[e] = (b[e] || 0) + 1; if (day > to) to = day; } });
    var curE = S.price ? Math.floor(Math.log10(S.price)) : 4, mx = 0, rows = [];
    for (k in b) mx = Math.max(mx, b[k]);
    var name = function (e) { var f = function (x) { return x < 1 ? Math.round(x * 100) + '¢' : '$' + (x >= 1e6 ? x / 1e6 + 'M' : x >= 1e3 ? x / 1e3 + 'K' : x); }; return f(Math.pow(10, e)) + '–' + f(Math.pow(10, e + 1)); };
    for (var e = 6; e >= -2; e--) {
      var v = b[e] || 0;
      rows.push('<div class="bk-dr' + (e === curE ? ' on' : '') + '"><span class="r">' + name(e) + '</span><span class="w"><span style="width:' + (v / mx * 100).toFixed(1) + '%"></span></span><span class="d">' + (v ? esc(tr('s_dist_days', { n: nl(v) })) : '—') + '</span></div>');
    }
    el.innerHTML = rows.join('');
    set('bkDistP', esc(tr('s_dist_p', { d: dateL(to * 864e5).replace(/ \(.*\)$/, '') })));
  }
  function bigWords(x) {                                         // 6.37e23 → "637 هزار میلیارد میلیارد" / "637 sextillion"
    var L = LG(), e = Math.floor(Math.log10(x)), u, names;
    names = { fa: { 18: 'میلیارد میلیارد', 21: 'هزار میلیارد میلیارد', 24: 'میلیون میلیارد میلیارد' }, ckb: { 18: 'ملیار ملیار', 21: 'هەزار ملیار ملیار', 24: 'ملیۆن ملیار ملیار' }, en: { 18: 'quintillion', 21: 'sextillion', 24: 'septillion' } }[L];
    u = e >= 24 ? 24 : e >= 21 ? 21 : 18;
    return nl(x / Math.pow(10, u), 0) + ' ' + names[u];
  }
  function sci(x) { var p = x.toExponential(2).split('e+'), sup = '⁰¹²³⁴⁵⁶⁷⁸⁹'; return p[0] + '×10' + p[1].split('').map(function (c) { return sup[+c]; }).join(''); }
  function drawMine() {
    var el = d.getElementById('bkMine'); if (!el) return;
    var D = S.diff, hr = S.hr, hash = S.hash, odds = D ? D * 4294967296 : null, cells = [];
    cells.push(['s_mine_d', D ? (D / 1e12).toFixed(2) + ' T' : '—', D ? nf(D, 0) : '']);
    cells.push(['s_mine_hr', hr ? nf(hr / 1e18, 0) + ' EH/s' : '—', hr ? bigWords(hr) + (LG() === 'en' ? ' hashes a second' : LG() === 'ckb' ? ' هاش لە چرکەیەکدا' : ' هش در ثانیه') : '']);
    cells.push(['s_mine_odds', odds ? '1 : ' + sci(odds) : '—', odds ? tr('s_mine_odds_v', { n: bigWords(odds) }) : '']);
    el.innerHTML = cells.map(function (c) { return '<div class="bk-st"><small>' + esc(T(c[0])) + '</small><b>' + esc(c[1]) + '</b><i>' + esc(c[2]) + '</i></div>'; }).join('');
    var hb = d.getElementById('bkHash');
    if (hb) {
      if (hash) { var z = (hash.match(/^0*/) || [''])[0].length; hb.innerHTML = '<small style="font-family:Vazirmatn;color:#8d8f93">' + esc(T('s_mine_hash')) + ' · ' + esc(tr('s_mine_zeros', { n: loc(z) })) + '</small><br><u>' + hash.slice(0, z) + '</u>' + hash.slice(z); }
      else hb.textContent = '—';
    }
  }

  /* ------------------------------------------------------------------ the funnel + calculators */
  var calc = { by: NOW_Y - 30, age: 65, m: 5, mode: 'me' };
  function satsPerDollar() { return S.price ? COIN / S.price : null; }
  function dollarEra() { var s = satsPerDollar(); if (!s) return null; for (var n = 0; n <= 33; n++) if (subN(n) <= s) return n; return 33; }
  function eraSpan(n) { return loc(eraYear(n)) + (LG() === 'en' ? '–' : '–') + loc(eraYear(n + 1)); }
  function drawFunnel(N) {
    var el = d.getElementById('bkFunnel'); if (!el) return;
    var cur = N ? N.n : 4, dn = dollarEra(), tg = target().n, h = '';
    for (var n = 0; n <= 33; n++) {
      var s = subN(n), wv = (34 - n) / 34 * 100, cls = n === cur ? 'today' : n === dn ? 'dollar' : '', mark = '';
      if (n === tg) cls += ' tgt';
      if (n === cur) mark = T('f_today'); else if (n === dn) mark = T('f_dollar');
      h += '<button type="button" class="bk-fr ' + cls + '" data-n="' + n + '"><span class="y">' + loc(eraYear(n)) + '</span><span class="w"><span style="width:' + wv.toFixed(1) + '%">' + (mark ? '<em dir="auto">' + esc(mark) + '</em>' : '') + '</span></span><span class="r">' + (s >= 1e6 ? btcStr(s) + ' BTC' : s ? nf(s) + ' sat' : '0') + '</span></button>';
    }
    el.innerHTML = h;
  }
  function funnelText(N) {
    var p = S.price, spd = satsPerDollar(), dn = dollarEra();
    set('bkFnow', N && p ? esc(tr('f_now', { r: loc(btcStr(N.sb)), usd: nl(N.sb / COIN * p) })) : '');
    set('bkFone', spd && dn != null ? esc(tr('f_one', { sats: nl(spd), era: eraSpan(dn), esats: nl(subN(dn)) })) : '');
    set('bkFidea', N && p && dn != null ? esc(tr('f_idea', { era: eraSpan(dn), usd: nl(N.sb / COIN * p) })) : '');
  }
  function target() {
    var y = calc.mode === 'kid' ? NOW_Y + 25 : calc.by + calc.age;
    return { y: y, n: eraOfYear(y) };
  }
  function drawCalc() {
    var out = d.getElementById('bkCalcOut'); if (!out) return;
    var by = calc.by, ok = calc.mode === 'kid' || (by >= 1930 && by <= NOW_Y && calc.age >= 1 && calc.age <= 120);
    if (!ok) { out.innerHTML = '<div class="wide"><small>' + esc(T('c_bad')) + '</small></div>'; return; }
    var t = target(), n = t.n, s = subN(n), p = S.price, cost = p ? s / COIN * p : null, mv = modelAt(t.y), cells = [];
    cells.push(['c_r_year', loc(t.y), tr('c_r_era', { n: loc(n), a: loc(eraYear(n)), b: loc(eraYear(n + 1)) })]);
    if (n >= 33 || !s) { out.innerHTML = cells.map(cell).join('') + '<div class="wide"><b>' + esc(T('c_r_end')) + '</b></div>'; drawFunnel(now()); return; }
    cells.push(['c_r_reward', loc(btcStr(s)) + ' ' + unitB(), nl(s) + ' ' + unitS()]);
    cells.push(['c_r_cost', cost != null ? (LG() === 'en' ? '$' + nf(cost, cost < 10 ? 2 : 0) : nl(cost, cost < 10 ? 2 : 0) + (LG() === 'ckb' ? ' دۆلار' : ' دلار')) : '—', '']);
    if (cost != null && calc.m > 0) cells.push([null, tr('c_r_dca_v', { k: nl(Math.max(1, Math.ceil(cost / calc.m))) }), tr('c_r_dca', { m: nl(calc.m) })]);
    if (mv) cells.push(['c_r_model', tr('c_r_model_v', { usd: usdShort(s / COIN * mv) }), '', 'm']);
    out.innerHTML = cells.map(cell).join('');
    drawFunnel(now());
    function cell(c) {
      var lab = c[0] ? (c[0] === 'c_r_model' ? tr('c_r_model', { y: loc(t.y) }) : T(c[0])) : c[2];
      var sub = c[0] ? c[2] : '';
      return '<div class="' + (c[3] || '') + '"><small>' + esc(lab) + '</small><b>' + esc(c[1]) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    }
  }
  function drawDca() {
    var out = d.getElementById('bkDcaOut'); if (!out) return;
    var m = +(d.getElementById('bkDm') || {}).value || 0, y = +(d.getElementById('bkDy') || {}).value || 0, p = S.price;
    if (!(m > 0 && y > 0)) { out.innerHTML = ''; return; }
    var tot = m * 12 * y, sats = p ? tot / p * COIN : null, n = null;
    if (sats) for (var k = 0; k <= 33; k++) if (subN(k) <= sats) { n = k; break; }
    var cur = LG() === 'en' ? function (v) { return '$' + nf(v); } : function (v) { return nl(v) + (LG() === 'ckb' ? ' دۆلار' : ' دلار'); };
    out.innerHTML = '<div><small>' + esc(T('d_r_total')) + '</small><b>' + esc(cur(tot)) + '</b></div>' +
      '<div><small>' + esc(T('d_r_sats')) + '</small><b>' + (sats ? bd(esc(nl(sats)) + ' ' + unitS()) + ' · ' + bd(esc(loc(trim(sats / COIN, 6))) + ' ' + unitB()) : '—') + '</b></div>' +
      (n != null ? '<div class="wide"><small>' + esc(T('d_r_era')) + '</small><b>' + bd(esc(eraSpan(n))) + ' · ' + bd(esc(loc(btcStr(subN(n)))) + ' ' + unitB()) + '</b></div>' : '');
  }
  function drawKids() {
    var p = S.price, y = NOW_Y + 25, mv = modelAt(y);
    set('bkKidModel', p && mv ? esc(tr('k_model', { btc: loc((100 / p).toFixed(6)), y: loc(y), usd: usdShort(100 / p * mv) })) : '');
  }

  /* ------------------------------------------------------------------ future headlines */
  var WN = 22;
  function drawWords(N) {
    var el = d.getElementById('bkWords'); if (!el) return;
    var p = S.price, v = {
      3: { y: loc(Math.round(modelYearOf(1e6))) }, 6: { y: loc(Math.round(modelYearOf(1e8))) },
      9: { i: N ? pc(N.infl * 100) : '—' }, 12: { o: S.diff ? bigWords(S.diff * 4294967296) : '—' },
      14: { s: p ? nl(COIN / p) : '—' }, 18: { y: loc(Math.round(yearOfSupply(MAX / COIN * .99))) }, 20: { y: loc(Math.round(yearOfSupply(20999000))) }
    }, h = '';
    for (var i = 1; i <= WN; i++) h += '<article class="bk-w"><span class="n">' + String(i).padStart(2, '0') + '</span><b>' + esc(T('w' + i + '_t')) + '</b><p>' + esc(tr('w' + i + '_p', v[i])) + '</p></article>';
    el.innerHTML = h;
  }

  /* world wealth in bitcoin: UBS Global Wealth Reports put personal wealth above $470 trillion ($471T at end-2023) */
  var WEALTH = 470e12;
  function drawWealth(N) {
    var p = S.price, box = d.getElementById('bkWealthBig');
    if (!N || !p) { set('bkWealth', ''); if (box) box.innerHTML = ''; return; }
    var b = WEALTH / p, c = N.sup / COIN, x = b / c;
    set('bkWealth', esc(tr('s_w_p', { b: usdShort(b), c: usdShort(c), x: nl(x, 0), s: pc(100 / x, 2) })));
    if (box) box.innerHTML = '<div><b>' + esc(usdShort(b)) + '</b><small>' + esc(T('s_w_al')) + '</small></div>' +
      '<div><b>' + esc(usdShort(c)) + '</b><small>' + esc(T('s_w_bl')) + '</small></div>' +
      '<div><b>×' + esc(nl(x, 0)) + '</b><small>' + esc(T('s_w_xl')) + '</small></div>';
  }
  function drawS1(N) { set('bkS1', N ? esc(tr('s_p1', { circ: nl(N.sup / COIN, 0), left: nl((MAX - N.sup) / COIN, 0) })) : ''); }
  function drawTags() {
    var b = d.getElementById('bkTags'); if (!b) return;
    b.innerHTML = (T('tags') || '').split(' #').map(function (x, i) { return '<button type="button">' + esc((i ? '#' : '') + x) + '</button>'; }).join('');
  }

  /* ------------------------------------------------------------------ film */
  var filmLang = null;
  function drawFilm() {
    var box = d.getElementById('bkFilm'); if (!box) return;
    var want = filmLang || (LG() === 'ckb' ? 'ckb' : 'fa'), F = FILMS[want] || FILMS.fa || FILMS.ckb;
    $a('.bk-film .tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.f === want); b.hidden = !FILMS[b.dataset.f]; });
    var v = box.querySelector('video');
    var sec = d.getElementById('film'); if (sec) sec.hidden = !F;
    if (!F) return;
    if (!v) { box.innerHTML = '<video controls playsinline preload="none"></video>'; v = box.querySelector('video'); }
    if (v.dataset.f !== want) { var playing = !v.paused; v.dataset.f = want; v.poster = F.poster; v.src = F.src; if (playing) v.play().catch(function () { }); }
    set('bkFilmNote', esc(tr('film_note', { size: loc(F.mb) })));
    var dl = d.getElementById('bkFilmDl'); if (dl) { dl.href = F.src; dl.setAttribute('download', F.src.split('/').pop()); }
  }

  /* ------------------------------------------------------------------ toc, reveal, wiring */
  function toc() {
    var box = d.getElementById('bkToc'); if (!box) return;
    box.innerHTML = $a('[data-toc]').filter(function (s) { return !s.hidden; }).map(function (s) { return '<a href="#' + s.id + '" data-to="' + s.id + '">' + esc(T(s.dataset.toc)) + '</a>'; }).join('');
  }
  var spyOn = null;
  function spy() {
    if (!('IntersectionObserver' in w)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          if (e.target.dataset.toc && spyOn !== e.target.id) {
            spyOn = e.target.id;
            $a('#bkToc a').forEach(function (a) { var on = a.dataset.to === spyOn; a.classList.toggle('on', on); if (on && a.scrollIntoView && w.innerWidth < 900) { var p = a.parentNode; p.scrollTo({ left: a.offsetLeft - p.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' }); } });
          }
        }
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    $a('.bk-sec').forEach(function (s) { io.observe(s); });
    var rv = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    $a('.bk-rv').forEach(function (s) { rv.observe(s); });
  }
  function renderAll() {
    var N = now();
    drawHero(N); drawClock(N); drawGlance(N); drawBin(N); drawStacks(N); drawDots(N); drawEras(N); drawTable(N);
    drawChart(); drawDist(); drawMine(); funnelText(N); drawCalc(); drawDca(); drawKids(); drawWords(N); drawFilm(); drawS1(N); drawWealth(N); drawTags(); toc();
    var shareP = d.getElementById('bkShare'); if (shareP) shareP.onclick = function () { share(T('share_txt'), 'https://entekhab.net/bitcoin/'); };
  }
  function renderData() {                                       // what moves with the network (cheap, every minute)
    var N = now(); drawHero(N); drawClock(N); drawGlance(N); drawMine(); funnelText(N); drawCalc(); drawDca(); drawKids(); drawWords(N); drawS1(N); drawWealth(N);
  }
  function wire() {
    var by = d.getElementById('bkBy'), age = d.getElementById('bkAge'), m = d.getElementById('bkM');
    if (by) { by.value = calc.by; by.oninput = function () { calc.by = +by.value; calc.mode = 'me'; chips(); drawCalc(); }; }
    if (age) { age.value = calc.age; age.oninput = function () { calc.age = +age.value; calc.mode = 'me'; chips(); drawCalc(); }; }
    if (m) { m.value = calc.m; m.oninput = function () { calc.m = +m.value; drawCalc(); }; }
    function chips() { $a('#bkCalcChips button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === calc.mode); }); }
    $a('#bkCalcChips button').forEach(function (b) { b.onclick = function () { calc.mode = b.dataset.mode; if (calc.mode === 'kid') { if (by) by.value = NOW_Y; if (age) age.value = 25; } else { if (by) by.value = calc.by; if (age) age.value = calc.age; } chips(); drawCalc(); }; });
    chips();
    ['bkDm', 'bkDy'].forEach(function (id) { var e = d.getElementById(id); if (e) e.oninput = drawDca; });
    var more = d.getElementById('bkMore'); if (more) more.onclick = function () { tableOpen = !tableOpen; drawTable(now()); };
    $a('.bk-film .tabs button').forEach(function (b) { b.onclick = function () { filmLang = b.dataset.f; drawFilm(); }; });
    var fs = d.getElementById('bkFilmShare'); if (fs) fs.onclick = function () { share(T('film_h'), 'https://entekhab.net/bitcoin/#film'); };
    var tg = d.getElementById('bkTags'); if (tg) tg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; try { navigator.clipboard.writeText(b.textContent); } catch (x) { } b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 900); });
    d.getElementById('bkFunnel') && d.getElementById('bkFunnel').addEventListener('click', function (e) {
      var r = e.target.closest('.bk-fr'); if (!r) return; var n = +r.dataset.n, s = subN(n), p = S.price;
      set('bkFunTip', esc(loc(eraYear(n)) + '–' + loc(eraYear(n + 1)) + ' · ' + (s >= 1e6 ? loc(btcStr(s)) + ' BTC' : nl(s) + ' sat')) + (p && s ? ' · ≈ ' + esc(LG() === 'en' ? '$' + nf(s / COIN * p, s / COIN * p < 10 ? 2 : 0) : nl(s / COIN * p, s / COIN * p < 10 ? 2 : 0) + (LG() === 'ckb' ? ' دۆلار' : ' دلار')) : ''));
    });
    var rz; w.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { var N = now(); drawStacks(N); drawEras(N); drawChart(); }, 160); }, { passive: true });
  }
  var timer = null;
  function tick() { live().then(renderData); }
  function loop() { clearTimeout(timer); if (d.visibilityState === 'visible') timer = setTimeout(function () { tick(); loop(); }, 60000); }

  function boot() {
    if (typeof uiLang === 'function') uiLang(function () { renderAll(); }); else renderAll();
    wire();
    saved().then(renderData);
    live().then(function () { renderData(); drawChart(); drawDist(); });
    candles();
    spy(); loop();
    d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'visible') { tick(); loop(); } });
  }
  w.BK = { subN: subN, supplyAt: supplyAt, MAX: MAX, eraYear: eraYear, eraOfYear: eraOfYear, modelAt: modelAt, modelYearOf: modelYearOf, yearOfSupply: yearOfSupply, S: S, now: now };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
