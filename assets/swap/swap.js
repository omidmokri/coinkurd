/* entekhab.net — /swap/  (the swap engine)
 *
 * What it does: asks LI.FI (https://li.quest) for a route and a ready-made transaction, shows the reader exactly what
 * they would be signing, and hands that transaction to their own wallet. Nothing else.
 *
 * The rules this file keeps, which tests/test_swap.js pins:
 *   • one outside host. Every request this file makes goes to https://li.quest; the page's policy allows no other
 *     host at all (pictures, fonts and the site's own scripts come from entekhab.net).
 *   • the transaction is never built here. `to`, `data` and `value` come from LI.FI's answer and are checked field by
 *     field against what the reader asked for (chain, both tokens, the amount, their own address, the contract pinned
 *     for that chain) before the wallet is opened — and the wallet's chain and account are asked for again right
 *     before sending. One mismatch and nothing is signed.
 *   • nothing that came back from the service or the chain is ever written as markup: textContent only. Token names
 *     are written by whoever created the token.
 *   • amounts are integers (BigInt) from the first character to the last. No floating point touches a balance.
 *   • approvals are for the exact amount of this one swap, never unlimited.
 *   • a price older than a minute is fetched again before it can be signed; a swap that would lose a large share of
 *     its value, or that involves a token LI.FI has not verified, needs a deliberate tick first.
 *   • every number and address on the page is marked translate="no", so the site's translation layers can re-word
 *     labels but can never touch an amount.
 *   • nothing about the reader is stored: no cookie, no address kept, nothing but the chosen site language.
 *
 * Tests: node tests/test_swap.js · python3 tests/test_swap.py
 */
(function (root) {
  'use strict';

  var LIFI = 'https://li.quest';
  var ZERO = '0x0000000000000000000000000000000000000000';
  var MAX_FEE = 0.03;            // the most of a swap this site would ever take
  var MAX_SLIP = 0.05;           // and the most price movement a reader may accept
  var TIMEOUT = 25000;
  var ERC20 = { allowance: '0xdd62ed3e', approve: '0x095ea7b3', balanceOf: '0x70a08231' };

  /* ------------------------------------------------------------------ text */
  var T = {
    fa: {
      noWallet: 'کیف پولی در این مرورگر پیدا نشد. این صفحه را در مرورگر داخلی کیف پول خود (متامسک، تراست ولت، سیف‌پل…) باز کنید.',
      connect: 'اتصال کیف پول', connecting: 'در حال اتصال…', rejected: 'درخواست در کیف پول رد شد.',
      switchChain: 'تغییر شبکهٔ کیف پول', switching: 'در انتظار کیف پول…',
      switchHint: 'کیف پول جواب نداد. شبکه را در خود کیف پول عوض کنید.',
      amount: 'مبلغ را وارد کنید', quoting: 'در حال گرفتن بهترین قیمت…', noRoute: 'برای این مبلغ مسیری پیدا نشد.',
      lowBalance: 'موجودی شما کمتر از این مبلغ است.', approve: 'اجازهٔ برداشت توکن', approving: 'در انتظار تأیید در کیف پول…',
      swap: 'تبدیل', swapping: 'در انتظار امضا در کیف پول…', done: 'تبدیل انجام شد.',
      failed: 'تراکنش ناموفق بود.', watching: 'در حال پیگیری تراکنش…', view: 'دیدن تراکنش',
      mismatch: 'پاسخ سرویس با درخواست شما یکی نیست؛ چیزی امضا نشد.', offline: 'سرویس قیمت در دسترس نیست.',
      busyService: 'سرویس قیمت شلوغ است؛ چند لحظهٔ دیگر دوباره تلاش کنید.',
      badToken: 'این توکن روی این شبکه پیدا نشد.', searching: 'در حال جست‌وجوی توکن…',
      unverified: 'این توکن را LI.FI تأیید نکرده است. نشانی قرارداد را خودتان بررسی کنید.',
      needAmount: 'مبلغ معتبر نیست.', same: 'مبدأ و مقصد یکی است.',
      refreshed: 'قیمت قدیمی شده بود و تازه شد. دوباره بررسی و تأیید کنید.',
      chainMoved: 'شبکه یا حساب کیف پول عوض شده است؛ چیزی امضا نشد.',
      chainUnknown: 'نتوانستم شبکهٔ کیف پول را تأیید کنم؛ چیزی امضا نشد. دوباره تلاش کنید.',
      ackNeeded: 'برای ادامه، تیک تأیید را بزنید.',
      impactHigh: 'این تبدیل بخش بزرگی از ارزش را از دست می‌دهد.',
      bridging: 'در راه شبکهٔ مقصد…', arrived: 'به شبکهٔ مقصد رسید.', bridgeFailed: 'انتقال بین شبکه‌ها ناموفق بود؛ با شناسهٔ تراکنش پیگیری کنید.',
      viewDest: 'تراکنش مقصد', pickChain: 'انتخاب شبکه', pickToken: 'انتخاب توکن', nothing: 'چیزی پیدا نشد.',
      findOnChain: 'جست‌وجو روی شبکه', balance: 'موجودی'
    },
    ckb: {
      noWallet: 'هیچ جزدانێک لەم وێبگەڕەدا نەدۆزرایەوە. ئەم پەڕەیە لە وێبگەڕی ناوەوەی جزدانەکەت (مێتاماسک، تراست وۆلێت، سەیفپاڵ…) بکەرەوە.',
      connect: 'بەستنەوەی جزدان', connecting: 'لە بەستنەوەدا…', rejected: 'داواکارییەکە لە جزدانەکەدا ڕەتکرایەوە.',
      switchChain: 'گۆڕینی تۆڕی جزدان', switching: 'چاوەڕێی جزدان…',
      switchHint: 'جزدانەکە وەڵامی نەدایەوە. تۆڕەکە لەناو خودی جزدانەکەدا بگۆڕە.',
      amount: 'بڕەکە بنووسە', quoting: 'لە وەرگرتنی باشترین نرخدا…', noRoute: 'بۆ ئەم بڕە ڕێگایەک نەدۆزرایەوە.',
      lowBalance: 'پارەی ناو جزدانەکەت لەم بڕە کەمترە.', approve: 'ڕێپێدانی دەرهێنانی تۆکن', approving: 'چاوەڕێی پشتڕاستکردنەوە لە جزدان…',
      swap: 'گۆڕینەوە', swapping: 'چاوەڕێی واژۆ لە جزدان…', done: 'گۆڕینەوەکە ئەنجامدرا.',
      failed: 'مامەڵەکە سەرکەوتوو نەبوو.', watching: 'لە شوێنکەوتنی مامەڵەکەدا…', view: 'بینینی مامەڵە',
      mismatch: 'وەڵامی خزمەتگوزارییەکە لەگەڵ داواکارییەکەت یەک ناگرێتەوە؛ هیچ واژۆ نەکرا.', offline: 'خزمەتگوزاریی نرخ بەردەست نییە.',
      busyService: 'خزمەتگوزاریی نرخ قەرەباڵغە؛ چەند ساتێکی تر دووبارە هەوڵ بدەرەوە.',
      badToken: 'ئەم تۆکنە لەسەر ئەم تۆڕە نەدۆزرایەوە.', searching: 'لە گەڕان بەدوای تۆکندا…',
      unverified: 'ئەم تۆکنە لەلایەن LI.FI پشتڕاست نەکراوەتەوە. ناونیشانی گرێبەستەکە خۆت بپشکنە.',
      needAmount: 'بڕەکە دروست نییە.', same: 'سەرچاوە و مەبەست یەکن.',
      refreshed: 'نرخەکە کۆن بووبوو و نوێ کرایەوە. دووبارە بیپشکنە و پشتڕاستی بکەرەوە.',
      chainMoved: 'تۆڕ یان هەژماری جزدانەکە گۆڕاوە؛ هیچ واژۆ نەکرا.',
      chainUnknown: 'نەمتوانی تۆڕی جزدانەکە پشتڕاست بکەمەوە؛ هیچ واژۆ نەکرا. دووبارە هەوڵ بدەرەوە.',
      ackNeeded: 'بۆ بەردەوامبوون، نیشانەی پشتڕاستکردنەوە بدە.',
      impactHigh: 'ئەم گۆڕینەوەیە بەشێکی گەورەی بەهاکە لەدەست دەدات.',
      bridging: 'لە ڕێگای تۆڕی مەبەستدایە…', arrived: 'گەیشتە تۆڕی مەبەست.', bridgeFailed: 'گواستنەوەی نێوان تۆڕەکان سەرکەوتوو نەبوو؛ بە ناسنامەی مامەڵەکە بەدوایدا بچۆ.',
      viewDest: 'مامەڵەی مەبەست', pickChain: 'هەڵبژاردنی تۆڕ', pickToken: 'هەڵبژاردنی تۆکن', nothing: 'هیچ نەدۆزرایەوە.',
      findOnChain: 'گەڕان لەسەر تۆڕ', balance: 'ماوە'
    },
    en: {
      noWallet: 'No wallet found in this browser. Open this page in the browser inside your wallet (MetaMask, Trust Wallet, SafePal…).',
      connect: 'Connect wallet', connecting: 'Connecting…', rejected: 'The request was rejected in the wallet.',
      switchChain: 'Switch the wallet’s network', switching: 'Waiting for the wallet…',
      switchHint: 'The wallet did not answer. Switch the network inside the wallet itself.',
      amount: 'Enter an amount', quoting: 'Finding the best price…', noRoute: 'No route found for this amount.',
      lowBalance: 'Your balance is lower than this amount.', approve: 'Approve token', approving: 'Waiting for approval in the wallet…',
      swap: 'Swap', swapping: 'Waiting for the signature in the wallet…', done: 'Swap complete.',
      failed: 'The transaction failed.', watching: 'Following the transaction…', view: 'View transaction',
      mismatch: 'The answer from the service does not match your request; nothing was signed.', offline: 'The price service is unreachable.',
      busyService: 'The price service is busy; try again in a moment.',
      badToken: 'That token was not found on this network.', searching: 'Looking the token up…',
      unverified: 'LI.FI has not verified this token. Check the contract address yourself.',
      needAmount: 'That amount is not valid.', same: 'The source and the destination are the same.',
      refreshed: 'The price had gone stale and was fetched again. Check it and confirm once more.',
      chainMoved: 'The wallet’s network or account has changed; nothing was signed.',
      chainUnknown: 'The wallet’s network could not be confirmed; nothing was signed. Try again.',
      ackNeeded: 'Tick the confirmation box to continue.',
      impactHigh: 'This swap loses a large share of its value.',
      bridging: 'On its way to the destination network…', arrived: 'Arrived on the destination network.', bridgeFailed: 'The transfer between networks failed; follow it up with the transaction id.',
      viewDest: 'Destination transaction', pickChain: 'Choose a network', pickToken: 'Choose a token', nothing: 'Nothing found.',
      findOnChain: 'Search on the network', balance: 'Balance'
    }
  };
  var lang = 'fa';
  function t(k) { return (T[lang] || T.fa)[k] || (T.en[k] || k); }

  /* ------------------------------------------------------------------ small helpers */
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function isAddr(a) { return typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a); }
  function sameAddr(a, b) { return isAddr(a) && isAddr(b) && a.toLowerCase() === b.toLowerCase(); }
  function isHexData(s) { return typeof s === 'string' && /^0x([0-9a-fA-F]{2})*$/.test(s) && s.length >= 10; }
  function isQty(s) { return typeof s === 'string' && /^0x[0-9a-fA-F]+$/.test(s); }
  function isUint(s) { return typeof s === 'string' && /^[0-9]+$/.test(s); }
  function pad32(h) { h = String(h).replace(/^0x/, '').toLowerCase(); return new Array(65 - h.length).join('0') + h; }
  function qty(v) { return '0x' + v.toString(16); }

  /* a decimal the reader typed -> the integer the chain counts in. No floats: the string is cut up by hand. */
  function parseUnits(s, dec) {
    if (typeof s !== 'string' || !/^[0-9]*\.?[0-9]*$/.test(s) || s === '' || s === '.') { return null; }
    var p = s.split('.'), whole = p[0] || '0', frac = p[1] || '';
    var cut = frac.length > dec;
    frac = frac.slice(0, dec);
    while (frac.length < dec) { frac += '0'; }
    var v;
    try { v = BigInt(whole + frac); } catch (e) { return null; }
    return { v: v, cut: cut };
  }

  /* the integer back to something a person reads; `max` significant decimals, trailing zeros dropped */
  function formatUnits(v, dec, max) {
    if (typeof v === 'string') { if (!isUint(v)) { return '—'; } v = BigInt(v); }
    var neg = v < 0n; if (neg) { v = -v; }
    var s = v.toString();
    while (s.length <= dec) { s = '0' + s; }
    var whole = s.slice(0, s.length - dec), frac = dec ? s.slice(s.length - dec) : '';
    if (max !== undefined && frac.length > max) { frac = frac.slice(0, max); }
    frac = frac.replace(/0+$/, '');
    whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + whole + (frac ? '.' + frac : '');
  }

  function short(a) { return typeof a === 'string' && a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }

  /* ------------------------------------------------------------------ the price service */
  function api(path, params) {
    var u = LIFI + path, first = true, k;
    for (k in params) {
      if (!own(params, k) || params[k] === undefined || params[k] === null || params[k] === '') { continue; }
      u += (first ? '?' : '&') + encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]));
      first = false;
    }
    if (u.indexOf(LIFI + '/') !== 0) { return Promise.reject(new Error('bad path')); }   // belt and braces
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) { ctl.abort(); } }, TIMEOUT);
    return fetch(u, { method: 'GET', signal: ctl ? ctl.signal : undefined, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
      .then(function (r) { return r.text().then(function (txt) { return { ok: r.ok, status: r.status, txt: txt }; }); })
      .then(function (r) {
        var j = null;
        try { j = JSON.parse(r.txt); } catch (e) { j = null; }
        if (!r.ok || !plain(j)) {
          var e2 = new Error((plain(j) && typeof j.message === 'string' ? j.message : 'HTTP ' + r.status).slice(0, 200));
          e2.status = r.status; throw e2;
        }
        return j;
      })
      .then(function (j) { clearTimeout(timer); return j; }, function (e) { clearTimeout(timer); throw e; });
  }

  function lookupToken(chain, token) {
    return api('/v1/token', { chain: chain, token: token }).then(function (j) {
      if (!plain(j) || !isAddr(j.address) || typeof j.decimals !== 'number' || j.decimals < 0 || j.decimals > 36) { throw new Error('bad token'); }
      return { address: j.address, decimals: j.decimals, symbol: String(j.symbol || '').slice(0, 16),
               name: String(j.name || '').slice(0, 40), verified: j.verificationStatus === 'verified' };
    });
  }

  function quote(req, cfg) {
    return api('/v1/quote', {
      fromChain: req.fromChain, toChain: req.toChain, fromToken: req.fromToken, toToken: req.toToken,
      fromAmount: req.fromAmount, fromAddress: req.account, toAddress: req.account,
      slippage: req.slippage, integrator: cfg.integrator || undefined, fee: cfg.fee || undefined
    });
  }

  /* ------------------------------------------------------------------ is this answer really our request?
   * Everything the wallet would be asked to sign is checked here. Anything off and the swap stops. */
  function checkQuote(q, req) {
    if (!plain(q) || !plain(q.action) || !plain(q.estimate) || !plain(q.transactionRequest)) { return 'shape'; }
    var a = q.action, e = q.estimate, x = q.transactionRequest;
    if (Number(a.fromChainId) !== Number(req.fromChain)) { return 'fromChain'; }
    if (Number(a.toChainId) !== Number(req.toChain)) { return 'toChain'; }
    if (!plain(a.fromToken) || !sameAddr(a.fromToken.address, req.fromToken)) { return 'fromToken'; }
    if (!plain(a.toToken) || !sameAddr(a.toToken.address, req.toToken)) { return 'toToken'; }
    if (String(a.fromAmount) !== String(req.fromAmount)) { return 'fromAmount'; }
    if (!sameAddr(a.fromAddress, req.account)) { return 'fromAddress'; }
    if (!sameAddr(a.toAddress, req.account)) { return 'toAddress'; }
    if (!isUint(String(e.toAmount)) || !isUint(String(e.toAmountMin))) { return 'toAmount'; }
    if (BigInt(e.toAmountMin) > BigInt(e.toAmount)) { return 'toAmountMin'; }
    if (BigInt(e.toAmount) <= 0n) { return 'empty'; }
    if (!isAddr(x.to)) { return 'to'; }
    /* the transaction must be addressed to LI.FI's own contract for this chain and nowhere else. The address is kept
       in scripts/swap_chains.json, read from LI.FI's own /v1/chains. If they ever move it the swap stops here. */
    if (!sameAddr(x.to, req.contract)) { return 'contract'; }
    if (!isHexData(x.data)) { return 'data'; }
    if (x.data.length > 400000) { return 'dataSize'; }                 /* no route needs call data this large */
    /* the decimals the page will count in must be the token's own, or every figure shown would be wrong */
    if (req.fromDecimals !== undefined && Number(a.fromToken.decimals) !== Number(req.fromDecimals)) { return 'fromDecimals'; }
    if (req.toDecimals !== undefined && Number(a.toToken.decimals) !== Number(req.toDecimals)) { return 'toDecimals'; }
    if (!isQty(x.value)) { return 'value'; }
    if (Number(x.chainId) !== Number(req.fromChain)) { return 'txChain'; }
    if (!sameAddr(x.from, req.account)) { return 'txFrom'; }
    /* a swap that starts from the chain's own coin must send exactly that much with the call; a token swap sends none */
    if (sameAddr(req.fromToken, ZERO)) {
      if (BigInt(x.value) !== BigInt(req.fromAmount)) { return 'nativeValue'; }
    } else if (BigInt(x.value) !== 0n) { return 'tokenValue'; }
    if (!sameAddr(req.fromToken, ZERO) && !sameAddr(e.approvalAddress, req.contract)) { return 'approvalAddress'; }
    return null;
  }

  /* ------------------------------------------------------------------ the wallet */
  var W = {
    p: null, account: '', chainId: 0,
    find: function (win) {
      var w = win || root, e = w.ethereum;
      if (!e) { return null; }
      if (Array.isArray(e.providers) && e.providers.length) { return e.providers[0]; }
      return e;
    },
    req: function (method, params) {
      if (!this.p) { return Promise.reject(new Error('no wallet')); }
      return this.p.request({ method: method, params: params || [] });
    },
    /* Ask for the address the quiet way first: a wallet that already allowed this site answers eth_accounts with no
       pop-up at all. Only a wallet that has never allowed it is asked, which is the one case that needs a pop-up.
       (SafePal leaves eth_requestAccounts unanswered when the site is already allowed, which used to hang here.) */
    connect: function () {
      var self = this;
      return this.req('eth_accounts').catch(function () { return []; }).then(function (have) {
        if (have && have.length && isAddr(have[0])) { return have; }
        return self.req('eth_requestAccounts');
      }).then(function (acc) {
        if (!acc || !acc.length || !isAddr(acc[0])) { throw new Error('no account'); }
        self.account = acc[0];
        return self.req('eth_chainId');
      }).then(function (id) { self.chainId = parseInt(id, 16) || 0; return self.account; });
    },
    switchChain: function (chain) {
      var self = this;
      return this.req('wallet_switchEthereumChain', [{ chainId: qty(BigInt(chain.id)) }])
        .catch(function (err) {
          if (err && (err.code === 4902 || err.code === -32603)) {       // the wallet does not know this chain yet
            return self.req('wallet_addEthereumChain', [{
              chainId: qty(BigInt(chain.id)), chainName: chain.name,
              nativeCurrency: { name: chain.coin, symbol: chain.coin, decimals: 18 },
              rpcUrls: [chain.rpc], blockExplorerUrls: [chain.explorer]
            }]);
          }
          throw err;
        })
        .then(function () { return self.req('eth_chainId'); })
        .then(function (id) { self.chainId = parseInt(id, 16) || 0; return self.chainId; });
    },
    call: function (to, data) { return this.req('eth_call', [{ to: to, data: data }, 'latest']); },
    balance: function (token, owner) {
      if (sameAddr(token, ZERO)) { return this.req('eth_getBalance', [owner, 'latest']).then(hexToBig); }
      return this.call(token, ERC20.balanceOf + pad32(owner)).then(hexToBig);
    },
    allowance: function (token, owner, spender) {
      return this.call(token, ERC20.allowance + pad32(owner) + pad32(spender)).then(hexToBig);
    },
    send: function (tx) { return this.req('eth_sendTransaction', [tx]); },
    receipt: function (hash) { return this.req('eth_getTransactionReceipt', [hash]); }
  };

  function hexToBig(h) { return isQty(h) ? BigInt(h) : 0n; }

  /* A wallet extension can drop a request and never answer it — SafePal's message channel closes mid-flight and the
     promise simply never settles. Anything we only *read* from the wallet is given a deadline, after which the page
     carries on without it rather than waiting for ever. */
  function within(p, ms, fallback) {
    return new Promise(function (res) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; res(fallback); } }, ms);
      p.then(function (v) { if (!done) { done = true; clearTimeout(timer); res(v); } },
             function () { if (!done) { done = true; clearTimeout(timer); res(fallback); } });
    });
  }

  /* wait for a transaction to be mined, by asking the wallet (no node of our own is contacted) */
  function waitFor(hash, tries) {
    tries = tries === undefined ? 90 : tries;
    return W.receipt(hash).then(function (r) {
      if (r && r.status !== undefined && r.status !== null) { return parseInt(r.status, 16) === 1; }
      if (tries <= 0) { return null; }
      return new Promise(function (res) { setTimeout(res, 4000); }).then(function () { return waitFor(hash, tries - 1); });
    }, function () { return tries <= 0 ? null : new Promise(function (res) { setTimeout(res, 4000); }).then(function () { return waitFor(hash, tries - 1); }); });
  }

  var api_ = { LIFI: LIFI, ZERO: ZERO, MAX_FEE: MAX_FEE, MAX_SLIP: MAX_SLIP, T: T,
    parseUnits: parseUnits, formatUnits: formatUnits, isAddr: isAddr, sameAddr: sameAddr, isHexData: isHexData,
    isQty: isQty, pad32: pad32, qty: qty, short: short, checkQuote: checkQuote, api: api, quote: quote,
    lookupToken: lookupToken, W: W, waitFor: waitFor, ERC20: ERC20, within: within,
    setLang: function (l) { lang = own(T, l) ? l : 'fa'; }, t: t };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api_; }

  /* ================================================================== the page */
  var QUOTE_LIFE = 60000;        /* a price older than this is fetched again before it can be signed */
  var WAIT = 9000;               /* how long a wallet gets to answer a question before the page moves on without it */
  var IMPACT_WARN = 3, IMPACT_ACK = 15;     /* % of value lost: warn / demand a tick */
  var GAS_CAP = 30000000n;       /* a gas limit above a whole block is not passed on */
  var ICON = /^[ct]\/[a-z0-9-]{1,32}\.(?:svg|webp)$/;

  function start(win) {
    var doc = win.document, de = doc.documentElement;
    var $ = function (id) { return doc.getElementById(id); };
    var box = $('sw-app');
    if (!box) { return 'nobox'; }
    var state = function (s) { box.setAttribute('data-s', s); return s; };

    /* ---- language, by the site's own contract (see scripts/build_pages.py LANG_JS): this page translates itself
       between Persian, Sorani and English and answers the header's buttons; Arabic and the other languages are the
       site's layers over the English copy. */
    var l0 = 'fa';
    try { var v0 = win.localStorage.getItem('ck_lang'); if (v0 === 'ckb' || v0 === 'en' || v0 === 'fa') { l0 = v0; } } catch (e) { }
    var live = false;
    function ap(l) {
      if (l !== 'fa' && l !== 'ckb' && l !== 'en') { return; }
      lang = l;
      try { win.localStorage.setItem('ck_lang', l); } catch (e) { }
      de.setAttribute('lang', l); de.setAttribute('dir', l === 'en' ? 'ltr' : 'rtl');
      var all = doc.querySelectorAll('[data-lang]');
      for (var i = 0; i < all.length; i++) {
        var id = all[i].getAttribute('id');
        if (id === 'ekh' || id === 'ekf' || id === 'ekb') { continue; }
        all[i].hidden = all[i].getAttribute('data-lang') !== l;
      }
      try { win.dispatchEvent(new win.CustomEvent('ek-lang', { detail: l })); } catch (e) { }
      if (live) { labels(); paint(); }
    }
    win.I18N = 1; win.EKSET = ap; win.EKL = function () { return lang; };
    win.__ekAsk = 1;             /* the site's chat assistant talks to another host; it has no place on a wallet page */
    /* the header's live Bitcoin price is a socket to Binance (assets/live.js, loaded by nx.js unless this exists).
       Here the header keeps the site's last recorded price instead: this page connects to nobody but the price service. */
    if (!win.liveRefresh) { win.liveRefresh = function () { }; }
    if (doc.addEventListener) {
      doc.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest && ev.target.closest('#langs button[data-l],.ek-lang button[data-l]');
        if (!b) { return; }
        var k = b.getAttribute('data-l');
        if (k !== 'fa' && k !== 'ckb' && k !== 'en') { return; }
        ev.preventDefault(); ev.stopPropagation(); ap(k);
      }, true);
    }
    ap(l0);

    if (frameCheck(win)) { return state('framed'); }

    var raw = null, data = null;
    try { raw = JSON.parse(box.getAttribute('data-c') || 'null'); } catch (e) { raw = null; }
    try { data = JSON.parse(box.getAttribute('data-d') || 'null'); } catch (e) { data = null; }
    var cfg = config(raw);
    if (!cfg || !plain(data) || !Array.isArray(data.chains) || !data.chains.length || !plain(data.tokens)) { return state('off'); }
    state('on');

    var S = {               /* everything the page knows right now */
      from: { chain: data.chains[0].id, token: null }, to: { chain: data.chains[0].id, token: null, second: true },
      amount: '', slip: cfg.slippage, q: null, qreq: null, qt: 0, err: '', note: '', busy: '', seq: 0, bal: null,
      need: null, ack: false, impact: null, done: false, pick: null
    };

    var el = {};
    ['fc', 'fc-i', 'fc-n', 'ft', 'ft-i', 'ft-n', 'tc', 'tc-i', 'tc-n', 'tt', 'tt-i', 'tt-n', 'amount', 'max', 'balance',
      'from-usd', 'to-usd', 'flip', 'receive', 'quote', 'rate', 'min', 'route', 'gas', 'fee', 'time', 'impact', 'slip',
      'tokenwarn', 'ackbox', 'ack', 'account', 'action', 'action-l', 'action-x', 'msg', 'status', 'dlg', 'dlg-title',
      'dlg-q', 'dlg-list', 'dlg-find', 'dlg-close'].forEach(function (k) { el[k] = $('sw-' + k); });
    for (var k0 in el) { if (own(el, k0) && !el[k0]) { return state('off'); } }      /* a page missing a part does not half-work */

    function chainById(id) {
      for (var i = 0; i < data.chains.length; i++) { if (Number(data.chains[i].id) === Number(id)) { return data.chains[i]; } }
      return null;
    }
    function listFor(id) { return data.tokens[String(id)] || []; }

    /* a picture from this site's own folder, or a letter badge. The file name is checked: data can not point elsewhere. */
    function icon(holder, key, word) {
      holder.textContent = '';
      if (typeof key === 'string' && ICON.test(key)) {
        var im = doc.createElement('img');
        im.setAttribute('src', '/assets/swap/ic/' + key); im.setAttribute('alt', '');
        im.setAttribute('width', '28'); im.setAttribute('height', '28'); im.setAttribute('loading', 'lazy'); im.setAttribute('decoding', 'async');
        holder.appendChild(im); holder.setAttribute('data-badge', '0');
      } else {
        holder.textContent = String(word || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || '?';
        holder.setAttribute('data-badge', '1');
      }
    }
    /* a looked-up token wears a known picture only if LI.FI verified it; an unverified one never borrows a logo */
    var bySymbol = {};
    (function () {
      for (var c in data.tokens) { if (own(data.tokens, c)) { data.tokens[c].forEach(function (tk) { var s = String(tk.symbol).toLowerCase(); if (tk.ic && !bySymbol[s]) { bySymbol[s] = tk.ic; } }); } }
    })();

    function pickDefault(side) {
      var list = listFor(side.chain);
      var want = side.second && list.length > 1 ? 1 : 0;           /* the two sides never open on the same token */
      side.token = list.length ? list[want] : null;
    }

    /* ---- the four buttons that say where from and where to */
    function labels() {
      var fc = chainById(S.from.chain), tc = chainById(S.to.chain);
      icon(el['fc-i'], fc && fc.ic, fc && fc.name); el['fc-n'].textContent = fc ? fc.name : '';
      icon(el['tc-i'], tc && tc.ic, tc && tc.name); el['tc-n'].textContent = tc ? tc.name : '';
      var ft = S.from.token, tt = S.to.token;
      icon(el['ft-i'], ft && ft.ic, ft && ft.symbol); el['ft-n'].textContent = ft ? ft.symbol : '—';
      icon(el['tt-i'], tt && tt.ic, tt && tt.symbol); el['tt-n'].textContent = tt ? tt.symbol : '—';
    }

    function needsAck() {
      var unv = (S.from.token && S.from.token.verified === false) || (S.to.token && S.to.token.verified === false);
      return !!S.q && (unv || (S.impact !== null && S.impact >= IMPACT_ACK));
    }

    /* ---- what the main button says and does */
    function paint() {
      var fromChain = chainById(S.from.chain), need, label, extra = '', dis = true;
      var unv = (S.from.token && S.from.token.verified === false) || (S.to.token && S.to.token.verified === false);
      el.msg.textContent = S.err || S.note || (S.done ? t('done') : '');
      el.msg.setAttribute('data-ok', S.err ? '' : (S.done && !S.note ? '1' : ''));
      el.account.textContent = W.account ? short(W.account) : '';
      el.balance.textContent = S.bal === null || !S.from.token ? '' : formatUnits(S.bal, S.from.token.decimals, 6) + ' ' + S.from.token.symbol;
      el.tokenwarn.textContent = unv ? t('unverified') : (S.q && S.impact !== null && S.impact >= IMPACT_WARN ? t('impactHigh') : '');
      el.ackbox.hidden = !needsAck();

      if (S.busy) { label = S.busy; need = 'busy'; }
      else if (!W.p) { label = t('connect'); dis = false; need = 'nowallet'; }
      else if (!W.account) { label = t('connect'); dis = false; need = 'connect'; }
      else if (fromChain && Number(W.chainId) !== Number(fromChain.id)) { label = t('switchChain'); extra = fromChain.name; dis = false; need = 'chain'; }
      else if (!S.amount) { label = t('amount'); need = 'amount'; }
      else if (S.q && needsAck() && !S.ack) { label = t('ackNeeded'); need = 'ack'; }
      else if (S.q && S.need === 'approve') { label = t('approve'); extra = S.from.token ? S.from.token.symbol : ''; dis = false; need = 'approve'; }
      else if (S.q) { label = t('swap'); dis = false; need = 'swap'; }
      else { label = t('amount'); need = 'none'; }

      el['action-l'].textContent = label; el['action-x'].textContent = extra;
      el.action.disabled = dis;
      el.action.setAttribute('data-need', need);
      el.quote.setAttribute('data-has', S.q ? '1' : '0');
      var bs = el.slip.querySelectorAll ? el.slip.querySelectorAll('[data-slip]') : [];
      for (var i = 0; i < bs.length; i++) { bs[i].setAttribute('aria-pressed', Number(bs[i].getAttribute('data-slip')) === S.slip ? 'true' : 'false'); }
    }

    function usd(v) { var n = Number(v); return isFinite(n) && n > 0 ? '$' + (n >= 1000 ? n.toFixed(0) : n.toFixed(2)) : ''; }

    function showQuote(q) {
      var names = ['receive', 'to-usd', 'from-usd', 'rate', 'min', 'route', 'gas', 'fee', 'time', 'impact'];
      S.impact = null;
      if (!q) { names.forEach(function (n) { el[n].textContent = ''; }); el.impact.setAttribute('data-level', ''); return; }
      var ft = S.from.token, tt = S.to.token, e = q.estimate;
      el.receive.textContent = formatUnits(e.toAmount, tt.decimals, 8);
      el.min.textContent = formatUnits(e.toAmountMin, tt.decimals, 8) + ' ' + tt.symbol;
      el['from-usd'].textContent = usd(e.fromAmountUSD); el['to-usd'].textContent = usd(e.toAmountUSD);
      /* 1 of the source token in the destination token, by whole numbers only */
      var num = BigInt(e.toAmount) * (10n ** BigInt(ft.decimals)) * 1000000n, den = BigInt(q.action.fromAmount) * (10n ** BigInt(tt.decimals));
      el.rate.textContent = den > 0n ? '1 ' + ft.symbol + ' ≈ ' + formatUnits(num / den, 6, 6) + ' ' + tt.symbol : '';
      el.route.textContent = String((q.toolDetails && q.toolDetails.name) || q.tool || '').replace(/[^\w .()-]/g, '').slice(0, 40);
      var g = 0, f = 0, i;
      for (i = 0; i < (e.gasCosts || []).length; i++) { g += Number(e.gasCosts[i].amountUSD || 0); }
      for (i = 0; i < (e.feeCosts || []).length; i++) { f += Number(e.feeCosts[i].amountUSD || 0); }
      el.gas.textContent = usd(g) || '—'; el.fee.textContent = usd(f) || '—';
      var d = Number(e.executionDuration || 0);
      el.time.textContent = d > 0 ? (d < 90 ? Math.max(1, Math.round(d)) + ' s' : Math.round(d / 60) + ' min') : '—';
      var a = Number(e.fromAmountUSD), b = Number(e.toAmountUSD);
      if (isFinite(a) && isFinite(b) && a > 0 && b >= 0) {
        S.impact = Math.max(0, (1 - b / a) * 100);
        el.impact.textContent = S.impact < 0.01 ? '< 0.01%' : '−' + S.impact.toFixed(2) + '%';
        el.impact.setAttribute('data-level', S.impact >= IMPACT_ACK ? '2' : S.impact >= IMPACT_WARN ? '1' : '0');
      } else { el.impact.textContent = '—'; el.impact.setAttribute('data-level', ''); }
    }

    function reset(keepNote) {      /* whatever was on screen belonged to the old question */
      S.q = null; S.qreq = null; S.need = null; S.ack = false; el.ack.checked = false; S.err = ''; S.done = false;
      if (!keepNote) { S.note = ''; }
      S.busy = ''; S.seq++; showQuote(null);
    }

    /* ---- ask for a price; every answer is checked before it is shown */
    var timer = null;
    function askLater() { if (timer) { clearTimeout(timer); } timer = setTimeout(ask, 600); }
    function ask(keepNote) {
      reset(keepNote === true);
      var ft = S.from.token, tt = S.to.token;
      if (!ft || !tt || !isAddr(ft.address) || !isAddr(tt.address)) { paint(); return; }
      if (Number(S.from.chain) === Number(S.to.chain) && sameAddr(ft.address, tt.address)) { S.err = t('same'); paint(); return; }
      var p = parseUnits(S.amount, ft.decimals);
      if (!p || p.v <= 0n) { S.err = S.amount ? t('needAmount') : ''; paint(); return; }
      var fc = chainById(S.from.chain);
      if (!W.account || !fc) { paint(); return; }
      var req = { fromChain: S.from.chain, toChain: S.to.chain, fromToken: ft.address, toToken: tt.address,
                  fromAmount: p.v.toString(), account: W.account, slippage: S.slip, contract: fc.contract,
                  fromDecimals: ft.decimals, toDecimals: tt.decimals };
      var seq = S.seq;
      S.busy = t('quoting'); paint();
      quote(req, cfg).then(function (q) {
        if (seq !== S.seq) { return; }
        var bad = checkQuote(q, req);
        if (bad) { S.busy = ''; S.err = t('mismatch') + ' [' + bad + ']'; paint(); return; }
        S.q = q; S.qreq = req; S.qt = Date.now(); S.busy = '';
        showQuote(q); paint();                       /* the price is on screen before the wallet is asked anything */
        return decideApproval(q, req).then(function () { if (seq === S.seq) { paint(); } });
      }, function (e) {
        if (seq !== S.seq) { return; }
        S.busy = '';
        S.err = e && e.status === 404 ? t('noRoute') : e && e.status === 429 ? t('busyService')
          : (e && e.message ? String(e.message).slice(0, 160) : t('offline'));
        paint();
      }).catch(function (e) {                        /* nothing may leave the button stuck on 'finding the price' */
        if (seq !== S.seq) { return; }
        S.busy = ''; S.err = (e && e.message ? String(e.message) : 'error').slice(0, 160); paint();
      });
    }

    /* does this swap need the token's permission first, and is there even enough of it? */
    function decideApproval(q, req) {
      S.need = null;
      return within(W.balance(req.fromToken, req.account), WAIT, null).then(function (b) {
        if (b === null) { return null; }             /* the wallet did not answer: say nothing about the balance */
        S.bal = b;
        if (b < BigInt(req.fromAmount)) { S.err = t('lowBalance'); }
        if (sameAddr(req.fromToken, ZERO)) { return null; }
        return within(W.allowance(req.fromToken, req.account, q.estimate.approvalAddress), WAIT, null).then(function (a) {
          if (a !== null && a < BigInt(req.fromAmount)) { S.need = 'approve'; }
        });
      }).catch(function () { return null; });
    }

    /* Start on the network the wallet is already on, when this page offers it: then nothing has to be switched at all.
       Some wallets never answer a switch request from a page, which used to leave the reader stuck on one button. */
    function follow() {
      if (!W.chainId || !chainById(W.chainId) || Number(W.chainId) === Number(S.from.chain)) { return; }
      var both = Number(S.to.chain) === Number(S.from.chain);
      S.from = { chain: W.chainId, token: null }; pickDefault(S.from);
      if (both) { S.to = { chain: W.chainId, token: null, second: true }; pickDefault(S.to); }
      S.bal = null; labels();
    }

    /* ---- the one button */
    function act() {
      var need = el.action.getAttribute('data-need');
      S.err = ''; S.note = ''; S.done = false;
      if (need === 'nowallet') { S.err = t('noWallet'); paint(); return; }
      if (need === 'connect') {
        S.busy = t('connecting'); paint();
        W.connect().then(function () { S.busy = ''; follow(); paint(); ask(); }, function (e) { S.busy = ''; S.err = code(e); paint(); });
        return;
      }
      if (need === 'chain') {
        var c = chainById(S.from.chain), seq = ++S.seq;
        S.busy = t('switching'); paint();
        within(W.switchChain(c).then(function () { return 'ok'; }, function (e) { return e || 'fail'; }), 30000, 'silent').then(function (r) {
          if (seq !== S.seq) { return; }
          S.busy = '';
          if (r === 'ok') { paint(); ask(); return; }
          S.err = r === 'silent' ? t('switchHint') : code(r); paint();
        });
        return;
      }
      if (need === 'approve') { doApprove(); return; }
      if (need === 'swap') { doSwap(); return; }
    }

    /* the wallet is asked once more where it is and who it is, right before anything is signed. A wallet that will not
       say is not sent a transaction built for another network. */
    function sameWallet(req) {
      return Promise.all([within(W.req('eth_chainId'), WAIT, null), within(W.req('eth_accounts'), WAIT, null)]).then(function (r) {
        if (r[0] === null || r[1] === null) { return 'chainUnknown'; }
        if (parseInt(r[0], 16) !== Number(req.fromChain)) { return 'chainMoved'; }
        if (!r[1] || !r[1].length || !sameAddr(r[1][0], req.account)) { return 'chainMoved'; }
        return null;
      });
    }

    function doApprove() {
      var q = S.q, req = S.qreq, seq = S.seq;
      if (!q || !req || !sameAddr(q.estimate.approvalAddress, req.contract)) { return; }
      var spender = q.estimate.approvalAddress, amount = BigInt(req.fromAmount);
      S.busy = t('approving'); paint();
      sameWallet(req).then(function (bad) {
        if (bad) { throw { soft: t(bad) }; }
        /* exactly this swap's amount, never unlimited. A token that insists on a reset to zero first gets it. */
        return within(W.allowance(req.fromToken, req.account, spender), WAIT, 0n);
      }).then(function (cur) {
        if (cur > 0n && cur < amount) {
          return W.send({ from: req.account, to: req.fromToken, data: ERC20.approve + pad32(spender) + pad32(qty(0n)), value: '0x0', chainId: qty(BigInt(req.fromChain)) })
            .then(function (h) { return waitFor(h); });
        }
        return null;
      }).then(function () {
        return W.send({ from: req.account, to: req.fromToken, data: ERC20.approve + pad32(spender) + pad32(qty(amount)), value: '0x0', chainId: qty(BigInt(req.fromChain)) });
      }).then(function (h) {
        line(t('view'), S.from.chain, h); return waitFor(h);
      }).then(function (okd) {
        if (seq !== S.seq) { return; }
        S.busy = '';
        if (okd === false) { S.err = t('failed'); } else { S.need = null; }
        paint();
      }, function (e) { if (seq !== S.seq) { return; } S.busy = ''; S.err = e && e.soft ? e.soft : code(e); paint(); });
    }

    function doSwap() {
      var q = S.q, req = S.qreq;
      if (!q || !req) { return; }
      if (needsAck() && !S.ack) { paint(); return; }
      if (Date.now() - S.qt > QUOTE_LIFE) { S.note = t('refreshed'); ask(true); return; }     /* never sign a stale price */
      var bad = checkQuote(q, req);                      /* checked once more, right before the wallet opens */
      if (bad) { reset(); S.err = t('mismatch') + ' [' + bad + ']'; paint(); return; }
      var x = q.transactionRequest, seq = S.seq;
      var tx = { from: req.account, to: x.to, data: x.data, value: x.value, chainId: qty(BigInt(req.fromChain)) };
      if (isQty(x.gasLimit) && BigInt(x.gasLimit) > 0n && BigInt(x.gasLimit) <= GAS_CAP) { tx.gas = x.gasLimit; }
      var cross = Number(req.fromChain) !== Number(req.toChain), hash = '';
      S.busy = t('swapping'); paint(); el.status.textContent = '';
      sameWallet(req).then(function (moved) {
        if (moved) { throw { soft: t(moved) }; }
        return W.send(tx);
      }).then(function (h) {
        hash = h; line(t('view'), req.fromChain, h); S.busy = t('watching'); paint();
        return waitFor(h);
      }).then(function (okd) {
        if (seq !== S.seq) { return; }
        if (okd === false) { S.busy = ''; S.err = t('failed'); paint(); return; }
        reset(); S.amount = ''; el.amount.value = ''; S.bal = null;
        if (cross && okd === true) { S.note = t('bridging'); paint(); track(hash, req, q.tool); return; }
        S.done = okd === true; if (okd === null) { S.note = t('watching'); }
        paint();
      }, function (e) { if (seq !== S.seq) { return; } S.busy = ''; S.err = e && e.soft ? e.soft : code(e); paint(); });
    }

    /* a swap between two networks is only half done when the first transaction lands: ask LI.FI how the rest goes */
    function track(hash, req, tool, tries) {
      tries = tries === undefined ? 90 : tries;
      var mine = S.seq;
      api('/v1/status', { txHash: hash, fromChain: req.fromChain, toChain: req.toChain, bridge: String(tool || '').replace(/[^\w-]/g, '') || undefined })
        .then(function (r) { return r; }, function () { return null; })
        .then(function (r) {
          if (mine !== S.seq) { return; }
          var st = r && typeof r.status === 'string' ? r.status : '';
          if (st === 'DONE') {
            S.note = ''; S.done = true; paint(); line(t('arrived'));
            if (r.receiving && typeof r.receiving.txHash === 'string') { line(t('viewDest'), req.toChain, r.receiving.txHash); }
            return;
          }
          if (st === 'FAILED') { S.note = ''; S.err = t('bridgeFailed'); paint(); return; }
          if (tries <= 0) { return; }
          setTimeout(function () { track(hash, req, tool, tries - 1); }, 10000);
        });
    }

    /* one line under the button: some words, and a link to a transaction when there is one. The link is built from
       this site's own list of explorers and a hash that looks like a hash, nothing else. */
    function line(words, chainId, hash) {
      var row = doc.createElement('div');
      var c = chainId !== undefined ? chainById(chainId) : null;
      if (c && typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash)) {
        var a = doc.createElement('a');
        a.setAttribute('href', c.explorer.replace(/\/+$/, '') + '/tx/' + hash);
        a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer');
        a.textContent = words;
        var h = doc.createElement('b'); h.setAttribute('translate', 'no'); h.textContent = ' ' + short(hash);
        row.appendChild(a); row.appendChild(h);
      } else { row.textContent = words; }
      el.status.appendChild(row);
    }

    function code(e) {
      if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED')) { return t('rejected'); }
      return e && e.message ? String(e.message).slice(0, 160) : 'error';
    }

    /* ================================================================ the picker: one dialog for networks and tokens */
    function openPick(side, kind) {
      S.pick = { side: side, kind: kind };
      el['dlg-title'].textContent = t(kind === 'chain' ? 'pickChain' : 'pickToken');
      el['dlg-q'].value = ''; el.dlg.hidden = false; el.dlg.setAttribute('data-kind', kind);
      fillPick('');
      try { el['dlg-q'].focus(); } catch (e) { }
    }
    function closePick() { el.dlg.hidden = true; S.pick = null; el['dlg-list'].textContent = ''; }

    function row(key, word, main, sub, onPick, flag) {
      var b = doc.createElement('button'); b.setAttribute('type', 'button'); b.setAttribute('class', 'sw-opt'); b.setAttribute('translate', 'no');
      var i = doc.createElement('span'); i.setAttribute('class', 'sw-ic'); icon(i, key, word);
      var m = doc.createElement('span'); m.setAttribute('class', 'sw-opt-m'); m.textContent = main;
      var s = doc.createElement('span'); s.setAttribute('class', 'sw-opt-s'); s.textContent = sub || '';
      b.appendChild(i); b.appendChild(m); b.appendChild(s);
      if (flag) { b.setAttribute('data-on', '1'); }
      b.addEventListener('click', onPick);
      el['dlg-list'].appendChild(b);
    }

    function fillPick(query) {
      var p = S.pick; if (!p) { return; }
      var q = String(query || '').trim().toLowerCase(), side = S[p.side], n = 0, i;
      el['dlg-list'].textContent = ''; el['dlg-find'].hidden = true;
      if (p.kind === 'chain') {
        for (i = 0; i < data.chains.length; i++) {
          var c = data.chains[i];
          if (q && c.name.toLowerCase().indexOf(q) < 0 && String(c.coin).toLowerCase().indexOf(q) < 0) { continue; }
          row(c.ic, c.name, c.name, c.coin, (function (id) { return function () { setChain(p.side, id); }; })(c.id), Number(c.id) === Number(side.chain));
          n++;
        }
      } else {
        var list = listFor(side.chain);
        for (i = 0; i < list.length; i++) {
          var tk = list[i];
          if (q && String(tk.symbol).toLowerCase().indexOf(q) < 0 && String(tk.name).toLowerCase().indexOf(q) < 0 && tk.address.toLowerCase() !== q) { continue; }
          row(tk.ic, tk.symbol, tk.symbol, tk.name, (function (x) { return function () { setToken(p.side, x); }; })(tk),
              !!side.token && sameAddr(side.token.address, tk.address));
          n++;
        }
        /* anything beyond the short list: a symbol such as CAKE, or a contract address, looked up live on LI.FI */
        var raw = String(query || '').trim();
        if (raw && (isAddr(raw) || /^[A-Za-z0-9][A-Za-z0-9.$_₮-]{0,19}$/.test(raw)) && !(n === 1 && !isAddr(raw) && list.some(function (x) { return String(x.symbol).toLowerCase() === q; }))) {
          el['dlg-find'].hidden = false;
        }
      }
      if (!n && el['dlg-find'].hidden) { var none = doc.createElement('div'); none.setAttribute('class', 'sw-none'); none.textContent = t('nothing'); el['dlg-list'].appendChild(none); }
    }

    function setChain(sideName, id) {
      var both = sideName === 'from' && Number(S.to.chain) === Number(S.from.chain);
      S[sideName] = { chain: id, token: null, second: sideName === 'to' }; pickDefault(S[sideName]);
      if (sideName === 'to' && Number(S.to.chain) === Number(S.from.chain) && S.from.token && S.to.token && sameAddr(S.from.token.address, S.to.token.address)) {
        var l2 = listFor(id); S.to.token = l2.length > 1 ? (sameAddr(l2[0].address, S.from.token.address) ? l2[1] : l2[0]) : S.to.token;
      }
      if (both) { S.to = { chain: id, token: null, second: true }; pickDefault(S.to); }
      if (sideName === 'from') { S.bal = null; }
      closePick(); labels(); paint(); ask();
    }
    function setToken(sideName, tk) {
      var other = sideName === 'from' ? S.to : S.from, mine = S[sideName];
      if (other.token && Number(other.chain) === Number(mine.chain) && sameAddr(other.token.address, tk.address)) {
        other.token = mine.token;                        /* picking the other side's token swaps the two */
      }
      mine.token = tk;
      if (sideName === 'from') { S.bal = null; }
      closePick(); labels(); paint(); ask();
    }
    function findOnChain() {
      var p = S.pick; if (!p) { return; }
      var raw = String(el['dlg-q'].value || '').trim(), side = S[p.side], name = p.side;
      el['dlg-find'].hidden = true; el['dlg-list'].textContent = '';
      var wait = doc.createElement('div'); wait.setAttribute('class', 'sw-none'); wait.textContent = t('searching'); el['dlg-list'].appendChild(wait);
      lookupToken(side.chain, raw).then(function (tk) {
        if (!S.pick || S.pick.side !== name) { return; }
        tk.custom = true;
        tk.ic = tk.verified ? bySymbol[String(tk.symbol).toLowerCase()] : undefined;
        el['dlg-list'].textContent = '';
        row(tk.ic, tk.symbol, tk.symbol, (tk.verified ? '' : '⚠ ') + short(tk.address), function () { setToken(name, tk); }, false);
      }, function () {
        if (!S.pick) { return; }
        el['dlg-list'].textContent = '';
        var none = doc.createElement('div'); none.setAttribute('class', 'sw-none'); none.textContent = t('badToken'); el['dlg-list'].appendChild(none);
      });
    }

    /* ================================================================ wiring */
    W.p = W.find(win);
    pickDefault(S.from); pickDefault(S.to); labels(); paint(); live = true;

    /* a wallet that allowed this site on an earlier visit is picked up silently, with no pop-up and no button press */
    if (W.p) {
      within(W.req('eth_accounts'), WAIT, null).then(function (acc) {
        if (!acc || !acc.length || !isAddr(acc[0]) || W.account) { return; }
        W.account = acc[0];
        return within(W.req('eth_chainId'), WAIT, null).then(function (id) {
          W.chainId = parseInt(id, 16) || 0; follow(); paint(); ask();
        });
      }).catch(function () { });
    }

    el.fc.addEventListener('click', function () { openPick('from', 'chain'); });
    el.tc.addEventListener('click', function () { openPick('to', 'chain'); });
    el.ft.addEventListener('click', function () { openPick('from', 'token'); });
    el.tt.addEventListener('click', function () { openPick('to', 'token'); });
    el['dlg-close'].addEventListener('click', closePick);
    el['dlg-find'].addEventListener('click', findOnChain);
    el['dlg-q'].addEventListener('input', function () { fillPick(this.value); });
    el.dlg.addEventListener('click', function (ev) { if (ev && ev.target === el.dlg) { closePick(); } });
    if (doc.addEventListener) { doc.addEventListener('keydown', function (ev) { if (ev && ev.key === 'Escape' && S.pick) { closePick(); } }); }

    el.amount.addEventListener('input', function () {
      var v = this.value.replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); })
        .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); })
        .replace(/[٫،,]/g, '.').replace(/[^0-9.]/g, '');
      var p = v.split('.'); if (p.length > 2) { v = p[0] + '.' + p.slice(1).join(''); }
      if (v !== this.value) { this.value = v; }
      S.amount = v; reset(); paint(); askLater();
    });
    el.max.addEventListener('click', function () {
      if (S.bal === null || !S.from.token) { return; }
      var b = S.bal;
      if (sameAddr(S.from.token.address, ZERO)) {         /* leave a little of the chain's own coin for the fee */
        var keep = 10n ** BigInt(Math.max(0, S.from.token.decimals - 3));
        b = b > keep ? b - keep : 0n;
      }
      el.amount.value = S.amount = formatUnits(b, S.from.token.decimals, S.from.token.decimals).replace(/,/g, '');
      paint(); ask();
    });
    el.flip.addEventListener('click', function () {
      var f = S.from, tt = S.to;
      S.from = { chain: tt.chain, token: tt.token }; S.to = { chain: f.chain, token: f.token, second: true };
      S.bal = null; labels(); paint(); ask();
    });
    el.slip.addEventListener('click', function (ev) {
      var b = ev && ev.target && ev.target.closest ? ev.target.closest('[data-slip]') : null;
      if (!b) { return; }
      var v = Number(b.getAttribute('data-slip'));
      if (!(isFinite(v) && v > 0 && v <= MAX_SLIP)) { return; }
      S.slip = v; paint(); ask();
    });
    el.ack.addEventListener('change', function () { S.ack = !!this.checked; paint(); });
    el.action.addEventListener('click', act);

    if (W.p && W.p.on) {
      W.p.on('accountsChanged', function (acc) { W.account = acc && acc.length && isAddr(acc[0]) ? acc[0] : ''; S.bal = null; paint(); ask(); });
      W.p.on('chainChanged', function (id) { W.chainId = parseInt(id, 16) || 0; follow(); paint(); ask(); });
    }
    return 'on';
  }

  function frameCheck(win) { try { return win.top !== win.self; } catch (e) { return true; } }

  /* the settings the page was built with, rebuilt field by field so nothing else can travel with them */
  function config(raw) {
    if (!plain(raw) || raw.enabled !== true) { return null; }
    var out = { integrator: '', fee: 0, slippage: 0.005 };
    if (typeof raw.integrator === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(raw.integrator)) { out.integrator = raw.integrator; }
    if (typeof raw.fee === 'number' && isFinite(raw.fee) && raw.fee >= 0 && raw.fee <= MAX_FEE) { out.fee = raw.fee; }
    if (typeof raw.slippage === 'number' && isFinite(raw.slippage) && raw.slippage > 0 && raw.slippage <= MAX_SLIP) { out.slippage = raw.slippage; }
    if (out.fee > 0 && !out.integrator) { return null; }      /* a fee with nobody registered to receive it */
    return out;
  }

  api_.start = start;
  api_.config = config;
  api_.frameCheck = frameCheck;
  api_.setLang = function (l) { lang = own(T, l) ? l : 'fa'; };
  api_.tune = function (o) { if (o && o.wait !== undefined) { WAIT = o.wait; } if (o && o.life !== undefined) { QUOTE_LIFE = o.life; } };   /* tests only */
  if (root && root.document) { start(root); }
})(typeof window !== 'undefined' ? window : null);
