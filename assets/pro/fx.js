/* entekhab.net — /market/: prices in the visitor's own currency.
   A coin in a currency (BTC_EUR, ETH_JPY …) is worked out exactly as a coin in toman is: the Binance candle in USDT ×
   that currency's rate for one tether, the rate taken at the middle of each bar. This file keeps the rates and the
   visitor's choice; markets.js builds the candles and list prices from them.

   Where a rate comes from (the page says which, next to every price it changes):
     IRT  tether's toman price on Iran's free market (tgju.org), daily closes + today's live price — markets.js
     any other currency: the site's daily reference rate, data/fx/<CUR>.json, written by scripts/fx_rates.py from the
          European Central Bank's reference rates (the ~30 currencies it quotes, history since 2017) or the open
          exchange-api dataset (every other currency, daily since 2 March 2024), × the dollar value of one tether that
          day (USDT is not exactly one dollar). Days are joined by straight lines, as toman closes are. Before a
          currency's first known day there is no rate, so no candle: nothing is extrapolated backwards.
     the visitor's own rate: «1 USDT = X» or «1 USD = X» (a dollar rate is turned into a tether rate with that day's
          dollar value of one tether), the same for every bar — the page then says «your rate» wherever it is used.
   USD means no conversion at all: Binance's USDT pairs, as before.

   What the visitor starts with (until they choose; their choice is kept in this browser, ek_pro_fx):
     Persian → toman (Afghanistan: afghani, Tajikistan: somoni); Kurdish → toman (Iraq: dinar); every other language →
     the currency of the country of the browser's time zone (langs.js: TZCC, CCCUR), else the language's home currency. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  var S = P.store, KEY = 'ek_pro_fx', LISTENERS = [];
  var LANG = 'fa';

  /* ---------------------------------------------------------------- the visitor's choice (untrusted storage: checked) */
  function sane(o) {
    var r = { c: null, own: {} };
    if (!o || typeof o !== 'object') return r;
    if (typeof o.c === 'string' && /^[A-Z]{3}$/.test(o.c)) r.c = o.c;
    if (o.own && typeof o.own === 'object') Object.keys(o.own).forEach(function (k) {
      var x = o.own[k]; if (!/^[A-Z]{3}$/.test(k) || !x || typeof x !== 'object') return;
      var v = +x.v; if (!(v > 0) || v > 1e12) return;
      r.own[k] = { v: v, per: x.per === 'USD' ? 'USD' : 'USDT', at: +x.at || 0 };
    });
    return r;
  }
  var ST = sane(S ? S.get(KEY, null) : null);
  function save() { if (S) S.set(KEY, ST); }
  function tell(what, code) { LISTENERS.slice().forEach(function (f) { try { f(what, code); } catch (e) { if (window.console) console.error(e); } }); }

  /* ---------------------------------------------------------------- languages */
  function row(code) { var L = P.LANGS || []; for (var i = 0; i < L.length; i++) if (L[i][0] === code) return L[i]; return null; }
  function bcp(lang) { var r = row(lang || LANG); return r ? r[3] : 'en'; }
  function tzCountry() {
    try { var z = Intl.DateTimeFormat().resolvedOptions().timeZone; return (P.TZCC && P.TZCC[z]) || null; } catch (e) { return null; }
  }
  function defaultCur(lang) {
    var cc = tzCountry(), r = row(lang), home = r ? r[6] : 'USD';
    if (lang === 'fa') return cc === 'AF' ? 'AFN' : cc === 'TJ' ? 'TJS' : 'IRT';
    if (lang === 'ckb') return cc === 'IQ' ? 'IQD' : 'IRT';
    if (lang === 'en') return 'USD';                                 /* the page's own default: tether pairs, nothing converted */
    return (cc && P.CCCUR && P.CCCUR[cc]) || home;
  }

  /* ---------------------------------------------------------------- names, symbols and digits */
  var DN = {}, SY = {};
  function name(code, lang) {
    lang = lang || LANG;
    if (code === 'IRT') return P.tr ? P.tr(lang, 'tomanName') : 'Iranian toman';
    var loc = bcp(lang);
    try { var dn = DN[loc] || (DN[loc] = new Intl.DisplayNames([loc, 'en'], { type: 'currency' })); var n = dn.of(code); if (n && n !== code) return n; } catch (e) { }
    try { var de = DN.en || (DN.en = new Intl.DisplayNames(['en'], { type: 'currency' })); return de.of(code) || code; } catch (e2) { return code; }
  }
  function symbol(code, lang) {
    if (code === 'IRT') return P.tr ? P.tr(lang || LANG, 'toman') : 'IRT';
    var k = (lang || LANG) + code; if (SY[k]) return SY[k];
    var s = code;
    try {
      var parts = new Intl.NumberFormat(bcp(lang), { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(1);
      for (var i = 0; i < parts.length; i++) if (parts[i].type === 'currency') { s = parts[i].value; break; }
    } catch (e) { }
    return (SY[k] = s);
  }
  function digits(code) { var D = P.CUR_DIG || {}; return D[code] != null ? D[code] : 2; }
  /* decimals for a price in this currency: big prices drop their decimals (as the toman does above 1,000) */
  function prec(code, p) {
    var a = Math.abs(p); if (!(a > 0)) return 2;
    if (code === 'IRT') return a >= 1000 ? 0 : P.prec(p);
    var dg = digits(code);
    if (a >= 100000) return 0;
    if (a >= 100) return Math.min(dg, 2);
    return P.prec(p);
  }
  /* the flag a currency is shown with (flag-icons 1×1, MIT): its issuing country, the EU for the euro, nothing for the
     multi-country francs and dollars (XOF, XAF, XCD, XPF) — they get a plain coin glyph instead */
  function flag(code) {
    if (code === 'EUR') return '/assets/pro/flags/eu.svg';
    if (code === 'IRT') return '/assets/pro/flags/ir.svg';
    if (/^X/.test(code)) return '/assets/pro/ic/cur.svg';
    return '/assets/pro/flags/' + code.slice(0, 2).toLowerCase() + '.svg';
  }

  /* ---------------------------------------------------------------- the reference rates (data/fx) */
  /* data/fx/latest.json: {"usdt": dollars per tether, "from": "YYYY-MM-DD", "r": {"EUR": ["ecb", v_from … v_to]}} — the
     last 14 days of every currency (the history files are rewritten weekly; these days are added to them).
     Returned as {usdt, from, r: {CUR: [last value, its date, source]}, win: {CUR: [[t, v], …]}} */
  var LATEST = null;
  function latest() {
    if (!LATEST || LATEST.t < Date.now() - 36e5) LATEST = { t: Date.now(), p: P.getJSON('/data/fx/latest.json?v=' + Math.floor(Date.now() / 36e5), 15000).then(function (j) {
      if (!j || !j.r || typeof j.r !== 'object' || !/^\d{4}-\d\d-\d\d$/.test(j.from || '')) throw new Error('bad');
      if (j.usdt > 0.5 && j.usdt < 1.5) USDT = j.usdt;
      var t0 = Date.parse(j.from + 'T00:00:00Z') / 1000, out = { usdt: USDT, from: j.from, at: j.at, r: {}, win: {} };
      Object.keys(j.r).forEach(function (k) {
        var a = j.r[k]; if (!/^[A-Z]{3}$/.test(k) || !Array.isArray(a) || a.length < 2) return;
        var pts = [];
        for (var i = 1; i < a.length; i++) { var v = +a[i]; if (a[i] != null && v > 0 && isFinite(v)) pts.push([t0 + i * 86400, v]); }
        if (!pts.length) return;
        var L = pts[pts.length - 1];
        out.win[k] = pts; out.r[k] = [L[1], new Date((L[0] - 86400) * 1000).toISOString().slice(0, 10), String(a[0])];
      });
      return out;
    }).catch(function (e) { LATEST = null; throw e; }) };
    return LATEST.p;
  }
  var USDT = 1;                                                       /* dollars per tether (latest.json); 1 until known */
  function ownVal(code) { var o = ST.own[code]; if (!o) return null; return o.per === 'USD' ? o.v * USDT : o.v; }

  /* one rate object per currency, shared by every chart and list that shows it */
  var RT = {};
  function Rate(code) { this.code = code; this.pts = null; this.ready = null; this.users = 0; this.subs = []; this.poller = null; this.src = null; this.from = null; this.to = null; }
  Rate.prototype.notify = function () { this.subs.slice().forEach(function (f) { try { f(); } catch (e) { } }); };
  Rate.prototype.load = function () {
    var self = this, code = this.code;
    /* the history file and the last 14 days (latest.json), joined: either alone is enough to draw something. With the
       visitor's own rate the reference still loads (tether's own chart shows it), but its absence is no error */
    if (!this.ready) this.ready = Promise.all([
      P.getJSON('/data/fx/' + code + '.json?v=' + Math.floor(Date.now() / 36e5), 20000).catch(function () { return null; }),
      latest().catch(function () { return null; })
    ]).then(function (r) {
      var j = r[0], L = r[1], pts = parse(j), w = L && L.win[code];
      if (w) { var end = pts.length ? pts[pts.length - 1][0] : -Infinity; w.forEach(function (p) { if (p[0] > end) pts.push(p); }); }
      if (!pts.length) throw new Error('no rate');
      self.pts = pts; self.src = (j && j.src) || (L && L.r[code] && L.r[code][2]) || null;
      self.from = j ? j.from : L.from; self.to = new Date((pts[pts.length - 1][0] - 86400) * 1000).toISOString().slice(0, 10);
      return pts;
    }).catch(function (e) { self.ready = null; throw e; });
    if (ownVal(code) != null) {
      if (ST.own[code].per === 'USD') latest().then(function () { self.notify(); }, function () { });
      return this.ready.then(function () { return true; }, function () { return true; });
    }
    return this.ready;
  };
  /* {"c":"EUR","src":"ecb","from":"2017-01-02","to":"2026-11-14","v":[0.9581, …]}: one value per day from `from`, the
     units of the currency one tether bought that day; null where a day is unknown. A day's value stands at its end. */
  function parse(j) {
    var out = []; if (!j || !Array.isArray(j.v) || !/^\d{4}-\d\d-\d\d$/.test(j.from || '')) return out;
    var t0 = Date.parse(j.from + 'T00:00:00Z') / 1000; if (!isFinite(t0)) return out;
    for (var i = 0; i < j.v.length; i++) { var v = +j.v[i]; if (j.v[i] != null && v > 0 && isFinite(v)) out.push([t0 + (i + 1) * 86400, v]); }
    return out;
  }
  P._fxParse = parse;
  /* the rate at time t (seconds): the visitor's own if they typed one; else a straight line between daily values,
     the last one held to now. null before the first known day (that bar is left out, never guessed) */
  Rate.prototype.at = function (t) {
    var own = ownVal(this.code); if (own != null) return own;
    return this.ref(t);
  };
  /* the reference rate alone (tether's own chart and its list price never take the visitor's rate) */
  Rate.prototype.ref = function (t) {
    var a = this.pts; if (!a || !a.length) return null;
    var n = a.length;
    if (t < a[0][0] - 2 * 86400) return null;
    if (t <= a[0][0]) return a[0][1];
    if (t >= a[n - 1][0]) return a[n - 1][1];
    var lo = 0, hi = n - 1; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (a[mid][0] <= t) lo = mid; else hi = mid; }
    var p0 = a[lo], p1 = a[hi]; return p0[1] + (p1[1] - p0[1]) * (t - p0[0]) / (p1[0] - p0[0]);
  };
  /* while something shows this currency, look for a new day's rate once an hour */
  Rate.prototype.use = function (on) {
    var self = this; this.users += on ? 1 : -1;
    if (this.users > 0 && !this.poller) this.poller = setInterval(function () {
      if (document.hidden) return;
      var before = self.to, keep = self.pts; self.ready = null; LATEST = null;
      self.load().then(function () { if (self.to !== before) self.notify(); }, function () { self.pts = keep; });
    }, 36e5);
    if (this.users <= 0 && this.poller) { clearInterval(this.poller); this.poller = null; this.users = 0; }
  };
  /* where the rate of a currency comes from, in words the page shows */
  Rate.prototype.source = function () {
    if (ownVal(this.code) != null) return 'own';
    return this.src === 'ecb' ? 'ECB' : this.src === 'xapi' ? 'exchange-api' : this.src || '';
  };
  function rate(code) { return RT[code] || (RT[code] = new Rate(code)); }

  /* ---------------------------------------------------------------- the public surface */
  P.fx = {
    init: function (lang) { LANG = lang || LANG; },
    lang: function () { return LANG; },
    /* the currency prices are shown in: the visitor's choice, else the default for this language and time zone */
    cur: function () { return ST.c || defaultCur(LANG); },
    chosen: function () { return ST.c; },
    defaultFor: defaultCur,
    country: tzCountry,
    set: function (code) {
      if (!/^[A-Z]{3}$/.test(code)) return;
      var was = P.fx.cur(); ST.c = code; save(); if (code !== was) tell('cur', code);
    },
    /* USD: Binance's USDT pairs, nothing converted */
    plain: function (code) { return (code || P.fx.cur()) === 'USD'; },
    own: function (code) { var o = ST.own[code]; return o ? { v: o.v, per: o.per, at: o.at } : null; },
    ownVal: ownVal,
    setOwn: function (code, v, per) {
      v = +v; if (!/^[A-Z]{3}$/.test(code) || !(v > 0) || v > 1e12) return false;
      ST.own[code] = { v: v, per: per === 'USD' ? 'USD' : 'USDT', at: Date.now() }; save();
      if (per === 'USD') latest().then(function () { rate(code).notify(); }, function () { });
      rate(code).notify(); tell('rate', code); return true;
    },
    clearOwn: function (code) { if (!ST.own[code]) return; delete ST.own[code]; save(); var R = rate(code); R.ready = null; R.load().then(function () { R.notify(); }, function () { R.notify(); }); tell('rate', code); },
    usdt: function () { return USDT; },
    latest: latest,
    rate: rate,
    name: name,
    symbol: symbol,
    digits: digits,
    prec: prec,
    flag: flag,
    bcp: bcp,
    on: function (f) { LISTENERS.push(f); return function () { var i = LISTENERS.indexOf(f); if (i >= 0) LISTENERS.splice(i, 1); }; },
    /* other tabs of this browser changed the currency or a rate: follow them */
    reload: function () {
      var was = P.fx.cur(), old = JSON.stringify(ST.own); ST = sane(S ? S.get(KEY, null) : null);
      if (P.fx.cur() !== was) tell('cur', P.fx.cur());
      if (JSON.stringify(ST.own) !== old) Object.keys(RT).forEach(function (k) { RT[k].ready = null; RT[k].load().then(function () { RT[k].notify(); }, function () { RT[k].notify(); }); tell('rate', k); });
    }
  };
  addEventListener('storage', function (e) { if (e.key === KEY) P.fx.reload(); });
})();
