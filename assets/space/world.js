/* entekhab.net · the Entekhab world (/station/).
   A separate place for people who like games: an orbital station 408 km above the real Earth (NASA imagery, real stars),
   eight gates that lead to the site's sections, energy cells to collect, quests, a minimap, a customisable astronaut
   and Nima, the guide, as a hologram. Keyboard, mouse and touch. three.js r128, ES5, no network beyond this folder. */
(function (W, D) {
  'use strict';
  var T = W.THREE, SITE = '';
  var RED = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TOUCH = ('ontouchstart' in W) || navigator.maxTouchPoints > 0;
  if (TOUCH) D.documentElement.classList.add('touch');
  D.body.classList.add('pre');

  /* ---------------- words ---------------- */
  var I = {
    fa: { pv: 'پیش‌نمایش · هنوز روی سایت منتشر نشده', title: 'جهان انتخاب', exit: 'خروج به سایت',
      intro: 'به ایستگاه مداری انتخاب خوش آمدی، ۴۰۸ کیلومتر بالای زمین. هر دروازه تو را به یکی از بخش‌های سایت می‌برد.',
      name: 'اسم تو در ایستگاه', suit: 'رنگ لباس فضایی', visor: 'رنگ کلاه', start: 'شروع', keys: 'حرکت: WASD یا کلیدهای جهت · نگاه: بکش · پرش: Space · ورود: E',
      hint: 'حرکت <kbd>W A S D</kbd> · نگاه: بکش · پرش <kbd>Space</kbd> · ورود <kbd>E</kbd>', jump: 'پرش', use: 'ورود',
      quests: 'مأموریت‌ها', q1: 'سه دروازه را پیدا کن', q2: 'سلول‌های انرژی را جمع کن', q3: 'با نیما حرف بزن', all: 'همهٔ مأموریت‌ها انجام شد! خوش آمدی، فضانورد.',
      enter: 'ورود', press: '<kbd>E</kbd> را بزن', talk: 'حرف زدن', cell: 'سلول انرژی', found: 'دروازهٔ تازه پیدا شد', pilot: 'فضانورد',
      nima: ['نیما', 'راهنمای جهان انتخاب', 'هولوگرام نیما این‌جاست. بزن تا با او حرف بزنی.'],
      g: { name: 'نیما', role: 'راهنمای جهان · آنلاین', close: 'بستن', hint: 'من این‌جام، اگر گم شدی.',
        hello: 'سلام فضانورد! من نیما هستم. این ایستگاه هشت دروازه دارد و هر کدام به یک بخش سایت باز می‌شود.',
        chips: [['چطور حرکت کنم؟', 'با W A S D یا کلیدهای جهت راه برو، صفحه را بکش تا بچرخی، Space پرش است. روی موبایل از دستهٔ نارنجی پایین استفاده کن.'],
          ['دروازه‌ها کجا می‌برند؟', 'هر دروازه یک بخش واقعی سایت است: بازار زنده، رصدخانه، اندیکاتورها، آکادمی، واقعیت‌سنج، جهان زنده، نبرد من و فضای من. نزدیکش که بروی، ورود را می‌بینی.'],
          ['سلول‌های انرژی چیست؟', 'نورهای طلایی دور ایستگاه. همه را جمع کنی، مأموریتت کامل می‌شود.'],
          ['برگرد به سایت', 'هر وقت خواستی، از دکمهٔ خروج بالای صفحه برگرد.', '/', 'سایت']] } },
    ckb: { pv: 'پێشبینین · هێشتا بڵاو نەکراوەتەوە', title: 'جیهانی Entekhab', exit: 'گەڕانەوە بۆ ماڵپەڕ',
      intro: 'بەخێربێیت بۆ وێستگەی خولگەیی Entekhab، ٤٠٨ کیلۆمەتر سەرووی زەوی. هەر دەروازەیەک دەتباتە بەشێکی ماڵپەڕ.',
      name: 'ناوت لە وێستگە', suit: 'ڕەنگی جلی ئاسمانەوانی', visor: 'ڕەنگی کڵاو', start: 'دەست پێ بکە', keys: 'جووڵە: WASD · سەیرکردن: ڕاکێشە · بازدان: Space · چوونە ژوور: E',
      hint: 'جووڵە <kbd>W A S D</kbd> · سەیرکردن: ڕاکێشە · بازدان <kbd>Space</kbd> · چوونە ژوور <kbd>E</kbd>', jump: 'باز', use: 'چوونە ژوور',
      quests: 'ئەرکەکان', q1: 'سێ دەروازە بدۆزەرەوە', q2: 'خانەکانی وزە کۆبکەرەوە', q3: 'قسە لەگەڵ نیما بکە', all: 'هەموو ئەرکەکان تەواو بوون!',
      enter: 'چوونە ژوور', press: '<kbd>E</kbd> دابگرە', talk: 'قسەکردن', cell: 'خانەی وزە', found: 'دەروازەیەکی نوێ دۆزرایەوە', pilot: 'ئاسمانەوان',
      nima: ['نیما', 'ڕێنمای جیهان', 'هۆلۆگرامی نیما لێرەیە. لێی بدە بۆ قسەکردن.'],
      g: { name: 'نیما', role: 'ڕێنمای جیهان · سەرهێڵ', close: 'داخستن', hint: 'ئەگەر ون بوویت من لێرەم.',
        hello: 'سڵاو ئاسمانەوان! من نیمام. ئەم وێستگەیە هەشت دەروازەی هەیە، هەر یەکەیان بۆ بەشێکی ماڵپەڕ.',
        chips: [['چۆن بجووڵێم؟', 'بە W A S D بڕۆ، ڕاکێشە بۆ سووڕانەوە، Space بۆ بازدان.'], ['دەروازەکان بۆ کوێ دەچن؟', 'هەر دەروازەیەک بەشێکی ڕاستەقینەی ماڵپەڕە.'],
          ['خانەی وزە چییە؟', 'ڕووناکییە زێڕینەکانی دەوری وێستگە. هەموویان کۆبکەرەوە.'], ['گەڕانەوە بۆ ماڵپەڕ', 'لە دوگمەی دەرچوون لە سەرەوە.', '/', 'ماڵپەڕ']] } },
    ar: { pv: 'معاينة · لم تُنشر بعد', title: 'عالم انتخاب', exit: 'العودة إلى الموقع',
      intro: 'مرحباً بك في محطة انتخاب المدارية، على ارتفاع ٤٠٨ كم فوق الأرض. كل بوابة تأخذك إلى قسم من الموقع.',
      name: 'اسمك في المحطة', suit: 'لون بدلة الفضاء', visor: 'لون الخوذة', start: 'ابدأ', keys: 'الحركة: WASD · النظر: اسحب · القفز: Space · الدخول: E',
      hint: 'الحركة <kbd>W A S D</kbd> · النظر: اسحب · القفز <kbd>Space</kbd> · الدخول <kbd>E</kbd>', jump: 'قفز', use: 'دخول',
      quests: 'المهام', q1: 'اعثر على ثلاث بوابات', q2: 'اجمع خلايا الطاقة', q3: 'تحدّث مع نيما', all: 'أنجزت كل المهام! أهلاً بك يا رائد الفضاء.',
      enter: 'دخول', press: 'اضغط <kbd>E</kbd>', talk: 'تحدّث', cell: 'خلية طاقة', found: 'بوابة جديدة', pilot: 'رائد فضاء',
      nima: ['نيما', 'مرشد العالم', 'هولوغرام نيما هنا. اضغط لتتحدث معه.'],
      g: { name: 'نيما', role: 'مرشد العالم · متصل', close: 'إغلاق', hint: 'أنا هنا إن ضعت.',
        hello: 'مرحباً يا رائد الفضاء! أنا نيما. في هذه المحطة ثماني بوابات، كل واحدة تفتح على قسم من الموقع.',
        chips: [['كيف أتحرك؟', 'استخدم W A S D، واسحب للالتفات، وSpace للقفز.'], ['إلى أين تقود البوابات؟', 'كل بوابة قسم حقيقي من الموقع.'],
          ['ما خلايا الطاقة؟', 'الأضواء الذهبية حول المحطة. اجمعها كلها.'], ['العودة إلى الموقع', 'من زر الخروج في الأعلى.', '/', 'الموقع']] } },
    en: { pv: 'Preview · not on the live site yet', title: 'The Entekhab world', exit: 'Back to the site',
      intro: 'Welcome aboard the Entekhab orbital station, 408 km above the Earth. Every gate takes you to a part of the site.',
      name: 'Your name on the station', suit: 'Suit colour', visor: 'Visor colour', start: 'Start', keys: 'Move: WASD or arrows · Look: drag · Jump: Space · Enter: E',
      hint: 'Move <kbd>W A S D</kbd> · Look: drag · Jump <kbd>Space</kbd> · Enter <kbd>E</kbd>', jump: 'Jump', use: 'Enter',
      quests: 'Quests', q1: 'Find three gates', q2: 'Collect the energy cells', q3: 'Talk to Nima', all: 'All quests done! Welcome aboard, astronaut.',
      enter: 'Enter', press: 'Press <kbd>E</kbd>', talk: 'Talk', cell: 'Energy cell', found: 'New gate found', pilot: 'Astronaut',
      nima: ['Nima', 'Your guide here', 'Nima’s hologram is here. Tap to talk.'],
      g: { name: 'Nima', role: 'World guide · online', close: 'Close', hint: 'I’m here if you get lost.',
        hello: 'Hi, astronaut! I’m Nima. This station has eight gates, and each one opens onto a part of the site.',
        chips: [['How do I move?', 'Walk with W A S D or the arrow keys, drag to turn, Space to jump. On a phone, use the orange stick.'],
          ['Where do the gates go?', 'Each gate is a real part of the site: live market, observatory, indicators, academy, reality check, live world, My Battle and My space. Walk up to one to enter.'],
          ['What are energy cells?', 'The golden lights around the station. Collect them all to finish the quest.'],
          ['Back to the site', 'Use the exit button up top whenever you like.', '/', 'Site']] } }
  };
  var GATES = [
    { p: '/market/', c: 0xf7931a, k: 'LIVE MARKET', t: { fa: ['بازار زنده', 'مولتی‌چارت، بازپخش، بک‌تست و هشدار'], ckb: ['بازاڕی زیندوو', 'چەند چارت، باکتێست و ئاگادارکەرەوە'], ar: ['السوق المباشر', 'رسوم متعددة واختبار رجعي وتنبيهات'], en: ['Live market', 'Multi-chart, replay, backtests and alerts'] } },
    { p: '/charts/', c: 0x6fb2ff, k: 'OBSERVATORY', t: { fa: ['رصدخانهٔ بازار', 'لیکوییدیشن، فاندینگ، آپشن و MVRV'], ckb: ['ڕوانگەی بازاڕ', 'لیکویدکردن، فەندینگ و MVRV'], ar: ['مرصد السوق', 'التصفيات والتمويل وMVRV'], en: ['Market Observatory', 'Liquidations, funding, options and MVRV'] } },
    { p: '/indicators/', c: 0x34d399, k: 'INDICATORS', t: { fa: ['اندیکاتورهای اختصاصی', 'سیگنال‌های Coin_Kurd در TradingView'], ckb: ['ئیندیکاتۆرەکان', 'سیگناڵی Coin_Kurd'], ar: ['المؤشرات الخاصة', 'إشارات Coin_Kurd'], en: ['Signature indicators', 'Coin_Kurd signals on TradingView'] } },
    { p: '/academy/', c: 0xffd27a, k: 'ACADEMY', t: { fa: ['آکادمی کریپتو', 'از صفر تا حرفه‌ای، درس به درس'], ckb: ['ئەکادیمیا', 'لە سفرەوە تا پیشەیی'], ar: ['الأكاديمية', 'من الصفر إلى الاحتراف'], en: ['Crypto Academy', 'From zero to pro, lesson by lesson'] } },
    { p: '/reality/', c: 0xc7a6ff, k: 'REALITY CHECK', t: { fa: ['واقعیت‌سنج', 'فاصلهٔ حرف و واقعیت بازار'], ckb: ['ڕاستی‌پێو', 'مەودای قسە و ڕاستی'], ar: ['مقياس الواقع', 'بين القول والواقع'], en: ['Reality check', 'What the market says vs. does'] } },
    { p: '/world/', c: 0x4fd1e8, k: 'LIVE WORLD', t: { fa: ['جهان زنده', 'جمعیت، بیت‌کوین، نفت و CO₂ ثانیه به ثانیه'], ckb: ['جیهانی زیندوو', 'چرکە بە چرکە'], ar: ['العالم الحي', 'لحظة بلحظة'], en: ['The world, live', 'Population, Bitcoin, oil, CO₂ by the second'] } },
    { p: '/battle/', c: 0xff5a4d, k: 'MY BATTLE', t: { fa: ['نبرد من', 'پیش‌بینی کن، رقابت کن، امتیاز بگیر'], ckb: ['شەڕی من', 'پێشبینی بکە، پێشبڕکێ بکە'], ar: ['معركتي', 'توقّع ونافس'], en: ['My Battle', 'Predict, compete, earn points'] } },
    { p: '/me/', c: 0xeef1f5, k: 'MY SPACE', t: { fa: ['فضای من', 'واچ‌لیست، هشدارها و تنظیمات'], ckb: ['بۆشاییی من', 'لیستی چاودێری و ڕێکخستن'], ar: ['مساحتي', 'المتابعة والتنبيهات'], en: ['My space', 'Watchlist, alerts and settings'] } }
  ];
  var SUITS = [0xe9ecef, 0x22252b, 0xf7931a, 0x3d5a80], VISORS = [0xf7931a, 0x4fa3ff];
  var lang = 'fa';
  try { var ql = new URLSearchParams(location.search).get('lang'); lang = I[ql] ? ql : (I[localStorage.getItem('ck_lang')] ? localStorage.getItem('ck_lang') : 'fa'); } catch (e) {}
  var $ = function (id) { return D.getElementById(id); };

  if (!W.EKSpace || !EKSpace.webgl()) {
    var n = D.createElement('div'); n.className = 'nogl';
    n.innerHTML = '<div><h2>' + I[lang].title + '</h2><p>WebGL is needed for this world.</p><p><a class="go" href="/">' + I[lang].exit + '</a></p></div>';
    D.body.appendChild(n); return;
  }

  /* ---------------- renderer, sky, Earth ---------------- */
  var cv = $('w'), SMALL = EKSpace.small;
  var R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(W.devicePixelRatio || 1, SMALL ? 1.5 : 1.75));
  R.outputEncoding = T.sRGBEncoding;
  R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  var scene = new T.Scene(), cam = new T.PerspectiveCamera(58, 1, .1, 4000), loader = new T.TextureLoader();
  var sky = new EKSpace.Sky(scene, loader, { milky: .9, starGain: 1.4 }); sky.group.scale.setScalar(2.4);
  var SUN = new T.Vector3(-.62, .5, .62).normalize(), EARTH_TILT = +(new URLSearchParams(location.search).get('tilt') || .5);
  // the planet rises beyond the rail, enormous: it fills a wide band of the view toward -z
  var earth = new EKSpace.Earth(scene, loader, { radius: 500, spin: .0014, faceLon: 44, tilt: 0, sun: SUN, atmo: 1.25, exposure: 1.1 });
  earth.group.position.set(0, -380, -700); earth.group.rotation.x = EARTH_TILT;

  // light from the same sun that lights the planet
  var sunL = new T.DirectionalLight(0xfff3e2, 1.9); sunL.position.copy(SUN).multiplyScalar(100); scene.add(sunL);
  scene.add(new T.HemisphereLight(0x9cc0ff, 0x1d2b44, .55));
  var fill = new T.DirectionalLight(0x6f9bff, .35); fill.position.set(.4, -.6, .7).multiplyScalar(100); scene.add(fill);   // earthshine from below

  /* ---------------- textures drawn here ---------------- */
  function canvasTex(w, h, draw, srgb) {
    var c = D.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c); if (srgb !== false) t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function rnd(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  var deckTex = canvasTex(2048, 2048, function (g, w) {
    var c = w / 2, r = rnd(7);
    g.fillStyle = '#5b6169'; g.fillRect(0, 0, w, w);
    // fine grain
    for (var i = 0; i < 60000; i++) { var v = 80 + r() * 40 | 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 6) + ',.12)'; g.fillRect(r() * w, r() * w, 2, 2); }
    // panels: rings and radial seams; each panel a slightly different tone
    var rings = [0, 120, 260, 420, 600, 800, 960, 1024];
    for (var k = 0; k < rings.length - 1; k++) {
      var segs = 8 + k * 6;
      for (var s = 0; s < segs; s++) {
        var a0 = s / segs * Math.PI * 2, a1 = (s + 1) / segs * Math.PI * 2, tone = (r() - .5) * 22;
        g.beginPath(); g.arc(c, c, rings[k + 1], a0, a1); g.arc(c, c, rings[k], a1, a0, true); g.closePath();
        g.fillStyle = 'rgba(' + (tone > 0 ? '255,255,255' : '0,0,0') + ',' + Math.abs(tone) / 255 * 2.2 + ')'; g.fill();
        g.strokeStyle = 'rgba(20,22,26,.85)'; g.lineWidth = 4; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.stroke();
        // bolts
        for (var b = 0; b < 2; b++) { var aa = a0 + (a1 - a0) * (.2 + .6 * b), rr = rings[k] + 14; g.fillStyle = 'rgba(30,32,36,.9)'; g.beginPath(); g.arc(c + Math.cos(aa) * rr, c + Math.sin(aa) * rr, 4, 0, 7); g.fill(); }
      }
    }
    // the landing ring: hazard stripes
    for (var h = 0; h < 120; h++) {
      var A0 = h / 120 * Math.PI * 2, A1 = (h + .5) / 120 * Math.PI * 2;
      g.beginPath(); g.arc(c, c, 1000, A0, A1); g.arc(c, c, 975, A1, A0, true); g.closePath(); g.fillStyle = 'rgba(247,147,26,.85)'; g.fill();
    }
    // path ring to the gates
    g.strokeStyle = 'rgba(255,210,122,.35)'; g.lineWidth = 6; g.setLineDash([30, 22]); g.beginPath(); g.arc(c, c, 650, 0, 7); g.stroke(); g.setLineDash([]);
    // centre emblem ring
    g.strokeStyle = 'rgba(247,147,26,.6)'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, 112, 0, 7); g.stroke();
    // scuffs
    for (var q = 0; q < 220; q++) { g.strokeStyle = 'rgba(0,0,0,' + (.04 + r() * .06) + ')'; g.lineWidth = 1 + r() * 3; var x = r() * w, y = r() * w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 120, y + (r() - .5) * 40); g.stroke(); }
  });
  var glowTex = canvasTex(128, 128, function (g, w) {
    var gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
  var blobTex = canvasTex(128, 128, function (g, w) {
    var gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);

  /* ---------------- the station ---------------- */
  var DECK = 30, metal = function (c, r, m) { return new T.MeshStandardMaterial({ color: c, roughness: r == null ? .55 : r, metalness: m == null ? .55 : m }); };
  var st = new T.Group(); scene.add(st);
  var deck = new T.Mesh(new T.CircleGeometry(DECK, 128), new T.MeshStandardMaterial({ map: deckTex, roughness: .5, metalness: .55, color: 0xffffff }));
  deck.rotation.x = -Math.PI / 2; st.add(deck);
  var hull = new T.Mesh(new T.CylinderGeometry(DECK, DECK - 2.5, 1.6, 128, 1, true), metal(0x50565f, .5, .7)); hull.position.y = -.8; st.add(hull);
  var under = new T.Mesh(new T.CircleGeometry(DECK - 2.5, 64), metal(0x2a2e35, .7, .6)); under.rotation.x = Math.PI / 2; under.position.y = -1.6; st.add(under);
  // truss arms under the deck and solar wings: a station, not a floating plate
  for (var a = 0; a < 4; a++) {
    var arm = new T.Mesh(new T.BoxGeometry(46, .9, .9), metal(0x6b727c, .45, .8)); arm.position.y = -2.4; arm.rotation.y = a * Math.PI / 4; st.add(arm);
  }
  var panelMat = new T.MeshStandardMaterial({ color: 0x1b2a4a, roughness: .25, metalness: .6, emissive: 0x050b18,
    map: canvasTex(256, 512, function (g, w, h) { g.fillStyle = '#18264a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8fa3c7'; g.lineWidth = 2;
      for (var x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (var y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }) });
  [-1, 1].forEach(function (s) {
    var mast = new T.Mesh(new T.CylinderGeometry(.35, .35, 26, 12), metal(0x8a919b, .4, .8)); mast.rotation.z = Math.PI / 2; mast.position.set(s * (DECK + 12), -2.4, 0); st.add(mast);
    for (var p = 0; p < 2; p++) { var pn = new T.Mesh(new T.BoxGeometry(11, .12, 22), panelMat); pn.position.set(s * (DECK + 6 + p * 12.5), -2.4, 0); pn.rotation.x = .35; st.add(pn); }
  });
  // railing and edge light
  var postG = new T.CylinderGeometry(.06, .06, 1.1, 8), postM = metal(0xb8bec7, .35, .9);
  for (var pi = 0; pi < 72; pi++) { var an = pi / 72 * Math.PI * 2, po = new T.Mesh(postG, postM); po.position.set(Math.cos(an) * (DECK - .4), .55, Math.sin(an) * (DECK - .4)); st.add(po); }
  var rail = new T.Mesh(new T.TorusGeometry(DECK - .4, .06, 8, 220), postM); rail.rotation.x = Math.PI / 2; rail.position.y = 1.1; st.add(rail);
  var edge = new T.Mesh(new T.TorusGeometry(DECK - .05, .07, 8, 220), new T.MeshBasicMaterial({ color: 0xff9a2e })); edge.rotation.x = Math.PI / 2; edge.position.y = .04; st.add(edge);
  // central hub with Nima's hologram
  var hub = new T.Mesh(new T.CylinderGeometry(2.3, 2.7, .7, 64), metal(0x4b5159, .4, .85)); hub.position.y = .35; st.add(hub);
  var hubRing = new T.Mesh(new T.TorusGeometry(2.32, .05, 8, 96), new T.MeshBasicMaterial({ color: 0x5aa8ff })); hubRing.rotation.x = Math.PI / 2; hubRing.position.y = .72; st.add(hubRing);
  var beam = new T.Mesh(new T.CylinderGeometry(1.9, 2.2, 5.4, 48, 1, true), new T.ShaderMaterial({
    uniforms: { t: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float t;varying vec2 vU;void main(){float a=(1.-vU.y)*.16*(.8+.2*sin(t*3.+vU.y*20.));a*=.6+.4*sin(vU.x*60.+t);gl_FragColor=vec4(vec3(.35,.65,1.)*a,a);}'
  })); beam.position.y = 3.4; st.add(beam);
  var holoTex = loader.load('/assets/space/guide-1.webp'); holoTex.encoding = T.sRGBEncoding;
  var holo = new T.Mesh(new T.PlaneGeometry(3.6, 3.6 * 883 / 720), new T.ShaderMaterial({
    uniforms: { map: { value: holoTex }, t: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D map;uniform float t;varying vec2 vU;void main(){vec2 u=vU;u.x+=sin(u.y*80.+t*9.)*.0015*step(.97,fract(t*.37));' +
      'vec4 c=texture2D(map,u);float l=dot(c.rgb,vec3(.3,.55,.15));vec3 h=mix(vec3(.25,.55,1.)*l*1.4,c.rgb,.55);float sl=.82+.18*sin(vU.y*300.-t*6.);' +
      'float f=.9+.1*sin(t*23.)*sin(t*7.);gl_FragColor=vec4(h*sl*f*1.35,c.a*sl*f);}'
  })); holo.position.y = 3.15; st.add(holo);
  var holoPos = new T.Vector3(0, 0, 0);

  /* ---------------- the gates ---------------- */
  var gates = [], GR = 19.5;
  function label(g) {
    var t = g.t[lang], rtl = lang !== 'en';
    return canvasTex(1024, 300, function (x, w, h) {
      x.clearRect(0, 0, w, h); x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = 'center';
      x.fillStyle = 'rgba(6,8,12,.72)'; rr(x, 40, 40, w - 80, h - 80, 46); x.fill();
      x.strokeStyle = '#' + ('00000' + g.c.toString(16)).slice(-6); x.globalAlpha = .7; x.lineWidth = 4; rr(x, 40, 40, w - 80, h - 80, 46); x.stroke(); x.globalAlpha = 1;
      x.fillStyle = '#fff'; x.font = '900 92px Vazirmatn, sans-serif'; x.fillText(t[0], w / 2, 158);
      x.fillStyle = '#ffd27a'; x.font = '700 40px "Space Grotesk", sans-serif'; x.direction = 'ltr'; x.fillText(g.k, w / 2, 222);
    });
  }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  var PORTAL_FS = 'uniform float t;uniform vec3 col;varying vec2 vU;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}' +
    'void main(){vec2 p=vU*2.-1.;float r=length(p);if(r>1.)discard;float a=atan(p.y,p.x);' +
    'float sw=n(vec2(a*3.+r*6.-t*1.4,r*8.-t*2.))*.6+n(vec2(a*6.-t,r*14.+t))*.4;' +
    'float rim=smoothstep(.72,1.,r);float core=1.-smoothstep(0.,.9,r);' +
    'vec3 c=col*(.5+sw*1.3)*(.55+rim*1.9)+vec3(1.)*pow(core,3.)*.35;float al=(.5+rim*.5+sw*.3)*(1.-smoothstep(.96,1.,r));gl_FragColor=vec4(c*al,al);}';
  GATES.forEach(function (g, i) {
    var ang = i / GATES.length * Math.PI * 2 - Math.PI / 2, x = Math.cos(ang) * GR, z = Math.sin(ang) * GR, grp = new T.Group();
    grp.position.set(x, 0, z); grp.lookAt(0, 0, 0); st.add(grp);
    var base = new T.Mesh(new T.CylinderGeometry(2.6, 2.9, .35, 48), metal(0x4a5058, .45, .85)); base.position.y = .17; grp.add(base);
    var ring = new T.Mesh(new T.TorusGeometry(2.25, .24, 20, 96), metal(0x9aa1ab, .28, .95)); ring.position.y = 2.75; grp.add(ring);
    var inner = new T.Mesh(new T.TorusGeometry(2.0, .05, 8, 96), new T.MeshBasicMaterial({ color: g.c })); inner.position.y = 2.75; grp.add(inner);
    var u = { t: { value: i * 3.1 }, col: { value: new T.Color(g.c) } };
    var disc = new T.Mesh(new T.CircleGeometry(1.98, 64), new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: PORTAL_FS }));
    disc.position.y = 2.75; grp.add(disc);
    var legG = new T.BoxGeometry(.35, 1.2, .5);
    [-1, 1].forEach(function (s) { var leg = new T.Mesh(legG, metal(0x6b727c, .4, .9)); leg.position.set(s * 2.2, .9, 0); grp.add(leg); });
    var halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: g.c, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .35 }));
    halo.scale.set(9, 9, 1); halo.position.y = 2.75; grp.add(halo);
    var sp = new T.Sprite(new T.SpriteMaterial({ map: label(g), transparent: true, depthWrite: false })); sp.scale.set(4.3, 1.26, 1); sp.position.y = 6.1; grp.add(sp);
    gates.push({ g: g, grp: grp, u: u, sp: sp, x: x, z: z, seen: false });
  });

  /* ---------------- energy cells ---------------- */
  var cells = [], rcell = rnd(42), CELLN = 10;
  for (var ci = 0; ci < CELLN; ci++) {
    var ca = (ci + .5) / CELLN * Math.PI * 2 + (rcell() - .5) * .3, cr = ci % 2 ? 11 + rcell() * 4 : 24 + rcell() * 3;
    if (Math.hypot(Math.cos(ca) * cr, Math.sin(ca) * cr - 9) < 5) ca += .5;
    var m = new T.Mesh(new T.OctahedronGeometry(.32, 0), new T.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xf7931a, emissiveIntensity: 1.6, roughness: .2, metalness: .4 }));
    var gl = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffb14a, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .9 }));
    gl.scale.set(2.2, 2.2, 1); m.add(gl);
    m.position.set(Math.cos(ca) * cr, 1.2, Math.sin(ca) * cr); st.add(m);
    cells.push({ m: m, ph: rcell() * 6, got: false });
  }

  /* ---------------- the astronaut ---------------- */
  var P = { pos: new T.Vector3(0, 0, 9), vy: 0, yaw: 0, vel: new T.Vector3(), walk: 0 };
  var suitM = new T.MeshStandardMaterial({ color: SUITS[0], roughness: .55, metalness: .1 });
  var darkM = new T.MeshStandardMaterial({ color: 0x2a2d33, roughness: .5, metalness: .5 });
  var visorM = new T.MeshStandardMaterial({ color: 0x0b0c10, roughness: .08, metalness: 1, emissive: VISORS[0], emissiveIntensity: .35 });
  var stripeM = new T.MeshBasicMaterial({ color: 0xf7931a });
  var av = new T.Group(); scene.add(av);
  function part(geo, mat, x, y, z, parent) { var o = new T.Mesh(geo, mat); o.position.set(x, y, z); (parent || av).add(o); return o; }
  var torso = part(new T.CylinderGeometry(.42, .36, .85, 20), suitM, 0, 1.45, 0);
  part(new T.SphereGeometry(.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), suitM, 0, 1.86, 0);
  part(new T.SphereGeometry(.37, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), suitM, 0, 1.04, 0);
  part(new T.TorusGeometry(.42, .045, 8, 32), stripeM, 0, 1.62, 0).rotation.x = Math.PI / 2;
  var pack = part(new T.BoxGeometry(.62, .78, .32), darkM, 0, 1.55, .38);
  part(new T.BoxGeometry(.5, .08, .02), stripeM, 0, 1.75, .545);
  var chest = part(new T.BoxGeometry(.34, .2, .08), darkM, 0, 1.55, -.4);
  part(new T.BoxGeometry(.06, .06, .02), new T.MeshBasicMaterial({ color: 0x34d399 }), .1, 1.57, -.45);
  var head = new T.Group(); head.position.set(0, 2.2, 0); av.add(head);
  part(new T.SphereGeometry(.38, 28, 20), suitM, 0, 0, 0, head);
  var visor = part(new T.SphereGeometry(.31, 28, 18, Math.PI * .62, Math.PI * .76, Math.PI * .26, Math.PI * .42), visorM, 0, .02, -.1, head);
  visor.scale.set(1.08, 1, 1.12);
  part(new T.TorusGeometry(.33, .05, 10, 32), darkM, 0, -.3, 0, head).rotation.x = Math.PI / 2;
  function limb(x, y, len, rad) { var pivot = new T.Group(); pivot.position.set(x, y, 0); av.add(pivot); var m = part(new T.CylinderGeometry(rad, rad * .85, len, 14), suitM, 0, -len / 2, 0, pivot);
    part(new T.SphereGeometry(rad * 1.08, 14, 10), darkM, 0, -len, 0, pivot); return pivot; }
  var armL = limb(-.53, 1.8, .72, .13), armR = limb(.53, 1.8, .72, .13), legL = limb(-.19, 1.02, .88, .16), legR = limb(.19, 1.02, .88, .16);
  [legL, legR].forEach(function (l) { part(new T.BoxGeometry(.3, .16, .44), darkM, 0, -.94, -.06, l); });
  var blob = new T.Mesh(new T.PlaneGeometry(1.8, 1.8), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; scene.add(blob);
  var nameTex = null, nameSp = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false })); nameSp.scale.set(1.7, .425, 1); nameSp.position.y = 2.85; av.add(nameSp); nameSp.visible = false;
  function setName(n) {
    n = (n || I[lang].pilot).slice(0, 18);
    if (nameTex) nameTex.dispose();
    nameTex = canvasTex(512, 128, function (x, w, h) { x.direction = /[؀-ۿ]/.test(n) ? 'rtl' : 'ltr'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.55)'; rr(x, 20, 22, w - 40, 84, 42); x.fill();
      x.fillStyle = '#ffd27a'; x.font = '900 52px Vazirmatn, sans-serif'; x.fillText(n, w / 2, 82); });
    nameSp.material.map = nameTex; nameSp.material.needsUpdate = true;
  }

  /* ---------------- input ---------------- */
  var keys = {}, joy = { x: 0, y: 0 }, camYaw = 0, camPitch = .28, dist = 7.5, started = false;
  D.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    if (e.code === 'Space') jump();
    if (e.code === 'KeyE' || e.code === 'Enter') use();
  });
  D.addEventListener('keyup', function (e) { keys[e.code] = false; });
  W.addEventListener('blur', function () { keys = {}; });
  // drag to look (mouse anywhere on the canvas; on touch, anywhere but the stick)
  var drag = null;
  cv.addEventListener('pointerdown', function (e) { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    camYaw -= (e.clientX - drag.x) * .0055; camPitch = Math.max(.05, Math.min(1.1, camPitch + (e.clientY - drag.y) * .004)); drag.x = e.clientX; drag.y = e.clientY;
  });
  cv.addEventListener('pointerup', function () { drag = null; });
  cv.addEventListener('pointercancel', function () { drag = null; });
  cv.addEventListener('wheel', function (e) { dist = Math.max(4, Math.min(14, dist + e.deltaY * .01)); e.preventDefault(); }, { passive: false });
  var jy = $('joy'), knob = jy.firstChild;
  function jmove(e) { var r = jy.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), l = Math.hypot(dx, dy), m = r.width * .38;
    if (l > m) { dx *= m / l; dy *= m / l; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; joy.x = dx / m; joy.y = dy / m; }
  jy.addEventListener('pointerdown', function (e) { jy.setPointerCapture(e.pointerId); jmove(e); });
  jy.addEventListener('pointermove', function (e) { if (jy.hasPointerCapture(e.pointerId)) jmove(e); });
  function jend() { joy.x = joy.y = 0; knob.style.transform = ''; }
  jy.addEventListener('pointerup', jend); jy.addEventListener('pointercancel', jend);
  $('bjump').addEventListener('click', jump); $('bact').addEventListener('click', use);
  function jump() { if (started && P.pos.y <= .001) P.vy = 5.2; }

  /* ---------------- quests, toasts, the near card ---------------- */
  var Q = { gates: 0, cells: 0, nima: false }, toastT = 0;
  function toast(s) { var t = $('toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2200); }
  function quests() {
    var t = I[lang], c = Math.min(3, Q.gates);
    $('quests').innerHTML = '<h3>' + t.quests + '<span>' + ((c >= 3) + (Q.cells >= CELLN) + Q.nima) + '/3</span></h3>' +
      q(t.q1, c >= 3, c + '/3') + q(t.q2, Q.cells >= CELLN, Q.cells + '/' + CELLN) + q(t.q3, Q.nima, '');
    function q(s, d, n) { return '<div class="q' + (d ? ' done' : '') + '"><i></i><span>' + s + '</span>' + (n ? '<small>' + n + '</small>' : '') + '</div>'; }
  }
  var allDone = false;
  function checkAll() { if (!allDone && Q.gates >= 3 && Q.cells >= CELLN && Q.nima) { allDone = true; setTimeout(function () { toast(I[lang].all); }, 900); } }
  var nearNow = null;
  function showNear(o) {
    if (o === nearNow) return; nearNow = o; var n = $('near'), t = I[lang];
    if (!o) { n.classList.remove('on'); return; }
    if (o === 'nima') { $('nk').textContent = 'NIMA · GUIDE'; $('nt').textContent = t.nima[0] + ' · ' + t.nima[1]; $('nd').textContent = t.nima[2];
      var b = $('ngo'); b.textContent = t.talk; b.removeAttribute('href'); b.onclick = function (e) { e.preventDefault(); use(); };
    } else { var g = o.g, tt = g.t[lang]; $('nk').textContent = g.k + ' · ENTEKHAB.NET' + g.p.toUpperCase(); $('nt').textContent = tt[0]; $('nd').textContent = tt[1];
      var a = $('ngo'); a.textContent = t.enter + (lang === 'en' ? ' →' : ' ←'); a.href = SITE + g.p; a.onclick = function () { flash(); };
    }
    $('nkb').innerHTML = TOUCH ? '' : t.press; n.classList.add('on');
  }
  function flash() { var f = $('flash'); f.classList.add('on'); setTimeout(function () { f.classList.remove('on'); }, 260); }
  var guide = null;
  function use() {
    if (!started || !nearNow) return;
    if (nearNow === 'nima') { guide.open(true); if (!Q.nima) { Q.nima = true; quests(); checkAll(); } return; }
    flash(); var u = $('ngo').href; setTimeout(function () { location.href = u; }, 260);
  }

  /* ---------------- words on the page ---------------- */
  function setLang(l) {
    lang = l; var t = I[l]; D.documentElement.lang = l; D.documentElement.dir = l === 'en' ? 'ltr' : 'rtl';
    try { localStorage.setItem('ck_lang', l); } catch (e) {}
    [].forEach.call(D.querySelectorAll('[data-t]'), function (el) { if (t[el.dataset.t] != null) el.textContent = t[el.dataset.t]; });
    [].forEach.call(D.querySelectorAll('[data-ta]'), function (el) { el.setAttribute('aria-label', t[el.dataset.ta]); el.title = t[el.dataset.ta]; });
    [].forEach.call(D.querySelectorAll('.lang button'), function (b) { b.setAttribute('aria-pressed', b.dataset.l === l ? 'true' : 'false'); });
    $('hint').innerHTML = t.hint;
    gates.forEach(function (g) { var old = g.sp.material.map; g.sp.material.map = label(g.g); g.sp.material.needsUpdate = true; if (old) old.dispose(); });
    quests(); setName($('nm').value || stored('ekw_name'));
    var keep = nearNow; nearNow = null; showNear(keep);
    if (guide) { guide.el.remove(); guide.fab.remove(); [].forEach.call(D.querySelectorAll('.ekg-hint'), function (h) { h.remove(); }); }
    guide = EKGuide.widget({ v: 1, t: t.g, hintAfter: started ? 2600 : false });
    guide.fab.addEventListener('click', function () { if (!Q.nima) { Q.nima = true; quests(); checkAll(); } });
  }
  function stored(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  [].forEach.call(D.querySelectorAll('.lang button'), function (b) { b.addEventListener('click', function () { setLang(b.dataset.l); }); });

  // character set-up
  function swatches(id, list, cur, set) {
    var box = $(id);
    list.forEach(function (c, i) { var b = D.createElement('button'); b.type = 'button'; b.style.background = '#' + ('00000' + c.toString(16)).slice(-6); b.setAttribute('aria-label', '#' + c.toString(16));
      b.setAttribute('aria-pressed', i === cur ? 'true' : 'false');
      b.addEventListener('click', function () { [].forEach.call(box.children, function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); set(i); });
      box.appendChild(b); });
  }
  var suitI = +stored('ekw_suit') || 0, visI = +stored('ekw_visor') || 0;
  if (!SUITS[suitI]) suitI = 0; if (!VISORS[visI]) visI = 0;
  function applyLook() { suitM.color.setHex(SUITS[suitI]); visorM.emissive.setHex(VISORS[visI]); stripeM.color.setHex(suitI === 2 ? 0x22252b : 0xf7931a); }
  swatches('suits', SUITS, suitI, function (i) { suitI = i; applyLook(); try { localStorage.setItem('ekw_suit', i); } catch (e) {} });
  swatches('visors', VISORS, visI, function (i) { visI = i; applyLook(); try { localStorage.setItem('ekw_visor', i); } catch (e) {} });
  applyLook();
  $('nm').value = stored('ekw_name');
  $('nm').addEventListener('input', function () { setName(this.value); });
  $('start').addEventListener('click', function () {
    var n = $('nm').value.trim(); try { localStorage.setItem('ekw_name', n); } catch (e) {}
    setName(n); nameSp.visible = true; started = true; D.body.classList.remove('pre'); $('intro').classList.add('off'); camYaw = P.yaw;
    setTimeout(function () { $('intro').style.display = 'none'; }, 700);
    setTimeout(function () { guide.say && guide.open(true); }, 1400);
    cv.focus && cv.focus();
  });

  /* ---------------- minimap ---------------- */
  var map = $('map'), mx = map.getContext('2d');
  function drawMap() {
    var w = map.width, c = w / 2, s = (w / 2 - 10) / DECK;
    mx.clearRect(0, 0, w, w);
    mx.save(); mx.translate(c, c); mx.rotate(camYaw - Math.PI);   // the map turns with the camera, so "up" is where you look
    mx.fillStyle = 'rgba(120,130,145,.18)'; mx.beginPath(); mx.arc(0, 0, DECK * s, 0, 7); mx.fill();
    mx.strokeStyle = 'rgba(247,147,26,.7)'; mx.lineWidth = 3; mx.stroke();
    mx.strokeStyle = 'rgba(255,210,122,.25)'; mx.setLineDash([6, 6]); mx.beginPath(); mx.arc(0, 0, GR * s, 0, 7); mx.stroke(); mx.setLineDash([]);
    mx.fillStyle = '#5aa8ff'; mx.beginPath(); mx.arc(0, 0, 7, 0, 7); mx.fill();
    gates.forEach(function (g) { mx.fillStyle = '#' + ('00000' + g.g.c.toString(16)).slice(-6); mx.globalAlpha = g.seen ? 1 : .55; mx.beginPath(); mx.arc(g.x * s, g.z * s, 9, 0, 7); mx.fill(); });
    mx.globalAlpha = 1; mx.fillStyle = '#ffd27a';
    cells.forEach(function (o) { if (!o.got) { mx.beginPath(); mx.arc(o.m.position.x * s, o.m.position.z * s, 4, 0, 7); mx.fill(); } });
    mx.translate(P.pos.x * s, P.pos.z * s); mx.rotate(-P.yaw + Math.PI);
    mx.fillStyle = '#fff'; mx.beginPath(); mx.moveTo(0, -12); mx.lineTo(8, 9); mx.lineTo(0, 5); mx.lineTo(-8, 9); mx.closePath(); mx.fill();
    mx.restore();
  }

  /* ---------------- the loop ---------------- */
  function resize() { var w = cv.clientWidth, h = cv.clientHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 68 : 58; cam.updateProjectionMatrix(); }
  W.addEventListener('resize', resize); resize();
  var fwd = new T.Vector3(), right = new T.Vector3(), mv = new T.Vector3(), camT = new T.Vector3(), look = new T.Vector3(), last = performance.now(), t0 = last, mapT = 0, hidden = false;
  D.addEventListener('visibilitychange', function () { hidden = D.hidden; });
  function loop(now) {
    requestAnimationFrame(loop);
    if (hidden) { last = now; return; }
    var dt = Math.min(.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
    // move, relative to where the camera looks
    var ix = 0, iz = 0;
    if (started) {
      if (keys.KeyW || keys.ArrowUp) iz += 1; if (keys.KeyS || keys.ArrowDown) iz -= 1;
      if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
      ix += joy.x; iz -= joy.y;
    }
    var il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; il = 1; }
    fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)); right.set(-fwd.z, 0, fwd.x);
    mv.set(0, 0, 0).addScaledVector(fwd, iz).addScaledVector(right, ix);
    var run = keys.ShiftLeft || keys.ShiftRight ? 1.7 : 1, sp = 6.2 * run;
    P.vel.lerp(mv.multiplyScalar(sp), 1 - Math.pow(.0005, dt));
    P.pos.addScaledVector(P.vel, dt);
    var spd = Math.hypot(P.vel.x, P.vel.z);
    if (spd > .3) { var ty = Math.atan2(-P.vel.x, -P.vel.z), d = ((ty - P.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; P.yaw += d * (1 - Math.pow(.0001, dt)); }
    // low gravity
    P.vy -= 9.5 * dt; P.pos.y += P.vy * dt; if (P.pos.y < 0) { P.pos.y = 0; P.vy = 0; }
    // stay on the deck, out of the hub and the gate frames
    var rr2 = Math.hypot(P.pos.x, P.pos.z);
    if (rr2 > DECK - 1.2) { P.pos.x *= (DECK - 1.2) / rr2; P.pos.z *= (DECK - 1.2) / rr2; }
    if (rr2 < 3.2) { var k = 3.2 / Math.max(rr2, .001); P.pos.x *= k; P.pos.z *= k; }
    gates.forEach(function (g) { var dx = P.pos.x - g.x, dz = P.pos.z - g.z, d2 = Math.hypot(dx, dz); if (d2 < 3.1) { P.pos.x = g.x + dx / Math.max(d2, .001) * 3.1; P.pos.z = g.z + dz / Math.max(d2, .001) * 3.1; } });
    // walk cycle
    P.walk += spd * dt * 1.6; var sw = Math.sin(P.walk * 2.2) * Math.min(1, spd / 4) * .7, air = P.pos.y > .01;
    legL.rotation.x = air ? .5 : sw; legR.rotation.x = air ? -.3 : -sw; armL.rotation.x = air ? -1.2 : -sw * .8; armR.rotation.x = air ? -1.2 : sw * .8;
    armL.rotation.z = .12; armR.rotation.z = -.12;
    av.position.set(P.pos.x, P.pos.y + Math.abs(Math.sin(P.walk * 2.2)) * .06 * Math.min(1, spd / 4) + (RED ? 0 : Math.sin(t * 1.6) * .012), P.pos.z);
    av.rotation.y = P.yaw; head.rotation.y = Math.sin(t * .4) * .12 * (spd < .3 ? 1 : 0);
    blob.position.set(P.pos.x, .02, P.pos.z); blob.material.opacity = Math.max(.25, 1 - P.pos.y * .3);
    // camera follows from behind, softly
    if (!started) { camYaw = P.yaw - .5 + Math.sin(t * .25) * .18; }
    else if (!drag && spd > .5) { var cd = ((P.yaw - camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; if (Math.abs(cd) < 2.4) camYaw += cd * dt * .5; }
    var dd = started ? dist : 5.2, pp = started ? camPitch : .12;
    camT.set(P.pos.x + Math.sin(camYaw) * Math.cos(pp) * dd, P.pos.y + 1.6 + Math.sin(pp) * dd, P.pos.z + Math.cos(camYaw) * Math.cos(pp) * dd);
    cam.position.lerp(camT, 1 - Math.pow(.002, dt));
    look.set(P.pos.x, P.pos.y + (started ? 1.7 : 1.6), P.pos.z); cam.lookAt(look);
    if (!started) { cam.position.copy(camT); cam.lookAt(look); }
    // what is near
    var near = null, best = 1e9;
    gates.forEach(function (g) { g.u.t.value += dt; var d3 = Math.hypot(P.pos.x - g.x, P.pos.z - g.z); if (d3 < 5.2 && d3 < best) { best = d3; near = g; }
      if (d3 < 6.5 && !g.seen && started) { g.seen = true; Q.gates++; quests(); toast(I[lang].found + ': ' + g.g.t[lang][0]); checkAll(); } });
    if (Math.hypot(P.pos.x, P.pos.z) < 5.4 && best > 4) near = 'nima';
    showNear(started ? near : null);
    // energy cells
    cells.forEach(function (o) { if (o.got) return; o.m.rotation.y += dt * 1.4; o.m.position.y = 1.2 + Math.sin(t * 2 + o.ph) * .18;
      if (started && Math.hypot(P.pos.x - o.m.position.x, P.pos.z - o.m.position.z) < 1.3 && P.pos.y < 1.8) { o.got = true; o.m.visible = false; Q.cells++; quests(); toast(I[lang].cell + ' ' + Q.cells + '/' + CELLN); checkAll(); } });
    // hologram faces the camera
    holo.rotation.y = Math.atan2(cam.position.x - holoPos.x, cam.position.z - holoPos.z); holo.material.uniforms.t.value = t; beam.material.uniforms.t.value = t;
    // the sky and the planet
    earth.tick(dt, t, cam); sky.tick(t);
    if (!RED) st.rotation.y = 0;
    mapT -= dt; if (mapT <= 0) { mapT = .1; drawMap(); }
    R.render(scene, cam);
  }
  // draw labels once the fonts are in
  (D.fonts && D.fonts.load ? Promise.all([D.fonts.load('900 40px Vazirmatn'), D.fonts.load('700 40px "Space Grotesk"')]) : Promise.resolve()).then(function () { setLang(lang); }, function () { setLang(lang); });
  setLang(lang);
  requestAnimationFrame(loop);
})(window, document);
