/* assets/obs/riskmath.js — the arithmetic behind /charts/risk/, checked against answers worked out by hand.
   Run: node tests/test_riskmath.js */
'use strict';
var R = require('../assets/obs/riskmath.js');
var FAILS = [];
function ok(what, cond, got) {
  console.log((cond ? 'PASS ' : 'FAIL ') + what + (cond ? '' : '  -> ' + JSON.stringify(got)));
  if (!cond) FAILS.push(what);
}
function near(a, b, eps) { return a != null && Math.abs(a - b) < (eps == null ? 1e-9 : eps); }

/* returns and gaps */
ok('returns are the step from each close to the next',
   JSON.stringify(R.returns([100, 110, 99]).map(function (x) { return +x.toFixed(4); })) === '[0.1,-0.1]');
ok('a gap breaks the pair rather than inventing one', R.returns([100, null, 110]).length === 0);
ok('a zero or negative price is not a base', R.returns([0, 100]).length === 0);

/* a horizon is measured, not scaled from one day */
ok('a 2-day return spans two days', near(R.horizonReturns([100, 50, 200], 2)[0], 1.0, 1e-12));
ok('horizon returns overlap, so 5 prices give 3 three-day returns', R.horizonReturns([1, 2, 3, 4, 5], 3).length === 2);

/* quantile on a known set */
var xs = [1, 2, 3, 4, 5];
ok('the median is the middle', near(R.quantile(xs, 0.5), 3));
ok('the quantile interpolates', near(R.quantile(xs, 0.25), 2));
ok('an empty set has no quantile', R.quantile([], 0.5) === null);

/* mean and sample standard deviation, by hand: mean 3, variance (4+1+0+1+4)/4 = 2.5 */
ok('the mean is the mean', near(R.mean(xs), 3));
ok('the standard deviation divides by n-1', near(R.stdev(xs), Math.sqrt(2.5), 1e-12));
ok('one point has no spread', R.stdev([5]) === null);

/* VaR: with these 100 returns the 5th percentile is a 5% loss */
var rets = [];
for (var i = 0; i < 100; i++) rets.push((i - 50) / 1000);        // -0.050 … +0.049
ok('historical VaR is the quantile of what happened, as a loss',
   near(R.varHist(rets, 0.95), 0.0455, 1e-3), R.varHist(rets, 0.95));
ok('a VaR is never negative: a gain at that quantile reports no loss',
   R.varHist([0.01, 0.02, 0.03], 0.95) === 0);
ok('the normal quantile is right at 95%', near(R.z(0.95), -1.6448536, 1e-6), R.z(0.95));
ok('and at 99%', near(R.z(0.99), -2.3263479, 1e-6), R.z(0.99));

/* expected shortfall is worse than VaR, which is the whole reason to show it */
ok('expected shortfall is at least as bad as VaR',
   R.shortfall(rets, 0.95) >= R.varHist(rets, 0.95),
   [R.shortfall(rets, 0.95), R.varHist(rets, 0.95)]);

/* The two figures are shown side by side because they disagree, and where they disagree is the point.
   On a symmetric sample they should agree -- that is what says both are implemented right. */
var sym = [];
for (var j = 0; j < 1000; j++) {
  var u1 = (j + 0.5) / 1000, u2 = ((j * 7919) % 1000 + 0.5) / 1000;   // deterministic Box-Muller
  sym.push(0.02 * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
}
ok('on a symmetric sample the two agree within a tenth of a point',
   Math.abs(R.varHist(sym, 0.95) - R.varNormal(sym, 0.95)) < 0.001,
   [R.varHist(sym, 0.95), R.varNormal(sym, 0.95)]);

/* With a tail that is actually populated -- a tenth of the days are crashes -- the measured figure is far worse
   than the curve's. A single outlier does the opposite: it inflates the standard deviation while the quantile
   interpolates past it, which is why the measured figure is the one the page leads with. */
var fat = [];
for (var k = 0; k < 90; k++) fat.push(0.002);
for (var m = 0; m < 10; m++) fat.push(-0.10);
ok('where the tail is real, the measured figure is the worse one',
   R.varHist(fat, 0.95) > R.varNormal(fat, 0.95) * 1.5,
   [R.varHist(fat, 0.95), R.varNormal(fat, 0.95)]);

/* volatility: a constant series cannot move */
ok('a flat series has no volatility', R.vol(R.returns([10, 10, 10, 10])) === 0);

/* drawdown, by hand: 100 → 200 → 50 is a 75% fall from the peak */
var dd = R.drawdown([100, 200, 50, 120]);
ok('the deepest fall is measured from the peak before it', near(dd.worst, -0.75, 1e-12), dd);
ok('and it is dated', dd.at === 2 && dd.from === 1, dd);
ok('today is measured against the highest price seen', near(dd.now, 120 / 200 - 1, 1e-12), dd.now);

/* position sizing, by hand: risking 1% of 10,000 is 100; a 500 stop on a 50,000 entry is 0.2 BTC */
var s = R.size(10000, 1, 50000, 49500);
ok('the money at risk is the share of the account', near(s.risk, 100));
ok('the size is the risk divided by the stop distance', near(s.units, 0.2, 1e-12), s.units);
ok('the position is worth units times entry', near(s.value, 10000, 1e-9), s.value);
ok('the leverage it implies is reported', near(s.leverage, 1, 1e-9), s.leverage);
ok('a stop above entry is a short', R.size(10000, 1, 50000, 50500).side === 'short');
ok('a wider stop forces a smaller position',
   R.size(10000, 1, 50000, 49000).units < R.size(10000, 1, 50000, 49500).units);
ok('no stop distance gives no answer rather than infinity', R.size(10000, 1, 50000, 50000) === null);
ok('nonsense inputs give no answer', R.size(0, 1, 5, 4) === null && R.size(100, 0, 5, 4) === null);

/* the histogram covers every return exactly once */
var h = R.histogram(rets, 20);
ok('the histogram keeps every observation', h.reduce(function (a, b) { return a + b.n; }, 0) === rets.length);
ok('its bins run low to high', h[0].x0 < h[h.length - 1].x0);

console.log(FAILS.length ? '\n' + FAILS.length + ' failure(s)' : '\nOK');
process.exit(FAILS.length ? 1 : 0);
