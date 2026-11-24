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
  var ERC20 = { allowance: '0xdd62ed3e', approve: '0x095ea7b3', balanceOf: '0x70a08231', transfer: '0xa9059cbb', decimals: '0x313ce567' };

  /* ------------------------------------------------------------------ text */
  var T = {
    fa: {
      noWalletBtc: 'کیف پول بیت‌کوین در این مرورگر پیدا نشد (تراست ولت، سیف‌پل…).', noWalletTron: 'کیف پول ترون در این مرورگر پیدا نشد (ترون‌لینک، سیف‌پل، تراست ولت…).', noWalletSol: 'کیف پول سولانا در این مرورگر پیدا نشد (فانتوم، سیف‌پل، تراست ولت…).',
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
      viewDest: 'تراکنش مقصد', pickChain: 'انتخاب شبکه', pickToken: 'انتخاب ارز', routesBusy: 'در حال یافتن مسیرهای دیگر…', routesNone: 'مسیر دیگری پیدا نشد.', best: 'پیشنهادی',
      bridgeNote: 'این تبدیل از این پل می‌گذرد. پل قراردادی جدا از دو شبکه است و خطر خودش را دارد؛ رسیدن پول هم چند دقیقه طول می‌کشد.',
      histSent: 'فرستاده شد', histDone: 'انجام شد', histFailed: 'ناموفق', repBusy: 'در حال خواندن…', repNone: 'این ماه هنوز تبدیلی ثبت نشده است. با انجام اولین تبدیل، آمار این ماه همین‌جا نشان داده می‌شود.',
      mine: 'انتخاب شما', timeFast: 'کمتر از ۲ دقیقه', timeFew: 'چند دقیقه', timeAbout: 'حدود', timeMin: 'دقیقه',
      trackTip: 'وضعیت را از تاریخچهٔ همین مرورگر هم می‌توانید ببینید.', copied: 'لینک کپی شد.', copyFail: 'کپی نشد؛ لینک را از روی صفحه بردارید.',
      scoreT: 'امتیاز انتخاب', whaleT: 'جابه‌جایی نهنگ‌ها (۲۴ ساعت)', asOf: 'به‌روزرسانی',
      lblvery_weak: 'خیلی ضعیف', lblweak: 'ضعیف', lblneutral: 'خنثی', lblpositive: 'مثبت', lblstrong: 'قوی', lblvery_strong: 'خیلی قوی', histSaved: 'در تاریخچهٔ همین مرورگر ثبت شد.', trackGo: 'در راه', trackDone: 'رسید', trackFail: 'ناموفق',
      advSteps: 'مراحل مسیر', advGas: 'برآورد گس (واحد)', advFees: 'ریز کارمزدها',
      repCount: 'تعداد تبدیل‌ها', repVolume: 'حجم تبدیل‌ها', repShare: 'سهم زاگرس (تقریبی)', repErr: 'گزارش اکنون در دسترس نیست.', nothing: 'چیزی پیدا نشد.',
      rcpChecking: 'در حال بررسی نشانی…',
      rcpNeeded: 'نشانی دریافت را وارد کنید', rcpBad: 'نشانی با قالب این شبکه نمی‌خواند', confirmAddr: 'نشانی دریافت را تأیید کنید',
      give: 'حمایت', giving: 'در انتظار امضا در کیف پول…', gave: 'رسید. ممنون.', copied: 'کپی شد', copy: 'کپی',
      findOnChain: 'جست‌وجو روی شبکه', balance: 'موجودی'
    },
    ckb: {
      noWalletBtc: 'جزدانی بیتکۆین لەم وێبگەڕەدا نەدۆزرایەوە (تراست وۆلێت، سەیفپاڵ…).', noWalletTron: 'جزدانی ترۆن لەم وێبگەڕەدا نەدۆزرایەوە (ترۆن‌لینک، سەیفپاڵ، تراست وۆلێت…).', noWalletSol: 'جزدانی سۆلانا لەم وێبگەڕەدا نەدۆزرایەوە (فانتۆم، سەیفپاڵ، تراست وۆلێت…).',
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
      viewDest: 'مامەڵەی مەبەست', pickChain: 'هەڵبژاردنی تۆڕ', pickToken: 'هەڵبژاردنی دراو', routesBusy: 'گەڕان بەدوای ڕێگای تر…', routesNone: 'ڕێگایەکی تر نەدۆزرایەوە.', best: 'پێشنیارکراو',
      bridgeNote: 'ئەم گۆڕینەوەیە بەم پردەدا تێدەپەڕێت. پرد گرێبەستێکی جیایە و مەترسیی خۆی هەیە؛ گەیشتنی پارەکەش چەند خولەکێک دەخایەنێت.',
      histSent: 'نێردرا', histDone: 'تەواو بوو', histFailed: 'سەرنەکەوت', repBusy: 'خوێندنەوە…', repNone: 'ئەم مانگە هێشتا هیچ گۆڕینەوەیەک تۆمار نەکراوە. لەگەڵ یەکەم گۆڕینەوە، ئاماری ئەم مانگە لێرە دەردەکەوێت.',
      mine: 'هەڵبژاردنی تۆ', timeFast: 'کەمتر لە ٢ خولەک', timeFew: 'چەند خولەکێک', timeAbout: 'نزیکەی', timeMin: 'خولەک',
      trackTip: 'دۆخەکە لە مێژووی ئەم وێبگەڕەشدا دەبینیت.', copied: 'بەستەر لەبەرگیرایەوە.', copyFail: 'لەبەرنەگیرایەوە؛ بەستەرەکە لە پەڕەکەوە ببە.',
      scoreT: 'خاڵی ئینتیخاب', whaleT: 'جووڵەی نەهەنگەکان (٢٤ کاتژمێر)', asOf: 'نوێکردنەوە',
      lblvery_weak: 'زۆر لاواز', lblweak: 'لاواز', lblneutral: 'بێلایەن', lblpositive: 'ئەرێنی', lblstrong: 'بەهێز', lblvery_strong: 'زۆر بەهێز', histSaved: 'لە مێژووی ئەم وێبگەڕەدا تۆمار کرا.', trackGo: 'لە ڕێگادایە', trackDone: 'گەیشت', trackFail: 'سەرنەکەوت',
      advSteps: 'هەنگاوەکانی ڕێگا', advGas: 'خەمڵاندنی گاز (یەکە)', advFees: 'وردەکاریی کرێکان',
      repCount: 'ژمارەی گۆڕینەوەکان', repVolume: 'قەبارەی گۆڕینەوەکان', repShare: 'بەشی زاگرۆس (نزیکەیی)', repErr: 'ڕاپۆرت ئێستا بەردەست نییە.', nothing: 'هیچ نەدۆزرایەوە.',
      rcpChecking: 'ناونیشان دەپشکنرێت…',
      rcpNeeded: 'ناونیشانی وەرگرتن بنووسە', rcpBad: 'ناونیشان لەگەڵ قالبی ئەم تۆڕە ناگونجێت', confirmAddr: 'ناونیشانی وەرگرتن پەسەند بکە',
      give: 'پشتگیری', giving: 'چاوەڕێی واژۆ لە جزدان…', gave: 'گەیشت. سوپاس.', copied: 'لەبەرگیرایەوە', copy: 'لەبەرگرتنەوە',
      findOnChain: 'گەڕان لەسەر تۆڕ', balance: 'ماوە'
    },
    en: {
      noWalletBtc: 'No Bitcoin wallet found in this browser (Trust Wallet, SafePal…).', noWalletTron: 'No Tron wallet found in this browser (TronLink, SafePal, Trust Wallet…).', noWalletSol: 'No Solana wallet found in this browser (Phantom, SafePal, Trust Wallet…).',
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
      viewDest: 'Destination transaction', pickChain: 'Choose a network', pickToken: 'Choose a coin', routesBusy: 'Looking for other routes…', routesNone: 'No other route found.', best: 'recommended',
      bridgeNote: 'This swap crosses this bridge. A bridge is a contract apart from both networks and carries its own risk; the money also takes a few minutes to arrive.',
      histSent: 'sent', histDone: 'done', histFailed: 'failed', repBusy: 'Reading…', repNone: 'No swap has been recorded this month yet. With the first swap, this month\'s figures will show here.',
      mine: 'your choice', timeFast: 'under 2 minutes', timeFew: 'a few minutes', timeAbout: 'about', timeMin: 'min',
      trackTip: 'You can also see the status in the history of this browser.', copied: 'Link copied.', copyFail: 'Could not copy; take the link from the page.',
      scoreT: 'Entekhab score', whaleT: 'Whale moves (24h)', asOf: 'updated',
      lblvery_weak: 'very weak', lblweak: 'weak', lblneutral: 'neutral', lblpositive: 'positive', lblstrong: 'strong', lblvery_strong: 'very strong', histSaved: 'Saved to the history of this browser.', trackGo: 'on its way', trackDone: 'arrived', trackFail: 'failed',
      advSteps: 'Route steps', advGas: 'Gas estimate (units)', advFees: 'Fees in detail',
      repCount: 'Swaps', repVolume: 'Volume', repShare: 'Zagros share (approx.)', repErr: 'The report is not available right now.', nothing: 'Nothing found.',
      rcpChecking: 'Checking the address…',
      rcpNeeded: 'Enter the receiving address', rcpBad: 'That address does not fit this network', confirmAddr: 'Confirm the receiving address',
      give: 'Support', giving: 'Waiting for the signature in the wallet…', gave: 'Received. Thank you.', copied: 'Copied', copy: 'Copy',
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

  function quote(req, cfg, alt) {
    return api('/v1/quote', {
      denyBridges: alt && alt.cross ? alt.deny : undefined, denyExchanges: alt && !alt.cross ? alt.deny : undefined,
      fromChain: req.fromChain, toChain: req.toChain, fromToken: req.fromToken, toToken: req.toToken,
      fromAmount: req.fromAmount, fromAddress: req.account, toAddress: req.recipient || req.account,
      slippage: req.slippage, integrator: cfg.integrator || undefined, fee: req.fee || cfg.fee || undefined
    });
  }

  /* ---- base58, and what the bytes underneath an address say it is
   * The shapes above cannot tell these networks apart: a Bitcoin address and a Tron address are both base58, and
   * Solana's alphabet is the same again, so one network's address matches another's shape. Underneath they are not
   * alike at all. Base58 is plain arithmetic in base 58, and once decoded the length and the leading byte say which
   * network an address belongs to: Solana is a bare 32-byte key, while Bitcoin, Tron and Zcash carry a version byte
   * and a four-byte check, and their version bytes differ. Sending Bitcoin to a Tron address loses it for good, so
   * the page settles this here rather than hoping the shape was enough. */
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58(str) {
    var num = 0n, i, k, zeros = 0, out = [];
    for (i = 0; i < str.length; i++) {
      k = B58.indexOf(str.charAt(i));
      if (k < 0) { return null; }
      num = num * 58n + BigInt(k);
    }
    while (zeros < str.length && str.charAt(zeros) === '1') { zeros++; }
    while (num > 0n) { out.unshift(Number(num & 255n)); num >>= 8n; }
    while (zeros-- > 0) { out.unshift(0); }
    return out;
  }

  /* each network: the decoded length it must have, and the bytes it must begin with (any one of them) */
  var BYTES = {
    utxo: { len: 25, heads: [[0x00], [0x05]] },
    tron: { len: 25, heads: [[0x41]] },
    zcash: { len: 26, heads: [[0x1c, 0xb8], [0x1c, 0xbd]] },
    solana: { len: 32, heads: null }
  };

  /* bech32, as Bitcoin's bc1 addresses are written: its check is plain arithmetic over 32 symbols, no hashing */
  var B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function bechOk(addr) {
    var low = addr.toLowerCase(), pos = low.lastIndexOf('1'), i, c, top;
    if (addr !== low && addr !== addr.toUpperCase()) { return false; }     /* bech32 is never written in mixed case */
    if (pos < 1 || pos + 7 > low.length || low.length > 90) { return false; }
    var hrp = low.slice(0, pos), data = low.slice(pos + 1), chk = 1;
    var GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    function step(v) {
      var j;                                      /* its own counter: sharing the callers' would never let them end */
      top = chk >>> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (j = 0; j < 5; j++) { if ((top >>> j) & 1) { chk ^= GEN[j]; } }
    }
    for (i = 0; i < hrp.length; i++) { step(hrp.charCodeAt(i) >>> 5); }
    step(0);
    for (i = 0; i < hrp.length; i++) { step(hrp.charCodeAt(i) & 31); }
    for (i = 0; i < data.length; i++) {
      c = B32.indexOf(data.charAt(i));
      if (c < 0) { return false; }
      step(c);
    }
    return chk === 1 || chk === 0x2bc830a3;                                /* bech32 and bech32m */
  }

  function fits(shapes, kind, addr) {
    var re = shapes && shapes[kind];
    if (!re || typeof addr !== 'string' || !addr || addr.length > 120 || !re.test(addr)) { return false; }
    var want = BYTES[kind];
    if (!want) { return true; }                       /* sui and stellar are told apart by their shape alone */
    if (kind === 'utxo' && addr.indexOf('bc1') === 0) { return bechOk(addr); }   /* bech32, and no other network uses it */
    if (kind === 'zcash' && addr.indexOf('u1') === 0) { return true; }
    var raw = b58(addr);
    if (!raw || raw.length !== want.len) { return false; }
    if (!want.heads) { return true; }
    for (var i = 0; i < want.heads.length; i++) {
      var h = want.heads[i], j = 0;
      while (j < h.length && raw[j] === h[j]) { j++; }
      if (j === h.length) { return true; }
    }
    return false;
  }

  /* The last four bytes of a Bitcoin, Tron or Zcash address are a check: the first four bytes of SHA-256 applied
     twice to everything before them. Shape and length alone let a dropped character through — this does not. The
     browser's own hashing is used, which is asynchronous, so the answer arrives a moment later and is remembered. */
  var SUMS = {}, SUMMED = {};
  function needsSum(kind, addr) {
    return (kind === 'utxo' && addr.indexOf('bc1') !== 0) || kind === 'tron' ||
           (kind === 'zcash' && addr.indexOf('u1') !== 0);
  }

  function sha256(bytes) {
    var c = (typeof crypto !== 'undefined' && crypto) || (typeof root !== 'undefined' && root && root.crypto);
    if (!c || !c.subtle) { return Promise.reject(new Error('no hashing')); }
    return c.subtle.digest('SHA-256', new Uint8Array(bytes)).then(function (b) { return Array.prototype.slice.call(new Uint8Array(b)); });
  }

  function checkSum(addr) {
    if (own(SUMS, addr)) { return Promise.resolve(SUMS[addr]); }
    if (own(SUMMED, addr)) { return SUMMED[addr]; }
    var raw = b58(addr);
    if (!raw || raw.length < 5) { SUMS[addr] = false; return Promise.resolve(false); }
    var body = raw.slice(0, raw.length - 4), tail = raw.slice(raw.length - 4);
    SUMMED[addr] = sha256(body).then(sha256).then(function (h) {
      var okd = h[0] === tail[0] && h[1] === tail[1] && h[2] === tail[2] && h[3] === tail[3];
      SUMS[addr] = okd; delete SUMMED[addr];
      return okd;
    }, function () { delete SUMMED[addr]; return null; });            /* no hashing here: say nothing either way */
    return SUMMED[addr];
  }

  /* ================================================================== Tron and Solana: a swap may start there too
   * Neither is signed through window.ethereum, and neither hands the wallet a transaction it can read back the way an
   * EVM wallet can. So what LI.FI returns is opened here, byte by byte, before any wallet sees it:
   *   Tron   — the transaction is a protobuf. It must be exactly one TriggerSmartContract, owned by the reader's own
   *            address, calling LI.FI's own contract on Tron (pinned in scripts/swap_chains.json), carrying exactly the
   *            TRX the reader typed (or none for a token), with a bounded fee limit and an expiry still ahead.
   *            Its id must be the SHA-256 of those very bytes, because the id is what the wallet signs.
   *   Solana — programs cannot be pinned that way, so less can be proved: the transaction must be paid for by the
   *            reader's own key, and where the money comes out is held to the address in the request as everywhere.
   * Broadcasting and reading balances on Tron go to TronGrid's public API, not through the wallet. */
  var TRON_API = 'https://api.trongrid.io';
  var TRX = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';          /* how LI.FI writes Tron's own coin */
  var TRON_FEE_CAP = 1000000000n;                           /* 1000 TRX: no swap needs a fee limit above this */

  function hexOf(bytes) { var s = '', i; for (i = 0; i < bytes.length; i++) { s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16); } return s; }
  function bytesOf(hex) {
    if (typeof hex !== 'string' || hex.length % 2 || !/^[0-9a-fA-F]*$/.test(hex)) { return null; }
    var out = [], i; for (i = 0; i < hex.length; i += 2) { out.push(parseInt(hex.substr(i, 2), 16)); } return out;
  }
  function b58enc(bytes) {
    var num = 0n, i, s = '', z = 0;
    for (i = 0; i < bytes.length; i++) { num = (num << 8n) | BigInt(bytes[i]); }
    while (num > 0n) { s = B58.charAt(Number(num % 58n)) + s; num /= 58n; }
    while (z < bytes.length && bytes[z] === 0) { s = '1' + s; z++; }
    return s;
  }
  function b64(str) {
    if (typeof str !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(str) || str.length % 4) { return null; }
    try { var bin = atob(str), out = [], i; for (i = 0; i < bin.length; i++) { out.push(bin.charCodeAt(i)); } return out; } catch (e) { return null; }
  }
  /* a Tron address as the 21 bytes the chain itself uses, in hex: 41 and then twenty bytes */
  function tronHex(addr) {
    var raw = typeof addr === 'string' && addr.length === 34 ? b58(addr) : null;
    return raw && raw.length === 25 && raw[0] === 0x41 ? hexOf(raw.slice(0, 21)) : null;
  }

  /* protobuf, read plainly: every field with its number, and either its number-value or its bytes */
  function pb(bytes) {
    var out = [], i = 0, key, n, wt, v, sh, len;
    function varint() {
      v = 0n; sh = 0n;
      for (;;) {
        if (i >= bytes.length || sh > 63n) { return null; }
        var b = bytes[i++]; v |= BigInt(b & 127) << sh; sh += 7n;
        if (!(b & 128)) { return v; }
      }
    }
    while (i < bytes.length) {
      key = varint(); if (key === null) { return null; }
      n = Number(key >> 3n); wt = Number(key & 7n);
      if (wt === 0) { if (varint() === null) { return null; } out.push({ n: n, v: v }); }
      else if (wt === 2) {
        len = varint(); if (len === null || len > BigInt(bytes.length - i)) { return null; }
        out.push({ n: n, b: bytes.slice(i, i + Number(len)) }); i += Number(len);
      }
      else if (wt === 1) { i += 8; if (i > bytes.length) { return null; } }
      else if (wt === 5) { i += 4; if (i > bytes.length) { return null; } }
      else { return null; }
    }
    return out;
  }
  function pbAll(f, n) { return f.filter(function (x) { return x.n === n; }); }
  function pbOne(f, n) { var a = pbAll(f, n); return a.length === 1 ? a[0] : null; }

  /* what a Tron transaction really is, read from the bytes that get signed */
  function tronFacts(rawHex) {
    var bytes = bytesOf(rawHex); if (!bytes || !bytes.length) { return null; }
    var raw = pb(bytes); if (!raw) { return null; }
    var cs = pbAll(raw, 11); if (cs.length !== 1 || !cs[0].b) { return null; }       /* one contract call, no more */
    var c = pb(cs[0].b); if (!c) { return null; }
    var type = pbOne(c, 1), any = pbOne(c, 2); if (!type || type.v === undefined || !any || !any.b) { return null; }
    var a = pb(any.b); if (!a) { return null; }
    var val = pbOne(a, 2); if (!val || !val.b) { return null; }
    var v = pb(val.b); if (!v) { return null; }
    var owner = pbOne(v, 1), to = pbOne(v, 2), call = pbAll(v, 3), data = pbOne(v, 4);
    if (!owner || !owner.b || owner.b.length !== 21 || !to || !to.b || to.b.length !== 21 || call.length > 1) { return null; }
    if (pbAll(v, 5).length || pbAll(v, 6).length) { return null; }                    /* no TRC-10 token rides along */
    var exp = pbOne(raw, 8), fee = pbOne(raw, 18);
    return { type: type.v, owner: hexOf(owner.b), contract: hexOf(to.b),
             call: call.length && call[0].v !== undefined ? call[0].v : 0n,
             data: data && data.b ? hexOf(data.b) : '',
             expiration: exp && exp.v !== undefined ? exp.v : 0n, feeLimit: fee && fee.v !== undefined ? fee.v : 0n };
  }

  /* who pays for a Solana transaction: the first key of its message */
  function solPayer(data) {
    var b = b64(data), i = 0, n, k;
    if (!b || b.length < 100 || b.length > 4096) { return null; }
    function compact() { var v = 0, sh = 0, x; do { if (i >= b.length || sh > 14) { return -1; } x = b[i++]; v |= (x & 127) << sh; sh += 7; } while (x & 128); return v; }
    n = compact(); if (n < 1 || n > 8) { return null; }
    i += 64 * n; if (i >= b.length) { return null; }
    if (b[i] & 128) { i++; }                                 /* a versioned message says so in its first byte */
    i += 3;                                                  /* the header: three counts */
    k = compact(); if (k < 1 || i + 32 > b.length) { return null; }
    return b.slice(i, i + 32);
  }
  function sameBytes(x, y) { if (!x || !y || x.length !== y.length) { return false; } for (var i = 0; i < x.length; i++) { if (x[i] !== y[i]) { return false; } } return true; }

  function tron(path, body) {
    if (!/^\/wallet\/[a-z]+$/.test(path)) { return Promise.reject(new Error('bad path')); }
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) { ctl.abort(); } }, TIMEOUT);
    return fetch(TRON_API + path, { method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.text(); })
      .then(function (txt) { clearTimeout(timer); var j = null; try { j = JSON.parse(txt); } catch (e) { } if (!plain(j)) { throw new Error('tron node'); } return j; },
            function (e) { clearTimeout(timer); throw e; });
  }
  /* the id of a Tron transaction is the SHA-256 of its bytes, and the id is the thing the wallet signs */
  function tronId(t) {
    var bytes = bytesOf(t.raw_data_hex);
    if (!bytes) { return Promise.resolve(false); }
    return sha256(bytes).then(function (h) { return hexOf(h) === String(t.txID).toLowerCase(); }, function () { return false; });
  }

  var TW = {
    p: null, account: '',
    find: function (win) { var w = win || root; return w && ((w.tronLink && typeof w.tronLink.request === 'function') || w.tronWeb) ? w : null; },
    web: function () { var w = this.p; return (w && (w.tronWeb || (w.tronLink && w.tronLink.tronWeb))) || null; },
    read: function () {
      var tw = this.web(), a = tw && tw.defaultAddress && tw.defaultAddress.base58;
      return typeof a === 'string' && tronHex(a) ? a : '';
    },
    connect: function () {
      var self = this, w = this.p;
      if (!w) { return Promise.reject(new Error('no wallet')); }
      var asked = w.tronLink && typeof w.tronLink.request === 'function' ? w.tronLink.request({ method: 'tron_requestAccounts' }) : null;
      return Promise.resolve(asked).then(function (r) {
        if (r && r.code === 4001) { var e = new Error('rejected'); e.code = 4001; throw e; }
        var a = self.read();
        if (!a) { throw new Error('no account'); }
        return checkSum(a).then(function (okd) { if (okd === false) { throw new Error('no account'); } self.account = a; return a; });
      });
    },
    constant: function (token, owner, selector, param) {
      return tron('/wallet/triggerconstantcontract', { owner_address: owner, contract_address: token, function_selector: selector, parameter: param, visible: true })
        .then(function (j) {
          var r = Array.isArray(j.constant_result) && typeof j.constant_result[0] === 'string' ? j.constant_result[0] : '';
          return /^[0-9a-fA-F]{1,64}$/.test(r) ? BigInt('0x' + r) : null;
        });
    },
    balance: function (token, owner) {
      if (token === TRX) { return tron('/wallet/getaccount', { address: owner, visible: true }).then(function (j) { return typeof j.balance === 'number' && j.balance >= 0 ? BigInt(j.balance) : 0n; }); }
      return this.constant(token, owner, 'balanceOf(address)', pad32(tronHex(owner).slice(2)));
    },
    allowance: function (token, owner, spender) {
      return this.constant(token, owner, 'allowance(address,address)', pad32(tronHex(owner).slice(2)) + pad32(tronHex(spender).slice(2)));
    },
    /* the wallet signs; what comes back must be the very transaction that went in, with a signature on it */
    sign: function (t) {
      var tw = this.web();
      if (!tw || !tw.trx || typeof tw.trx.sign !== 'function') { return Promise.reject(new Error('no wallet')); }
      return Promise.resolve(tw.trx.sign(t)).then(function (s) {
        if (!plain(s) || s.txID !== t.txID || s.raw_data_hex !== t.raw_data_hex || !Array.isArray(s.signature) || !s.signature.length ||
            typeof s.signature[0] !== 'string' || !/^[0-9a-fA-F]{130}$/.test(s.signature[0])) { throw { soft: 'signature' }; }
        return s;
      });
    },
    broadcast: function (signed) {
      return tron('/wallet/broadcasttransaction', signed).then(function (j) {
        if (j.result !== true) { var e = new Error(String(j.code || j.message || 'not accepted').slice(0, 80)); throw e; }
        return signed.txID;
      });
    },
    receipt: function (id) {
      return tron('/wallet/gettransactioninfobyid', { value: id }).then(function (j) {
        if (!j.id) { return null; }                                         /* not in a block yet */
        if (j.result === 'FAILED') { return false; }
        if (plain(j.receipt) && typeof j.receipt.result === 'string') { return j.receipt.result === 'SUCCESS'; }
        return true;
      });
    }
  };
  function tronWait(id, tries) {
    tries = tries === undefined ? 60 : tries;
    var again = function () { return tries <= 0 ? null : new Promise(function (res) { setTimeout(res, POLL); }).then(function () { return tronWait(id, tries - 1); }); };
    return TW.receipt(id).then(function (r) { return r === null ? again() : r; }, again);
  }

  var SW = {
    p: null, account: '',
    find: function (win) {
      var w = win || root, s = w && (w.solana || (w.phantom && w.phantom.solana));
      return s && typeof s.connect === 'function' ? s : null;
    },
    key: function (r) {
      var k = (r && r.publicKey) || (this.p && this.p.publicKey), a = k && typeof k.toString === 'function' ? k.toString() : '';
      var raw = typeof a === 'string' && a.length >= 32 && a.length <= 44 ? b58(a) : null;
      return raw && raw.length === 32 ? a : '';
    },
    connect: function () {
      var self = this;
      if (!this.p) { return Promise.reject(new Error('no wallet')); }
      return Promise.resolve(this.p.connect()).then(function (r) {
        var a = self.key(r);
        if (!a) { throw new Error('no account'); }
        self.account = a; return a;
      });
    },
    /* The bytes go to the wallet exactly as LI.FI built them. Wallets differ in how they take them: the request form
       first, and for one that does not know it, an object that hands back those same bytes when asked to serialise. */
    send: function (bytes) {
      var p = this.p, u8 = new Uint8Array(bytes);
      if (!p) { return Promise.reject(new Error('no wallet')); }
      var first = typeof p.request === 'function'
        ? Promise.resolve().then(function () { return p.request({ method: 'signAndSendTransaction', params: { message: b58enc(bytes) } }); })
        : Promise.reject(new Error('no request'));
      return first.catch(function (e) {
        if ((e && e.code === 4001) || typeof p.signAndSendTransaction !== 'function') { throw e; }
        return p.signAndSendTransaction({ version: 0, serialize: function () { return u8; } });
      }).then(function (r) {
        var sig = typeof r === 'string' ? r : (r && typeof r.signature === 'string' ? r.signature : '');
        var raw = sig.length >= 64 && sig.length <= 90 ? b58(sig) : null;
        if (!raw || raw.length !== 64) { throw { soft: 'signature' }; }
        return sig;
      });
    }
  };

  /* ------------------------------------------------------------------ Bitcoin
   * A swap that starts on Bitcoin is not a contract call: LI.FI builds a plain Bitcoin transaction that spends the
   * reader's own coins and pays a deposit address it names. The wallet is asked to sign that transaction, so what it
   * contains has to be read first, byte by byte, from the PSBT itself — the amount leaving the reader's hands, where
   * it goes, and what comes back as change. */
  var BTC_FEE_CAP = 50000n;                       /* the miners' fee this page will let a transaction carry, in satoshi */

  /* bech32 addresses hold five bits per letter; these are the bytes underneath */
  function bech32Data(addr) {
    if (!bechOk(addr)) { return null; }
    var low = addr.toLowerCase(), pos = low.lastIndexOf('1'), data = low.slice(pos + 1, low.length - 6), i, c;
    var bits = 0, acc = 0, out = [], ver = B32.indexOf(data.charAt(0));
    if (ver < 0 || ver > 16 || low.slice(0, pos) !== 'bc') { return null; }
    for (i = 1; i < data.length; i++) {
      c = B32.indexOf(data.charAt(i)); if (c < 0) { return null; }
      acc = (acc << 5) | c; bits += 5;
      if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
    }
    if (bits >= 5 || ((acc << (8 - bits)) & 255)) { return null; }        /* no spare bits may carry anything */
    return { ver: ver, prog: out };
  }

  /* what a Bitcoin address says must be written into an output for it to be paid */
  function btcScript(addr) {
    if (typeof addr !== 'string') { return ''; }
    if (addr.indexOf('bc1') === 0) {
      var d = bech32Data(addr); if (!d) { return ''; }
      if (d.ver === 0 && (d.prog.length === 20 || d.prog.length === 32)) { return (d.prog.length === 20 ? '0014' : '0020') + hexOf(d.prog); }
      if (d.ver === 1 && d.prog.length === 32) { return '5120' + hexOf(d.prog); }
      return '';
    }
    var raw = b58(addr);
    if (!raw || raw.length !== 25) { return ''; }
    if (raw[0] === 0x00) { return '76a914' + hexOf(raw.slice(1, 21)) + '88ac'; }
    if (raw[0] === 0x05) { return 'a914' + hexOf(raw.slice(1, 21)) + '87'; }
    return '';
  }

  /* a PSBT, read plainly: the transaction that will be signed, every coin it spends and every payment it makes */
  function psbtRead(hex) {
    var b = bytesOf(hex), i = 5, nin, nout, j, k, n, ins = [], outs = [], tx, maps = [];
    if (!b || b.length < 10 || hexOf(b.slice(0, 5)) !== '70736274ff') { return null; }
    function num(bytes, at, len) { var v = 0n, q; for (q = len - 1; q >= 0; q--) { v = (v << 8n) | BigInt(bytes[at + q]); } return v; }
    function vi(bytes, at) {                                        /* a count, as Bitcoin writes counts */
      var h = bytes[at];
      if (h === undefined) { return null; }
      if (h < 0xfd) { return { v: BigInt(h), at: at + 1 }; }
      var len = h === 0xfd ? 2 : h === 0xfe ? 4 : 8;
      if (at + 1 + len > bytes.length) { return null; }
      return { v: num(bytes, at + 1, len), at: at + 1 + len };
    }
    function kv(at) {                                               /* one key-value map, to its closing zero */
      var m = {}, r, kl, key, vl;
      for (;;) {
        r = vi(b, at); if (!r) { return null; }
        at = r.at; kl = Number(r.v);
        if (kl === 0) { return { m: m, at: at }; }
        if (at + kl > b.length) { return null; }
        key = hexOf(b.slice(at, at + kl)); at += kl;
        r = vi(b, at); if (!r) { return null; }
        at = r.at; vl = Number(r.v);
        if (vl < 0 || at + vl > b.length) { return null; }
        m[key] = b.slice(at, at + vl); at += vl;
      }
    }
    var g = kv(i); if (!g || !g.m['00']) { return null; }
    i = g.at; tx = g.m['00'];
    /* the unsigned transaction itself: its inputs name coins, its outputs name payments */
    j = 4;
    var r1 = vi(tx, j); if (!r1) { return null; }
    j = r1.at; nin = Number(r1.v);
    if (!(nin > 0 && nin <= 1000)) { return null; }
    for (n = 0; n < nin; n++) {
      j += 36;
      var rs = vi(tx, j); if (!rs) { return null; }
      j = rs.at + Number(rs.v) + 4;
      if (j > tx.length) { return null; }
    }
    var r2 = vi(tx, j); if (!r2) { return null; }
    j = r2.at; nout = Number(r2.v);
    if (!(nout > 0 && nout <= 1000)) { return null; }
    for (n = 0; n < nout; n++) {
      if (j + 8 > tx.length) { return null; }
      var val = num(tx, j, 8); j += 8;
      var rl = vi(tx, j); if (!rl) { return null; }
      j = rl.at; k = Number(rl.v);
      if (j + k > tx.length) { return null; }
      outs.push({ value: val, script: hexOf(tx.slice(j, j + k)) }); j += k;
    }
    if (j + 4 !== tx.length) { return null; }                       /* nothing may trail the transaction */
    for (n = 0; n < nin; n++) {
      var im = kv(i); if (!im) { return null; }
      i = im.at;
      var w = im.m['01'];                                           /* the coin being spent: its amount and whose it is */
      if (!w || w.length < 9) { return null; }
      var sl = vi(w, 8); if (!sl) { return null; }
      if (sl.at + Number(sl.v) !== w.length) { return null; }
      ins.push({ value: num(w, 0, 8), script: hexOf(w.slice(sl.at)) });
    }
    for (n = 0; n < nout; n++) { var om = kv(i); if (!om) { return null; } i = om.at; maps.push(om); }
    if (i !== b.length) { return null; }
    return { tx: hexOf(tx), ins: ins, outs: outs };
  }

  /* Bitcoin cannot be taken back, so this is where the whole of it is settled: the reader parts with the amount they
     typed and a miners' fee no larger than the cap above, and everything else returns to them as change. */
  function checkBitcoin(x, req) {
    if (typeof x.data !== 'string' || x.data.length < 20 || x.data.length > 200000) { return 'data'; }
    if (!isUint(String(x.value))) { return 'value'; }
    var want = BigInt(req.fromAmount);
    if (BigInt(x.value) !== want) { return 'nativeValue'; }           /* on Bitcoin there is only the coin itself */
    var mine = btcScript(req.account), dest = btcScript(x.to);
    if (!mine || !dest || dest === mine) { return 'to'; }            /* the deposit address is never the reader's own */
    var p = psbtRead(x.data); if (!p) { return 'data'; }
    var inSum = 0n, outSum = 0n, back = 0n, paid = 0n, i;
    for (i = 0; i < p.ins.length; i++) {
      if (p.ins[i].script !== mine) { return 'txFrom'; }               /* only the reader's own coins are spent */
      inSum += p.ins[i].value;
    }
    for (i = 0; i < p.outs.length; i++) {
      outSum += p.outs[i].value;
      if (p.outs[i].script === mine) { back += p.outs[i].value; }
      if (p.outs[i].script === dest) { paid += p.outs[i].value; }
    }
    if (inSum <= outSum) { return 'feeLimit'; }
    var fee = inSum - outSum;
    if (fee > BTC_FEE_CAP || fee > want) { return 'feeLimit'; }        /* the miners' fee, held to a ceiling */
    if (inSum - back !== want + fee) { return 'spend'; }               /* exactly the amount typed leaves, and no more */
    if (paid * 50n < want * 49n) { return 'toAddress'; }               /* nearly all of it reaches the deposit address */
    return null;
  }

  /* the Bitcoin wallet in the browser: it alone holds the keys, and it alone sends the transaction to the network */
  var BW = {
    p: null, account: '',
    find: function (win) {
      var w = win || root, b = w && (w.bitcoin || (w.trustwallet && w.trustwallet.bitcoin));
      return b && (typeof b.requestAccounts === 'function' || typeof b.connect === 'function') ? b : null;
    },
    pick: function (r) {
      var a = Array.isArray(r) ? r[0] : (r && typeof r === 'object' ? (r.address || (Array.isArray(r.addresses) ? r.addresses[0] : '')) : r);
      if (a && typeof a === 'object') { a = a.address; }
      return typeof a === 'string' && btcScript(a) ? a : '';
    },
    connect: function () {
      var self = this, p = this.p;
      if (!p) { return Promise.reject(new Error('no wallet')); }
      var asked = typeof p.requestAccounts === 'function' ? p.requestAccounts() : p.connect();
      return Promise.resolve(asked).then(function (r) {
        var a = self.pick(r);
        if (!a) { throw new Error('no account'); }
        self.account = a; return a;
      });
    },
    read: function () { return this.account; },
    /* the wallet is asked again, right before signing, that it is still the same address this swap was built for */
    current: function () {
      var p = this.p, self = this;
      if (!p || typeof p.getAccounts !== 'function') { return Promise.resolve(this.account); }
      return Promise.resolve(p.getAccounts()).then(function (r) { return self.pick(r) || self.account; }, function () { return self.account; });
    },
    /* the wallet signs the transaction; what comes back must still be the very transaction that went in */
    sign: function (hex) {
      var p = this.p, fn = p && (p.signPSBT || p.signPsbt);
      if (typeof fn !== 'function') { return Promise.reject(new Error('no wallet')); }
      var before = psbtRead(hex);
      return Promise.resolve(fn.call(p, hex)).then(function (r) {
        var out = typeof r === 'string' ? r : (r && typeof r.psbt === 'string' ? r.psbt : '');
        if (out && !/^[0-9a-fA-F]+$/.test(out)) { var raw = b64(out); out = raw ? hexOf(raw) : ''; }
        var after = out ? psbtRead(out) : null;
        if (!after || !before || after.tx !== before.tx) { throw { soft: 'signature' }; }
        return out;
      });
    },
    send: function (hex) {
      var p = this.p, fn = p && (p.pushPSBT || p.pushPsbt);
      if (typeof fn !== 'function') { return Promise.reject(new Error('no wallet')); }
      return Promise.resolve(fn.call(p, hex)).then(function (r) {
        var id = typeof r === 'string' ? r : (r && typeof r.txid === 'string' ? r.txid : '');
        if (!/^[0-9a-f]{64}$/.test(id)) { throw { soft: 'signature' }; }
        return id;
      });
    }
  };

  function checkTron(x, e, req) {
    var t = plain(x.customData) ? x.customData.tronTransaction : null;
    if (!plain(t) || !plain(t.raw_data) || typeof t.raw_data_hex !== 'string' || !/^[0-9a-f]{20,400000}$/.test(t.raw_data_hex)) { return 'tronShape'; }
    if (typeof t.txID !== 'string' || !/^[0-9a-f]{64}$/.test(t.txID)) { return 'tronId'; }
    if (x.data !== '0x' + t.raw_data_hex) { return 'data'; }
    if (Number(x.chainId) !== Number(req.fromChain)) { return 'txChain'; }
    var f = tronFacts(t.raw_data_hex), me = tronHex(req.account), lifi = tronHex(req.contract);
    if (!f || !me || !lifi) { return 'tronShape'; }
    if (f.type !== 31n) { return 'tronType'; }                         /* a call to a contract, and nothing else */
    if (f.owner !== me) { return 'txFrom'; }
    if (f.contract !== lifi) { return 'contract'; }                    /* LI.FI's own contract on Tron, pinned */
    if (req.fromToken === TRX) { if (f.call !== BigInt(req.fromAmount)) { return 'nativeValue'; } }
    else {
      if (f.call !== 0n) { return 'tokenValue'; }
      if (e.approvalAddress !== req.contract) { return 'approvalAddress'; }
    }
    if (!(f.feeLimit > 0n && f.feeLimit <= TRON_FEE_CAP)) { return 'feeLimit'; }
    if (!(f.expiration > BigInt(Date.now()))) { return 'expired'; }
    return null;
  }
  function checkSolana(x, req) {
    if (typeof x.data !== 'string' || x.data.length < 100 || x.data.length > 6000) { return 'data'; }
    var payer = solPayer(x.data), me = b58(req.account);
    if (!payer || !me || me.length !== 32) { return 'data'; }
    if (!sameBytes(payer, me)) { return 'txFrom'; }                    /* the reader's own key pays for it */
    return null;
  }

  /* ------------------------------------------------------------------ is this answer really our request?
   * Everything the wallet would be asked to sign is checked here. Anything off and the swap stops. */
  /* What this page keeps of a swap is written in the quote, under the fee LI.FI collects for it. It is read back
     here and held to the figure the reader was shown: a page that quietly took more than it said would be a worse
     kind of wrong than any of the rest. */
  function ourFee(q, who) {
    var a = (q.estimate && q.estimate.feeCosts) || [], i, j, r, out = null;
    for (i = 0; i < a.length; i++) {
      r = plain(a[i]) && plain(a[i].feeSplit) && Array.isArray(a[i].feeSplit.recipients) ? a[i].feeSplit.recipients : null;
      if (!r) { continue; }
      for (j = 0; j < r.length; j++) {
        if (plain(r[j]) && r[j].name === who && isUint(String(r[j].fee))) { out = (out || 0n) + BigInt(r[j].fee); }
      }
    }
    return out;
  }

  function checkQuote(q, req) {
    if (!plain(q) || !plain(q.action) || !plain(q.estimate) || !plain(q.transactionRequest)) { return 'shape'; }
    var a = q.action, e = q.estimate, x = q.transactionRequest;
    if (Number(a.fromChainId) !== Number(req.fromChain)) { return 'fromChain'; }
    if (Number(a.toChainId) !== Number(req.toChain)) { return 'toChain'; }
    var kind = req.kind || 'evm';
    var fsame = kind === 'evm' ? sameAddr : function (x, y) { return typeof x === 'string' && x === y; };
    if (!plain(a.fromToken) || !fsame(a.fromToken.address, req.fromToken)) { return 'fromToken'; }
    /* On Bitcoin, Tron, Solana, Sui and Stellar an address is written in base58 or base32, where capitals carry
       meaning: there the comparison must be letter for letter, never the case-insensitive one EVM allows. */
    var same = req.exactTo ? function (x, y) { return typeof x === 'string' && x === y; } : sameAddr;
    if (!plain(a.toToken) || !same(a.toToken.address, req.toToken)) { return 'toToken'; }
    if (String(a.fromAmount) !== String(req.fromAmount)) { return 'fromAmount'; }
    var mine = ourFee(q, req.integrator);                                   /* what this page keeps, never above what it showed */
    if (mine !== null && req.fee) {
      var top = (BigInt(req.fromAmount) * BigInt(Math.round(req.fee * 1e6)) * 102n) / 100000000n;
      if (mine > top + 1n) { return 'ourFee'; }
    }
    if (!fsame(a.fromAddress, req.account)) { return 'fromAddress'; }
    /* where the money comes out: what the reader typed, or their own wallet when both ends are the same kind of network */
    if (!same(a.toAddress, req.recipient || req.account)) { return 'toAddress'; }
    if (!isUint(String(e.toAmount)) || !isUint(String(e.toAmountMin))) { return 'toAmount'; }
    if (BigInt(e.toAmountMin) > BigInt(e.toAmount)) { return 'toAmountMin'; }
    if (BigInt(e.toAmount) <= 0n) { return 'empty'; }
    /* The reader picks how far the price may move against them — 0.1%, 0.5%, 1% or 3%. That choice is sent with the
       question, but the answer carries the floor that will be written into the transaction, and nothing until now
       made sure the two agreed. An answer whose floor is lower than the reader allowed is refused here: otherwise a
       route could hand back a floor near zero, the page would show a healthy price, and the trade could still fill
       at almost any price once it reached the chain. */
    if (req.slippage !== undefined) {
      var allow = Math.round((1 - Number(req.slippage)) * 1000000);
      if (!(allow > 0 && allow <= 1000000)) { return 'slippage'; }
      /* the service floors this figure, so the comparison is floored the same way and one unit is left for rounding */
      if (BigInt(e.toAmountMin) + 1n < (BigInt(e.toAmount) * BigInt(allow)) / 1000000n) { return 'minTooLow'; }
      if (a.slippage !== undefined && !(Number(a.slippage) >= 0 && Number(a.slippage) <= Number(req.slippage) + 1e-9)) { return 'slippageBack'; }
    }
    /* the decimals the page will count in must be the token's own, or every figure shown would be wrong */
    if (req.fromDecimals !== undefined && Number(a.fromToken.decimals) !== Number(req.fromDecimals)) { return 'fromDecimals'; }
    if (req.toDecimals !== undefined && Number(a.toToken.decimals) !== Number(req.toDecimals)) { return 'toDecimals'; }
    if (kind === 'tron') { return checkTron(x, e, req); }
    if (kind === 'solana') { return checkSolana(x, req); }
    if (kind === 'utxo') { return checkBitcoin(x, req); }
    if (kind !== 'evm') { return 'kind'; }
    if (!isAddr(x.to)) { return 'to'; }
    /* the transaction must be addressed to LI.FI's own contract for this chain and nowhere else. The address is kept
       in scripts/swap_chains.json, read from LI.FI's own /v1/chains. If they ever move it the swap stops here. */
    if (!sameAddr(x.to, req.contract)) { return 'contract'; }
    if (!isHexData(x.data)) { return 'data'; }
    if (x.data.length > 400000) { return 'dataSize'; }                 /* no route needs call data this large */
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
    /* what the token itself says its places are. A gift is built from the figure in our own list, and a swap has the
       service's answer checked against it — but a gift asks nobody, so before the first transfer of a token the
       token is asked directly. One place out means a thousand times too much or too little. */
    decimals: function (token) {
      return this.call(token, ERC20.decimals).then(function (h) {
        var v = hexToBig(h);
        return v !== null && v >= 0n && v <= 36n ? Number(v) : null;
      }, function () { return null; });
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
  var POLL = 3000;               /* how often a Tron transaction is looked for in a block */
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
      if (live) { labels(); paint(); if (G) { giftLabels(); giftPaint(); } }
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
      'rcp', 'rcp-box', 'rcp-c', 'ack-a',
      'tokenwarn', 'ackbox', 'ack', 'account', 'action', 'action-l', 'action-x', 'msg', 'status', 'dlg', 'dlg-title',
      'dlg-q', 'dlg-list', 'dlg-find', 'dlg-close'].forEach(function (k) { el[k] = $('sw-' + k); });
    for (var k0 in el) { if (own(el, k0) && !el[k0]) { return state('off'); } }      /* a page missing a part does not half-work */

    /* parts a page may or may not carry: other routes, the bridge note, the reader's own history, the monthly report */
    var X = {};
    ['routes', 'routes-go', 'bridge', 'hist', 'hist-list', 'hist-clear', 'rep', 'rep-out', 'track', 'track-sum', 'track-st', 'track-close', 'track-copy', 'track-tip', 'mode', 'adv', 'mob', 'coin', 'morebox', 'more', 'more-a', 'more-b'].forEach(function (k) { X[k] = $('sw-' + k); });
    S.alts = []; S.altT = []; S.altState = ''; S.rep = ''; S.mode = 'simple'; S.more = false; S.coins = null; S.link = '';

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

    /* The shapes come from the page, built from scripts/swap_chains.json. Each is compiled once, and only if it is
       made of the handful of characters an address pattern needs — a pattern arriving from anywhere else is dropped. */
    var SHAPES = (function () {
      var out = {}, raw = data.addr, k;
      if (!plain(raw)) { return out; }
      for (k in raw) {
        if (!own(raw, k) || typeof raw[k] !== 'string' || raw[k].length > 160) { continue; }
        if (!/^[\^\$\(\)\?:|\[\]{},0-9A-Za-z\\\-]+$/.test(raw[k])) { continue; }
        try { out[k] = new RegExp(raw[k]); } catch (e) { }
      }
      return out;
    })();

    function toOnly(c) { return !!(c && c.to_only === true); }
    function kindOf(c) { return c && typeof c.kind === 'string' ? c.kind : 'evm'; }
    /* the wallet that signs for the network the swap starts on */
    function srcW() { var k = kindOf(chainById(S.from.chain)); return k === 'tron' ? TW : k === 'solana' ? SW : k === 'utxo' ? BW : W; }
    /* The swap comes out at the reader's own address only when both ends are the same kind of network, because one
       wallet address means nothing on another kind. Everywhere else the reader says where it should arrive. */
    function needRcp() {
      var fc = chainById(S.from.chain), tc = chainById(S.to.chain);
      return !!tc && (toOnly(tc) || kindOf(fc) !== kindOf(tc));
    }

    /* '' nothing typed · 'bad' the wrong shape or a failed check · 'wait' the check is still running · 'ok' */
    var sums = {};
    function rcpState() {
      var c = chainById(S.to.chain);
      if (!needRcp()) { return 'ok'; }
      if (!S.rcp) { return ''; }
      if (kindOf(c) === 'evm') { return isAddr(S.rcp) ? 'ok' : 'bad'; }
      if (!fits(SHAPES, c.kind, S.rcp)) { return 'bad'; }
      if (!needsSum(c.kind, S.rcp)) { return 'ok'; }
      var a = S.rcp;
      if (own(sums, a)) { return sums[a] === false ? 'bad' : 'ok'; }   /* null: no hashing here, the shape must do */
      checkSum(a).then(function (v) {
        if (own(sums, a)) { return; }
        sums[a] = v;
        if (a === S.rcp) { paint(); ask(); }
      });
      return 'wait';
    }
    function rcpOk() { return rcpState() === 'ok'; }

    function needsAck() {
      var unv = (S.from.token && S.from.token.verified === false) || (S.to.token && S.to.token.verified === false);
      /* S.impact is null when the service gave no worth for one side or the other. That is not a quiet yes: with no
         way to tell a fair price from a terrible one, the reader is asked to look and confirm. */
      return !!S.q && (unv || needRcp() || S.impact === null || S.impact >= IMPACT_ACK);
    }

    /* ---- what the main button says and does */
    function paint() {
      var fromChain = chainById(S.from.chain), need, label, extra = '', dis = true;
      var unv = (S.from.token && S.from.token.verified === false) || (S.to.token && S.to.token.verified === false);
      el.msg.textContent = S.err || S.note || (S.done ? t('done') : '');
      el.msg.setAttribute('data-ok', S.err ? '' : (S.done && !S.note ? '1' : ''));
      var src = srcW(), evmSrc = src === W;
      el.account.textContent = src.account ? short(src.account) : '';
      el.balance.textContent = S.bal === null || !S.from.token ? '' : formatUnits(S.bal, S.from.token.decimals, 6) + ' ' + S.from.token.symbol;
      el.tokenwarn.textContent = unv ? t('unverified') : (S.q && S.impact !== null && S.impact >= IMPACT_WARN ? t('impactHigh') : '');
      el.ackbox.hidden = !needsAck();
      var tc = chainById(S.to.chain), onlyTo = needRcp(), rcpSt = rcpState();
      el['rcp-box'].hidden = !onlyTo;
      el['rcp-c'].textContent = onlyTo ? tc.name : '';
      /* the wallet shows an EVM transaction, never the far address, so the reader reads it back here instead */
      el['ack-a'].textContent = onlyTo && rcpSt === 'ok' ? S.rcp : '';

      if (S.busy) { label = S.busy; need = 'busy'; }
      else if (!src.p) { label = t('connect'); dis = false; need = 'nowallet'; }
      else if (!src.account) { label = t('connect'); dis = false; need = 'connect'; }
      else if (evmSrc && fromChain && Number(W.chainId) !== Number(fromChain.id)) { label = t('switchChain'); extra = fromChain.name; dis = false; need = 'chain'; }
      else if (!S.amount) { label = t('amount'); need = 'amount'; }
      else if (onlyTo && rcpSt === '') { label = t('rcpNeeded'); need = 'recipient'; }
      else if (onlyTo && rcpSt === 'bad') { label = t('rcpBad'); need = 'badRecipient'; }
      else if (onlyTo && rcpSt === 'wait') { label = t('rcpChecking'); need = 'checking'; }
      else if (S.q && needsAck() && !S.ack) { label = t(onlyTo ? 'confirmAddr' : 'ackNeeded'); need = 'ack'; }
      else if (S.q && S.need === 'approve') { label = t('approve'); extra = S.from.token ? S.from.token.symbol : ''; dis = false; need = 'approve'; }
      else if (S.q) { label = t('swap'); dis = false; need = 'swap'; }
      else { label = t('amount'); need = 'none'; }

      if (X.mob) {
        X.mob.hidden = !!(W.p || TW.p || SW.p || BW.p);    /* no wallet of any kind here: show the way in */
        /* the site's own desktop app carries no wallet extension, and a phone wallet is no help there */
        X.mob.setAttribute('data-app', /EntekhabWin\//.test(String((win.navigator && win.navigator.userAgent) || '')) ? 'win' : '');
      }
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
      if (!q) { names.forEach(function (n) { el[n].textContent = ''; }); el.impact.setAttribute('data-level', ''); if (X.bridge) { X.bridge.textContent = ''; } advanced(null); return; }
      var ft = S.from.token, tt = S.to.token, e = q.estimate;
      el.receive.textContent = formatUnits(e.toAmount, tt.decimals, 8);
      el.min.textContent = formatUnits(e.toAmountMin, tt.decimals, 8) + ' ' + tt.symbol;
      el['from-usd'].textContent = usd(e.fromAmountUSD); el['to-usd'].textContent = usd(e.toAmountUSD);
      /* 1 of the source token in the destination token, by whole numbers only */
      var num = BigInt(e.toAmount) * (10n ** BigInt(ft.decimals)) * 1000000n, den = BigInt(q.action.fromAmount) * (10n ** BigInt(tt.decimals));
      el.rate.textContent = den > 0n ? '1 ' + ft.symbol + ' ≈ ' + formatUnits(num / den, 6, 6) + ' ' + tt.symbol : '';
      el.route.textContent = S.mode === 'adv' ? steps(q) : toolName(q);
      advanced(q);
      /* a swap between two networks rides a bridge: say which, and that it is a risk of its own */
      if (X.bridge) {
        X.bridge.textContent = '';
        if (Number(q.action.fromChainId) !== Number(q.action.toChainId) && toolName(q)) {
          var bn = doc.createElement('b'); bn.setAttribute('translate', 'no'); bn.textContent = toolName(q) + ' — ';
          var bs = doc.createElement('span'); bs.textContent = t('bridgeNote');
          X.bridge.appendChild(bn); X.bridge.appendChild(bs);
        }
      }
      var g = 0, f = 0, i;
      for (i = 0; i < (e.gasCosts || []).length; i++) { g += Number(e.gasCosts[i].amountUSD || 0); }
      for (i = 0; i < (e.feeCosts || []).length; i++) { f += Number(e.feeCosts[i].amountUSD || 0); }
      el.gas.textContent = usd(g) || '—'; el.fee.textContent = usd(f) || '—';
      var d = Number(e.executionDuration || 0);
      el.time.textContent = took(d) || '—';
      var a = Number(e.fromAmountUSD), b = Number(e.toAmountUSD);
      if (isFinite(a) && isFinite(b) && a > 0 && b >= 0) {
        S.impact = Math.max(0, (1 - b / a) * 100);
        el.impact.textContent = S.impact < 0.01 ? '< 0.01%' : '−' + S.impact.toFixed(2) + '%';
        el.impact.setAttribute('data-level', S.impact >= IMPACT_ACK ? '2' : S.impact >= IMPACT_WARN ? '1' : '0');
      } else { el.impact.textContent = '—'; el.impact.setAttribute('data-level', ''); }
    }

    function toolName(q) { return String((q.toolDetails && q.toolDetails.name) || q.tool || '').replace(/[^\w .()-]/g, '').slice(0, 40); }
    /* the tools a route passes through, in order, as LI.FI lists them; its own fee-collecting step is not a stop */
    function steps(q) {
      var a = Array.isArray(q.includedSteps) ? q.includedSteps : [], out = [];
      a.forEach(function (st) {
        if (!plain(st) || st.type === 'protocol') { return; }
        var n = toolName(st);
        if (n && out[out.length - 1] !== n) { out.push(n); }
      });
      return out.length ? out.slice(0, 6).join(' → ') : toolName(q);
    }
    /* the advanced view: more of the same answer, laid out. It asks the network for nothing. */
    function advanced(q) {
      if (!X.adv) { return; }
      X.adv.textContent = '';
      X.adv.hidden = S.mode !== 'adv' || !q;
      if (!q) { return; }
      var row = function (label, value) {
        var r = doc.createElement('div'), a1 = doc.createElement('span'), b1 = doc.createElement('b');
        r.setAttribute('class', 'sw-q'); a1.textContent = label; b1.setAttribute('dir', 'ltr'); b1.setAttribute('translate', 'no'); b1.textContent = value;
        r.appendChild(a1); r.appendChild(b1); X.adv.appendChild(r);
      };
      var e = q.estimate, units = 0n, i, f, shown = 0;
      row(t('advSteps'), steps(q));
      for (i = 0; i < (e.gasCosts || []).length; i++) { if (plain(e.gasCosts[i]) && isUint(String(e.gasCosts[i].estimate))) { units += BigInt(e.gasCosts[i].estimate); } }
      if (units > 0n) { row(t('advGas'), units.toString()); }
      for (i = 0; i < (e.feeCosts || []).length && shown < 6; i++) {
        f = e.feeCosts[i];
        if (!plain(f) || typeof f.name !== 'string' || !usd(f.amountUSD)) { continue; }
        row(shown === 0 ? t('advFees') : '', f.name.replace(/[^\w .()%-]/g, '').slice(0, 40) + ' · ' + usd(f.amountUSD)); shown++;
      }
    }
    function setMode(m) {
      S.mode = m === 'adv' ? 'adv' : 'simple';
      if (X.mode && X.mode.querySelectorAll) {
        var bs = X.mode.querySelectorAll('[data-mode]'), i;
        for (i = 0; i < bs.length; i++) { bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-mode') === S.mode ? 'true' : 'false'); }
      }
      if (S.q) { el.route.textContent = S.mode === 'adv' ? steps(S.q) : toolName(S.q); }
      advanced(S.q);
    }

    /* ---- what the site itself already knows about these two coins
     * Two files of this very site, read once and only after a price is on screen: the coin's Entekhab score, and
     * how much the large wallets moved in a day where that is measured. It is shown plainly, as a figure with the
     * day it was worked out — never as advice to swap one coin or hold another. Nothing leaves the page for it. */
    var SCORE = '/data/score.json', WHALE = '/data/whales.json';
    function sym(tk) { return tk && typeof tk.symbol === 'string' ? tk.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) : ''; }
    function ourJson(path) {
      return fetch(path, { credentials: 'omit', cache: 'no-store' }).then(function (r) {
        if (!r.ok) { throw new Error('http'); }
        return r.json();
      });
    }
    function coinFacts() {
      if (!X.coin || S.coins) { return; }
      S.coins = 'busy';
      Promise.all([ourJson(SCORE).catch(function () { return null; }), ourJson(WHALE).catch(function () { return null; })]).then(function (r) {
        S.coins = { score: plain(r[0]) && plain(r[0].coins) ? r[0] : null, whale: plain(r[1]) && plain(r[1].totals24) ? r[1] : null };
        paintCoin();
      }, function () { S.coins = null; });
    }
    function day(iso) { var m = /^\d{4}-\d{2}-\d{2}/.exec(String(iso || '')); return m ? m[0] : ''; }
    function coinRow(tk) {
      var k = sym(tk), S2 = S.coins, out = null, sc, wh, row, b;
      if (!k || !plain(S2)) { return null; }
      sc = S2.score && plain(S2.score.coins[k]) ? S2.score.coins[k] : null;
      wh = S2.whale && plain(S2.whale.totals24[k]) ? S2.whale.totals24[k] : null;
      if (!sc && !wh) { return null; }
      row = doc.createElement('div');
      b = doc.createElement('b'); b.setAttribute('translate', 'no'); b.textContent = k; row.appendChild(b);
      if (sc && isFinite(Number(sc.score))) {
        var s1 = doc.createElement('span');
        s1.textContent = t('scoreT') + ': ' + digits(String(Math.round(Number(sc.score)))) + '/' + digits('100') +
          (typeof sc.label === 'string' && t('lbl' + sc.label) !== 'lbl' + sc.label ? ' · ' + t('lbl' + sc.label) : '');
        row.appendChild(s1);
      }
      if (wh && isFinite(Number(wh.usd)) && Number(wh.usd) > 0) {
        var s2 = doc.createElement('span');
        s2.textContent = t('whaleT') + ': ' + usd(Number(wh.usd));
        row.appendChild(s2);
      }
      var when = (sc && S2.score && S2.score.updated_at) || (wh && S2.whale && S2.whale.updated_at);
      if (day(when)) { var i2 = doc.createElement('i'); i2.setAttribute('dir', 'ltr'); i2.textContent = t('asOf') + ' ' + day(when); row.appendChild(i2); }
      out = row; return out;
    }
    function paintCoin() {
      if (!X.coin) { return; }
      X.coin.textContent = '';
      if (!S.q || !plain(S.coins)) { X.coin.hidden = true; return; }
      var rows = [coinRow(S.from.token), coinRow(S.to.token)], any = false, i;
      for (i = 0; i < rows.length; i++) { if (rows[i] && (i === 0 || !rows[0] || rows[i].textContent !== rows[0].textContent)) { X.coin.appendChild(rows[i]); any = true; } }
      X.coin.hidden = !any;
    }

    /* ---- the reader's own choice to give more than the fee asks */
    function pct(v) { return digits((Math.round(Number(v) * 10000) / 100).toString()) + '%'; }
    function moreFee() { return S.more && cfg.fee_zagros ? Number(cfg.fee_zagros) : Number(cfg.fee || 0); }
    function paintMore() {
      if (!X.morebox) { return; }
      X.morebox.hidden = !(cfg.fee_zagros && cfg.fee_zagros > (cfg.fee || 0));
      if (X.morebox.hidden) { return; }
      if (X['more-a']) { X['more-a'].textContent = pct(cfg.fee); }
      if (X['more-b']) { X['more-b'].textContent = pct(cfg.fee_zagros); }
      if (X.more) { X.more.checked = !!S.more; }
    }

    /* ---- the box that stays after signing: what was swapped, how it stands, and the links, until the reader closes it */
    function trackState(st) {
      if (!X['track-st']) { return; }
      X['track-st'].textContent = st === 'done' ? t('trackDone') : st === 'failed' ? t('trackFail') : st === 'sent' ? t('trackGo') : '';
      X['track-st'].setAttribute('data-st', st || '');
    }
    function trackOpen(req, q) {
      if (!X.track || !X['track-sum']) { return; }
      var ft = S.from.token, tt = S.to.token, fc = chainById(req.fromChain), tc = chainById(req.toChain);
      X['track-sum'].textContent = !ft || !tt || !fc || !tc ? '' : formatUnits(req.fromAmount, ft.decimals, 6) + ' ' + ft.symbol + ' → ' +
        formatUnits(q.estimate.toAmount, tt.decimals, 6) + ' ' + tt.symbol + ' · ' + fc.name + (fc === tc ? '' : ' → ' + tc.name);
      X.track.hidden = false; trackState('sent');
    }
    function mark(hash, st) { histMark(hash, st); trackState(st); }

    /* how long, in words a person would use: the figure itself is only ever an estimate */
    function took(d) {
      d = Number(d);
      if (!isFinite(d) || d <= 0) { return ''; }
      return d < 120 ? t('timeFast') : d <= 600 ? t('timeFew') : t('timeAbout') + ' ' + Math.round(d / 60) + ' ' + t('timeMin');
    }
    function toolKey(q) { return typeof q.tool === 'string' && /^[\w-]{1,40}$/.test(q.tool) ? q.tool : ''; }

    /* ---- other routes
     * The service answers with its best route. Asked again with that route's tool left out, it answers with the next
     * one. Each answer goes through the very same checks as the first before it is shown, and one that fails them is
     * simply not offered. Nothing is asked until the reader wants to see more. */
    function paintRoutes() {
      if (!X.routes || !X['routes-go']) { return; }
      X['routes-go'].hidden = !S.q || !!S.altState;
      X.routes.textContent = '';
      if (!S.altState) { return; }
      var tt = S.to.token;
      S.alts.forEach(function (q, i) {
        var b = doc.createElement('button'), d = Number(q.estimate.executionDuration || 0);
        b.setAttribute('type', 'button'); b.setAttribute('class', 'sw-route'); b.setAttribute('data-i', String(i));
        b.setAttribute('aria-pressed', q === S.q ? 'true' : 'false');
        var n = doc.createElement('span'); n.setAttribute('translate', 'no'); n.textContent = toolName(q) + (i === 0 ? ' · ' + t('best') : '') + (i !== 0 && q === S.q ? ' · ' + t('mine') : '');
        var v = doc.createElement('b'); v.setAttribute('translate', 'no'); v.setAttribute('dir', 'ltr');
        v.textContent = formatUnits(q.estimate.toAmount, tt.decimals, 6) + ' ' + tt.symbol + (took(d) ? ' · ' + took(d) : '');
        b.appendChild(n); b.appendChild(v);
        if (steps(q) !== toolName(q)) { var sm = doc.createElement('small'); sm.setAttribute('translate', 'no'); sm.setAttribute('dir', 'ltr'); sm.textContent = steps(q); b.appendChild(sm); }
        b.addEventListener('click', function () { chooseRoute(i); });
        X.routes.appendChild(b);
      });
      if (S.altState === 'busy' || S.alts.length < 2) {
        var m = doc.createElement('div'); m.setAttribute('class', 'sw-route-n'); m.textContent = t(S.altState === 'busy' ? 'routesBusy' : 'routesNone');
        X.routes.appendChild(m);
      }
    }
    function moreRoutes() {
      var q0 = S.q, req = S.qreq, seq = S.seq;
      if (!q0 || !req || S.altState || S.busy) { return; }
      var cross = Number(req.fromChain) !== Number(req.toChain), deny = [toolKey(q0)];
      if (!deny[0]) { return; }
      S.alts = [q0]; S.altT = [S.qt]; S.altState = 'busy'; paintRoutes();
      var next = function (left) {
        if (left <= 0) { return Promise.resolve(); }
        return quote(req, cfg, { cross: cross, deny: deny.join(',') }).then(function (q) {
          if (seq !== S.seq) { return; }
          var k = plain(q) ? toolKey(q) : '';
          if (!k || deny.indexOf(k) >= 0 || checkQuote(q, req)) { return; }      /* not sound: not offered */
          S.alts.push(q); S.altT.push(Date.now()); deny.push(k); paintRoutes();
          return next(left - 1);
        }, function () { });
      };
      next(2).then(function () { if (seq === S.seq) { S.altState = 'done'; paintRoutes(); } });
    }
    function chooseRoute(i) {
      var q = S.alts[i], req = S.qreq, seq = S.seq;
      if (!q || !req || S.busy || q === S.q) { return; }
      if (checkQuote(q, req)) { return; }                               /* checked again, as every route is */
      S.q = q; S.qt = S.altT[i]; S.need = null; S.ack = false; el.ack.checked = false; S.err = ''; S.done = false;
      showQuote(q); paintRoutes(); paint();
      decideApproval(q, req).then(function () { if (seq === S.seq) { paint(); } });
    }

    /* ---- the reader's own swaps, kept in this browser and nowhere else
     * No address is written down: only what was swapped, when, and the public transaction id. Whatever is read back
     * is checked as if a stranger had written it, because another script on this site could have. */
    var HKEY = 'sw_hist', HMAX = 20;
    function histOk(r) {
      return plain(r) && typeof r.t === 'number' && isFinite(r.t) && r.t > 0 && !!chainById(r.fc) && !!chainById(r.tc) &&
        typeof r.fs === 'string' && r.fs.length > 0 && r.fs.length <= 20 && typeof r.ts === 'string' && r.ts.length > 0 && r.ts.length <= 20 &&
        typeof r.fa === 'string' && /^[\d.,]{1,40}$/.test(r.fa) && typeof r.ta === 'string' && /^[\d.,]{1,40}$/.test(r.ta) &&
        typeof r.h === 'string' && !!linkFor(chainById(r.fc), r.h) && (r.st === 'sent' || r.st === 'done' || r.st === 'failed');
    }
    function histLoad() {
      var a = null;
      try { a = JSON.parse(win.localStorage.getItem(HKEY) || '[]'); } catch (e) { a = null; }
      return Array.isArray(a) ? a.filter(histOk).slice(0, HMAX) : [];
    }
    function histSave(a) { try { win.localStorage.setItem(HKEY, JSON.stringify(a.slice(0, HMAX))); } catch (e) { } }
    function histAdd(req, q, hash) {
      if (!X.hist) { return; }
      var ft = S.from.token, tt = S.to.token;
      if (!ft || !tt) { return; }
      var r = { t: Date.now(), fc: Number(req.fromChain), tc: Number(req.toChain), fs: String(ft.symbol).slice(0, 20), ts: String(tt.symbol).slice(0, 20),
                fa: formatUnits(req.fromAmount, ft.decimals, 6), ta: formatUnits(q.estimate.toAmount, tt.decimals, 6), h: hash, st: 'sent' };
      if (!histOk(r)) { return; }
      var a = histLoad(); a.unshift(r); histSave(a); histPaint();
      if (histLoad().length && histLoad()[0].h === hash) { line(t('histSaved'), undefined, undefined, true); }   /* only if it really was kept */
    }
    function histMark(hash, st) {
      if (!X.hist || !hash) { return; }
      var a = histLoad(), hit = false;
      a.forEach(function (r) { if (r.h === hash && r.st === 'sent') { r.st = st; hit = true; } });
      if (hit) { histSave(a); histPaint(); }
    }
    function histPaint() {
      if (!X.hist || !X['hist-list']) { return; }
      var a = histLoad();
      X.hist.hidden = !a.length;
      X['hist-list'].textContent = '';
      a.forEach(function (r) {
        var fc = chainById(r.fc), tc = chainById(r.tc), row = doc.createElement('div'), d = new Date(r.t);
        row.setAttribute('class', 'sw-hrow'); row.setAttribute('data-st', r.st);
        var w = doc.createElement('span'); w.setAttribute('translate', 'no'); w.setAttribute('dir', 'ltr');
        w.textContent = r.fa + ' ' + r.fs + ' → ' + r.ta + ' ' + r.ts;
        var n = doc.createElement('small');
        n.textContent = fc.name + (fc === tc ? '' : ' → ' + tc.name) + ' · ' + d.toISOString().slice(0, 10) + ' · ' + t(r.st === 'done' ? 'histDone' : r.st === 'failed' ? 'histFailed' : 'histSent');
        var l = doc.createElement('a');
        l.setAttribute('href', linkFor(fc, r.h)); l.setAttribute('target', '_blank'); l.setAttribute('rel', 'noopener noreferrer');
        l.setAttribute('translate', 'no'); l.textContent = short(r.h);
        row.appendChild(w); row.appendChild(n); row.appendChild(l);
        X['hist-list'].appendChild(row);
      });
    }

    /* ---- this month, from LI.FI's own public record of swaps made through this page: how many, and how much */
    function report() {
      var out = X['rep-out'];
      if (!X.rep || !out || S.rep || !cfg.integrator) { return; }
      S.rep = 'busy'; out.textContent = t('repBusy');
      var now = new Date(), from = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
      api('/v1/analytics/transfers', { integrator: cfg.integrator, fromTimestamp: from }).then(function (j) {
        var a = Array.isArray(j.transfers) ? j.transfers : [], n = 0, v = 0, i, x;
        for (i = 0; i < a.length && i < 5000; i++) {
          x = plain(a[i]) && a[i].status === 'DONE' && plain(a[i].sending) ? Number(a[i].sending.amountUSD) : NaN;
          if (isFinite(x) && x >= 0 && x < 1e9) { n++; v += x; }
        }
        var money = function (m) { return '$' + (m >= 100 ? m.toFixed(0) : m.toFixed(2)); };
        out.textContent = n ? '' : t('repNone');
        if (n) {
          [['repCount', String(n)], ['repVolume', money(v)], ['repShare', money(v * Number(cfg.fee || 0))]].forEach(function (r) {
            var row = doc.createElement('div'), a1 = doc.createElement('span'), b1 = doc.createElement('b');
            row.setAttribute('class', 'sw-q'); a1.textContent = t(r[0]); b1.setAttribute('dir', 'ltr'); b1.setAttribute('translate', 'no'); b1.textContent = r[1];
            row.appendChild(a1); row.appendChild(b1); out.appendChild(row);
          });
        }
        S.rep = 'done';
      }, function () { out.textContent = t('repErr'); S.rep = ''; });
    }

    function reset(keepNote) {      /* whatever was on screen belonged to the old question */
      S.alts = []; S.altT = []; S.altState = '';
      S.q = null; S.qreq = null; S.need = null; S.ack = false; el.ack.checked = false; S.err = ''; S.done = false;
      if (!keepNote) { S.note = ''; }
      S.busy = ''; S.seq++; showQuote(null); paintRoutes(); paintCoin();
    }

    /* ---- ask for a price; every answer is checked before it is shown */
    var timer = null;
    function askLater() { if (timer) { clearTimeout(timer); } timer = setTimeout(ask, 600); }
    function ask(keepNote) {
      reset(keepNote === true);
      var ft = S.from.token, tt = S.to.token;
      if (!ft || !tt || !ft.address || !tt.address) { paint(); return; }
      if (toOnly(chainById(S.from.chain))) { paint(); return; }
      if (Number(S.from.chain) === Number(S.to.chain) && (ft.address === tt.address || (isAddr(ft.address) && sameAddr(ft.address, tt.address)))) { S.err = t('same'); paint(); return; }
      var p = parseUnits(S.amount, ft.decimals);
      if (!p || p.v <= 0n) { S.err = S.amount ? t('needAmount') : ''; paint(); return; }
      var fc = chainById(S.from.chain), src = srcW(), fk = kindOf(fc);
      if (!src.account || !fc) { paint(); return; }
      if (fk === 'evm' ? !isAddr(ft.address) : (fk === 'tron' && !tronHex(fc.contract))) { paint(); return; }
      var tc = chainById(S.to.chain);
      /* an EVM address the reader has already connected is offered as the place to receive; they can change it */
      if (needRcp() && kindOf(tc) === 'evm' && !S.rcp && W.account) { S.rcp = W.account; el.rcp.value = W.account; }
      if (needRcp() && !rcpOk()) { paint(); return; }                /* no price is asked for until the address is sound */
      var req = { fromChain: S.from.chain, toChain: S.to.chain, fromToken: ft.address, toToken: tt.address,
                  fromAmount: p.v.toString(), account: src.account, slippage: S.slip, contract: fc.contract,
                  fromDecimals: ft.decimals, toDecimals: tt.decimals, kind: fk, exactTo: kindOf(tc) !== 'evm',
                  fee: moreFee(), integrator: cfg.integrator };
      if (needRcp()) { req.recipient = S.rcp; }
      var seq = S.seq;
      S.busy = t('quoting'); paint();
      quote(req, cfg).then(function (q) {
        if (seq !== S.seq) { return; }
        var bad = checkQuote(q, req);
        if (bad) { S.busy = ''; S.err = t('mismatch') + ' [' + bad + ']'; paint(); return; }
        S.q = q; S.qreq = req; S.qt = Date.now(); S.busy = '';
        showQuote(q); paintRoutes(); paint();        /* the price is on screen before the wallet is asked anything */
        coinFacts(); paintCoin();                    /* and only then is the site's own note about the coins read */
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
      if (req.kind === 'solana' || req.kind === 'utxo') { return Promise.resolve(null); }   /* nothing to approve on either */
      var w = req.kind === 'tron' ? TW : W, own_ = req.kind === 'tron' ? req.fromToken === TRX : sameAddr(req.fromToken, ZERO);
      return within(w.balance(req.fromToken, req.account), WAIT, null).then(function (b) {
        if (b === null) { return null; }             /* the wallet did not answer: say nothing about the balance */
        S.bal = b;
        if (b < BigInt(req.fromAmount)) { S.err = t('lowBalance'); }
        if (own_) { return null; }
        return within(w.allowance(req.fromToken, req.account, q.estimate.approvalAddress), WAIT, null).then(function (a) {
          if (a !== null && a < BigInt(req.fromAmount)) { S.need = 'approve'; }
        });
      }).catch(function () { return null; });
    }

    /* Start on the network the wallet is already on, when this page offers it: then nothing has to be switched at all.
       Some wallets never answer a switch request from a page, which used to leave the reader stuck on one button. */
    function follow() {
      if (kindOf(chainById(S.from.chain)) !== 'evm') { return; }      /* the reader chose Tron or Solana: leave it */
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
      var src = srcW();
      if (need === 'nowallet') { S.err = t(src === TW ? 'noWalletTron' : src === SW ? 'noWalletSol' : src === BW ? 'noWalletBtc' : 'noWallet'); paint(); return; }
      if (need === 'connect') {
        var cseq = ++S.seq;
        S.busy = t('connecting'); paint();
        within(src.connect().then(function () { return 'ok'; }, function (e) { return { e: e }; }), 60000, { e: null }).then(function (r) {
          if (cseq !== S.seq) { return; }
          S.busy = '';
          if (r === 'ok') { if (src === W) { follow(); } paint(); ask(); return; }
          S.err = code(r.e); paint();
        });
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
      if (req.kind === 'tron') { return Promise.resolve(TW.read() === req.account ? null : 'chainMoved'); }
      if (req.kind === 'solana') { var k = SW.key(null); return Promise.resolve(!k || k === req.account ? null : 'chainMoved'); }
      if (req.kind === 'utxo') { return within(BW.current(), WAIT, req.account).then(function (a) { return a === req.account ? null : 'chainMoved'; }); }
      return Promise.all([within(W.req('eth_chainId'), WAIT, null), within(W.req('eth_accounts'), WAIT, null)]).then(function (r) {
        if (r[0] === null || r[1] === null) { return 'chainUnknown'; }
        if (parseInt(r[0], 16) !== Number(req.fromChain)) { return 'chainMoved'; }
        if (!r[1] || !r[1].length || !sameAddr(r[1][0], req.account)) { return 'chainMoved'; }
        return null;
      });
    }

    /* On Tron the approval is built by the network's own node, then opened and checked like any other transaction
       before the wallet sees it: the reader's address, the token itself, nothing sent with it, and call data that is
       approve(LI.FI's contract, exactly this amount) and not one byte else. */
    function doApproveTron() {
      var q = S.q, req = S.qreq, seq = S.seq;
      if (!q || !req || q.estimate.approvalAddress !== req.contract) { return; }
      var spender = tronHex(req.contract), amount = BigInt(req.fromAmount);
      var param = pad32(spender.slice(2)) + pad32(amount.toString(16)), built = null;
      S.busy = t('approving'); paint();
      sameWallet(req).then(function (bad) {
        if (bad) { throw { soft: t(bad) }; }
        return tron('/wallet/triggersmartcontract', { owner_address: req.account, contract_address: req.fromToken,
          function_selector: 'approve(address,uint256)', parameter: param, fee_limit: 100000000, call_value: 0, visible: true });
      }).then(function (j) {
        var tx = plain(j) ? j.transaction : null, f = plain(tx) && typeof tx.raw_data_hex === 'string' ? tronFacts(tx.raw_data_hex) : null;
        if (!f || typeof tx.txID !== 'string' || f.type !== 31n || f.owner !== tronHex(req.account) || f.contract !== tronHex(req.fromToken) ||
            f.call !== 0n || f.data !== '095ea7b3' + param || !(f.feeLimit > 0n && f.feeLimit <= TRON_FEE_CAP)) { throw { soft: t('mismatch') + ' [approve]' }; }
        built = tx;
        return tronId(tx);
      }).then(function (okd) {
        if (!okd) { throw { soft: t('mismatch') + ' [tronId]' }; }
        return TW.sign(built);
      }).then(function (signed) { return TW.broadcast(signed); })
        .then(function (id) { line(t('view'), req.fromChain, id); return tronWait(id); })
        .then(function (okd) {
          if (seq !== S.seq) { return; }
          S.busy = '';
          if (okd === false) { S.err = t('failed'); } else { S.need = null; }
          paint();
        }, function (e) { if (seq !== S.seq) { return; } S.busy = ''; S.err = e && e.soft ? (e.soft === 'signature' ? t('mismatch') + ' [signature]' : e.soft) : code(e); paint(); });
    }
    function doApprove() {
      if (S.qreq && S.qreq.kind === 'tron') { doApproveTron(); return; }
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
      if (req.kind !== 'evm') { doSwapFar(q, req, x, seq); return; }
      var tx = { from: req.account, to: x.to, data: x.data, value: x.value, chainId: qty(BigInt(req.fromChain)) };
      if (isQty(x.gasLimit) && BigInt(x.gasLimit) > 0n && BigInt(x.gasLimit) <= GAS_CAP) { tx.gas = x.gasLimit; }
      var cross = Number(req.fromChain) !== Number(req.toChain), hash = '';
      S.link = '';                 /* the link of the swap being sent now replaces the one before it */
      S.busy = t('swapping'); paint(); el.status.textContent = ''; trackState('');
      sameWallet(req).then(function (moved) {
        if (moved) { throw { soft: t(moved) }; }
        return W.send(tx);
      }).then(function (h) {
        hash = h; line(t('view'), req.fromChain, h); trackOpen(req, q); histAdd(req, q, h); S.busy = t('watching'); paint();
        return waitFor(h);
      }).then(function (okd) {
        if (okd === false) { mark(hash, 'failed'); } else if (okd === true && !cross) { mark(hash, 'done'); }
        if (seq !== S.seq) { return; }
        if (okd === false) { S.busy = ''; S.err = t('failed'); paint(); return; }
        reset(); S.amount = ''; el.amount.value = ''; S.bal = null;
        if (cross && okd === true) { S.note = t('bridging'); paint(); track(hash, req, q.tool); return; }
        S.done = okd === true; if (okd === null) { S.note = t('watching'); }
        paint();
      }, function (e) { if (seq !== S.seq) { return; } S.busy = ''; S.err = e && e.soft ? e.soft : code(e); paint(); });
    }

    /* a swap between two networks is only half done when the first transaction lands: ask LI.FI how the rest goes */
    /* Tron: the id is checked against the bytes, the wallet signs, what it hands back is checked to be the same
       transaction, and this page sends it to the network itself. Solana: the wallet signs and sends in one step. */
    function doSwapFar(q, req, x, seq) {
      var cross = Number(req.fromChain) !== Number(req.toChain), hash = '';
      S.link = '';                 /* the link of the swap being sent now replaces the one before it */
      var fail = function (e) { if (seq !== S.seq) { return; } S.busy = ''; S.err = e && e.soft ? (e.soft === 'signature' ? t('mismatch') + ' [signature]' : e.soft) : code(e); paint(); };
      S.busy = t('swapping'); paint(); el.status.textContent = ''; trackState('');
      var sent = sameWallet(req).then(function (moved) {
        if (moved) { throw { soft: t(moved) }; }
        if (req.kind === 'solana') { return SW.send(b64(x.data)); }
        if (req.kind === 'utxo') { return BW.sign(x.data).then(function (signed) { return BW.send(signed); }); }
        var tt = x.customData.tronTransaction;
        return tronId(tt).then(function (okd) {
          if (!okd) { throw { soft: t('mismatch') + ' [tronId]' }; }
          return TW.sign(tt);
        }).then(function (signed) { return TW.broadcast(signed); });
      }).then(function (h) {
        hash = h; line(t('view'), req.fromChain, h); trackOpen(req, q); histAdd(req, q, h); S.busy = t('watching'); paint();
        return req.kind === 'tron' ? tronWait(h) : true;
      });
      sent.then(function (okd) {
        if (okd === false) { mark(hash, 'failed'); } else if (okd === true && !cross && req.kind === 'tron') { mark(hash, 'done'); }
        if (seq !== S.seq) { return; }
        if (okd === false) { S.busy = ''; S.err = t('failed'); paint(); return; }
        reset(); S.amount = ''; el.amount.value = ''; S.bal = null;
        /* Solana has no node here to ask, so LI.FI's own record of the swap is followed whichever way it goes */
        if ((cross && okd === true) || req.kind === 'solana' || req.kind === 'utxo') { S.note = t(cross ? 'bridging' : 'watching'); paint(); track(hash, req, q.tool); return; }
        S.done = okd === true; if (okd === null) { S.note = t('watching'); }
        paint();
      }, fail);
    }
    function track(hash, req, tool, tries) {
      tries = tries === undefined ? 90 : tries;
      var mine = S.seq;
      api('/v1/status', { txHash: hash, fromChain: req.fromChain, toChain: req.toChain, bridge: String(tool || '').replace(/[^\w-]/g, '') || undefined })
        .then(function (r) { return r; }, function () { return null; })
        .then(function (r) {
          if (mine !== S.seq) { return; }
          var st = r && typeof r.status === 'string' ? r.status : '';
          if (st === 'DONE') {
            mark(hash, 'done');
            S.note = ''; S.done = true; paint(); line(t('arrived'));
            if (r.receiving && typeof r.receiving.txHash === 'string') { line(t('viewDest'), req.toChain, r.receiving.txHash); }
            return;
          }
          if (st === 'FAILED') { mark(hash, 'failed'); S.note = ''; S.err = t('bridgeFailed'); paint(); return; }
          if (tries <= 0) { return; }
          setTimeout(function () { track(hash, req, tool, tries - 1); }, 10000);
        });
    }

    /* one line under the button: some words, and a link to a transaction when there is one. The link is built from
       this site's own list of explorers and a hash that looks like a hash, nothing else. */
    function linkFor(c, hash) {
      var k = kindOf(c), okHash = typeof hash === 'string' && (k === 'tron' || k === 'utxo' ? /^[0-9a-f]{64}$/.test(hash)
        : k === 'solana' ? /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(hash) : /^0x[0-9a-fA-F]{64}$/.test(hash));
      return c && okHash ? c.explorer.replace(/\/+$/, '') + (k === 'tron' ? '/#/transaction/' : '/tx/') + hash : '';
    }
    function line(words, chainId, hash, good) {
      var row = doc.createElement('div');
      if (good) { row.setAttribute('data-ok', '1'); }
      if (X.track) { X.track.hidden = false; }
      var c = chainId !== undefined ? chainById(chainId) : null;
      if (linkFor(c, hash)) {
        if (!S.link) { S.link = linkFor(c, hash); }        /* the first link of a swap is the one worth passing on */
        var a = doc.createElement('a');
        a.setAttribute('href', linkFor(c, hash));
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
        /* a swap can only ever start on an EVM network: the source side and the gift panel never list the others */
        var offer = p.side === 'to' ? data.chains : data.chains.filter(function (c) { return p.side === 'gift' ? kindOf(c) === 'evm' : !toOnly(c); });
        for (i = 0; i < offer.length; i++) {
          var c = offer[i];
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
              !!side.token && (isAddr(tk.address) ? sameAddr(side.token.address, tk.address) : side.token.address === tk.address));
          n++;
        }
        /* the same coin on other networks: a reader who types BTC while Ethereum is chosen means Bitcoin, and should
           find it. Only exact or leading matches of the symbol, a handful of them, each naming its network. */
        if (q && q.length >= 2 && !isAddr(String(query || '').trim())) {
          var far = 0, offer2 = p.side === 'to' ? data.chains : data.chains.filter(function (c) { return p.side === 'gift' ? kindOf(c) === 'evm' : !toOnly(c); });
          for (var ci = 0; ci < offer2.length && far < 24; ci++) {
            var oc = offer2[ci];
            if (Number(oc.id) === Number(side.chain)) { continue; }
            var ol = listFor(oc.id);
            for (i = 0; i < ol.length && far < 24; i++) {
              if (String(ol[i].symbol).toLowerCase().indexOf(q) !== 0) { continue; }
              row(ol[i].ic, ol[i].symbol, ol[i].symbol, oc.name,
                  (function (cid, x) { return function () { setChain(p.side, cid); setToken(p.side, x); }; })(oc.id, ol[i]), false);
              far++; n++;
            }
          }
        }
        /* anything beyond the short list: a symbol such as CAKE, or a contract address, looked up live on LI.FI */
        var raw = kindOf(chainById(side.chain)) !== 'evm' ? '' : String(query || '').trim();
        if (raw && (isAddr(raw) || /^[A-Za-z0-9][A-Za-z0-9.$_₮-]{0,19}$/.test(raw)) && !(n === 1 && !isAddr(raw) && list.some(function (x) { return String(x.symbol).toLowerCase() === q; }))) {
          el['dlg-find'].hidden = false;
        }
      }
      if (!n && el['dlg-find'].hidden) { var none = doc.createElement('div'); none.setAttribute('class', 'sw-none'); none.textContent = t('nothing'); el['dlg-list'].appendChild(none); }
    }

    function setChain(sideName, id) {
      if (sideName === 'gift') { S.gift = { chain: id, token: null }; pickDefault(S.gift); G.bal = null; closePick(); giftLabels(); giftPaint(); giftBalance(); return; }
      var both = sideName === 'from' && Number(S.to.chain) === Number(S.from.chain);
      S[sideName] = { chain: id, token: null, second: sideName === 'to' }; pickDefault(S[sideName]);
      if (sideName === 'to' && Number(S.to.chain) === Number(S.from.chain) && S.from.token && S.to.token && sameAddr(S.from.token.address, S.to.token.address)) {
        var l2 = listFor(id); S.to.token = l2.length > 1 ? (sameAddr(l2[0].address, S.from.token.address) ? l2[1] : l2[0]) : S.to.token;
      }
      if (both) { S.to = { chain: id, token: null, second: true }; pickDefault(S.to); }
      if (sideName === 'from') { S.bal = null; }
      if (sideName === 'to') { S.rcp = ''; el.rcp.value = ''; }      /* an address belongs to one network, never the next */
      closePick(); labels(); paint(); ask();
    }
    function setToken(sideName, tk) {
      if (sideName === 'gift') { S.gift.token = tk; G.bal = null; closePick(); giftLabels(); giftPaint(); giftBalance(); return; }
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

    /* ================================================================ the gift panel

       The wallet that takes the site's fee is written on the page, with what it holds, so a reader can check it on
       the networks' own explorers before giving anything. A gift is an ordinary transfer from the reader's wallet
       to that address: the chain's own coin, or an ERC-20 `transfer`. The address comes from the page itself and is
       checked again here, so nothing downloaded can move a gift elsewhere. */
    var giftBox = $('sw-gift'), G = null, gl = {};
    if (giftBox && isAddr(cfg.donate) && sameAddr(giftBox.getAttribute('data-a'), cfg.donate)) {
      G = { amount: '', busy: '', err: '', note: '', done: false, bal: null, seq: 0 };
      S.gift = { chain: data.chains[0].id, token: null };
      ['dnc', 'dnc-i', 'dnc-n', 'dnt', 'dnt-i', 'dnt-n', 'dn-amount', 'dn-bal', 'dn-go', 'dn-go-l', 'dn-go-x',
        'dn-msg', 'dn-status', 'dn-addr', 'dn-copy', 'dn-total'].forEach(function (k) { gl[k] = $('sw-' + k); });
      for (var g0 in gl) { if (own(gl, g0) && !gl[g0]) { G = null; } }
    }

    /* Persian and Arabic digits, a comma or an Arabic decimal mark: all of it becomes a plain number */
    function digits(raw) {
      var v = String(raw).replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); })
        .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); })
        .replace(/[٫،,]/g, '.').replace(/[^0-9.]/g, '');
      var p = v.split('.');
      return p.length > 2 ? p[0] + '.' + p.slice(1).join('') : v;
    }

    /* the panel opens on whichever network the wallet is already on, like the form above it */
    function giftFollow() {
      if (!G || !W.chainId || !chainById(W.chainId) || Number(W.chainId) === Number(S.gift.chain)) { return; }
      S.gift = { chain: W.chainId, token: null }; pickDefault(S.gift); G.bal = null; giftLabels();
    }

    function giftLabels() {
      if (!G) { return; }
      var c = chainById(S.gift.chain), tk = S.gift.token;
      icon(gl['dnc-i'], c && c.ic, c && c.name); gl['dnc-n'].textContent = c ? c.name : '';
      icon(gl['dnt-i'], tk && tk.ic, tk && tk.symbol); gl['dnt-n'].textContent = tk ? tk.symbol : '—';
      gl['dn-copy'].textContent = t('copy');
    }

    function giftAmount() {
      var tk = S.gift && S.gift.token;
      if (!G || !tk || !G.amount) { return null; }
      var r = parseUnits(G.amount, tk.decimals);          /* {v, cut}: the integer the chain counts in */
      return r && r.v > 0n ? r.v : null;
    }

    function giftPaint() {
      if (!G) { return; }
      var c = chainById(S.gift.chain), tk = S.gift.token, amt = giftAmount(), need, label, extra = '', dis = true;
      gl['dn-msg'].textContent = G.err || G.note || (G.done ? t('gave') : '');
      gl['dn-msg'].setAttribute('data-ok', G.err ? '' : (G.done && !G.note ? '1' : ''));
      gl['dn-bal'].textContent = G.bal === null || !tk ? '' : t('balance') + ' ' + formatUnits(G.bal, tk.decimals, 6) + ' ' + tk.symbol;
      if (G.busy) { label = G.busy; need = 'busy'; }
      else if (!W.p) { label = t('connect'); dis = false; need = 'nowallet'; }
      else if (!W.account) { label = t('connect'); dis = false; need = 'connect'; }
      else if (c && Number(W.chainId) !== Number(c.id)) { label = t('switchChain'); extra = c.name; dis = false; need = 'chain'; }
      else if (!amt) { label = t('amount'); need = 'amount'; }
      else if (G.bal !== null && amt > G.bal) { label = t('lowBalance'); need = 'low'; }
      else { label = t('give'); extra = tk ? tk.symbol : ''; dis = false; need = 'give'; }
      gl['dn-go-l'].textContent = label; gl['dn-go-x'].textContent = extra;
      gl['dn-go'].disabled = dis; gl['dn-go'].setAttribute('data-need', need);
    }

    /* what the reader's own wallet holds of the coin they are about to give */
    function giftBalance() {
      if (!G || !W.account || !S.gift.token) { return; }
      var c = chainById(S.gift.chain), tk = S.gift.token, mine = ++G.seq;
      if (!c || Number(W.chainId) !== Number(c.id)) { G.bal = null; giftPaint(); return; }
      within(W.balance(tk.address, W.account), WAIT, null).then(function (v) {
        if (mine !== G.seq) { return; }
        G.bal = v === null ? null : v; giftPaint();
      });
    }

    function giftLine(words, hash) {
      var row = doc.createElement('div'), c = chainById(S.gift.chain);
      if (c && typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash)) {
        var a = doc.createElement('a');
        a.setAttribute('href', c.explorer.replace(/\/+$/, '') + '/tx/' + hash);
        a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer');
        a.textContent = words;
        var h = doc.createElement('b'); h.setAttribute('translate', 'no'); h.textContent = ' ' + short(hash);
        row.appendChild(a); row.appendChild(h);
      } else { row.textContent = words; }
      gl['dn-status'].appendChild(row);
    }

    function giftAct() {
      if (!G) { return; }
      var need = gl['dn-go'].getAttribute('data-need');
      G.err = ''; G.note = ''; G.done = false;
      if (need === 'nowallet') { G.err = t('noWallet'); giftPaint(); return; }
      if (need === 'connect') {
        G.busy = t('connecting'); giftPaint();
        W.connect().then(function () { G.busy = ''; giftPaint(); giftBalance(); paint(); }, function (e) { G.busy = ''; G.err = code(e); giftPaint(); });
        return;
      }
      if (need === 'chain') {
        var c = chainById(S.gift.chain), mine = ++G.seq;
        G.busy = t('switching'); giftPaint();
        within(W.switchChain(c).then(function () { return 'ok'; }, function (e) { return e || 'fail'; }), 30000, 'silent').then(function (r) {
          if (mine !== G.seq) { return; }
          G.busy = '';
          if (r === 'ok') { giftPaint(); giftBalance(); return; }
          G.err = r === 'silent' ? t('switchHint') : code(r); giftPaint();
        });
        return;
      }
      if (need === 'give') { doGive(); }
    }

    function doGive() {
      var c = chainById(S.gift.chain), tk = S.gift.token, amt = giftAmount(), to = cfg.donate;
      if (!G || !c || !tk || !amt || !isAddr(to)) { return; }
      var tx = sameAddr(tk.address, ZERO)
        ? { from: W.account, to: to, value: qty(amt), data: '0x', chainId: qty(BigInt(c.id)) }
        : { from: W.account, to: tk.address, data: ERC20.transfer + pad32(to) + pad32(qty(amt)), value: '0x0', chainId: qty(BigInt(c.id)) };
      var mine = ++G.seq;
      G.busy = t('giving'); giftPaint(); gl['dn-status'].textContent = '';
      sameWallet({ fromChain: c.id, account: W.account }).then(function (moved) {
        if (moved) { throw { soft: t(moved) }; }
        if (sameAddr(tk.address, ZERO)) { return null; }
        return within(W.decimals(tk.address), WAIT, null);
      }).then(function (dec) {
        /* the token disagreeing with our list about its own places would make the amount wrong by powers of ten */
        if (dec !== null && Number(dec) !== Number(tk.decimals)) { throw { soft: t('mismatch') + ' [decimals]' }; }
        return W.send(tx);
      }).then(function (h) {
        giftLine(t('view'), h); G.busy = t('watching'); giftPaint();
        return waitFor(h);
      }).then(function (okd) {
        if (mine !== G.seq) { return; }
        G.busy = '';
        if (okd === false) { G.err = t('failed'); giftPaint(); return; }
        G.amount = ''; gl['dn-amount'].value = ''; G.bal = null;
        G.done = okd === true; if (okd === null) { G.note = t('watching'); }
        giftPaint(); giftBalance(); openWallet();
      }, function (e) { if (mine !== G.seq) { return; } G.busy = ''; G.err = e && e.soft ? e.soft : code(e); giftPaint(); });
    }

    /* ---- the wallet, read out loud: its USDT on each watched network, straight from that network's public node.
       Only one question is ever asked — balanceOf(this address) — and a node that does not answer leaves a dash. */
    function rpcBalance(w, addr) {
      if (typeof fetch !== 'function' || !isAddr(w.token) || !isAddr(addr) || !/^https:\/\//.test(w.rpc)) { return Promise.resolve(null); }
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT) : null;
      return fetch(w.rpc, {
        method: 'POST', mode: 'cors', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: w.token, data: ERC20.balanceOf + pad32(addr) }, 'latest'] }),
        signal: ctl ? ctl.signal : undefined
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (timer) { clearTimeout(timer); }
        return j && isQty(j.result) ? BigInt(j.result) : null;
      }, function () { if (timer) { clearTimeout(timer); } return null; });
    }

    function openWallet() {
      if (!G || !Array.isArray(data.watch) || !data.watch.length) { return; }
      var addr = cfg.donate, total = 0n, any = false;
      gl['dn-total'].textContent = '…';
      data.watch.forEach(function (w) {
        var cell = $('sw-dn-b' + String(w.id).replace(/[^0-9]/g, ''));
        if (!cell) { return; }
        cell.textContent = '…';
        rpcBalance(w, addr).then(function (v) {
          if (v === null) { cell.textContent = '—'; return; }
          cell.textContent = formatUnits(v, w.decimals, 2);
          total += v * (10n ** BigInt(Math.max(0, 18 - w.decimals)));      /* every line brought to 18 places before adding */
          any = true;
          gl['dn-total'].textContent = formatUnits(total, 18, 2) + ' USDT';
        });
      });
      setTimeout(function () { if (!any && gl['dn-total'].textContent === '…') { gl['dn-total'].textContent = '—'; } }, TIMEOUT + 1000);
    }

    /* ================================================================ wiring */
    W.p = W.find(win); TW.p = TW.find(win); SW.p = SW.find(win); BW.p = BW.find(win);
    pickDefault(S.from); pickDefault(S.to); labels(); paint();
    if (G) { pickDefault(S.gift); giftLabels(); giftPaint(); openWallet(); }
    live = true;

    /* a wallet that allowed this site on an earlier visit is picked up silently, with no pop-up and no button press */
    if (W.p) {
      within(W.req('eth_accounts'), WAIT, null).then(function (acc) {
        if (!acc || !acc.length || !isAddr(acc[0]) || W.account) { return; }
        W.account = acc[0];
        return within(W.req('eth_chainId'), WAIT, null).then(function (id) {
          W.chainId = parseInt(id, 16) || 0; follow(); paint(); ask();
          if (G) { giftFollow(); giftPaint(); giftBalance(); }
        });
      }).catch(function () { });
    }

    el.fc.addEventListener('click', function () { openPick('from', 'chain'); });
    el.tc.addEventListener('click', function () { openPick('to', 'chain'); });
    el.ft.addEventListener('click', function () { openPick('from', 'token'); });
    el.tt.addEventListener('click', function () { openPick('to', 'token'); });
    el['dlg-close'].addEventListener('click', closePick);
    if (X['routes-go']) { X['routes-go'].addEventListener('click', moreRoutes); }
    if (X['hist-clear']) { X['hist-clear'].addEventListener('click', function () { try { win.localStorage.removeItem(HKEY); } catch (e) { } histPaint(); }); }
    if (X.rep) { X.rep.addEventListener('toggle', function () { if (X.rep.open !== false) { report(); } }); }
    if (X['track-copy']) {
      X['track-copy'].addEventListener('click', function () {
        var tip = X['track-tip'], said = function (k) { if (tip) { tip.textContent = t(k); setTimeout(function () { tip.textContent = ''; }, 4000); } };
        if (!S.link) { said('copyFail'); return; }
        var nav = win.navigator;
        if (nav && nav.clipboard && nav.clipboard.writeText) { nav.clipboard.writeText(S.link).then(function () { said('copied'); }, function () { said('copyFail'); }); }
        else { said('copyFail'); }
      });
    }
    if (X.more) { X.more.addEventListener('change', function () { S.more = !!X.more.checked; paintMore(); ask(true); }); }
    if (X['track-close']) { X['track-close'].addEventListener('click', function () {
      if (X.track) { X.track.hidden = true; }
      var tip = X['track-tip'];
      if (!tip || !histLoad().length) { return; }                      /* only said when there is a history to look at */
      tip.textContent = t('trackTip');
      setTimeout(function () { tip.textContent = ''; }, 4000);
    }); }
    if (X.mode) { X.mode.addEventListener('click', function (ev) { var m = ev && ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-mode') : null; if (m) { setMode(m); } }); }
    if (X.track) { X.track.hidden = true; }
    histPaint(); paintRoutes(); setMode('simple'); paintMore(); paintCoin();
    el['dlg-find'].addEventListener('click', findOnChain);
    el['dlg-q'].addEventListener('input', function () { fillPick(this.value); });
    el.dlg.addEventListener('click', function (ev) { if (ev && ev.target === el.dlg) { closePick(); } });
    if (doc.addEventListener) { doc.addEventListener('keydown', function (ev) { if (ev && ev.key === 'Escape' && S.pick) { closePick(); } }); }

    el.amount.addEventListener('input', function () {
      var v = digits(this.value);
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
      if (toOnly(chainById(tt.chain))) { return; }        /* nothing can start on Sui, Stellar or Zcash */
      S.from = { chain: tt.chain, token: tt.token }; S.to = { chain: f.chain, token: f.token, second: true };
      S.bal = null; labels(); paint(); ask();
    });

    el.rcp.addEventListener('input', function () {
      /* a pasted address drags spaces and invisible direction marks along; no address of any of these networks is
         anywhere near this long, and a very long one would only be something to make the shape test work hard */
      S.rcp = this.value.replace(/[\s\u200b-\u200f\u202a-\u202e]/g, '').slice(0, 120);
      if (S.rcp !== this.value) { this.value = S.rcp; }
      S.ack = false; el.ack.checked = false;
      reset(); paint(); askLater();
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

    if (G) {
      gl.dnc.addEventListener('click', function () { openPick('gift', 'chain'); });
      gl.dnt.addEventListener('click', function () { openPick('gift', 'token'); });
      gl['dn-amount'].addEventListener('input', function () {
        var v = digits(this.value);
        if (v !== this.value) { this.value = v; }
        G.amount = v; G.done = false; G.err = ''; giftPaint();
      });
      gl['dn-go'].addEventListener('click', giftAct);
      gl['dn-copy'].addEventListener('click', function () {
        var self = this, done = function () { self.textContent = t('copied'); setTimeout(function () { self.textContent = t('copy'); }, 1500); };
        try {
          if (win.navigator && win.navigator.clipboard) { win.navigator.clipboard.writeText(cfg.donate).then(done, function () { }); return; }
        } catch (e) { }
        try { var r = doc.createRange(); r.selectNodeContents(gl['dn-addr']); var sel = win.getSelection(); sel.removeAllRanges(); sel.addRange(r); done(); } catch (e2) { }
      });
    }

    if (W.p && W.p.on) {
      W.p.on('accountsChanged', function (acc) {
        W.account = acc && acc.length && isAddr(acc[0]) ? acc[0] : ''; S.bal = null; paint(); ask();
        if (G) { G.bal = null; giftPaint(); giftBalance(); }
      });
      W.p.on('chainChanged', function (id) {
        W.chainId = parseInt(id, 16) || 0; follow(); paint(); ask();
        if (G) { giftFollow(); giftPaint(); giftBalance(); }
      });
    }
    return 'on';
  }

  function frameCheck(win) { try { return win.top !== win.self; } catch (e) { return true; } }

  /* the settings the page was built with, rebuilt field by field so nothing else can travel with them */
  function config(raw) {
    if (!plain(raw) || raw.enabled !== true) { return null; }
    var out = { integrator: '', fee: 0, fee_zagros: 0, slippage: 0.005, donate: '' };
    if (typeof raw.integrator === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(raw.integrator)) { out.integrator = raw.integrator; }
    if (typeof raw.fee === 'number' && isFinite(raw.fee) && raw.fee >= 0 && raw.fee <= MAX_FEE) { out.fee = raw.fee; }
    if (typeof raw.slippage === 'number' && isFinite(raw.slippage) && raw.slippage > 0 && raw.slippage <= MAX_SLIP) { out.slippage = raw.slippage; }
    if (isAddr(raw.donate)) { out.donate = raw.donate; }
    /* the larger fee the reader may choose: it has to be larger than the fee, or there is nothing to choose */
    if (typeof raw.fee_zagros === 'number' && isFinite(raw.fee_zagros) && raw.fee_zagros > out.fee && raw.fee_zagros <= MAX_FEE) { out.fee_zagros = raw.fee_zagros; }
    if (out.fee > 0 && !out.integrator) { return null; }      /* a fee with nobody registered to receive it */
    return out;
  }

  api_.start = start;
  api_.config = config;
  api_.frameCheck = frameCheck;
  api_.setLang = function (l) { lang = own(T, l) ? l : 'fa'; };
  api_.fits = fits;
  api_.checkQuote = api_.checkQuote || checkQuote;
  api_.psbtRead = psbtRead; api_.btcScript = btcScript; api_.BW = BW;
  api_.tronFacts = tronFacts; api_.tronHex = tronHex; api_.solPayer = solPayer; api_.b58enc = b58enc; api_.TW = TW; api_.SW = SW;
  api_.checkSum = checkSum;
  api_.needsSum = needsSum;
  api_.tune = function (o) { if (o && o.wait !== undefined) { WAIT = o.wait; } if (o && o.life !== undefined) { QUOTE_LIFE = o.life; } if (o && o.poll !== undefined) { POLL = o.poll; } };   /* tests only */
  if (root && root.document) { start(root); }
})(typeof window !== 'undefined' ? window : null);
