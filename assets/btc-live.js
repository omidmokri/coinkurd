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
      '<div class="bx-belt" tabindex="0"><div class="bx-q"></div><div class="bx-now"><span></span></div><div class="bx-m"></div></div><div class="bx-det" hidden></div>' +
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
    var GEN = 1231006505, placed = false, view = null, tip = 0, rq = 0, drag = false;
    var MARKS = [[0, 'بلاک صفر', 'بلۆکی سفر', 'Genesis'], [170, 'اولین تراکنش', 'یەکەم مامەڵە', 'First transaction'], [57043, 'دو پیتزا', 'دوو پیتزا', 'Two pizzas'], [74638, 'خطای ۱۸۴ میلیاردی', 'هەڵەی ١٨٤ ملیاردی', '184-billion bug'],
      [210000, 'هاوینگ ۱', 'هاڵڤینگی ١', 'Halving 1'], [420000, 'هاوینگ ۲', 'هاڵڤینگی ٢', 'Halving 2'], [630000, 'هاوینگ ۳', 'هاڵڤینگی ٣', 'Halving 3'], [840000, 'هاوینگ ۴', 'هاڵڤینگی ٤', 'Halving 4']];
    function norm(b) { var x = b.extras || {}, fr = x.feeRange || []; return { id: b.id, height: b.height, timestamp: b.timestamp, tx_count: b.tx_count, size: b.size, weight: b.weight, reward: x.reward, totalFees: x.totalFees, medianFee: x.medianFee, feeRange: fr.length ? [fr[0], fr[fr.length - 1]] : null, pool: (x.pool || {}).name }; }
    function sz(n) { return n >= 1e6 ? (n / 1e6).toFixed(2) + ' MB' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' kB' : N(n) + ' B'; }
    function day(ts) { try { return new Date(ts * 1000).toLocaleDateString(lang() === 'en' ? 'en-GB' : lang() === 'ckb' ? 'ckb-IQ' : 'fa-IR-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return new Date(ts * 1000).toISOString().slice(0, 10); } }
    function shown() { return view ? view.list : (D.blocks || []).slice(0, 8); }
    function faces(inner) { return '<span class="bx-c"><i class="tp"></i><i class="sd"></i><span class="ft">' + inner + '</span></span>'; }
    function cube(o, mined, i) {
      var fr = o.feeRange, bytes = mined ? o.size : o.vsize, fill = Math.max(0, Math.min(100, mined ? (o.weight ? o.weight / 4e4 : bytes / 1e4) : bytes / 1e4));
      var inner = '<span class="f">~' + N(o.medianFee, o.medianFee < 10 ? 1 : 0) + ' <small>sat/vB</small></span>' + (fr ? '<span class="r">' + N(fr[0], fr[0] < 10 ? 1 : 0) + ' – ' + N(fr[1]) + '</span>' : '') +
        '<b>' + sz(bytes) + '</b><span class="x">' + N(mined ? o.tx_count : o.nTx) + ' tx</span>', st = ' style="--fill:' + fill.toFixed(0) + '%"';
      if (!mined) return '<div class="bx-b q"' + st + '>' + faces(inner + '<span class="a" dir="auto">' + L('حدود ' + (i + 1) * 10 + ' دقیقهٔ دیگر', 'نزیکەی ' + (i + 1) * 10 + ' خولەکی تر', 'in ~' + (i + 1) * 10 + ' min') + '</span>') + '</div>';
      var old = Date.now() / 1000 - o.timestamp > 129600;
      return '<button type="button" class="bx-b' + (sel === o.id ? ' sel' : '') + (o.height === 0 ? ' gen' : '') + (fill < 55 ? ' lo' : '') + '" data-id="' + o.id + '"' + st + ' aria-label="' + L('بلاک ', 'بلۆکی ', 'Block ') + o.height + '">' +
        faces(inner + (old ? '<span class="a" dir="auto">' + esc(day(o.timestamp)) + '</span>' : '<span class="a" dir="auto" data-ago="' + o.timestamp + '">' + esc(ago(o.timestamp)) + '</span>')) +
        '<em>' + N(o.height) + '</em>' + (o.pool && o.pool !== 'Unknown' ? '<cite>' + esc(o.pool) + '</cite>' : '') + '</button>';
    }
    function belt() {
      var all = D.blocks || []; if (!all.length) return;
      if (all[0].height > tip) tip = all[0].height;
      var bl = shown(), nx = view ? [] : (D.next || []).slice(0, 3), low = bl[bl.length - 1].height;
      $('.bx-belt').classList.toggle('hist', !!view);
      $('.bx-now span').textContent = L('اکنون', 'ئێستا', 'now');
      $('.bx-q').innerHTML = nx.map(function (o, i) { return cube(o, false, i); }).join('');
      $('.bx-m').innerHTML = bl.map(function (o, i) { return cube(o, true, i); }).join('') +
        (low > 0 ? '<button type="button" class="bx-b more" data-go="older">' + faces('<b>+</b><span class="a">' + L('بلاک‌های قدیمی‌تر', 'بلۆکە کۆنترەکان', 'Older blocks') + '</span>') + '<em>' + N(Math.max(0, low - 15)) + ' … ' + N(low - 1) + '</em></button>' : '');
      if (!view) { if (lastTip && bl[0].height > lastTip && !RM) { var f = $('.bx-m .bx-b'); if (f) f.classList.add('new'); if (coin) coin.pulse(); } lastTip = bl[0].height; }
      detail(); tmFill();
      if (!placed) { placed = true; var bt = $('.bx-belt'); bt.scrollLeft = Math.max(0, $('.bx-now').offsetLeft - bt.clientWidth * .45); }
    }
    function detail() {
      var box = $('.bx-det'), b = sel && shown().filter(function (x) { return x.id === sel; })[0];
      if (!b) { box.hidden = true; return; }
      var p = px(), fees = b.totalFees != null ? b.totalFees / 1e8 : null, rw = b.reward != null ? b.reward / 1e8 : null;
      function f(lab, val) { return val == null ? '' : '<div><small>' + lab + '</small><b>' + val + '</b></div>'; }
      box.hidden = false;
      box.innerHTML = '<h4>' + L('بلاک ', 'بلۆکی ', 'Block ') + N(b.height) + '</h4><a href="https://mempool.space/block/' + b.id + '" target="_blank" rel="noopener">' + b.id + '</a><div class="bx-dl">' +
        f(L('زمان ثبت', 'کاتی تۆمارکردن', 'Mined at'), esc(new Date(b.timestamp * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }))) +
        f(L('تراکنش', 'مامەڵە', 'Transactions'), N(b.tx_count)) + f(L('حجم', 'قەبارە', 'Size'), sz(b.size) + (b.weight ? ' · ' + (b.weight >= 1e4 ? (b.weight / 1e6).toFixed(2) + ' MWU' : N(b.weight) + ' WU') : '')) +
        f(L('پاداش ماینر', 'پاداشتی ماینەر', 'Miner reward'), rw != null ? rw.toFixed(4) + ' BTC' + (p ? ' · ' + usd(rw * p) + L(' به قیمت امروز', ' بە نرخی ئەمڕۆ', ' at today’s price') : '') : null) +
        f(L('مجموع کارمزدها', 'کۆی کرێکان', 'Total fees'), fees != null ? fees.toFixed(4) + ' BTC' + (rw ? ' · ' + (fees / rw * 100).toFixed(1) + '%' : '') : null) +
        f(L('کارمزد میانه', 'کرێی ناوەند', 'Median fee'), b.medianFee != null ? N(b.medianFee, 1) + ' sat/vB' : null) + f(L('بازهٔ کارمزد', 'مەودای کرێ', 'Fee range'), b.feeRange ? N(b.feeRange[0], 1) + ' – ' + N(b.feeRange[1]) + ' sat/vB' : null) +
        f(L('استخر', 'حەوز', 'Pool'), b.pool && b.pool !== 'Unknown' ? esc(b.pool) : null) + '</div>';
    }

    /* ---- the way back: from the newest block to block zero, by height, hash or date, by the slider, or cube by cube */
    function msg(t) { $('.bx-msg').textContent = t || ''; }
    function busy(on) { $('.bx-tm').classList.toggle('busy', !!on); }
    function fail() { msg(L('اتصال به شبکه برقرار نشد؛ کمی بعد دوباره امتحان کنید.', 'پەیوەندی بە تۆڕەکەوە نەکرا؛ دواتر هەوڵ بدەرەوە.', 'Could not reach the network; try again in a moment.')); }
    function pos() { var l = shown(), b = sel && l.filter(function (x) { return x.id === sel; })[0]; return b || (view ? l.filter(function (x) { return x.height === view.at; })[0] || l[0] : null); }
    function tmFill() {
      var tm = $('.bx-tm'), inp = tm.querySelector('.bx-find input'), rg = tm.querySelector('input[type=range]'), b = pos();
      inp.placeholder = L('شمارهٔ بلاک، هش بلاک یا تاریخ (مثل 2010-05-22 یا 1389/03/01)', 'ژمارەی بلۆک، هاشی بلۆک یان بەروار (وەک 2010-05-22)', 'Block height, block hash or a date (e.g. 2010-05-22)');
      inp.setAttribute('aria-label', L('جست‌وجوی بلاک', 'گەڕان بەدوای بلۆکدا', 'Find a block'));
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
      if (!tip) return fail(); h = Math.max(0, Math.min(tip, h)); var me = ++rq; busy(true); msg('');
      return getJSON(MP + '/v1/blocks/' + Math.min(tip, h + 3), 12000).then(function (a) {
        if (me !== rq || !alive) return; if (!a || !a.length) throw 0;
        var l = a.map(norm), t = l.filter(function (x) { return id ? x.id === id : x.height === h; })[0] || l[0];
        view = { list: l }; sel = t.id; busy(false); belt(); center(sel); return true;
      }).catch(function () { if (me === rq && alive) { busy(false); fail(); } });
    }
    function goLive() { rq++; busy(false); msg(''); view = null; sel = null; belt(); center(null); }
    function older() {
      var l = shown(), low = l[l.length - 1].height; if (low <= 0 || !tip) return; var me = ++rq; busy(true); msg('');
      getJSON(MP + '/v1/blocks/' + (low - 1), 12000).then(function (a) {
        if (me !== rq || !alive) return; if (!a || !a.length) throw 0; var add = a.map(norm).filter(function (x) { return x.height < low; }); if (!add.length) throw 0;
        var base = view ? view.list : (D.blocks || []).filter(function (x) { return x.height >= low; });
        view = { list: base.concat(add).slice(-240), at: add[0].height }; sel = null; busy(false); belt(); center(add[Math.min(2, add.length - 1)].id);
      }).catch(function () { if (me === rq && alive) { busy(false); fail(); } });
    }
    function j2g(jy, jm, jd) {   /* a Solar Hijri date to the Gregorian one */
      jy += 1595; var days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor((jy % 33 + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186), gy = 400 * Math.floor(days / 146097); days %= 146097;
      if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
      gy += 4 * Math.floor(days / 1461); days %= 1461; if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
      var gd = days + 1, ml = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], gm = 1;
      for (; gm <= 12 && gd > ml[gm]; gm++) gd -= ml[gm]; return [gy, gm, gd];
    }
    function find(q) {
      q = String(q || '').replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 1776; }).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).trim();
      var n = q.replace(/[,٬،\s#]/g, ''), m;
      if (!q) return; if (!tip) return fail();
      if (/^\d{1,8}$/.test(n)) { if (+n > tip) return msg(L('هنوز چنین بلاکی ساخته نشده؛ آخرین بلاک ' + N(tip) + ' است.', 'ئەم بلۆکە هێشتا دروست نەکراوە؛ دوایین بلۆک ' + N(tip) + 'ە.', 'That block does not exist yet; the latest one is ' + N(tip) + '.')); return show(+n); }
      if (/^[0-9a-f]{64}$/i.test(n)) {
        var me = ++rq; busy(true); msg('');
        return getJSON(MP + '/v1/block/' + n.toLowerCase(), 12000).then(function (b) { if (me !== rq || !alive) return; if (!b || b.height == null) throw 0; show(b.height, b.id); })
          .catch(function () { if (me === rq && alive) { busy(false); msg(L('بلاکی با این هش پیدا نشد. (شناسهٔ تراکنش این‌جا جست‌وجو نمی‌شود.)', 'هیچ بلۆکێک بەم هاشە نەدۆزرایەوە. (ناسنامەی مامەڵە لێرە ناگەڕێندرێت.)', 'No block with this hash. (Transaction ids are not searched here.)')); } });
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
      msg(L('شمارهٔ بلاک (مثل 170)، هش ۶۴ کاراکتری بلاک، یا تاریخ به شکل 2010-05-22 یا 1389/03/01 بنویسید.', 'ژمارەی بلۆک (وەک 170)، هاشی ٦٤ پیتیی بلۆک، یان بەروار بە شێوەی 2010-05-22 بنووسە.', 'Type a block height (e.g. 170), a 64-character block hash, or a date as 2010-05-22.'));
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
    function render() { if (!alive) return; hudFill(); belt(); grid(); lines(); }

    /* ---- data */
    function live() {
      if (!alive || d.hidden) return;
      Promise.all([getJSON(MP + '/v1/blocks'), getJSON(MP + '/mempool'), getJSON(MP + '/v1/fees/mempool-blocks'), getJSON(MP + '/v1/fees/recommended'), getJSON(MP + '/v1/difficulty-adjustment')]).then(function (r) {
        if (!alive || !Array.isArray(r[0]) || !r[0].length) throw new Error('shape');
        D.blocks = r[0].slice(0, 15).map(norm);
        if (r[0][0].extras && r[0][0].extras.utxoSetSize) D.utxo = r[0][0].extras.utxoSetSize;
        D.mempool = { count: r[1].count, vsize: r[1].vsize, total_fee: r[1].total_fee };
        D.next = (r[2] || []).slice(0, 4).map(function (m) { var fr = m.feeRange || []; return { nTx: m.nTx, vsize: m.blockVSize, totalFees: m.totalFees, medianFee: m.medianFee, feeRange: fr.length ? [fr[0], fr[fr.length - 1]] : null }; });
        D.fees = r[3]; D.adj = r[4];
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
      if (D.blocks) { setState('snap'); render(); } else setState('load');
      live(); slow();
    });
    setState('load');
    timers.push(setInterval(live, 30000)); timers.push(setInterval(slow, 600000));
    timers.push(setInterval(function () {   /* clocks and "ago" labels tick without re-rendering */
      [].forEach.call(root.querySelectorAll('[data-clock]'), function (e) { e.textContent = clock(+e.getAttribute('data-clock')); });
      if (Date.now() % 15000 < 1000) [].forEach.call(root.querySelectorAll('[data-ago]'), function (e) { e.textContent = ago(+e.getAttribute('data-ago')); });
    }, 1000));
    timers.push(setInterval(function () { var v = px(); if (v && v !== price) { price = v; hudFill(); grid(); } }, 5000));
    probe = d.querySelector('b[data-btc-probe]');
    if (!probe) { probe = d.createElement('b'); probe.setAttribute('data-live', 'BTC'); probe.setAttribute('data-btc-probe', ''); probe.hidden = true; d.body.appendChild(probe); if (w.liveRefresh) w.liveRefresh(); }
    root.addEventListener('click', function (e) {
      var g = e.target.closest && e.target.closest('[data-go]'), b = !g && e.target.closest && e.target.closest('.bx-b[data-id]');
      if (g) { var v = g.getAttribute('data-go'); if (v === 'live') goLive(); else if (v === 'older') older(); else show(+v); return; }
      if (!b) return; sel = sel === b.getAttribute('data-id') ? null : b.getAttribute('data-id'); belt();
    });
    root.addEventListener('submit', function (e) { e.preventDefault(); var i = e.target.querySelector('input'); if (i) find(i.value); });
    root.addEventListener('input', function (e) { if (e.target.type === 'range') { drag = true; read(+e.target.value, null); } });
    root.addEventListener('change', function (e) { if (e.target.type === 'range') { drag = false; var v = +e.target.value; if (v >= tip) goLive(); else show(v); } });
    var rs = 0, onRs = function () { clearTimeout(rs); rs = setTimeout(lines, 120); }; w.addEventListener('resize', onRs);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(lines);
    /* the coin in the middle: the real one where the browser can draw it, the still one otherwise */
    function startCoin() {
      if (!alive || !w.nxCoin) return;
      try { coin = w.nxCoin(core.querySelector('canvas'), { yaw: .4, spin: .3, embers: 26, dpr: 1.5, eye: [0, .7, 6.4], area: hud, onready: function () { core.classList.add('gl'); }, onlost: function () { core.classList.remove('gl'); coin = null; } }); } catch (e) { coin = null; }
    }
    if ('IntersectionObserver' in w) { var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); startCoin(); } }, { rootMargin: '200px' }); io.observe(hud); } else startCoin();
    return { stop: function () { alive = false; timers.forEach(clearInterval); w.removeEventListener('resize', onRs); if (coin) coin.destroy(); root.innerHTML = ''; } };
  }
  w.btcLive = btcLive;
})();
