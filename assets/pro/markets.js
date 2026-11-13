/* entekhab.net — /market/: markets beyond Binance's USDT pairs.
     IR_<KEY>    Iran's free market in toman: currencies, gold, coins, silver and tether. From tgju.org: the history
                 through its public TradingView datafeed, the latest price from its public tables. tgju sends rial;
                 everything is shown in toman (÷ 10). The world ounce of gold and of silver stay in dollars.
     <COIN>_IRT  any Binance coin in toman, computed: the Binance candle × tether's toman rate. The rate is tgju's
                 daily close for tether, drawn as a straight line between closes, and its live price today. Labelled
                 "computed" wherever it is shown; nothing is invented when a source fails.
   Symbols without the suffix or prefix (BTC, ETH …) are Binance USDT pairs, as before. */
(function () {
  'use strict';
  var P = window.PRO; if (!P || !P.feed) return;
  var TGH = 'https://dashboard-api.tgju.org/v1/tv2/history?symbol=', TGT = 'https://api.tgju.org/v1/market/indicator/today-table-data/',
    TGA = ['https://call4.tgju.org/ajax.json', 'https://call3.tgju.org/ajax.json', 'https://call2.tgju.org/ajax.json'];
  var TEH = 12600;                                                     /* Tehran = UTC+3:30 (no daylight saving since 2022) */

  /* ---------------------------------------------------------------- the Iranian market: key, tgju grade, group, icon, ÷, daily only, names */
  function N(fa, ckb, ar, en) { return { fa: fa, ckb: ckb, ar: ar, en: en }; }
  var CAT = [
    ['USD', 'price_dollar_rl', 'fx', 'f:us', 10, 0, N('دلار آمریکا', 'دۆلاری ئەمریکا', 'الدولار الأمريكي', 'US dollar')],
    ['EUR', 'price_eur', 'fx', 'f:eu', 10, 0, N('یورو', 'یۆرۆ', 'اليورو', 'Euro')],
    ['GBP', 'price_gbp', 'fx', 'f:gb', 10, 0, N('پوند انگلیس', 'پاوەندی بەریتانی', 'الجنيه الإسترليني', 'British pound')],
    ['AED', 'price_aed', 'fx', 'f:ae', 10, 0, N('درهم امارات', 'دیرهەمی ئیمارات', 'الدرهم الإماراتي', 'UAE dirham')],
    ['TRY', 'price_try', 'fx', 'f:tr', 10, 0, N('لیر ترکیه', 'لیرەی تورکیا', 'الليرة التركية', 'Turkish lira')],
    ['IQD', 'price_iqd', 'fx', 'f:iq', 10, 0, N('دینار عراق', 'دیناری عێراق', 'الدينار العراقي', 'Iraqi dinar')],
    ['CHF', 'price_chf', 'fx', 'f:ch', 10, 0, N('فرانک سوئیس', 'فرانکی سویسرا', 'الفرنك السويسري', 'Swiss franc')],
    ['CNY', 'price_cny', 'fx', 'f:cn', 10, 0, N('یوان چین', 'یوانی چین', 'اليوان الصيني', 'Chinese yuan')],
    ['JPY', 'price_jpy', 'fx', 'f:jp', 10, 0, N('ین ژاپن (۱۰۰ ین)', 'یەنی ژاپۆن (١٠٠ یەن)', 'الين الياباني (100 ين)', 'Japanese yen (100)')],
    ['CAD', 'price_cad', 'fx', 'f:ca', 10, 0, N('دلار کانادا', 'دۆلاری کەنەدا', 'الدولار الكندي', 'Canadian dollar')],
    ['AUD', 'price_aud', 'fx', 'f:au', 10, 0, N('دلار استرالیا', 'دۆلاری ئوسترالیا', 'الدولار الأسترالي', 'Australian dollar')],
    ['RUB', 'price_rub', 'fx', 'f:ru', 10, 0, N('روبل روسیه', 'ڕۆبڵی ڕووسیا', 'الروبل الروسي', 'Russian rouble')],
    ['OMR', 'price_omr', 'fx', 'f:om', 10, 0, N('ریال عمان', 'ڕیاڵی عومان', 'الريال العماني', 'Omani rial')],
    ['KWD', 'price_kwd', 'fx', 'f:kw', 10, 0, N('دینار کویت', 'دیناری کوەیت', 'الدينار الكويتي', 'Kuwaiti dinar')],
    ['SAR', 'price_sar', 'fx', 'f:sa', 10, 0, N('ریال عربستان', 'ڕیاڵی سعودی', 'الريال السعودي', 'Saudi riyal')],
    ['QAR', 'price_qar', 'fx', 'f:qa', 10, 0, N('ریال قطر', 'ڕیاڵی قەتەر', 'الريال القطري', 'Qatari riyal')],
    ['AFN', 'price_afn', 'fx', 'f:af', 10, 0, N('افغانی', 'ئەفغانی', 'الأفغاني', 'Afghan afghani')],
    ['AZN', 'price_azn', 'fx', 'f:az', 10, 0, N('منات آذربایجان', 'ماناتی ئازەربایجان', 'المانات الأذربيجاني', 'Azerbaijani manat')],
    ['AMD', 'price_amd', 'fx', 'f:am', 10, 0, N('درام ارمنستان', 'درامی ئەرمەنستان', 'الدرام الأرميني', 'Armenian dram')],
    ['INR', 'price_inr', 'fx', 'f:in', 10, 0, N('روپیه هند', 'ڕووپیەی هیند', 'الروبية الهندية', 'Indian rupee')],
    ['PKR', 'price_pkr', 'fx', 'f:pk', 10, 0, N('روپیه پاکستان', 'ڕووپیەی پاکستان', 'الروبية الباكستانية', 'Pakistani rupee')],
    ['GERAM18', 'geram18', 'gold', 'i:gold18', 10, 0, N('طلای ۱۸ عیار (گرم)', 'زێڕی ١٨ (گرام)', 'ذهب عيار 18 (غرام)', '18k gold (gram)')],
    ['GERAM24', 'geram24', 'gold', 'i:gold24', 10, 0, N('طلای ۲۴ عیار (گرم)', 'زێڕی ٢٤ (گرام)', 'ذهب عيار 24 (غرام)', '24k gold (gram)')],
    ['MESGHAL', 'mesghal', 'gold', 'i:mesghal', 10, 0, N('مثقال طلا', 'مسقاڵی زێڕ', 'مثقال الذهب', 'Gold mesghal')],
    ['ABSHODE', 'gold_futures', 'gold', 'i:abshode', 10, 0, N('آبشده نقدی', 'زێڕی تواوە (نەختینە)', 'الذهب المصهور (نقدي)', 'Melted gold (cash)')],
    ['ONS', 'ons', 'gold', 'i:ons', 1, 0, N('انس طلا (دلار)', 'ئۆنسی زێڕ (دۆلار)', 'أونصة الذهب (دولار)', 'Gold ounce (USD)')],
    ['SEKEE', 'sekee', 'coin', 'i:sekee', 10, 0, N('سکه امامی', 'سکەی ئیمامی', 'الجنيه الذهبي الإمامي', 'Emami gold coin')],
    ['SEKEB', 'sekeb', 'coin', 'i:sekeb', 10, 0, N('سکه بهار آزادی', 'سکەی بەهاری ئازادی', 'جنيه بهار آزادي', 'Bahar Azadi coin')],
    ['NIM', 'nim', 'coin', 'i:nim', 10, 0, N('نیم سکه', 'نیو سکە', 'نصف جنيه', 'Half coin')],
    ['ROB', 'rob', 'coin', 'i:rob', 10, 0, N('ربع سکه', 'چارەکە سکە', 'ربع جنيه', 'Quarter coin')],
    ['GERAMI', 'gerami', 'coin', 'i:gerami', 10, 0, N('سکه گرمی', 'سکەی گرامی', 'جنيه غرامي', 'Gram coin')],
    ['BUBBLE', 'coin_blubber', 'coin', 'i:bubble', 10, 0, N('حباب سکه امامی', 'حەبابی سکەی ئیمامی', 'فقاعة الجنيه الإمامي', 'Emami coin bubble')],
    ['SILVER', 'silver', 'silver', 'i:silver', 1, 0, N('انس نقره (دلار)', 'ئۆنسی زیو (دۆلار)', 'أونصة الفضة (دولار)', 'Silver ounce (USD)')],
    ['SILVER999', 'silver_999', 'silver', 'i:silver999', 10, 0, N('نقره ۹۹۹ (گرم)', 'زیوی ٩٩٩ (گرام)', 'فضة 999 (غرام)', 'Silver 999 (gram)')],
    ['USDT', 'crypto-tether-irr', 'crypto', 'c:USDT', 10, 1, N('تتر (تومان)', 'تەتەر (تمەن)', 'تيثر (تومان)', 'Tether (toman)')]
  ];
  var IR = {}; CAT.forEach(function (r) { IR[r[0]] = { key: r[0], g: r[1], grp: r[2], icon: r[3], div: r[4], daily: !!r[5], n: r[6] }; });
  var TMN = N('تومان', 'تمەن', 'تومان', 'IRT');

  P.SYM_RE = /^(?:[A-Z0-9]{1,12}(?:_IRT)?|IR_[A-Z0-9]{2,12})$/;           /* Binance has one-letter coins too: S, W, T, A… */
  function lang() { var A = P.app; return A && A.LANG ? A.LANG() : 'fa'; }
  function iconUrl(ic) { var k = ic.slice(2); return ic[0] === 'f' ? '/assets/pro/flags/' + k + '.svg' : ic[0] === 'i' ? '/assets/pro/ic/' + k + '.svg' : '/data/logos/' + k + '.png'; }

  /* everything the screen needs to know about a symbol */
  P.inst = function (sym) {
    sym = String(sym || '');
    if (sym.indexOf('IR_') === 0) {
      var c = IR[sym.slice(3)]; if (!c) return null;
      return { sym: sym, kind: 'ir', base: c.key, quote: c.div === 1 ? 'USD' : 'IRT', name: c.n, logo: iconUrl(c.icon), coin: c.icon[0] === 'c' ? c.icon.slice(2) : null,
        src: 'tgju', minSec: c.daily ? 86400 : 300, grade: c.g, div: c.div, grp: c.grp };
    }
    if (/_IRT$/.test(sym)) { var b = sym.slice(0, -4); return { sym: sym, kind: 'irt', base: b, quote: 'IRT', logo: '/data/logos/' + b + '.png', coin: b, src: 'Binance × tgju', minSec: 1 }; }
    return { sym: sym, kind: 'usdt', base: sym, quote: 'USDT', logo: '/data/logos/' + sym + '.png', coin: sym, src: 'Binance', minSec: 1 };
  };
  P.logo = function (sym) { var i = P.inst(sym); return i ? i.logo : ''; };
  /* the pair as people say it: BTC/USDT · BTC/تومان · دلار آمریکا */
  P.pair = function (sym, short) {
    var i = P.inst(sym), l = lang(); if (!i) return sym;
    if (i.kind === 'ir') return short ? i.base : i.name[l] || i.name.en;
    return i.base + '/' + (i.quote === 'IRT' ? TMN[l] : 'USDT');
  };
  P.isToman = function (sym) { var i = P.inst(sym); return !!i && i.quote === 'IRT'; };
  P.precFor = function (sym, p) { return P.isToman(sym) && Math.abs(p) >= 1000 ? 0 : P.prec(p); };
  /* the site's rule: no coin is ever shown without its own logo (icons of currencies and gold ship with the page) */
  P.hasLogo = function (sym) {
    var i = P.inst(sym); if (!i) return false;
    if (!i.coin) return true;
    return !P._logoSet || P._logoSet.has(i.coin);
  };
  P.irList = function () { return CAT.map(function (r) { return 'IR_' + r[0]; }).filter(P.hasLogo); };
  P.irGroup = function (sym) { var i = P.inst(sym); return i && i.grp; };

  /* ---------------------------------------------------------------- tgju */
  function num(s) { return +String(s == null ? '' : s).replace(/[^\d.\-]/g, ''); }
  var HIST = {};
  function tgHist(grade, res) {                                        /* the whole history at one resolution (tgju sends all of it) */
    var k = grade + '|' + res;
    if (!HIST[k]) HIST[k] = P.getJSON(TGH + encodeURIComponent(grade) + '&resolution=' + res + '&from=0&to=' + Math.floor(Date.now() / 1000), 30000).then(function (j) {
      if (!j || j.s !== 'ok' || !j.t || !j.t.length) throw new Error('empty');
      return j;
    }, function (e) { delete HIST[k]; throw e; });
    return HIST[k];
  }
  /* the latest price in tgju's table of the day: [price, "HH:MM:SS", …] (Tehran time) */
  function tgLast(grade) {
    return P.getJSON(TGT + encodeURIComponent(grade) + '?start=0&length=1', 9000).then(function (j) {
      var r = j && j.data && j.data[0]; if (!r) throw new Error('none');
      var p = num(r[0]), m = /(\d\d):(\d\d):(\d\d)/.exec(String(r[1] || '')); if (!(p > 0)) throw new Error('bad');
      var now = Date.now() / 1000, th = new Date((now + TEH) * 1000), t = now;
      if (m) { t = Date.UTC(th.getUTCFullYear(), th.getUTCMonth(), th.getUTCDate(), +m[1], +m[2], +m[3]) / 1000 - TEH; if (t > now + 120) t -= 86400; }
      return { p: p, t: Math.floor(t) };
    });
  }
  var NAT = [[2592000, 'M'], [604800, 'W'], [86400, '1D'], [14400, '240'], [10800, '180'], [7200, '120'], [3600, '60'], [1800, '30'], [900, '15'], [600, '10'], [300, '5']];
  function tgRes(tf) {
    if (tf.u === 'M') return tf.n === 1 ? [2592000, 'M'] : null;
    if (tf.u === 'w') return [604800, 'W'];
    for (var i = 2; i < NAT.length; i++) if (NAT[i][0] <= tf.sec && tf.sec % NAT[i][0] === 0) return NAT[i];
    return null;
  }

  function dedup(a) {                                                  /* sorted bars → one per time (the same time merged) */
    var out = [];
    for (var i = 0; i < a.length; i++) {
      var b = a[i], p = out[out.length - 1];
      if (p && p.t === b.t) { if (b.h > p.h) p.h = b.h; if (b.l < p.l) p.l = b.l; p.c = b.c; } else out.push(b);
    }
    return out;
  }
  P._dedup = dedup;
  /* ---------------------------------------------------------------- a small feed base shared by both kinds */
  function Base(sym, tf) { this.sym = sym; this.tf = tf; this.key = sym + '|' + tf.id; this.bars = []; this.subs = []; this.refs = 0; this.state = 'load'; this.src = null; this.at = null; this.full = true; this.busy = false; this.dead = false; }
  Base.prototype.tell = function (what, x) { var s = this; this.subs.slice().forEach(function (f) { try { f(what, s, x); } catch (e) { if (window.console) console.error(e); } }); };
  Base.prototype.more = function () { return Promise.resolve(false); };
  Base.prototype.catchup = function () { };
  Base.prototype.setBars = function (bars) { this.bars = bars; this.at = Date.now(); this.tell('reset'); };
  /* a live price into the current bar. tgju's own bars set the grid (hours on Tehran's :30, days at 00:00 UTC), so a
     tick goes into the bar it falls in, counted from the last bar, never into a bar of its own at the tick's second */
  Base.prototype.put = function (b, closed) {
    if (this.dead || !(b.c > 0)) return;
    var bars = this.bars, lb = bars[bars.length - 1], sec = this.tf.sec, nb, isNew = false, k;
    if (!lb) k = P.bucket(b.t, { sec: sec, ratio: 2 });
    else if (b.t < lb.t) return;
    else if (sec >= 28 * 86400) k = b.t - lb.t < 28 * 86400 ? lb.t : P.bucket(b.t, { sec: sec, ratio: 2 }) > lb.t ? P.bucket(b.t, { sec: sec, ratio: 2 }) : lb.t;
    else k = lb.t + Math.floor((b.t - lb.t) / sec) * sec;
    if (lb && lb.t === k) { nb = { t: k, o: lb.o, h: Math.max(lb.h, b.h), l: Math.min(lb.l, b.l), c: b.c, v: lb.v + (b.dv || 0) }; bars[bars.length - 1] = nb; }
    else { nb = { t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.dv || 0 }; bars.push(nb); isNew = true; }
    this.at = Date.now(); this.tell('tick', { bar: nb, isNew: isNew, closed: !!closed });
  };

  /* ---------------------------------------------------------------- IR_<KEY>: tgju */
  function IrFeed(sym, tf) { Base.call(this, sym, tf); this.inst = P.inst(sym); this.src = 'tgju'; }
  IrFeed.prototype = Object.create(Base.prototype);
  IrFeed.prototype.start = function () {
    var self = this, I = this.inst, nr = tgRes(this.tf);
    this.state = 'load'; this.tell('state');
    if (!I || !nr || this.tf.sec < I.minSec) { this.state = 'error'; this.err = 'tf'; this.tell('state'); return; }
    this.nat = nr[0];
    tgHist(I.grade, nr[1]).then(function (j) {
      if (self.dead) return;
      var d = I.div, base = [];
      for (var i = 0; i < j.t.length; i++) if (j.c[i] > 0) base.push({ t: j.t[i], o: j.o[i] / d, h: j.h[i] / d, l: j.l[i] / d, c: j.c[i] / d, v: 0 });
      base.sort(function (a, b) { return a.t - b.t; });
      base = dedup(base);                                              /* tgju's history repeats a few timestamps: one bar each */
      var tf = self.tf, bars = nr[0] === tf.sec ? base : P.aggregate(base, tf);
      self.state = 'poll'; self.setBars(bars); self.tell('state'); self.poll();
    }).catch(function () { return self.fromSite(); }).catch(function () {
      if (self.dead) return; self.state = 'error'; self.err = 'nodata'; self.tell('state');
      clearTimeout(self.retryT); self.retryT = setTimeout(function () { if (!self.dead && self.refs) self.start(); }, 30000);
    });
  };
  /* last resort for the dollar, tether, 18k gold and the Emami coin: the site's own daily series (data/iran_daily.json) */
  var SITE_KEY = { USD: 'USD', USDT: 'USDT', GERAM18: 'GOLD18', SEKEE: 'COIN' };
  IrFeed.prototype.fromSite = function () {
    var self = this, k = SITE_KEY[this.inst.base];
    if (!k || this.tf.sec < 86400) return Promise.reject(new Error('no site series'));
    return P.getJSON('/data/iran_daily.json?v=' + Math.floor(Date.now() / 6e5)).then(function (j) {
      var s = j && j.series && j.series[k]; if (!s) throw new Error('none');
      var base = Object.keys(s).sort().map(function (d) { var v = s[d]; return { t: Date.parse(d + 'T00:00:00Z') / 1000, o: v, h: v, l: v, c: v, v: 0 }; });   /* already toman */
      if (!base.length) throw new Error('empty');
      self.src = 'site'; self.state = 'snap'; self.setBars(self.tf.sec === 86400 ? base : P.aggregate(base, self.tf)); self.tell('state');
    });
  };
  IrFeed.prototype.poll = function () {
    var self = this; clearInterval(this.poller);
    function once() {
      if (self.dead || document.hidden) return;
      tgLast(self.inst.grade).then(function (x) { var c = x.p / self.inst.div; self.put({ t: x.t, o: c, h: c, l: c, c: c }); }, function () { });
    }
    once(); this.poller = setInterval(once, P.saver ? 120000 : 20000);
  };
  IrFeed.prototype.stop = function () { this.dead = true; clearInterval(this.poller); clearTimeout(this.retryT); delete FEEDS[this.key]; };

  /* ---------------------------------------------------------------- tether's toman rate: daily closes + today's live price */
  var RATE = { pts: null, live: null, ready: null, users: 0, poller: null, subs: [] };
  function rateLoad() {
    if (!RATE.ready) RATE.ready = tgHist('crypto-tether-irr', '1D').then(function (j) {
      var pts = []; for (var i = 0; i < j.t.length; i++) if (j.c[i] > 0) pts.push([j.t[i] + 86400, j.c[i] / 10]);
      pts.sort(function (a, b) { return a[0] - b[0] }); RATE.pts = pts; return pts;
    }).catch(function () {                                              /* tgju out of reach: the site's daily tether series */
      return P.getJSON('/data/iran_daily.json?v=' + Math.floor(Date.now() / 6e5)).then(function (j) {
        var s = j && j.series && j.series.USDT; if (!s) throw new Error('no rate');
        RATE.pts = Object.keys(s).sort().map(function (d) { return [Date.parse(d + 'T00:00:00Z') / 1000 + 86400, s[d]]; }); RATE.site = true; return RATE.pts;
      });
    }).catch(function (e) { RATE.ready = null; throw e; });
    return RATE.ready;
  }
  function rateLive() {
    return tgLast('crypto-tether-irr').then(function (x) {
      var v = x.p / 10; RATE.live = [x.t, v]; RATE.subs.slice().forEach(function (f) { try { f(); } catch (e) { } }); return v;
    }, function () { return null; });
  }
  function rateUse(on) {
    RATE.users += on ? 1 : -1;
    if (RATE.users > 0 && !RATE.poller) { rateLive(); RATE.poller = setInterval(function () { if (!document.hidden) rateLive(); }, P.saver ? 120000 : 20000); }
    if (RATE.users <= 0 && RATE.poller) { clearInterval(RATE.poller); RATE.poller = null; RATE.users = 0; }
  }
  /* tether in toman at time t (seconds): straight line between daily closes, then to today's live price */
  function rateAt(t) {
    var a = RATE.pts; if (!a || !a.length) return RATE.live ? RATE.live[1] : null;
    var pts = a, n = pts.length;
    if (RATE.live && RATE.live[0] > pts[n - 1][0]) { pts = pts.concat([RATE.live]); n++; }
    if (t <= pts[0][0]) return pts[0][1];
    if (t >= pts[n - 1][0]) return pts[n - 1][1];
    var lo = 0, hi = n - 1; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (pts[mid][0] <= t) lo = mid; else hi = mid; }
    var p0 = pts[lo], p1 = pts[hi]; return p0[1] + (p1[1] - p0[1]) * (t - p0[0]) / (p1[0] - p0[0]);
  }
  P.rateAt = rateAt; P._rate = RATE;
  function toToman(b, sec) { var r = rateAt(b.t + sec / 2); return r ? { t: b.t, o: b.o * r, h: b.h * r, l: b.l * r, c: b.c * r, v: b.v } : null; }

  /* ---------------------------------------------------------------- <COIN>_IRT: a Binance feed × the rate */
  function IrtFeed(sym, tf) { Base.call(this, sym, tf); this.inst = P.inst(sym); this.src = 'irt'; this.full = false; }
  IrtFeed.prototype = Object.create(Base.prototype);
  IrtFeed.prototype.start = function () {
    var self = this; this.state = 'load'; this.tell('state'); rateUse(true); this.rated = true;
    this.onRate = function () { var B = self.bf && self.bf.bars; if (B && B.length) self.convOne(B[B.length - 1], false); };
    RATE.subs.push(this.onRate);
    rateLoad().then(function () {
      if (self.dead) return;
      self.sub = P.feedUsdt(self.inst.base, self.tf.id, function (what, F, x) {
        self.bf = F; self.full = F.full; self.busy = F.busy;
        if (what === 'reset' || what === 'more') { self.convAll(); self.tell(what === 'more' ? 'more' : 'reset', x); }
        else if (what === 'tick') self.convOne(x.bar, x.closed, x.isNew);
        else if (what === 'state') { self.state = F.state; self.tell('state'); }
      });
      if (!self.sub) throw new Error('tf');
    }).catch(function () { if (self.dead) return; self.state = 'error'; self.err = 'rate'; self.tell('state'); });
  };
  IrtFeed.prototype.convAll = function () {
    var B = this.bf.bars, sec = this.tf.sec, out = [];
    for (var i = 0; i < B.length; i++) { var b = toToman(B[i], sec); if (b) out.push(b); }
    this.bars = out; this.state = this.bf.state; this.at = Date.now();
  };
  IrtFeed.prototype.convOne = function (bar, closed, isNew) {
    var b = toToman(bar, this.tf.sec); if (!b) return;
    var bars = this.bars, lb = bars[bars.length - 1];
    if (lb && lb.t === b.t) bars[bars.length - 1] = b; else if (!lb || b.t > lb.t) { bars.push(b); isNew = true; } else return;
    this.at = Date.now(); this.tell('tick', { bar: b, isNew: !!isNew, closed: !!closed });
  };
  IrtFeed.prototype.more = function () { return this.bf ? this.bf.more() : Promise.resolve(false); };
  IrtFeed.prototype.catchup = function () { if (this.bf) this.bf.catchup(); };
  IrtFeed.prototype.stop = function () {
    this.dead = true; if (this.sub) this.sub.off(); var i = RATE.subs.indexOf(this.onRate); if (i >= 0) RATE.subs.splice(i, 1);
    if (this.rated) rateUse(false); clearTimeout(this.retryT); delete FEEDS[this.key];
  };

  /* ---------------------------------------------------------------- P.feed for every kind of symbol */
  var FEEDS = {}, usdtFeed = P.feed;
  P.feedUsdt = usdtFeed;
  P.feed = function (sym, tfId, fn) {
    var I = P.inst(sym); if (!I) return null;
    if (I.kind === 'usdt') return usdtFeed(sym, tfId, fn);
    var tf = P.parseTF(tfId); if (!tf) return null;
    var key = sym + '|' + tf.id, F = FEEDS[key];
    if (!F) { F = FEEDS[key] = I.kind === 'ir' ? new IrFeed(sym, tf) : new IrtFeed(sym, tf); F.start(); }
    clearTimeout(F.killT); F.subs.push(fn); F.refs++;
    if (F.bars.length) setTimeout(function () { if (F.subs.indexOf(fn) >= 0) fn('reset', F); }, 0);
    return { feed: F, off: function () {
      var i = F.subs.indexOf(fn); if (i < 0) return; F.subs.splice(i, 1);
      if (--F.refs <= 0) F.killT = setTimeout(function () { if (F.refs <= 0) F.stop(); }, 20000);
    } };
  };
  P.feedsIr = FEEDS;

  /* history for a replay that starts before what is loaded */
  var histUsdt = P.history;
  P.history = function (sym, tfId, startMs, endMs) {
    var I = P.inst(sym), tf = P.parseTF(tfId); if (!I || !tf) return Promise.reject(new Error('sym'));
    if (I.kind === 'usdt') return histUsdt(sym, tfId, startMs, endMs);
    if (I.kind === 'irt') return Promise.all([rateLoad(), histUsdt(I.base, tfId, startMs, endMs)]).then(function (r) { return r[1].map(function (b) { return toToman(b, tf.sec); }).filter(Boolean); });
    var nr = tgRes(tf); if (!nr) return Promise.reject(new Error('tf'));
    return tgHist(I.grade, nr[1]).then(function (j) {
      var base = []; for (var i = 0; i < j.t.length; i++) if (j.c[i] > 0 && j.t[i] * 1000 >= startMs && j.t[i] * 1000 <= endMs) base.push({ t: j.t[i], o: j.o[i] / I.div, h: j.h[i] / I.div, l: j.l[i] / I.div, c: j.c[i] / I.div, v: 0 });
      base.sort(function (a, b) { return a.t - b.t; }); base = dedup(base); return nr[0] === tf.sec ? base : P.aggregate(base, tf);
    });
  };

  var firstUsdt = P.firstBars;
  P.firstBars = function (sym, tfId) {
    var I = P.inst(sym), tf = P.parseTF(tfId); if (!I || !tf) return Promise.reject(new Error('sym'));
    if (I.kind === 'usdt') return firstUsdt(sym, tfId);
    if (I.kind === 'irt') return Promise.all([rateLoad(), firstUsdt(I.base, tfId)]).then(function (r) { return r[1].map(function (b) { return toToman(b, tf.sec); }).filter(Boolean); });
    return P.history(sym, tfId, 0, Date.now()).then(function (b) { return b.slice(0, 1000); });
  };

  /* ---------------------------------------------------------------- prices for lists: tgju's table of every price, and coins × rate */
  var IRW = [], IRTW = [], IRP = null, ALL = null;
  function allTable() {
    var i = 0;
    function next() { if (i >= TGA.length) return Promise.reject(new Error('tgju')); return P.getJSON(TGA[i++] + '?v=' + Math.floor(Date.now() / 30000), 15000).catch(next); }
    return next().then(function (j) { if (!j || !j.current) throw new Error('bad'); ALL = j.current; return ALL; });
  }
  function irPrices() {
    if (!IRW.length || document.hidden) return;
    allTable().then(function (cur) {
      IRW.forEach(function (s) {
        var I = P.inst(s), x = I && cur[I.grade]; if (!x) return;
        var c = num(x.p) / I.div, ch = (+x.dp || 0) * (x.dt === 'low' ? -1 : 1);
        P._tkPut(s, { c: c, o: c / (1 + ch / 100), h: num(x.h) / I.div || c, l: num(x.l) / I.div || c, q: 0, src: 'tgju' });
      });
    }, function () { });
  }
  function irtPrice(s) {
    var b = P.tickers.d[s.slice(0, -4)], now = Date.now() / 1000, r = rateAt(now), r0 = rateAt(now - 86400);
    if (!b || !r || !r0) return;
    P._tkPut(s, { c: b.c * r, o: b.o * r0, h: b.h * r, l: b.l * r, q: b.q * r, src: 'irt' });
  }
  P.tickers.on(function (sym) { if (IRTW.length && IRTW.indexOf(sym + '_IRT') >= 0) irtPrice(sym + '_IRT'); });
  RATE.subs.push(function () { IRTW.forEach(irtPrice); });
  var watchUsdt = P.tickers.watch;
  P.tickers.watch = function (syms) {
    var c = {}, ir = [], irt = [];
    syms.forEach(function (s) { var I = P.inst(s); if (!I) return; if (I.kind === 'ir') ir.push(s); else { c[I.base] = 1; if (I.kind === 'irt') irt.push(s); } });
    watchUsdt(Object.keys(c));
    var hadIrt = IRTW.length > 0; IRW = ir; IRTW = irt;
    if (irt.length && !hadIrt) { rateUse(true); rateLoad().then(function () { IRTW.forEach(irtPrice); }, function () { }); }
    if (!irt.length && hadIrt) rateUse(false);
    clearInterval(IRP); IRP = null;
    if (ir.length) { irPrices(); IRP = setInterval(irPrices, P.saver ? 300000 : 60000); }
  };

  /* ---------------------------------------------------------------- the lists people pick from */
  P.markets = function () {
    return Promise.all([P.universe(), P.logos()]).then(function (r) {
      var u = r[0] || [];
      return { usdt: u, irt: u.map(function (s) { return s + '_IRT'; }), ir: P.irList() };
    });
  };
})();
