/* /kids/play/ — four small games for "Bitcoin for Juniors" (ages 8–12), hosted by Seko the coin.
   market : barter vs money, then price, demand and scarcity at a lemonade stand      (module 1)
   piggy  : needs vs wants, saving for a goal, prices that rise                        (module 5)
   chain  : real SHA-256 fingerprints, a chain that shows tampering, a tiny "mining"   (modules 2, 3, 6)
   scam   : spotting scam messages, secret words, a strong passphrase                  (module 4)
   No real money, no trading, nothing sent anywhere: stars live in localStorage ("ck_b4j_play").
   Text follows the site language (window.EKL / 'ek-lang'); Seko's speech bubble can be read aloud
   with the site's reader. */
(function () {
  'use strict';
  var app = document.getElementById('kp-app'), hub = document.getElementById('kp-hub') || document.querySelector('.kp-hub');
  if (!app && !hub) return;

  /* ---------------- language + helpers ---------------- */
  var de = document.documentElement;
  function L() {
    if (window.EKL) return window.EKL();
    var l = (de.getAttribute('lang') || 'fa').toLowerCase();
    return l.indexOf('ckb') === 0 ? 'ckb' : l.indexOf('en') === 0 ? 'en' : 'fa';
  }
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩' };
  function n(x) { var l = L(); return DIG[l] ? String(x).replace(/\d/g, function (d) { return DIG[l][d]; }) : String(x); }
  function tr(fa, ckb, en) { return { fa: fa, ckb: ckb, en: en }; }
  function T(o) { return o == null ? '' : typeof o === 'string' ? o : (o[L()] != null ? o[L()] : o.fa); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fill(o, v) { return T(o).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
  var KEY = 'ck_b4j_play';
  var store = {
    all: function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } },
    put: function (g, s) { var a = this.all(); a[g] = Math.max(a[g] || 0, s); try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { } }
  };

  var W = {
    next: tr('بعدی', 'دواتر', 'Next'), again: tr('دوباره بازی کن', 'دووبارە یاری بکە', 'Play again'),
    all: tr('همهٔ بازی‌ها', 'هەموو یارییەکان', 'All games'), chapter: tr('برگشت به فصل', 'گەڕانەوە بۆ بەش', 'Back to the chapter'),
    say: tr('بلند بخوان', 'بە دەنگ بیخوێنەوە', 'Read aloud'), coins: tr('سکه', 'سکە', 'coins'),
    learned: tr('امروز یاد گرفتی:', 'ئەمڕۆ فێربوویت:', 'Today you learned:'), badge: tr('نشان', 'نیشانە', 'Badge')
  };

  /* ---------------- Seko ---------------- */
  var MOUTH = {
    happy: '<path d="M47 72 Q60 86 73 72" stroke="#3b1f04" stroke-width="4" fill="#7a2e0e" stroke-linecap="round"/>',
    wow: '<ellipse cx="60" cy="76" rx="6" ry="7" fill="#3b1f04"/>',
    think: '<path d="M51 76 L69 73" stroke="#3b1f04" stroke-width="4" stroke-linecap="round"/>',
    sad: '<path d="M48 79 Q60 68 72 79" stroke="#3b1f04" stroke-width="4" fill="none" stroke-linecap="round"/>'
  };
  function seko(mood) {
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="kpg" cx="38%" cy="32%" r="72%">' +
      '<stop offset="0" stop-color="#ffd885"/><stop offset=".58" stop-color="#f7931a"/><stop offset="1" stop-color="#c2660b"/></radialGradient></defs>' +
      '<ellipse cx="60" cy="113" rx="28" ry="5" fill="#000" opacity=".28"/><g class="bob">' +
      '<path d="M24 68 q-12 5 -13 17" stroke="#c2660b" stroke-width="6" stroke-linecap="round" fill="none"/>' +
      '<g class="arm-r"><path d="M96 66 q12 -5 15 -18" stroke="#c2660b" stroke-width="6" stroke-linecap="round" fill="none"/></g>' +
      '<ellipse cx="47" cy="104" rx="10" ry="5" fill="#c2660b"/><ellipse cx="73" cy="104" rx="10" ry="5" fill="#c2660b"/>' +
      '<line x1="60" y1="24" x2="60" y2="12" stroke="#c2660b" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="9" r="5.5" fill="#fff1b8"/>' +
      '<circle cx="60" cy="62" r="40" fill="url(#kpg)" stroke="#b3590a" stroke-width="4"/>' +
      '<circle cx="60" cy="62" r="32" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2" stroke-dasharray="4 5"/>' +
      '<g class="eyes"><ellipse cx="47" cy="55" rx="8" ry="9.5" fill="#fff"/><ellipse cx="73" cy="55" rx="8" ry="9.5" fill="#fff"/>' +
      '<circle cx="49" cy="57" r="4.3" fill="#1d1306"/><circle cx="75" cy="57" r="4.3" fill="#1d1306"/>' +
      '<circle cx="50.6" cy="55" r="1.5" fill="#fff"/><circle cx="76.6" cy="55" r="1.5" fill="#fff"/></g>' +
      '<ellipse cx="37" cy="70" rx="5" ry="3" fill="#ff7aa8" opacity=".65"/><ellipse cx="83" cy="70" rx="5" ry="3" fill="#ff7aa8" opacity=".65"/>' +
      (MOUTH[mood] || MOUTH.happy) + '</g></svg>';
  }
  var NAME = tr('سِکو', 'سکۆ', 'Seko');
  var SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

  function readAloud(el) {
    try {
      var A = window.AudioContext || window.webkitAudioContext;
      if (!window.__ekAC && A) window.__ekAC = new A();
      if (window.__ekAC) window.__ekAC.resume();
    } catch (e) { }
    var p = window.ekReader ? window.ekReader() : import('/assets/reader.js?v=9').then(function (m) { return m.default; });
    p.then(function (R) { R.element(el); }).catch(function () { });
  }
  function confetti() {
    if (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = document.createElement('div'); c.className = 'kp-confetti';
    var cols = ['#f7931a', '#facc15', '#4ade80', '#38bdf8', '#f472b6', '#a78bfa'];
    for (var i = 0; i < 46; i++) {
      var b = document.createElement('i');
      b.style.left = Math.random() * 100 + 'vw'; b.style.background = cols[i % cols.length];
      b.style.animationDelay = (Math.random() * 0.6) + 's'; c.appendChild(b);
    }
    document.body.appendChild(c); setTimeout(function () { c.remove(); }, 2800);
  }

  /* ---------------- game runner ---------------- */
  function Runner(game) {
    var self = this;
    this.g = game; this.st = game.init(); this.step = 0;
    this.mood = 'happy'; this.text = '';
    app.innerHTML = '<div class="kp" style="--c:' + game.color + '"><div class="kp-top"><div class="kp-seko" id="kpSeko"></div>' +
      '<div class="kp-bubble" aria-live="polite"><span id="kpSay"></span><button class="kp-say" type="button" id="kpSpk">' + SPK + '</button></div></div>' +
      '<div class="kp-stage" id="kpStage"></div><div class="kp-foot"><div class="kp-stars" id="kpStars"></div><div class="kp-dots" id="kpDots"></div>' +
      '<div class="kp-row" id="kpNav"></div></div></div>';
    this.$ = function (id) { return document.getElementById(id); };
    this.$('kpSpk').addEventListener('click', function () { readAloud(self.$('kpSay')); });
    window.addEventListener('ek-lang', function () { self.render(); });
    this.render();
  }
  Runner.prototype = {
    say: function (o, mood, vars) { this.text = vars ? fill(o, vars) : T(o); this.mood = mood || 'happy'; },
    render: function () {
      var g = this.g, self = this;
      this.navBtns = [];
      this.say(g.steps[this.step].intro || '', 'happy');
      var html = g.steps[this.step].draw.call(this, this.st);
      this.$('kpStage').innerHTML = html || '';
      if (g.steps[this.step].wire) g.steps[this.step].wire.call(this, this.st, this.$('kpStage'));
      this.paint();
      var dots = ''; for (var i = 0; i < g.steps.length; i++) dots += '<b class="' + (i <= this.step ? 'on' : '') + '"></b>';
      this.$('kpDots').innerHTML = dots;
      this.$('kpSpk').title = this.$('kpSpk').ariaLabel = T(W.say);
    },
    paint: function () {
      this.$('kpSay').textContent = this.text;
      this.$('kpSeko').innerHTML = seko(this.mood);
      var s = this.g.stars ? this.g.stars(this.st) : 0, h = '';
      for (var i = 0; i < 3; i++) h += '<i class="' + (i < s ? 'on' : '') + '">⭐</i>';
      this.$('kpStars').innerHTML = h;
      this.$('kpStars').setAttribute('aria-label', n(s) + ' / ' + n(3));
    },
    talk: function (o, mood, vars) { this.say(o, mood, vars); this.paint(); },
    cheer: function () { var s = this.$('kpSeko'); s.classList.remove('cheer'); void s.offsetWidth; s.classList.add('cheer'); confetti(); },
    nav: function (buttons) {
      var self = this, box = this.$('kpNav'); box.innerHTML = '';
      buttons.forEach(function (b) {
        var el = document.createElement(b.href ? 'a' : 'button');
        el.className = 'kp-btn' + (b.alt ? ' alt' : ''); el.textContent = T(b.label);
        if (b.href) { el.href = b.href; el.style.textDecoration = 'none'; }
        else { el.type = 'button'; el.disabled = !!b.disabled; el.addEventListener('click', b.on); }
        box.appendChild(el);
      });
    },
    next: function (enabled) { var self = this; this.nav([{ label: W.next, disabled: !enabled, on: function () { self.go(self.step + 1); } }]); },
    go: function (i) { this.step = i; this.render(); var top = app.getBoundingClientRect().top; if (top < 0) scrollBy({ top: top - 80, behavior: 'smooth' }); },
    finish: function (st, lessons, badge, chapter) {
      var self = this, s = this.g.stars(st);
      store.put(this.g.id, s);
      this.cheer();
      this.nav([{ label: W.again, on: function () { self.st = self.g.init(); self.go(0); } },
        { label: W.all, href: '/kids/play/', alt: true }, { label: W.chapter, href: chapter, alt: true }]);
      return '<h2>' + T(W.learned) + '</h2><ul>' + lessons.map(function (x) { return '<li>' + esc(T(x)) + '</li>'; }).join('') + '</ul>' +
        '<p class="kp-note">🏅 ' + T(W.badge) + ': <b>' + esc(T(badge)) + '</b></p>';
    }
  };

  /* ================================================================ market */
  var ITEM = { apple: ['🍎', tr('سیب', 'سێو', 'an apple')], pencil: ['✏️', tr('مداد', 'قەڵەم', 'a pencil')],
    book: ['📕', tr('کتاب', 'کتێب', 'a book')], ball: ['⚽', tr('توپ', 'تۆپ', 'a ball')] };
  function it(k) { return ITEM[k][0] + ' ' + T(ITEM[k][1]); }
  var TRADERS = [
    { face: '👦', name: tr('علی', 'عەلی', 'Ali'), has: 'ball', wants: 'book' },
    { face: '👧', name: tr('سارا', 'سارا', 'Sara'), has: 'book', wants: 'pencil' },
    { face: '🧒', name: tr('رضا', 'ڕەزا', 'Reza'), has: 'pencil', wants: 'apple' }
  ];
  var DAYS = [
    { ic: '⛅', t: tr('روز معمولی', 'ڕۆژێکی ئاسایی', 'A normal day'), demand: 10, cups: 20, w: 10,
      why: tr('قیمت وسط بیشترین سکه را آورد: خیلی ارزان، سود کم؛ خیلی گران، مشتری کم.', 'نرخی ناوەند زۆرترین سکەی هێنا: زۆر هەرزان قازانجی کەمە، زۆر گران کڕیاری کەمە.', 'The middle price earned most: too cheap earns little, too dear brings few buyers.') },
    { ic: '☀️', t: tr('روز خیلی گرم!', 'ڕۆژێکی زۆر گەرم!', 'A very hot day!'), demand: 18, cups: 20, w: 16,
      why: tr('وقتی خیلی‌ها چیزی را می‌خواهند (تقاضا زیاد است)، حتی با قیمت بالاتر هم می‌خرند.', 'کاتێک زۆر کەس شتێکیان دەوێت (داواکاری زۆرە)، تەنانەت بە نرخی بەرزتریش دەیکڕن.', 'When many people want something (high demand), they buy even at a higher price.') },
    { ic: '🍋', t: tr('لیمو کم شده؛ فقط ۶ لیوان داری', 'لیمۆ کەم بووە؛ تەنها ٦ پەرداخت هەیە', 'Lemons ran short: only 6 cups'), demand: 12, cups: 6, w: 12,
      why: tr('وقتی چیزی کم است (کمیاب است)، زود تمام می‌شود و قیمتش بالا می‌رود.', 'کاتێک شتێک کەمە (دەگمەنە)، زوو تەواو دەبێت و نرخەکەی بەرز دەبێتەوە.', 'When something is scarce, it sells out fast and its price goes up.') }
  ];
  var PRICES = [2, 5, 8];
  function sold(d, p) { return Math.min(d.cups, Math.round(d.demand * Math.max(0, 1 - p / d.w))); }
  function best(d) { return Math.max.apply(null, PRICES.map(function (p) { return sold(d, p) * p; })); }

  var MARKET = {
    id: 'market', color: '#f7931a', chapter: '/kids/m1/',
    init: function () { return { inv: 'apple', trades: 0, wrong: 0, paid: false, day: 0, price: 0, opened: false, earn: [] }; },
    stars: function (st) {
      if (st.earn.length < 3) return Math.min(st.trades >= 3 ? 1 : 0, 3);
      var tot = st.earn.reduce(function (a, b) { return a + b; }, 0), bestTot = DAYS.reduce(function (a, d) { return a + best(d); }, 0);
      var s = tot >= bestTot * 0.9 ? 3 : tot >= bestTot * 0.7 ? 2 : 1;
      return st.wrong > 4 ? Math.min(s, 2) : s;
    },
    steps: [
      { intro: tr('سلام! من سِکو هستم 👋 امروز در بازارچه‌ایم. تو یک سیب داری ولی دلت یک توپ می‌خواهد. بیا با معاوضه به توپ برسیم!',
                  'سڵاو! من سکۆم 👋 ئەمڕۆ لە بازاڕۆچکەین. تۆ سێوێکت هەیە بەڵام تۆپێکت دەوێت. با بە ئاڵوگۆڕ بگەینە تۆپ!',
                  "Hi! I'm Seko 👋 Today we're at the little market. You have an apple, but you'd love a ball. Let's get there by swapping!"),
        draw: function () { this.next(true); return '<p class="kp-big" style="text-align:center">🍎 ➜ ❓ ➜ ⚽</p>'; } },
      { intro: tr('روی بچه‌ای بزن که می‌خواهی با او معاوضه کنی. هر کس فقط چیزی را می‌گیرد که خودش می‌خواهد.',
                  'لەسەر ئەو منداڵە دابگرە کە دەتەوێت لەگەڵی ئاڵوگۆڕ بکەیت. هەر کەسێک تەنها ئەو شتە وەردەگرێت کە خۆی دەیەوێت.',
                  'Tap the child you want to swap with. Each one only takes the thing they want.'),
        draw: function (st) {
          this.next(st.inv === 'ball');
          return '<p>' + T(tr('چیزی که الان داری:', 'ئەوەی ئێستا هەتە:', 'What you have now:')) + ' <span class="kp-inv">' + it(st.inv) + '</span></p><div class="kp-grid">' +
            TRADERS.map(function (x, i) {
              return '<button class="kp-card" type="button" data-t="' + i + '"><span class="kp-emo">' + x.face + '</span><b>' + esc(T(x.name)) + '</b><br>' +
                T(tr('دارد:', 'هەیەتی:', 'Has:')) + ' ' + it(x.has) + '<br>' + T(tr('می‌خواهد:', 'دەیەوێت:', 'Wants:')) + ' ' + it(x.wants) + '</button>';
            }).join('') + '</div>';
        },
        wire: function (st, stage) {
          var self = this;
          stage.querySelectorAll('[data-t]').forEach(function (b) {
            b.addEventListener('click', function () {
              if (st.inv === 'ball') return;
              var x = TRADERS[+b.dataset.t];
              if (x.wants === st.inv) {
                var had = st.inv; st.inv = x.has; x._took = had; st.trades++;
                if (st.inv === 'ball') {
                  self.render();
                  self.talk(tr('آفرین! با ' + '{k}' + ' معاوضه بالاخره به توپ رسیدی. ولی دیدی چقدر دنبال آدم درست گشتی؟', 'ئافەرین! بە {k} ئاڵوگۆڕ گەیشتیتە تۆپ. بەڵام بینیت چەند بەدوای کەسی گونجاودا گەڕایت؟', 'Well done! {k} swaps and you finally got the ball. But did you notice how long you searched for the right person?'), 'wow', { k: n(st.trades) });
                  self.cheer();
                } else {
                  self.render();
                  self.talk(tr('عالی! حالا {i} داری. ببین چه کسی این را می‌خواهد.', 'نایابە! ئێستا {i}ت هەیە. بزانە کێ ئەمەی دەوێت.', 'Great! Now you have {i}. Who wants that?'), 'happy', { i: it(st.inv) });
                }
              } else {
                st.wrong++; b.classList.add('kp-shake', 'bad'); setTimeout(function () { b.classList.remove('kp-shake', 'bad'); }, 500);
                self.talk(tr('{p} {i} نمی‌خواهد؛ او {w} می‌خواهد. اول کسی را پیدا کن که چیزِ تو را بخواهد.', '{p} {i}ی ناوێت؛ ئەو {w}ی دەوێت. سەرەتا کەسێک بدۆزەوە کە شتەکەی تۆی بوێت.', "{p} doesn't want {i}; they want {w}. First find someone who wants what you have."), 'think',
                  { p: T(x.name), i: T(ITEM[st.inv][1]), w: T(ITEM[x.wants][1]) });
              }
            });
          });
        } },
      { intro: tr('حالا فرض کن همه «سکه» را قبول کنند. تو ۳ سکه داری و علی توپش را ۳ سکه می‌فروشد.',
                  'ئێستا وای دابنێ هەموو کەس «سکە» قبووڵ دەکات. تۆ ٣ سکەت هەیە و عەلی تۆپەکەی بە ٣ سکە دەفرۆشێت.',
                  'Now imagine everyone accepts coins. You have 3 coins and Ali sells his ball for 3 coins.'),
        draw: function (st) {
          this.next(st.paid);
          return '<p class="kp-big" style="text-align:center">🪙🪙🪙 ' + (st.paid ? '➜ ⚽ ✅' : '') + '</p>' +
            (st.paid ? '' : '<p style="text-align:center"><button class="kp-btn" type="button" id="kpPay">' + T(tr('با سکه بخر', 'بە سکە بیکڕە', 'Buy with coins')) + '</button></p>');
        },
        wire: function (st, stage) {
          var self = this, b = stage.querySelector('#kpPay');
          if (b) b.addEventListener('click', function () {
            st.paid = true; self.render(); self.cheer();
            self.talk(tr('دیدی؟ با پول فقط یک قدم کافی بود! پول چیزی است که همه قبول می‌کنند، پس لازم نیست دنبال کسی بگردی که دقیقاً چیزِ تو را بخواهد.',
                         'بینیت؟ بە پارە تەنها یەک هەنگاو بەس بوو! پارە شتێکە هەموو کەس قبووڵی دەکات، بۆیە پێویست ناکات بەدوای کەسێکدا بگەڕێیت کە ڕێک شتەکەی تۆی بوێت.',
                         'See? With money, one step was enough! Money is something everyone accepts, so you never have to hunt for someone who wants exactly what you have.'), 'wow');
          });
          if (st.paid) this.say(tr('پول معاوضه را آسان می‌کند. حالا برویم سراغ قیمت‌ها!', 'پارە ئاڵوگۆڕ ئاسان دەکات. ئێستا با بچینە سەر نرخەکان!', "Money makes swapping easy. Now let's look at prices!"), 'happy');
        } },
      { intro: tr('تو یک دکهٔ لیموناد داری 🍋 سه روز است. هر روز قیمت را انتخاب کن و دکه را باز کن. ببین چند نفر می‌خرند!',
                  'تۆ دوکانێکی لیمۆناتت هەیە 🍋 سێ ڕۆژە. هەموو ڕۆژێک نرخەکە هەڵبژێرە و دوکانەکە بکەرەوە. بزانە چەند کەس دەیکڕن!',
                  'You run a lemonade stand 🍋 for three days. Each day pick a price and open the stand. See how many people buy!'),
        draw: function (st) {
          var d = DAYS[st.day], self = this;
          var h = '<h2>' + d.ic + ' ' + T(tr('روز', 'ڕۆژی', 'Day')) + ' ' + n(st.day + 1) + ' — ' + esc(T(d.t)) + '</h2>' +
            '<p class="kp-hint">' + fill(tr('{c} لیوان لیموناد آماده است.', '{c} پەرداخ لیمۆنات ئامادەیە.', '{c} cups of lemonade are ready.'), { c: n(d.cups) }) + '</p>' +
            '<div class="kp-price">' + PRICES.map(function (p) {
              return '<button type="button" data-p="' + p + '" class="' + (st.price === p ? 'on' : '') + '"' + (st.opened ? ' disabled' : '') + '>🪙 ' + n(p) + '</button>';
            }).join('') + '</div>';
          if (!st.opened) {
            h += '<button class="kp-btn" type="button" id="kpOpen"' + (st.price ? '' : ' disabled') + '>' + T(tr('دکه را باز کن!', 'دوکانەکە بکەرەوە!', 'Open the stand!')) + '</button>';
            this.nav([]);
          } else {
            var s = sold(d, st.price), q = '';
            for (var i = 0; i < s; i++) q += '<span style="animation-delay:' + (i * 0.08) + 's">🧍</span>';
            h += '<div class="kp-queue">' + (q || '…') + '</div><p>' + fill(tr('{s} لیوان فروختی و {e} سکه گرفتی.', '{s} پەرداخت فرۆشت و {e} سکەت وەرگرت.', 'You sold {s} cups and earned {e} coins.'), { s: n(s), e: n(s * st.price) }) + '</p>' +
              '<p class="kp-note">💡 ' + esc(T(d.why)) + '</p>';
            var last = st.day === DAYS.length - 1;
            this.nav([{ label: last ? W.next : tr('روز بعد', 'ڕۆژی دواتر', 'Next day'), on: function () {
              st.earn[st.day] = sold(d, st.price) * st.price;
              if (last) self.go(self.step + 1); else { st.day++; st.price = 0; st.opened = false; self.render(); }
            } }]);
          }
          return h;
        },
        wire: function (st, stage) {
          var self = this;
          stage.querySelectorAll('[data-p]').forEach(function (b) { b.addEventListener('click', function () { st.price = +b.dataset.p; self.render(); }); });
          var o = stage.querySelector('#kpOpen');
          if (o) o.addEventListener('click', function () { st.opened = true; self.render(); });
        } },
      { intro: tr('سه روز تمام شد! ببین چقدر خوب قیمت گذاشتی.', 'سێ ڕۆژ تەواو بوو! بزانە چەند باش نرخت دانا.', 'Three days done! See how well you priced.'),
        draw: function (st) {
          var rows = DAYS.map(function (d, i) { return '<tr><td>' + d.ic + ' ' + n(i + 1) + '</td><td>🪙 ' + n(st.earn[i] || 0) + '</td><td>🪙 ' + n(best(d)) + '</td></tr>'; }).join('');
          return '<table class="kp-table"><tr><th>' + T(tr('روز', 'ڕۆژ', 'Day')) + '</th><th>' + T(tr('سکهٔ تو', 'سکەی تۆ', 'Your coins')) + '</th><th>' +
            T(tr('بهترین ممکن', 'باشترینی گونجاو', 'Best possible')) + '</th></tr>' + rows + '</table>' +
            this.finish(st, [tr('معاوضه کند است، چون باید کسی را پیدا کنی که دقیقاً چیزِ تو را بخواهد.', 'ئاڵوگۆڕ خاوە، چونکە دەبێت کەسێک بدۆزیتەوە کە ڕێک شتەکەی تۆی بوێت.', "Swapping is slow: you must find someone who wants exactly what you have."),
              tr('پول کار را آسان می‌کند، چون همه آن را قبول می‌کنند.', 'پارە کارەکە ئاسان دەکات، چونکە هەموو کەس قبووڵی دەکات.', 'Money makes it easy because everyone accepts it.'),
              tr('وقتی خیلی‌ها چیزی را بخواهند یا آن چیز کم باشد، قیمتش بالا می‌رود.', 'کاتێک زۆر کەس شتێکیان بوێت یان ئەو شتە کەم بێت، نرخەکەی بەرز دەبێتەوە.', 'When many people want something, or there is little of it, its price goes up.')],
              tr('تاجر کوچک', 'بازرگانی بچووک', 'Little trader'), this.g.chapter);
        } }
    ]
  };

  /* ================================================================ piggy */
  var GOALS = [
    { k: 'bike', ic: '🚲', t: tr('دوچرخه', 'پاسکیل', 'a bike'), cost: 30 },
    { k: 'paint', ic: '🎨', t: tr('جعبه‌رنگ', 'سندوقی ڕەنگ', 'a paint set'), cost: 20 },
    { k: 'ball', ic: '⚽', t: tr('توپ فوتبال', 'تۆپی تۆپێن', 'a football'), cost: 15 }
  ];
  var SORT = [
    { ic: '💧', t: tr('آب', 'ئاو', 'water'), need: true }, { ic: '🍬', t: tr('آبنبات', 'شیرینی', 'candy'), need: false },
    { ic: '👟', t: tr('کفش مدرسه', 'پێڵاوی قوتابخانە', 'school shoes'), need: true }, { ic: '🎮', t: tr('بازی کامپیوتری', 'یاریی کۆمپیوتەر', 'a video game'), need: false },
    { ic: '💊', t: tr('دارو', 'دەرمان', 'medicine'), need: true }, { ic: '🧸', t: tr('عروسک', 'بووکەڵە', 'a teddy'), need: false }
  ];
  var WEEKS = [
    { ic: '🍬', t: tr('آبنبات', 'شیرینی', 'candy'), cost: 3, need: false },
    { ic: '📒', t: tr('دفتر برای مدرسه', 'دەفتەر بۆ قوتابخانە', 'a notebook for school'), cost: 2, need: true },
    { ic: '🌟', t: tr('بستهٔ برچسب', 'پاکەتی لکێنەر', 'a sticker pack'), cost: 4, need: false },
    { ic: '🍦', t: tr('بستنی', 'بەستەنی', 'ice cream'), cost: 2, need: false, rise: 2 },
    { ic: '🎂', t: tr('هدیهٔ تولد دوستت', 'دیاریی ڕۆژی لەدایکبوونی هاوڕێکەت', "a gift for your friend's birthday"), cost: 3, need: null },
    { ic: '🧃', t: tr('آبمیوه', 'شەربەت', 'juice'), cost: 2, need: false }
  ];
  var POCKET = 6;
  function jar(frac) {
    var h = Math.round(92 * Math.max(0, Math.min(1, frac)));
    return '<svg viewBox="0 0 120 140" aria-hidden="true"><rect x="22" y="14" width="76" height="12" rx="5" fill="#f472b6"/>' +
      '<path d="M26 26 h68 v92 a14 14 0 0 1 -14 14 h-40 a14 14 0 0 1 -14 -14z" fill="#ffffff10" stroke="#f472b6" stroke-width="4"/>' +
      '<clipPath id="kpjc"><path d="M28 28 h64 v90 a12 12 0 0 1 -12 12 h-40 a12 12 0 0 1 -12 -12z"/></clipPath>' +
      '<rect clip-path="url(#kpjc)" x="28" y="' + (130 - h) + '" width="64" height="' + h + '" fill="#facc15" opacity=".85"/>' +
      '<text x="60" y="84" text-anchor="middle" font-size="26">🪙</text></svg>';
  }
  var PIGGY = {
    id: 'piggy', color: '#f472b6', chapter: '/kids/m5/',
    init: function () { return { goal: null, sorted: {}, ok: 0, week: 0, saved: 0, bought: [], needBought: false, extra: 0, decided: false }; },
    stars: function (st) {
      if (!st.goal) return 0;
      var g = GOALS.filter(function (x) { return x.k === st.goal; })[0];
      var s = (st.ok >= 5 ? 1 : 0) + (st.needBought ? 1 : 0) + (st.week >= WEEKS.length && st.saved >= g.cost + st.extra ? 1 : 0);
      return s;
    },
    steps: [
      { intro: tr('بیا برای یک هدف پس‌انداز کنیم! هر هفته ۶ سکه پول توجیبی می‌گیری. اول هدفت را انتخاب کن.',
                  'با بۆ ئامانجێک پاشەکەوت بکەین! هەموو هەفتەیەک ٦ سکە خەرجی گیرفان وەردەگریت. سەرەتا ئامانجەکەت هەڵبژێرە.',
                  "Let's save for a goal! Every week you get 6 coins of pocket money. First, choose your goal."),
        draw: function (st) {
          this.next(!!st.goal);
          return '<div class="kp-grid">' + GOALS.map(function (g) {
            return '<button type="button" class="kp-card' + (st.goal === g.k ? ' good' : '') + '" data-g="' + g.k + '"><span class="kp-emo">' + g.ic + '</span><b>' +
              esc(T(g.t)) + '</b><br>🪙 ' + n(g.cost) + '</button>';
          }).join('') + '</div>';
        },
        wire: function (st, stage) { var self = this; stage.querySelectorAll('[data-g]').forEach(function (b) { b.addEventListener('click', function () { st.goal = b.dataset.g; self.render(); }); }); } },
      { intro: tr('قبل از خرج کردن: «نیاز» چیزی است که بدون آن نمی‌شود، «خواسته» چیزی است که فقط دوستش داریم. هر کدام را مرتب کن.',
                  'پێش خەرجکردن: «پێویستی» شتێکە بەبێ ئەو ناکرێت، «ئارەزوو» شتێکە تەنها حەزمان لێیە. هەریەکەیان ڕیز بکە.',
                  "Before spending: a 'need' is something you can't do without, a 'want' is something you just like. Sort each one."),
        draw: function (st) {
          var done = Object.keys(st.sorted).length === SORT.length;
          this.next(done);
          if (done) this.say(tr('{k} از ۶ را درست زدی! همیشه اول نیازها، بعد خواسته‌ها.', '{k} لە ٦ ڕاست بوو! هەمیشە سەرەتا پێویستییەکان، دواتر ئارەزووەکان.', 'You got {k} of 6 right! Needs first, then wants.'), st.ok >= 5 ? 'wow' : 'happy', { k: n(st.ok) });
          return '<div class="kp-grid">' + SORT.map(function (x, i) {
            var a = st.sorted[i], cls = a == null ? '' : (a === x.need ? ' good' : ' bad');
            return '<div class="kp-card' + cls + '"><span class="kp-emo">' + x.ic + '</span><b>' + esc(T(x.t)) + '</b><div class="kp-row" style="justify-content:center;margin-top:8px">' +
              '<button class="kp-btn alt" type="button" data-s="' + i + '" data-v="1"' + (a != null ? ' disabled' : '') + '>' + T(tr('نیاز', 'پێویستی', 'Need')) + '</button>' +
              '<button class="kp-btn alt" type="button" data-s="' + i + '" data-v="0"' + (a != null ? ' disabled' : '') + '>' + T(tr('خواسته', 'ئارەزوو', 'Want')) + '</button></div></div>';
          }).join('') + '</div>';
        },
        wire: function (st, stage) {
          var self = this;
          stage.querySelectorAll('[data-s]').forEach(function (b) {
            b.addEventListener('click', function () {
              var i = +b.dataset.s, v = b.dataset.v === '1'; if (st.sorted[i] != null) return;
              st.sorted[i] = v; if (v === SORT[i].need) st.ok++;
              self.render();
            });
          });
        } },
      { intro: '',
        draw: function (st) {
          var g = GOALS.filter(function (x) { return x.k === st.goal; })[0], self = this;
          var cost = g.cost + st.extra;
          if (st.week >= WEEKS.length) return '';                 // the last week's button moves on itself
          var w = WEEKS[st.week];
          var head = '<h2>' + fill(tr('هفتهٔ {w}', 'هەفتەی {w}', 'Week {w}'), { w: n(st.week + 1) }) + '</h2>' +
            '<div class="kp-row" style="align-items:center;gap:18px"><div class="kp-jar">' + jar(st.saved / cost) + '</div><div style="flex:1">' +
            '<p>' + fill(tr('هدف: {g} {t} — {c} سکه', 'ئامانج: {g} {t} — {c} سکە', 'Goal: {g} {t} — {c} coins'), { g: g.ic, t: esc(T(g.t)), c: n(cost) }) + '</p>' +
            '<div class="kp-meter"><i style="width:' + Math.min(100, Math.round(100 * st.saved / cost)) + '%"></i></div>' +
            '<p>' + fill(tr('در قلک: {s} سکه', 'لە قوتووەکەدا: {s} سکە', 'In the jar: {s} coins'), { s: n(st.saved) }) + '</p></div></div>';
          if (!st.decided) {
            this.say(w.rise ? tr('اوه! این هفته قیمت‌ها کمی بالا رفت؛ هدفت ۲ سکه گران‌تر شد. وقتی قیمت‌ها بالا می‌رود، با همان سکه‌ها کمتر می‌شود خرید. پس بهتر است کمی بیشتر کنار بگذاری.',
                                     'ئۆی! ئەم هەفتەیە نرخەکان کەمێک بەرز بوونەوە؛ ئامانجەکەت ٢ سکە گرانتر بوو. کاتێک نرخەکان بەرز دەبنەوە، بە هەمان سکەکان کەمتر دەکڕیت. بۆیە باشترە کەمێک زیاتر پاشەکەوت بکەیت.',
                                     'Oh! Prices went up a little this week; your goal costs 2 more coins. When prices rise, the same coins buy less, so it helps to save a bit extra.')
                              : tr('۶ سکهٔ این هفته رسید! حالا تصمیم بگیر.', '٦ سکەی ئەم هەفتەیە گەیشت! ئێستا بڕیار بدە.', 'This week’s 6 coins arrived! Now decide.'), w.rise ? 'wow' : 'happy');
            return head + '<div class="kp-card" style="max-width:420px;margin:10px auto"><span class="kp-emo">' + w.ic + '</span><b>' + esc(T(w.t)) + '</b> — 🪙 ' + n(w.cost) +
              '<div class="kp-row" style="justify-content:center;margin-top:10px"><button class="kp-btn" type="button" id="kpBuy">' + T(tr('بخر', 'بیکڕە', 'Buy')) + '</button>' +
              '<button class="kp-btn alt" type="button" id="kpKeep">' + T(tr('نه، پس‌انداز کن', 'نا، پاشەکەوتی بکە', 'No, save it')) + '</button></div></div>';
          }
          var lastWeek = st.week === WEEKS.length - 1;
          this.nav([{ label: lastWeek ? W.next : tr('هفتهٔ بعد', 'هەفتەی دواتر', 'Next week'), on: function () {
            st.week++; st.decided = false; st.msg = null;
            if (lastWeek) self.go(self.step + 1); else self.render();
          } }]);
          this.say(st.msg, st.mood);
          return head + '<p class="kp-note">' + esc(T(st.msg)) + '</p>';
        },
        wire: function (st, stage) {
          var self = this, w = WEEKS[st.week];
          function decide(buy) {
            st.saved += POCKET; if (w.rise) st.extra += w.rise;
            if (buy) { st.saved -= w.cost; st.bought.push(st.week); if (w.need) st.needBought = true; }
            st.decided = true;
            var msg = buy ? (w.need ? tr('درست بود! دفتر برای مدرسه «نیاز» است. نیازها اول.', 'ڕاست بوو! دەفتەر بۆ قوتابخانە «پێویستی»یە. پێویستییەکان سەرەتا.', 'Good call! A school notebook is a need. Needs first.')
                                    : w.need === null ? tr('مهربانی هم مهم است 💛 فقط یادت باشد هدفت کمی دیرتر می‌رسد.', 'میهرەبانیش گرنگە 💛 تەنها لەبیرت بێت ئامانجەکەت کەمێک دواتر دەگات.', "Kindness matters too 💛 Just remember your goal will take a little longer.")
                                    : tr('خریدی. اشکالی ندارد گاهی چیزی را که دوست داری بخری، ولی ببین قلکت کمتر پر شد.', 'کڕیت. هیچ نییە جاروبار شتێک بکڕیت کە حەزت لێیەتی، بەڵام بزانە قوتووەکەت کەمتر پڕ بوو.', "You bought it. It's fine to buy something you like sometimes, but see how the jar filled less."))
                         : (w.need ? tr('هوم… دفتر برای مدرسه لازم بود. یادت باشد: نیازها قبل از پس‌انداز برای خواسته‌ها.', 'هوم… دەفتەر بۆ قوتابخانە پێویست بوو. لەبیرت بێت: پێویستییەکان پێش پاشەکەوت بۆ ئارەزووەکان.', 'Hmm… the notebook was needed for school. Remember: needs come before saving for wants.')
                                   : tr('آفرین! سکه‌هایت در قلک ماند. سکه‌های کوچک کم‌کم زیاد می‌شوند.', 'ئافەرین! سکەکانت لە قوتووەکەدا مانەوە. سکە بچووکەکان هێدی هێدی زۆر دەبن.', 'Nice! Your coins stayed in the jar. Small coins add up.'));
            st.msg = msg; st.mood = buy && !w.need && w.need !== null ? 'think' : 'happy';
            self.render();
          }
          var b = stage.querySelector('#kpBuy'), k = stage.querySelector('#kpKeep');
          if (b) b.addEventListener('click', function () { decide(true); });
          if (k) k.addEventListener('click', function () { decide(false); });
        } },
      { intro: '',
        draw: function (st) {
          var g = GOALS.filter(function (x) { return x.k === st.goal; })[0], cost = g.cost + st.extra, ok = st.saved >= cost;
          this.say(ok ? tr('هورا! به {g} رسیدی! 🎉', 'هوڕا! گەیشتیتە {g}! 🎉', 'Hooray! You reached {g}! 🎉')
                      : tr('{k} سکهٔ دیگر مانده — یکی دو هفتهٔ دیگر به {g} می‌رسی. هدف‌های بزرگ وقت بیشتری می‌خواهند.', '{k} سکەی تر ماوە — یەک دوو هەفتەی تر دەگەیتە {g}. ئامانجە گەورەکان کاتی زیاتریان دەوێت.', '{k} more coins — one or two more weeks and you reach {g}. Big goals take longer.'),
                   ok ? 'wow' : 'happy', { g: g.ic + ' ' + T(g.t), k: n(cost - st.saved) });
          return '<div class="kp-jar">' + jar(st.saved / cost) + '</div>' +
            this.finish(st, [tr('اول نیازها، بعد خواسته‌ها.', 'سەرەتا پێویستییەکان، دواتر ئارەزووەکان.', 'Needs first, then wants.'),
              tr('سکه‌های کوچکِ هر هفته کم‌کم به یک هدف بزرگ می‌رسند.', 'سکە بچووکەکانی هەموو هەفتەیەک هێدی هێدی دەگەنە ئامانجێکی گەورە.', 'Small weekly coins slowly add up to a big goal.'),
              tr('قیمت‌ها ممکن است بالا بروند؛ کمی بیشتر کنار بگذار.', 'نرخەکان لەوانەیە بەرز ببنەوە؛ کەمێک زیاتر پاشەکەوت بکە.', 'Prices can rise, so save a little extra.')],
              tr('قهرمان پس‌انداز', 'پاڵەوانی پاشەکەوت', 'Saving hero'), this.g.chapter);
        } }
    ]
  };

  /* ================================================================ chain */
  function sha(s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function fp(hex) {
    var sq = ''; for (var i = 0; i < 8; i++) { var v = parseInt(hex.substr(i * 2, 2), 16); sq += '<i style="background:hsl(' + Math.round(v * 360 / 256) + ' 75% ' + (40 + (v % 3) * 10) + '%)"></i>'; }
    return '<div class="kp-fp" aria-hidden="true">' + sq + '</div><div class="kp-hex">' + hex.slice(0, 16) + '…</div>';
  }
  var PEOPLE = [tr('علی', 'عەلی', 'Ali'), tr('سارا', 'سارا', 'Sara'), tr('رضا', 'ڕەزا', 'Reza'), tr('نرگس', 'نێرگز', 'Narges')];
  function blockText(b, prev) { return '#' + b.i + '|' + b.from + '>' + b.to + ':' + b.amt + '|' + prev; }
  function chainHashes(blocks) {
    var prev = '0000', out = [];
    return blocks.reduce(function (p, b) {
      return p.then(function () { return sha(blockText(b, b.prevStored != null ? b.prevStored : prev)).then(function (h) { out.push(h); prev = h; }); });
    }, Promise.resolve()).then(function () { return out; });
  }
  var CHAIN = {
    id: 'chain', color: '#facc15', chapter: '/kids/m6/',
    init: function () {
      return { word: tr('سلام', 'سڵاو', 'hello')[L()] || 'hello', tried: {}, labDone: false,
        blocks: [{ i: 1, from: 0, to: 1, amt: 2 }, { i: 2, from: 1, to: 2, amt: 1 }, { i: 3, from: 2, to: 3, amt: 3 }],
        sealed: false, tampered: false, caught: false, firstTry: true, nonce: 0, mined: null, auto: false };
    },
    stars: function (st) { return (st.labDone ? 1 : 0) + (st.caught && st.firstTry ? 1 : 0) + (st.mined ? 1 : 0); },
    steps: [
      { intro: tr('این زنجیره چطور امن می‌ماند؟ اول با «اثر انگشت دیجیتال» آشنا شو. یک کلمه بنویس و اثر انگشتش را ببین. بعد فقط یک حرفش را عوض کن!',
                  'ئەم زنجیرەیە چۆن پارێزراو دەمێنێتەوە؟ سەرەتا لەگەڵ «پەنجەمۆری دیجیتاڵ» ئاشنا بە. وشەیەک بنووسە و پەنجەمۆرەکەی ببینە. دواتر تەنها یەک پیتی بگۆڕە!',
                  "How does this chain stay safe? First meet the 'digital fingerprint'. Type a word and see its fingerprint. Then change just one letter!"),
        draw: function (st) {
          this.next(st.labDone);
          if (st.labDone) this.say(tr('دیدی؟ یک حرف کوچک، اثر انگشت را کاملاً عوض کرد! هیچ دو چیزی اثر انگشت یکسان ندارند.', 'بینیت؟ پیتێکی بچووک پەنجەمۆرەکەی بە تەواوی گۆڕی! هیچ دوو شتێک یەک پەنجەمۆریان نییە.', 'See? One small letter changed the whole fingerprint! No two things share a fingerprint.'), 'wow');
          return '<label>' + T(tr('یک کلمه بنویس:', 'وشەیەک بنووسە:', 'Type a word:')) + '<input class="kp-in" id="kpWord" maxlength="40" value="' + esc(st.word) + '"></label><div id="kpFp" style="margin-top:10px"></div>';
        },
        wire: function (st, stage) {
          var self = this, inp = stage.querySelector('#kpWord'), out = stage.querySelector('#kpFp');
          function upd() {
            var v = inp.value; st.word = v; sha(v).then(function (h) { if (inp.value === v) out.innerHTML = fp(h); });
            st.tried[v] = 1;
            if (!st.labDone && Object.keys(st.tried).length >= 3) { st.labDone = true; self.next(true);
              self.talk(tr('دیدی؟ یک حرف کوچک، اثر انگشت را کاملاً عوض کرد! هیچ دو چیزی اثر انگشت یکسان ندارند.', 'بینیت؟ پیتێکی بچووک پەنجەمۆرەکەی بە تەواوی گۆڕی! هیچ دوو شتێک یەک پەنجەمۆریان نییە.', 'See? One small letter changed the whole fingerprint! No two things share a fingerprint.'), 'wow'); self.paint(); }
          }
          inp.addEventListener('input', upd); upd();
        } },
      { intro: tr('حالا یک زنجیره بساز. هر بلوک یک جابه‌جایی را می‌نویسد و اثر انگشت بلوک قبلی را هم در خودش نگه می‌دارد ⛓️ می‌توانی اسم‌ها و تعداد را عوض کنی.',
                  'ئێستا زنجیرەیەک دروست بکە. هەر بلۆکێک گواستنەوەیەک دەنووسێت و پەنجەمۆری بلۆکی پێشووش لە خۆیدا هەڵدەگرێت ⛓️ دەتوانیت ناوەکان و ژمارەکە بگۆڕیت.',
                  'Now build a chain. Each block writes down one transfer and also keeps the fingerprint of the block before it ⛓️ You can change the names and the number.'),
        draw: function (st) {
          this.next(true);
          return '<div class="kp-chain" id="kpChain"></div>';
        },
        wire: function (st, stage) {
          var self = this;
          st.blocks.forEach(function (b) { delete b.prevStored; });
          function draw() {
            chainHashes(st.blocks).then(function (hs) {
              var h = '';
              st.blocks.forEach(function (b, i) {
                var sel = function (k) { return '<select data-b="' + i + '" data-k="' + k + '">' + PEOPLE.map(function (p, j) { return '<option value="' + j + '"' + (b[k] === j ? ' selected' : '') + '>' + esc(T(p)) + '</option>'; }).join('') + '</select>'; };
                h += (i ? '<div class="kp-link">⛓️</div>' : '') + '<div class="kp-blk"><b>' + T(tr('بلوک', 'بلۆک', 'Block')) + ' ' + n(b.i) + '</b><p style="margin:6px 0">' + sel('from') + ' ➜ ' + sel('to') +
                  ' <select data-b="' + i + '" data-k="amt">' + [1, 2, 3, 4, 5].map(function (a) { return '<option value="' + a + '"' + (b.amt === a ? ' selected' : '') + '>' + n(a) + ' 🍎</option>'; }).join('') + '</select></p>' + fp(hs[i]) + '</div>';
              });
              stage.querySelector('#kpChain').innerHTML = h;
              stage.querySelectorAll('select').forEach(function (s) { s.addEventListener('change', function () { st.blocks[+s.dataset.b][s.dataset.k] = +s.value; draw(); }); });
            });
          }
          draw();
          this.nav([{ label: W.next, on: function () {
            chainHashes(st.blocks).then(function (hs) {
              st.blocks.forEach(function (b, i) { b.prevStored = i ? hs[i - 1] : '0000'; });
              st.sealed = true; st.tampered = false; st.caught = false; st.firstTry = true; self.go(self.step + 1);
            });
          } }]);
        } },
      { intro: tr('اوه نه! 🦝 راکونِ شیطون یواشکی یکی از بلوک‌های قدیمی را عوض کرد. روی بلوکی بزن که فکر می‌کنی دستکاری شده.',
                  'ئۆی نا! 🦝 ڕاکونە شەیتانەکە بە دزییەوە یەکێک لە بلۆکە کۆنەکانی گۆڕی. لەسەر ئەو بلۆکە دابگرە کە پێتوایە دەستکاری کراوە.',
                  'Oh no! 🦝 The sneaky raccoon secretly changed one of the old blocks. Tap the block you think was tampered with.'),
        draw: function (st) { this.next(st.caught); return '<div class="kp-chain" id="kpChain"></div>'; },
        wire: function (st, stage) {
          var self = this;
          if (!st.tampered) { st.blocks[1].amt = 9; st.tampered = true; }
          chainHashes(st.blocks).then(function (hs) {
            var h = '';
            st.blocks.forEach(function (b, i) {
              var brokenLink = i > 0 && b.prevStored !== hs[i - 1];
              h += (i ? '<div class="kp-link' + (brokenLink ? ' broken' : '') + '">' + (brokenLink ? '💥' : '⛓️') + '</div>' : '') +
                '<button type="button" class="kp-card kp-blk' + (brokenLink ? ' broken' : '') + (st.caught && i === 1 ? ' good' : '') + '" data-i="' + i + '" style="text-align:start"><b>' + T(tr('بلوک', 'بلۆک', 'Block')) + ' ' + n(b.i) + '</b><p style="margin:6px 0">' +
                esc(T(PEOPLE[b.from])) + ' ➜ ' + esc(T(PEOPLE[b.to])) + ': ' + n(b.amt) + ' 🍎</p>' + fp(hs[i]) + '</button>';
            });
            stage.querySelector('#kpChain').innerHTML = h;
            stage.querySelectorAll('[data-i]').forEach(function (b) {
              b.addEventListener('click', function () {
                if (st.caught) return;
                var i = +b.dataset.i;
                if (i === 1) {
                  st.caught = true; self.render(); self.cheer();
                  self.talk(tr('گرفتیش! بلوک ۲ عوض شده بود: اثر انگشتش دیگر با چیزی که بلوک ۳ نگه داشته جور نیست، پس زنجیره همان‌جا پاره شد 💥 همه می‌توانند این را ببینند.',
                               'گرتت! بلۆکی ٢ گۆڕابوو: پەنجەمۆرەکەی ئیتر لەگەڵ ئەوەی بلۆکی ٣ هەڵیگرتووە ناگونجێت، بۆیە زنجیرەکە لەوێدا پچڕا 💥 هەموو کەس دەتوانێت ئەمە ببینێت.',
                               "Caught it! Block 2 was changed: its fingerprint no longer matches the one block 3 kept, so the chain snapped right there 💥 Everyone can see it."), 'wow');
                } else {
                  st.firstTry = false; b.classList.add('kp-shake'); setTimeout(function () { b.classList.remove('kp-shake'); }, 400);
                  self.talk(i === 2 ? tr('نزدیک بود! بلوک ۳ فقط نشان می‌دهد مشکلی هست. ببین زنجیره از کجا اول پاره شده 💥 و بلوکِ قبل از آن را بزن.', 'نزیک بوو! بلۆکی ٣ تەنها نیشان دەدات کێشەیەک هەیە. بزانە زنجیرەکە یەکەمجار لە کوێ پچڕاوە 💥 و بلۆکی پێش ئەوە دابگرە.', 'Close! Block 3 only shows something is wrong. See where the chain first snapped 💥 and tap the block before it.')
                                    : tr('بلوک ۱ سالم است؛ زنجیرهٔ بعد از آن هنوز وصل است ⛓️', 'بلۆکی ١ تەندروستە؛ زنجیرەی دوای ئەو هێشتا بەستراوە ⛓️', 'Block 1 is fine; the link after it still holds ⛓️'), 'think');
                }
              });
            });
          });
        } },
      { intro: tr('آخرین کار: برای اضافه کردن یک بلوک تازه باید یک «عدد خوش‌شانس» پیدا کنی تا اثر انگشت با «00» شروع شود. شانسی امتحان کن!',
                  'دوایین کار: بۆ زیادکردنی بلۆکێکی نوێ دەبێت «ژمارەیەکی بەختدار» بدۆزیتەوە تا پەنجەمۆرەکە بە «00» دەست پێبکات. بە هەڵکەوت تاقی بکەرەوە!',
                  "Last job: to add a new block you must find a 'lucky number' so the fingerprint starts with '00'. Try your luck!"),
        draw: function (st) {
          this.next(!!st.mined);
          return '<p>' + fill(tr('عدد امتحان‌شده: {n}', 'ژمارەی تاقیکراوە: {n}', 'Number tried: {n}'), { n: n(st.nonce) }) + '</p><div id="kpMine"></div>' +
            '<div class="kp-row" style="margin-top:10px"><button class="kp-btn" type="button" id="kpTry"' + (st.mined ? ' disabled' : '') + '>' + T(tr('یک بار امتحان کن', 'یەکجار تاقی بکەرەوە', 'Try once')) + '</button>' +
            '<button class="kp-btn alt" type="button" id="kpAuto"' + (st.mined ? ' disabled' : '') + '>' + T(tr('پشت سر هم امتحان کن', 'یەک لە دوای یەک تاقی بکەرەوە', 'Keep trying')) + '</button></div>';
        },
        wire: function (st, stage) {
          var self = this, box = stage.querySelector('#kpMine');
          function show(h) { box.innerHTML = fp(h) + (h.slice(0, 2) === '00' ? '<p class="kp-note">✅ 00!</p>' : ''); }
          function one() {
            st.nonce++;
            return sha('#4|' + st.nonce).then(function (h) {
              show(h);
              if (h.slice(0, 2) === '00') {
                st.mined = h; st.auto = false; self.render(); self.cheer();
                self.talk(tr('پیدا شد بعد از {n} بار! پیدا کردنش وقت و انرژی برد، ولی بررسی‌اش فقط یک قدم است. برای همین به یابنده پاداش می‌دهند.', 'دۆزرایەوە دوای {n} جار! دۆزینەوەی کات و وزەی برد، بەڵام پشکنینی تەنها یەک هەنگاوە. بۆیە پاداشت دەدرێت بە دۆزەرەوە.', 'Found after {n} tries! Finding it took time and energy, but checking it takes one step. That is why the finder gets a reward.'), 'wow', { n: n(st.nonce) });
                show(h);
              }
              return h;
            });
          }
          if (st.mined) show(st.mined);
          var t = stage.querySelector('#kpTry'), a = stage.querySelector('#kpAuto');
          t.addEventListener('click', function () { one().then(function () { if (!st.mined) { var p = stage.querySelector('p'); if (p) p.textContent = fill(tr('عدد امتحان‌شده: {n}', 'ژمارەی تاقیکراوە: {n}', 'Number tried: {n}'), { n: n(st.nonce) }); } }); });
          a.addEventListener('click', function () {
            st.auto = true; a.disabled = true;
            (function loop() {
              if (!st.auto || st.mined || !document.body.contains(a)) return;
              Promise.all([one(), one(), one(), one(), one()]).then(function () {
                var p = stage.querySelector('p'); if (p) p.textContent = fill(tr('عدد امتحان‌شده: {n}', 'ژمارەی تاقیکراوە: {n}', 'Number tried: {n}'), { n: n(st.nonce) });
                setTimeout(loop, 40);
              });
            })();
          });
        } },
      { intro: tr('تو یک نگهبان زنجیره هستی! ⛓️', 'تۆ پاسەوانێکی زنجیرەیت! ⛓️', "You're a chain guardian! ⛓️"),
        draw: function (st) {
          return this.finish(st, [tr('هر چیز یک اثر انگشت دیجیتال دارد؛ کوچک‌ترین تغییر آن را کاملاً عوض می‌کند.', 'هەموو شتێک پەنجەمۆرێکی دیجیتاڵی هەیە؛ بچووکترین گۆڕانکاری بە تەواوی دەیگۆڕێت.', 'Everything has a digital fingerprint; the smallest change alters it completely.'),
            tr('هر بلوک اثر انگشت بلوک قبلی را دارد؛ دستکاری گذشته زنجیره را پاره می‌کند و همه می‌بینند.', 'هەر بلۆکێک پەنجەمۆری بلۆکی پێشووی هەیە؛ دەستکاریکردنی ڕابردوو زنجیرەکە دەپچڕێنێت و هەموو کەس دەیبینێت.', 'Each block holds the previous fingerprint; changing the past snaps the chain for all to see.'),
            tr('پیدا کردن عدد خوش‌شانس سخت است و انرژی می‌برد، ولی بررسی‌اش آسان است.', 'دۆزینەوەی ژمارەی بەختدار سەختە و وزە دەبات، بەڵام پشکنینی ئاسانە.', 'Finding the lucky number is hard work; checking it is easy.')],
            tr('نگهبان زنجیره', 'پاسەوانی زنجیرە', 'Chain guardian'), this.g.chapter);
        } }
    ]
  };

  /* ================================================================ scam */
  var MSGS = [
    { from: tr('🎁 ناشناس', '🎁 نەناسراو', '🎁 Unknown'), t: tr('تبریک! تو یک بیت‌کوین مجانی بردی. ۱۲ کلمهٔ مخفی کیف پولت را بفرست تا جایزه را بگیری.', 'پیرۆزە! تۆ بیتکۆینێکی بێبەرامبەرت بردەوە. ١٢ وشە نهێنییەکەی جزدانەکەت بنێرە بۆ وەرگرتنی خەڵاتەکە.', 'Congratulations! You won a free bitcoin. Send the 12 secret words of your wallet to get the prize.'), scam: true,
      why: tr('هیچ‌کس با گرفتن کلمه‌های مخفی جایزه نمی‌دهد. کلمه‌های مخفی یعنی کلید همهٔ پولت.', 'هیچ کەسێک بە وەرگرتنی وشە نهێنییەکان خەڵات نادات. وشە نهێنییەکان یانی کلیلی هەموو پارەکەت.', 'Nobody gives prizes for your secret words. Those words are the key to all your money.') },
    { from: tr('👩 مامان', '👩 دایکە', '👩 Mom'), t: tr('شام ساعت ۷ آماده است 🍲', 'نانی ئێوارە کاتژمێر ٧ ئامادەیە 🍲', 'Dinner is ready at 7 🍲'), scam: false,
      why: tr('پیام معمولی از کسی که می‌شناسی؛ چیزی از تو نمی‌خواهد.', 'نامەیەکی ئاسایی لە کەسێک کە دەیناسیت؛ هیچ شتێکی لێت ناوێت.', "A normal message from someone you know; it asks for nothing.") },
    { from: tr('🎮 «پشتیبانی بازی»', '🎮 «پشتگیریی یاری»', '🎮 "Game support"'), t: tr('حسابت قفل شد! همین الان رمزت را در gamee-free.xyz وارد کن.', 'هەژمارەکەت داخرا! هەر ئێستا وشەی نهێنییەکەت لە gamee-free.xyz بنووسە.', 'Your account is locked! Enter your password at gamee-free.xyz right now.'), scam: true,
      why: tr('عجله انداختن + آدرس عجیب = کلاهبرداری. فقط از خود برنامه وارد شو و به یک بزرگ‌تر بگو.', 'پەلەپێکردن + ناونیشانی سەیر = فێڵ. تەنها لە خودی بەرنامەکەوە بچۆ ژوورەوە و بە کەسێکی گەورە بڵێ.', "Rushing you + a strange address = scam. Only sign in from the app itself, and tell a grown-up.") },
    { from: tr('👨‍🏫 معلم', '👨‍🏫 مامۆستا', '👨‍🏫 Teacher'), t: tr('تکلیف ریاضی را تا یکشنبه بیاورید.', 'ئەرکی بیرکاری تا یەکشەممە بهێنن.', 'Bring the maths homework by Sunday.'), scam: false,
      why: tr('یک یادآوری معمولی؛ نه رمز می‌خواهد نه پول.', 'بیرخستنەوەیەکی ئاسایی؛ نە وشەی نهێنی دەوێت نە پارە.', "An ordinary reminder; it asks for no password and no money.") },
    { from: tr('🧑‍💻 «پشتیبانی»', '🧑‍💻 «پشتگیری»', '🧑‍💻 "Support"'), t: tr('من از پشتیبانی هستم. رمزت را بگو تا کمکت کنم.', 'من لە پشتگیرییەوەم. وشەی نهێنییەکەت پێم بڵێ تا یارمەتیت بدەم.', "I'm from support. Tell me your password so I can help."), scam: true,
      why: tr('پشتیبانی واقعی هیچ‌وقت رمزت را نمی‌پرسد.', 'پشتگیریی ڕاستەقینە هەرگیز وشەی نهێنییەکەت ناپرسێت.', 'Real support never asks for your password.') },
    { from: tr('💸 ناشناس', '💸 نەناسراو', '💸 Unknown'), t: tr('سکه‌هایت را دو برابر کن! ۱ سکه بفرست، ۲ تا پس بگیر.', 'سکەکانت دوو هێندە بکە! ١ سکە بنێرە، ٢ وەربگرەوە.', 'Double your coins! Send 1 coin, get 2 back.'), scam: true,
      why: tr('چیزی که بیش از حد خوب به نظر می‌رسد، معمولاً راست نیست.', 'شتێک کە زۆر لە ڕادە بەدەر باش دیارە، زۆربەی کات ڕاست نییە.', "If it sounds too good to be true, it usually isn't true.") },
    { from: tr('👦 دوستت', '👦 هاوڕێکەت', '👦 Your friend'), t: tr('بعد از مدرسه فوتبال بازی کنیم؟ ⚽', 'دوای قوتابخانە تۆپێن بکەین؟ ⚽', 'Football after school? ⚽'), scam: false,
      why: tr('دوستی که می‌شناسی، دعوت به بازی؛ هیچ خطری ندارد.', 'هاوڕێیەک کە دەیناسیت، بانگهێشتی یاری؛ هیچ مەترسییەکی نییە.', 'A friend you know inviting you to play: nothing risky.') },
    { from: tr('🔐 برنامهٔ کیف پول', '🔐 بەرنامەی جزدان', '🔐 Wallet app'), t: tr('یادآوری: کلمه‌های مخفی‌ات را به هیچ‌کس نشان نده.', 'بیرخستنەوە: وشە نهێنییەکانت بە هیچ کەسێک نیشان مەدە.', 'Reminder: never show your secret words to anyone.'), scam: false,
      why: tr('این یک یادآوری درست است و چیزی از تو نمی‌خواهد.', 'ئەمە بیرخستنەوەیەکی دروستە و هیچ شتێکی لێت ناوێت.', "That's a good reminder, and it asks you for nothing.") }
  ];
  var QUIZ = [tr('دوست صمیمی‌ام', 'هاوڕێ نزیکەکەم', 'my best friend'), tr('کسی که می‌گوید از پشتیبانی است', 'کەسێک دەڵێت لە پشتگیرییەوەیە', 'someone who says they are support'),
    tr('معلمم', 'مامۆستاکەم', 'my teacher'), tr('هیچ‌کس', 'هیچ کەسێک', 'nobody')];
  var WORDS = [tr('زرافه', 'زەڕافە', 'giraffe'), tr('ابر', 'هەور', 'cloud'), tr('لیمو', 'لیمۆ', 'lemon'), tr('موشک', 'ڕۆکێت', 'rocket'),
    tr('رودخانه', 'ڕووبار', 'river'), tr('ببر', 'پڵنگ', 'tiger'), tr('ماه', 'مانگ', 'moon'), tr('پنجره', 'پەنجەرە', 'window'),
    tr('باغ', 'باخ', 'garden'), tr('حباب', 'بڵق', 'bubble'), tr('قلعه', 'قەڵا', 'castle'), tr('پروانه', 'پەپوولە', 'butterfly')];
  var SCAM = {
    id: 'scam', color: '#a78bfa', chapter: '/kids/m4/',
    init: function () { return { i: 0, ok: 0, answered: null, quiz: null, pick: [] }; },
    stars: function (st) { return (st.ok >= 7 ? 1 : 0) + (st.quiz === 3 ? 1 : 0) + (st.pick.length >= 4 ? 1 : 0); },
    steps: [
      { intro: tr('در دنیای آنلاین بعضی‌ها با پیام‌های فریبنده دنبال رمز یا پول بقیه‌اند. بیا شکارچی کلاهبرداری شویم! هر پیام را بخوان و بگو امن است یا کلاهبرداری.',
                  'لە جیهانی ئۆنلایندا هەندێک کەس بە نامەی فریودەر بەدوای وشەی نهێنی یان پارەی خەڵکدا دەگەڕێن. با ببینە ڕاوچیی فێڵ! هەر نامەیەک بخوێنەوە و بڵێ سەلامەتە یان فێڵە.',
                  "Online, some people send tricky messages to get others' passwords or money. Let's become scam hunters! Read each message and say: safe or scam?"),
        draw: function (st) {
          var m = MSGS[st.i], self = this;
          var h = '<p class="kp-hint">' + fill(tr('پیام {a} از {b}', 'نامەی {a} لە {b}', 'Message {a} of {b}'), { a: n(st.i + 1), b: n(MSGS.length) }) + '</p>' +
            '<div class="kp-msg"><small>' + esc(T(m.from)) + '</small>' + esc(T(m.t)) + '</div>';
          if (st.answered == null) {
            h += '<div class="kp-yn"><button class="safe" type="button" data-a="0">✅ ' + T(tr('امن', 'سەلامەت', 'Safe')) + '</button><button class="scam" type="button" data-a="1">🚩 ' + T(tr('کلاهبرداری', 'فێڵ', 'Scam')) + '</button></div>';
            this.nav([]);
          } else {
            var right = st.answered === m.scam;
            this.say(right ? tr('درست! ', 'ڕاستە! ', 'Right! ') : tr('نه این بار. ', 'ئەمجارە نا. ', 'Not this time. '), right ? 'wow' : 'think');
            this.text += T(m.why);
            h += '<p class="kp-note">' + (m.scam ? '🚩 ' : '✅ ') + esc(T(m.why)) + '</p>';
            var last = st.i === MSGS.length - 1;
            this.nav([{ label: last ? W.next : tr('پیام بعدی', 'نامەی دواتر', 'Next message'), on: function () { if (last) self.go(self.step + 1); else { st.i++; st.answered = null; self.render(); } } }]);
          }
          return h;
        },
        wire: function (st, stage) {
          var self = this;
          stage.querySelectorAll('[data-a]').forEach(function (b) {
            b.addEventListener('click', function () { st.answered = b.dataset.a === '1'; if (st.answered === MSGS[st.i].scam) st.ok++; self.render(); });
          });
        } },
      { intro: tr('سؤال مهم: «کلمه‌های مخفی» کیف پول (معمولاً ۱۲ کلمه) را به چه کسی می‌توانی نشان بدهی؟',
                  'پرسیارێکی گرنگ: «وشە نهێنییەکانی» جزدان (زۆرجار ١٢ وشە) دەتوانیت بە کێ نیشان بدەیت؟',
                  "Big question: who can you show your wallet's 'secret words' (usually 12 words) to?"),
        draw: function (st) {
          this.next(st.quiz === 3);
          if (st.quiz === 3) this.say(tr('آفرین! به هیچ‌کس. آن‌ها را روی کاغذ بنویس و با کمک یک بزرگ‌ترِ مورد اعتماد در خانه جای امن نگه دار.', 'ئافەرین! بە هیچ کەسێک. لەسەر کاغەز بیاننووسە و بە یارمەتیی کەسێکی گەورەی متمانەپێکراو لە ماڵەوە لە شوێنێکی پارێزراو هەڵیانبگرە.', 'Yes! Nobody. Write them on paper and keep them somewhere safe at home, with a grown-up you trust.'), 'wow');
          else if (st.quiz != null) this.say(tr('نه… هر کس این کلمه‌ها را ببیند می‌تواند همهٔ پولت را بردارد، حتی اگر آدم خوبی به نظر برسد. دوباره فکر کن!', 'نا… هەر کەسێک ئەم وشانە ببینێت دەتوانێت هەموو پارەکەت ببات، تەنانەت ئەگەر کەسێکی باشیش دیار بێت. دووبارە بیر بکەوە!', "No… anyone who sees these words can take all your money, even if they seem nice. Think again!"), 'think');
          return '<div class="kp-grid">' + QUIZ.map(function (q, i) {
            return '<button type="button" class="kp-card' + (st.quiz === i ? (i === 3 ? ' good' : ' bad') : '') + '" data-q="' + i + '">' + esc(T(q)) + '</button>';
          }).join('') + '</div>';
        },
        wire: function (st, stage) { var self = this; stage.querySelectorAll('[data-q]').forEach(function (b) { b.addEventListener('click', function () { if (st.quiz === 3) return; st.quiz = +b.dataset.q; self.render(); }); }); } },
      { intro: tr('حالا یک «رمزِ عبارتی» قوی بساز: ۴ کلمهٔ نامربوط را انتخاب کن. کلمه‌های بی‌ربط و طولانی از «1234» خیلی قوی‌ترند!',
                  'ئێستا «وشەی نهێنیی ڕستەیی» بەهێز دروست بکە: ٤ وشەی پەیوەندیی‌نەدار هەڵبژێرە. وشەی بێ‌پەیوەندی و درێژ زۆر لە «1234» بەهێزترن!',
                  "Now build a strong 'passphrase': pick 4 unrelated words. Long, random words are far stronger than '1234'!"),
        draw: function (st) {
          this.next(st.pick.length >= 4);
          var phrase = st.pick.map(function (i) { return T(WORDS[i]); }).join('-');
          var lvl = st.pick.length >= 4 ? 3 : st.pick.length >= 2 ? 2 : st.pick.length ? 1 : 0;
          var bar = function (w, c, label) { return '<div style="display:flex;gap:8px;align-items:center;margin:4px 0"><span class="kp-hex" style="min-width:150px">' + label + '</span><div class="kp-meter" style="flex:1"><i style="width:' + w + '%;background:' + c + '"></i></div></div>'; };
          if (st.pick.length >= 4) this.say(tr('عالی! این رمز بلند و تصادفی است. یادت باشد: آن را تکراری استفاده نکن و به هیچ‌کس نگو.', 'نایابە! ئەم وشە نهێنییە درێژ و هەڕەمەکییە. لەبیرت بێت: دووبارە بەکاری مەهێنە و بە هیچ کەسێک مەڵێ.', "Excellent! That's long and random. Remember: don't reuse it, and tell no one."), 'wow');
          return '<div class="kp-words">' + WORDS.map(function (w, i) { return '<button type="button" data-w="' + i + '" class="' + (st.pick.indexOf(i) >= 0 ? 'on' : '') + '">' + esc(T(w)) + '</button>'; }).join('') + '</div>' +
            '<p><b>' + T(tr('رمز تو:', 'وشە نهێنییەکەت:', 'Your passphrase:')) + '</b> <span class="kp-inv">' + (esc(phrase) || '…') + '</span></p>' +
            bar(8, '#f87171', '1234') + bar(20, '#fb923c', 'ali2015') + bar([0, 30, 60, 100][lvl], '#4ade80', T(tr('رمز تو', 'هی تۆ', 'yours')));
        },
        wire: function (st, stage) {
          var self = this;
          stage.querySelectorAll('[data-w]').forEach(function (b) {
            b.addEventListener('click', function () { var i = +b.dataset.w, k = st.pick.indexOf(i); if (k >= 0) st.pick.splice(k, 1); else if (st.pick.length < 4) st.pick.push(i); self.render(); });
          });
        } },
      { intro: tr('تو یک شکارچی کلاهبرداری هستی! 🕵️', 'تۆ ڕاوچییەکی فێڵیت! 🕵️', "You're a scam hunter! 🕵️"),
        draw: function (st) {
          return '<p>' + fill(tr('از {b} پیام، {a} تا را درست تشخیص دادی.', 'لە {b} نامە، {a}ت بە دروستی ناسییەوە.', 'You judged {a} of {b} messages correctly.'), { a: n(st.ok), b: n(MSGS.length) }) + '</p>' +
            this.finish(st, [tr('پیامی که عجله می‌اندازد، رمز می‌خواهد یا جایزهٔ عجیب می‌دهد، کلاهبرداری است.', 'نامەیەک پەلە دەخاتە سەرت، وشەی نهێنی دەوێت یان خەڵاتی سەیر دەدات، فێڵە.', 'A message that rushes you, wants a password, or offers a strange prize is a scam.'),
              tr('کلمه‌های مخفی کیف پول را به هیچ‌کس نشان نده؛ با یک بزرگ‌ترِ مورد اعتماد امن نگهشان دار.', 'وشە نهێنییەکانی جزدان بە هیچ کەسێک نیشان مەدە؛ لەگەڵ کەسێکی گەورەی متمانەپێکراو بە پارێزراوی هەڵیانبگرە.', 'Never show your wallet’s secret words to anyone; keep them safe with a grown-up you trust.'),
              tr('رمز خوب بلند و تصادفی است و هیچ‌وقت تکراری نیست.', 'وشەی نهێنیی باش درێژ و هەڕەمەکییە و هەرگیز دووبارە نییە.', 'A good password is long, random and never reused.'),
              tr('اگر شک داری، اول از یک بزرگ‌تر بپرس.', 'ئەگەر دوودڵیت، سەرەتا لە کەسێکی گەورە بپرسە.', "If you're unsure, ask a grown-up first.")],
              tr('شکارچی کلاهبرداری', 'ڕاوچیی فێڵ', 'Scam hunter'), this.g.chapter);
        } }
    ]
  };

  var GAMES = { market: MARKET, piggy: PIGGY, chain: CHAIN, scam: SCAM };

  /* ---------------- hub: stars + badges from what this device has played ---------------- */
  function paintHub() {
    var s = store.all();
    hub.querySelectorAll('[data-stars]').forEach(function (el) {
      var k = el.getAttribute('data-stars'), v = s[k] || 0, h = '';
      for (var i = 0; i < 3; i++) h += '<i class="' + (i < v ? 'on' : '') + '">⭐</i>';
      el.innerHTML = h; el.setAttribute('aria-label', n(v) + ' / ' + n(3));
    });
    hub.querySelectorAll('[data-badge]').forEach(function (el) { el.classList.toggle('on', (s[el.getAttribute('data-badge')] || 0) > 0); });
    var sk = hub.querySelector('#kpHubSeko'); if (sk && !sk.firstChild) sk.innerHTML = seko('happy');
  }
  if (hub) { paintHub(); window.addEventListener('ek-lang', paintHub); }
  if (app) {
    var g = GAMES[app.getAttribute('data-game')];
    if (!g) return;
    if (!window.crypto || !crypto.subtle) CHAIN.steps.splice(0, CHAIN.steps.length - 1);   // very old browsers: skip the hashing steps
    new Runner(g);
  }
})();
