/* سامانهٔ هوش روان‌شناسی معامله‌گر — موتور محاسبه (entekhab.net/academy/psychology/)
   این فایل هیچ کاری با DOM ندارد تا بتوان همان‌جا در Node آزمونش کرد.
   سه قاعده‌ای که در کل فایل رعایت شده:
     ۱) کیفیت تصمیم هرگز از سود و زیان محاسبه نمی‌شود.
     ۲) زیر حداقل نمونه، خروجی null است یعنی «دادهٔ ناکافی» — نه صفر و نه نمرهٔ ساختگی.
     ۳) هر خروجی شواهدش را همراه خودش می‌آورد تا کاربر ببیند عدد از کجا آمده. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PSY = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN = { discipline: 10, risk: 10, impulse: 12, decision: 10, afterwin: 6, afterloss: 6,
              pattern: 8, heatmap: 20, trend: 20 };
  var W = { discipline: 20, emotion: 15, decision: 15, impulse: 15, risk: 15, resilience: 10, flexibility: 10 };

  // ---------------------------------------------------------------- کمکی‌ها
  function num(v) { var x = parseFloat(v); return isFinite(x) ? x : null; }
  function med(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function pct(part, whole) { return whole > 0 ? part / whole * 100 : null; }
  function ts(t) { var d = new Date(t); return isFinite(d) ? d.getTime() : null; }

  /* یک معامله وقتی «قابل ارزیابی» است که بشود دربارهٔ فرایندش قضاوت کرد.
     معامله‌ای که اطلاعاتش ناقص است، نه درست حساب می‌شود و نه غلط — کنار گذاشته می‌شود. */
  function eligible(t) {
    return t && t.en != null && t.qty != null && (t.setup !== undefined || t.plan !== undefined);
  }
  function pnlOf(t) {
    if (t.pnl != null) return num(t.pnl);
    if (t.en == null || t.ex == null || t.qty == null) return null;
    var d = t.side === 'short' ? -1 : 1;
    return (num(t.ex) - num(t.en)) * num(t.qty) * d;
  }
  function riskPct(t) { return t.riskActual != null ? num(t.riskActual) : num(t.risk); }

  // ---------------------------------------------------------------- کیفیت تصمیم
  /* پنج مؤلفه، هیچ‌کدام از جنس سود و زیان. جمعشان صد است.
     معاملهٔ سودده‌ای که خلاف پلن بوده نمرهٔ بالا نمی‌گیرد و معاملهٔ زیان‌دهٔ طبق پلن نمرهٔ پایین نمی‌گیرد. */
  function decisionOf(t, limit) {
    if (!eligible(t)) return null;
    var s = 0, why = [];
    if (t.setup) { s += 25; why.push(['ستاپ ثبت‌شده', 25]); } else why.push(['ستاپ ثبت نشده', 0]);
    var r = riskPct(t);
    if (r != null && limit != null && r <= limit + 1e-9) { s += 25; why.push(['ریسک داخل سقف', 25]); }
    else why.push([r == null ? 'ریسک نامشخص' : 'ریسک بیرون از سقف', 0]);
    if (t.sl0 != null) { s += 20; why.push(['حد ضرر پیش از ورود', 20]); } else why.push(['حد ضرر اولیه نداشت', 0]);
    if (t.sl0 != null && t.sl != null) {
      var away = t.side === 'short' ? num(t.sl) > num(t.sl0) + 1e-9 : num(t.sl) < num(t.sl0) - 1e-9;
      if (!away) { s += 15; why.push(['حد ضرر خلاف جهت جابه‌جا نشد', 15]); } else why.push(['حد ضرر عقب برده شد', 0]);
    } else if (t.sl0 != null) { s += 15; why.push(['حد ضرر دست‌نخورده', 15]); } else why.push(['قابل بررسی نبود', 0]);
    if (t.plan === true) { s += 15; why.push(['خروج طبق پلن', 15]); }
    else if (t.plan === false) why.push(['خروج خارج از پلن', 0]);
    else why.push(['تطابق خروج ثبت نشده', 0]);
    return { score: s, why: why };
  }

  // ---------------------------------------------------------------- شاخص‌های اصلی
  function metrics(trades, cfg) {
    cfg = cfg || {};
    var limit = cfg.riskLimit != null ? num(cfg.riskLimit) : 1;      // درصد مجاز ریسک هر معامله
    var cap = cfg.dailyCap != null ? parseInt(cfg.dailyCap, 10) : 5; // سقف تعداد معاملهٔ روزانه
    var all = (trades || []).slice().sort(function (a, b) { return (ts(a.t) || 0) - (ts(b.t) || 0); });
    var el = all.filter(eligible);
    var out = { n: all.length, nEligible: el.length, min: MIN };

    out.discipline = el.length >= MIN.discipline
      ? pct(el.filter(function (t) { return t.plan === true; }).length, el.filter(function (t) { return t.plan != null; }).length) : null;
    out.violation = out.discipline == null ? null : 100 - out.discipline;

    var withRisk = el.filter(function (t) { return riskPct(t) != null; });
    out.risk = withRisk.length >= MIN.risk
      ? pct(withRisk.filter(function (t) { return riskPct(t) <= limit + 1e-9; }).length, withRisk.length) : null;

    var dq = el.map(function (t) { return decisionOf(t, limit); }).filter(Boolean);
    out.decision = dq.length >= MIN.decision ? mean(dq.map(function (x) { return x.score; })) : null;

    var sizes = el.map(function (t) { return Math.abs(num(t.qty) * num(t.en)); }).filter(function (x) { return x; });
    var mSize = med(sizes);
    var impulsive = 0;
    for (var i = 0; i < el.length; i++) {
      var t = el[i], prev = el[i - 1], bad = false;
      if (!t.setup) bad = true;
      if (prev && (pnlOf(prev) || 0) < 0 && ts(t.t) && ts(prev.t) && (ts(t.t) - ts(prev.t)) < 10 * 60000) bad = true;
      var sz = Math.abs(num(t.qty) * num(t.en));
      if (mSize && sz > mSize * 2) bad = true;
      if (bad) impulsive++;
    }
    out.impulse = el.length >= MIN.impulse ? 100 - pct(impulsive, el.length) : null;
    out.impulsiveCount = impulsive;

    // رفتار پس از برد و پس از باخت: نسبت حجم به میانگین شخصی خود کاربر
    function afterRatio(win) {
      var r = [];
      for (var i = 1; i < el.length; i++) {
        var p = pnlOf(el[i - 1]);
        if (p == null) continue;
        if ((win && p > 0) || (!win && p < 0)) {
          var sz = Math.abs(num(el[i].qty) * num(el[i].en));
          if (mSize && sz) r.push(sz / mSize);
        }
      }
      return r.length >= (win ? MIN.afterwin : MIN.afterloss) ? { ratio: med(r), n: r.length } : { ratio: null, n: r.length };
    }
    out.afterWin = afterRatio(true);
    out.afterLoss = afterRatio(false);

    // پایداری: چند معامله طول می‌کشد تا پایبندی به میانگین خودش برگردد، پس از بزرگ‌ترین ضرر
    out.resilience = null;
    if (el.length >= MIN.trend) {
      var worst = -1, wp = 0;
      el.forEach(function (t, i) { var p = pnlOf(t); if (p != null && p < wp) { wp = p; worst = i; } });
      if (worst >= 0 && worst < el.length - 3) {
        var after = el.slice(worst + 1), base = out.discipline;
        var run = 0, found = null;
        for (var k = 0; k < after.length; k++) {
          run += after[k].plan === true ? 1 : 0;
          var rate = (k + 1) > 0 ? run / (k + 1) * 100 : 0;
          if (k >= 2 && base != null && rate >= base) { found = k + 1; break; }
        }
        out.resilience = found == null ? 0 : Math.max(0, 100 - (found - 1) * 10);
        out.resilienceTrades = found;
      }
    }

    // انعطاف شناختی: آیا نرخ تخلف در نیمهٔ دوم کمتر از نیمهٔ اول است
    out.flexibility = null;
    if (el.length >= MIN.trend) {
      var h = Math.floor(el.length / 2);
      function vr(a) { var e = a.filter(function (t) { return t.plan != null; }); return e.length ? e.filter(function (t) { return t.plan === false; }).length / e.length : null; }
      var a1 = vr(el.slice(0, h)), a2 = vr(el.slice(h));
      if (a1 != null && a2 != null) out.flexibility = Math.max(0, Math.min(100, 50 + (a1 - a2) * 100));
    }

    out.overCap = null;
    if (all.length >= MIN.trend) {
      var days = {};
      all.forEach(function (t) { var d = (t.t || '').slice(0, 10); if (d) days[d] = (days[d] || 0) + 1; });
      var ks = Object.keys(days);
      out.overCap = { days: ks.length, over: ks.filter(function (d) { return days[d] > cap; }).length, cap: cap };
    }
    out.medianSize = mSize;
    out.riskLimit = limit;
    return out;
  }

  // ---------------------------------------------------------------- امتیاز کل
  /* اگر هیچ مؤلفه‌ای داده نداشته باشد، امتیاز کل هم null است. وزن مؤلفه‌های بی‌داده
     بازتوزیع می‌شود و «پوشش» گزارش می‌شود تا کاربر بداند عدد روی چند درصد وزن ساخته شده. */
  function tps(m, survey, weights) {
    var w = weights || W;
    var parts = {
      discipline: m.discipline, decision: m.decision, impulse: m.impulse, risk: m.risk,
      resilience: m.resilience, flexibility: m.flexibility,
      emotion: survey && survey.emotion != null ? survey.emotion : null
    };
    var sum = 0, wsum = 0, used = {};
    Object.keys(w).forEach(function (k) {
      if (parts[k] != null) { sum += parts[k] * w[k]; wsum += w[k]; used[k] = parts[k]; }
    });
    if (!wsum) return { score: null, coverage: 0, parts: parts, used: used };
    return { score: sum / wsum, coverage: wsum / Object.keys(w).reduce(function (a, k) { return a + w[k]; }, 0) * 100,
             parts: parts, used: used };
  }

  function band(score) {
    if (score == null) return { id: 'na', fa: 'دادهٔ ناکافی' };
    if (score < 40) return { id: 'low', fa: 'نیازمند توجه جدی' };
    if (score < 60) return { id: 'dev', fa: 'نیازمند توسعه' };
    if (score < 80) return { id: 'ok', fa: 'در حال تثبیت' };
    return { id: 'good', fa: 'عملکرد رفتاری پایدار' };
  }


  // ---------------------------------------------------------------- آشکارسازهای ۱۲ الگو
  /* هر آشکارساز یک «قاعدهٔ قطعی» روی دادهٔ معاملات است، نه حدس مدل زبانی.
     خروجی: {n, hit, rate, evidence}. n کمتر از حداقل -> hit=null یعنی دادهٔ ناکافی. */
  function detectors(trades, cfg) {
    cfg = cfg || {};
    var limit = cfg.riskLimit != null ? num(cfg.riskLimit) : 1;
    var cap = cfg.dailyCap != null ? parseInt(cfg.dailyCap, 10) : 5;
    var el = (trades || []).filter(eligible)
      .sort(function (a, b) { return (ts(a.t) || 0) - (ts(b.t) || 0); });
    var sizes = el.map(function (t) { return Math.abs(num(t.qty) * num(t.en)); });
    var mSize = med(sizes.filter(function (x) { return x; }));
    var R = {};

    function out(id, n, hits, minN, ev) {
      var mn = minN || MIN.pattern;
      R[id] = { n: n, hits: hits, rate: n ? hits / n * 100 : null,
                hit: n < mn ? null : hits / n * 100 >= 30, evidence: ev || [], min: mn };
    }
    // سهمی از زنجیره که شرط را دارد
    function afterStreak(isWin, streak, test, id, minN) {
      var n = 0, h = 0, ev = [];
      for (var i = streak; i < el.length; i++) {
        var okRun = true;
        for (var k = 1; k <= streak; k++) {
          var p = pnlOf(el[i - k]);
          if (p == null || (isWin ? p <= 0 : p >= 0)) { okRun = false; break; }
        }
        if (!okRun) continue;
        n++;
        if (test(el[i], el[i - 1])) { h++; if (ev.length < 5) ev.push(el[i].t || ('#' + i)); }
      }
      out(id, n, h, minN, ev);
    }
    var bigger = function (t) { var sz = Math.abs(num(t.qty) * num(t.en)); return mSize && sz > mSize * 1.3; };

    afterStreak(false, 1, bigger, 'revenge');                 // بزرگ‌کردن حجم پس از ضرر
    afterStreak(true, 1, bigger, 'greedy');                   // بزرگ‌کردن حجم پس از برد
    afterStreak(false, 3, bigger, 'gambler', MIN.pattern);    // بزرگ‌کردن حجم پس از زنجیرهٔ ضرر
    afterStreak(true, 2, bigger, 'overconf', MIN.pattern);    // رشد ریسک پس از دو برد

    // ورود بدون ستاپ، پس از حرکت بزرگ: نشانهٔ تعقیب قیمت
    var n = 0, h = 0, ev = [];
    el.forEach(function (t) { n++; if (!t.setup && t.chase === true) { h++; if (ev.length < 5) ev.push(t.t); } });
    out('fomo', n, h, MIN.pattern, ev);

    // جابه‌جایی حد ضرر خلاف جهت
    n = 0; h = 0; ev = [];
    el.forEach(function (t) {
      if (t.sl0 == null || t.sl == null) return;
      n++;
      var away = t.side === 'short' ? num(t.sl) > num(t.sl0) + 1e-9 : num(t.sl) < num(t.sl0) - 1e-9;
      if (away) { h++; if (ev.length < 5) ev.push(t.t); }
    });
    out('lossav', n, h, MIN.pattern, ev);

    // خروج پیش از تارگت برنامه‌ریزی‌شده
    n = 0; h = 0; ev = [];
    el.forEach(function (t) {
      if (t.tgt == null || t.ex == null || t.en == null) return;
      n++;
      var want = Math.abs(num(t.tgt) - num(t.en)), got = Math.abs(num(t.ex) - num(t.en));
      var profit = (pnlOf(t) || 0) > 0;
      if (profit && want > 0 && got < want * 0.5) { h++; if (ev.length < 5) ev.push(t.t); }
    });
    out('early', n, h, MIN.pattern, ev);

    // سیگنال اجرانشده یا حجم بسیار کمتر از معمول
    n = 0; h = 0; ev = [];
    (trades || []).forEach(function (t) {
      if (t.skipped === true) { n++; h++; if (ev.length < 5) ev.push(t.t); return; }
      if (!eligible(t)) return;
      n++;
      var sz = Math.abs(num(t.qty) * num(t.en));
      if (mSize && sz && sz < mSize * 0.5) { h++; if (ev.length < 5) ev.push(t.t); }
    });
    out('hesitate', n, h, MIN.pattern, ev);

    // یک‌طرفه بودن افراطی: نشانهٔ احتمالی تأییدطلبی
    var longs = el.filter(function (t) { return t.side !== 'short'; }).length;
    out('confirm', el.length, el.length ? Math.round(Math.abs(longs / el.length - 0.5) * 2 * el.length) : 0, 10,
        el.length ? ['لانگ ' + longs + ' از ' + el.length] : []);

    // حجم معاملهٔ بعدی، نتیجهٔ معاملهٔ قبلی را دنبال می‌کند
    n = 0; h = 0; ev = [];
    for (var i = 1; i < el.length; i++) {
      var prev = pnlOf(el[i - 1]);
      if (prev == null || !mSize) continue;
      n++;
      var sz = Math.abs(num(el[i].qty) * num(el[i].en));
      if ((prev > 0 && sz > mSize * 1.3) || (prev < 0 && sz < mSize * 0.7)) { h++; if (ev.length < 5) ev.push(el[i].t); }
    }
    out('recency', n, h, 12, ev);

    // بیش‌معامله‌گری: روزهایی که از سقف نوشته‌شدهٔ خود کاربر رد شده‌اند
    var days = {};
    el.forEach(function (t) { var d = (t.t || '').slice(0, 10); if (d) days[d] = (days[d] || 0) + 1; });
    var ks = Object.keys(days), over = ks.filter(function (d) { return days[d] > cap; });
    out('overtrade', ks.length, over.length, 10, over.slice(0, 5));

    // انحراف از پلن
    var jud = el.filter(function (t) { return t.plan != null; });
    out('deviate', jud.length, jud.filter(function (t) { return t.plan === false; }).length, 10,
        jud.filter(function (t) { return t.plan === false; }).slice(0, 5).map(function (t) { return t.t; }));

    // رشد بی‌سروصدای ریسک: نیمهٔ دوم در برابر نیمهٔ اول
    if (el.length >= 10) {
      var hf = Math.floor(el.length / 2);
      var r1 = mean(el.slice(0, hf).map(riskPct).filter(function (x) { return x != null; }));
      var r2 = mean(el.slice(hf).map(riskPct).filter(function (x) { return x != null; }));
      if (r1 != null && r2 != null) {
        R.riskDrift = { n: el.length, from: r1, to: r2, hit: r2 > r1 * 1.25, min: 10,
                        evidence: ['میانگین ریسک نیمهٔ اول ' + r1.toFixed(2) + '٪ و نیمهٔ دوم ' + r2.toFixed(2) + '٪'] };
      }
    }
    return R;
  }

  return { MIN: MIN, W: W, med: med, mean: mean, pnlOf: pnlOf, eligible: eligible,
           decisionOf: decisionOf, metrics: metrics, detectors: detectors, tps: tps, band: band };
}));
