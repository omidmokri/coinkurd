/* entekhab.net — /swap/  (the whole engine; this page loads no other code)
 *
 * What it does: asks LI.FI (https://li.quest) for a route and a ready-made transaction, shows the reader exactly what
 * they would be signing, and hands that transaction to their own wallet. Nothing else.
 *
 * The rules this file keeps, which tests/test_swap.js pins:
 *   • one host only. Every network request goes to https://li.quest. The page's policy blocks anything else, and the
 *     wallet is reached through the browser's own provider, not over the network.
 *   • the transaction is never built here. `to`, `data` and `value` come from LI.FI's answer and are checked field by
 *     field against what the reader asked for (chain, tokens, amount, their own address) before the wallet is opened.
 *     One mismatch and nothing is signed.
 *   • no markup is ever built from text that came back from the service. Token names come from whoever created the
 *     token, so they are written with textContent only — never innerHTML (the page also turns on Trusted Types, so an
 *     innerHTML anywhere in here would throw instead of running).
 *   • amounts are integers (BigInt) from the first character to the last. No floating point touches a balance.
 *   • approvals are for the exact amount of this one swap, never unlimited.
 *   • nothing about the reader is stored: no cookie, no wallet address kept, nothing but the chosen site language.
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
      noWallet: 'کیف پولی در این مرورگر پیدا نشد. از مرورگر داخلی کیف پول خود (متامسک، تراست ولت، بایننس…) این صفحه را باز کنید.',
      connect: 'اتصال کیف پول', connecting: 'در حال اتصال…', rejected: 'درخواست در کیف پول رد شد.',
      wrongChain: 'شبکهٔ کیف پول فرق دارد', switchChain: 'تغییر شبکه به {c}', switching: 'در حال تغییر شبکه…',
      amount: 'مبلغ را وارد کنید', quoting: 'در حال گرفتن بهترین قیمت…', noRoute: 'برای این مبلغ مسیری پیدا نشد.',
      lowBalance: 'موجودی شما کمتر از این مبلغ است.', approve: 'اجازهٔ برداشت {s}', approving: 'در انتظار تأیید در کیف پول…',
      swap: 'تبدیل', swapping: 'در انتظار امضا در کیف پول…', sent: 'تراکنش ارسال شد', done: 'تبدیل انجام شد',
      failed: 'تراکنش ناموفق بود.', watching: 'در حال پیگیری تبدیل…', view: 'دیدن تراکنش',
      mismatch: 'پاسخ سرویس با درخواست شما یکی نیست؛ چیزی امضا نشد.', offline: 'سرویس قیمت در دسترس نیست.',
      badToken: 'این توکن روی این شبکه پیدا نشد.', searching: 'در حال جست‌وجوی توکن…', unverified: 'این توکن تأییدشده نیست — با احتیاط.',
      needAmount: 'مبلغ معتبر نیست.', same: 'مبدأ و مقصد یکی است.'
    },
    ckb: {
      noWallet: 'هیچ جزدانێک لەم وێبگەڕەدا نەدۆزرایەوە. بە وێبگەڕی ناوەوەی جزدانەکەت (مێتاماسک، تراست وۆلێت، بایننس…) ئەم پەڕەیە بکەرەوە.',
      connect: 'بەستنەوەی جزدان', connecting: 'لە بەستنەوەدا…', rejected: 'داواکارییەکە لە جزدانەکەدا ڕەتکرایەوە.',
      wrongChain: 'تۆڕی جزدانەکە جیاوازە', switchChain: 'گۆڕینی تۆڕ بۆ {c}', switching: 'لە گۆڕینی تۆڕدا…',
      amount: 'بڕەکە بنووسە', quoting: 'لە وەرگرتنی باشترین نرخدا…', noRoute: 'بۆ ئەم بڕە ڕێگایەک نەدۆزرایەوە.',
      lowBalance: 'پارەی ناو جزدانەکەت لەم بڕە کەمترە.', approve: 'ڕێپێدانی دەرهێنانی {s}', approving: 'چاوەڕێی پشتڕاستکردنەوە لە جزدان…',
      swap: 'گۆڕینەوە', swapping: 'چاوەڕێی واژۆ لە جزدان…', sent: 'مامەڵەکە نێردرا', done: 'گۆڕینەوەکە ئەنجامدرا',
      failed: 'مامەڵەکە سەرکەوتوو نەبوو.', watching: 'لە شوێنکەوتنی گۆڕینەوەکەدا…', view: 'بینینی مامەڵە',
      mismatch: 'وەڵامی خزمەتگوزارییەکە لەگەڵ داواکارییەکەت یەک ناگرێتەوە؛ هیچ واژۆ نەکرا.', offline: 'خزمەتگوزاریی نرخ بەردەست نییە.',
      badToken: 'ئەم تۆکنە لەسەر ئەم تۆڕە نەدۆزرایەوە.', searching: 'لە گەڕان بەدوای تۆکندا…', unverified: 'ئەم تۆکنە پشتڕاست نەکراوەتەوە — بە وریاییەوە.',
      needAmount: 'بڕەکە دروست نییە.', same: 'سەرچاوە و مەبەست یەکن.'
    },
    en: {
      noWallet: 'No wallet found in this browser. Open this page in your wallet’s own browser (MetaMask, Trust Wallet, Binance…).',
      connect: 'Connect wallet', connecting: 'Connecting…', rejected: 'The request was rejected in the wallet.',
      wrongChain: 'The wallet is on another network', switchChain: 'Switch to {c}', switching: 'Switching network…',
      amount: 'Enter an amount', quoting: 'Finding the best price…', noRoute: 'No route found for this amount.',
      lowBalance: 'Your balance is lower than this amount.', approve: 'Approve {s}', approving: 'Waiting for approval in the wallet…',
      swap: 'Swap', swapping: 'Waiting for the signature in the wallet…', sent: 'Transaction sent', done: 'Swap complete',
      failed: 'The transaction failed.', watching: 'Following the swap…', view: 'View transaction',
      mismatch: 'The service’s answer does not match your request; nothing was signed.', offline: 'The price service is unreachable.',
      badToken: 'That token was not found on this network.', searching: 'Looking the token up\u2026', unverified: 'This token is not verified — take care.',
      needAmount: 'That amount is not valid.', same: 'The source and the destination are the same.'
    }
  };
  var lang = 'fa';
  function t(k, vars) {
    var s = (T[lang] || T.fa)[k] || k;
    if (vars) { for (var v in vars) { if (own(vars, v)) s = s.split('{' + v + '}').join(String(vars[v])); } }
    return s;
  }

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
    lookupToken: lookupToken, W: W, waitFor: waitFor, ERC20: ERC20,
    setLang: function (l) { lang = own(T, l) ? l : 'fa'; }, t: t };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api_; }
  root && (root.__swap = api_);

  /* ================================================================== the page */
  function start(win) {
    var doc = win.document, de = doc.documentElement;
    var $ = function (id) { return doc.getElementById(id); };
    var box = $('sw-app');
    if (!box) { return 'nobox'; }

    /* language, the same one the reader chose on the site */
    var l = 'fa';
    try { var v = win.localStorage.getItem('ck_lang'); if (v === 'ckb' || v === 'en' || v === 'fa') { l = v; } } catch (e) { }
    setLangOn(de, l);
    var btns = doc.querySelectorAll('[data-set-l]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var k = this.getAttribute('data-set-l');
        if (k !== 'fa' && k !== 'ckb' && k !== 'en') { return; }
        setLangOn(de, k);
        try { win.localStorage.setItem('ck_lang', k); } catch (e) { }
        fillTokens(); paint();
      });
    }

    if (frameCheck(win)) { de.setAttribute('data-s', 'framed'); return 'framed'; }

    var raw = null, data = null;
    try { raw = JSON.parse(box.getAttribute('data-c') || 'null'); } catch (e) { raw = null; }
    try { data = JSON.parse(box.getAttribute('data-d') || 'null'); } catch (e) { data = null; }
    var cfg = config(raw);
    if (!cfg || !plain(data) || !Array.isArray(data.chains) || !plain(data.tokens)) { de.setAttribute('data-s', 'off'); return 'off'; }
    de.setAttribute('data-s', 'on');

    var S = {               /* everything the page knows right now */
      from: { chain: data.chains[0].id, token: null }, to: { chain: data.chains[0].id, token: null, second: true },
      amount: '', slip: cfg.slippage, q: null, err: '', busy: '', hash: '', seq: 0, bal: null, need: null
    };

    var el = {
      fc: $('sw-from-chain'), tc: $('sw-to-chain'), ft: $('sw-from-token'), tt: $('sw-to-token'),
      fx: $('sw-from-custom'), tx: $('sw-to-custom'), amt: $('sw-amount'), max: $('sw-max'), bal: $('sw-balance'),
      flip: $('sw-flip'), slip: $('sw-slip'), act: $('sw-action'), msg: $('sw-msg'), stat: $('sw-status'),
      out: $('sw-quote'), receive: $('sw-receive'), min: $('sw-min'), route: $('sw-route'), gas: $('sw-gas'),
      fee: $('sw-fee'), time: $('sw-time'), warn: $('sw-tokenwarn'), acct: $('sw-account')
    };

    function chainById(id) {
      for (var i = 0; i < data.chains.length; i++) { if (Number(data.chains[i].id) === Number(id)) { return data.chains[i]; } }
      return null;
    }
    function listFor(id) { return data.tokens[String(id)] || []; }

    /* ---- the two drop-downs of chains, built once */
    function fillChains(sel, cur) {
      sel.textContent = '';
      for (var i = 0; i < data.chains.length; i++) {
        var o = doc.createElement('option');
        o.value = String(data.chains[i].id);
        o.textContent = data.chains[i].name;
        if (Number(data.chains[i].id) === Number(cur)) { o.selected = true; }
        sel.appendChild(o);
      }
    }

    /* ---- the token drop-down of one side, plus the "another address" entry */
    function fillSide(sel, side) {
      var list = listFor(side.chain), cur = side.token, i, o;
      sel.textContent = '';
      for (i = 0; i < list.length; i++) {
        o = doc.createElement('option');
        o.value = list[i].address;
        o.textContent = list[i].symbol + ' — ' + list[i].name;
        if (cur && sameAddr(cur.address, list[i].address)) { o.selected = true; }
        sel.appendChild(o);
      }
      o = doc.createElement('option');
      o.value = 'custom';
      o.textContent = lang === 'en' ? 'Another token…' : lang === 'ckb' ? 'تۆکنێکی تر…' : 'توکن دیگر…';
      if (cur && cur.custom) { o.selected = true; }
      sel.appendChild(o);
      if (!cur) {
        var want = side.second && list.length > 1 ? 1 : 0;        /* the two sides never open on the same token */
        side.token = list.length ? list[want] : null;
        if (side.token) { sel.value = side.token.address; }
      }
    }
    function fillTokens() { fillSide(el.ft, S.from); fillSide(el.tt, S.to); }

    /* ---- what the main button says and does */
    function paint() {
      var fromChain = chainById(S.from.chain), need = null, label = t('swap'), dis = true;
      el.msg.textContent = S.err || (S.done ? t('done') : '');
      el.msg.setAttribute('data-ok', S.err ? '' : (S.done ? '1' : ''));
      el.acct.textContent = W.account ? short(W.account) : '';
      el.bal.textContent = S.bal === null || !S.from.token ? '' : formatUnits(S.bal, S.from.token.decimals, 6) + ' ' + S.from.token.symbol;
      el.warn.textContent = (S.from.token && S.from.token.verified === false) || (S.to.token && S.to.token.verified === false) ? t('unverified') : '';

      if (S.busy) { label = S.busy; dis = true; need = 'busy'; }
      else if (!W.p) { label = t('connect'); dis = false; need = 'nowallet'; }
      else if (!W.account) { label = t('connect'); dis = false; need = 'connect'; }
      else if (fromChain && Number(W.chainId) !== Number(fromChain.id)) { label = t('switchChain', { c: fromChain.name }); dis = false; need = 'chain'; }
      else if (!S.amount) { label = t('amount'); dis = true; need = 'amount'; }
      else if (S.q && S.need === 'approve') { label = t('approve', { s: S.from.token ? S.from.token.symbol : '' }); dis = false; need = 'approve'; }
      else if (S.q) { label = t('swap'); dis = false; need = 'swap'; }
      else { label = t('amount'); dis = true; need = 'none'; }

      el.act.textContent = label;
      el.act.disabled = dis;
      el.act.setAttribute('data-need', need || '');
      el.out.setAttribute('data-has', S.q ? '1' : '0');
      el.fx.hidden = !(S.from.token && S.from.token.custom);
      el.tx.hidden = !(S.to.token && S.to.token.custom);
    }

    function showQuote(q) {
      if (!q) { el.receive.textContent = el.min.textContent = el.route.textContent = el.gas.textContent = el.fee.textContent = el.time.textContent = ''; return; }
      var td = S.to.token.decimals, ts = S.to.token.symbol;
      el.receive.textContent = formatUnits(q.estimate.toAmount, td, 8) + ' ' + ts;
      el.min.textContent = formatUnits(q.estimate.toAmountMin, td, 8) + ' ' + ts;
      el.route.textContent = String((q.toolDetails && q.toolDetails.name) || q.tool || '').slice(0, 40);
      var g = 0, i;
      for (i = 0; i < (q.estimate.gasCosts || []).length; i++) { g += Number(q.estimate.gasCosts[i].amountUSD || 0); }
      el.gas.textContent = g ? '$' + g.toFixed(2) : '—';
      var f = 0;
      for (i = 0; i < (q.estimate.feeCosts || []).length; i++) { f += Number(q.estimate.feeCosts[i].amountUSD || 0); }
      el.fee.textContent = f ? '$' + f.toFixed(2) : '—';
      var d = Number(q.estimate.executionDuration || 0);
      el.time.textContent = d ? (d < 90 ? Math.max(1, Math.round(d)) + 's' : Math.round(d / 60) + 'm') : '—';
    }

    /* ---- ask for a price; every answer is checked before it is shown */
    var timer = null;
    function askLater() { if (timer) { clearTimeout(timer); } timer = setTimeout(ask, 600); }
    function ask() {
      S.q = null; S.need = null; showQuote(null);
      var ft = S.from.token, tt = S.to.token;
      if (!ft || !tt) { paint(); return; }
      if (Number(S.from.chain) === Number(S.to.chain) && sameAddr(ft.address, tt.address)) { S.err = t('same'); paint(); return; }
      var p = parseUnits(S.amount, ft.decimals);
      if (!p || p.v <= 0n) { S.err = S.amount ? t('needAmount') : ''; paint(); return; }
      if (!W.account) { S.err = ''; paint(); return; }
      var fc = chainById(S.from.chain);
      if (!fc) { paint(); return; }
      var req = { fromChain: S.from.chain, toChain: S.to.chain, fromToken: ft.address, toToken: tt.address,
                  fromAmount: p.v.toString(), account: W.account, slippage: S.slip, contract: fc.contract };
      var seq = ++S.seq;
      S.err = ''; S.busy = t('quoting'); paint();
      quote(req, cfg).then(function (q) {
        if (seq !== S.seq) { return; }
        var bad = checkQuote(q, req);
        if (bad) { S.busy = ''; S.err = t('mismatch') + ' [' + bad + ']'; paint(); return; }
        S.q = q; S.qreq = req; S.busy = '';
        return decideApproval(q, req).then(function () { if (seq === S.seq) { showQuote(q); paint(); } });
      }, function (e) {
        if (seq !== S.seq) { return; }
        S.busy = '';
        S.err = e && e.status === 404 ? t('noRoute') : (e && e.message ? String(e.message).slice(0, 160) : t('offline'));
        paint();
      });
    }

    /* does this swap need the token's permission first, and is there even enough of it? */
    function decideApproval(q, req) {
      S.need = null;
      return W.balance(req.fromToken, req.account).then(function (b) {
        S.bal = b;
        if (b < BigInt(req.fromAmount)) { S.err = t('lowBalance'); }
        if (sameAddr(req.fromToken, ZERO)) { return null; }
        return W.allowance(req.fromToken, req.account, q.estimate.approvalAddress).then(function (a) {
          if (a < BigInt(req.fromAmount)) { S.need = 'approve'; }
        });
      }).catch(function () { return null; });
    }

    /* ---- the one button */
    function act() {
      var need = el.act.getAttribute('data-need');
      S.err = ''; S.done = false; el.stat.textContent = '';
      if (need === 'nowallet') { S.err = t('noWallet'); paint(); return; }
      if (need === 'connect') {
        S.busy = t('connecting'); paint();
        W.connect().then(function () { S.busy = ''; follow(); paint(); ask(); }, function (e) { S.busy = ''; S.err = code(e); paint(); });
        return;
      }
      if (need === 'chain') {
        var c = chainById(S.from.chain);
        S.busy = t('switching'); paint();
        W.switchChain(c).then(function () { S.busy = ''; paint(); ask(); }, function (e) { S.busy = ''; S.err = code(e); paint(); });
        return;
      }
      if (need === 'approve') { doApprove(); return; }
      if (need === 'swap') { doSwap(); return; }
    }

    function doApprove() {
      var q = S.q, req = S.qreq;
      if (!q || !req || !isAddr(q.estimate.approvalAddress)) { return; }
      var spender = q.estimate.approvalAddress, amount = BigInt(req.fromAmount);
      S.busy = t('approving'); paint();
      /* exactly this swap's amount, never unlimited. A token that insists on a reset to zero first gets it. */
      W.allowance(req.fromToken, req.account, spender).then(function (cur) {
        if (cur > 0n && cur < amount) {
          return W.send({ from: req.account, to: req.fromToken, data: ERC20.approve + pad32(spender) + pad32(qty(0n)), value: '0x0' })
            .then(function (h) { return waitFor(h); });
        }
        return null;
      }).then(function () {
        return W.send({ from: req.account, to: req.fromToken, data: ERC20.approve + pad32(spender) + pad32(qty(amount)), value: '0x0' });
      }).then(function (h) {
        link(h); return waitFor(h);
      }).then(function (okd) {
        S.busy = '';
        if (okd === false) { S.err = t('failed'); } else { S.need = null; }
        paint();
      }, function (e) { S.busy = ''; S.err = code(e); paint(); });
    }

    function doSwap() {
      var q = S.q, req = S.qreq;
      if (!q || !req) { return; }
      var bad = checkQuote(q, req);                      /* checked once more, right before the wallet opens */
      if (bad) { S.err = t('mismatch') + ' [' + bad + ']'; S.q = null; paint(); return; }
      var x = q.transactionRequest;
      var tx = { from: req.account, to: x.to, data: x.data, value: x.value };
      if (isQty(x.gasLimit)) { tx.gas = x.gasLimit; }
      S.busy = t('swapping'); paint();
      W.send(tx).then(function (h) {
        S.hash = h; link(h); S.busy = t('watching'); paint();
        return waitFor(h);
      }).then(function (okd) {
        S.busy = '';
        if (okd === false) { S.err = t('failed'); }
        else {                       /* done, or still travelling between chains: either way this quote is spent */
          S.q = null; S.qreq = null; showQuote(null);
          S.amount = ''; el.amt.value = '';
          S.done = okd === true;
          if (okd === null) { S.err = t('watching'); }
        }
        paint();
      }, function (e) { S.busy = ''; S.err = code(e); paint(); });
    }

    function link(hash) {
      el.stat.textContent = '';
      if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) { return; }
      var c = chainById(S.from.chain);
      if (!c) { return; }
      var a = doc.createElement('a');
      a.href = c.explorer.replace(/\/+$/, '') + '/tx/' + hash;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = t('view') + ' · ' + short(hash);
      el.stat.appendChild(a);
    }

    function code(e) {
      if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED')) { return t('rejected'); }
      return e && e.message ? String(e.message).slice(0, 160) : 'error';
    }

    /* ---- wiring */
    W.p = W.find(win);
    fillChains(el.fc, S.from.chain); fillChains(el.tc, S.to.chain); fillTokens(); paint();

    /* a wallet that allowed this site on an earlier visit is picked up silently, with no pop-up and no button press */
    if (W.p) {
      W.req('eth_accounts').then(function (acc) {
        if (!acc || !acc.length || !isAddr(acc[0]) || W.account) { return; }
        W.account = acc[0];
        return W.req('eth_chainId').then(function (id) { W.chainId = parseInt(id, 16) || 0; follow(); paint(); ask(); });
      }).catch(function () { });
    }

    /* Start on the network the wallet is already on, when this page offers it: then nothing has to be switched at all.
       Some wallets never answer a switch request from a page, which used to leave the reader stuck on one button. */
    function follow() {
      if (!W.chainId || !chainById(W.chainId) || Number(W.chainId) === Number(S.from.chain)) { return; }
      var both = Number(S.to.chain) === Number(S.from.chain);
      S.from = { chain: W.chainId, token: null };
      if (both) { S.to = { chain: W.chainId, token: null, second: true }; }
      fillChains(el.fc, S.from.chain); fillChains(el.tc, S.to.chain); fillTokens();
    }

    el.fc.addEventListener('change', function () { S.from.chain = Number(this.value); S.from.token = null; fillSide(el.ft, S.from); paint(); askLater(); });
    el.tc.addEventListener('change', function () { S.to.chain = Number(this.value); S.to.token = null; fillSide(el.tt, S.to); paint(); askLater(); });
    el.ft.addEventListener('change', function () { pick(S.from, this.value, el.fx); });
    el.tt.addEventListener('change', function () { pick(S.to, this.value, el.tx); });
    el.fx.addEventListener('change', function () { custom(S.from, this.value); });
    el.tx.addEventListener('change', function () { custom(S.to, this.value); });
    el.amt.addEventListener('input', function () {
      var v = this.value.replace(/[٫،,]/g, '.').replace(/[^0-9.]/g, '');
      var p = v.split('.'); if (p.length > 2) { v = p[0] + '.' + p.slice(1).join(''); }
      if (v !== this.value) { this.value = v; }
      S.amount = v; S.err = ''; S.done = false; paint(); askLater();
    });
    el.max.addEventListener('click', function () {
      if (S.bal === null || !S.from.token) { return; }
      var b = S.bal;
      if (sameAddr(S.from.token.address, ZERO)) {         /* leave a little of the chain's own coin for the fee */
        var keep = BigInt(10) ** BigInt(Math.max(0, S.from.token.decimals - 3));
        b = b > keep ? b - keep : 0n;
      }
      el.amt.value = S.amount = formatUnits(b, S.from.token.decimals, S.from.token.decimals).replace(/,/g, '');
      paint(); ask();
    });
    el.flip.addEventListener('click', function () {
      var f = S.from, tt = S.to;
      S.from = { chain: tt.chain, token: tt.token }; S.to = { chain: f.chain, token: f.token, second: true };
      fillChains(el.fc, S.from.chain); fillChains(el.tc, S.to.chain); fillTokens(); paint(); askLater();
    });
    el.slip.addEventListener('change', function () {
      var v = Number(this.value);
      S.slip = isFinite(v) && v > 0 && v <= MAX_SLIP ? v : cfg.slippage;
      askLater();
    });
    el.act.addEventListener('click', act);

    function pick(side, value, customInput) {
      if (value === 'custom') { side.token = { custom: true, address: '', decimals: 0, symbol: '', name: '' }; paint(); customInput.focus(); return; }
      var list = listFor(side.chain);
      for (var i = 0; i < list.length; i++) { if (sameAddr(list[i].address, value)) { side.token = list[i]; break; } }
      S.err = ''; paint(); askLater();
    }
    /* a symbol such as CAKE, or a token's address. Either way LI.FI is asked which token that is on this chain, and
       the answer is checked before it is used; anything that is not verified there is flagged on the page. */
    function custom(side, value) {
      var a = String(value || '').trim();
      var looksLikeSymbol = /^[A-Za-z0-9][A-Za-z0-9.$_\u20ae\u20ae-]{0,19}$/.test(a);
      if (!isAddr(a) && !looksLikeSymbol) {
        side.token = { custom: true, address: '', decimals: 0, symbol: '', name: '' };
        S.err = a ? t('badToken') : ''; paint(); return;
      }
      S.busy = t('searching'); paint();
      lookupToken(side.chain, a).then(function (tk) {
        tk.custom = true; side.token = tk; S.busy = ''; S.err = ''; paint(); ask();
      }, function () { S.busy = ''; S.err = t('badToken'); paint(); });
    }

    if (W.p && W.p.on) {
      W.p.on('accountsChanged', function (acc) { W.account = acc && acc.length && isAddr(acc[0]) ? acc[0] : ''; S.q = null; S.bal = null; paint(); ask(); });
      W.p.on('chainChanged', function (id) { W.chainId = parseInt(id, 16) || 0; S.q = null; follow(); paint(); ask(); });
    }
    return 'on';
  }

  function setLangOn(de, l) {
    lang = own(T, l) ? l : 'fa';
    de.setAttribute('data-l', lang);
    de.setAttribute('lang', lang);
    de.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
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
  if (root && root.document) { start(root); }
})(typeof window !== 'undefined' ? window : null);
