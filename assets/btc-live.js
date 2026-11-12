/* entekhab.net — "Bitcoin, right now" (the lower half of /satoshi/).
   Reads the network itself: mempool.space for what moves (blocks, the queue, fees, difficulty) every 30 seconds, and the
   site's own files data/btcinfo.json + data/chain.json (written by CI every 15 minutes from mempool.space, bitnodes.io and
   blockchair.com) for the rest and as a fallback — in which case the page says so and shows the time of that record.
   Supply, issuance and halving are arithmetic on the block height. Nothing is estimated beyond what is labelled "about".
   btcLive(root) -> { stop } */
(function () {
  'use strict';
  var d = document, de = d.documentElement, w = window, MP = 'https://mempool.space/api';
  var RM = !!(w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function lang() { return de.lang === 'en' || de.lang === 'ckb' ? de.lang : 'fa'; }
  function L(fa, ckb, en) { var l = lang(); return l === 'en' ? en : l === 'ckb' ? ckb : fa; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function N(v, dg) { return v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: dg || 0, maximumFractionDigits: dg || 0 }); }
  function usd(v) { return v == null || isNaN(v) ? '—' : '$' + (v >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 100 ? N(v) : v >= 1 ? v.toFixed(2) : v.toFixed(3)); }
  function getJSON(u, ms) {
    var c = w.AbortController ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); }, ms || 8000);
    return fetch(u, c ? { signal: c.signal } : {}).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); }, function (e) { clearTimeout(t); throw e; });
  }
  function supply(h) { var s = 0, r = 50, left = h + 1, n; while (left > 0 && r > 1e-9) { n = Math.min(left, 210000); s += n * r; left -= n; r /= 2; } return s; }
  function subsidy(h) { return 50 / Math.pow(2, Math.floor(h / 210000)); }
  function ago(ts) {
    var s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
    if (s < 90) return L(s + ' ثانیه پیش', s + ' چرکە لەمەوبەر', s + 's ago');
    var m = Math.round(s / 60); if (m < 90) return L(m + ' دقیقه پیش', m + ' خولەک لەمەوبەر', m + ' min ago');
    var h = Math.round(m / 60); return L(h + ' ساعت پیش', h + ' کاتژمێر لەمەوبەر', h + 'h ago');
  }
  function clock(ts) { var s = Math.max(0, Math.floor(Date.now() / 1000 - ts)), m = Math.floor(s / 60); return (m < 10 ? '0' : '') + m + ':' + ('0' + s % 60).slice(-2); }
  function dateOf(ms) { try { return new Date(ms).toLocaleDateString(lang() === 'en' ? 'en-GB' : lang() === 'ckb' ? 'ckb-IQ' : 'fa-IR-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return new Date(ms).toISOString().slice(0, 10); } }
  function hhmm(iso) { try { var t = new Date(iso); return ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2); } catch (e) { return ''; } }

  function btcLive(root) {
    if (!root) return null;
    var D = {}, state = 'load', alive = true, timers = [], coin = null, sel = null, lastTip = 0, price = null, probe = null;
    root.innerHTML = '<span class="bx-st" role="status"><i></i><span></span></span>' +
      '<div class="bx-hud"><div class="bx-core"><img src="/assets/coin-front.webp" alt="" width="512" height="512" loading="lazy" decoding="async"><canvas aria-hidden="true"></canvas></div><svg class="bx-ln" aria-hidden="true"></svg>' +
      ['l y1', 'l y2', 'l y3', 'r y1', 'r y2', 'r y3'].map(function (c, i) { return '<div class="bx-co ' + c + '" data-c="' + i + '"><span class="bx-lb"></span><b>—</b><small></small></div>'; }).join('') + '</div>' +
      '<div class="bx-tm"><form class="bx-find" role="search"><input type="search" name="q" autocomplete="off" spellcheck="false" enterkeyhint="search"><button type="submit"></button></form>' +
      '<div class="bx-sl"><button type="button" data-go="live"></button><div class="bx-rg"><output class="bx-rd"></output><input type="range" min="0" max="0" step="1" value="0" dir="rtl"></div><button type="button" data-go="0"></button></div>' +
      '<div class="bx-marks"></div><p class="bx-msg" role="status" aria-live="polite"></p></div>' +
      '<div class="bx-belt" tabindex="0"><div class="bx-q"></div><div class="bx-now"><span></span></div><div class="bx-m"></div></div><div class="bx-det" hidden></div><div class="mp-sx" hidden></div>' +
      '<div class="bx-grid"></div><p class="bx-foot"></p>';
    var $ = function (s) { return root.querySelector(s); }, hud = $('.bx-hud'), core = $('.bx-core');

    function px() { var v = probe && +probe.dataset.v; return v > 0 ? v : (price || D.price || null); }
    function setState(s) { state = s; var el = $('.bx-st'); el.className = 'bx-st ' + s; el.lastChild.textContent = s === 'live' ? L('زنده از mempool.space', 'ڕاستەوخۆ لە mempool.space', 'Live from mempool.space') : s === 'snap' ? L('دادهٔ ثبت‌شدهٔ سایت در ' + hhmm(D.t) + ' — اتصال زنده به شبکه برقرار نشد', 'داتای تۆمارکراوی ماڵپەڕ لە ' + hhmm(D.t) + ' — پەیوەندیی زیندوو نەکرا', 'Site record of ' + hhmm(D.t) + ' — no live connection to the network') : s === 'fail' ? L('داده‌ای در دسترس نیست', 'داتا بەردەست نییە', 'No data available') : L('در حال خواندن شبکه…', 'تۆڕەکە دەخوێنرێتەوە…', 'Reading the network…'); }

    /* ---- the six read-outs around the coin */
    function hudFill() {
      var b = (D.blocks || [])[0]; if (!b) return;
      var h = b.height, sup = supply(h), sub = subsidy(h), next = (Math.floor(h / 210000) + 1) * 210000, left = next - h, p = px(), fee = (D.fees || {}).fastestFee, a = D.adj || {};
      var avg = a.timeAvg ? a.timeAvg / 60000 : 10, eta = Date.now() + left * avg * 60000;
      var rows = [
        [L('عرضهٔ استخراج‌شده', 'دابینکراوی کانکراو', 'Mined supply'), N(sup) + ' BTC', L('<bdi>' + (sup / 21e6 * 100).toFixed(2) + '%</bdi> از ۲۱ میلیون · تورم سالانه <bdi>' + (sub * 52560 / sup * 100).toFixed(2) + '%</bdi>', '<bdi>' + (sup / 21e6 * 100).toFixed(2) + '%</bdi> لە ٢١ ملیۆن · هەڵاوسانی ساڵانە <bdi>' + (sub * 52560 / sup * 100).toFixed(2) + '%</bdi>', '<bdi>' + (sup / 21e6 * 100).toFixed(2) + '%</bdi> of 21 million · yearly issuance <bdi>' + (sub * 52560 / sup * 100).toFixed(2) + '%</bdi>')],
        [L('آخرین بلاک', 'دوایین بلۆک', 'Latest block'), N(h), L('<bdi data-clock="' + b.timestamp + '">' + clock(b.timestamp) + '</bdi> از ثبت آن' + (b.pool ? ' · استخر <bdi>' + esc(b.pool) + '</bdi>' : ''), '<bdi data-clock="' + b.timestamp + '">' + clock(b.timestamp) + '</bdi> لە تۆمارکردنیەوە' + (b.pool ? ' · <bdi>' + esc(b.pool) + '</bdi>' : ''), '<bdi data-clock="' + b.timestamp + '">' + clock(b.timestamp) + '</bdi> since it was mined' + (b.pool ? ' · <bdi>' + esc(b.pool) + '</bdi>' : ''))],
        [L('کارمزدِ اولویت بالا', 'کرێی پێشینەی بەرز', 'Priority fee'), fee != null ? N(fee) + ' sat/vB' : '—', (fee != null && p ? L('حدود <bdi>' + usd(fee * 140 * p / 1e8) + '</bdi> برای یک انتقال ساده', 'نزیکەی <bdi>' + usd(fee * 140 * p / 1e8) + '</bdi> بۆ گواستنەوەیەکی سادە', 'about <bdi>' + usd(fee * 140 * p / 1e8) + '</bdi> for a simple transfer') : '') + (D.mempool ? L(' · <bdi>' + N(D.mempool.count) + '</bdi> تراکنش در صف', ' · <bdi>' + N(D.mempool.count) + '</bdi> مامەڵە لە ڕیزدا', ' · <bdi>' + N(D.mempool.count) + '</bdi> waiting') : '')],
        [L('توان شبکه', 'توانای تۆڕ', 'Hashrate'), D.hashrate ? N(D.hashrate / 1e18) + ' EH/s' : '—', D.difficulty ? L('سختی <bdi>' + (D.difficulty / 1e12).toFixed(2) + ' T</bdi>', 'سەختی <bdi>' + (D.difficulty / 1e12).toFixed(2) + ' T</bdi>', 'difficulty <bdi>' + (D.difficulty / 1e12).toFixed(2) + ' T</bdi>') : ''],
        [L('هاوینگ بعدی', 'هاڵڤینگی داهاتوو', 'Next halving'), N(left) + L(' بلاک', ' بلۆک', ' blocks'), L('حدود <bdi>' + esc(dateOf(eta)) + '</bdi> · پاداش <bdi>' + sub + ' → ' + sub / 2 + '</bdi>', 'نزیکەی <bdi>' + esc(dateOf(eta)) + '</bdi> · پاداشت <bdi>' + sub + ' → ' + sub / 2 + '</bdi>', 'about <bdi>' + esc(dateOf(eta)) + '</bdi> · reward <bdi>' + sub + ' → ' + sub / 2 + '</bdi>')],
        [L('تنظیم سختی بعدی', 'ڕێکخستنی سەختیی داهاتوو', 'Next difficulty change'), a.difficultyChange != null ? (a.difficultyChange >= 0 ? '+' : '−') + Math.abs(a.difficultyChange).toFixed(2) + '%' : '—', a.remainingBlocks != null ? L('<bdi>' + N(a.remainingBlocks) + '</bdi> بلاک دیگر · میانگین هر بلاک <bdi>' + avg.toFixed(1) + '</bdi> دقیقه', '<bdi>' + N(a.remainingBlocks) + '</bdi> بلۆکی تر · تێکڕای هەر بلۆک <bdi>' + avg.toFixed(1) + '</bdi> خولەک', 'in <bdi>' + N(a.remainingBlocks) + '</bdi> blocks · <bdi>' + avg.toFixed(1) + '</bdi> min a block') : '']
      ];
      rows.forEach(function (r, i) { var c = root.querySelector('.bx-co[data-c="' + i + '"]'); if (!c) return; c.children[0].textContent = r[0]; if (c.children[1].textContent !== r[1]) c.children[1].textContent = r[1]; c.children[2].innerHTML = r[2]; });
    }
    function lines() {
      var svg = $('.bx-ln'); if (!svg || getComputedStyle(svg).display === 'none') { if (svg) svg.innerHTML = ''; return; }
      var H = hud.getBoundingClientRect(), c = core.getBoundingClientRect(), cx = c.left + c.width / 2 - H.left, cy = c.top + c.height / 2 - H.top, r = c.height * .37, h = '';
      [205, 180, 155, -25, 0, 25].forEach(function (deg, i) {
        var el = root.querySelector('.bx-co[data-c="' + i + '"]'), b = el.getBoundingClientRect(), right = i > 2, a = deg * Math.PI / 180;
        var tx = cx + Math.cos(a) * r, ty = cy + Math.sin(a) * r, lb = el.children[0].getBoundingClientRect(), sy = lb.top + lb.height / 2 - H.top;
        var sx = (right ? b.left - 10 : b.right + 10) - H.left, ex = sx + (right ? -1 : 1) * Math.max(18, Math.abs(tx - sx) - Math.abs(ty - sy) - 8);
        h += '<path d="M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + 'H' + ex.toFixed(1) + 'L' + tx.toFixed(1) + ' ' + ty.toFixed(1) + '"/><rect x="' + (tx - 5).toFixed(1) + '" y="' + (ty - 5).toFixed(1) + '" width="10" height="10"/>';
      });
      svg.innerHTML = h;
    }

    /* ---- blocks: the queue on one side of "now", the chain on the other. Every block is a real cube (three faces in
       3D); how full its faces are painted is how full the block was (weight of 4,000,000, or size of 1 MB for old data). */
    var GEN = 1231006505, placed = false, view = null, tip = 0, rq = 0, drag = false, pkNow = '';
    var MARKS = [[0, 'بلاک صفر', 'بلۆکی سفر', 'Genesis'], [170, 'اولین تراکنش', 'یەکەم مامەڵە', 'First transaction'], [57043, 'دو پیتزا', 'دوو پیتزا', 'Two pizzas'], [74638, 'خطای ۱۸۴ میلیاردی', 'هەڵەی ١٨٤ ملیاردی', '184-billion bug'],
      [210000, 'هاوینگ ۱', 'هاڵڤینگی ١', 'Halving 1'], [420000, 'هاوینگ ۲', 'هاڵڤینگی ٢', 'Halving 2'], [630000, 'هاوینگ ۳', 'هاڵڤینگی ٣', 'Halving 3'], [840000, 'هاوینگ ۴', 'هاڵڤینگی ٤', 'Halving 4']];
    function norm(b) { var x = b.extras || {}, fr = x.feeRange || []; return { id: b.id, height: b.height, timestamp: b.timestamp, tx_count: b.tx_count, size: b.size, weight: b.weight, reward: x.reward, totalFees: x.totalFees, medianFee: x.medianFee, feeRange: fr.length ? [fr[0], fr[fr.length - 1]] : null, pool: (x.pool || {}).name }; }
    function nb(m) { var rg = m.feeRange || []; return { nTx: m.nTx, vsize: m.blockVSize != null ? m.blockVSize : m.vsize, size: m.blockSize != null ? m.blockSize : m.size, totalFees: m.totalFees, medianFee: m.medianFee, feeRange: rg.length ? [rg[0], rg[rg.length - 1]] : null }; }
    function sz(n) { return n >= 1e6 ? (n / 1e6).toFixed(2) + ' MB' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' kB' : N(n) + ' B'; }
    function day(ts) { try { return new Date(ts * 1000).toLocaleDateString(lang() === 'en' ? 'en-GB' : lang() === 'ckb' ? 'ckb-IQ' : 'fa-IR-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return new Date(ts * 1000).toISOString().slice(0, 10); } }
    function stamp(ts) { return new Date(ts * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    function shown() { return view ? view.list : (D.blocks || []).slice(0, 8); }
    function faces(inner) { return '<span class="bx-c"><i class="tp"></i><i class="sd"></i><span class="ft">' + inner + '</span></span>'; }
    function face(o, mined) {
      var fr = o.feeRange, bytes = mined ? o.size : o.vsize;
      return '<span class="f">~' + N(o.medianFee, o.medianFee < 10 ? 1 : 0) + ' <small>sat/vB</small></span>' + (fr ? '<span class="r">' + N(fr[0], fr[0] < 10 ? 1 : 0) + ' – ' + N(fr[1]) + '</span>' : '') +
        '<b>' + sz(bytes) + '</b><span class="x">' + N(mined ? o.tx_count : o.nTx) + ' tx</span>';
    }
    function fillOf(o, mined) { return Math.max(0, Math.min(100, mined ? (o.weight ? o.weight / 4e4 : o.size / 1e4) : o.vsize / 1e4)); }
    function qEta(i) { return '<span class="a" dir="auto">' + L('حدود ' + (i + 1) * 10 + ' دقیقهٔ دیگر', 'نزیکەی ' + (i + 1) * 10 + ' خولەکی تر', 'in ~' + (i + 1) * 10 + ' min') + '</span>'; }
    function cube(o, mined, i) {
      var fill = fillOf(o, mined), st = ' style="--fill:' + fill.toFixed(0) + '%"';
      if (!mined) return '<button type="button" class="bx-b q' + (pkNow === 'q:' + i ? ' on' : '') + '" data-q="' + i + '"' + st + ' aria-label="' + (i === 0 ? L('بلاک بعدی', 'بلۆکی داهاتوو', 'Next block') : L('بلاک ' + (i + 1) + ' در صف', 'بلۆکی ' + (i + 1) + ' لە ڕیزدا', 'Block ' + (i + 1) + ' in the queue')) + '">' + faces(face(o, false) + qEta(i)) + '</button>';
      var old = Date.now() / 1000 - o.timestamp > 129600;
      return '<button type="button" class="bx-b' + (sel === o.id ? ' sel' : '') + (o.height === 0 ? ' gen' : '') + (fill < 55 ? ' lo' : '') + '" data-id="' + esc(o.id) + '"' + st + ' aria-label="' + L('بلاک ', 'بلۆکی ', 'Block ') + o.height + '">' +
        faces(face(o, true) + (old ? '<span class="a" dir="auto">' + esc(day(o.timestamp)) + '</span>' : '<span class="a" dir="auto" data-ago="' + o.timestamp + '">' + esc(ago(o.timestamp)) + '</span>')) +
        '<em>' + N(o.height) + '</em>' + (o.pool && o.pool !== 'Unknown' ? '<cite>' + esc(o.pool) + '</cite>' : '') + '</button>';
    }
    function belt() {
      var all = D.blocks || []; if (!all.length) return;
      if (all[0].height > tip) tip = all[0].height;
      var bl = shown(), nx = view ? [] : (D.next || []).slice(0, 3), low = bl[bl.length - 1].height;
      pkNow = paneKey();
      $('.bx-belt').classList.toggle('hist', !!view);
      $('.bx-now span').textContent = L('اکنون', 'ئێستا', 'now');
      $('.bx-q').innerHTML = nx.map(function (o, i) { return cube(o, false, i); }).join('');
      $('.bx-m').innerHTML = bl.map(function (o, i) { return cube(o, true, i); }).join('') +
        (low > 0 ? '<button type="button" class="bx-b more" data-go="older">' + faces('<b>+</b><span class="a">' + L('بلاک‌های قدیمی‌تر', 'بلۆکە کۆنترەکان', 'Older blocks') + '</span>') + '<em>' + N(Math.max(0, low - 15)) + ' … ' + N(low - 1) + '</em></button>' : '');
      if (!view) { if (lastTip && bl[0].height > lastTip && !RM) { var f = $('.bx-m .bx-b'); if (f) f.classList.add('new'); if (coin) coin.pulse(); } lastTip = bl[0].height; }
      detail(); tmFill();
      if (!placed) { placed = true; var bt = $('.bx-belt'); bt.scrollLeft = Math.max(0, $('.bx-now').offsetLeft - bt.clientWidth * .45); }
    }
    function qUpdate() {   /* the waiting cubes change every few seconds: patch them in place so their motion does not restart */
      if (view) return;
      var els = root.querySelectorAll('.bx-q .bx-b'), nx = (D.next || []).slice(0, 3);
      if (els.length !== nx.length) { belt(); return; }
      for (var i = 0; i < nx.length; i++) {
        var el = els[i], h = face(nx[i], false) + qEta(i), ft = el.querySelector('.ft');
        if (ft && el._h !== h) { ft.innerHTML = h; el._h = h; }
        el.style.setProperty('--fill', fillOf(nx[i], false).toFixed(0) + '%');
      }
    }

    /* ---- the live mempool, as on mempool.space: every transaction of a waiting block on a map that moves, the stream
       of new ones, recent fee bumps, and a lookup of any transaction or address. It all travels straight from
       mempool.space to the visitor's browser (a websocket for what moves, the REST API for lookups); this site stores
       none of it. To spare metered connections the socket runs only while this section is on screen, does not start by
       itself under Data Saver, and pauses after six quiet minutes. */
    var WS = 'wss://mempool.space/api/v1/ws', ws = null, wsOk = false, wsTry = 0, wsTimer = 0, wsBytes = 0, wsLast = 0, restAt = 0, restOk = 0,
      qsel = null, look = null, shownKey = '', sentTrack = null, PB = null, pbFix = 0, M = null, SUM = {}, gg = {}, chP = null, chS = null,
      SX = [], SXseen = {}, SXq = [], inView = false, hidT = 0, lastAct = Date.now(), paused = false, autoP = false, uiDirty = false, CC = {};
    var NC = navigator.connection || {}, SAVER = !!(NC.saveData || /2g$/.test(NC.effectiveType || ''));
    function pref(v) { try { if (v === undefined) return localStorage.getItem('ek_mp'); if (v) localStorage.setItem('ek_mp', v); else localStorage.removeItem('ek_mp'); } catch (e) { } return null; }
    paused = SAVER || pref() === 'off';
    if (!paused) qsel = 0;

    /* transaction classes, read from mempool.space's flag bits (frontend/src/app/shared/filters.utils.ts). The flags
       reach past 32 bits, so they are tested with arithmetic, not with & */
    var P2 = []; for (var p2 = 0; p2 < 48; p2++) P2.push(Math.pow(2, p2));
    function has(f, b) { return Math.floor(f / P2[b]) % 2 === 1; }
    var GG = [['rbf', [0], 'RBF', 'RBF', 'RBF'], ['rep', [18], 'جایگزین', 'جێگرەوە', 'Replacement'], ['cpfp', [16, 17], 'CPFP', 'CPFP', 'CPFP'],
      ['tr', [14], 'تپ‌روت', 'تاپڕووت', 'Taproot'], ['sw', [12, 13], 'سگویت', 'سێگویت', 'SegWit'], ['leg', [8, 9, 10], 'قدیمی', 'کۆن', 'Legacy'],
      ['ins', [26], 'اینسکریپشن', 'ئینسکریپشن', 'Inscription'], ['opr', [24], 'OP_RETURN', 'OP_RETURN', 'OP_RETURN'],
      ['cons', [33], 'تجمیع', 'کۆکردنەوە', 'Consolidation'], ['cj', [32], 'کوین‌جوین', 'کۆینجۆین', 'CoinJoin'], ['bat', [34], 'پرداخت گروهی', 'پارەدانی بەکۆمەڵ', 'Batch payout']];
    function ggOn() { return GG.filter(function (g) { return gg[g[0]]; }); }
    function hit(f, on) { for (var i = 0; i < on.length; i++) for (var j = 0; j < on[i][1].length; j++) if (has(f || 0, on[i][1][j])) return true; return false; }
    function tags(f) { return GG.filter(function (g) { return hit(f, [g]); }).map(function (g) { return L(g[2], g[3], g[4]); }); }

    /* one hue, dark to light on the dark page: the brighter the square, the higher its fee rate (log scale, 0.1 → 300+) */
    var RAMP = [[77, 42, 10], [122, 66, 11], [184, 100, 13], [247, 147, 26], [255, 201, 120], [255, 236, 204]];
    function tOf(r) { return r > 0 ? Math.max(0, Math.min(1, Math.log(r / 0.1) / Math.log(3000))) : 0; }
    function col(r) {
      var k = Math.round((r || 0) * 100), c = CC[k]; if (c) return c;
      var t = tOf(r) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i, a = RAMP[i], b = RAMP[i + 1];
      c = 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
      return (CC[k] = c);
    }
    function rt(r) { return r == null || isNaN(r) ? '—' : r < 10 ? r.toFixed(2) : r < 100 ? r.toFixed(1) : N(r); }
    function fb(s) { var v = (s || 0) / 1e8; return v >= 1000 ? N(v) : v >= 10 ? N(v, 2) : v >= 1 ? v.toFixed(3) : v >= 0.01 ? v.toFixed(4) : v >= 0.0001 ? v.toFixed(6) : v.toFixed(8); }
    function fv(v) { return v >= 1000 || v % 1 === 0 ? N(v) : v.toFixed(2); }
    function short(id) { id = String(id || ''); return id.length > 20 ? id.slice(0, 8) + '…' + id.slice(-8) : id; }
    function byRate(a, b) { return b.r - a.r || b.vs - a.vs; }

    /* squares on a grid, side ∝ √vsize, highest fee rate first, each in the first free place (rows, then columns);
       the grid grows if many small transactions would not fit. Returns where each one sits, and who owns each cell. */
    function pack(items, cap) {
      var G = 75, U, i, k, s, need, tries;
      for (k = 0; k < 6; k++) {
        U = cap / (G * G); need = 0;
        for (i = 0; i < items.length; i++) { s = Math.max(1, Math.round(Math.sqrt(items[i].vs / U))); need += s * s; }
        if (need <= G * G * 0.94) break;
        G = Math.min(240, Math.ceil(G * Math.sqrt(need / (G * G * 0.9))));
      }
      for (tries = 0; ; tries++) {   /* if a big square found no room, a slightly finer grid usually fixes it */
        var r = place(items, G, cap / (G * G));
        if (!r.miss || tries >= 3 || G >= 240) return r;
        G = Math.min(240, Math.ceil(G * 1.05));
      }
    }
    function place(items, G, U) {
      var GG2 = G * G, occ = new Uint8Array(GG2), own = new Int32Array(GG2), at = new Int32Array(items.length * 3), first = 0, miss = 0, i, s;
      for (i = 0; i < GG2; i++) own[i] = -1;
      function free(x, y, s) { for (var yy = y; yy < y + s; yy++) for (var xx = x; xx < x + s; xx++) if (occ[yy * G + xx]) return false; return true; }
      for (i = 0; i < items.length; i++) {
        s = Math.min(G, Math.max(1, Math.round(Math.sqrt(items[i].vs / U))));
        var p = first, found = -1, x = 0, y = 0;
        while (p < GG2) {
          if (occ[p]) { p++; continue; }
          x = p % G; y = (p - x) / G;
          if (y + s > G) break;
          if (x + s > G) { p = (y + 1) * G; continue; }
          if (free(x, y, s)) { found = p; break; }
          p++;
        }
        if (found < 0) { at[i * 3] = -1; miss++; continue; }
        for (var yy = y; yy < y + s; yy++) for (var xx = x; xx < x + s; xx++) { occ[yy * G + xx] = 1; own[yy * G + xx] = i; }
        at[i * 3] = x; at[i * 3 + 1] = y; at[i * 3 + 2] = s;
        while (first < GG2 && occ[first]) first++;
      }
      return { G: G, at: at, own: own, miss: miss };
    }
    /* the fee rate at each percent of the block's weight, cheapest first (the coinbase left out) */
    function curve(items) {
      var a = [], tot = 0, i;
      for (i = 0; i < items.length; i++) if (!items[i].cb) { a.push([items[i].r || 0, items[i].vs]); tot += items[i].vs; }
      if (!a.length || !(tot > 0)) return null;
      a.sort(function (x, y) { return x[0] - y[0]; });
      var out = [], acc = 0, j = 0;
      for (var p = 0; p <= 100; p++) { var goal = tot * p / 100; while (j < a.length - 1 && acc + a[j][1] < goal) { acc += a[j][1]; j++; } out.push(a[j][0]); }
      return out;
    }

    /* the map itself: a canvas, redrawn when the block changes; squares glide to their new places, new ones flash */
    var DUR = 650;
    function ease(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 3); }
    function mapKill() { if (M && M.raf) cancelAnimationFrame(M.raf); M = null; }
    function mapNew() {
      var host = $('.mp-cv'); if (!host) return null;
      var cv = host.querySelector('canvas');
      M = { host: host, cv: cv, cx: cv.getContext('2d'), items: [], ix: {}, lay: null, from: null, t0: 0, gone: [], raf: 0, hov: null, pin: null, pt: 'mouse' };
      cv.addEventListener('pointermove', mapMove); cv.addEventListener('pointerleave', mapLeave); cv.addEventListener('pointerdown', mapDown); cv.addEventListener('click', mapClick);
      return M;
    }
    function curPos(now) {
      var it = M.items, lay = M.lay, G = lay.G, at = lay.at, out = new Float32Array(it.length * 3), k = M.from ? Math.min(1, (now - M.t0) / DUR) : 1, e = ease(k), fr = M.from;
      for (var i = 0; i < it.length; i++) {
        var j = i * 3; if (at[j] < 0) { out[j] = -1; continue; }
        var x = at[j] / G, y = at[j + 1] / G, s = at[j + 2] / G;
        if (k < 1 && fr && fr[j] >= 0) { x = fr[j] + (x - fr[j]) * e; y = fr[j + 1] + (y - fr[j + 1]) * e; s = fr[j + 2] + (s - fr[j + 2]) * e; }
        out[j] = x; out[j + 1] = y; out[j + 2] = s;
      }
      return out;
    }
    function mapSet(items, cap) {
      if (!M && !mapNew()) return;
      var now = performance.now(), i, lay = pack(items, cap), anim = !!M.lay && !RM;
      if (anim) {
        var cur = curPos(now), old = M.items, idx = {}, keep = {}, from = new Float32Array(items.length * 3), gone = [];
        for (i = 0; i < old.length; i++) idx[old[i].id] = i;
        for (i = 0; i < items.length; i++) { keep[items[i].id] = 1; var j = idx[items[i].id]; if (j != null && cur[j * 3] >= 0) { from[i * 3] = cur[j * 3]; from[i * 3 + 1] = cur[j * 3 + 1]; from[i * 3 + 2] = cur[j * 3 + 2]; } else from[i * 3] = -1; }
        for (i = 0; i < old.length; i++) if (!keep[old[i].id] && cur[i * 3] >= 0) gone.push({ x: cur[i * 3], y: cur[i * 3 + 1], s: cur[i * 3 + 2], c: old[i].cb ? '#ffd27a' : col(old[i].r) });
        M.from = from; M.gone = gone.length > 4000 ? [] : gone; M.t0 = now;
      } else { M.from = null; M.gone = []; }
      M.items = items; M.lay = lay; M.ix = {};
      for (i = 0; i < items.length; i++) M.ix[items[i].id] = i;
      if (M.pin && M.ix[M.pin] == null) { M.pin = null; tipHide(); }
      mapPaint();
    }
    function mapPaint() { if (M && !M.raf) M.raf = requestAnimationFrame(mapFrame); }
    function mapFrame(now) {
      if (!M) return; M.raf = 0;
      var cv = M.cv, W = cv.clientWidth; if (!W || !M.lay) return;
      var dpr = Math.min(2, w.devicePixelRatio || 1), S = Math.round(W * dpr);
      if (cv.width !== S) { cv.width = S; cv.height = S; }
      var g = M.cx, it = M.items, pos = curPos(now), cell = S / M.lay.G, gap = Math.max(dpr * 0.6, Math.min(dpr * 1.5, cell * 0.16)), on = ggOn(), wall = Date.now(), more = !!(M.from && now - M.t0 < DUR), fadeIn = more ? ease((now - M.t0) / DUR) : 1;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
      for (var i = 0; i < it.length; i++) {
        var j = i * 3, x = pos[j]; if (x < 0) continue;
        var t = it[i], sz2 = Math.max(dpr * 0.7, pos[j + 2] * S - gap), x0 = x * S + gap / 2, y0 = pos[j + 1] * S + gap / 2;
        var a = on.length && !hit(t.f, on) ? 0.12 : 1;
        if (more && M.from[j] < 0) a *= fadeIn;
        g.globalAlpha = a; g.fillStyle = t.cb ? '#ffd27a' : col(t.r); g.fillRect(x0, y0, sz2, sz2);
        if (!RM && t.b && wall - t.b < 1800) { g.globalAlpha = (1 - (wall - t.b) / 1800) * 0.8 * a; g.fillStyle = '#fff'; g.fillRect(x0, y0, sz2, sz2); more = true; }
      }
      if (more && M.gone.length) { var ga = 1 - ease((now - M.t0) / DUR); for (var k = 0; k < M.gone.length; k++) { var o = M.gone[k], s2 = Math.max(dpr * 0.7, o.s * S - gap); g.globalAlpha = ga; g.fillStyle = o.c; g.fillRect(o.x * S + gap / 2, o.y * S + gap / 2, s2, s2); } }
      g.globalAlpha = 1;
      var hv = M.ix[M.pin || M.hov];
      if (hv != null && pos[hv * 3] >= 0) { var hs = Math.max(dpr * 2, pos[hv * 3 + 2] * S - gap); g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.5, dpr * 1.5); g.strokeRect(pos[hv * 3] * S + gap / 2, pos[hv * 3 + 1] * S + gap / 2, hs, hs); }
      if (more && !RM) M.raf = requestAnimationFrame(mapFrame);
    }
    function mapAt(e) {
      if (!M || !M.lay) return -1;
      var r = M.cv.getBoundingClientRect(), G = M.lay.G, cx = Math.floor((e.clientX - r.left) / r.width * G), cy = Math.floor((e.clientY - r.top) / r.height * G);
      return cx < 0 || cy < 0 || cx >= G || cy >= G ? -1 : M.lay.own[cy * G + cx];
    }
    function mapMove(e) {
      if (!M || e.currentTarget !== M.cv || e.pointerType === 'touch') return;
      lastAct = Date.now();
      var i = mapAt(e), id = i >= 0 ? M.items[i].id : null;
      if (id !== M.hov) { M.hov = id; mapPaint(); }
      if (!M.pin) tipShow(i, e, false);
    }
    function mapLeave(e) { if (!M || e.pointerType === 'touch') return; M.hov = null; if (!M.pin) tipHide(); mapPaint(); }
    function mapDown(e) {
      if (!M || e.currentTarget !== M.cv) return;
      M.pt = e.pointerType || 'mouse';
      if (M.pt !== 'mouse') { var i = mapAt(e); M.pin = i >= 0 ? M.items[i].id : null; if (M.pin) tipShow(i, e, true); else tipHide(); mapPaint(); }
    }
    function mapClick(e) {
      if (!M || e.currentTarget !== M.cv || M.pt !== 'mouse') return;
      var i = mapAt(e); if (i >= 0) openTx(M.items[i].id);
    }
    function tipHide() { var tp = M && M.host.querySelector('.mp-tip'); if (tp) tp.hidden = true; }
    function tipShow(i, e, pin) {
      var tp = M && M.host.querySelector('.mp-tip'); if (!tp) return;
      if (i == null || i < 0) { tp.hidden = true; return; }
      var t = M.items[i], p = px(), tg = t.cb ? [] : tags(t.f);
      function r2(lab, val) { return '<div><span>' + lab + '</span><b>' + val + '</b></div>'; }
      tp.innerHTML = (t.cb ? '<strong>' + L('پاداش ماینر (کوین‌بیس)', 'پاداشتی ماینەر (کۆینبەیس)', 'Miner reward (coinbase)') + '</strong>' : '') + '<code>' + esc(short(t.id)) + '</code>' +
        (t.cb ? '' : r2(L('نرخ کارمزد', 'ڕێژەی کرێ', 'Fee rate'), rt(t.r) + ' sat/vB') + r2(L('کارمزد', 'کرێ', 'Fee'), N(t.fee) + ' sat' + (p ? ' · ' + usd(t.fee / 1e8 * p) : ''))) +
        r2(L('حجم مجازی', 'قەبارەی مەجازی', 'Virtual size'), fv(t.vs) + ' vB') +
        r2(L('مجموع خروجی‌ها', 'کۆی دەرچووەکان', 'Total output'), fb(t.val) + ' BTC' + (p ? ' · ' + usd(t.val / 1e8 * p) : '')) +
        (tg.length ? '<p>' + esc(tg.join(' · ')) + '</p>' : '') +
        (pin ? '<button type="button" data-tx="' + esc(t.id) + '">' + L('جزئیات تراکنش', 'وردەکاریی مامەڵە', 'Transaction details') + '</button>' : '<small>' + L('برای جزئیات کلیک کنید', 'بۆ وردەکاری کلیک بکە', 'Click for details') + '</small>');
      tp.hidden = false; tp.classList.toggle('pin', !!pin);
      var r = M.host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, tw = tp.offsetWidth, th = tp.offsetHeight;
      tp.style.left = (x + 14 + tw > r.width ? Math.max(4, x - 14 - tw) : x + 14) + 'px';
      tp.style.top = (y + 14 + th > r.height ? Math.max(4, y - 14 - th) : y + 14) + 'px';
    }

    /* the fee rate across the block's weight: one line, labels at 10 / 50 / 90 / 100 %, a crosshair for the rest */
    var CW = 520, CH = 214, CL = 46, CR = 16, CT = 24, CB = 30;
    function chartSVG(cv) {
      var mx = 0, mn = Infinity, i;
      for (i = 0; i < cv.length; i++) { if (cv[i] > mx) mx = cv[i]; if (cv[i] > 0 && cv[i] < mn) mn = cv[i]; }
      if (!(mx > 0)) { chS = null; return '<p class="mp-no">' + L('کارمزد همهٔ تراکنش‌های این بلاک صفر بود.', 'کرێی هەموو مامەڵەکانی ئەم بلۆکە سفر بوو.', 'Every transaction in this block paid zero fee.') + '</p>'; }
      var lo = Math.pow(10, Math.floor(Math.log(mn) / Math.LN10 + 1e-9)), hi = Math.pow(10, Math.ceil(Math.log(mx) / Math.LN10 - 1e-9)); if (hi <= lo) hi = lo * 10;
      var pw = CW - CL - CR, ph = CH - CT - CB, ll = Math.log(lo), lr = Math.log(hi) - ll;
      chS = { lo: lo, ll: ll, lr: lr, cv: cv };
      function X(p) { return CL + p / 100 * pw; }
      function Y(v) { return CT + ph - (Math.log(Math.max(v, lo)) - ll) / lr * ph; }
      var pts = cv.map(function (v, p) { return X(p).toFixed(1) + ',' + Y(v).toFixed(1); }), s = '';
      for (var v = lo; v <= hi * 1.0001; v *= 10) s += '<line x1="' + CL + '" x2="' + (CW - CR) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="g"/><text x="' + (CL - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" class="ya">' + (v < 1 ? v.toFixed(Math.round(-Math.log(v) / Math.LN10)) : N(v)) + '</text>';
      [0, 20, 40, 60, 80, 100].forEach(function (p) { s += '<text x="' + X(p).toFixed(1) + '" y="' + (CH - 9) + '" class="xa">' + p + '%</text>'; });
      s += '<path d="M' + pts.join(' L') + ' L' + X(100) + ',' + (CT + ph) + ' L' + X(0) + ',' + (CT + ph) + 'Z" class="ar"/><polyline points="' + pts.join(' ') + '" class="ln"/>';
      [10, 50, 90, 100].forEach(function (p) { var x = X(p), y = Y(cv[p]); s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" class="mk"/><text x="' + x.toFixed(1) + '" y="' + (y - 10).toFixed(1) + '" class="lb">' + rt(cv[p]) + '</text>'; });
      s += '<g class="xh" visibility="hidden"><line y1="' + CT + '" y2="' + (CT + ph) + '"/><circle r="5"/><rect rx="7" height="24" y="2"/><text y="18"></text></g><rect class="hit" x="' + CL + '" y="' + CT + '" width="' + pw + '" height="' + ph + '"/>';
      return '<svg viewBox="0 0 ' + CW + ' ' + CH + '" role="img" aria-label="' + L('نرخ کارمزد از ' + rt(cv[0]) + ' تا ' + rt(cv[100]) + ' sat/vB؛ میانه بر اساس وزن ' + rt(cv[50]), 'ڕێژەی کرێ لە ' + rt(cv[0]) + ' تا ' + rt(cv[100]) + ' sat/vB؛ ناوەند بەپێی کێش ' + rt(cv[50]), 'Fee rate from ' + rt(cv[0]) + ' to ' + rt(cv[100]) + ' sat/vB; weight median ' + rt(cv[50])) + '">' +
        '<defs><linearGradient id="mpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f7931a" stop-opacity=".42"/><stop offset="1" stop-color="#f7931a" stop-opacity=".02"/></linearGradient></defs>' + s + '</svg>';
    }
    function chartFill(cv) {
      var host = $('.mp-ch'); if (!host) return;
      if (!cv) { host.innerHTML = ''; return; }
      CW = Math.round(Math.max(300, Math.min(600, host.clientWidth || 520)));
      host.innerHTML = '<h5>' + L('نرخ کارمزد در طول وزن بلاک، از ارزان به گران (sat/vB)', 'ڕێژەی کرێ بە درێژاییی کێشی بلۆک، لە هەرزانەوە بۆ گران (sat/vB)', 'Fee rate across the block’s weight, cheapest first (sat/vB)') + '</h5>' + chartSVG(cv);
      var sv = host.querySelector('svg'); if (!sv) return;
      sv.addEventListener('pointermove', chMove); sv.addEventListener('pointerleave', chLeave);
      if (chP != null) chAt(sv, chP);
    }
    function chAt(sv, p) {
      if (!chS) return;
      var cv = chS.cv, xh = sv.querySelector('.xh'), pw = CW - CL - CR, ph = CH - CT - CB, x = CL + p / 100 * pw, y = CT + ph - (Math.log(Math.max(cv[p], chS.lo)) - chS.ll) / chS.lr * ph;
      var ln = xh.querySelector('line'), c = xh.querySelector('circle'), rc = xh.querySelector('rect'), tx = xh.querySelector('text'), label = p + '% · ' + rt(cv[p]) + ' sat/vB', tw = label.length * 7 + 18, tx0 = Math.max(CL, Math.min(CW - CR - tw, x - tw / 2));
      ln.setAttribute('x1', x); ln.setAttribute('x2', x); c.setAttribute('cx', x); c.setAttribute('cy', y);
      rc.setAttribute('x', tx0); rc.setAttribute('width', tw); tx.setAttribute('x', tx0 + tw / 2); tx.textContent = label;
      xh.setAttribute('visibility', 'visible');
    }
    function chMove(e) {
      var sv = e.currentTarget, r = sv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * CW, p = Math.round((x - CL) / (CW - CL - CR) * 100);
      if (p < 0 || p > 100) return chLeave(e);
      chP = p; chAt(sv, p);
    }
    function chLeave(e) { chP = null; var xh = e.currentTarget.querySelector('.xh'); if (xh) xh.setAttribute('visibility', 'hidden'); }

    /* ---- the panel under the belt: a waiting block, a mined block, a transaction or an address */
    function paneKey() {
      if (look) return (look.t === 'tx' ? 't:' : 'a:') + look.id;
      var b = sel && shown().filter(function (x) { return x.id === sel; })[0];
      if (b) return 'b:' + b.id;
      if (qsel != null && !view && (D.next || [])[qsel]) return 'q:' + qsel;
      return '';
    }
    function closeBtn() { return '<button type="button" class="mp-x" data-x aria-label="' + L('بستن', 'داخستن', 'Close') + '">×</button>'; }
    function pill() { return '<span class="mp-pill" hidden><i></i><span></span></span>'; }
    function mapHost() {
      return '<div class="mp-r"><div class="mp-gg"></div><div class="mp-cv"><canvas role="img"></canvas><div class="mp-tip" hidden></div><div class="mp-ov"></div></div>' +
        '<div class="mp-lg"><span>sat/vB</span><div class="mp-lgb"><i></i>' + [0.1, 1, 10, 100, 300].map(function (v) { return '<span style="left:' + (tOf(v) * 100).toFixed(1) + '%">' + v + (v === 300 ? '+' : '') + '</span>'; }).join('') + '</div></div>' +
        '<p class="mp-cap">' + L('هر مربع یک تراکنش است: اندازه = حجم، رنگ = نرخ کارمزد (روشن‌تر یعنی گران‌تر). روی هر مربع بروید یا بزنید.', 'هەر چوارگۆشەیەک مامەڵەیەکە: قەبارە = قەبارەی مامەڵە، ڕەنگ = ڕێژەی کرێ (ڕوونتر واتە گرانتر). بچۆ سەر هەر چوارگۆشەیەک یان دایبگرە.', 'Each square is a transaction: size = vsize, colour = fee rate (brighter means pricier). Hover or tap one.') + ' <span class="mp-cnt"></span></p></div>';
    }
    function skel(k) {
      var t = k.charAt(0), id = k.slice(2);
      if (t === 'q') {
        var i = +id;
        return '<div class="mp"><div class="mp-hd"><h4>' + (i === 0 ? L('بلاک بعدی', 'بلۆکی داهاتوو', 'Next block') : L('بلاک ' + (i + 1) + ' در صف', 'بلۆکی ' + (i + 1) + ' لە ڕیزدا', 'Block ' + (i + 1) + ' in the queue')) + '</h4>' + pill() + closeBtn() + '</div>' +
          '<div class="mp-cols"><div class="mp-l"><div class="mp-tb"></div><div class="mp-ch"></div></div>' + mapHost() + '</div></div>';
      }
      if (t === 'b') {
        var b = shown().filter(function (o) { return o.id === id; })[0]; if (!b) return '';
        var p = px(), fees = b.totalFees != null ? b.totalFees / 1e8 : null, rw = b.reward != null ? b.reward / 1e8 : null, full = (b.weight ? b.weight / 4e6 : b.size / 1e6) * 100;
        var f = function (lab, val) { return val == null ? '' : '<div><small>' + lab + '</small><b>' + val + '</b></div>'; };
        return '<div class="mp"><div class="mp-hd"><h4>' + L('بلاک ', 'بلۆکی ', 'Block ') + N(b.height) + '</h4><span class="mp-sub">' + L('این بلاک ' + full.toFixed(full < 10 ? 2 : 0) + '٪ پر بود', 'ئەم بلۆکە ' + full.toFixed(full < 10 ? 2 : 0) + '٪ پڕ بوو', 'This block was ' + full.toFixed(full < 10 ? 2 : 0) + '% full') + '</span>' + closeBtn() + '</div>' +
          '<a class="mp-hash" href="https://mempool.space/block/' + esc(b.id) + '" target="_blank" rel="noopener">' + esc(b.id) + '</a>' +
          '<div class="mp-cols"><div class="mp-l"><div class="bx-dl">' +
          f(L('زمان ثبت', 'کاتی تۆمارکردن', 'Mined at'), esc(stamp(b.timestamp))) +
          f(L('تراکنش', 'مامەڵە', 'Transactions'), N(b.tx_count)) + f(L('حجم', 'قەبارە', 'Size'), sz(b.size) + (b.weight ? ' · ' + (b.weight >= 1e4 ? (b.weight / 1e6).toFixed(2) + ' MWU' : N(b.weight) + ' WU') : '')) +
          f(L('پاداش ماینر', 'پاداشتی ماینەر', 'Miner reward'), rw != null ? rw.toFixed(4) + ' BTC' + (p ? ' · ' + usd(rw * p) + L(' به قیمت امروز', ' بە نرخی ئەمڕۆ', ' at today’s price') : '') : null) +
          f(L('مجموع کارمزدها', 'کۆی کرێکان', 'Total fees'), fees != null ? fees.toFixed(4) + ' BTC' + (rw ? ' · ' + (fees / rw * 100).toFixed(1) + '%' : '') : null) +
          f(L('کارمزد میانه', 'کرێی ناوەند', 'Median fee'), b.medianFee != null ? N(b.medianFee, 1) + ' sat/vB' : null) + f(L('بازهٔ کارمزد', 'مەودای کرێ', 'Fee range'), b.feeRange ? N(b.feeRange[0], 1) + ' – ' + N(b.feeRange[1]) + ' sat/vB' : null) +
          f(L('استخر', 'حەوز', 'Pool'), b.pool && b.pool !== 'Unknown' ? esc(b.pool) : null) + '</div><div class="mp-ch"></div></div>' + mapHost() + '</div></div>';
      }
      return '<div class="mp mp-' + (t === 't' ? 'tx' : 'ad') + '"><div class="mp-hd"><h4>' + (t === 't' ? L('تراکنش', 'مامەڵە', 'Transaction') : L('آدرس', 'ناونیشان', 'Address')) + '</h4><span class="mp-st" hidden></span>' + closeBtn() + '</div>' +
        '<div class="mp-body"><p class="mp-ld">' + L('در حال خواندن…', 'دەخوێنرێتەوە…', 'Reading…') + '</p></div></div>';
    }
    function detail() {
      var box = $('.bx-det'), k = paneKey();
      if (k !== shownKey) {
        mapKill(); shownKey = k; chP = null;
        if (!k) { box.hidden = true; box.innerHTML = ''; }
        else {
          box.hidden = false; box.innerHTML = skel(k);
          var t = k.charAt(0), id = k.slice(2);
          if (t === 'q') { ggFill(); if (PB && PB.i === +id) pbDraw(); }
          else if (t === 'b') { ggFill(); var b = shown().filter(function (o) { return o.id === id; })[0]; if (b) sumLoad(b, b.tx_count <= 400); }
          else if (t === 't') txLoad(id);
          else adLoad(id);
        }
      }
      if (k.charAt(0) === 'q') qRows();
      wsSync(); pills();
    }
    function bodyMsg(t) { var b = $('.mp-body'); if (b) b.innerHTML = '<p class="mp-ld">' + esc(t) + '</p>'; }
    function scrollDet() {
      var b = $('.bx-det'); if (!b || b.hidden) return;
      var r = b.getBoundingClientRect(), vh = w.innerHeight || 800;
      if (r.top < 70 || r.top > vh * 0.55) b.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' });
    }
    function repaint() { if ((D.blocks || []).length) belt(); else detail(); }
    function openTx(id, data) { look = { t: 'tx', id: String(id), data: data || null }; lastAct = Date.now(); repaint(); scrollDet(); }
    function openAddr(a, data) { look = { t: 'ad', id: String(a), data: data || null }; lastAct = Date.now(); repaint(); scrollDet(); }

    /* a waiting block: its numbers from mempool.space's own projection, its transactions from the socket */
    function qRows() {
      var tb = $('.mp-tb'); if (!tb || qsel == null) return;
      var o = (D.next || [])[qsel], p = px(); if (!o) return;
      var fill = Math.min(100, (o.vsize || 0) / 1e4);
      function tr(lab, val) { return '<div class="mp-tr"><span>' + lab + '</span><b>' + val + '</b></div>'; }
      var h = tr(L('کارمزد میانه', 'کرێی ناوەند', 'Median fee'), '~' + rt(o.medianFee) + ' sat/vB' + (p && o.medianFee != null ? '<small>' + usd(o.medianFee * 140 * p / 1e8) + '</small>' : '')) +
        tr(L('بازهٔ کارمزد', 'مەودای کرێ', 'Fee span'), o.feeRange ? rt(o.feeRange[0]) + ' – ' + rt(o.feeRange[1]) + ' sat/vB' : '—') +
        tr(L('مجموع کارمزدها', 'کۆی کرێکان', 'Total fees'), o.totalFees != null ? (o.totalFees / 1e8).toFixed(3) + ' BTC' + (p ? '<small>' + usd(o.totalFees / 1e8 * p) + '</small>' : '') : '—') +
        tr(L('تراکنش‌ها', 'مامەڵەکان', 'Transactions'), N(o.nTx)) +
        tr(L('حجم', 'قەبارە', 'Size'), '<span class="mp-bar"><i style="width:' + fill.toFixed(1) + '%"></i><em>' + (o.size ? (o.size / 1e6).toFixed(2) + ' MB' : ((o.vsize || 0) / 1e6).toFixed(2) + ' MvB') + '</em></span>') +
        tr(L('زمان تقریبی', 'کاتی نزیکەیی', 'Expected in'), L('حدود ' + (qsel + 1) * 10 + ' دقیقه', 'نزیکەی ' + (qsel + 1) * 10 + ' خولەک', 'about ' + (qsel + 1) * 10 + ' min'));
      if (tb._h !== h) { tb.innerHTML = h; tb._h = h; }
    }
    function pbDraw() {
      if (!PB || shownKey !== 'q:' + PB.i) return;
      var items = [], tot = 0;
      for (var id in PB.map) { var t = PB.map[id]; items.push(t); tot += t.vs; }
      items.sort(byRate);
      mapSet(items, Math.max(1e6, tot)); chartFill(curve(items)); ggStat(); ovFill();
      if (M) M.cv.setAttribute('aria-label', L('نقشهٔ ' + N(items.length) + ' تراکنش', 'نەخشەی ' + N(items.length) + ' مامەڵە', 'Map of ' + N(items.length) + ' transactions'));
    }
    /* a mined block: its transactions from /v1/block/<hash>/summary (asked only when wanted: a full block is ~600 kB) */
    function sumLoad(b, go) {
      var k = 'b:' + b.id, ov = $('.mp-ov');
      if (SUM[b.id]) return sumShow(b, SUM[b.id]);
      if (!ov) return;
      if (!go) {
        ov.innerHTML = '<p>' + L('نقشهٔ ' + N(b.tx_count) + ' تراکنش این بلاک', 'نەخشەی ' + N(b.tx_count) + ' مامەڵەی ئەم بلۆکە', 'A map of this block’s ' + N(b.tx_count) + ' transactions') + '</p><button type="button" data-mp="map">' + L('نمایش نقشه', 'نیشاندانی نەخشە', 'Show the map') + '</button><small>' + L('برای یک بلاک پر چند صد کیلوبایت داده می‌گیرد.', 'بۆ بلۆکێکی پڕ چەند سەد کیلۆبایت داتا وەردەگرێت.', 'A full block takes a few hundred kB of data.') + '</small>';
        return;
      }
      ov.innerHTML = '<p class="mp-ld">' + L('در حال دریافت نقشهٔ تراکنش‌ها…', 'نەخشەی مامەڵەکان وەردەگیرێت…', 'Loading the transaction map…') + '</p>';
      getJSON(MP + '/v1/block/' + b.id + '/summary', 25000).then(function (a) {
        if (!alive || !Array.isArray(a)) throw 0;
        var ks = Object.keys(SUM); if (ks.length >= 3) delete SUM[ks[0]];
        SUM[b.id] = a; if (shownKey === k) sumShow(b, a);
      }).catch(function () {
        var o2 = shownKey === k && $('.mp-ov');
        if (o2) o2.innerHTML = '<p>' + L('نقشهٔ این بلاک دریافت نشد.', 'نەخشەی ئەم بلۆکە وەرنەگیرا.', 'The map of this block could not be loaded.') + '</p><button type="button" data-mp="map">' + L('تلاش دوباره', 'دووبارە هەوڵ بدەرەوە', 'Try again') + '</button>';
      });
    }
    function sumShow(b, a) {
      var ov = $('.mp-ov'); if (ov) ov.innerHTML = '';
      var items = a.map(function (t, i) { var f = t.fee || 0; return { id: t.txid, fee: f, vs: t.vsize, val: t.value, r: t.rate != null ? t.rate : t.vsize ? f / t.vsize : 0, f: t.flags || 0, cb: i === 0, b: 0 }; });
      var cb = items.shift(); items.sort(byRate); if (cb) items.unshift(cb);
      var tot = 0; items.forEach(function (t) { tot += t.vs; });
      mapSet(items, Math.max(1e6, tot)); chartFill(curve(items)); ggStat();
      if (M) M.cv.setAttribute('aria-label', L('نقشهٔ ' + N(items.length) + ' تراکنش', 'نەخشەی ' + N(items.length) + ' مامەڵە', 'Map of ' + N(items.length) + ' transactions'));
    }
    /* filters ("goggles"): light up one class of transaction and say how much of the block it is */
    function ggFill() {
      var box = $('.mp-gg'); if (!box) return;
      box.innerHTML = '<div class="mp-ggb">' + GG.map(function (g) { return '<button type="button" data-gg="' + g[0] + '" aria-pressed="' + !!gg[g[0]] + '"' + (gg[g[0]] ? ' class="on"' : '') + '>' + esc(L(g[2], g[3], g[4])) + '</button>'; }).join('') + '</div><span class="mp-ggr" role="status"></span>';
      ggStat();
    }
    function ggStat() {
      var r = $('.mp-ggr'), c = $('.mp-cnt'), on = ggOn(); if (!M || !M.items.length) return;
      var n = 0, v = 0, tv = 0;
      M.items.forEach(function (t) { tv += t.vs; if (on.length && !t.cb && hit(t.f, on)) { n++; v += t.vs; } });
      if (r) r.textContent = on.length ? L(N(n) + ' تراکنش · ' + (tv ? (v / tv * 100).toFixed(1) : '0') + '٪ از وزن این بلاک', N(n) + ' مامەڵە · ' + (tv ? (v / tv * 100).toFixed(1) : '0') + '٪ی کێشی ئەم بلۆکە', N(n) + ' transactions · ' + (tv ? (v / tv * 100).toFixed(1) : '0') + '% of this block’s weight') : '';
      if (c) c.textContent = L(N(M.items.length) + ' تراکنش روی نقشه', N(M.items.length) + ' مامەڵە لەسەر نەخشە', N(M.items.length) + ' transactions on the map') + (M.lay && M.lay.miss ? ' · ' + L(N(M.lay.miss) + ' تا جا نشد', N(M.lay.miss) + 'ی جێ نەبووەوە', N(M.lay.miss) + ' did not fit') : '') + '.';
    }

    /* the socket: open while it is wanted, closed when it is not */
    function wsWanted() { return alive && !paused && inView && !d.hidden; }
    function wsMode() { if (paused) return 'pause'; if (ws && wsOk) return 'live'; if (wsTry >= 3) return restOk && Date.now() - restOk < 30000 ? 'rest' : 'fail'; if (ws || wsTimer || (inView && !d.hidden)) return 'wait'; return 'idle'; }
    function wsCheck() { if (wsWanted()) { if (!ws && !wsTimer) wsOpen(); } else if (ws) wsClose(); pills(); }
    function wsOpen() {
      if (!('WebSocket' in w)) { wsTry = 3; pills(); return; }
      try { ws = new WebSocket(WS); } catch (e) { ws = null; wsFail(); return; }
      wsOk = false; sentTrack = null;
      var me = ws;
      ws.onopen = function () { if (ws !== me) return; wsOk = true; wsTry = 0; wsSync(true); pills(); };
      ws.onmessage = function (e) { if (ws !== me) return; wsBytes += (e.data && e.data.length) || 0; wsLast = Date.now(); onMsg(e.data); };
      ws.onclose = function () { if (ws !== me) return; ws = null; wsOk = false; sentTrack = null; if (wsWanted()) wsFail(); pills(); };
      ws.onerror = function () { };
    }
    function wsClose() { var s = ws; ws = null; wsOk = false; sentTrack = null; if (s) { try { s.close(); } catch (e) { } } }
    function wsFail() { wsTry++; clearTimeout(wsTimer); wsTimer = setTimeout(function () { wsTimer = 0; wsCheck(); }, Math.min(60000, 4000 * Math.pow(2, Math.min(4, wsTry - 1)))); if (wsTry >= 3) restRecent(); }
    function send(o) { try { if (ws && wsOk && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) { } }
    function trackWant() { return shownKey.charAt(0) === 'q' ? +shownKey.slice(2) : -1; }
    function wsSync(all) {
      if (!ws || !wsOk) return;
      if (all) { send({ action: 'want', data: ['blocks', 'stats', 'mempool-blocks'] }); send({ 'track-rbf-summary': true }); }
      var t = trackWant();
      if (t !== sentTrack) { sentTrack = t; send({ 'track-mempool-block': t }); if (t < 0 || (PB && PB.i !== t)) PB = null; }
    }
    function onMsg(txt) {
      var m; try { m = JSON.parse(txt); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      if (Array.isArray(m.blocks) && m.blocks.length && m.blocks[0].height != null && (!D.blocks || !D.blocks.length || m.blocks[0].height > D.blocks[0].height)) { D.blocks = m.blocks.slice(0, 15).map(norm); if (!view) belt(); else tmFill(); }
      if (m.block && m.block.height != null) newBlock(m.block);
      if (Array.isArray(m['mempool-blocks'])) { D.next = m['mempool-blocks'].map(nb); qUpdate(); if (shownKey.charAt(0) === 'q') { if (!D.next[qsel]) belt(); else qRows(); } }
      if (m.mempoolInfo) { var mi = m.mempoolInfo; D.mempool = { count: mi.size, vsize: mi.bytes, total_fee: Math.round((mi.total_fee || 0) * 1e8) }; uiDirty = true; }
      if (m.vBytesPerSecond != null) D.vbps = m.vBytesPerSecond;
      if (m.fees && m.fees.fastestFee != null) { D.fees = m.fees; uiDirty = true; }
      if (Array.isArray(m.transactions)) sxAdd(m.transactions);
      if (Array.isArray(m.rbfLatestSummary)) { D.rbf = m.rbfLatestSummary; rbfFill(); }
      if (m['projected-block-transactions']) pbMsg(m['projected-block-transactions']);
      sxKpi(); sxNote();
      if (state !== 'live' && D.blocks) setState('live');
    }
    function newBlock(b) {
      var x = norm(b), bl = D.blocks || [];
      if (bl.length && x.height <= bl[0].height) return;
      D.blocks = [x].concat(bl).slice(0, 15); uiDirty = true;
      if (x.height > tip) tip = x.height;
      if (!view) belt(); else tmFill();
    }
    function mk(a) { return { id: a[0], fee: a[1], vs: a[2], val: a[3], r: a[4], f: a[5], t: a[6], acc: a[7] === 1, b: 0 }; }
    function pbMsg(o) {
      if (!o || o.index !== sentTrack) return;
      var now = Date.now();
      if (Array.isArray(o.blockTransactions)) {
        var old = PB && PB.i === o.index ? PB.map : null, map = {};
        o.blockTransactions.forEach(function (a) { var t = mk(a); t.b = old && !old[t.id] ? now : 0; map[t.id] = t; });
        PB = { i: o.index, seq: o.sequence, map: map };
      } else if (o.delta && PB && PB.i === o.index) {
        if (o.sequence != null && PB.seq != null && o.sequence !== PB.seq + 1 && now - pbFix > 15000) { pbFix = now; sentTrack = null; wsSync(); return; }   // missed an update: ask for the whole block again
        var dl = o.delta;
        (dl.removed || []).forEach(function (id) { delete PB.map[id]; });
        (dl.added || []).forEach(function (a) { var t = mk(a); t.b = now; PB.map[t.id] = t; });
        (dl.changed || []).forEach(function (c) { var t = PB.map[c[0]]; if (t) { t.r = c[1]; t.f = c[2]; t.acc = c[3] === 1; } });
        PB.seq = o.sequence;
      } else return;
      pbDraw();
    }
    function restRecent() {   /* no socket: the newest transactions every ten seconds instead */
      if (!wsWanted() || wsOk) return;
      getJSON(MP + '/mempool/recent', 8000).then(function (a) { if (!Array.isArray(a) || wsOk) return; restOk = Date.now(); sxAdd(a.map(function (t) { return { txid: t.txid, fee: t.fee, vsize: t.vsize, value: t.value }; })); pills(); }).catch(function () { });
    }

    /* the stream */
    function sxAdd(list) {
      var now = Date.now(), n = 0;
      for (var i = list.length - 1; i >= 0; i--) {
        var t = list[i]; if (!t || !t.txid || SXseen[t.txid]) continue;
        SXseen[t.txid] = 1; SXq.push(t.txid); if (SXq.length > 400) delete SXseen[SXq.shift()];
        SX.unshift({ id: t.txid, fee: t.fee || 0, vs: t.vsize, val: t.value || 0, r: t.rate != null ? t.rate : t.vsize ? (t.fee || 0) / t.vsize : 0, t: t.time || Math.floor(now / 1000) }); n++;
      }
      if (!n) return;
      SX = SX.slice(0, 10); sxFill(Math.min(n, 10));
    }
    function sxSkel() {
      var c = $('.mp-sx'); if (!c || c._b) return; c._b = 1; c.hidden = false;
      c.innerHTML = '<div class="mp-sh"><h4>' + L('تراکنش‌های لحظه‌ای', 'مامەڵە ڕاستەوخۆکان', 'Live transactions') + '</h4>' + pill() + '<button type="button" class="mp-pz" data-mp="pz"></button></div>' +
        '<div class="mp-kpi"></div><div class="mp-c2"><div class="mp-fd"><div class="mp-fh"><span>' + L('مبلغ', 'بڕ', 'Amount') + '</span><span>' + L('نرخ کارمزد', 'ڕێژەی کرێ', 'Fee rate') + '</span><span>' + L('حجم', 'قەبارە', 'Size') + '</span><span>' + L('زمان', 'کات', 'Time') + '</span></div><ol class="mp-feed" aria-live="off"></ol></div>' +
        '<div class="mp-rb"><h5>' + L('جایگزینی‌های اخیر با کارمزد بالاتر (RBF)', 'دوایین جێگرتنەوەکان بە کرێی زیاتر (RBF)', 'Recent fee bumps (RBF replacements)') + '</h5><ol></ol></div></div><p class="mp-note"></p>';
      sxKpi(); sxFill(0); rbfFill(); sxNote(); pills();
    }
    function sxFill(nNew) {
      var ol = $('.mp-feed'); if (!ol) return; var p = px();
      if (!SX.length) { ol.innerHTML = '<li class="mp-emp">' + (paused ? L('پخش زنده متوقف است.', 'پەخشی زیندوو ڕاگیراوە.', 'The live view is paused.') : L('منتظر تراکنش‌های تازه…', 'چاوەڕێی مامەڵەی نوێ…', 'Waiting for new transactions…')) + '</li>'; return; }
      ol.innerHTML = SX.map(function (t, i) {
        var big = t.val >= 1e9, cl = (i < nNew && !RM ? 'n' : '') + (big ? ' big' : '');
        return '<li' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + '><button type="button" data-tx="' + esc(t.id) + '"><span class="v"><b>' + fb(t.val) + ' BTC</b>' + (p ? '<small>' + usd(t.val / 1e8 * p) + '</small>' : '') + (big ? '<em>' + L('بزرگ', 'گەورە', 'Large') + '</em>' : '') + '</span>' +
          '<span class="r">' + rt(t.r) + ' <small>sat/vB</small></span><span class="z">' + fv(t.vs) + ' <small>vB</small></span><time data-sago="' + t.t + '">' + esc(ago(t.t)) + '</time></button></li>';
      }).join('');
    }
    function rbfFill() {
      var ol = root.querySelector('.mp-rb ol'); if (!ol) return; var rb = D.rbf || [];
      if (!rb.length) { ol.innerHTML = '<li class="mp-emp">' + (paused ? '—' : L('منتظر داده…', 'چاوەڕێی داتا…', 'Waiting for data…')) + '</li>'; return; }
      ol.innerHTML = rb.slice(0, 6).map(function (x) {
        var a = x.oldVsize ? x.oldFee / x.oldVsize : 0, b = x.newVsize ? x.newFee / x.newVsize : 0;
        return '<li><button type="button" data-tx="' + esc(x.txid) + '"><span>' + rt(a) + ' → <b>' + rt(b) + '</b> <small>sat/vB</small></span>' + (a > 0 && b >= a ? '<small>+' + ((b / a - 1) * 100).toFixed(0) + '%</small>' : '') +
          (x.fullRbf ? '<em>Full RBF</em>' : '') + (x.mined ? '<em class="ok">' + L('تأیید شد', 'پشتڕاستکرایەوە', 'mined') + '</em>' : '') + '</button></li>';
      }).join('');
    }
    function sxKpi() {
      var k = $('.mp-kpi'); if (!k) return; var mp = D.mempool || {}, p = px();
      function c(lab, v, sub) { return '<div><small>' + lab + '</small><b>' + v + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>'; }
      var h = c(L('ورود به صف', 'هاتنە ناو ڕیز', 'Inflow'), D.vbps != null ? N(D.vbps) + ' vB/s' : '—') + c(L('تراکنش در صف', 'مامەڵە لە ڕیزدا', 'Waiting'), mp.count != null ? N(mp.count) : '—') +
        c(L('حجم صف', 'قەبارەی ڕیز', 'Queue size'), mp.vsize != null ? (mp.vsize / 1e6).toFixed(1) + ' MvB' : '—', mp.vsize != null ? L('حدود ' + Math.max(1, Math.ceil(mp.vsize / 1e6)) + ' بلاک', 'نزیکەی ' + Math.max(1, Math.ceil(mp.vsize / 1e6)) + ' بلۆک', 'about ' + Math.max(1, Math.ceil(mp.vsize / 1e6)) + ' blocks') : '') +
        c(L('کارمزد کل صف', 'کۆی کرێی ڕیز', 'Fees waiting'), mp.total_fee != null ? (mp.total_fee / 1e8).toFixed(3) + ' BTC' : '—', mp.total_fee != null && p ? usd(mp.total_fee / 1e8 * p) : '');
      if (k._h !== h) { k.innerHTML = h; k._h = h; }
    }
    function sxNote() {
      var n = $('.mp-note'); if (!n) return; var kb = Math.round(wsBytes / 1024);
      n.textContent = L('مبلغ = مجموع خروجی‌های تراکنش، از جمله باقی‌مانده‌ای که به خود فرستنده برمی‌گردد. هر به‌روزرسانی چند تراکنشِ تازه‌رسیده را نشان می‌دهد، نه همه را. ارزش دلاری به قیمت امروز است. داده‌ی پخش زنده تا این لحظه: حدود ' + N(kb) + ' کیلوبایت؛ پخش پس از ۶ دقیقه بی‌حرکتی خودش متوقف می‌شود.',
        'بڕ = کۆی دەرچووەکانی مامەڵە، بە پاشماوەی گەڕاوە بۆ نێرەریشەوە. هەر نوێکردنەوەیەک چەند مامەڵەیەکی تازەگەیشتوو نیشان دەدات، نەک هەموویان. بەهای دۆلاری بە نرخی ئەمڕۆیە. داتای پەخشی زیندوو تا ئێستا: نزیکەی ' + N(kb) + ' کیلۆبایت؛ پەخشەکە دوای ٦ خولەک بێجووڵەیی خۆی ڕادەگرێت.',
        'Amount = the transaction’s total output, including change returned to the sender. Each update shows a few newly arrived transactions, not all of them. Dollar values use today’s price. Live data so far: about ' + N(kb) + ' kB; the live view pauses itself after 6 quiet minutes.');
    }
    function ovFill() {   /* what the map says when it has nothing to show */
      if (shownKey.charAt(0) !== 'q') return; var ov = $('.mp-ov'); if (!ov) return;
      var m = wsMode(), have = !!(PB && PB.i === qsel && M && M.items.length), h = '';
      if (m === 'pause') h = '<p>' + (autoP ? L('برای صرفه‌جویی در اینترنت شما، پخش زنده پس از ۶ دقیقه بی‌حرکتی متوقف شد.', 'بۆ پاراستنی ئینتەرنێتەکەت، پەخشی زیندوو دوای ٦ خولەک بێجووڵەیی ڕاگیرا.', 'Paused after 6 quiet minutes to save your data.') : L('پخش زنده متوقف است.', 'پەخشی زیندوو ڕاگیراوە.', 'The live view is paused.')) + '</p><button type="button" data-mp="go">▶ ' + L('پخش زنده', 'پەخشی زیندوو', 'Go live') + '</button>';
      else if (!have) h = m === 'fail' || m === 'rest' ? '<p>' + L('اتصال زنده به mempool.space برقرار نشد؛ نقشهٔ تراکنش‌ها به آن نیاز دارد.', 'پەیوەندیی زیندوو بە mempool.space نەکرا؛ نەخشەی مامەڵەکان پێویستی پێیەتی.', 'No live connection to mempool.space; the transaction map needs one.') + '</p><button type="button" data-mp="retry">' + L('تلاش دوباره', 'دووبارە هەوڵ بدەرەوە', 'Try again') + '</button>' :
        '<p class="mp-ld">' + L('در حال دریافت نقشهٔ تراکنش‌ها…', 'نەخشەی مامەڵەکان وەردەگیرێت…', 'Loading the transaction map…') + '</p>';
      if (ov._h !== h) { ov.innerHTML = h; ov._h = h; }
      ov.classList.toggle('dim', have);
    }
    function pills() {
      var m = wsMode(), txt = m === 'live' ? L('زنده', 'زیندوو', 'Live') : m === 'pause' ? L('متوقف', 'ڕاگیراو', 'Paused') : m === 'fail' ? L('بدون اتصال زنده', 'بێ پەیوەندیی زیندوو', 'No live connection') : m === 'rest' ? L('هر ۱۰ ثانیه', 'هەر ١٠ چرکە جارێک', 'Every 10 s') : m === 'wait' ? L('در حال اتصال…', 'پەیوەندی دەکرێت…', 'Connecting…') : '';
      [].forEach.call(root.querySelectorAll('.mp-pill'), function (e) { e.className = 'mp-pill ' + m; e.lastChild.textContent = txt; e.hidden = !txt; });
      var pz = $('.mp-pz'); if (pz) pz.textContent = paused ? '▶ ' + L('پخش زنده', 'پەخشی زیندوو', 'Go live') : '⏸ ' + L('توقف', 'ڕاگرتن', 'Pause');
      ovFill(); if (!SX.length) sxFill(0);
    }
    function mpAct(a, el) {
      lastAct = Date.now();
      if (a === 'go' || (a === 'pz' && paused)) { paused = false; autoP = false; pref(null); if (qsel == null && !sel && !look && !view) qsel = 0; wsTry = 0; belt(); wsCheck(); return; }
      if (a === 'pz') { paused = true; autoP = false; pref('off'); wsClose(); pills(); sxFill(0); return; }
      if (a === 'retry') { wsTry = 0; restOk = 0; clearTimeout(wsTimer); wsTimer = 0; wsClose(); wsCheck(); return; }
      if (a === 'map') { var b = shown().filter(function (x) { return 'b:' + x.id === shownKey; })[0]; if (b) sumLoad(b, true); return; }
      if (a === 'copy' && look) {
        var done = function () { el.textContent = L('کپی شد', 'کۆپی کرا', 'Copied'); };
        try { navigator.clipboard.writeText(look.id).then(done, function () { }); } catch (e) { }
      }
    }

    /* a transaction: /api/tx/<id>, and while it waits, /api/v1/cpfp/<id> for its effective rate */
    function eta(r) {
      var nx = D.next || []; if (r == null || !nx.length) return null;
      for (var i = 0; i < nx.length; i++) {
        var lo = nx[i].feeRange ? nx[i].feeRange[0] : 0;
        if (r >= lo) return i === nx.length - 1 && nx.length >= 8 ? L('بیش از ' + i * 10 + ' دقیقه — تقریبی', 'زیاتر لە ' + i * 10 + ' خولەک — نزیکەیی', 'more than ' + i * 10 + ' min — rough') :
          L('حدود ' + (i + 1) * 10 + ' دقیقه (بلاک ' + (i + 1) + ' در صف) — تقریبی', 'نزیکەی ' + (i + 1) * 10 + ' خولەک (بلۆکی ' + (i + 1) + ' لە ڕیزدا) — نزیکەیی', 'about ' + (i + 1) * 10 + ' min (block ' + (i + 1) + ' in the queue) — rough');
      }
      return L('دیرتر از ' + nx.length * 10 + ' دقیقه — تقریبی', 'دواتر لە ' + nx.length * 10 + ' خولەک — نزیکەیی', 'later than ' + nx.length * 10 + ' min — rough');
    }
    function txLoad(id) {
      var k = 't:' + id;
      var go = function (t) {
        if (!alive || shownKey !== k) return;
        if (!t || !t.txid) return bodyMsg(L('تراکنشی با این شناسه پیدا نشد.', 'هیچ مامەڵەیەک بەم ناسنامەیە نەدۆزرایەوە.', 'No transaction with this id.'));
        if (t.status && t.status.confirmed) return txShow(t, null);
        txShow(t, null);
        getJSON(MP + '/v1/cpfp/' + t.txid, 8000).then(function (c) { if (shownKey === k) txShow(t, c); }, function () { });
      };
      if (look && look.data) return go(look.data);
      getJSON(MP + '/tx/' + id, 12000).then(go, function (e) { if (shownKey === k) bodyMsg(e && /^4\d\d$/.test(e.message) ? L('تراکنشی با این شناسه پیدا نشد.', 'هیچ مامەڵەیەک بەم ناسنامەیە نەدۆزرایەوە.', 'No transaction with this id.') : L('اتصال به شبکه برقرار نشد؛ کمی بعد دوباره امتحان کنید.', 'پەیوەندی بە تۆڕەکەوە نەکرا؛ دواتر هەوڵ بدەرەوە.', 'Could not reach the network; try again in a moment.')); });
    }
    function ioList(list, isIn) {
      var max = 12, h = list.slice(0, max).map(function (x) {
        var o = isIn ? x.prevout : x, a = o && o.scriptpubkey_address, v = o ? o.value : null, ty = o && o.scriptpubkey_type;
        var who = isIn && x.is_coinbase ? '<span class="cb">' + L('کوین‌بیس (سکهٔ تازه)', 'کۆینبەیس (دراوی نوێ)', 'Coinbase (new coins)') + '</span>' :
          a ? '<button type="button" class="ad" data-ad="' + esc(a) + '" title="' + esc(a) + '">' + esc(a) + '</button>' :
          '<span class="ty">' + esc(ty === 'op_return' ? L('داده (OP_RETURN)', 'داتا (OP_RETURN)', 'Data (OP_RETURN)') : ty || '—') + '</span>';
        return '<li>' + who + (v != null ? '<b>' + fb(v) + ' BTC</b>' : '') + '</li>';
      }).join('');
      if (list.length > max) h += '<li class="more">' + L('و ' + N(list.length - max) + ' مورد دیگر', 'و ' + N(list.length - max) + ' دانەی تر', 'and ' + N(list.length - max) + ' more') + '</li>';
      return h;
    }
    function txShow(t, c) {
      var body = $('.mp-body'), st = $('.mp-st'), p = px(); if (!body) return;
      var vs = t.weight / 4, rate = t.fee != null && vs ? t.fee / vs : null, conf = !!(t.status && t.status.confirmed), h = conf ? t.status.block_height : null;
      var vin = t.vin || [], vout = t.vout || [], cb = !!(vin[0] && vin[0].is_coinbase), rbf = !cb && vin.some(function (x) { return x.sequence < 0xfffffffe; }), tin = 0, tout = 0;
      vin.forEach(function (x) { if (x.prevout) tin += x.prevout.value; }); vout.forEach(function (x) { tout += x.value || 0; });
      st.hidden = false; st.className = 'mp-st ' + (conf ? 'ok' : 'wait'); st.textContent = conf ? L('تأییدشده', 'پشتڕاستکراوە', 'Confirmed') : L('در صف', 'لە ڕیزدا', 'Unconfirmed');
      var eff = c && c.effectiveFeePerVsize;
      function f(lab, val) { return val == null ? '' : '<div><small>' + lab + '</small><b>' + val + '</b></div>'; }
      var rows = conf ? f(L('در بلاک', 'لە بلۆکی', 'In block'), '<button type="button" class="mp-lk" data-hgt="' + h + '">' + N(h) + '</button>') + f(L('تأیید', 'پشتڕاستکردنەوە', 'Confirmations'), tip && h != null ? N(Math.max(1, tip - h + 1)) : null) + f(L('زمان ثبت', 'کاتی تۆمارکردن', 'Mined at'), t.status.block_time ? esc(stamp(t.status.block_time)) : null) :
        f(L('تخمین تأیید', 'پشتڕاستکردنەوەی چاوەڕوانکراو', 'Expected confirmation'), esc(eta(eff || rate) || '—'));
      rows += cb ? f(L('پاداش بلاک (سکهٔ تازه + کارمزدها)', 'پاداشتی بلۆک (دراوی نوێ + کرێکان)', 'Block reward (new coins + fees)'), fb(tout) + ' BTC' + (p ? ' · ' + usd(tout / 1e8 * p) : '')) :
        f(L('کارمزد', 'کرێ', 'Fee'), N(t.fee) + ' sat' + (p ? ' · ' + usd(t.fee / 1e8 * p) : '')) + f(L('نرخ کارمزد', 'ڕێژەی کرێ', 'Fee rate'), rate != null ? rt(rate) + ' sat/vB' : null) +
        (eff && rate && Math.abs(eff - rate) / rate > 0.01 ? f(L('نرخ مؤثر (با CPFP)', 'ڕێژەی کاریگەر (بە CPFP)', 'Effective rate (CPFP)'), rt(eff) + ' sat/vB') : '');
      rows += f(L('اندازه', 'قەبارە', 'Size'), N(t.size) + ' B · ' + fv(vs) + ' vB · ' + N(t.weight) + ' WU') +
        (cb ? '' : f(L('اعلام RBF', 'ڕاگەیاندنی RBF', 'Signals RBF'), rbf ? L('بله', 'بەڵێ', 'Yes') : L('خیر', 'نەخێر', 'No'))) +
        (cb ? '' : f(L('جمع ورودی‌ها', 'کۆی ئینپووتەکان', 'Total in'), fb(tin) + ' BTC' + (p ? ' · ' + usd(tin / 1e8 * p) : ''))) + f(L('جمع خروجی‌ها', 'کۆی ئاوتپووتەکان', 'Total out'), fb(tout) + ' BTC' + (p ? ' · ' + usd(tout / 1e8 * p) : ''));
      body.innerHTML = '<div class="mp-id"><code>' + esc(t.txid) + '</code><button type="button" data-mp="copy">' + L('کپی', 'کۆپی', 'Copy') + '</button><a href="https://mempool.space/tx/' + esc(t.txid) + '" target="_blank" rel="noopener">mempool.space ↗</a></div>' +
        '<div class="bx-dl">' + rows + '</div>' +
        '<div class="mp-io"><div><h5>' + L('ورودی‌ها', 'ئینپووتەکان', 'Inputs') + ' <small>(' + N(vin.length) + ')</small></h5><ol>' + ioList(vin, true) + '</ol></div><div class="mp-arr" aria-hidden="true"></div>' +
        '<div><h5>' + L('خروجی‌ها', 'ئاوتپووتەکان', 'Outputs') + ' <small>(' + N(vout.length) + ')</small></h5><ol>' + ioList(vout, false) + '</ol></div></div>' +
        (p ? '<p class="mp-cap">' + L('ارزش‌های دلاری به قیمت امروز است.', 'بەهای دۆلاری بە نرخی ئەمڕۆیە.', 'Dollar values use today’s price.') + '</p>' : '');
    }
    /* an address: /api/address/<a>, and its recent transactions unless it has thousands */
    function aType(a) { return /^1/.test(a) ? 'P2PKH (Legacy)' : /^3/.test(a) ? 'P2SH' : /^bc1q/i.test(a) ? (a.length > 50 ? 'SegWit (P2WSH)' : 'SegWit (P2WPKH)') : /^bc1p/i.test(a) ? 'Taproot (P2TR)' : ''; }
    function adLoad(a) {
      var k = 'a:' + a;
      getJSON(MP + '/address/' + a, 12000).then(function (s) {
        if (shownKey !== k || !s || !s.chain_stats) return;
        var n = (s.chain_stats.tx_count || 0) + ((s.mempool_stats || {}).tx_count || 0);
        adShow(a, s, null, n);
        if (n && n <= 2000) getJSON(MP + '/address/' + a + '/txs', 15000).then(function (l) { if (shownKey === k) adShow(a, s, l, n); }, function () { });
      }, function (e) {
        if (shownKey === k) bodyMsg(e && /^4\d\d$/.test(e.message) ? L('این آدرس معتبر نیست.', 'ئەم ناونیشانە دروست نییە.', 'That address is not valid.') : L('اتصال به شبکه برقرار نشد؛ کمی بعد دوباره امتحان کنید.', 'پەیوەندی بە تۆڕەکەوە نەکرا؛ دواتر هەوڵ بدەرەوە.', 'Could not reach the network; try again in a moment.'));
      });
    }
    function adShow(a, s, list, n) {
      var body = $('.mp-body'), st = $('.mp-st'), p = px(); if (!body) return;
      var cs = s.chain_stats, ms = s.mempool_stats || {}, bal = cs.funded_txo_sum - cs.spent_txo_sum, un = (ms.funded_txo_sum || 0) - (ms.spent_txo_sum || 0);
      st.hidden = false; st.className = 'mp-st'; st.textContent = aType(a);
      function f(lab, val) { return val == null ? '' : '<div><small>' + lab + '</small><b>' + val + '</b></div>'; }
      var rows = f(L('موجودی', 'باڵانس', 'Balance'), fb(bal) + ' BTC' + (p ? ' · ' + usd(bal / 1e8 * p) : '')) +
        (un ? f(L('تغییر تأییدنشده', 'گۆڕانی پشتڕاستنەکراوە', 'Unconfirmed change'), (un > 0 ? '+' : '−') + fb(Math.abs(un)) + ' BTC') : '') +
        f(L('کل دریافتی', 'کۆی وەرگیراو', 'Total received'), fb(cs.funded_txo_sum) + ' BTC') + f(L('کل ارسالی', 'کۆی نێردراو', 'Total sent'), fb(cs.spent_txo_sum) + ' BTC') + f(L('تعداد تراکنش', 'ژمارەی مامەڵە', 'Transactions'), N(n));
      var hist = '';
      if (list && list.length) {
        hist = '<h5>' + L('تراکنش‌های اخیر', 'دوایین مامەڵەکان', 'Recent transactions') + '</h5><ol class="mp-hist">' + list.slice(0, 15).map(function (t) {
          var d2 = 0; (t.vout || []).forEach(function (o) { if (o.scriptpubkey_address === a) d2 += o.value; }); (t.vin || []).forEach(function (i) { if (i.prevout && i.prevout.scriptpubkey_address === a) d2 -= i.prevout.value; });
          var when = t.status && t.status.confirmed ? (t.status.block_time ? esc(day(t.status.block_time)) : '') + ' · ' + L('بلاک ', 'بلۆکی ', 'block ') + N(t.status.block_height) : L('در صف', 'لە ڕیزدا', 'unconfirmed');
          return '<li><button type="button" data-tx="' + esc(t.txid) + '"><span><code>' + esc(short(t.txid)) + '</code><small>' + when + '</small></span><b class="' + (d2 >= 0 ? 'pos' : 'neg') + '">' + (d2 >= 0 ? '+' : '−') + fb(Math.abs(d2)) + ' BTC</b></button></li>';
        }).join('') + '</ol>';
      } else if (n > 2000) hist = '<p class="mp-cap">' + L('این آدرس بیش از ۲٬۰۰۰ تراکنش دارد؛ فهرست کامل را در mempool.space ببینید.', 'ئەم ناونیشانە زیاتر لە ٢٬٠٠٠ مامەڵەی هەیە؛ لیستی تەواو لە mempool.space ببینە.', 'This address has more than 2,000 transactions; see the full list on mempool.space.') + '</p>';
      body.innerHTML = '<div class="mp-id"><code>' + esc(a) + '</code><button type="button" data-mp="copy">' + L('کپی', 'کۆپی', 'Copy') + '</button><a href="https://mempool.space/address/' + esc(a) + '" target="_blank" rel="noopener">mempool.space ↗</a></div>' +
        '<div class="bx-dl">' + rows + '</div>' + hist +
        '<p class="mp-cap">' + L('جست‌وجو مستقیم از مرورگر شما به mempool.space می‌رود و این سایت چیزی از آن ذخیره نمی‌کند. ارزش دلاری به قیمت امروز است.', 'گەڕانەکە ڕاستەوخۆ لە وێبگەڕەکەتەوە دەچێتە mempool.space و ئەم ماڵپەڕە هیچی لێ پاشەکەوت ناکات. بەهای دۆلاری بە نرخی ئەمڕۆیە.', 'The lookup goes straight from your browser to mempool.space; this site stores none of it. Dollar values use today’s price.') + '</p>';
    }

    /* ---- the way back: from the newest block to block zero, by height, hash or date, by the slider, or cube by cube */
    function msg(t) { $('.bx-msg').textContent = t || ''; }
    function busy(on) { $('.bx-tm').classList.toggle('busy', !!on); }
    function fail() { msg(L('اتصال به شبکه برقرار نشد؛ کمی بعد دوباره امتحان کنید.', 'پەیوەندی بە تۆڕەکەوە نەکرا؛ دواتر هەوڵ بدەرەوە.', 'Could not reach the network; try again in a moment.')); }
    function pos() { var l = shown(), b = sel && l.filter(function (x) { return x.id === sel; })[0]; return b || (view ? l.filter(function (x) { return x.height === view.at; })[0] || l[0] : null); }
    function tmFill() {
      var tm = $('.bx-tm'), inp = tm.querySelector('.bx-find input'), rg = tm.querySelector('input[type=range]'), b = pos();
      inp.placeholder = L('شمارهٔ بلاک، هش، شناسهٔ تراکنش، آدرس یا تاریخ (مثل 1389/03/01)', 'ژمارەی بلۆک، هاش، ناسنامەی مامەڵە، ناونیشان یان بەروار (وەک 2010-05-22)', 'Block height, hash, transaction id, address or a date (e.g. 2010-05-22)');
      inp.setAttribute('aria-label', L('جست‌وجوی بلاک، تراکنش یا آدرس', 'گەڕان بەدوای بلۆک، مامەڵە یان ناونیشاندا', 'Find a block, transaction or address'));
      tm.querySelector('.bx-find button').textContent = L('برو', 'بڕۆ', 'Go');
      tm.querySelector('[data-go=live]').textContent = L('اکنون', 'ئێستا', 'Now');
      tm.querySelector('[data-go="0"]').textContent = L('بلاک صفر · ۲۰۰۹', 'بلۆکی سفر · ٢٠٠٩', 'Block 0 · 2009');
      tm.querySelector('[data-go=live]').classList.toggle('on', !view);
      rg.max = tip; rg.setAttribute('aria-label', L('حرکت در تاریخ زنجیره', 'گەڕان بە مێژووی زنجیرەکەدا', 'Travel through the chain'));
      if (!drag) { rg.value = b ? b.height : tip; read(b ? b.height : tip, b ? b.timestamp : null); }
      var mk = $('.bx-marks'), h = MARKS.filter(function (m) { return m[0] <= tip; }).map(function (m) { return '<button type="button" data-go="' + m[0] + '"' + (b && b.height === m[0] ? ' class="on"' : '') + '><b>' + N(m[0]) + '</b><span dir="auto">' + esc(L(m[1], m[2], m[3])) + '</span></button>'; }).join('');
      if (mk.innerHTML !== h) mk.innerHTML = h;
    }
    function read(h, ts) { $('.bx-rd').innerHTML = (!view && h === tip ? L('اکنون', 'ئێستا', 'Now') + ' · ' : '') + L('بلاک ', 'بلۆکی ', 'Block ') + '<bdi>' + N(h) + '</bdi>' + (ts ? ' · ' + esc(day(ts)) : ''); }
    function center(id) {
      var bt = $('.bx-belt'), el = id && bt.querySelector('.bx-b[data-id="' + id + '"]'); if (!el) { bt.scrollLeft = 0; return; }
      var x = el.getBoundingClientRect().left - bt.getBoundingClientRect().left + bt.scrollLeft - (bt.clientWidth - el.offsetWidth) / 2;
      if (bt.scrollTo && !RM) bt.scrollTo({ left: x, behavior: 'smooth' }); else bt.scrollLeft = x;
    }
    function show(h, id) {   /* open the chain at one height: three newer blocks, the block itself, the ones before it */
      if (!tip) return fail(); h = Math.max(0, Math.min(tip, h)); var me = ++rq; busy(true); msg(''); look = null;
      return getJSON(MP + '/v1/blocks/' + Math.min(tip, h + 3), 12000).then(function (a) {
        if (me !== rq || !alive) return; if (!a || !a.length) throw 0;
        var l = a.map(norm), t = l.filter(function (x) { return id ? x.id === id : x.height === h; })[0] || l[0];
        view = { list: l }; sel = t.id; busy(false); belt(); center(sel); return true;
      }).catch(function () { if (me === rq && alive) { busy(false); fail(); } });
    }
    function goLive() { rq++; busy(false); msg(''); view = null; sel = null; look = null; belt(); center(null); }
    function older() {
      var l = shown(), low = l[l.length - 1].height; if (low <= 0 || !tip) return; var me = ++rq; busy(true); msg('');
      getJSON(MP + '/v1/blocks/' + (low - 1), 12000).then(function (a) {
        if (me !== rq || !alive) return; if (!a || !a.length) throw 0; var add = a.map(norm).filter(function (x) { return x.height < low; }); if (!add.length) throw 0;
        var base = view ? view.list : (D.blocks || []).filter(function (x) { return x.height >= low; });
        view = { list: base.concat(add).slice(-240), at: add[0].height }; sel = null; look = null; busy(false); belt(); center(add[Math.min(2, add.length - 1)].id);
      }).catch(function () { if (me === rq && alive) { busy(false); fail(); } });
    }
    function j2g(jy, jm, jd) {   /* a Solar Hijri date to the Gregorian one */
      jy += 1595; var days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor((jy % 33 + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186), gy = 400 * Math.floor(days / 146097); days %= 146097;
      if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
      gy += 4 * Math.floor(days / 1461); days %= 1461; if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
      var gd = days + 1, ml = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], gm = 1;
      for (; gm <= 12 && gd > ml[gm]; gm++) gd -= ml[gm]; return [gy, gm, gd];
    }
    function isAddr(a) { var lo = a.toLowerCase(); return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a) || (/^bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{8,87}$/.test(lo) && (a === lo || a === a.toUpperCase())); }
    function find(q) {
      q = String(q || '').replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 1776; }).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).trim();
      var n = q.replace(/[,٬،\s#]/g, ''), m;
      if (!q) return; lastAct = Date.now();
      if (isAddr(n)) { msg(''); openAddr(/^bc1/i.test(n) ? n.toLowerCase() : n); return; }
      if (!tip) return fail();
      if (/^\d{1,8}$/.test(n)) { if (+n > tip) return msg(L('هنوز چنین بلاکی ساخته نشده؛ آخرین بلاک ' + N(tip) + ' است.', 'ئەم بلۆکە هێشتا دروست نەکراوە؛ دوایین بلۆک ' + N(tip) + 'ە.', 'That block does not exist yet; the latest one is ' + N(tip) + '.')); return show(+n); }
      if (/^[0-9a-f]{64}$/i.test(n)) {   /* a block hash or a transaction id: block hashes start with zeros, so try that first for them */
        var me = ++rq, hx = n.toLowerCase(), errs = [];
        busy(true); msg('');
        var asBlock = function () { return getJSON(MP + '/v1/block/' + hx, 12000).then(function (b) { if (!b || b.height == null) throw new Error('404'); if (me !== rq || !alive) return; return show(b.height, b.id); }); };
        var asTx = function () { return getJSON(MP + '/tx/' + hx, 12000).then(function (t) { if (!t || !t.txid) throw new Error('404'); if (me !== rq || !alive) return; busy(false); openTx(t.txid, t); }); };
        var one = /^00000000/.test(hx) ? asBlock : asTx, two = one === asBlock ? asTx : asBlock;
        return one().catch(function (e) { errs.push(e); return two(); }).catch(function (e) {
          errs.push(e); if (me !== rq || !alive) return; busy(false);
          if (errs.every(function (x) { return x && /^4\d\d$/.test(x.message); })) msg(L('بلاک یا تراکنشی با این هش پیدا نشد.', 'هیچ بلۆک یان مامەڵەیەک بەم هاشە نەدۆزرایەوە.', 'No block or transaction with this hash.')); else fail();
        });
      }
      if ((m = /^(\d{4})[-\/.](\d{1,2})(?:[-\/.](\d{1,2}))?$/.exec(q))) {
        var y = +m[1], mo = +m[2], dd = +(m[3] || 1), g = y < 1700 ? (mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31 ? j2g(y, mo, dd) : null) : [y, mo, dd], t0 = g ? Date.UTC(g[0], g[1] - 1, g[2]) / 1000 : NaN, chk = g && new Date(t0 * 1000);
        if (!g || isNaN(t0) || chk.getUTCMonth() !== g[1] - 1 || chk.getUTCDate() !== g[2]) return msg(L('این تاریخ درست نیست.', 'ئەم بەروارە دروست نییە.', 'That is not a valid date.'));
        if (t0 > Date.now() / 1000) return msg(L('این تاریخ هنوز نرسیده است.', 'ئەم بەروارە هێشتا نەهاتووە.', 'That date is still in the future.'));
        if (t0 + 86399 < GEN) { show(0); return msg(L('پیش از ۳ ژانویهٔ ۲۰۰۹ بلاکی وجود ندارد؛ این بلاک صفر است.', 'پێش ٣ی کانوونی دووەمی ٢٠٠٩ هیچ بلۆکێک نییە؛ ئەمە بلۆکی سفرە.', 'There is no block before 3 January 2009; this is block zero.')); }
        var me2 = ++rq; busy(true); msg('');
        return getJSON(MP + '/v1/mining/blocks/timestamp/' + Math.min(Math.floor(Date.now() / 1000), t0 + 86399), 12000).then(function (b) {
          if (me2 !== rq || !alive) return; if (!b || b.height == null) throw 0;
          show(b.height).then(function (ok) { if (ok && me2 + 1 === rq) msg(L('آخرین بلاکِ روز ' + day(t0) + ' (به وقت جهانی)؛ بلاک‌های پیش از آن در ادامه‌اند.', 'دوایین بلۆکی ڕۆژی ' + day(t0) + ' (بە کاتی جیهانی)؛ بلۆکەکانی پێشتر لە دوایدان.', 'The last block of ' + day(t0) + ' (UTC); the blocks before it follow.')); });
        }).catch(function () { if (me2 === rq && alive) { busy(false); fail(); } });
      }
      msg(L('شمارهٔ بلاک (مثل 170)، هش بلاک یا شناسهٔ تراکنش (۶۴ کاراکتر)، آدرس بیت‌کوین، یا تاریخ به شکل 2010-05-22 یا 1389/03/01 بنویسید.', 'ژمارەی بلۆک (وەک 170)، هاشی بلۆک یان ناسنامەی مامەڵە (٦٤ پیت)، ناونیشانی بیتکۆین، یان بەروار بە شێوەی 2010-05-22 بنووسە.', 'Type a block height (e.g. 170), a block hash or transaction id (64 characters), a Bitcoin address, or a date as 2010-05-22.'));
    }

    /* ---- the tables */
    function row(lab, val, note) { return val == null || val === '—' ? '' : '<div class="bx-row"><span>' + lab + '</span><b>' + val + (note ? '<small>' + note + '</small>' : '') + '</b></div>'; }
    function grid() {
      var b = (D.blocks || [])[0]; if (!b) return;
      var h = b.height, sup = supply(h), sub = subsidy(h), p = px(), day = D.day || {}, fe = D.fees || {}, mp = D.mempool || {}, a = D.adj || {}, bc = D.bc || {}, ln = D.ln || {}, nd = D.nodes || {}, out = '';
      function card(t, body) { if (body) out += '<div class="bx-card"><h4>' + t + '</h4>' + body + '</div>'; }
      function feeRow(lab, v) { return row(lab, v != null ? N(v) + ' sat/vB' : null, v != null && p ? usd(v * 140 * p / 1e8) : ''); }
      card(L('عرضه و ارزش', 'دابینکردن و بەها', 'Supply and value'),
        row(L('استخراج‌شده تا این بلاک', 'کانکراو تا ئەم بلۆکە', 'Mined so far'), N(sup, 3) + ' BTC') + row(L('باقی‌مانده برای استخراج', 'ماوە بۆ کانکاری', 'Left to mine'), N(21e6 - sup, 3) + ' BTC') +
        row(L('سهم استخراج‌شده از سقف', 'ڕێژەی کانکراو لە سنوور', 'Share of the cap mined'), (sup / 21e6 * 100).toFixed(3) + '%') + row(L('قیمت', 'نرخ', 'Price'), p ? '$' + N(p) : null) +
        row(L('ارزش بازار', 'بەهای بازاڕ', 'Market value'), p ? usd(p * sup) : null) + row(L('پاداش هر بلاک', 'پاداشتی هەر بلۆک', 'Reward per block'), sub + ' BTC') +
        row(L('انتشار سالانهٔ سکهٔ تازه', 'دەرچوونی ساڵانەی دراوی نوێ', 'New coins per year'), (sub * 52560 / sup * 100).toFixed(2) + '%', N(sub * 52560) + ' BTC'));
      var span = day.span || (a.timeAvg ? 144 * a.timeAvg / 1000 : 86400), rev = day.reward != null ? day.reward / 1e8 : null, fee = day.fee != null ? day.fee / 1e8 : null;
      card(L('۱۴۴ بلاک اخیر (حدود یک روز)', '١٤٤ بلۆکی دوایی (نزیکەی ڕۆژێک)', 'Last 144 blocks (about a day)'),
        row(L('تراکنش‌ها', 'مامەڵەکان', 'Transactions'), day.tx != null ? N(day.tx) : null, day.tx != null ? (day.tx / span).toFixed(1) + L(' در ثانیه', ' لە چرکەیەکدا', ' a second') : '') +
        row(L('درآمد ماینرها', 'داهاتی ماینەرەکان', 'Miner revenue'), rev != null ? N(rev, 2) + ' BTC' : null, rev != null && p ? usd(rev * p) : '') +
        row(L('از آن، کارمزد', 'لەوە، کرێ', 'Of which fees'), fee != null ? N(fee, 2) + ' BTC' : null, fee != null && rev ? (fee / rev * 100).toFixed(1) + '%' : '') +
        row(L('میانگین کارمزد هر تراکنش', 'تێکڕای کرێی هەر مامەڵە', 'Average fee per transaction'), day.fee != null && day.tx ? N(day.fee / day.tx) + ' sat' : null, day.fee != null && day.tx && p ? usd(day.fee / day.tx * p / 1e8) : '') +
        row(L('میانگین فاصلهٔ بلاک‌ها', 'تێکڕای ماوەی نێوان بلۆکەکان', 'Average time between blocks'), day.span ? (day.span / 144 / 60).toFixed(1) + L(' دقیقه', ' خولەک', ' min') : a.timeAvg ? (a.timeAvg / 60000).toFixed(1) + L(' دقیقه', ' خولەک', ' min') : null, day.span ? '' : (a.timeAvg ? L('در این دورهٔ سختی', 'لەم خولی سەختییەدا', 'this difficulty period') : '')) +
        row(L('حجم جابه‌جاشده', 'قەبارەی گواستراوە', 'Volume moved'), bc.vol_24h ? N(bc.vol_24h / 1e8) + ' BTC' : null, bc.vol_24h && p ? usd(bc.vol_24h / 1e8 * p) : '') +
        row(L('بزرگ‌ترین تراکنش', 'گەورەترین مامەڵە', 'Largest transaction'), bc.largest_usd ? usd(bc.largest_usd) : null));
      card(L('کارمزد و صف انتظار', 'کرێ و ڕیزی چاوەڕوانی', 'Fees and the queue'),
        feeRow(L('بلاک بعدی', 'بلۆکی داهاتوو', 'Next block'), fe.fastestFee) + feeRow(L('تا نیم ساعت', 'تا نیو کاتژمێر', 'Within half an hour'), fe.halfHourFee) + feeRow(L('تا یک ساعت', 'تا کاتژمێرێک', 'Within an hour'), fe.hourFee) + feeRow(L('بدون عجله', 'بێ پەلە', 'No hurry'), fe.economyFee) +
        row(L('تراکنش‌های در صف', 'مامەڵەکانی ناو ڕیز', 'Transactions waiting'), mp.count != null ? N(mp.count) : null) +
        row(L('حجم صف', 'قەبارەی ڕیز', 'Queue size'), mp.vsize != null ? (mp.vsize / 1e6).toFixed(1) + ' vMB' : null, mp.vsize != null ? L('حدود ' + Math.ceil(mp.vsize / 1e6) + ' بلاک', 'نزیکەی ' + Math.ceil(mp.vsize / 1e6) + ' بلۆک', 'about ' + Math.ceil(mp.vsize / 1e6) + ' blocks') : '') +
        row(L('کارمزدهای منتظر', 'کرێی چاوەڕوان', 'Fees waiting'), mp.total_fee != null ? (mp.total_fee / 1e8).toFixed(3) + ' BTC' : null));
      var bl = D.blocks || [], avgSize = bl.length ? bl.reduce(function (s, x) { return s + x.size; }, 0) / bl.length / 1e6 : null, next = (Math.floor(h / 210000) + 1) * 210000;
      card(L('بلاک و استخراج', 'بلۆک و کانکاری', 'Blocks and mining'),
        row(L('ارتفاع زنجیره', 'بەرزیی زنجیرە', 'Chain height'), N(h)) + row(L('میانگین حجم بلاک', 'تێکڕای قەبارەی بلۆک', 'Average block size'), avgSize ? avgSize.toFixed(2) + ' MB' : null) +
        row(L('توان شبکه', 'توانای تۆڕ', 'Hashrate'), D.hashrate ? N(D.hashrate / 1e18) + ' EH/s' : null) + row(L('سختی', 'سەختی', 'Difficulty'), D.difficulty ? (D.difficulty / 1e12).toFixed(2) + ' T' : null) +
        row(L('تنظیم سختی بعدی', 'ڕێکخستنی سەختیی داهاتوو', 'Next difficulty change'), a.difficultyChange != null ? (a.difficultyChange >= 0 ? '+' : '−') + Math.abs(a.difficultyChange).toFixed(2) + '%' : null, a.estimatedRetargetDate ? esc(dateOf(a.estimatedRetargetDate)) : '') +
        row(L('بلاک تا هاوینگ', 'بلۆک تا هاڵڤینگ', 'Blocks to the halving'), N(next - h), L('در بلاک ', 'لە بلۆکی ', 'at block ') + N(next)));
      card(L('شبکه', 'تۆڕ', 'Network'),
        row(L('نودهای در دسترس', 'نۆدە بەردەستەکان', 'Reachable nodes'), nd.total ? N(nd.total) : null, 'bitnodes') +
        row(L('نودهای لایتنینگ', 'نۆدەکانی لایتنینگ', 'Lightning nodes'), ln.nodes ? N(ln.nodes) : null) + row(L('کانال‌های لایتنینگ', 'کەناڵەکانی لایتنینگ', 'Lightning channels'), ln.channels ? N(ln.channels) : null) +
        row(L('ظرفیت لایتنینگ', 'توانای لایتنینگ', 'Lightning capacity'), ln.capacity ? N(ln.capacity / 1e8) + ' BTC' : null, ln.at ? String(ln.at).slice(0, 10) : '') +
        row(L('خروجی‌های خرج‌نشده (UTXO)', 'دەرچووە خەرجنەکراوەکان (UTXO)', 'Unspent outputs (UTXO)'), D.utxo ? N(D.utxo) : null) +
        row(L('آدرس‌های دارای موجودی', 'ناونیشانە خاوەن باڵانسەکان', 'Addresses with a balance'), bc.holders ? N(bc.holders) : null) +
        row(L('حجم کل زنجیره', 'قەبارەی گشتیی زنجیرە', 'Size of the whole chain'), bc.size ? (bc.size / 1e9).toFixed(1) + ' GB' : null) +
        row(L('روز از بلاک صفر', 'ڕۆژ لە بلۆکی سفرەوە', 'Days since block zero'), N(Math.floor((Date.now() - Date.UTC(2009, 0, 3, 18, 15, 5)) / 864e5)), '2009-01-03'));
      var pl = D.pools, ph = '';
      if (pl && pl.list && pl.total) {
        var shown = 0; pl.list.slice(0, 6).forEach(function (x) { shown += x[1]; ph += '<div class="bx-pool"><span>' + esc(x[0]) + '</span><i style="--w:' + (x[1] / pl.list[0][1] * 100).toFixed(1) + '%"></i><b>' + (x[1] / pl.total * 100).toFixed(1) + '%</b></div>'; });
        if (pl.total > shown) ph += '<div class="bx-pool"><span>' + L('بقیه', 'ئەوانی تر', 'Others') + '</span><i style="--w:' + ((pl.total - shown) / pl.list[0][1] * 100).toFixed(1) + '%"></i><b>' + ((pl.total - shown) / pl.total * 100).toFixed(1) + '%</b></div>';
        card(L('سهم استخرها از بلاک‌های ۷ روز اخیر', 'پشکی حەوزەکان لە بلۆکەکانی ٧ ڕۆژی دوایی', 'Pools’ share of the last 7 days of blocks'), ph);
      }
      var hr = D.hr;
      if (hr && hr.length > 3) {
        var lo = Infinity, hi = -Infinity; hr.forEach(function (x) { if (x[1] < lo) lo = x[1]; if (x[1] > hi) hi = x[1]; });
        var pts = hr.map(function (x, i) { return (i / (hr.length - 1) * 300).toFixed(1) + ',' + (84 - (hi > lo ? (x[1] - lo) / (hi - lo) : .5) * 76).toFixed(1); }).join(' ');
        card(L('توان شبکه در یک سال گذشته', 'توانای تۆڕ لە ساڵی ڕابردوودا', 'Hashrate over the last year'),
          '<svg class="bx-spark" viewBox="0 0 300 92" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="bxg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f7931a" stop-opacity=".45"/><stop offset="1" stop-color="#f7931a" stop-opacity="0"/></linearGradient></defs><polygon points="0,92 ' + pts + ' 300,92" fill="url(#bxg)"/><polyline points="' + pts + '" fill="none" stroke="#ffd27a" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>' +
          row(L('کمترین', 'کەمترین', 'Lowest'), N(lo) + ' EH/s') + row(L('بیشترین', 'زۆرترین', 'Highest'), N(hi) + ' EH/s'));
      }
      $('.bx-grid').innerHTML = out;
      $('.bx-foot').textContent = L('منبع: mempool.space (بلاک‌ها، صف، کارمزد، استخراج، لایتنینگ)، bitnodes.io (نودها) و blockchair.com (حجم زنجیره، آدرس‌ها، حجم جابه‌جاشده). عرضه، انتشار و هاوینگ از روی ارتفاع بلاک حساب می‌شوند. کارمزد دلاری برای یک انتقال سادهٔ ۱۴۰ بایت مجازی است.',
        'سەرچاوە: mempool.space (بلۆک، ڕیز، کرێ، کانکاری، لایتنینگ)، bitnodes.io (نۆدەکان) و blockchair.com (قەبارەی زنجیرە، ناونیشان، قەبارەی گواستراوە). دابینکردن، دەرچوون و هاڵڤینگ لە بەرزیی بلۆکەوە دەژمێردرێن. کرێی دۆلاری بۆ گواستنەوەیەکی سادەی ١٤٠ بایتی مەجازییە.',
        'Sources: mempool.space (blocks, queue, fees, mining, Lightning), bitnodes.io (nodes) and blockchair.com (chain size, addresses, volume). Supply, issuance and the halving are computed from the block height. Dollar fees are for a simple 140-vbyte transfer.');
    }
    function render() { if (!alive) return; hudFill(); belt(); grid(); lines(); sxSkel(); sxKpi(); }

    /* ---- data */
    function live() {
      if (!alive || d.hidden) return;
      if (wsOk && Date.now() - wsLast < 20000 && Date.now() - restAt < 300000) return;   /* the socket already brings all of it */
      Promise.all([getJSON(MP + '/v1/blocks'), getJSON(MP + '/mempool'), getJSON(MP + '/v1/fees/mempool-blocks'), getJSON(MP + '/v1/fees/recommended'), getJSON(MP + '/v1/difficulty-adjustment')]).then(function (r) {
        if (!alive || !Array.isArray(r[0]) || !r[0].length) throw new Error('shape');
        D.blocks = r[0].slice(0, 15).map(norm);
        if (r[0][0].extras && r[0][0].extras.utxoSetSize) D.utxo = r[0][0].extras.utxoSetSize;
        D.mempool = { count: r[1].count, vsize: r[1].vsize, total_fee: r[1].total_fee };
        D.next = (r[2] || []).slice(0, 8).map(nb);
        D.fees = r[3]; D.adj = r[4]; restAt = Date.now();
        setState('live'); render();
      }).catch(function () { if (alive && state !== 'live') setState(D.blocks ? 'snap' : 'fail'); });
    }
    /* the slower numbers (a day of blocks, pools, a year of hashrate, Lightning): asked from the network itself once, then every 10 minutes */
    function slow() {
      if (!alive || d.hidden) return;
      var done = function () { if (alive) grid(); };
      getJSON(MP + '/v1/mining/reward-stats/144').then(function (r) { if (r && r.totalTx) { var sp = D.day && D.day.end === r.endBlock ? D.day.span : null; D.day = { blocks: 144, reward: +r.totalReward, fee: +r.totalFee, tx: +r.totalTx, start: r.startBlock, end: r.endBlock, span: sp }; done(); } }).catch(function () { });
      getJSON(MP + '/v1/mining/pools/1w').then(function (r) { if (r && r.pools && r.pools.length) { D.pools = { total: r.blockCount, list: r.pools.slice(0, 8).map(function (p) { return [p.name, p.blockCount]; }) }; done(); } }).catch(function () { });
      getJSON(MP + '/v1/mining/hashrate/1y', 12000).then(function (r) {
        if (!r || !r.hashrates || !r.hashrates.length) return; var hs = r.hashrates, st = Math.max(1, Math.floor(hs.length / 60));
        D.hr = hs.filter(function (x, i) { return i % st === 0; }).map(function (x) { return [x.timestamp, Math.round(x.avgHashrate / 1e17) / 10]; }); D.hashrate = r.currentHashrate; D.difficulty = r.currentDifficulty; if (alive) { hudFill(); grid(); }
      }).catch(function () { });
      getJSON(MP + '/v1/lightning/statistics/latest').then(function (r) { var l = r && r.latest; if (l && l.channel_count) { D.ln = { channels: l.channel_count, nodes: l.node_count, capacity: l.total_capacity, at: l.added }; done(); } }).catch(function () { });
      getJSON(MP + '/v1/prices').then(function (r) { if (r && r.USD) { D.price = r.USD; if (alive) { hudFill(); grid(); } } }).catch(function () { });
    }
    Promise.all([getJSON('/data/btcinfo.json?v=' + Math.floor(Date.now() / 3e5)).catch(function () { return null; }), getJSON('/data/chain.json?v=' + Math.floor(Date.now() / 3e5)).catch(function () { return null; })]).then(function (r) {
      if (!alive) return; var a = r[0] || {}, c = r[1] || {};
      Object.keys(a).forEach(function (k) { D[k] = a[k]; });
      if (!D.blocks && c.blocks) D.blocks = c.blocks.map(function (b) { var x = b.extras || {}; return { id: b.id, height: b.height, timestamp: b.timestamp, tx_count: b.tx_count, size: b.size, totalFees: x.totalFees, medianFee: x.medianFee, pool: (x.pool || {}).name }; });
      if (!D.fees && c.fees) D.fees = c.fees; if (!D.hashrate && c.hashrate) { D.hashrate = c.hashrate; D.difficulty = c.difficulty; } if (!D.adj && c.adjustment) D.adj = c.adjustment;
      if (c.nodes) D.nodes = c.nodes; if (!D.t) D.t = c.updated_at;
      if (D.next) D.next = D.next.map(nb);
      if (D.blocks) { setState('snap'); render(); } else setState('load');
      live(); slow(); watch();
    });
    setState('load');
    timers.push(setInterval(live, 30000)); timers.push(setInterval(slow, 600000));
    timers.push(setInterval(function () {   /* clocks and "ago" labels tick without re-rendering */
      [].forEach.call(root.querySelectorAll('[data-clock]'), function (e) { e.textContent = clock(+e.getAttribute('data-clock')); });
      if (Date.now() % 15000 < 1000) [].forEach.call(root.querySelectorAll('[data-ago]'), function (e) { e.textContent = ago(+e.getAttribute('data-ago')); });
      [].forEach.call(root.querySelectorAll('[data-sago]'), function (e) { e.textContent = ago(+e.getAttribute('data-sago')); });
    }, 1000));
    timers.push(setInterval(function () { var v = px(); if (uiDirty || (v && v !== price)) { uiDirty = false; if (v) price = v; hudFill(); grid(); } }, 5000));
    timers.push(setInterval(function () {   /* six quiet minutes: stop the stream to spare the visitor's data; no socket: poll instead */
      if (ws && wsOk && Date.now() - lastAct > 360000) { paused = true; autoP = true; wsClose(); pills(); sxFill(0); }
      if (!wsOk && wsTry >= 3 && wsWanted()) restRecent();
    }, 10000));
    probe = d.querySelector('b[data-btc-probe]');
    if (!probe) { probe = d.createElement('b'); probe.setAttribute('data-live', 'BTC'); probe.setAttribute('data-btc-probe', ''); probe.hidden = true; d.body.appendChild(probe); if (w.liveRefresh) w.liveRefresh(); }
    root.addEventListener('click', function (e) {
      var t = e.target, c = function (s) { return t.closest ? t.closest(s) : null; }, g;
      lastAct = Date.now();
      if (M && M.pin && !c('.mp-tip') && !c('.mp-cv canvas')) { M.pin = null; tipHide(); mapPaint(); }
      if ((g = c('[data-go]'))) { var v = g.getAttribute('data-go'); if (v === 'live') goLive(); else if (v === 'older') older(); else show(+v); return; }
      if ((g = c('[data-q]'))) { var i = +g.getAttribute('data-q'); look = null; sel = null; qsel = shownKey === 'q:' + i ? null : i; if (qsel != null && paused) { paused = false; autoP = false; } belt(); wsCheck(); return; }
      if ((g = c('.bx-b[data-id]'))) { look = null; sel = sel === g.getAttribute('data-id') ? null : g.getAttribute('data-id'); belt(); return; }
      if ((g = c('[data-x]'))) { if (look) look = null; else if (shownKey.charAt(0) === 'b') sel = null; else qsel = null; belt(); return; }
      if ((g = c('[data-tx]'))) { if (M) { M.pin = null; tipHide(); } openTx(g.getAttribute('data-tx')); return; }
      if ((g = c('[data-ad]'))) { openAddr(g.getAttribute('data-ad')); return; }
      if ((g = c('[data-hgt]'))) { look = null; show(+g.getAttribute('data-hgt')); return; }
      if ((g = c('[data-gg]'))) { var key = g.getAttribute('data-gg'); gg[key] = !gg[key]; ggFill(); mapPaint(); return; }
      if ((g = c('[data-mp]'))) { mpAct(g.getAttribute('data-mp'), g); return; }
    });
    root.addEventListener('submit', function (e) { e.preventDefault(); var i = e.target.querySelector('input'); if (i) find(i.value); });
    root.addEventListener('input', function (e) { if (e.target.type === 'range') { drag = true; read(+e.target.value, null); } });
    root.addEventListener('change', function (e) { if (e.target.type === 'range') { drag = false; var v = +e.target.value; if (v >= tip) goLive(); else show(v); } });
    var rs = 0, onRs = function () { clearTimeout(rs); rs = setTimeout(function () { lines(); mapPaint(); }, 120); }; w.addEventListener('resize', onRs);
    var onAct = function () { lastAct = Date.now(); }, io2 = null;
    w.addEventListener('scroll', onAct, { passive: true }); root.addEventListener('keydown', onAct);
    var onVis = function () { clearTimeout(hidT); if (d.hidden) hidT = setTimeout(wsCheck, 20000); else wsCheck(); };
    d.addEventListener('visibilitychange', onVis);
    function watch() {   /* the socket opens when this section comes on screen, and closes 20 s after it leaves */
      if (!alive || io2 !== null) return;
      if (!('IntersectionObserver' in w)) { io2 = false; inView = true; wsCheck(); return; }
      io2 = new IntersectionObserver(function (en) { inView = en[0].isIntersecting; clearTimeout(hidT); if (inView) wsCheck(); else hidT = setTimeout(wsCheck, 20000); }, { rootMargin: '200px' });
      io2.observe(root);
    }
    if (location.hash === '#mempool') setTimeout(function () { var sx = root.closest('[data-bx]') || root; if (alive) sx.scrollIntoView({ block: 'start' }); }, 500);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(lines);
    /* the coin in the middle: the real one where the browser can draw it, the still one otherwise */
    function startCoin() {
      if (!alive || !w.nxCoin) return;
      try { coin = w.nxCoin(core.querySelector('canvas'), { yaw: .4, spin: .3, embers: 26, dpr: 1.5, eye: [0, .7, 6.4], area: hud, onready: function () { core.classList.add('gl'); }, onlost: function () { core.classList.remove('gl'); coin = null; } }); } catch (e) { coin = null; }
    }
    if ('IntersectionObserver' in w) { var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); startCoin(); } }, { rootMargin: '200px' }); io.observe(hud); } else startCoin();
    return { stop: function () {
      alive = false; timers.forEach(clearInterval); clearTimeout(wsTimer); clearTimeout(hidT); wsClose(); mapKill(); if (io2) io2.disconnect();
      w.removeEventListener('resize', onRs); w.removeEventListener('scroll', onAct); d.removeEventListener('visibilitychange', onVis); if (coin) coin.destroy(); root.innerHTML = '';
    }, _t: { pack: pack, curve: curve, has: has, isAddr: isAddr, tOf: tOf, nb: nb, eta: eta } };
  }
  w.btcLive = btcLive;
})();
