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

    /* ---- blocks: the queue on one side of "now", the chain on the other */
    function cube(o, mined, i) {
      var fr = o.feeRange, mb = (mined ? o.size : o.vsize) / 1e6;
      var inner = '<span class="f">~' + N(o.medianFee, o.medianFee < 10 ? 1 : 0) + ' <small>sat/vB</small></span>' + (fr ? '<span class="r">' + N(fr[0], fr[0] < 10 ? 1 : 0) + ' – ' + N(fr[1]) + '</span>' : '') +
        '<b>' + mb.toFixed(2) + ' MB</b><span class="x">' + N(mined ? o.tx_count : o.nTx) + ' tx</span>';
      if (mined) return '<button type="button" class="bx-b' + (sel === o.id ? ' sel' : '') + '" data-id="' + o.id + '" aria-label="' + L('بلاک ', 'بلۆکی ', 'Block ') + o.height + '">' + inner + '<span class="a" dir="auto" data-ago="' + o.timestamp + '">' + esc(ago(o.timestamp)) + '</span><em>' + N(o.height) + '</em>' + (o.pool ? '<cite>' + esc(o.pool) + '</cite>' : '') + '</button>';
      return '<div class="bx-b q" style="--fill:' + Math.min(100, mb * 100).toFixed(0) + '%">' + inner + '<span class="a" dir="auto">' + L('حدود ' + (i + 1) * 10 + ' دقیقهٔ دیگر', 'نزیکەی ' + (i + 1) * 10 + ' خولەکی تر', 'in ~' + (i + 1) * 10 + ' min') + '</span></div>';
    }
    function belt() {
      var bl = (D.blocks || []).slice(0, 8), nx = (D.next || []).slice(0, 3); if (!bl.length) return;
      $('.bx-now span').textContent = L('اکنون', 'ئێستا', 'now');
      $('.bx-q').innerHTML = nx.map(function (o, i) { return cube(o, false, i); }).join('');
      $('.bx-m').innerHTML = bl.map(function (o, i) { return cube(o, true, i); }).join('');
      if (lastTip && bl[0].height > lastTip && !RM) { var f = $('.bx-m .bx-b'); if (f) f.classList.add('new'); if (coin) coin.pulse(); }
      lastTip = bl[0].height; detail();
    }
    function detail() {
      var box = $('.bx-det'), b = sel && (D.blocks || []).filter(function (x) { return x.id === sel; })[0];
      if (!b) { box.hidden = true; return; }
      var p = px(), fees = b.totalFees != null ? b.totalFees / 1e8 : null, rw = b.reward != null ? b.reward / 1e8 : null;
      function f(lab, val) { return val == null ? '' : '<div><small>' + lab + '</small><b>' + val + '</b></div>'; }
      box.hidden = false;
      box.innerHTML = '<h4>' + L('بلاک ', 'بلۆکی ', 'Block ') + N(b.height) + '</h4><a href="https://mempool.space/block/' + b.id + '" target="_blank" rel="noopener">' + b.id + '</a><div class="bx-dl">' +
        f(L('زمان ثبت', 'کاتی تۆمارکردن', 'Mined at'), esc(new Date(b.timestamp * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }))) +
        f(L('تراکنش', 'مامەڵە', 'Transactions'), N(b.tx_count)) + f(L('حجم', 'قەبارە', 'Size'), (b.size / 1e6).toFixed(2) + ' MB' + (b.weight ? ' · ' + (b.weight / 1e6).toFixed(2) + ' MWU' : '')) +
        f(L('پاداش ماینر', 'پاداشتی ماینەر', 'Miner reward'), rw != null ? rw.toFixed(4) + ' BTC' + (p ? ' · ' + usd(rw * p) : '') : null) +
        f(L('مجموع کارمزدها', 'کۆی کرێکان', 'Total fees'), fees != null ? fees.toFixed(4) + ' BTC' + (rw ? ' · ' + (fees / rw * 100).toFixed(1) + '%' : '') : null) +
        f(L('کارمزد میانه', 'کرێی ناوەند', 'Median fee'), b.medianFee != null ? N(b.medianFee, 1) + ' sat/vB' : null) + f(L('بازهٔ کارمزد', 'مەودای کرێ', 'Fee range'), b.feeRange ? N(b.feeRange[0], 1) + ' – ' + N(b.feeRange[1]) + ' sat/vB' : null) +
        f(L('استخر', 'حەوز', 'Pool'), b.pool ? esc(b.pool) : null) + '</div>';
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
        D.blocks = r[0].slice(0, 12).map(function (b) { var x = b.extras || {}, fr = x.feeRange || []; return { id: b.id, height: b.height, timestamp: b.timestamp, tx_count: b.tx_count, size: b.size, weight: b.weight, reward: x.reward, totalFees: x.totalFees, medianFee: x.medianFee, feeRange: fr.length ? [fr[0], fr[fr.length - 1]] : null, pool: (x.pool || {}).name }; });
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
    root.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.bx-b[data-id]'); if (!b) return; sel = sel === b.getAttribute('data-id') ? null : b.getAttribute('data-id'); belt(); });
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
