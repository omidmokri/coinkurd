/* CRYPTO MASTER ACADEMY — client engine (entekhab.net/academy/)
   Progress lives only in this browser (localStorage 'ek_academy'); nothing is sent anywhere.
   Pages: home · faculty · lesson · me (dashboard) · review (spaced repetition) · placement · glossary · lab (see academy-lab.js) */
(function () {
  'use strict';
  var K = 'ek_academy', DAY = 864e5;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
  function pct(x) { return fa(Math.round(x * 100)) + '٪'; }
  function today(t) { var d = new Date(t || Date.now()); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fdate(t) { try { return new Date(t).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return today(t); } }
  function json(id) { var el = document.getElementById(id); if (!el) return null; try { return JSON.parse(el.textContent); } catch (e) { return null; } }

  // ------------------------------------------------------------ state
  var S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(K) || '{}') || {}; } catch (e) { S = {}; }
    S.v = 1; S.L = S.L || {}; S.F = S.F || {}; S.srs = S.srs || {}; S.wrong = S.wrong || {}; S.days = S.days || {};
    S.badges = S.badges || {}; S.xp = S.xp || 0; S.created = S.created || Date.now(); S.log = S.log || [];
  }
  function save() { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { } }
  load();
  var M = json('acMap') || { facs: [], lessons: [], pass: 0.8, levels: [] };
  var PASS = M.pass || 0.8;
  var LS = {}; M.lessons.forEach(function (l, i) { l.ix = i; LS[l.id] = l; });
  var FS = {}; M.facs.forEach(function (f) { FS[f.id] = f; });

  function lst(lid) { return S.L[lid] || (S.L[lid] = {}); }
  function fst(fid) { return S.F[fid] || (S.F[fid] = {}); }
  function act(kind, extra) {
    var d = today(); S.days[d] = (S.days[d] || 0) + 1;
    S.log.push({ t: Date.now(), k: kind, x: extra || '' }); if (S.log.length > 400) S.log = S.log.slice(-400);
  }
  function addXP(n) { S.xp = (S.xp || 0) + n; }
  function mastered(lid) { return !!(S.L[lid] && S.L[lid].pass); }
  function facPassed(fid) { return !!(S.F[fid] && S.F[fid].pass); }
  function facDone(fid) { return facPassed(fid) || !!(S.F[fid] && S.F[fid].credit); }
  function facComplete(fid) { var f = S.F[fid]; return !!(f && f.pass && f.proj && f.proj.done); }
  function facOpen(fid) {
    var f = FS[fid]; if (!f) return false; if (f.n === 1 || (S.F[fid] && S.F[fid].credit)) return true;
    var prev = M.facs.filter(function (x) { return x.n === f.n - 1; })[0];
    return !!prev && facDone(prev.id);
  }
  function missingPre(lid) {
    var l = LS[lid]; if (!l) return [];
    return (l.pre || []).filter(function (p) { var pl = LS[p]; return !(mastered(p) || (pl && facDone(pl.f))); });
  }
  function lessonOpen(lid) { var l = LS[lid]; return !!l && facOpen(l.f) && missingPre(lid).length === 0; }
  function nextLesson() {
    for (var i = 0; i < M.lessons.length; i++) { var l = M.lessons[i]; if (!mastered(l.id) && !facDone(l.f) && lessonOpen(l.id)) return l; }
    for (i = 0; i < M.lessons.length; i++) { l = M.lessons[i]; if (!mastered(l.id) && lessonOpen(l.id)) return l; }
    return null;
  }
  function evidenceLevel() {
    var p = M.facs.filter(function (f) { return facPassed(f.id); }).length, c = M.facs.filter(function (f) { return facComplete(f.id); }).length;
    if (c >= 12) return 6; if (p >= 8) return 5; if (p >= 5) return 4; if (p >= 3) return 3; if (p >= 1) return 2; return 1;
  }
  function level() {
    var x = 1; (M.levels || []).forEach(function (L) { if (S.xp >= L.xp) x = Math.max(x, L.n); });
    var n = Math.min(x, evidenceLevel()); return (M.levels || [])[n - 1] || { n: 1, fa: 'مبتدی', en: 'Beginner' };
  }
  function srsKey(lid, i) { return lid + ':' + i; }
  var BOX = [0, 1, 3, 7, 16, 35];
  function srsRight(k) { var r = S.srs[k] || { b: 0 }; r.b = Math.min((r.b || 0) + 1, BOX.length - 1); r.d = Date.now() + BOX[r.b] * DAY; S.srs[k] = r; }
  function srsWrong(k) { S.srs[k] = { b: 0, d: Date.now() }; S.wrong[k] = (S.wrong[k] || 0) + 1; }
  function dueCount() { var n = 0, t = Date.now(); for (var k in S.srs) if (S.srs[k].d <= t) n++; return n; }

  // badges: earned from evidence only
  var BADGES = [
    ['first', '🌱 اولین قدم', 'اولین آزمون درس را قبول شدید', function () { return M.lessons.some(function (l) { return mastered(l.id); }); }],
    ['perfect', '💯 بی‌نقص', 'یک آزمون درس را با ۵ از ۵ قبول شدید', function () { return M.lessons.some(function (l) { return S.L[l.id] && S.L[l.id].best === 1; }); }],
    ['hands', '🛠 اهل عمل', '۵ تمرین عملی را انجام دادید', function () { return M.lessons.filter(function (l) { return S.L[l.id] && S.L[l.id].ex; }).length >= 5; }],
    ['writer', '✍️ تحلیل‌نویس', '۳ پرسش تشریحی را با همهٔ معیارها کامل کردید', function () { return M.lessons.filter(function (l) { return S.L[l.id] && S.L[l.id].essayDone; }).length >= 3; }],
    ['review', '🔁 حافظهٔ بلندمدت', '۲۰ سؤال مرور را درست پاسخ دادید', function () { return (S.revOk || 0) >= 20; }],
    ['streak', '🔥 پیوستگی', '۷ روز پشت‌سرهم فعالیت', function () { return streak() >= 7; }],
    ['f1', '💵 اقتصاددان', 'آزمون جامع دانشکدهٔ ۱', function () { return facPassed('f1'); }],
    ['f2', '⛓ بلاک‌چین‌شناس', 'آزمون جامع دانشکدهٔ ۲', function () { return facPassed('f2'); }],
    ['f3', '🪙 پروژه‌شناس', 'آزمون جامع دانشکدهٔ ۳', function () { return facPassed('f3'); }],
    ['f4', '🔐 نگهبان دارایی', 'آزمون جامع دانشکدهٔ ۴', function () { return facPassed('f4'); }],
    ['sim', '🧪 معامله‌گر آزمایشی', '۲۰ معامله در شبیه‌ساز (پول مجازی)', function () { return labTrades() >= 20; }]
  ];
  function labTrades() { try { var x = JSON.parse(localStorage.getItem('ek_acad_lab') || '{}'); return (x.journal || []).filter(function (j) { return j.src === 'sim'; }).length; } catch (e) { return 0; } }
  function streak() { var n = 0, t = Date.now(); if (!S.days[today(t)]) t -= DAY; while (S.days[today(t)]) { n++; t -= DAY; } return n; }
  function checkBadges() { var nw = []; BADGES.forEach(function (b) { if (!S.badges[b[0]] && b[3]()) { S.badges[b[0]] = Date.now(); nw.push(b); } }); return nw; }
  function toast(msg) {
    var t = document.createElement('div'); t.setAttribute('role', 'status');
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--acc);color:#000;padding:10px 18px;border-radius:12px;font-weight:700;z-index:200;max-width:90vw;box-shadow:0 6px 20px rgba(0,0,0,.4)';
    t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3800);
  }
  function commit() { var nb = checkBadges(); save(); nb.forEach(function (b) { toast('نشان جدید: ' + b[1]); }); topDue(); }

  // ------------------------------------------------------------ shared UI
  document.documentElement.classList.add('ac-js');
  function topDue() { var n = dueCount(); $$('.ac-due').forEach(function (b) { b.hidden = !n; b.textContent = fa(n); }); }
  topDue();
  var th = $('#acTheme');
  if (th) th.onclick = function () { var cur = document.documentElement.dataset.acTheme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.acTheme = cur; S.theme = cur; save(); };

  /* generic multiple-choice quiz.
     qs: [{q,o,a,why,sec,k,key,t,u}] · opt: {pass, onDone(score, details), btn, retry} */
  function quiz(box, qs, opt) {
    opt = opt || {};
    var KIND = { scenario: 'سناریو', calc: 'محاسبه', mcq: 'مفهومی' };
    var html = qs.map(function (q, qi) {
      var order = shuffle(q.o.map(function (_, i) { return i; }));
      q._ord = order;
      return '<div class="ac-q" data-qi="' + qi + '"><p>' + fa(qi + 1) + '. ' + esc(q.q) + (q.k && KIND[q.k] ? '<span class="ac-kind">' + KIND[q.k] + '</span>' : '') +
        (q.t && opt.showLesson ? '<span class="ac-kind">' + esc(q.t) + '</span>' : '') + '</p>' +
        order.map(function (oi) { return '<label class="ac-opt"><input type="radio" name="q' + qi + '_' + box.id + '" value="' + oi + '"> <span>' + esc(q.o[oi]) + '</span></label>'; }).join('') +
        '<div class="ac-why"></div></div>';
    }).join('');
    box.innerHTML = html + '<p class="ac-row"><button class="ac-btn" type="button" data-sub>' + (opt.btn || 'ثبت پاسخ‌ها و تصحیح') + '</button><span class="lab-msg" data-msg></span></p><div data-res></div>';
    $('[data-sub]', box).onclick = function () {
      var ans = qs.map(function (q, qi) { var c = $('.ac-q[data-qi="' + qi + '"] input:checked', box); return c ? +c.value : null; });
      var miss = ans.filter(function (a) { return a === null; }).length;
      if (miss) { $('[data-msg]', box).textContent = fa(miss) + ' سؤال بی‌پاسخ مانده است.'; return; }
      var sc = 0, det = [];
      qs.forEach(function (q, qi) {
        var el = $('.ac-q[data-qi="' + qi + '"]', box), ok = ans[qi] === q.a; if (ok) sc++;
        det.push({ q: q, ok: ok, pick: ans[qi] });
        el.classList.add('done', ok ? 'ok' : 'no');
        $$('.ac-opt', el).forEach(function (lb) { var v = +$('input', lb).value; lb.classList.toggle('right', v === q.a); lb.classList.toggle('wrong', v === ans[qi] && !ok); $('input', lb).disabled = true; });
        $('.ac-why', el).innerHTML = (ok ? '✅ درست. ' : '❌ پاسخ درست: «' + esc(q.o[q.a]) + '». ') + esc(q.why) +
          (q.u ? ' <a href="' + esc(q.u) + '">مرور درس</a>' : '');
      });
      this.disabled = true; $('[data-msg]', box).textContent = '';
      var r = sc / qs.length, res = $('[data-res]', box), neutral = opt.pass === 0, passed = r >= (opt.pass != null ? opt.pass : PASS);
      res.innerHTML = '<div class="ac-res ' + (neutral ? '' : passed ? 'ok' : 'no') + '"><h3>' + (neutral ? '📋 نتیجه' : passed ? '✅ قبول' : '↻ هنوز به حدنصاب نرسیده') + ' — ' + fa(sc) + ' از ' + fa(qs.length) + ' (' + pct(r) + ')</h3><div data-extra></div></div>';
      if (opt.onDone) opt.onDone(sc, det, $('[data-extra]', res), passed);
      if (opt.retry) {
        var b = document.createElement('button'); b.className = 'ac-btn ghost'; b.type = 'button'; b.textContent = passed ? 'آزمون دوباره برای تمرین' : 'آزمون دوباره با سؤال‌های تازه';
        b.onclick = function () { opt.retry(); box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; $('[data-extra]', res).appendChild(b);
      }
      res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }

  function lockBox(msg) { var b = $('#acLock'); if (b) { b.hidden = false; b.innerHTML = '🔒 ' + msg; } }
  function facLockMsg(fid) {
    var f = FS[fid], prev = M.facs.filter(function (x) { return x.n === f.n - 1; })[0];
    return 'این دانشکده بعد از قبولی در آزمون جامع <a href="/academy/' + prev.id + '/#exam">دانشکدهٔ ' + fa(prev.n) + ' (' + esc(prev.t) + ')</a> باز می‌شود. ' +
      'اگر این مطالب را از قبل بلدید، از <a href="/academy/placement/">آزمون تعیین سطح</a> استفاده کنید. می‌توانید متن درس‌ها را بخوانید، اما آزمون‌ها قفل‌اند.';
  }

  // ------------------------------------------------------------ certificate
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ('0000000' + (h >>> 0).toString(16)).slice(-8).toUpperCase(); }
  function certificate(box, fid) {
    var f = FS[fid], st = S.F[fid];
    box.innerHTML = '<p><input class="ac-in" id="acCn" maxlength="40" placeholder="نام شما روی گواهی" value="' + esc(S.name || '') + '" style="max-width:320px"> ' +
      '<button class="ac-btn" type="button" id="acCm">🏅 ساخت گواهی</button></p><div id="acCo"></div>';
    $('#acCm').onclick = function () {
      var n = ($('#acCn').value || '').trim().slice(0, 40); if (!n) { $('#acCn').focus(); return; }
      S.name = n; save();
      var cv = document.createElement('canvas'); cv.width = 1600; cv.height = 1130; var x = cv.getContext('2d');
      var g = x.createLinearGradient(0, 0, 1600, 1130); g.addColorStop(0, '#1a1006'); g.addColorStop(.5, '#0b0c0f'); g.addColorStop(1, '#071018');
      x.fillStyle = g; x.fillRect(0, 0, 1600, 1130); x.strokeStyle = '#f7931a'; x.lineWidth = 6; x.strokeRect(40, 40, 1520, 1050);
      x.strokeStyle = 'rgba(247,147,26,.35)'; x.lineWidth = 2; x.strokeRect(62, 62, 1476, 1006);
      var d = st.passAt || Date.now(), code = hash(n + '|' + fid + '|' + today(d) + '|' + Math.round((st.exam || 0) * 100));
      var img = new Image(); img.onload = function () { var h = 200, w = img.width * h / img.height; x.drawImage(img, 800 - w / 2, 95, w, h); fin(); }; img.onerror = fin; img.src = '/assets/logo-hero.webp';
      function fin() {
        x.textAlign = 'center'; x.direction = 'rtl';
        x.fillStyle = '#f7931a'; x.font = '700 34px "Space Grotesk",sans-serif'; x.fillText('CRYPTO MASTER ACADEMY', 800, 350);
        x.font = '800 48px Vazirmatn,Tahoma,sans-serif'; x.fillText('گواهی پایان دانشکدهٔ ' + fa(f.n) + ': ' + f.t, 800, 425);
        x.fillStyle = '#cfcfcf'; x.font = '400 32px Vazirmatn,Tahoma,sans-serif'; x.fillText('بدین‌وسیله گواهی می‌شود که', 800, 500);
        x.fillStyle = '#fff'; x.font = '900 72px Vazirmatn,Tahoma,sans-serif'; x.fillText(n, 800, 600);
        x.fillStyle = '#cfcfcf'; x.font = '400 30px Vazirmatn,Tahoma,sans-serif';
        x.fillText('همهٔ درس‌ها، آزمون جامع (' + pct(st.exam || 0) + ') و پروژهٔ عملی این دانشکده را با موفقیت گذرانده است', 800, 680);
        x.fillStyle = '#9a9a94'; x.font = '400 28px Vazirmatn,Tahoma,sans-serif'; x.fillText(fdate(d) + ' · کد: ' + code, 800, 760);
        x.fillStyle = '#f7931a'; x.font = '700 40px "Space Grotesk",sans-serif'; x.direction = 'ltr'; x.fillText('entekhab.net/academy', 800, 950);
        x.fillStyle = '#777'; x.font = '400 22px Vazirmatn,Tahoma,sans-serif'; x.direction = 'rtl'; x.fillText('گواهی آموزشی درون‌سامانه‌ای entekhab.net — مدرک رسمی نیست', 800, 1010);
        var o = $('#acCo'); o.innerHTML = ''; cv.style.cssText = 'width:100%;height:auto;border-radius:12px;margin-top:8px'; o.appendChild(cv);
        var a = document.createElement('a'); a.className = 'ac-btn'; a.style.marginTop = '10px'; a.download = 'entekhab-academy-' + fid + '.png'; a.href = cv.toDataURL('image/png'); a.textContent = '⬇ دانلود گواهی'; o.appendChild(a);
      }
    };
  }

  // ------------------------------------------------------------ tutor (offline retrieval over lesson text)
  var STOP = ('و در به از که این را با است برای یک آن می چه چیست چیه چطور چگونه یعنی هست های ها کند کنم کنیم شود شده بود باشد هم یا تا اگر ' +
    'ما من شما او آنها ایم اید اند نه نیست دارد داره دارم کرد کنید بگو بده توضیح لطفا لطفاً درباره مورد چرا کدام کجا وقتی چی رو اینکه آیا ' +
    'the a an of to is in and or what how why').split(' ');
  var STOPS = {}; STOP.forEach(function (w) { STOPS[w] = 1; });
  function norm(t) { return String(t || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[ً-ٰٟ]/g, '').replace(/‌/g, ' ').toLowerCase(); }
  function toks(t) { return norm(t).split(/[^a-z0-9؀-ۿ]+/).filter(function (w) { return w.length > 1 && !STOPS[w]; }); }
  var IDX = null, DF = {}, AVG = 1;
  function loadIdx() {
    if (IDX) return Promise.resolve(IDX);
    return fetch('/academy/data/index.json').then(function (r) { return r.json(); }).then(function (d) {
      var tot = 0; d.forEach(function (x) { x.tk = toks(x.x + ' ' + x.t); tot += x.tk.length; var seen = {}; x.tk.forEach(function (w) { if (!seen[w]) { seen[w] = 1; DF[w] = (DF[w] || 0) + 1; } }); });
      AVG = tot / Math.max(1, d.length); IDX = d; return d;
    });
  }
  function search(q, cur) {
    var qt = toks(q); if (!qt.length || !IDX) return [];
    var N = IDX.length;
    return IDX.map(function (x) {
      var s = 0;
      qt.forEach(function (w) {
        var tf = 0; x.tk.forEach(function (d) { if (d === w) tf += 1; else if (w.length >= 3 && d.length > w.length && d.indexOf(w) === 0) tf += 0.6; });
        if (!tf) return; var df = DF[w] || 1, idf = Math.log(1 + (N - df + .5) / (df + .5));
        s += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * x.tk.length / AVG));
      });
      if (x.term && qt.some(function (w) { return x.term.some(function (t) { return t === w || norm(t).split(/\s+/).indexOf(w) >= 0; }); })) s *= 2.2;
      if (cur && x.l === cur) s *= 1.5;
      return { x: x, s: s };
    }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; });
  }
  var SECN = { beginner: 'توضیح ساده', intermediate: 'توضیح متوسط', expert: 'توضیح تخصصی', example: 'مثال واقعی', key: 'نکات کلیدی', mistakes: 'اشتباهات رایج', term: 'واژگان' };
  function cut(t, n) { return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; }

  function tutor(lid, bank) {
    var chat = $('#acChat'); if (!chat) return;
    function say(html, who) { var d = document.createElement('div'); d.className = 'ac-msg ' + (who || 'bot'); d.innerHTML = html; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d; }
    say('<p>سلام! من دستیار همین درس هستم. سؤالتان را بپرسید تا پاسخ را از متن درس‌های آکادمی پیدا کنم و منبعش را نشان دهم. یا از دکمه‌های زیر استفاده کنید.</p>');
    function answer(q) {
      say(esc(q), 'me');
      var wait = say('<p>در حال جست‌وجو در درس‌ها…</p>');
      loadIdx().then(function () {
        var r = search(q, lid), out = [], used = {};
        if (!r.length || r[0].s < 1.2) {
          wait.innerHTML = '<p>پاسخ مطمئنی در متن درس‌های منتشرشده پیدا نکردم و حدس نمی‌زنم. سؤال را با واژهٔ کلیدی دیگری بپرسید (مثلاً «هش»، «کیف پول سرد»، «ارزش بازار») یا <a href="/academy/glossary/">بانک اصطلاحات</a> را ببینید.</p>';
          return;
        }
        r.forEach(function (h) { var k = h.x.l + h.x.s; if (out.length < 3 && !used[k] && h.s >= r[0].s * 0.45) { used[k] = 1; out.push(h.x); } });
        wait.innerHTML = out.map(function (x) {
          return '<p>' + esc(cut(x.x, 520)) + '</p><small>منبع: <a href="' + esc(x.u) + '">' + esc(x.t) + ' › ' + (SECN[x.s] || '') + '</a></small>';
        }).join('<hr style="border:0;border-top:1px solid var(--line);margin:8px 0">');
        S.asked = (S.asked || 0) + 1; save();
      }).catch(function () { wait.innerHTML = '<p>نمایهٔ درس‌ها بارگذاری نشد. اتصال را بررسی کنید و دوباره بپرسید.</p>'; });
    }
    $('#acAsk').addEventListener('submit', function (ev) { ev.preventDefault(); var q = $('#acQ').value.trim(); if (q) { answer(q); $('#acQ').value = ''; } });
    $$('[data-tq]').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.tq;
        if (k === 'simple') { var p = $('#beginner p'); say('ساده‌تر توضیح بده', 'me'); say('<p>' + esc(p ? p.textContent : '') + '</p><small><a href="#beginner" data-go="beginner">ادامهٔ توضیح ساده</a></small>'); }
        else if (k === 'example') { var h = $('#example h2'), q = $('#example p'); say('مثال بزن', 'me'); say('<p><b>' + esc(h ? h.textContent.replace('🌍 ', '') : '') + '</b></p><p>' + esc(q ? cut(q.textContent, 600) : '') + '</p><small><a href="#example">مثال کامل</a></small>'); }
        else if (k === 'weak') {
          say('نقطهٔ ضعف من چیست؟', 'me'); var w = {}, n = 0;
          bank.forEach(function (q, i) { var c = S.wrong[srsKey(lid, i)] || 0; if (c) { w[q.sec] = (w[q.sec] || 0) + c; n += c; } });
          var ks = Object.keys(w).sort(function (a, b) { return w[b] - w[a]; });
          say(n ? '<p>بیشترین پاسخ نادرست شما در این درس مربوط به این بخش‌ها بوده است:</p><p>' + ks.map(function (s) { return '<a href="#' + s + '" data-go="' + s + '">' + SECN[s] + '</a> (' + fa(w[s]) + ' خطا)'; }).join(' · ') + '</p><p>همان بخش را دوباره بخوانید و سپس آزمون را تکرار کنید.</p>'
            : '<p>هنوز در آزمون این درس خطایی ثبت نشده است. بعد از اولین آزمون، نقاط ضعفتان را اینجا نشان می‌دهم.</p>');
        }
        else if (k === 'quizme') {
          say('از من سؤال بپرس', 'me');
          var i = Math.floor(Math.random() * bank.length), q2 = bank[i], d = say('');
          var box = document.createElement('div'); box.id = 'tq' + Date.now(); d.appendChild(box);
          quiz(box, [Object.assign({}, q2)], { btn: 'بررسی', onDone: function (sc) { var key = srsKey(lid, i); if (sc) srsRight(key); else srsWrong(key); act('tutor'); commit(); } });
        }
      };
    });
  }

  // ------------------------------------------------------------ pages
  var root = $('#ac'); if (!root) return;
  var page = root.dataset.page;

  function goTab(k) {
    $$('.ac-tab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === k); t.setAttribute('aria-selected', t.dataset.tab === k); });
    $$('.ac-pane').forEach(function (p) { p.classList.toggle('on', p.dataset.pane === k); });
  }

  if (page === 'lesson') (function () {
    var lid = root.dataset.lid, fid = root.dataset.fid, bank = json('acQ0') || [], st = lst(lid);
    var tabs = ['beginner', 'intermediate', 'expert'];
    st.seen = st.seen || {};
    function showTab(k) { goTab(k); st.seen[k] = 1; S.pref = k; $$('.ac-tab').forEach(function (t) { t.classList.toggle('seen', !!st.seen[t.dataset.tab]); }); save(); }
    $$('.ac-tab').forEach(function (t) { t.onclick = function () { showTab(t.dataset.tab); }; });
    var h0 = location.hash.slice(1);
    showTab(tabs.indexOf(h0) >= 0 ? h0 : (S.pref && tabs.indexOf(S.pref) >= 0 ? S.pref : 'beginner'));
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest('a[href^="#"]'); if (!a) return; var k = a.getAttribute('href').slice(1);
      if (tabs.indexOf(k) >= 0) { ev.preventDefault(); showTab(k); var el = document.getElementById(k); if (el) el.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', '#' + k); }
    });
    S.last = { lid: lid, t: Date.now() }; save();
    // prerequisites
    $$('.ac-pre').forEach(function (a) { a.classList.toggle('ok', mastered(a.dataset.pre)); });
    var open = lessonOpen(lid);
    function state() {
      var s = $('#acState'); if (!s) return;
      if (st.pass) { s.textContent = '✅ تسلط: ' + pct(st.best || 0); s.classList.add('ok'); }
      else if (st.att) { s.textContent = 'بهترین نمره: ' + pct(st.best || 0) + ' · ' + fa(st.att) + ' تلاش'; }
    }
    state();
    if (!open) {
      if (!facOpen(fid)) lockBox(facLockMsg(fid));
      else lockBox('برای باز شدن آزمون این درس، ابتدا در آزمون این درس‌ها قبول شوید: ' + missingPre(lid).map(function (p) { return '<a href="' + LS[p].u + '">' + esc(LS[p].t) + '</a>'; }).join('، ') + '. متن درس برای مطالعه باز است.');
    }
    // exercise
    var ex = $('#acEx'); if (ex) { ex.checked = !!st.ex; ex.onchange = function () { if (ex.checked && !st.ex) { addXP(50); act('exercise', lid); } st.ex = ex.checked; commit(); }; }
    // adaptive quiz
    var qbox = $('#acQuiz');
    function pick() {
      var idx = bank.map(function (_, i) { return i; });
      var wrong = shuffle(idx.filter(function (i) { return S.wrong[srsKey(lid, i)] && !(S.srs[srsKey(lid, i)] && S.srs[srsKey(lid, i)].b > 1); })).slice(0, 2);
      var seen = st.seenQ || {};
      var fresh = shuffle(idx.filter(function (i) { return wrong.indexOf(i) < 0 && !seen[i]; }));
      var rest = shuffle(idx.filter(function (i) { return wrong.indexOf(i) < 0 && seen[i]; }));
      return wrong.concat(fresh, rest).slice(0, 5);
    }
    function run() {
      if (!open) { qbox.innerHTML = '<div class="ac-lock">🔒 آزمون این درس هنوز قفل است (پیش‌نیازها را در بالای صفحه ببینید).</div>'; return; }
      var ids = pick(), qs = ids.map(function (i) { return Object.assign({ _i: i }, bank[i]); });
      quiz(qbox, qs, {
        retry: run,
        onDone: function (sc, det, extra, passed) {
          var r = sc / qs.length; st.att = (st.att || 0) + 1; st.last = r; st.best = Math.max(st.best || 0, r); st.t = Date.now();
          st.seenQ = st.seenQ || {};
          det.forEach(function (d) { var k = srsKey(lid, d.q._i); st.seenQ[d.q._i] = 1; if (d.ok) { if (!S.srs[k]) srsRight(k); } else srsWrong(k); });
          if (passed && !st.pass) { st.pass = true; st.passAt = Date.now(); addXP(100); }
          addXP(sc * 4); act('quiz', lid + ':' + sc);
          var wrongSec = {}; det.forEach(function (d) { if (!d.ok) wrongSec[d.q.sec] = 1; });
          var secs = Object.keys(wrongSec);
          var html = '';
          if (passed) {
            var nx = nextLesson();
            html = '<p>این درس را با موفقیت گذراندید و در مرور هوشمند ثبت شد.</p>' + (nx ? '<p><a class="ac-btn" href="' + nx.u + '">درس بعد: ' + esc(nx.t) + '</a></p>' : '');
            if (secs.length) html += '<p class="note">برای تسلط کامل این بخش‌ها را مرور کنید: ' + secs.map(function (s) { return '<a href="#' + s + '">' + SECN[s] + '</a>'; }).join(' · ') + '</p>';
          } else {
            html = '<p><b>تحلیل اشتباه:</b> پاسخ‌های نادرست شما به این بخش‌ها برمی‌گردد. آن‌ها را دوباره بخوانید و بعد آزمون را تکرار کنید؛ سؤال‌های اشتباه دوباره در آزمون بعد می‌آیند.</p><p>' +
              secs.map(function (s) { return '<a class="ac-chip" href="#' + s + '">📖 ' + SECN[s] + '</a>'; }).join(' ') + '</p>' +
              '<p class="note">می‌توانید از دستیار پایین صفحه هم بپرسید یا دکمهٔ «ساده‌تر توضیح بده» را بزنید.</p>';
          }
          extra.innerHTML = html; state(); commit();
        }
      });
    }
    run();
    // essay
    var es = $('#acEssay'), out = $('#acEssayOut'), tmr;
    if (es) {
      es.value = st.essay || '';
      es.oninput = function () { clearTimeout(tmr); tmr = setTimeout(function () { st.essay = es.value.slice(0, 5000); save(); }, 400); };
      var rb = $$('.acRub'); st.rub = st.rub || {};
      function ev() {
        var all = rb.every(function (c) { return c.checked; }), long = (es.value || '').trim().length >= 80;
        if (all && long && !st.essayDone) { st.essayDone = true; addXP(30); act('essay', lid); }
        out.textContent = st.essayDone ? '✅ پرسش تشریحی کامل شد.' : (all && !long ? 'پاسخ شما برای این معیارها خیلی کوتاه است؛ دست‌کم چند جملهٔ کامل بنویسید.' : '');
        out.style.color = st.essayDone ? '' : 'var(--warn)'; commit();
      }
      rb.forEach(function (c) { c.checked = !!st.rub[c.dataset.i]; c.onchange = function () { st.rub[c.dataset.i] = c.checked; st.essay = es.value; ev(); }; });
      if (st.essayDone) out.textContent = '✅ پرسش تشریحی کامل شد.';
    }
    // toc highlight
    var toc = $$('.ac-toc a');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) toc.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + x.target.id); }); }); }, { rootMargin: '-40% 0px -55% 0px' });
      toc.forEach(function (a) { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) io.observe(t); });
    }
    tutor(lid, bank.map(function (q) { return Object.assign({}, q); }));
    commit();
  })();

  if (page === 'faculty') (function () {
    var fid = root.dataset.fid, f = FS[fid], fs = fst(fid);
    if (!f) return;
    if (!facOpen(fid)) lockBox(facLockMsg(fid));
    if (fs.credit && !fs.pass) { var lb = $('#acLock'); lb.hidden = false; lb.innerHTML = '🧭 این دانشکده با آزمون تعیین سطح «معاف» شده است. برای گواهی، آزمون جامع و پروژه را بگذرانید.'; }
    if (!f.live) return;
    var done = 0;
    $$('.ac-li').forEach(function (li) {
      var id = li.dataset.lid, s = S.L[id] || {};
      li.classList.toggle('ok', !!s.pass); li.classList.toggle('part', !s.pass && !!(s.att || s.seen)); li.classList.toggle('locked', !lessonOpen(id));
      $('.ac-sc', li).textContent = s.pass ? '✅ ' + pct(s.best) : (s.att ? pct(s.best || 0) : (lessonOpen(id) ? '' : '🔒'));
      if (s.pass) done++;
    });
    var tot = f.ls.length;
    $('#acFacBar').style.width = Math.round(done * 100 / tot) + '%';
    $('#acFacTxt').textContent = fa(done) + ' از ' + fa(tot) + ' درس با تسلط گذرانده شده' + (fs.pass ? ' · ✅ آزمون جامع قبول (' + pct(fs.exam) + ')' : '') + (fs.proj && fs.proj.done ? ' · ✅ پروژه ثبت شد' : '');
    // exam
    var bank = json('acBank') || [], eb = $('#acExam');
    function exam() {
      if (!facOpen(fid)) { eb.innerHTML = '<div class="ac-lock">🔒 ابتدا دانشکدهٔ قبلی را بگذرانید.</div>'; return; }
      if (done < tot && !fs.credit) { eb.innerHTML = '<div class="ac-lock">🔒 آزمون جامع بعد از تسلط بر همهٔ ' + fa(tot) + ' درس باز می‌شود (' + fa(done) + ' از ' + fa(tot) + ').</div>'; return; }
      var by = {}; bank.forEach(function (q) { (by[q.l] = by[q.l] || []).push(q); });
      var pickd = [], ks = Object.keys(by);
      ks.forEach(function (k) { pickd.push(shuffle(by[k])[0]); });
      var rest = shuffle(bank.filter(function (q) { return pickd.indexOf(q) < 0; }));
      pickd = shuffle(pickd.concat(rest).slice(0, 15)).map(function (q) { return Object.assign({ u: '/academy/' + fid + '/' + q.l + '/#' + q.sec }, q); });
      quiz(eb, pickd, {
        showLesson: true, retry: exam, onDone: function (sc, det, extra, passed) {
          var r = sc / pickd.length; fs.exam = Math.max(fs.exam || 0, r); fs.examAtt = (fs.examAtt || 0) + 1;
          det.forEach(function (d) { var k = srsKey(d.q.l, d.q.i); if (d.ok) { if (!S.srs[k]) srsRight(k); } else srsWrong(k); });
          if (passed && !fs.pass) { fs.pass = true; fs.passAt = Date.now(); addXP(300); }
          act('exam', fid + ':' + sc);
          var weak = {}; det.forEach(function (d) { if (!d.ok) weak[d.q.l] = d.q.t; });
          extra.innerHTML = passed ? '<p>تبریک! دانشکدهٔ بعد باز شد. برای گواهی، پروژهٔ عملی را هم ثبت کنید.</p>'
            : '<p><b>درس‌هایی که باید مرور شوند:</b></p><p>' + Object.keys(weak).map(function (l) { return '<a class="ac-chip" href="/academy/' + fid + '/' + l + '/">' + esc(weak[l]) + '</a>'; }).join(' ') + '</p>';
          commit(); certBox();
        }
      });
    }
    exam();
    // project
    var pt = $('#acProj'), pb = $('#acProjBtn'), po = $('#acProjOut'), pr = $$('.acPR');
    fs.proj = fs.proj || {}; fs.proj.checks = fs.proj.checks || {};
    if (pt) {
      pt.value = fs.proj.text || '';
      pr.forEach(function (c) { c.checked = !!fs.proj.checks[c.dataset.i]; c.onchange = function () { fs.proj.checks[c.dataset.i] = c.checked; save(); }; });
      pt.oninput = function () { fs.proj.text = pt.value.slice(0, 20000); save(); };
      if (fs.proj.done) po.textContent = '✅ پروژه در ' + fdate(fs.proj.t) + ' ثبت شد.';
      pb.onclick = function () {
        var txt = (pt.value || '').trim(), all = pr.every(function (c) { return c.checked; });
        if (/(\b[a-z]{3,8}\b[\s,]+){11,}\b[a-z]{3,8}\b/.test(txt)) { po.style.color = 'var(--no)'; po.textContent = 'به نظر می‌رسد متن شامل عبارت بازیابی است. هرگز آن را جایی ننویسید؛ پاک کنید.'; return; }
        if (txt.length < 150 && !/^https?:\/\//.test(txt)) { po.style.color = 'var(--warn)'; po.textContent = 'گزارش پروژه کوتاه است: دست‌کم ۱۵۰ نویسه بنویسید یا لینک سند پروژه را بگذارید.'; return; }
        if (!all) { po.style.color = 'var(--warn)'; po.textContent = 'همهٔ معیارهای ارزیابی باید برقرار باشند؛ موارد ناقص را کامل کنید.'; return; }
        if (!fs.proj.done) { addXP(400); act('project', fid); }
        fs.proj.done = true; fs.proj.t = Date.now(); fs.proj.text = txt; po.style.color = ''; po.textContent = '✅ پروژه ثبت شد.'; commit(); certBox();
      };
    }
    function certBox() {
      var b = $('#acCert'); if (!b) return;
      if (facComplete(fid)) certificate(b, fid);
      else b.innerHTML = '<p class="note">🔒 گواهی پس از قبولی در آزمون جامع (' + (fs.pass ? '✅' : '⏳') + ') و ثبت پروژهٔ عملی (' + (fs.proj && fs.proj.done ? '✅' : '⏳') + ') صادر می‌شود.</p>';
    }
    certBox(); commit();
  })();

  if (page === 'home') (function () {
    $$('.ac-fac').forEach(function (a) {
      var fid = a.dataset.fid, f = FS[fid]; if (!f) return;
      var done = f.ls.filter(mastered).length, st = S.F[fid] || {};
      if (f.live) $('.pbar i', a).style.width = Math.round(done * 100 / Math.max(1, f.ls.length)) + '%';
      a.classList.toggle('locked', !facOpen(fid));
      $('.ac-fs', a).textContent = facComplete(fid) ? '🏅 تکمیل' : st.pass ? '✅ آزمون جامع' : st.credit ? '🧭 معاف' : (done ? fa(done) + ' از ' + fa(f.ls.length) : '');
    });
    var nx = nextLesson(), go = $('#acGo'), hi = $('#acHello'), lv = level();
    if (nx && Object.keys(S.L).length) { go.href = nx.u; go.textContent = 'ادامهٔ مسیر: ' + nx.t; }
    if (Object.keys(S.L).length) hi.textContent = (S.name ? S.name + ' عزیز، ' : '') + 'سطح فعلی شما: ' + lv.fa + ' · ' + fa(S.xp) + ' امتیاز تجربه' + (dueCount() ? ' · ' + fa(dueCount()) + ' سؤال آمادهٔ مرور' : '');
    $$('#acLevels li').forEach(function (li) { li.classList.toggle('on', +li.dataset.lv === lv.n); });
    var inp = $('#acSearch'), out = $('#acSearchOut'), tm;
    inp.oninput = function () {
      clearTimeout(tm); var q = inp.value.trim();
      if (q.length < 2) { out.innerHTML = ''; return; }
      tm = setTimeout(function () {
        var nq = norm(q), hits = M.lessons.filter(function (l) { return norm(l.t).indexOf(nq) >= 0; }).slice(0, 5);
        var html = hits.map(function (l) { return '<a href="' + l.u + '">📘 ' + esc(l.t) + '<small>دانشکدهٔ ' + fa(FS[l.f].n) + ' · ' + esc(FS[l.f].t) + '</small></a>'; }).join('');
        out.innerHTML = html || '<p class="note">در حال جست‌وجو در متن درس‌ها…</p>';
        loadIdx().then(function () {
          var r = search(q), seen = {}, more = [];
          hits.forEach(function (l) { seen[l.id] = 1; });
          r.forEach(function (h) { if (more.length < 6 && !seen[h.x.l + h.x.s]) { seen[h.x.l + h.x.s] = 1; more.push(h.x); } });
          out.innerHTML = html + more.map(function (x) { return '<a href="' + esc(x.u) + '">🔎 ' + esc(x.t) + ' › ' + SECN[x.s] + '<small>' + esc(cut(x.x, 140)) + '</small></a>'; }).join('') || '<p class="note">نتیجه‌ای پیدا نشد.</p>';
        }).catch(function () { });
      }, 220);
    };
  })();

  if (page === 'glossary') (function () {
    var inp = $('#acGl'), cards = $$('#acGlList .ac-term'), n = $('#acGlN');
    function f() { var q = norm(inp.value.trim()), c = 0; cards.forEach(function (x) { var on = !q || norm(x.dataset.s).indexOf(q) >= 0; x.hidden = !on; if (on) c++; }); n.textContent = fa(c) + ' اصطلاح'; }
    inp.oninput = f; f();
  })();

  if (page === 'review') (function () {
    var box = $('#acRev');
    fetch('/academy/data/bank.json').then(function (r) { return r.json(); }).then(function (bank) {
      var map = {}; bank.forEach(function (q) { map[srsKey(q.l, q.i)] = q; });
      function run() {
        var t = Date.now(), due = Object.keys(S.srs).filter(function (k) { return S.srs[k].d <= t && map[k]; });
        due.sort(function (a, b) { return S.srs[a].b - S.srs[b].b || S.srs[a].d - S.srs[b].d; });
        due = due.slice(0, 10);
        if (!due.length) {
          var nxt = Object.keys(S.srs).filter(function (k) { return map[k]; }).map(function (k) { return S.srs[k].d; }).sort()[0];
          box.innerHTML = '<div class="ac-res ok"><h3>✅ امروز سؤالی برای مرور ندارید</h3><p>' + (nxt ? 'مرور بعدی: ' + fdate(nxt) : 'بعد از اولین آزمون درس، سؤال‌ها اینجا برای مرور زمان‌بندی می‌شوند.') + '</p><p><a class="ac-btn" href="' + ((nextLesson() || {}).u || '/academy/') + '">ادامهٔ یادگیری</a></p></div>';
          topDue(); return;
        }
        var qs = due.map(function (k) { var q = map[k]; return Object.assign({ key: k, u: '/academy/' + q.f + '/' + q.l + '/#' + q.sec }, q); });
        quiz(box, qs, {
          showLesson: true, pass: 0, retry: run, btn: 'ثبت مرور', onDone: function (sc, det, extra) {
            det.forEach(function (d) { if (d.ok) { srsRight(d.q.key); S.revOk = (S.revOk || 0) + 1; } else srsWrong(d.q.key); });
            addXP(sc * 5); act('review', sc + '/' + det.length);
            extra.innerHTML = '<p>سؤال‌های درست با فاصلهٔ بیشتری برمی‌گردند و سؤال‌های نادرست زود تکرار می‌شوند.</p>'; commit();
          }
        });
      }
      run();
    }).catch(function () { box.innerHTML = '<p class="lab-msg err">بانک سؤال بارگذاری نشد.</p>'; });
  })();

  if (page === 'placement') (function () {
    var box = $('#acPl');
    fetch('/academy/data/bank.json').then(function (r) { return r.json(); }).then(function (bank) {
      function run() {
        var qs = [];
        M.facs.filter(function (f) { return f.live; }).forEach(function (f) {
          var fb = bank.filter(function (q) { return q.f === f.id; });
          var pref = shuffle(fb.filter(function (q) { return q.k !== 'mcq'; })), other = shuffle(fb.filter(function (q) { return q.k === 'mcq'; }));
          var by = {}, pick = [];
          pref.concat(other).forEach(function (q) { if (pick.length < 6 && !by[q.l]) { by[q.l] = 1; pick.push(q); } });
          pref.concat(other).forEach(function (q) { if (pick.length < 6 && pick.indexOf(q) < 0) pick.push(q); });
          pick.forEach(function (q) { qs.push(Object.assign({ fac: f.id }, q)); });
        });
        quiz(box, qs, {
          pass: 0, btn: 'پایان آزمون و تعیین سطح', retry: run, onDone: function (sc, det, extra) {
            var per = {}; det.forEach(function (d) { var p = per[d.q.fac] = per[d.q.fac] || [0, 0]; p[1]++; if (d.ok) p[0]++; });
            var rows = Object.keys(per).map(function (fid) {
              var p = per[fid], ok = p[0] >= 5; if (ok && !fst(fid).credit) { S.F[fid].credit = true; S.F[fid].creditAt = Date.now(); addXP(50); }
              return '<tr><td>' + FS[fid].i + ' ' + esc(FS[fid].t) + '</td><td>' + fa(p[0]) + ' از ' + fa(p[1]) + '</td><td>' + (ok ? '🧭 معاف شد' : 'از درس اول این دانشکده شروع کنید') + '</td></tr>';
            }).join('');
            S.placed = Date.now(); act('placement', sc + '');
            var nx = nextLesson();
            extra.innerHTML = '<table class="ac-tbl"><tr><th>دانشکده</th><th>نتیجه</th><th>وضعیت</th></tr>' + rows + '</table>' +
              (nx ? '<p><a class="ac-btn" href="' + nx.u + '">شروع از: ' + esc(nx.t) + '</a></p>' : '');
            commit();
          }
        });
      }
      run();
    }).catch(function () { box.innerHTML = '<p class="lab-msg err">بانک سؤال بارگذاری نشد.</p>'; });
  })();

  if (page === 'me') (function () {
    var box = $('#acMe');
    function render() {
      var lv = level(), live = M.lessons, ms = live.filter(function (l) { return mastered(l.id); }).length;
      var att = live.filter(function (l) { return S.L[l.id] && S.L[l.id].att; });
      var avg = att.length ? att.reduce(function (s, l) { return s + (S.L[l.id].best || 0); }, 0) / att.length : 0;
      var exs = live.filter(function (l) { return S.L[l.id] && S.L[l.id].ex; }).length;
      var units = live.length + M.facs.filter(function (f) { return f.live; }).length * 2;
      var got = ms + M.facs.filter(function (f) { return f.live && facPassed(f.id); }).length + M.facs.filter(function (f) { return f.live && S.F[f.id] && S.F[f.id].proj && S.F[f.id].proj.done; }).length;
      var nxl = (M.levels || [])[lv.n], nx = nextLesson(), last = S.last && LS[S.last.lid];
      var h = '<div class="ac-box"><div class="ac-row"><label style="flex:1;min-width:220px">نام نمایشی (فقط روی همین دستگاه): <input class="ac-in" id="acName" maxlength="40" value="' + esc(S.name || '') + '"></label></div>' +
        '<p class="note">عضو از ' + fdate(S.created) + ' · پیشرفت فقط در همین مرورگر ذخیره می‌شود؛ برای انتقال به دستگاه دیگر از «خروجی پیشرفت» استفاده کنید.</p></div>';
      h += '<div class="ac-grid">' +
        kpi('سطح', lv.n + '. ' + lv.fa + ' <small dir="ltr">' + lv.en + '</small>') + kpi('امتیاز تجربه', fa(S.xp) + (nxl ? ' <small>/ ' + fa(nxl.xp) + '</small>' : '')) +
        kpi('پیشرفت کل', pct(got / Math.max(1, units))) + kpi('درس‌های با تسلط', fa(ms) + ' از ' + fa(live.length)) +
        kpi('میانگین بهترین نمره', att.length ? pct(avg) : '—') + kpi('تمرین عملی', fa(exs)) + kpi('پیوستگی', fa(streak()) + ' روز') + kpi('آمادهٔ مرور', fa(dueCount()) + ' سؤال') + '</div>';
      if (nxl && lv.n < 6) h += '<p class="note">ارتقا به سطح «' + nxl.fa + '» نیازمند ' + fa(nxl.xp) + ' امتیاز و قبولی در آزمون جامع ' + fa([0, 1, 3, 5, 8, 12][lv.n]) + ' دانشکده است.</p>';
      h += '<div class="ac-row" style="margin:12px 0">' + (nx ? '<a class="ac-btn" href="' + nx.u + '">درس بعد: ' + esc(nx.t) + '</a>' : '') +
        (last ? '<a class="ac-btn ghost" href="' + last.u + '">آخرین درس: ' + esc(last.t) + '</a>' : '') + (dueCount() ? '<a class="ac-btn ghost" href="/academy/review/">🔁 مرور (' + fa(dueCount()) + ')</a>' : '') + '</div>';
      // faculties
      h += '<h2>🏛 پیشرفت دانشکده‌ها</h2><div class="ac-bars">' + M.facs.map(function (f) {
        var d = f.ls.filter(mastered).length, p = f.live ? d / f.ls.length : 0, st = S.F[f.id] || {};
        var tag = facComplete(f.id) ? '🏅' : st.pass ? '✅' : st.credit ? '🧭' : (!f.live ? '🛠' : facOpen(f.id) ? '' : '🔒');
        return '<div><a href="/academy/' + f.id + '/">' + f.i + ' ' + esc(f.t) + '</a><span class="pbar"><i style="width:' + Math.round(p * 100) + '%"></i></span><span>' + (f.live ? pct(p) : '') + ' ' + tag + '</span></div>';
      }).join('') + '</div><p class="note">🏅 تکمیل با گواهی · ✅ آزمون جامع قبول · 🧭 معاف با تعیین سطح · 🔒 قفل · 🛠 در حال تولید</p>';
      // skills
      var SK = [['f1', 'دانش اقتصاد و بازار'], ['f2', 'دانش بلاک‌چین'], ['f3', 'ارزیابی پروژه'], ['f4', 'امنیت دارایی']];
      var lab = {}; try { lab = JSON.parse(localStorage.getItem('ek_acad_lab') || '{}'); } catch (e) { }
      h += '<h2>🧠 مهارت‌ها</h2><div class="ac-bars">' + SK.map(function (s) {
        var f = FS[s[0]]; if (!f) return '';
        var sc = f.ls.reduce(function (a, id) { return a + ((S.L[id] && S.L[id].best) || 0); }, 0) / f.ls.length;
        var ex = (S.F[s[0]] || {}).exam || 0, v = Math.max(sc * 0.7 + ex * 0.3, 0);
        return '<div><span>' + s[1] + '</span><span class="pbar"><i style="width:' + Math.round(v * 100) + '%"></i></span><span>' + pct(v) + '</span></div>';
      }).join('');
      var tr = (lab.journal || []).filter(function (j) { return j.src === 'sim'; });
      var disc = tr.length ? tr.filter(function (j) { return j.sl; }).length / tr.length : 0;
      h += '<div><span>انضباط ریسک (شبیه‌ساز)</span><span class="pbar"><i style="width:' + Math.round(disc * 100) + '%"></i></span><span>' + (tr.length ? pct(disc) : '—') + '</span></div></div>' +
        '<p class="note">مهارت هر حوزه از بهترین نمرهٔ آزمون درس‌ها (۷۰٪) و آزمون جامع (۳۰٪) محاسبه می‌شود. «انضباط ریسک» سهم معامله‌های شبیه‌ساز است که با حد ضرر باز شده‌اند (' + fa(tr.length) + ' معامله).</p>';
      // weak points
      var weak = att.filter(function (l) { return !S.L[l.id].pass || S.L[l.id].best < 1; }).sort(function (a, b) { return S.L[a.id].best - S.L[b.id].best; }).slice(0, 5);
      var secW = {}; Object.keys(S.wrong).forEach(function (k) { var lid = k.split(':')[0]; if (LS[lid]) secW[lid] = (secW[lid] || 0) + S.wrong[k]; });
      h += '<h2>🎯 مهارت‌های نیازمند تقویت</h2>' + (weak.length ? '<ul class="ac-list">' + weak.map(function (l) {
        return '<li><a href="' + l.u + '#quiz">' + esc(l.t) + '</a> — بهترین نمره ' + pct(S.L[l.id].best || 0) + (secW[l.id] ? ' · ' + fa(secW[l.id]) + ' پاسخ نادرست ثبت‌شده' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="note">هنوز نقطهٔ ضعفی ثبت نشده است.</p>');
      // scores
      h += '<h2>📝 نمرات آزمون‌ها</h2>' + (att.length ? '<div class="lab-scroll"><table class="ac-tbl"><tr><th>درس</th><th>بهترین</th><th>آخرین</th><th>تلاش</th><th>تمرین</th><th>تشریحی</th></tr>' + att.map(function (l) {
        var s = S.L[l.id]; return '<tr><td><a href="' + l.u + '">' + esc(l.t) + '</a></td><td>' + (s.pass ? '✅ ' : '') + pct(s.best || 0) + '</td><td>' + pct(s.last || 0) + '</td><td>' + fa(s.att) + '</td><td>' + (s.ex ? '✅' : '—') + '</td><td>' + (s.essayDone ? '✅' : '—') + '</td></tr>';
      }).join('') + '</table></div>' : '<p class="note">هنوز آزمونی نداده‌اید.</p>');
      var fx = M.facs.filter(function (f) { return S.F[f.id] && (S.F[f.id].exam || S.F[f.id].proj && S.F[f.id].proj.done); });
      if (fx.length) h += '<h3>آزمون‌های جامع و پروژه‌ها</h3><table class="ac-tbl"><tr><th>دانشکده</th><th>آزمون جامع</th><th>پروژه</th><th>گواهی</th></tr>' + fx.map(function (f) {
        var s = S.F[f.id]; return '<tr><td>' + esc(f.t) + '</td><td>' + (s.exam ? pct(s.exam) + (s.pass ? ' ✅' : '') : '—') + '</td><td>' + (s.proj && s.proj.done ? '✅' : '—') + '</td><td>' + (facComplete(f.id) ? '<a href="/academy/' + f.id + '/#cert">🏅 دریافت</a>' : '—') + '</td></tr>';
      }).join('') + '</table>';
      // badges
      h += '<h2>🏆 نشان‌ها</h2><div class="ac-badges">' + BADGES.map(function (b) { return '<span class="ac-badge' + (S.badges[b[0]] ? '' : ' off') + '" title="' + esc(b[2]) + '">' + b[1] + '<br><small>' + esc(b[2]) + '</small></span>'; }).join('') + '</div>';
      // calendar
      var cells = '', t0 = Date.now() - (7 * 16 - 1) * DAY, dow = new Date(t0).getDay();
      for (var i = 0; i < dow; i++) cells += '<i style="visibility:hidden"></i>';
      for (i = 0; i < 7 * 16; i++) { var d = today(t0 + i * DAY), c = S.days[d] || 0; cells += '<i class="' + (c >= 8 ? 'l3' : c >= 3 ? 'l2' : c ? 'l1' : '') + '" title="' + d + ': ' + c + '"></i>'; }
      h += '<h2>📅 تقویم مطالعه (۱۶ هفتهٔ اخیر)</h2><div class="ac-cal">' + cells + '</div>';
      // weekly report
      var wk = S.log.filter(function (x) { return x.t > Date.now() - 7 * DAY; }), cnt = function (k) { return wk.filter(function (x) { return x.k === k; }).length; };
      var qz = wk.filter(function (x) { return x.k === 'quiz'; }), qok = qz.reduce(function (a, x) { return a + (+x.x.split(':').pop() || 0); }, 0);
      h += '<h2>🗓 گزارش هفتگی</h2><div class="ac-grid">' + kpi('روزهای فعال', fa(Object.keys(S.days).filter(function (d) { return d >= today(Date.now() - 6 * DAY); }).length) + ' از ۷') +
        kpi('آزمون درس', fa(qz.length) + (qz.length ? ' <small>(' + pct(qok / (qz.length * 5)) + ' درست)</small>' : '')) + kpi('تمرین عملی', fa(cnt('exercise'))) +
        kpi('مرور', fa(cnt('review'))) + kpi('پرسش تشریحی', fa(cnt('essay'))) + kpi('آزمون جامع / پروژه', fa(cnt('exam')) + ' / ' + fa(cnt('project'))) + '</div>';
      // backup
      h += '<h2>💾 نسخهٔ پشتیبان</h2><div class="ac-row"><button class="ac-btn ghost" id="acExp" type="button">⬇ خروجی پیشرفت (JSON)</button>' +
        '<label class="ac-btn ghost" style="cursor:pointer">⬆ بازگردانی از فایل<input type="file" id="acImp" accept="application/json,.json" hidden></label>' +
        '<button class="ac-btn ghost" id="acRst" type="button">🗑 شروع از صفر</button></div><p class="lab-msg" id="acBk"></p>';
      box.innerHTML = h;
      $('#acName').onchange = function () { S.name = this.value.trim().slice(0, 40); save(); };
      $('#acExp').onclick = function () {
        var data = { academy: S }; try { data.lab = JSON.parse(localStorage.getItem('ek_acad_lab') || '{}'); } catch (e) { }
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })); a.download = 'entekhab-academy-' + today() + '.json'; a.click();
      };
      $('#acImp').onchange = function () {
        var f = this.files[0]; if (!f) return; var r = new FileReader();
        r.onload = function () {
          try {
            var d = JSON.parse(r.result); if (!d.academy || typeof d.academy !== 'object' || !d.academy.L) throw 0;
            localStorage.setItem(K, JSON.stringify(d.academy)); if (d.lab) localStorage.setItem('ek_acad_lab', JSON.stringify(d.lab)); load(); render(); $('#acBk').textContent = '✅ پیشرفت بازگردانی شد.';
          } catch (e) { $('#acBk').textContent = 'فایل معتبر نیست.'; }
        }; r.readAsText(f);
      };
      $('#acRst').onclick = function () { if (confirm('همهٔ پیشرفت آکادمی در این مرورگر پاک شود؟ این کار برگشت‌پذیر نیست (مگر نسخهٔ پشتیبان داشته باشید).')) { localStorage.removeItem(K); load(); render(); } };
    }
    function kpi(a, b) { return '<div class="ac-kpi"><small>' + a + '</small><b>' + b + '</b></div>'; }
    commit(); render();
  })();

  window.ACAD = { state: function () { return S; }, act: function (k) { act(k); commit(); } };
})();
