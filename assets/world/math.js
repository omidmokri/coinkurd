/* entekhab.net /world/ — the counters' arithmetic, pure (no DOM): the page uses it as WL.M, the tests run it in node and
   compare it with scripts/world_data.py (tests/test_world_data.py). Change one, change the other. */
(function (root) {
  'use strict';
  var M = {};
  var HALVING = 210000, COIN = 1e8;

  /* a yearly total spread evenly over the visitor's calendar year: [this year, today] at the Date `now` (local clock) */
  M.flow = function (perYear, now) {
    var y = now.getFullYear();
    var y0 = new Date(y, 0, 1), y1 = new Date(y + 1, 0, 1), d0 = new Date(y, now.getMonth(), now.getDate());
    var yl = (y1 - y0) / 1000;
    return [perYear * ((now - y0) / 1000) / yl, perYear / (yl / 86400) * ((now - d0) / 1000) / 86400];
  };
  /* per second at that pace */
  M.perSec = function (perYear, now) {
    var y = now.getFullYear();
    return perYear / ((new Date(y + 1, 0, 1) - new Date(y, 0, 1)) / 1000);
  };
  /* a level at an epoch that changes by perYear (mean Gregorian year) */
  M.stock = function (base, epochIso, perYear, now) {
    return base + perYear * ((now - Date.parse(epochIso)) / 1000) / (365.2425 * 86400);
  };

  /* Bitcoin: the subsidy schedule (consensus: 50 BTC, halved every 210 000 blocks — a right shift, done here as a floor
     division because JS shifts are 32-bit) */
  M.subsidySat = function (h) { var e = Math.floor(h / HALVING); return e >= 64 ? 0 : Math.floor(50 * COIN / Math.pow(2, e)); };
  M.issuedSat = function (a, b) {
    if (b < a) return 0;
    var tot = 0, h = a;
    while (h <= b) {
      var end = Math.min(b, (Math.floor(h / HALVING) + 1) * HALVING - 1);
      tot += (end - h + 1) * M.subsidySat(h);
      h = end + 1;
    }
    return tot;
  };
  M.supplySat = function (tip) { return M.issuedSat(0, tip); };
  M.nextHalving = function (tip) { return (Math.floor(tip / HALVING) + 1) * HALVING; };
  M.COIN = COIN;
  M.CAP_SAT = M.issuedSat(0, 64 * HALVING - 1);          /* 2 099 999 997 690 000 sat: the real cap, a hair under 21 M */

  /* US debt between official figures: the last figure, then the average pace before it. The Treasury's figure is the
     close of that business day; it is placed at 21:00 UTC (≈ 4 pm in Washington) */
  M.debt = function (d, now) {
    if (!d || !(d.v > 0) || !isFinite(d.rate) || !d.d) return null;
    var t0 = Date.parse(d.d + 'T21:00:00Z');
    return d.v + d.rate * Math.max(0, (now - t0) / 1000);
  };

  if (typeof module === 'object' && module.exports) module.exports = M; else (root.WL = root.WL || {}).M = M;
})(this);
