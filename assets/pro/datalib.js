/* entekhab.net — /market/ data library: where to get free historical market data, and the tools to read it.
   Every entry was opened and its free tier and terms read on the date in CHECKED. Entries whose page could not be
   found or that turned out to be paid were left out. The licence column says what the provider itself states;
   "terms" means the provider has its own terms of use and no standard licence. Terms change: the dialog says so.
   This page links out only; nothing listed here is fetched, cached or rehosted by entekhab.net. */
(function () {
  'use strict';
  var P = window.PRO = window.PRO || {};
  var CHECKED = '2026-11-27';
  /* id, category, name, address, licence as stated by the provider */
  var L = P.DATALIB = [
    ['binv', 'crypto', 'Binance Public Data', 'https://data.binance.vision/', 'CC BY-NC-SA 4.0'],
    ['cdd', 'crypto', 'CryptoDataDownload', 'https://www.cryptodatadownload.com/data/', 'CC BY-NC-SA 4.0'],
    ['okx', 'crypto', 'OKX Historical Data', 'https://www.okx.com/historical-data', 'terms'],
    ['pricehub', 'crypto', 'pricehub', 'https://github.com/eslazarev/pricehub', 'MIT'],
    ['ccd', 'crypto', 'crypto-candle-dumper', 'https://github.com/Algonney/crypto-candle-dumper', 'MIT'],
    ['duka', 'fx', 'dukascopy-node', 'https://github.com/Leo4815162342/dukascopy-node', 'MIT'],
    ['histdata', 'fx', 'HistData.com', 'https://www.histdata.com/', 'none'],
    ['fx1m', 'fx', 'FX-1-Minute-Data', 'https://github.com/philipperemy/FX-1-Minute-Data', 'Apache-2.0'],
    ['truefx', 'fx', 'TrueFX', 'https://www.truefx.com/', 'terms'],
    ['evtl', 'fx', 'EV Trading Labs', 'https://evtradelabs.com/data', 'terms'],
    ['hfd', 'fut', 'historicalfuturesdata.com', 'https://historicalfuturesdata.com/', 'none'],
    ['lse', 'fut', 'London Strategic Edge', 'https://londonstrategicedge.com/data', 'terms'],
    ['stooq', 'stk', 'Stooq', 'https://stooq.com/db/h/', 'terms'],
    ['yf', 'stk', 'yfinance', 'https://github.com/ranaroussi/yfinance', 'Apache-2.0'],
    ['sifting', 'stk', 'Sifting market data export', 'https://sifting.io/tools/market-data-export', 'terms'],
    ['twelve', 'api', 'Twelve Data', 'https://twelvedata.com/pricing', 'terms'],
    ['av', 'api', 'Alpha Vantage', 'https://www.alphavantage.co/', 'terms'],
    ['finnhub', 'api', 'Finnhub', 'https://finnhub.io/', 'terms'],
    ['fred', 'macro', 'FRED', 'https://fred.stlouisfed.org/', 'terms'],
    ['kaggle', 'ds', 'Kaggle Datasets', 'https://www.kaggle.com/datasets', 'varies'],
    ['hf', 'ds', 'Hugging Face: syncster historical-market-data', 'https://huggingface.co/datasets/syncster-data/historical-market-data', 'other'],
    ['openbb', 'tool', 'OpenBB', 'https://openbb.co/', 'Apache-2.0'],
    ['tickview', 'tool', 'TickView', 'https://svopex.github.io/TickView', 'Apache-2.0'],
    ['lwc', 'tool', 'Lightweight Charts', 'https://github.com/tradingview/lightweight-charts', 'Apache-2.0'],
    ['tvcl', 'tool', 'TradingView Advanced Charts', 'https://www.tradingview.com/advanced-charts/', 'terms'],
    ['freech', 'tool', 'FreeCharting', 'https://www.freecharting.com/', 'terms'],
    ['prt', 'tool', 'ProRealTime', 'https://www.prorealtime.com/en/', 'terms'],
    ['mt5', 'tool', 'MetaTrader 5', 'https://www.metatrader5.com/', 'terms'],
    ['tickstory', 'tool', 'Tickstory', 'https://tickstory.com/', 'terms'],
    ['qdm', 'tool', 'QuantDataManager', 'https://strategyquant.com/quantdatamanager/', 'terms']
  ];
  P.DATALIB_CATS = ['crypto', 'fx', 'fut', 'stk', 'api', 'macro', 'ds', 'tool'];
  P.DATALIB_CHECKED = CHECKED;

  var A = P.app; if (!A) return;
  var T = A.T, esc = A.esc, h = A.h, $ = A.$;
  function lic(x) { return x === 'terms' ? T('dlLicTerms') : x === 'none' ? T('dlLicNone') : x === 'varies' ? T('dlLicVaries') : x === 'other' ? T('dlLicOther') : x; }

  P.dataLib = function () {
    var cat = '', box = h('<div class="pm-dl"><p class="pm-enote pm-dlnote"></p><div class="pm-dlbar"><input class="pm-in" type="search" autocomplete="off" spellcheck="false"><div class="pm-idt pm-dlcats"></div></div><div class="pm-dlist"></div>' +
      '<details class="pm-dltips"><summary></summary><ol></ol><pre dir="ltr">time,open,high,low,close,volume\n2024-01-01T00:00:00Z,100.00,101.50,99.80,101.20,2500</pre></details><p class="pm-enote pm-dlchk"></p></div>');
    $('.pm-dlnote', box).textContent = T('dlNote');
    $('.pm-dlchk', box).textContent = T('dlChecked', { d: CHECKED });
    $('summary', box).textContent = T('dlTips');
    ['dlTip1', 'dlTip2', 'dlTip3', 'dlTip4'].forEach(function (k) { var li = h('<li></li>'); li.textContent = T(k); $('ol', box).appendChild(li); });
    var inp = $('input', box), list = $('.pm-dlist', box), cats = $('.pm-dlcats', box);
    inp.placeholder = T('dlSearch');
    function chips() {
      cats.innerHTML = '';
      [''].concat(P.DATALIB_CATS).forEach(function (c) {
        var b = h('<button type="button" class="pm-chip' + (c === cat ? ' on' : '') + '"></button>');
        b.textContent = c ? T('dlc_' + c) : T('dlAll'); b.setAttribute('aria-pressed', c === cat ? 'true' : 'false');
        b.onclick = function () { cat = c; chips(); paint(); }; cats.appendChild(b);
      });
    }
    function paint() {
      var q = inp.value.trim().toLowerCase(), n = 0; list.innerHTML = '';
      P.DATALIB_CATS.forEach(function (c) {
        if (cat && cat !== c) return;
        var rows = L.filter(function (e) { return e[1] === c && (!q || (e[2] + ' ' + T('dl_' + e[0]) + ' ' + e[4]).toLowerCase().indexOf(q) >= 0); });
        if (!rows.length) return;
        var g = h('<section class="pm-dlg"><h4></h4></section>'); $('h4', g).textContent = T('dlc_' + c);
        rows.forEach(function (e) {
          n++;
          var r = h('<div class="pm-dlr"><div class="pm-dlh"><a target="_blank" rel="noopener noreferrer nofollow"></a><span class="pm-mt pm-dllic"></span></div><p></p></div>');
          var a = $('a', r); a.href = e[3]; a.textContent = e[2]; a.title = e[3].replace(/^https:\/\//, '');
          $('.pm-dllic', r).textContent = lic(e[4]); $('.pm-dllic', r).title = T('dlLic');
          $('p', r).textContent = T('dl_' + e[0]);
          g.appendChild(r);
        });
        list.appendChild(g);
      });
      if (!n) { var p = h('<p class="pm-enote"></p>'); p.textContent = T('dlNone'); list.appendChild(p); }
    }
    inp.oninput = paint; chips(); paint();
    A.modal(T('dlTitle'), box, { wide: true, nofocus: true });
  };
})();
