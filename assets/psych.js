/* سامانهٔ هوش روان‌شناسی معامله‌گر — رابط کاربری و مغز سه‌بعدی
   محاسبه در assets/psych-core.js است؛ اینجا فقط نمایش و ذخیرهٔ محلی.
   هیچ درخواست شبکه‌ای از این فایل بیرون نمی‌رود. */
(function () {
  'use strict';
  var C = window.PSY_CFG || {}, P = window.PSY;
  var root = document.getElementById('ps');
  if (!root || !P) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var KEY = 'ek_psy_v1';
  var FA = function (n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var r1 = function (v) { return v == null ? '—' : FA(v.toFixed(1)); };

  // ---------------------------------------------------------------- ذخیره‌سازی
  var S = { trades: [], survey: {}, emo: [], snaps: [], cfg: { riskLimit: 1, dailyCap: 5, acct: 1000 }, pre: [], post: [] };
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
    S.cfg = Object.assign({ riskLimit: 1, dailyCap: 5, acct: 1000 }, S.cfg || {});
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  // ---------------------------------------------------------------- نمره‌های پرسشنامه
  /* هر بُعد میانگین گویه‌هایش روی صفر تا صد؛ گویهٔ معکوس برعکس شمرده می‌شود. */
  function surveyScores() {
    var out = {};
    (C.dims || []).forEach(function (d) {
      var items = (C.items || {})[d.id] || [], vals = [];
      items.forEach(function (it, i) {
        var v = (S.survey[d.id] || {})[i];
        if (v == null) return;
        vals.push((it.r ? (4 - v) : v) / 4 * 100);
      });
      out[d.id] = vals.length === items.length && items.length ? P.mean(vals) : null;
    });
    return out;
  }

  function state() {
    var m = P.metrics(S.trades, S.cfg);
    var sv = surveyScores();
    var t = P.tps(m, sv, C.weights);
    return { m: m, sv: sv, t: t, d: P.detectors(S.trades, S.cfg) };
  }
  function cls(v) { return v == null ? 'na' : v >= 70 ? 'good' : v >= 40 ? 'warn' : 'bad'; }

  // ---------------------------------------------------------------- نمای کلی
  function kpi(label, v, extra) {
    var c = cls(v);
    return '<div class="ps-kpi' + (v == null ? ' na' : '') + '"><b class="' + c + '">' +
      (v == null ? 'دادهٔ ناکافی' : FA(Math.round(v)) + (extra || '')) + '</b><small>' + esc(label) + '</small>' +
      (v == null ? '' : '<span class="bar"><i class="bg-' + c + '" style="width:' + Math.max(2, Math.min(100, v)) + '%"></i></span>') + '</div>';
  }
  function renderOver(st) {
    var m = st.m, t = st.t;
    $('#psKpi').innerHTML =
      kpi('امتیاز روان‌شناسی معامله (TPS)', t.score) +
      kpi('انضباط معاملاتی', m.discipline, '٪') +
      kpi('کیفیت تصمیم', m.decision) +
      kpi('کنترل تکانه', m.impulse) +
      kpi('رعایت سقف ریسک', m.risk, '٪') +
      '<div class="ps-kpi"><b>' + FA(m.nEligible) + ' / ' + FA(m.n) + '</b><small>معاملهٔ قابل ارزیابی از کل</small></div>';
    var cov = '<p class="note">این امتیاز روی ' + FA(Math.round(t.coverage)) + '٪ از وزن کل ساخته شده؛ بقیه هنوز دادهٔ کافی ندارند.</p>';
    $('#psKpi').insertAdjacentHTML('beforeend', '');
    $('#psTop').innerHTML = topIssues(st) + cov;
    radar(st);
    gap(st);
  }
  function topIssues(st) {
    var rows = [];
    (C.pats || []).forEach(function (p) {
      var r = st.d[p.id];
      if (!r || r.hit !== true) return;
      rows.push({ p: p, rate: r.rate, n: r.n });
    });
    rows.sort(function (a, b) { return b.rate - a.rate; });
    if (!rows.length) return '<p class="note">هنوز هیچ الگویی با دادهٔ کافی تأیید نشده است. ژورنال را کامل‌تر کنید.</p>';
    return '<div class="ps-gap">' + rows.slice(0, 5).map(function (x) {
      return '<div><span>' + x.p.icon + ' ' + esc(x.p.fa) + '</span><b class="bad">' + FA(Math.round(x.rate)) +
        '٪</b><small class="note">' + FA(x.n) + ' نمونه</small></div>';
    }).join('') + '</div>';
  }
  function gap(st) {
    var rows = [];
    (C.dims || []).forEach(function (d) {
      var said = st.sv[d.id], did = { discipline: st.m.discipline, decision: st.m.decision, impulse: st.m.impulse }[d.id];
      if (said == null || did == null) return;
      rows.push({ d: d, said: said, did: did, gap: said - did });
    });
    if (!rows.length) { $('#psGap').innerHTML = '<p class="note">برای این مقایسه هم باید پرسشنامه را کامل کنید و هم دست‌کم ده معاملهٔ قابل ارزیابی داشته باشید.</p>'; return; }
    rows.sort(function (a, b) { return Math.abs(b.gap) - Math.abs(a.gap); });
    $('#psGap').innerHTML = '<div class="ps-gap">' + rows.map(function (x) {
      var c = Math.abs(x.gap) < 10 ? 'good' : Math.abs(x.gap) < 25 ? 'warn' : 'bad';
      return '<div><span>' + x.d.icon + ' ' + esc(x.d.fa) + '</span><small class="note">گفتید ' + r1(x.said) +
        ' · کردید ' + r1(x.did) + '</small><b class="' + c + '">' + (x.gap > 0 ? '+' : '') + r1(x.gap) + '</b></div>';
    }).join('') + '</div>';
  }

  // ---------------------------------------------------------------- رادار ده‌محوره (SVG)
  function radar(st) {
    var dims = C.dims || [], n = dims.length, R = 110, cx = 150, cy = 135;
    var vals = dims.map(function (d) {
      var v = st.sv[d.id];
      if (d.id === 'discipline' && st.m.discipline != null) v = st.m.discipline;
      if (d.id === 'decision' && st.m.decision != null) v = st.m.decision;
      if (d.id === 'impulse' && st.m.impulse != null) v = st.m.impulse;
      return v;
    });
    function pt(i, r) { var a = -Math.PI / 2 + i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
    var web = '';
    [25, 50, 75, 100].forEach(function (lvl) {
      var p = dims.map(function (_, i) { return pt(i, R * lvl / 100).join(','); }).join(' ');
      web += '<polygon points="' + p + '" fill="none" stroke="currentColor" stroke-opacity=".14"/>';
    });
    var axes = dims.map(function (d, i) {
      var a = pt(i, R), l = pt(i, R + 20);
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + a[0] + '" y2="' + a[1] + '" stroke="currentColor" stroke-opacity=".14"/>' +
        '<text x="' + l[0] + '" y="' + l[1] + '" font-size="9" text-anchor="middle" dominant-baseline="middle" fill="currentColor" opacity=".75">' + d.icon + '</text>';
    }).join('');
    var have = vals.map(function (v, i) { return v == null ? null : pt(i, R * v / 100); });
    var poly = have.every(function (x) { return x; })
      ? '<polygon points="' + have.map(function (p) { return p.join(','); }).join(' ') + '" fill="#f7931a" fill-opacity=".18" stroke="#f7931a" stroke-width="1.6"/>' : '';
    var dots = have.map(function (p, i) {
      return p ? '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="#f7931a"><title>' + esc(dims[i].fa) + ': ' + r1(vals[i]) + '</title></circle>'
        : '<circle cx="' + pt(i, 8)[0] + '" cy="' + pt(i, 8)[1] + '" r="2.5" fill="#6b7280"><title>' + esc(dims[i].fa) + ': دادهٔ ناکافی</title></circle>';
    }).join('');
    $('#psRadar').innerHTML = '<svg viewBox="0 0 300 275" style="width:100%;max-width:340px;color:var(--ink)">' + web + axes + poly + dots + '</svg>';
  }

  // ---------------------------------------------------------------- مغز سه‌بعدی
  var TWIN = null;
  var ICON = {}; (C.dims || []).forEach(function (d) { ICON[d.id] = d.icon; });
  var REGIONS = [
    { id: 'emotion', p: [-0.55, 0.15, 0.45], get icon() { return ICON['emotion']; } }, { id: 'decision', p: [0.0, 0.62, 0.55], get icon() { return ICON['decision']; } },
    { id: 'fear', p: [-0.35, -0.3, 0.3], get icon() { return ICON['fear']; } }, { id: 'greed', p: [0.35, -0.3, 0.3], get icon() { return ICON['greed']; } },
    { id: 'stress', p: [0.55, 0.15, 0.45], get icon() { return ICON['stress']; } }, { id: 'discipline', p: [0.0, 0.5, -0.55], get icon() { return ICON['discipline']; } },
    { id: 'flexibility', p: [-0.6, 0.45, -0.2], get icon() { return ICON['flexibility']; } }, { id: 'impulse', p: [0.6, 0.45, -0.2], get icon() { return ICON['impulse']; } },
    { id: 'bias', p: [-0.2, -0.45, -0.45], get icon() { return ICON['bias']; } }, { id: 'resilience', p: [0.2, -0.45, -0.45], get icon() { return ICON['resilience']; } }
  ];
  function colorOf(v) { return v == null ? 0x6b7280 : v >= 70 ? 0x22c55e : v >= 40 ? 0xf6aa3c : 0xef4444; }
  /* موتور سه‌بعدی دست‌ساز روی canvas دو‌بعدی.
     چرا کتابخانهٔ آماده نیست: سیاست امنیتی سایت فقط اسکریپت خودی را اجرا می‌کند و
     باز کردن آن برای یک دامنهٔ بیرونی، روی صفحه‌ای که خودارزیابی روانی کاربر را
     نگه می‌دارد، ریسکی است که ارزشش را ندارد. این موتور چهار کیلوبایت است، آفلاین
     کار می‌کند و همان چرخش، بزرگ‌نمایی و انتخاب ناحیه را می‌دهد. */
  function buildTwin(st) {
    var host = $('#psTwin');
    if (!host) return;
    if (TWIN) { paintTwin(st); return; }
    var cv = document.createElement('canvas');
    host.innerHTML = ''; host.appendChild(cv);
    var ctx = cv.getContext('2d');
    var yaw = 0.5, pitch = -0.15, zoom = 1, drag = false, px = 0, py = 0, spin = true, hover = -1;

    // ابر نقطه‌ای به شکل مغز: دو نیم‌کره با چین‌خوردگی، شکاف میانی، و مخچه در پشت و پایین
    var cloud = [];
    function push(x, y, z, kind) { cloud.push([x, y, z, kind]); }
    for (var i = 0; i < 2600; i++) {
      var u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
      var sx = Math.sin(v) * Math.cos(u), sy = Math.sin(v) * Math.sin(u), sz = Math.cos(v);
      // چین‌خوردگی قشر: دو موج متعامد، همان چیزی که از دور «شیار» دیده می‌شود
      var fold = 1 + 0.07 * Math.sin(9 * u) * Math.sin(6 * v) + 0.035 * Math.sin(15 * v);
      var x = sx * 1.18 * fold, y = sy * 0.86 * fold, z = sz * 1.02 * fold;
      y += 0.10;                                  // بالاتنهٔ پرتر
      if (y < -0.30) y = -0.30 + (y + 0.30) * 0.45;   // کف صاف‌تر
      if (Math.abs(x) < 0.07 && z > -0.55) continue;  // شکاف طولی میان دو نیم‌کره
      push(x, y, z, 0);
    }
    for (var c = 0; c < 480; c++) {               // مخچه
      var a2 = Math.random() * Math.PI * 2, b2 = Math.acos(2 * Math.random() - 1);
      var r2 = 0.40 + 0.02 * Math.sin(18 * b2);
      push(Math.sin(b2) * Math.cos(a2) * r2 * 1.25, Math.sin(b2) * Math.sin(a2) * r2 * 0.70 - 0.52,
           Math.cos(b2) * r2 * 0.85 - 0.72, 1);
    }
    for (var t2 = 0; t2 < 120; t2++) {            // ساقهٔ مغز
      var h2 = t2 / 120;
      push((Math.random() - 0.5) * 0.17, -0.42 - h2 * 0.42, -0.30 + (Math.random() - 0.5) * 0.16, 2);
    }
    function project(p3, W, H) {
      var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var x = p3[0] * cy - p3[2] * sy, z = p3[0] * sy + p3[2] * cy;
      var y = p3[1] * cp - z * sp; z = p3[1] * sp + z * cp;
      var d = 4.2, f = d / (d - z) * zoom;
      return [W / 2 + x * f * H * 0.30, H / 2 - y * f * H * 0.30, z, f];
    }
    function draw() {
      var W = host.clientWidth, H = host.clientHeight;
      if (cv.width !== W * 2 || cv.height !== H * 2) { cv.width = W * 2; cv.height = H * 2; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var i, p2;
      // پوستهٔ نقطه‌ای، از دور به نزدیک
      var pts = cloud.map(function (c) { var q = project(c, W, H); q.push(c[3]); return q; }).sort(function (a, b) { return a[2] - b[2]; });
      for (i = 0; i < pts.length; i++) {
        p2 = pts[i];
        var dep = (p2[2] + 1.3) / 2.7;                       // ۰ دور، ۱ نزدیک
        var a = 0.10 + dep * 0.55;
        var kind = p2[4];
        ctx.fillStyle = kind === 1 ? 'rgba(150,196,236,' + (a * 0.9).toFixed(3) + ')'
                      : kind === 2 ? 'rgba(198,214,232,' + (a * 0.8).toFixed(3) + ')'
                      : 'rgba(' + Math.round(108 + dep * 60) + ',' + Math.round(156 + dep * 56) + ',' + Math.round(210 + dep * 40) + ',' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p2[0], p2[1], (0.7 + dep * 1.3) * p2[3], 0, 6.283); ctx.fill();
      }
      // گره‌ها
      var nodes = REGIONS.map(function (r, idx) { var q = project(r.p, W, H); q.push(idx); return q; });
      var sorted = nodes.slice().sort(function (a, b) { return a[2] - b[2]; });
      // اتصال‌ها (فقط حس شبکه؛ معنای علمی ندارند)
      ctx.lineWidth = 1;
      for (i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) {
        var d3 = Math.hypot(REGIONS[i].p[0] - REGIONS[j].p[0], REGIONS[i].p[1] - REGIONS[j].p[1], REGIONS[i].p[2] - REGIONS[j].p[2]);
        if (d3 > 1.1) continue;
        ctx.strokeStyle = 'rgba(96,142,196,.16)';
        ctx.beginPath(); ctx.moveTo(nodes[i][0], nodes[i][1]); ctx.lineTo(nodes[j][0], nodes[j][1]); ctx.stroke();
      }
      var vals = TWIN ? TWIN.vals : {};
      sorted.forEach(function (q) {
        var reg = REGIONS[q[4]], v = vals[reg.id];
        var col = v == null ? '#6b7280' : v >= 70 ? '#22c55e' : v >= 40 ? '#f6aa3c' : '#ef4444';
        var rad = (v == null ? 6 : 6 + v / 100 * 5) * q[3];
        if (q[4] === hover) rad *= 1.25;
        var g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rad * 2.6);
        g.addColorStop(0, col + 'cc'); g.addColorStop(1, col + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], rad * 2.6, 0, 6.283); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 6.283); ctx.fill();
        ctx.font = '11px Vazirmatn,sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + (q[2] + 1.2) / 2.6 * 0.5).toFixed(2) + ')';
        ctx.fillText(reg.icon || '', q[0], q[1] - rad - 5);
      });
      TWIN.proj = nodes;
    }
    function pick(ev) {
      var b = host.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top, best = -1, bd = 22;
      (TWIN.proj || []).forEach(function (q) { var d = Math.hypot(q[0] - mx, q[1] - my); if (d < bd) { bd = d; best = q[4]; } });
      return best;
    }
    host.addEventListener('pointerdown', function (ev) { drag = true; spin = false; px = ev.clientX; py = ev.clientY; try { host.setPointerCapture(ev.pointerId); } catch (e) {} });
    host.addEventListener('pointerup', function (ev) { drag = false; try { host.releasePointerCapture(ev.pointerId); } catch (e) {} });
    host.addEventListener('pointerleave', function () { drag = false; hover = -1; });
    host.addEventListener('pointermove', function (ev) {
      if (drag) { yaw += (ev.clientX - px) * 0.009; pitch = Math.max(-1.2, Math.min(1.2, pitch + (ev.clientY - py) * 0.007)); px = ev.clientX; py = ev.clientY; }
      else { var h = pick(ev); if (h !== hover) { hover = h; host.style.cursor = h >= 0 ? 'pointer' : 'grab'; } }
    });
    host.addEventListener('wheel', function (ev) { ev.preventDefault(); zoom = Math.max(0.6, Math.min(2.2, zoom - ev.deltaY * 0.0012)); }, { passive: false });
    host.addEventListener('click', function (ev) { var h = pick(ev); if (h >= 0) showRegion(REGIONS[h].id); });
    TWIN = { vals: {}, proj: [] };
    (function loop() { requestAnimationFrame(loop); if (spin && !drag) yaw += 0.0035; draw(); })();
    paintTwin(st);
  }
  function paintTwin(st) {
    if (!TWIN) return;
    TWIN.vals = valuesByDim(st);
    $('#psTwinInfo').innerHTML = '<p class="note">روی هر گره بزنید تا تحلیل آن بُعد را ببینید. با کشیدن بچرخانید و با اسکرول نزدیک شوید.</p>' +
      '<div class="ps-legend"><span><i class="bg-good"></i>پایدار</span><span><i class="bg-warn"></i>در حال توسعه</span>' +
      '<span><i class="bg-bad"></i>نیازمند توجه</span><span><i class="bg-na"></i>دادهٔ ناکافی</span></div>';
  }
  function valuesByDim(st) {
    var v = {};
    (C.dims || []).forEach(function (d) { v[d.id] = st.sv[d.id]; });
    if (st.m.discipline != null) v.discipline = st.m.discipline;
    if (st.m.decision != null) v.decision = st.m.decision;
    if (st.m.impulse != null) v.impulse = st.m.impulse;
    if (st.m.resilience != null) v.resilience = st.m.resilience;
    if (st.m.flexibility != null) v.flexibility = st.m.flexibility;
    return v;
  }
  function showRegion(id) {
    var st = state(), d = (C.dims || []).filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    var v = valuesByDim(st)[id];
    $('#psTwinInfo').innerHTML = '<p><b>' + d.icon + ' ' + esc(d.fa) + '</b> — ' +
      (v == null ? '<span class="na">دادهٔ ناکافی: پرسشنامهٔ این بُعد را کامل کنید یا معاملهٔ بیشتری ثبت کنید.</span>'
        : '<b class="' + cls(v) + '">' + r1(v) + ' از ۱۰۰</b>') + '</p>' +
      '<p class="note">برای دیدن تعریف، سنجش عملیاتی و تمرین این بُعد، به بخش «آموزش» بروید.</p>';
  }
  window.PSY_UI = { showRegion: showRegion };

  // ---------------------------------------------------------------- ژورنال رفتاری
  var JF = [
    ['t', 'تاریخ و ساعت', 'datetime-local'], ['sym', 'نماد', 'text'], ['side', 'جهت', 'sel:long=لانگ|short=شورت'],
    ['setup', 'ستاپ / دلیل ورود', 'text'], ['en', 'ورود', 'number'], ['ex', 'خروج', 'number'],
    ['sl0', 'حد ضرر اولیه', 'number'], ['sl', 'حد ضرر نهایی', 'number'], ['tgt', 'تارگت برنامه‌ریزی‌شده', 'number'],
    ['qty', 'حجم (واحد)', 'number'], ['risk', 'ریسک این معامله (٪)', 'number'],
    ['plan', 'مطابق پلن بود؟', 'sel:=نامشخص|1=بله|0=خیر'],
    ['chase', 'پس از حرکت بزرگ وارد شدم', 'sel:=خیر|1=بله'],
    ['emoPre', 'هیجان پیش از ورود (۰ تا ۱۰)', 'number'], ['emoPost', 'هیجان پس از خروج (۰ تا ۱۰)', 'number'],
    ['note', 'یادداشت', 'text']
  ];
  function field(f) {
    var k = f[0], lbl = f[1], ty = f[2];
    if (ty.indexOf('sel:') === 0) {
      var o = ty.slice(4).split('|').map(function (x) { var kv = x.split('='); return '<option value="' + kv[0] + '">' + esc(kv[1]) + '</option>'; }).join('');
      return '<label><span>' + esc(lbl) + '</span><select id="j_' + k + '">' + o + '</select></label>';
    }
    return '<label' + (k === 'note' ? ' class="wide"' : '') + '><span>' + esc(lbl) + '</span><input id="j_' + k + '" type="' + ty + '" step="any"></label>';
  }
  function renderJForm() { $('#psJForm').innerHTML = JF.map(field).join(''); }
  function readJ() {
    var t = {};
    JF.forEach(function (f) {
      var el = $('#j_' + f[0]); if (!el) return;
      var v = el.value;
      if (v === '') return;
      if (f[0] === 'plan') t.plan = v === '1';
      else if (f[0] === 'chase') t.chase = v === '1';
      else if (['en', 'ex', 'sl0', 'sl', 'tgt', 'qty', 'risk', 'emoPre', 'emoPost'].indexOf(f[0]) >= 0) t[f[0]] = parseFloat(v);
      else t[f[0]] = v;
    });
    if (t.t) t.t = new Date(t.t).toISOString();
    return t;
  }
  function renderJTbl() {
    var cols = ['t', 'sym', 'side', 'setup', 'en', 'ex', 'qty', 'risk', 'plan'];
    var head = '<tr>' + cols.map(function (c) { return '<th>' + esc((JF.filter(function (f) { return f[0] === c; })[0] || [, c])[1]) + '</th>'; }).join('') + '<th>سود/زیان</th><th>کیفیت</th><th></th></tr>';
    var rows = S.trades.slice().reverse().slice(0, 100).map(function (t, i) {
      var idx = S.trades.length - 1 - i;
      var dq = P.decisionOf(t, S.cfg.riskLimit), pl = P.pnlOf(t);
      return '<tr>' + cols.map(function (c) {
        var v = t[c];
        if (c === 't') v = (t.t || '').slice(0, 16).replace('T', ' ');
        if (c === 'plan') v = t.plan == null ? '—' : (t.plan ? 'بله' : 'خیر');
        return '<td>' + esc(v == null ? '—' : v) + '</td>';
      }).join('') +
        '<td class="' + (pl == null ? '' : pl >= 0 ? 'good' : 'bad') + '">' + (pl == null ? '—' : FA(pl.toFixed(2))) + '</td>' +
        '<td class="' + (dq ? cls(dq.score) : 'na') + '">' + (dq ? FA(dq.score) : '—') + '</td>' +
        '<td><button class="ps-del" data-i="' + idx + '" title="حذف">✕</button></td></tr>';
    }).join('');
    $('#psJTbl').innerHTML = head + rows;
  }
  // CSV: سرستون‌های رایج بایننس، OKX و متاتریدر ۵ شناسایی می‌شوند
  var MAP = {
    t: ['time', 'date', 'date(utc)', 'open time', 'opentime', 'create time', 'زمان'],
    sym: ['symbol', 'pair', 'instrument', 'market', 'نماد'],
    side: ['side', 'type', 'direction', 'جهت'],
    en: ['price', 'entry', 'entry price', 'open price', 'avg price', 'ورود'],
    ex: ['exit', 'exit price', 'close price', 'خروج'],
    qty: ['qty', 'quantity', 'amount', 'volume', 'size', 'executed', 'حجم'],
    pnl: ['pnl', 'realized pnl', 'profit', 'net pnl', 'سود']
  };
  function parseCsv(txt) {
    var lines = txt.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return [];
    var sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    var head = lines[0].split(sep).map(function (h) { return h.replace(/^"|"$/g, '').trim().toLowerCase(); });
    var idx = {};
    Object.keys(MAP).forEach(function (k) {
      head.forEach(function (h, i) { if (idx[k] == null && MAP[k].indexOf(h) >= 0) idx[k] = i; });
    });
    if (idx.en == null && idx.qty == null) return [];
    return lines.slice(1).map(function (l) {
      var c = l.split(sep).map(function (x) { return x.replace(/^"|"$/g, '').trim(); }), t = {};
      Object.keys(idx).forEach(function (k) {
        var v = c[idx[k]];
        if (v == null || v === '') return;
        if (['en', 'ex', 'qty', 'pnl'].indexOf(k) >= 0) { var n = parseFloat(v.replace(/[, ]/g, '')); if (isFinite(n)) t[k] = n; }
        else if (k === 'side') t.side = /sell|short|فروش/i.test(v) ? 'short' : 'long';
        else if (k === 't') { var d = new Date(v); if (isFinite(d)) t.t = d.toISOString(); }
        else t[k] = v;
      });
      t.imported = true;
      return t;
    }).filter(function (t) { return t.en != null || t.pnl != null; });
  }

  // ---------------------------------------------------------------- الگوها
  function renderPats(st) {
    (C.pats || []).forEach(function (p) {
      var card = $('.ps-pat[data-pat="' + p.id + '"]'); if (!card) return;
      var r = st.d[p.id], vd = $('.ps-verdict', card), ev = $('.ps-ev', card);
      if (!r || r.hit === null) {
        vd.textContent = 'دادهٔ ناکافی'; vd.className = 'ps-verdict na';
        ev.innerHTML = 'برای داوری دربارهٔ این الگو دست‌کم ' + FA(p.min) + ' نمونه لازم است؛ الان ' + FA((r && r.n) || 0) + ' نمونه دارید.';
        return;
      }
      vd.textContent = r.hit ? 'فرضیهٔ فعال' : 'نشانه‌ای دیده نشد';
      vd.className = 'ps-verdict ' + (r.hit ? 'bad' : 'good');
      ev.innerHTML = '<b>شواهد مشاهده‌شده:</b> ' + FA(r.hits) + ' مورد از ' + FA(r.n) + ' نمونه (' + FA(Math.round(r.rate)) + '٪)' +
        (r.evidence && r.evidence.length ? '<br><small>' + r.evidence.map(function (x) { return esc(String(x).slice(0, 16).replace('T', ' ')); }).join(' · ') + '</small>' : '') +
        (r.hit ? '<br><small class="note">این یک <b>فرضیهٔ رفتاری</b> است، نه تشخیص. ممکن است توضیح دیگری هم داشته باشد: تغییر شرایط بازار، تغییر استراتژی یا نمونهٔ کوچک.</small>' : '');
    });
  }

  // ---------------------------------------------------------------- کیفیت تصمیم
  function renderDQ(st) {
    var el = S.trades.filter(P.eligible);
    if (el.length < (C.min || {}).decision) {
      $('#psDQ').innerHTML = '<p class="note">برای این تحلیل دست‌کم ' + FA((C.min || {}).decision || 10) + ' معاملهٔ قابل ارزیابی لازم است. الان ' + FA(el.length) + ' تا دارید.</p>';
      return;
    }
    var pts = el.map(function (t) { return { d: P.decisionOf(t, S.cfg.riskLimit).score, p: P.pnlOf(t) || 0, t: t }; });
    var q = { gg: 0, gb: 0, bg: 0, bb: 0 };
    pts.forEach(function (x) { q[(x.d >= 60 ? 'g' : 'b') + (x.p >= 0 ? 'g' : 'b')]++; });
    $('#psDQ').innerHTML =
      '<div class="ps-kpis">' +
      '<div class="ps-kpi"><b class="good">' + FA(q.gg) + '</b><small>تصمیم خوب · نتیجهٔ مثبت</small></div>' +
      '<div class="ps-kpi"><b class="warn">' + FA(q.gb) + '</b><small>تصمیم خوب · نتیجهٔ منفی <br>(این‌ها اشتباه نیستند)</small></div>' +
      '<div class="ps-kpi"><b class="warn">' + FA(q.bg) + '</b><small>تصمیم بد · نتیجهٔ مثبت <br>(خطرناک‌ترین خانه)</small></div>' +
      '<div class="ps-kpi"><b class="bad">' + FA(q.bb) + '</b><small>تصمیم بد · نتیجهٔ منفی</small></div></div>' +
      '<p class="note">خانهٔ «تصمیم بد و نتیجهٔ مثبت» خطرناک‌ترین است: بازار به رفتار اشتباه پاداش داده و همین پاداش، تکرارش را محتمل می‌کند.</p>' +
      '<div class="ps-gap">' + pts.slice(-12).reverse().map(function (x) {
        return '<div><span>' + esc((x.t.t || '').slice(0, 16).replace('T', ' ')) + ' · ' + esc(x.t.sym || '—') +
          '</span><b class="' + cls(x.d) + '">کیفیت ' + FA(x.d) + '</b><b class="' + (x.p >= 0 ? 'good' : 'bad') + '">' + FA(x.p.toFixed(1)) + '</b></div>';
      }).join('') + '</div>';
  }

  // ---------------------------------------------------------------- نقشهٔ حرارتی و خط زمانی
  function renderHeat(st) {
    var el = S.trades.filter(function (t) { return P.eligible(t) && t.t && t.plan != null; });
    var need = (C.min || {}).heatmap || 20;
    if (el.length < need) { $('#psHeat').innerHTML = '<p class="note">برای نقشهٔ حرارتی دست‌کم ' + FA(need) + ' معاملهٔ دارای تاریخ و وضعیت پلن لازم است؛ الان ' + FA(el.length) + ' تا دارید.</p>'; return; }
    var days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    var cell = {};
    el.forEach(function (t) {
      var d = new Date(t.t), k = d.getDay() + '_' + Math.floor(d.getHours() / 3);
      cell[k] = cell[k] || { n: 0, v: 0 };
      cell[k].n++; if (t.plan === false) cell[k].v++;
    });
    var html = '<div class="ps-hm" style="grid-template-columns:72px repeat(8,1fr)"><div></div>';
    for (var b = 0; b < 8; b++) html += '<div style="color:var(--mute)">' + FA(b * 3) + '</div>';
    for (var dn = 0; dn < 7; dn++) {
      html += '<div style="color:var(--mute);justify-content:start">' + days[dn] + '</div>';
      for (var bb = 0; bb < 8; bb++) {
        var c = cell[dn + '_' + bb];
        if (!c || c.n < 2) { html += '<div style="background:rgba(127,127,127,.12)" title="نمونهٔ کافی نیست"></div>'; continue; }
        var rate = c.v / c.n * 100, col = rate >= 50 ? '#ef4444' : rate >= 25 ? '#f6aa3c' : '#22c55e';
        html += '<div style="background:' + col + '33;color:' + col + '" title="' + FA(c.v) + ' تخلف از ' + FA(c.n) + ' معامله">' + FA(Math.round(rate)) + '</div>';
      }
    }
    $('#psHeat').innerHTML = html + '</div><p class="note">عدد هر خانه نرخ تخلف از پلن به درصد است. خانهٔ خالی یعنی کمتر از دو معامله در آن بازه.</p>';
  }
  function renderTime() {
    var ev = [];
    S.trades.forEach(function (t) {
      if (!t.t) return;
      var pl = P.pnlOf(t);
      ev.push({ t: t.t, kind: 'trade', txt: (t.sym || 'معامله') + ' · ' + (t.setup || 'بدون ستاپ') +
        (pl == null ? '' : ' · ' + (pl >= 0 ? 'سود ' : 'ضرر ') + FA(Math.abs(pl).toFixed(1))),
        bad: t.plan === false });
    });
    (S.emo || []).forEach(function (x) { ev.push({ t: x.t, kind: 'emo', txt: 'هیجان ' + esc(x.tag) + ' · شدت ' + FA(x.lvl) }); });
    ev.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
    if (!ev.length) { $('#psTime').innerHTML = '<p class="note">هنوز رویدادی ثبت نشده است.</p>'; return; }
    $('#psTime').innerHTML = ev.slice(0, 60).map(function (x) {
      return '<div class="ps-ev-row"><time>' + esc(x.t.slice(0, 16).replace('T', ' ')) + '</time><span class="' +
        (x.bad ? 'bad' : '') + '">' + (x.kind === 'emo' ? '🌊 ' : x.bad ? '⚠️ ' : '•&nbsp;') + x.txt + '</span></div>';
    }).join('');
  }

  // ---------------------------------------------------------------- پروتکل روزانه
  var PRE = [
    ['anx', 'سطح اضطراب فعلی', ['۰ تا ۲', '۳ تا ۵', '۶ تا ۸', '۹ تا ۱۰']],
    ['rev', 'تمایل به جبران ضرر قبلی', ['هیچ', 'کم', 'متوسط', 'زیاد']],
    ['foc', 'تمرکز فعلی', ['بسیار کم', 'کم', 'متوسط', 'زیاد']],
    ['pln', 'برای هر معامله حد ضرر و ریسک مشخص دارم', ['خیر', 'بله']],
    ['must', 'احساس می‌کنم حتماً باید امروز معامله کنم', ['خیر', 'تا حدی', 'بله']],
    ['fomo', 'الان دنبال حرکتی هستم که جا مانده‌ام', ['خیر', 'تا حدی', 'بله']]
  ];
  var POST = [
    ['sat', 'از تصمیمم راضی‌ام، مستقل از نتیجه', ['خیر', 'تا حدی', 'بله']],
    ['rule', 'همهٔ قواعد را رعایت کردم', ['خیر', 'بیشترشان', 'بله']],
    ['emo', 'شدت هیجانم در اوج معامله', ['کم', 'متوسط', 'زیاد', 'خیلی زیاد']],
    ['trig', 'مهم‌ترین محرک امروز چه بود؟', null]
  ];
  function radioRow(pfx, f) {
    if (!f[2]) return '<label class="wide"><span>' + esc(f[1]) + '</span><input id="' + pfx + '_' + f[0] + '" type="text"></label>';
    return '<label class="wide"><span>' + esc(f[1]) + '</span><span class="ps-lk" data-g="' + pfx + '_' + f[0] + '">' +
      f[2].map(function (o, i) { return '<button type="button" data-v="' + i + '">' + esc(o) + '</button>'; }).join('') + '</span></label>';
  }
  function renderDaily() {
    $('#psPre').innerHTML = PRE.map(function (f) { return radioRow('pre', f); }).join('');
    $('#psPost').innerHTML = POST.map(function (f) { return radioRow('post', f); }).join('');
    $('#psMid').innerHTML = ['آیا الان می‌خواهم حد ضرر را جابه‌جا کنم؟', 'آیا می‌خواهم حجم را بالا ببرم؟',
      'آیا این ورود در پلن من هست؟', 'آیا دارم قیمت را تعقیب می‌کنم؟'].map(function (q) {
      return '<label class="ps-chk"><input type="checkbox"> ' + esc(q) + '</label>';
    }).join('<br>') + '<p class="note">هر تیک، یک هشدار به خودتان است. این فهرست ذخیره نمی‌شود؛ فقط برای همین لحظه است.</p>';
  }
  function groupVal(g) { var b = $('.ps-lk[data-g="' + g + '"] button.on'); return b ? parseInt(b.dataset.v, 10) : null; }
  function readiness() {
    var a = groupVal('pre_anx'), r = groupVal('pre_rev'), f = groupVal('pre_foc'),
        p = groupVal('pre_pln'), m = groupVal('pre_must'), fo = groupVal('pre_fomo');
    if ([a, r, f, p, m, fo].some(function (x) { return x == null; })) return null;
    var score = 100;
    score -= a * 12; score -= r * 14; score -= (3 - f) * 10; score -= p === 0 ? 25 : 0;
    score -= m * 9; score -= fo * 9;
    return Math.max(0, Math.min(100, score));
  }

  // ---------------------------------------------------------------- پیشرفت و گزارش
  function snapshot(st) {
    var w = new Date(); w.setHours(0, 0, 0, 0);
    var key = w.getFullYear() + '-W' + Math.ceil(((w - new Date(w.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
    var last = S.snaps[S.snaps.length - 1];
    var row = { k: key, t: new Date().toISOString(), tps: st.t.score, dis: st.m.discipline, dec: st.m.decision, imp: st.m.impulse };
    if (last && last.k === key) S.snaps[S.snaps.length - 1] = row; else S.snaps.push(row);
    if (S.snaps.length > 60) S.snaps = S.snaps.slice(-60);
    save();
  }
  function renderProg() {
    var pts = S.snaps.filter(function (x) { return x.tps != null; });
    if (pts.length < 2) { $('#psProg').innerHTML = '<p class="note">برای نمایش روند، دست‌کم دو اسنپ‌شات هفتگی لازم است. هر بار که آزمون یا ژورنال را به‌روز کنید یکی ساخته می‌شود؛ الان ' + FA(pts.length) + ' تا دارید.</p>'; return; }
    var w = 560, h = 120, mn = 0, mx = 100;
    var x = function (i) { return 10 + i / (pts.length - 1) * (w - 20); };
    var y = function (v) { return h - 10 - (v - mn) / (mx - mn) * (h - 24); };
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.tps).toFixed(1); }).join(' ');
    $('#psProg').innerHTML = '<svg class="ps-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<path d="' + line + '" fill="none" stroke="#f7931a" stroke-width="2"/>' +
      pts.map(function (p, i) { return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.tps).toFixed(1) + '" r="3" fill="#f7931a"><title>' + esc(p.k) + ': ' + r1(p.tps) + '</title></circle>'; }).join('') +
      '</svg><p class="note">از ' + FA(r1(pts[0].tps)) + ' به ' + FA(r1(pts[pts.length - 1].tps)) + ' روی ' + FA(pts.length) + ' اسنپ‌شات.</p>';
  }
  function renderRep(st) {
    var b = P.band(st.t.score);
    var lines = ['<h4>گزارش رفتاری — ' + esc(new Date().toLocaleDateString('fa-IR')) + '</h4>',
      '<p><b>امتیاز کل:</b> ' + (st.t.score == null ? 'دادهٔ ناکافی' : r1(st.t.score) + ' از ۱۰۰ · ' + esc(b.fa)) +
      ' <small class="note">(روی ' + FA(Math.round(st.t.coverage)) + '٪ از وزن کل)</small></p>',
      '<p><b>نمونه:</b> ' + FA(st.m.nEligible) + ' معاملهٔ قابل ارزیابی از ' + FA(st.m.n) + ' معاملهٔ ثبت‌شده.</p>'];
    var rows = [['انضباط معاملاتی', st.m.discipline], ['نرخ تخلف', st.m.violation], ['کیفیت تصمیم', st.m.decision],
      ['کنترل تکانه', st.m.impulse], ['رعایت سقف ریسک', st.m.risk], ['پایداری', st.m.resilience], ['انعطاف', st.m.flexibility]];
    lines.push('<div class="ps-gap">' + rows.map(function (r) {
      return '<div><span>' + esc(r[0]) + '</span><b class="' + cls(r[1]) + '">' + (r[1] == null ? 'دادهٔ ناکافی' : r1(r[1])) + '</b><small></small></div>';
    }).join('') + '</div>');
    var act = (C.pats || []).filter(function (p) { return st.d[p.id] && st.d[p.id].hit === true; });
    lines.push('<h4>الگوهای فعال</h4>' + (act.length ? '<ul>' + act.map(function (p) {
      return '<li>' + p.icon + ' ' + esc(p.fa) + ' — ' + FA(Math.round(st.d[p.id].rate)) + '٪ از ' + FA(st.d[p.id].n) + ' نمونه</li>';
    }).join('') + '</ul>' : '<p class="note">هیچ الگویی با دادهٔ کافی تأیید نشده است.</p>'));
    lines.push('<p class="note">این گزارش ابزار خودارزیابی است، نه سند بالینی. اگر می‌خواهید آن را به مربی یا روان‌شناس نشان دهید، همین توضیح را هم همراهش ببرید.</p>');
    $('#psRep').innerHTML = lines.join('');
  }

  // ---------------------------------------------------------------- تنظیمات و داده
  function renderSet() {
    $('#psSet').innerHTML =
      '<label><span>سقف ریسک هر معامله (٪)</span><input id="s_riskLimit" type="number" step="0.1" value="' + S.cfg.riskLimit + '"></label>' +
      '<label><span>سقف تعداد معاملهٔ روزانه</span><input id="s_dailyCap" type="number" step="1" value="' + S.cfg.dailyCap + '"></label>' +
      '<label><span>سرمایهٔ مرجع (برای محاسبهٔ درصد)</span><input id="s_acct" type="number" step="10" value="' + S.cfg.acct + '"></label>';
  }
  function dl(name, text, type) {
    var b = new Blob([text], { type: (type || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ---------------------------------------------------------------- رندر کلی
  function renderAll() {
    var st = state();
    renderOver(st); renderPats(st); renderJTbl(); renderDQ(st); renderHeat(st); renderTime(); renderProg(); renderRep(st);
    $$('.ps-badge').forEach(function (b) {
      var v = st.sv[b.dataset.score];
      b.textContent = v == null ? '—' : FA(Math.round(v)); b.className = 'ps-badge ' + cls(v);
    });
    if ($('.ps-pane[data-p="twin"]').classList.contains('on')) buildTwin(st);
    return st;
  }

  // ---------------------------------------------------------------- رویدادها
  root.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    if (b.classList.contains('ps-tab')) {
      $$('.ps-tab').forEach(function (x) { x.classList.toggle('on', x === b); });
      $$('.ps-pane').forEach(function (x) { x.classList.toggle('on', x.dataset.p === b.dataset.p); });
      if (b.dataset.p === 'twin') buildTwin(state());
      return;
    }
    var lk = b.closest('.ps-lk');
    if (lk) {
      $$('button', lk).forEach(function (x) { x.classList.toggle('on', x === b); });
      var q = b.closest('.ps-q');
      if (q) {
        S.survey[q.dataset.dim] = S.survey[q.dataset.dim] || {};
        S.survey[q.dataset.dim][q.dataset.i] = parseInt(b.dataset.v, 10);
      }
      return;
    }
    if (b.classList.contains('ps-del')) {
      S.trades.splice(parseInt(b.dataset.i, 10), 1); save(); renderAll(); return;
    }
    if (b.classList.contains('ps-run')) {
      b.textContent = '✓ ثبت شد — فردا دوباره'; b.disabled = true; return;
    }
    switch (b.id) {
      case 'psSave':
        save(); var st = renderAll(); snapshot(st);
        $('#psTestMsg').textContent = 'ثبت شد. ' + FA(Object.keys(S.survey).length) + ' بُعد پاسخ دارد.';
        break;
      case 'psClearTest': S.survey = {}; save(); $$('.ps-lk button.on').forEach(function (x) { x.classList.remove('on'); }); renderAll(); break;
      case 'psJAdd':
        var t = readJ();
        if (t.en == null && t.pnl == null) { $('#psJMsg').textContent = 'دست‌کم قیمت ورود لازم است.'; break; }
        if (!t.t) t.t = new Date().toISOString();
        S.trades.push(t); save(); var s2 = renderAll(); snapshot(s2);
        $('#psJMsg').textContent = 'افزوده شد — ' + FA(S.trades.length) + ' معامله.';
        break;
      case 'psJCsv':
        var cols = ['t', 'sym', 'side', 'setup', 'en', 'ex', 'sl0', 'sl', 'tgt', 'qty', 'risk', 'plan', 'emoPre', 'emoPost', 'note'];
        dl('entekhab-journal.csv', cols.join(',') + '\n' + S.trades.map(function (x) {
          return cols.map(function (c) { return '"' + String(x[c] == null ? '' : x[c]).replace(/"/g, '""') + '"'; }).join(',');
        }).join('\n'), 'text/csv');
        break;
      case 'psPreGo':
        var rd = readiness();
        $('#psPreOut').innerHTML = rd == null ? '<p class="note">همهٔ شش پرسش را پاسخ دهید.</p>' :
          '<div class="ps-kpis">' + kpi('آمادگی روانی امروز', rd) + '</div>' +
          '<p class="note">' + (rd >= 70 ? 'وضعیت مناسب است. طبق پلن پیش بروید.' :
            rd >= 40 ? 'با احتیاط: حجم را کم کنید و فقط ستاپ اصلی را بگیرید.' :
            'امروز شرایط روانی برای معامله مناسب نیست. معامله‌نکردن هم یک تصمیم معتبر است.') + '</p>';
        S.pre.push({ t: new Date().toISOString(), score: rd }); save();
        break;
      case 'psPostGo':
        S.post.push({ t: new Date().toISOString(), sat: groupVal('post_sat'), rule: groupVal('post_rule'),
                      emo: groupVal('post_emo'), trig: ($('#post_trig') || {}).value || '' });
        save(); $('#psPostOut').innerHTML = '<p class="note">مرور ثبت شد. در بخش خط زمانی دیده می‌شود.</p>';
        break;
      case 'psRepGo': renderRep(state()); break;
      case 'psPrint': window.print(); break;
      case 'psSetSave':
        S.cfg.riskLimit = parseFloat($('#s_riskLimit').value) || 1;
        S.cfg.dailyCap = parseInt($('#s_dailyCap').value, 10) || 5;
        S.cfg.acct = parseFloat($('#s_acct').value) || 1000;
        save(); renderAll(); $('#psDataMsg').textContent = 'تنظیمات ذخیره شد.';
        break;
      case 'psExport': dl('entekhab-psychology-backup.json', JSON.stringify(S, null, 2), 'application/json'); break;
      case 'psBot':
        var code = btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, n: S.trades.length, tps: state().t.score })))).slice(0, 180);
        $('#psDataMsg').innerHTML = 'این کد را در ربات تلگرام با دستور <code class="inl">/psy ' + esc(code) + '</code> بفرستید تا خلاصهٔ پیشرفت‌تان آنجا هم دیده شود. کد فقط شمار معامله و امتیاز کل را دارد، نه جزئیات معامله‌ها.';
        break;
      case 'psWipe':
        if (!confirm('همهٔ دادهٔ روان‌شناسی شما از این مرورگر پاک می‌شود. نسخهٔ دیگری از آن نداریم. مطمئن هستید؟')) break;
        S = { trades: [], survey: {}, emo: [], snaps: [], cfg: S.cfg, pre: [], post: [] };
        save(); renderAll(); $('#psDataMsg').textContent = 'همهٔ داده پاک شد.';
        break;
    }
  });
  root.addEventListener('change', function (ev) {
    if (ev.target.id === 'psCsv' && ev.target.files && ev.target.files[0]) {
      var fr = new FileReader();
      fr.onload = function () {
        var rows = parseCsv(String(fr.result));
        if (!rows.length) { $('#psJMsg').textContent = 'ستون‌های این فایل شناخته نشد. سرستون‌های زمان، نماد، جهت، قیمت و حجم لازم‌اند.'; return; }
        S.trades = S.trades.concat(rows); save(); renderAll();
        $('#psJMsg').textContent = FA(rows.length) + ' معامله وارد شد. فیلدهای پلن و ریسک را دستی کامل کنید تا وارد شاخص‌ها شوند.';
      };
      fr.readAsText(ev.target.files[0]);
    }
    if (ev.target.id === 'psImport' && ev.target.files && ev.target.files[0]) {
      var f2 = new FileReader();
      f2.onload = function () {
        try { S = Object.assign(S, JSON.parse(String(f2.result))); save(); renderAll(); $('#psDataMsg').textContent = 'بازگردانی شد.'; }
        catch (e) { $('#psDataMsg').textContent = 'فایل خوانده نشد.'; }
      };
      f2.readAsText(ev.target.files[0]);
    }
  });

  // ---------------------------------------------------------------- شروع
  load();
  renderJForm(); renderDaily(); renderSet();
  $('#psEmoForm').innerHTML =
    '<label><span>چه حسی دارید؟</span><select id="e_tag"><option>آرام</option><option>اضطراب</option><option>خشم</option><option>هیجان‌زدگی</option><option>ناامیدی</option><option>بی‌قراری</option></select></label>' +
    '<label><span>شدت (۰ تا ۱۰)</span><input id="e_lvl" type="number" min="0" max="10" value="5"></label>' +
    '<label class="wide"><span>چه چیزی باعثش شد؟</span><input id="e_why" type="text"></label>';
  $('#psEmoForm').insertAdjacentHTML('afterend', '<div class="ps-bar"><button class="ac-btn" id="psEmoAdd">ثبت</button></div>');
  document.addEventListener('click', function (ev) {
    if (ev.target.id !== 'psEmoAdd') return;
    S.emo.push({ t: new Date().toISOString(), tag: $('#e_tag').value, lvl: parseInt($('#e_lvl').value, 10) || 0, why: $('#e_why').value });
    save();
    $('#psEmoList').innerHTML = S.emo.slice(-20).reverse().map(function (x) {
      return '<div class="ps-ev-row"><time>' + esc(x.t.slice(0, 16).replace('T', ' ')) + '</time><span>' + esc(x.tag) + ' · ' + FA(x.lvl) + (x.why ? ' · ' + esc(x.why) : '') + '</span></div>';
    }).join('');
    renderTime();
  });
  // بازگرداندن پاسخ‌های ذخیره‌شدهٔ پرسشنامه روی دکمه‌ها
  Object.keys(S.survey || {}).forEach(function (dim) {
    Object.keys(S.survey[dim]).forEach(function (i) {
      var q = $('.ps-q[data-dim="' + dim + '"][data-i="' + i + '"]');
      if (q) { var b = $('button[data-v="' + S.survey[dim][i] + '"]', q); if (b) b.classList.add('on'); }
    });
  });
  renderAll();
})();
