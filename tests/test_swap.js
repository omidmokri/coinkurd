/* /swap/ — assets/swap/swap.js on a fake page with a fake wallet.
   What this proves: the amounts are counted exactly, a tampered answer from the service never reaches the wallet, and
   what the wallet is finally asked to sign is byte for byte what the service sent.
   Run: node tests/test_swap.js */
'use strict';
const S = require('../assets/swap/swap.js');
const fs = require('fs'), path = require('path');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : 'FAIL  ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ME = '0x1111111111111111111111111111111111111111';
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const BNB = '0x0000000000000000000000000000000000000000';
const DIAMOND = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';

/* ---------------------------------------------------------------- numbers */
ok(S.parseUnits('1.5', 18).v === 1500000000000000000n, 'parseUnits 1.5 at 18 decimals');
ok(S.parseUnits('0.000001', 6).v === 1n, 'parseUnits of the smallest unit');
ok(S.parseUnits('1234', 0).v === 1234n, 'parseUnits with no decimals');
const cut = S.parseUnits('1.1234567', 6);
ok(cut.v === 1123456n && cut.cut === true, 'extra decimals are cut and flagged, never rounded up');
ok(['1e3', '-1', '', '.', '1.2.3', '0x10', '١٢٣', ' 1', '1 ', 'Infinity', 'NaN'].every(x => S.parseUnits(x, 18) === null), 'refused: anything that is not a plain decimal');
ok(S.parseUnits('۱۲', 18) === null, 'refused: Persian digits (they are converted in the input box, never here)');
ok(S.formatUnits('1234567890123456789', 18, 6) === '1.234567', 'formatUnits cuts, it does not round');
ok(S.formatUnits('1000000', 6, 6) === '1', 'a whole number shows no decimal point');
ok(S.formatUnits('0', 18, 6) === '0', 'zero shows as zero');
ok(S.formatUnits('1234567890123456789012', 18, 2) === '1,234.56', 'thousands are grouped');
ok(S.formatUnits('not a number', 18, 2) === '—', 'rubbish in, a dash out');
ok(S.pad32(USDT).length === 64 && S.pad32(USDT).indexOf('55d398') === 24, 'addresses pad to 32 bytes');
ok(S.qty(255n) === '0xff', 'quantities are plain hex');

/* ---------------------------------------------------------------- the settings */
ok(S.config({ enabled: true, integrator: 'entekhab', fee: 0.005, slippage: 0.005 }).fee === 0.005, 'a good config passes');
ok(S.config({ enabled: false, integrator: 'entekhab', fee: 0.005 }) === null, 'switched off: nothing runs');
ok(S.config({ enabled: true, fee: 0.005 }) === null, 'a fee with no integrator is refused (nobody would be paid)');
ok(S.config({ enabled: true, integrator: 'x', fee: 0.04 }).fee === 0, 'a fee above 3% is dropped, not passed on');
ok(S.config({ enabled: true, integrator: 'a b' }).integrator === '', 'an integrator name with a space is dropped');
ok(S.config({ enabled: true, integrator: 'x', slippage: 0.9 }).slippage === 0.005, 'an absurd slippage falls back to the default');
ok(S.config(null) === null && S.config([]) === null && S.config('x') === null, 'refused: anything that is not an object');

/* ---------------------------------------------------------------- the answer from the service */
function goodQuote(over) {
  const q = {
    tool: 'pancakeswap', toolDetails: { name: 'PancakeSwap' },
    action: { fromChainId: 56, toChainId: 56, fromToken: { address: BNB, decimals: 18, symbol: 'BNB' },
      toToken: { address: USDT, decimals: 18, symbol: 'USDT' }, fromAmount: '1000000000000000000',
      fromAddress: ME, toAddress: ME },
    estimate: { toAmount: '550000000000000000000', toAmountMin: '547000000000000000000',
      approvalAddress: DIAMOND, gasCosts: [{ amountUSD: '0.02' }], feeCosts: [{ amountUSD: '0.14' }], executionDuration: 30 },
    transactionRequest: { to: DIAMOND, data: '0x4630a0d8' + '11'.repeat(100), value: '0xde0b6b3a7640000',
      from: ME, chainId: 56, gasLimit: '0xda5d9' }
  };
  return over ? over(q) || q : q;
}
const req = { fromChain: 56, toChain: 56, fromToken: BNB, toToken: USDT, fromAmount: '1000000000000000000', account: ME, contract: DIAMOND };
ok(S.checkQuote(goodQuote(), req) === null, 'a matching answer passes');

const tamper = [
  ['the transaction points at another contract', q => { q.transactionRequest.to = '0x' + '9'.repeat(40); }, 'to'],
  ['it would send more of my coin than I asked', q => { q.transactionRequest.value = '0x1bc16d674ec80000'; }, 'nativeValue'],
  ['it would send coin along with a token swap', q => { q.action.fromToken.address = USDT; q.transactionRequest.value = '0xde0b6b3a7640000'; }, 'fromToken'],
  ['the transaction is for another chain', q => { q.transactionRequest.chainId = 1; }, 'txChain'],
  ['it would be sent from another address', q => { q.transactionRequest.from = '0x' + '2'.repeat(40); }, 'txFrom'],
  ['the proceeds go to another address', q => { q.action.toAddress = '0x' + '3'.repeat(40); }, 'toAddress'],
  ['the amount is not the one I typed', q => { q.action.fromAmount = '2000000000000000000'; }, 'fromAmount'],
  ['the source token was changed', q => { q.action.fromToken.address = USDT; }, 'fromToken'],
  ['the destination token was changed', q => { q.action.toToken.address = BNB; }, 'toToken'],
  ['the source chain was changed', q => { q.action.fromChainId = 1; }, 'fromChain'],
  ['the destination chain was changed', q => { q.action.toChainId = 137; }, 'toChain'],
  ['the least I would receive is more than the estimate', q => { q.estimate.toAmountMin = '999000000000000000000'; }, 'toAmountMin'],
  ['I would receive nothing', q => { q.estimate.toAmount = '0'; q.estimate.toAmountMin = '0'; }, 'empty'],
  ['the amounts are not numbers', q => { q.estimate.toAmount = '1e21'; }, 'toAmount'],
  ['there is no transaction at all', q => { delete q.transactionRequest; }, 'shape'],
  ['the data is not hex', q => { q.transactionRequest.data = 'javascript:alert(1)'; }, 'data'],
  ['the value is not a quantity', q => { q.transactionRequest.value = '1000'; }, 'value'],
  ['the address to approve is some other contract', q => { q.action.fromToken.address = USDT; q.transactionRequest.value = '0x0'; q.estimate.approvalAddress = '0x' + '8'.repeat(40); }, 'approvalAddress'],
  ['the approval address is missing', q => { q.action.fromToken.address = USDT; q.transactionRequest.value = '0x0'; delete q.estimate.approvalAddress; }, 'approvalAddress']
];
for (const [name, mut, expect] of tamper) {
  const q = goodQuote(mut);
  const r = S.checkQuote(q, /token swap|approv/.test(name) ? Object.assign({}, req, { fromToken: USDT }) : req);
  ok(r !== null, 'refused: ' + name);
}
ok(S.checkQuote(goodQuote(q => { q.transactionRequest.to = DIAMOND.toLowerCase(); }), req) === null, 'the same address in other capitals is still the same address');
ok(S.checkQuote(goodQuote(), Object.assign({}, req, { contract: '0x' + '7'.repeat(40) })) === 'contract', "a chain whose pinned contract differs refuses the transaction");

/* ---------------------------------------------------------------- a fake page and a fake wallet */
function fakeDoc(ids) {
  const mk = (tag) => {
    const el = {
      tag, attrs: {}, kids: [], listeners: {}, value: '', disabled: false, hidden: false, selected: false,
      _text: '',
      get textContent() { return this._text; },
      set textContent(v) { this._text = String(v); this.kids = []; },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      appendChild(n) { this.kids.push(n); if (n.selected) { this.value = n.value; } return n; },
      addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
      fire(t) { (this.listeners[t] || []).forEach(fn => fn.call(this, {})); },
      focus() { }
    };
    ['href', 'target', 'rel', 'src', 'id', 'placeholder'].forEach(k => Object.defineProperty(el, k, {
      get() { return this.attrs[k]; }, set(v) { this.attrs[k] = String(v); }
    }));
    return el;
  };
  const store = {};
  ids.forEach(id => { store[id] = mk('div'); });
  return {
    store,
    doc: {
      documentElement: mk('html'),
      getElementById: id => store[id] || null,
      createElement: mk,
      querySelectorAll: () => []
    }
  };
}

const IDS = ['sw-app', 'sw-from-chain', 'sw-to-chain', 'sw-from-token', 'sw-to-token', 'sw-from-custom', 'sw-to-custom',
  'sw-amount', 'sw-max', 'sw-balance', 'sw-flip', 'sw-slip', 'sw-action', 'sw-msg', 'sw-status', 'sw-quote',
  'sw-receive', 'sw-min', 'sw-route', 'sw-gas', 'sw-fee', 'sw-time', 'sw-tokenwarn', 'sw-account'];

const DATA = {
  chains: [{ id: 56, name: 'BNB Smart Chain', coin: 'BNB', explorer: 'https://bscscan.com/', rpc: 'https://bsc-dataseed.binance.org', contract: DIAMOND }],
  tokens: { '56': [{ symbol: 'BNB', name: 'BNB', address: BNB, decimals: 18 }, { symbol: 'USDT', name: 'USDT', address: USDT, decimals: 18 }] }
};

function makeWindow(cfg, opts) {
  opts = opts || {};
  const { store, doc } = fakeDoc(IDS);
  store['sw-app'].setAttribute('data-c', JSON.stringify(cfg));
  store['sw-app'].setAttribute('data-d', JSON.stringify(DATA));
  const sent = [];
  const provider = {
    request({ method, params }) {
      if (method === 'eth_requestAccounts') { return Promise.resolve([ME]); }
      if (method === 'eth_chainId') { return Promise.resolve('0x38'); }
      if (method === 'eth_getBalance') { return Promise.resolve('0x3635c9adc5dea00000'); }   // 1000 coins
      if (method === 'eth_call') {
        const d = params[0].data;
        if (d.indexOf('0xdd62ed3e') === 0) { return Promise.resolve(opts.allowance || '0x0'); }
        return Promise.resolve('0x3635c9adc5dea00000');
      }
      if (method === 'eth_sendTransaction') { sent.push(params[0]); return Promise.resolve('0x' + 'ab'.repeat(32)); }
      if (method === 'eth_getTransactionReceipt') { return Promise.resolve({ status: '0x1' }); }
      return Promise.reject(new Error('unexpected ' + method));
    },
    on() { }
  };
  const win = { document: doc, localStorage: { getItem: () => null, setItem() { } }, ethereum: provider };
  win.self = win; win.top = opts.framed ? {} : win;
  return { win, store, sent };
}

const CFG = { enabled: true, integrator: 'entekhab', fee: 0.005, slippage: 0.005 };

(async function () {
  /* the page refuses to run inside someone else's frame */
  let t = makeWindow(CFG, { framed: true });
  ok(S.start(t.win) === 'framed', "inside another site's frame: the tool does not start");

  /* switched off */
  t = makeWindow({ enabled: false });
  ok(S.start(t.win) === 'off', 'switched off: the tool does not start');

  /* ---- a full, honest swap */
  let urls = [];
  let serve = () => goodQuote();
  global.fetch = (u) => { urls.push(u); return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(serve())) }); };

  t = makeWindow(CFG);
  ok(S.start(t.win) === 'on', 'good settings: the tool starts');
  ok(t.store['sw-from-chain'].kids.length === 1 && t.store['sw-from-token'].kids.length === 3, 'the chain and token lists are built (tokens + "another address")');
  ok(t.store['sw-from-token'].value !== t.store['sw-to-token'].value, 'the two sides do not open on the same token');
  ok(t.store['sw-from-token'].kids.every(o => o._text.indexOf('<') < 0), 'token names are written as text, never as markup');

  t.store['sw-action'].fire('click');                       // connect
  await sleep(30);
  ok(t.store['sw-account'].textContent.indexOf('0x1111') === 0, 'the wallet is connected and its address is shown shortened');

  t.store['sw-amount'].value = '1';
  t.store['sw-amount'].fire('input');
  await sleep(750);
  const q = urls.find(u => u.indexOf('/v1/quote') > 0);
  ok(!!q, 'a price was asked for');
  ok(urls.every(u => u.indexOf('https://li.quest/') === 0), 'every request went to li.quest and nowhere else');
  ok(q.indexOf('integrator=entekhab') > 0 && q.indexOf('fee=0.005') > 0, "the site's integrator name and fee travel with the request");
  ok(q.indexOf('fromAddress=' + ME) > 0 && q.indexOf('toAddress=' + ME) > 0, 'the proceeds are asked to be sent to the reader, nobody else');
  ok(t.store['sw-receive'].textContent.indexOf('550') === 0, 'what the reader would receive is shown');
  ok(t.store['sw-min'].textContent.indexOf('547') === 0, 'the least they would receive is shown');
  ok(t.store['sw-action'].getAttribute('data-need') === 'swap', 'the button is ready to swap (a coin swap needs no approval)');

  t.store['sw-action'].fire('click');
  await sleep(60);
  ok(t.sent.length === 1, 'exactly one transaction was handed to the wallet');
  const tx = t.sent[0], gq = goodQuote();
  ok(tx.to === gq.transactionRequest.to && tx.data === gq.transactionRequest.data && tx.value === gq.transactionRequest.value,
    "what the wallet signs is byte for byte the service's transaction");
  ok(tx.from === ME, 'it is sent from the reader\'s own address');
  ok(Object.keys(tx).sort().join() === 'data,from,gas,to,value', 'nothing else is slipped into the transaction');
  ok(t.store['sw-status'].kids.length === 1 && t.store['sw-status'].kids[0].attrs.href.indexOf('https://bscscan.com/tx/0xabab') === 0, 'a link to the transaction is shown on the right explorer');
  ok(t.store['sw-status'].kids[0].attrs.rel === 'noopener noreferrer', 'that link opens safely');

  /* ---- the same swap, but the service answers with a tampered transaction */
  for (const [name, mut] of [['another contract', q2 => { q2.transactionRequest.to = '0x' + '9'.repeat(40); }],
                             ['a bigger amount of my coin', q2 => { q2.transactionRequest.value = '0x8ac7230489e80000'; }],
                             ['another chain', q2 => { q2.transactionRequest.chainId = 1; }],
                             ['someone else as the receiver', q2 => { q2.action.toAddress = '0x' + '4'.repeat(40); }]]) {
    serve = () => goodQuote(mut);
    const t2 = makeWindow(CFG);
    S.start(t2.win);
    t2.store['sw-action'].fire('click'); await sleep(30);
    t2.store['sw-amount'].value = '1'; t2.store['sw-amount'].fire('input'); await sleep(750);
    t2.store['sw-action'].fire('click'); await sleep(60);
    ok(t2.sent.length === 0, 'nothing was signed when the answer pointed at ' + name);
    ok(t2.store['sw-msg'].textContent.length > 0, '…and the reader was told why');
  }

  /* ---- a token swap: the approval is for this swap's amount only */
  serve = () => goodQuote(q2 => {
    q2.action.fromToken = { address: USDT, decimals: 18, symbol: 'USDT' };
    q2.action.toToken = { address: BNB, decimals: 18, symbol: 'BNB' };
    q2.transactionRequest.value = '0x0';
  });
  const t3 = makeWindow(CFG, { allowance: '0x0' });
  S.start(t3.win);
  t3.store['sw-from-token'].value = USDT; t3.store['sw-from-token'].fire('change');
  t3.store['sw-to-token'].value = BNB; t3.store['sw-to-token'].fire('change');
  t3.store['sw-action'].fire('click'); await sleep(30);
  t3.store['sw-amount'].value = '1'; t3.store['sw-amount'].fire('input'); await sleep(800);
  ok(t3.store['sw-action'].getAttribute('data-need') === 'approve', 'a token with no permission yet asks for approval first');
  t3.store['sw-action'].fire('click'); await sleep(120);
  ok(t3.sent.length === 1 && t3.sent[0].to === USDT, 'the approval goes to the token itself');
  const amt = t3.sent[0].data.slice(10 + 64);
  ok(t3.sent[0].data.indexOf('0x095ea7b3') === 0, 'it is an approve call');
  ok(BigInt('0x' + amt) === 1000000000000000000n, 'it approves exactly this swap, not an unlimited amount');
  ok(BigInt('0x' + amt) !== (2n ** 256n - 1n), 'it is certainly not the unlimited value');

  /* ---- the service is unreachable */
  global.fetch = () => Promise.reject(new Error('network down'));
  const t4 = makeWindow(CFG);
  S.start(t4.win);
  t4.store['sw-action'].fire('click'); await sleep(30);
  t4.store['sw-amount'].value = '1'; t4.store['sw-amount'].fire('input'); await sleep(750);
  ok(t4.sent.length === 0 && t4.store['sw-msg'].textContent.length > 0, 'when the price service is down nothing is signed and the reader is told');

  /* ---------------------------------------------------------------- the file itself */
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'swap', 'swap.js'), 'utf8');
  let code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
  for (const w of ['eval(', 'new Function', 'innerHTML', 'outerHTML', 'document.write', 'insertAdjacentHTML', 'srcdoc',
    'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'importScripts', 'document.cookie', 'eth_sign', 'personal_sign',
    'signTypedData', 'eth_sendRawTransaction', 'privateKey', 'mnemonic', 'createElement(\'script', 'createElement("script']) {
    ok(code.indexOf(w) < 0, 'swap.js never uses ' + w);
  }
  const hosts = (code.match(/https?:\/\/[^'"\s)]+/g) || []);
  ok(hosts.length === 1 && hosts[0] === 'https://li.quest', 'the only address written into swap.js is https://li.quest');
  ok(/localStorage\.(getItem|setItem)\('ck_lang'/.test(code) && (code.match(/localStorage\./g) || []).length === 2,
    'the only thing kept in the browser is the chosen site language');
  ok(code.indexOf('fetch(') > 0 && /fetch\(u, \{/.test(code), 'there is exactly one place that reaches the network');
  ok(code.indexOf('MAX_FEE = 0.03') > 0, 'the 3% ceiling on the fee is in the file itself');

  console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASS'));
  process.exit(fails ? 1 : 0);
})();
