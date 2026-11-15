/* entekhab.net /world/ — the post studio: a picture (1:1, 4:5, 9:16 or 16:9) and a caption with hashtags, in any of the
   site's four languages, from the same live values as the page (WL.value). Loaded on the first «make a post».
   Nothing is posted by the site: the visitor downloads, copies or shares through their own apps. */
(function () {
  'use strict';
  var w = window, d = document, WL = w.WL, M = WL.M, Tl = WL.Tl, esc = WL.esc, num = WL.num, words = WL.words, loc = WL.loc;
  var SITE = 'https://entekhab.net/world/';
  var FMT = { sq: [1080, 1080], pt: [1080, 1350], st: [1080, 1920], wd: [1600, 900] };
  var LANGS = [['ckb', 'کوردی'], ['fa', 'فارسی'], ['ar', 'العربية'], ['en', 'English']];      /* Kurdish first, English last */
  var TH = {
    night: { bg0: '#07070a', bg1: '#141017', ink: '#f6f3ee', mute: '#a39f98', acc: '#f7931a', acc2: '#ffd27a', card: 'rgba(255,255,255,0.055)', line: 'rgba(255,255,255,0.12)', up: '#34d399' },
    sun: { bg0: '#fff8ee', bg1: '#ffe9cc', ink: '#1b140c', mute: '#7a6a58', acc: '#d9730b', acc2: '#a65a07', card: 'rgba(255,255,255,0.75)', line: 'rgba(120,70,10,0.18)', up: '#0f9f6e' },
    aurora: { bg0: '#0b0a24', bg1: '#3a1450', ink: '#fbf7ff', mute: '#c7bfe0', acc: '#ffb347', acc2: '#ff7ac6', card: 'rgba(255,255,255,0.08)', line: 'rgba(255,255,255,0.16)', up: '#5ef2c0' }
  };
  var S = { tpl: 'digest', id: null, fmt: 'sq', theme: 'night', lang: WL.lang() };
  try { var sv = JSON.parse(localStorage.getItem('wl_st') || '{}'); if (FMT[sv.fmt]) S.fmt = sv.fmt; if (TH[sv.theme]) S.theme = sv.theme; } catch (e) { }
  var logo = new Image(); logo.src = '/assets/logo-h.webp';
  var fontsOk = null;
  function fonts() {
    if (fontsOk) return fontsOk;
    var want = ['900 60px Vazirmatn', '700 40px Vazirmatn', '400 30px Vazirmatn'];
    var google = Promise.all(want.map(function (f) { return d.fonts && d.fonts.load ? d.fonts.load(f, 'ابپ123') : Promise.resolve([]); }))
      .then(function (r) { if (!r.every(function (x) { return x && x.length; })) throw new Error('nofont'); });
    var own = function () {
      if (!w.FontFace) return Promise.resolve();
      var faces = [['Vazirmatn', '/assets/fonts/Vazirmatn-Black.ttf', '900'], ['Vazirmatn', '/assets/fonts/Vazirmatn-Bold.ttf', '700'], ['Vazirmatn', '/assets/fonts/Vazirmatn-Regular.ttf', '400']];
      return Promise.all(faces.map(function (f) { var ff = new FontFace(f[0], 'url(' + f[1] + ')', { weight: f[2] }); return ff.load().then(function (x) { d.fonts.add(x); }); })).catch(function () { });
    };
    var timeout = new Promise(function (res, rej) { setTimeout(function () { rej(new Error('slow')); }, 2500); });
    fontsOk = Promise.race([google, timeout]).catch(own);
    return fontsOk;
  }

  /* ---------------------------------------------------------------- values for a language */
  function unitW(u, lg) { return u === 'usd' ? Tl(lg, 'u_usd') : u === 'btc' ? Tl(lg, 'u_btc') : u === 'blocks' ? Tl(lg, 'blocks', { n: '' }).trim() : Tl(lg, 'u_' + u); }
  function big(v, unit, lg, dec) {
    if (v == null || !isFinite(v)) return '—';
    if (unit === 'btc') return num(v, v < 100 ? 3 : 2, lg) + ' ₿';
    if (unit === 'usd') return v >= 1e6 ? words(v, lg) + ' ' + Tl(lg, 'u_usd') : '$' + num(v, 0, lg);
    var s = v >= 1e6 ? words(v, lg) : num(v, dec != null ? dec : (v < 100 && v % 1 ? 2 : 0), lg);
    return s + ' ' + unitW(unit, lg);
  }
  function full(r, lg) { return r.unit === 'usd' ? '$' + num(r.v, 0, lg) : num(r.v, r.dec, lg); }
  function pace(r, lg) {
    var s = WL.srcOf(r); if (!s) return r.id && r.id.indexOf('btc') === 0 || r.id === 'halving' ? 'Bitcoin · mempool.space' : '';
    var f = r.f;
    return s.pub + (f ? ' · ' + (f.atleast ? Tl(lg, 'atleast') + ' · ' : '') + Tl(lg, f.basis === 'proj' ? 'pace_proj' : 'pace_obs', { y: loc(String(f.year), lg) }) : '');
  }
  function hhmm(now, lg) { return loc(('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2), lg); }
  var DIGEST = ['births', 'deaths', 'btc_today', 'co2', 'oil', 'military'];
  var SECOND = ['births', 'deaths', 'gdp', 'military', 'co2', 'oil'];
  var EMO = { births: '👶', deaths: '🕯', btc_today: '₿', btc_year: '₿', btc_supply: '₿', btc_left: '⏳', halving: '✂️', btc_price: '💰', mcap: '🪙', co2: '🏭', oil: '🛢', military: '🛡', gdp: '📈', pop: '🌍', growth: '📈',
    usdebt: '🏛', gold: '🥇', energy: '⚡', forest: '🌳', trees: '🌲', under5: '🧒', tobacco: '🚬', tb: '🫁', road: '🚗', malaria: '🦟', aids: '🎗', online: '🌐', netusers: '🌐' };

  function rows(list, now, lg, mode) {
    return list.map(function (id) {
      var r = WL.value(id, now); if (!r) return null;
      var v = mode === 's' ? r.rate : (r.v2 != null ? r.v2 : r.v);
      if (v == null) return null;
      var txt = mode === 's' ? (r.unit === 'usd' ? '$' + num(v, v < 100 ? 1 : 0, lg) : num(v, v < 10 ? 2 : v < 1000 ? 1 : 0, lg) + ' ' + unitW(r.unit, lg)) : big(v, r.unit, lg);
      return { id: id, label: Tl(lg, 'k_' + id), val: txt, r: r };
    }).filter(Boolean);
  }

  /* a finished period (scripts/world_post.py): raw numbers in, each language formats them */
  function periodRows(doc, lg) {
    return (doc.rows || []).map(function (r) {
      if (r.v == null || !isFinite(r.v)) return null;
      var val;
      if (r.id === 'btc_mined') val = num(r.v, 3, lg) + ' ₿' + (r.blocks ? ' · ' + Tl(lg, 'blocks', { n: num(r.blocks, 0, lg) }) : '');
      else if (r.id === 'btc_price') {
        /* LRMs keep «▲ +» between the two numbers: Arabic-Indic digits count as right-to-left for the neutrals around them */
        var M_ = lg === 'en' ? '' : '\u200e';
        val = '$' + num(r.v, 0, lg) + (r.pct != null ? M_ + '  ' + (r.pct >= 0 ? '▲ +' : '▼ −') + M_ + num(Math.abs(r.pct), 2, lg) + (lg === 'en' ? '%' : '٪') : '');
        if (lg !== 'en') val = '\u2066' + val + '\u2069';          /* the price and its sign stay left-to-right in RTL text */
      }
      else val = big(r.v, r.unit, lg);
      return { id: r.id === 'btc_mined' ? 'btc_today' : r.id, label: Tl(lg, 'k_' + r.id), val: val, ltr: r.id === 'btc_price' };
    }).filter(Boolean);
  }

  /* ---------------------------------------------------------------- caption */
  function tags(lg, cat) {
    var g = Tl(lg, 'tags').split(' ');
    return [Tl(lg, 'tag_' + (cat || 'pop')), g[0], g[2], g[3]].join(' ');
  }
  function caption(st, lg, now) {
    now = now || new Date(); lg = lg || st.lang;
    var L = [], cat = 'pop';
    if (st.tpl === 'period') {
      var dc = st.doc, lb = dc.labels[lg] || dc.labels.en;
      L.push('🌍 ' + lb.title); L.push('📅 ' + lb.sub);
      periodRows(dc, lg).forEach(function (x) { L.push((EMO[x.id] || '•') + ' ' + x.label + ': ' + x.val); });
      if (dc.pop_end) L.push('👥 ' + Tl(lg, 'pop_end', { v: num(dc.pop_end, 0, lg) }));
      L.push('📚 ' + dc.src);
      L.push(''); L.push('🔴 ' + Tl(lg, 'cap_more') + ' ' + SITE); L.push('📲 ' + Tl(lg, 'cap_join') + ' @Coin_Kurd'); L.push('');
      var g = Tl(lg, 'tags').split(' ');
      L.push([Tl(lg, 'tag_' + dc.kind), g[0], g[2], g[3]].join(' '));
      return L.join('\n');
    }
    if (st.tpl === 'card') {
      var r = WL.value(st.id, now); if (!r) return '';
      cat = r.cat;
      L.push((EMO[st.id] || '🌍') + ' ' + Tl(lg, 'k_' + st.id));
      if (r.v2 != null) {
        L.push('📅 ' + Tl(lg, 'year') + ': ' + big(r.v, r.unit, lg)); L.push('🕐 ' + Tl(lg, 'today') + ': ' + big(r.v2, r.unit, lg));
        if (r.rate) L.push('⏱ ' + WL.rateText(r.rate, r.unit, lg, 2));
      } else {
        L.push('🔢 ' + (r.unit === 'usd' ? '$' + num(r.v, 0, lg) : full(r, lg) + ' ' + unitW(r.unit, lg)));
        if (r.sub) L.push('↳ ' + r.sub(lg));
      }
      L.push('🕒 ' + Tl(lg, 'cap_until', { t: hhmm(now, lg) }));
      var p = pace(r, lg); if (p) L.push('📚 ' + Tl(lg, 'cap_src', { s: p }));
    } else if (st.tpl === 'btcgold') {
      cat = 'btc';
      var b = WL.value('btc_today', now), g = WL.value('gold', now), s = WL.value('btc_supply', now);
      L.push('₿🥇 ' + Tl(lg, 'bg_title'));
      if (b) L.push('₿ ' + Tl(lg, 'bg_btc') + ': ' + num(b.v, 3, lg) + ' ' + Tl(lg, 'u_btc'));
      if (g) L.push('🥇 ' + Tl(lg, 'bg_gold') + ': ' + num(g.v2, 2, lg) + ' ' + Tl(lg, 'u_t'));
      if (s) L.push('📊 ' + num(s.v / 21e6 * 100, 2, lg) + (lg === 'en' ? '% ' : '٪ ') + Tl(lg, 'bg_supply'));
      L.push('🕒 ' + Tl(lg, 'cap_until', { t: hhmm(now, lg) }));
      L.push('📚 ' + Tl(lg, 'bg_gsrc'));
    } else {
      var sec = st.tpl === 'second';
      L.push(sec ? '⏱ ' + Tl(lg, 's_title') : '🌍 ' + Tl(lg, 'd_title'));
      rows(sec ? SECOND : DIGEST, now, lg, sec ? 's' : 't').forEach(function (x) { L.push((EMO[x.id] || '•') + ' ' + x.label + ': ' + x.val); });
      if (!sec) L.push('🕒 ' + Tl(lg, 'cap_until', { t: hhmm(now, lg) }));
      L.push('📚 UN · WHO · IMF · SIPRI · IEA · GCP · mempool.space');
    }
    L.push('');
    L.push('🔴 ' + Tl(lg, 'cap_more') + ' ' + link(st));
    L.push('📲 ' + Tl(lg, 'cap_join') + ' @Coin_Kurd');
    L.push('');
    L.push(tags(lg, cat));
    return L.join('\n');
  }
  function link(st) { return SITE + (st.tpl === 'card' && st.id ? '#c-' + st.id : ''); }

  /* ---------------------------------------------------------------- drawing */
  var FONT = 'Vazirmatn, "Space Grotesk", Tahoma, sans-serif';
  function font(c, wgt, px) { c.font = wgt + ' ' + Math.round(px) + 'px ' + FONT; }
  function fit(c, text, maxW, px, wgt, min) {
    font(c, wgt, px);
    while (c.measureText(text).width > maxW && px > (min || 12)) { px *= 0.94; font(c, wgt, px); }
    return px;
  }
  function wrap(c, text, maxW) {
    var ws = String(text).split(/\s+/), out = [], cur = '';
    ws.forEach(function (x) { var t = cur ? cur + ' ' + x : x; if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = x; } else cur = t; });
    if (cur) out.push(cur);
    return out;
  }
  function rr(c, x, y, wd, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + wd, y, x + wd, y + h, r); c.arcTo(x + wd, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + wd, y, r); c.closePath(); }

  /* every size is a share of U = the shorter side, so 1:1, 4:5, 9:16 and 16:9 keep their proportions; the body is laid
     out once invisibly, then scaled down if it does not fit between the header and the footer, and centred if it is short */
  function draw(cv, st, now) {
    var sz = FMT[st.fmt], W = sz[0], H = sz[1], th = TH[st.theme], lg = st.lang, rtl = lg !== 'en', U = Math.min(W, H);
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    c.direction = rtl ? 'rtl' : 'ltr';
    /* background */
    var g = c.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, th.bg1); g.addColorStop(1, th.bg0); c.fillStyle = g; c.fillRect(0, 0, W, H);
    var gl = c.createRadialGradient(W * 0.82, H * 0.08, 10, W * 0.82, H * 0.08, Math.max(W, H) * 0.7);
    gl.addColorStop(0, 'rgba(247,147,26,0.30)'); gl.addColorStop(1, 'rgba(247,147,26,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    if (st.theme === 'aurora') { var g2 = c.createRadialGradient(W * 0.1, H * 0.95, 10, W * 0.1, H * 0.95, W); g2.addColorStop(0, 'rgba(255,122,198,0.28)'); g2.addColorStop(1, 'rgba(255,122,198,0)'); c.fillStyle = g2; c.fillRect(0, 0, W, H); }
    /* a dotted globe rising from the bottom edge */
    var R = U * 0.62, gx = W * (rtl ? 0.22 : 0.78), gy = H + R * 0.35;
    for (var i = 0; i < 900; i++) {
      var y = 1 - (i / 899) * 2, rd = Math.sqrt(1 - y * y), t = i * 2.399963229728653, x = Math.cos(t) * rd, z = Math.sin(t) * rd;
      if (z < 0) continue;
      c.fillStyle = st.theme === 'sun' ? 'rgba(166,90,7,' + (0.08 + z * 0.22).toFixed(3) + ')' : 'rgba(255,214,150,' + (0.05 + z * 0.22).toFixed(3) + ')';
      var s = 2 + z * 3; c.fillRect(gx + x * R - s / 2, gy + y * R - s / 2, s, s);
    }
    var P = U * 0.07, top = P, X0 = rtl ? W - P : P;
    /* header: logo, and «LIVE · entekhab.net» with its dot */
    var lh = Math.round(U * 0.075);
    if (logo.complete && logo.naturalWidth) { var lw = lh * logo.naturalWidth / logo.naturalHeight; c.drawImage(logo, rtl ? W - P - lw : P, top, lw, lh); }
    font(c, 700, U * 0.027); c.direction = 'ltr';
    var live = 'LIVE · entekhab.net', lwid = c.measureText(live).width, lx = rtl ? P + U * 0.03 : W - P - lwid;
    c.textAlign = 'left'; c.fillStyle = th.mute; c.fillText(live, lx, top + lh * 0.5 + U * 0.01);
    c.fillStyle = th.acc; c.beginPath(); c.arc(lx - U * 0.018, top + lh * 0.5, U * 0.008, 0, 6.2832); c.fill();
    c.direction = rtl ? 'rtl' : 'ltr'; c.textAlign = rtl ? 'right' : 'left'; c.textBaseline = 'alphabetic';
    /* footer: time, a rule, the address and the channel */
    var fy = H - P;
    c.fillStyle = th.line; c.fillRect(P, fy - U * 0.07, W - 2 * P, 2);
    font(c, 700, U * 0.03); c.fillStyle = th.ink; c.direction = 'ltr'; c.textAlign = rtl ? 'right' : 'left';
    c.fillText('entekhab.net/world', rtl ? W - P : P, fy - U * 0.012);
    c.textAlign = rtl ? 'left' : 'right'; c.fillStyle = th.acc; c.fillText('@Coin_Kurd', rtl ? P : W - P, fy - U * 0.012);
    c.direction = rtl ? 'rtl' : 'ltr'; c.textAlign = rtl ? 'right' : 'left';
    font(c, 400, U * 0.022); c.fillStyle = th.mute;
    c.fillText(st.tpl === 'period' ? '📚 ' + st.doc.src : Tl(lg, 'cap_until', { t: hhmm(now, lg) }), X0, fy - U * 0.09);
    /* body */
    var box = { x0: P, x1: W - P, y0: top + lh + U * 0.07, y1: fy - U * 0.14, W: W, H: H, U: U, rtl: rtl, th: th, lg: lg };
    var body = st.tpl === 'card' ? drawCard : st.tpl === 'btcgold' ? drawBG : drawRows;
    var avail = box.y1 - box.y0;
    c.save(); c.globalAlpha = 0; var used = body(c, st, now, box, 1, 0); c.restore();
    var k = used > avail ? Math.max(0.55, avail / used) : used < avail * 0.7 ? Math.min(1.6, avail * 0.8 / used) : 1;
    if (st.tpl !== 'digest' && st.tpl !== 'second' && st.tpl !== 'period' && k !== 1) { c.save(); c.globalAlpha = 0; used = body(c, st, now, box, k, 0); c.restore(); }
    var off = used < avail ? (avail - used) * (H / W > 1.4 ? 0.42 : 0.3) : 0;
    body(c, st, now, box, k, off);
  }
  /* each body draws from box.y0 + off at scale k and returns the height it used */
  function drawCard(c, st, now, b, k, off) {
    var r = WL.value(st.id, now); if (!r) return 0;
    var U = b.U * k, lg = b.lg, th = b.th, rtl = b.rtl, X0 = rtl ? b.x1 : b.x0, cw = b.x1 - b.x0, y = b.y0 + off;
    c.textAlign = rtl ? 'right' : 'left'; c.direction = rtl ? 'rtl' : 'ltr';
    font(c, 700, U * 0.032); c.fillStyle = th.acc; y += U * 0.032; c.fillText(Tl(lg, 'sec_' + r.cat), X0, y); y += U * 0.05;
    font(c, 900, U * 0.06); c.fillStyle = th.ink;
    wrap(c, Tl(lg, 'k_' + st.id), cw).forEach(function (ln) { y += U * 0.066; c.fillText(ln, X0, y); y += U * 0.012; });
    var main = r.unit === 'usd' ? '$' + num(r.v, 0, lg) : num(r.v, r.dec, lg);
    c.direction = 'ltr';
    var px = fit(c, main, cw, U * 0.15, 900, 18);
    y += px * 1.02;
    var gr = c.createLinearGradient(0, y - px, 0, y); gr.addColorStop(0, th.acc2); gr.addColorStop(1, th.acc); c.fillStyle = gr;
    c.fillText(main, X0, y);
    c.direction = rtl ? 'rtl' : 'ltr';
    font(c, 700, U * 0.036); c.fillStyle = th.mute;
    var u = r.unit === 'usd' ? Tl(lg, 'u_usd') : unitW(r.unit, lg);
    y += U * 0.06; c.fillText(u + (r.v2 != null ? ' · ' + Tl(lg, 'year') : ''), X0, y);
    if (r.v2 != null) {
      y += U * 0.04;
      rr(c, b.x0, y, cw, U * 0.155, U * 0.026); c.fillStyle = th.card; c.fill(); c.strokeStyle = th.line; c.lineWidth = 2; c.stroke();
      var ix = rtl ? X0 - U * 0.035 : X0 + U * 0.035;
      font(c, 700, U * 0.031); c.fillStyle = th.mute; c.fillText(Tl(lg, 'today'), ix, y + U * 0.055);
      font(c, 900, U * 0.052); c.fillStyle = th.ink; c.fillText(big(r.v2, r.unit, lg), ix, y + U * 0.125);
      y += U * 0.155;
      if (r.rate) { font(c, 700, U * 0.032); c.fillStyle = th.up; y += U * 0.06; c.fillText('⏱ ' + WL.rateText(r.rate, r.unit, lg, 2), X0, y); }
    } else if (r.sub) {
      font(c, 400, U * 0.032); c.fillStyle = th.ink;
      wrap(c, r.sub(lg), cw).slice(0, 3).forEach(function (ln) { y += U * 0.05; c.fillText(ln, X0, y); });
    }
    var p = pace(r, lg);
    if (p) { font(c, 400, U * 0.024); c.fillStyle = th.mute; y += U * 0.02; wrap(c, '📚 ' + p, cw).slice(0, 2).forEach(function (ln) { y += U * 0.036; c.fillText(ln, X0, y); }); }
    return y - (b.y0 + off);
  }
  function drawRows(c, st, now, b, k, off) {
    var sec = st.tpl === 'second', U = b.U * k, lg = b.lg, th = b.th, rtl = b.rtl, X0 = rtl ? b.x1 : b.x0, cw = b.x1 - b.x0, y = b.y0 + off;
    c.textAlign = rtl ? 'right' : 'left'; c.direction = rtl ? 'rtl' : 'ltr';
    var per = st.tpl === 'period', lb = per ? (st.doc.labels[lg] || st.doc.labels.en) : null;
    font(c, 900, U * 0.062); c.fillStyle = th.ink;
    wrap(c, per ? lb.title : Tl(lg, sec ? 's_title' : 'd_title'), cw).forEach(function (ln) { y += U * 0.066; c.fillText(ln, X0, y); y += U * 0.014; });
    if (per) { font(c, 700, U * 0.032); c.fillStyle = th.acc; wrap(c, lb.sub, cw).slice(0, 2).forEach(function (ln) { y += U * 0.045; c.fillText(ln, X0, y); }); }
    y += U * 0.03;
    var list = per ? periodRows(st.doc, lg) : rows(sec ? SECOND : DIGEST, now, lg, sec ? 's' : 't');
    var cols = b.W / b.H > 0.9 ? 2 : 1, gap = U * 0.022, colw = (cw - gap * (cols - 1)) / cols;
    var nrow = Math.ceil(list.length / cols);
    var rh = Math.max(b.U * 0.1, Math.min(b.U * 0.22, (b.y1 - y - (nrow - 1) * gap - (sec ? b.U * 0.09 : 0)) / nrow));      /* rows fill the box */
    list.forEach(function (x, i) {
      var ci = i % cols, ri = Math.floor(i / cols);
      var top = y + ri * (rh + gap), left = rtl ? b.x1 - (ci + 1) * colw - ci * gap : b.x0 + ci * (colw + gap);
      rr(c, left, top, colw, rh, U * 0.024); c.fillStyle = th.card; c.fill(); c.strokeStyle = th.line; c.lineWidth = 2; c.stroke();
      var pad = U * 0.035, lx = rtl ? left + colw - pad : left + pad, vx = rtl ? left + pad : left + colw - pad;
      c.fillStyle = th.mute; c.textAlign = rtl ? 'right' : 'left';
      var lab = (EMO[x.id] || '•') + '  ' + x.label, lp = fit(c, lab, colw - 2 * pad, Math.min(b.U * 0.036, rh * 0.22), 700, 12);
      c.fillText(lab, lx, top + rh * 0.12 + lp);
      c.textAlign = rtl ? 'left' : 'right';
      var vtxt = x.ltr ? x.val.replace(/[\u2066\u2069]/g, '') : x.val;
      if (x.ltr) c.direction = 'ltr';                     /* a price with its sign: always left-to-right (canvas ignores isolates) */
      var px = fit(c, vtxt, colw - 2 * pad, Math.min(b.U * 0.068, rh * 0.4), 900, 14);
      c.fillStyle = i % 2 ? th.ink : th.acc; c.fillText(vtxt, vx, top + rh * 0.86);
      c.direction = rtl ? 'rtl' : 'ltr';
      c.textAlign = rtl ? 'right' : 'left';
    });
    y += nrow * rh + (nrow - 1) * gap;
    if (sec) { font(c, 400, U * 0.024); c.fillStyle = th.mute; y += U * 0.045; c.fillText(Tl(lg, 'src') + ': UN · IMF · SIPRI · GCP · IEA', X0, y); }
    return y - (b.y0 + off);
  }
  function drawBG(c, st, now, b, k, off) {
    var U = b.U * k, lg = b.lg, th = b.th, rtl = b.rtl, X0 = rtl ? b.x1 : b.x0, cw = b.x1 - b.x0, y = b.y0 + off;
    c.textAlign = rtl ? 'right' : 'left'; c.direction = rtl ? 'rtl' : 'ltr';
    font(c, 900, U * 0.064); c.fillStyle = th.ink;
    wrap(c, Tl(lg, 'bg_title'), cw).forEach(function (ln) { y += U * 0.068; c.fillText(ln, X0, y); y += U * 0.014; });
    y += U * 0.035;
    var bt = WL.value('btc_today', now), g = WL.value('gold', now), s = WL.value('btc_supply', now);
    var gap = U * 0.04, bw = (cw - gap) / 2, bh = U * 0.34;
    [[bt ? num(bt.v, 3, lg) : '—', '₿ ' + Tl(lg, 'bg_btc'), Tl(lg, 'u_btc'), th.acc], [g ? num(g.v2, 2, lg) : '—', '🥇 ' + Tl(lg, 'bg_gold'), Tl(lg, 'u_t'), th.acc2]].forEach(function (q, i) {
      var x = rtl ? b.x1 - bw - i * (bw + gap) : b.x0 + i * (bw + gap);
      rr(c, x, y, bw, bh, U * 0.032); c.fillStyle = th.card; c.fill(); c.strokeStyle = th.line; c.lineWidth = 2; c.stroke();
      c.textAlign = 'center';
      font(c, 700, U * 0.032); c.fillStyle = th.mute; c.fillText(q[1], x + bw / 2, y + bh * 0.24);
      var px = fit(c, q[0], bw * 0.86, U * 0.11, 900, 18); c.fillStyle = q[3]; c.fillText(q[0], x + bw / 2, y + bh * 0.6);
      font(c, 700, U * 0.032); c.fillStyle = th.ink; c.fillText(q[2], x + bw / 2, y + bh * 0.6 + Math.max(px * 0.6, U * 0.06));
    });
    c.textAlign = rtl ? 'right' : 'left';
    y += bh + U * 0.06;
    if (s) {
      var pc = s.v / 21e6, bh2 = U * 0.034;
      rr(c, b.x0, y, cw, bh2, bh2 / 2); c.fillStyle = th.card; c.fill();
      var fw = cw * pc; rr(c, rtl ? b.x1 - fw : b.x0, y, fw, bh2, bh2 / 2); c.fillStyle = th.acc; c.fill();
      y += bh2 + U * 0.055; font(c, 700, U * 0.034); c.fillStyle = th.ink;
      c.fillText(num(pc * 100, 2, lg) + (lg === 'en' ? '% ' : '٪ ') + Tl(lg, 'bg_supply'), X0, y);
    }
    font(c, 400, U * 0.024); c.fillStyle = th.mute; y += U * 0.02;
    wrap(c, Tl(lg, 'bg_gsrc'), cw).forEach(function (ln) { y += U * 0.038; c.fillText(ln, X0, y); });
    return y - (b.y0 + off);
  }

  /* ---------------------------------------------------------------- the dialog */
  var m = null, cv = null, ta = null, timer = null, dirty = false;
  function chips(name, list, cur) {
    return '<div class="wl-seg" role="group" data-g="' + name + '">' + list.map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (x[0] === cur ? 'on' : '') + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
  }
  function ui() {
    var lg = WL.lang(), T = function (k) { return Tl(lg, k); };
    var tpls = [['digest', T('tpl_digest')], ['second', T('tpl_second')], ['btcgold', T('tpl_btcgold')]];
    if (S.id) tpls.unshift(['card', T('tpl_card')]);
    return '<h3>' + esc(T('st_title')) + '</h3><div class="wl-st"><div class="wl-pv"><canvas></canvas></div><div class="wl-ctl">' +
      '<label>' + esc(T('st_tpl')) + '</label>' + chips('tpl', tpls, S.tpl) +
      '<label>' + esc(T('st_fmt')) + '</label>' + chips('fmt', [['sq', T('fmt_sq')], ['pt', T('fmt_pt')], ['st', T('fmt_st')], ['wd', T('fmt_wd')]], S.fmt) +
      '<label>' + esc(T('st_theme')) + '</label>' + chips('theme', [['night', T('th_night')], ['sun', T('th_sun')], ['aurora', T('th_aurora')]], S.theme) +
      '<label>' + esc(T('st_lang')) + '</label>' + chips('lang', LANGS, S.lang) +
      '<textarea class="wl-cap" rows="9" spellcheck="false"></textarea>' +
      '<div class="wl-acts"><button type="button" class="wl-btn wl-pri" data-a="dl">' + esc(T('b_dl')) + '</button><button type="button" class="wl-btn" data-a="share">' + esc(T('b_share')) + '</button>' +
      '<button type="button" class="wl-btn" data-a="copy">' + esc(T('b_copy')) + '</button><button type="button" class="wl-btn" data-a="all">' + esc(T('b_all')) + '</button>' +
      '<a class="wl-btn" data-a="tg" target="_blank" rel="noopener">' + esc(T('b_tg')) + '</a><a class="wl-btn" data-a="x" target="_blank" rel="noopener">' + esc(T('b_x')) + '</a>' +
      '<a class="wl-btn" data-a="wa" target="_blank" rel="noopener">' + esc(T('b_wa')) + '</a><button type="button" class="wl-btn" data-a="link">' + esc(T('b_link')) + '</button></div>' +
      '<p class="wl-toast" aria-live="polite"></p></div></div>';
  }
  function toast(t) { var e = m && m.querySelector('.wl-toast'); if (e) { e.textContent = t; clearTimeout(e._t); e._t = setTimeout(function () { e.textContent = ''; }, 3500); } }
  function render(keepText) {
    if (!m) return;
    var now = new Date();
    draw(cv, S, now);
    var cap = caption(S, S.lang, now);
    if (!keepText || !dirty) { ta.value = cap; ta.dir = S.lang === 'en' ? 'ltr' : 'rtl'; }
    var txt = ta.value, url = link(S), enc = encodeURIComponent;
    var short = txt.split('\n').filter(function (l) { return l.trim(); }).slice(0, 4).join('\n') + '\n' + url + '\n' + tags(S.lang, (WL.value(S.id || 'births', now) || {}).cat);
    m.querySelector('[data-a=tg]').href = 'https://t.me/share/url?url=' + enc(url) + '&text=' + enc(txt.replace(url, '').trim());
    m.querySelector('[data-a=x]').href = 'https://x.com/intent/post?text=' + enc(short.slice(0, 270));
    m.querySelector('[data-a=wa]').href = 'https://wa.me/?text=' + enc(txt);
  }
  function blob() { return new Promise(function (res) { draw(cv, S, new Date()); cv.toBlob(function (b) { res(b); }, 'image/png'); }); }
  function fname() { return 'entekhab-world-' + (S.tpl === 'card' ? S.id : S.tpl) + '-' + S.fmt + '-' + S.lang + '.png'; }
  function copy(t) {
    var lg = WL.lang();
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { toast(Tl(lg, 'copied')); }, function () { fallback(); });
    fallback();
    function fallback() { ta.select(); try { d.execCommand('copy'); toast(Tl(lg, 'copied')); } catch (e) { } }
  }
  function act(a) {
    var lg = WL.lang();
    if (a === 'dl') return blob().then(function (b) { var u = URL.createObjectURL(b), x = d.createElement('a'); x.href = u; x.download = fname(); d.body.appendChild(x); x.click(); x.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); toast(Tl(lg, 'saved')); });
    if (a === 'copy') return copy(ta.value);
    if (a === 'link') return copy(link(S));
    if (a === 'all') { var now = new Date(); return copy(LANGS.map(function (x) { return caption(S, x[0], now); }).join('\n\n━━━━━━━━━━\n\n')); }
    if (a === 'share') return blob().then(function (b) {
      var f = w.File ? new File([b], fname(), { type: 'image/png' }) : null;
      if (f && navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], text: ta.value }).catch(function () { });
      if (navigator.share) return navigator.share({ text: ta.value, url: link(S) }).catch(function () { });
      toast(Tl(lg, 'noshare'));
    });
  }
  function open(what) {
    if (m) m.close();
    S.lang = WL.lang();
    if (what && ['digest', 'second', 'btcgold'].indexOf(what) >= 0) { S.tpl = what; S.id = null; }
    else if (what && WL.value(what, new Date())) { S.tpl = 'card'; S.id = what; }
    else { S.tpl = 'digest'; S.id = null; }
    dirty = false;
    m = WL.modal(ui(), 'wl-studio');
    cv = m.querySelector('canvas'); ta = m.querySelector('.wl-cap');
    var oldClose = m.close; m.close = function () { clearInterval(timer); oldClose(); m = null; };
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('.wl-x')) { clearInterval(timer); m = null; return; }
      var b = e.target.closest('.wl-seg button');
      if (b) {
        var g = b.parentNode.getAttribute('data-g'); S[g] = b.getAttribute('data-v');
        [].forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); });
        try { localStorage.setItem('wl_st', JSON.stringify({ fmt: S.fmt, theme: S.theme })); } catch (er) { }
        dirty = false; render(); return;
      }
      var a = e.target.closest('[data-a]'); if (a && a.tagName === 'BUTTON') act(a.getAttribute('data-a'));
    });
    ta.addEventListener('input', function () { dirty = true; render(true); });
    fonts().then(function () { render(); }, function () { render(); });
    render();
    if (!logo.complete) logo.onload = function () { render(true); };
    timer = setInterval(function () { if (m && !m.isConnected) { clearInterval(timer); m = null; return; } if (m && !d.hidden) render(true); }, 1000);
  }
  /* scripts/world_post.py: the four pictures and captions of a finished period, in the site's language order */
  function renderPeriod(doc) {
    var lg0 = new Promise(function (res) { if (logo.complete && logo.naturalWidth) res(); else { logo.onload = res; logo.onerror = res; setTimeout(res, 8000); } });
    return Promise.all([fonts().catch(function () { }), lg0]).then(function () {
      var out = {}, end = new Date(doc.end);
      ['ckb', 'fa', 'ar', 'en'].forEach(function (lg) {
        var st = { tpl: 'period', doc: doc, fmt: 'sq', theme: 'night', lang: lg }, cv = d.createElement('canvas');
        draw(cv, st, end);
        out[lg] = { png: cv.toDataURL('image/png'), caption: caption(st, lg, end) };
      });
      return out;
    });
  }
  WL.studio = { open: open, caption: caption, draw: draw, state: S, FMT: FMT, renderPeriod: renderPeriod, ready: fonts };
})();
