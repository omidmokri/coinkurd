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
const freshWallet = () => { S.W.p = null; S.W.account = ''; S.W.chainId = 0; };   // the module keeps one wallet object

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
ok(S.checkQuote(goodQuote(), Object.assign({}, req, { fromDecimals: 18, toDecimals: 18 })) === null, 'the same decimals on both sides pass');
ok(S.checkQuote(goodQuote(), Object.assign({}, req, { toDecimals: 6 })) === 'toDecimals', 'refused: the service counts the token in other decimals than the page');
ok(S.checkQuote(goodQuote(q => { q.transactionRequest.data = '0x' + 'ab'.repeat(250000); }), req) === 'dataSize', 'refused: call data far larger than any route needs');

/* ---------------------------------------------------------------- a fake page and a fake wallet */
function fakeDoc(ids) {
  const mk = (tag) => {
    const el = {
      tag, attrs: {}, kids: [], listeners: {}, value: '', disabled: false, hidden: false, checked: false,
      _text: '',
      get textContent() { return this._text + this.kids.map(k => k.textContent).join(''); },
      set textContent(v) { this._text = String(v); this.kids = []; },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      appendChild(n) { this.kids.push(n); return n; },
      addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
      fire(t, ev) { (this.listeners[t] || []).forEach(fn => fn.call(this, ev || { target: this })); },
      focus() { }
    };
    return el;
  };
  const store = {};
  ids.forEach(id => { store[id] = mk('div'); });
  return { store, doc: { documentElement: mk('html'), getElementById: id => store[id] || null, createElement: mk, querySelectorAll: () => [] } };
}

const IDS = ['app', 'fc', 'fc-i', 'fc-n', 'ft', 'ft-i', 'ft-n', 'tc', 'tc-i', 'tc-n', 'tt', 'tt-i', 'tt-n', 'amount', 'max', 'balance',
  'from-usd', 'to-usd', 'flip', 'receive', 'quote', 'rate', 'min', 'route', 'gas', 'fee', 'time', 'impact', 'slip', 'tokenwarn',
  'ackbox', 'ack', 'account', 'action', 'action-l', 'action-x', 'msg', 'status', 'dlg', 'dlg-title', 'dlg-q', 'dlg-list',
  'dlg-find', 'dlg-close'].map(x => 'sw-' + x);

const DATA = {
  chains: [{ id: 56, name: 'BNB Smart Chain', coin: 'BNB', explorer: 'https://bscscan.com/', rpc: 'https://bsc-dataseed.binance.org', contract: DIAMOND, ic: 'c/56.svg' },
           { id: 1, name: 'Ethereum', coin: 'ETH', explorer: 'https://etherscan.io/', rpc: 'https://ethereum-rpc.publicnode.com', contract: DIAMOND, ic: 'https://evil.example/x.svg' }],
  tokens: { '56': [{ symbol: 'BNB', name: 'BNB', address: BNB, decimals: 18, ic: 't/bnb.webp' }, { symbol: 'USDT', name: 'USDT', address: USDT, decimals: 18, ic: 't/usdt.webp' }],
            '1': [{ symbol: 'ETH', name: 'Ether', address: BNB, decimals: 18 }, { symbol: 'USDT', name: 'USDT', address: USDT, decimals: 6 }] }
};

function makeWindow(cfg, opts) {
  opts = opts || {};
  const { store, doc } = fakeDoc(IDS);
  store['sw-app'].setAttribute('data-c', JSON.stringify(cfg));
  store['sw-app'].setAttribute('data-d', JSON.stringify(DATA));
  const sent = [], asked = [], flags = { chain: opts.chainId || '0x38', deafChain: false };
  const provider = {
    request({ method, params }) {
      if (method === 'eth_requestAccounts') { asked.push('prompt'); return Promise.resolve([ME]); }
      if (method === 'eth_accounts') { return opts.allowed || asked.length ? Promise.resolve([flags.account || ME]) : Promise.resolve([]); }
      if (method === 'eth_chainId') { return flags.deafChain ? new Promise(() => {}) : Promise.resolve(flags.chain); }
      if (method === 'eth_getBalance') { return opts.deaf ? new Promise(() => {}) : Promise.resolve('0x3635c9adc5dea00000'); }
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
  const $ = id => store['sw-' + id];
  return { win, store, sent, asked, flags, $,
    need: () => $('action').getAttribute('data-need'),
    go: () => $('action').fire('click'),
    type: async (v) => { $('amount').value = v; $('amount').fire('input'); await sleep(750); },
    rows: () => $('dlg-list').kids.filter(k => k.attrs.class === 'sw-opt'),
    pick: (button, word) => { $(button).fire('click'); const r = $('dlg-list').kids.find(k => k.kids[1] && k.kids[1]._text === word); if (r) { r.fire('click'); } return !!r; } };
}

const CFG = { enabled: true, integrator: 'entekhab', fee: 0.003, slippage: 0.005 };

(async function () {
  let urls = [], serve = () => goodQuote(), token = null, status = null;
  global.fetch = (u) => {
    urls.push(u);
    const body = u.indexOf('/v1/quote') > 0 ? serve() : u.indexOf('/v1/token') > 0 ? token : u.indexOf('/v1/status') > 0 ? status : null;
    return Promise.resolve({ ok: !!body, status: body ? 200 : 404, text: () => Promise.resolve(JSON.stringify(body || { message: 'not found' })) });
  };
  S.tune({ wait: 300 });

  /* the page refuses to run inside someone else's frame, or switched off */
  let t = makeWindow(CFG, { framed: true });
  ok(S.start(t.win) === 'framed', "inside another site's frame: the tool does not start");
  freshWallet(); t = makeWindow({ enabled: false });
  ok(S.start(t.win) === 'off', 'switched off: the tool does not start');
  freshWallet(); t = makeWindow(CFG); delete t.store['sw-action'];
  ok(S.start(t.win) === 'off', 'a page missing one of its parts does not half-work');

  /* ---- a full, honest swap */
  freshWallet(); t = makeWindow(CFG);
  ok(S.start(t.win) === 'on', 'good settings: the tool starts');
  ok(t.win.I18N === 1 && typeof t.win.EKSET === 'function', "the page follows the site's language buttons (the header's contract)");
  ok(t.win.__ekAsk === 1 && typeof t.win.liveRefresh === 'function', "the site's chat assistant and the Binance ticker are kept off this page");
  ok(t.$('ft-n').textContent === 'BNB' && t.$('tt-n').textContent === 'USDT', 'the two sides open on different tokens');
  ok(t.$('ft-i').kids.length === 1 && t.$('ft-i').kids[0].attrs.src === '/assets/swap/ic/t/bnb.webp', "a token's picture comes from this site's own folder");
  ok(t.need() === 'connect', 'a wallet that has never allowed the site: the button offers to connect');
  t.go(); await sleep(40);
  ok(t.$('account').textContent.indexOf('0x1111') === 0, 'the wallet is connected and its address is shown shortened');
  ok(t.asked.length === 1, 'it was asked exactly once');
  await t.type('1');
  const q = urls.find(u => u.indexOf('/v1/quote') > 0);
  ok(!!q, 'a price was asked for');
  ok(urls.every(u => u.indexOf('https://li.quest/') === 0), 'every request went to li.quest and nowhere else');
  ok(q.indexOf('integrator=entekhab') > 0 && q.indexOf('fee=0.003') > 0, "the site's integrator name and fee travel with the request");
  ok(q.indexOf('fromAddress=' + ME) > 0 && q.indexOf('toAddress=' + ME) > 0, 'the proceeds are asked to be sent to the reader, nobody else');
  ok(t.$('receive').textContent.indexOf('550') === 0, 'what the reader would receive is shown');
  ok(t.$('min').textContent.indexOf('547') === 0, 'the least they would receive is shown');
  ok(t.$('rate').textContent.indexOf('1 BNB ≈ 550') === 0, 'the rate is worked out in whole numbers');
  ok(t.need() === 'swap', 'the button is ready to swap (a coin swap needs no approval)');
  t.go(); await sleep(80);
  ok(t.sent.length === 1, 'exactly one transaction was handed to the wallet');
  const tx = t.sent[0], gq = goodQuote();
  ok(tx.to === gq.transactionRequest.to && tx.data === gq.transactionRequest.data && tx.value === gq.transactionRequest.value,
    "what the wallet signs is byte for byte the service's transaction");
  ok(tx.from === ME && tx.chainId === '0x38', "it is sent from the reader's own address, marked for the chain it was built for");
  ok(Object.keys(tx).sort().join() === 'chainId,data,from,gas,to,value', 'nothing else is slipped into the transaction');
  const link = t.$('status').kids[0] && t.$('status').kids[0].kids[0];
  ok(!!link && link.attrs.href.indexOf('https://bscscan.com/tx/0xabab') === 0 && link.attrs.rel === 'noopener noreferrer', 'a safe link to the transaction on the right explorer is shown');
  ok(t.$('msg').textContent === S.T.fa.done, 'the reader is told the swap is done');

  /* ---- the same swap, but the service answers with a tampered transaction */
  for (const [name, mut] of [['another contract', q2 => { q2.transactionRequest.to = '0x' + '9'.repeat(40); }],
                             ['a bigger amount of my coin', q2 => { q2.transactionRequest.value = '0x8ac7230489e80000'; }],
                             ['another chain', q2 => { q2.transactionRequest.chainId = 1; }],
                             ['someone else as the receiver', q2 => { q2.action.toAddress = '0x' + '4'.repeat(40); }]]) {
    serve = () => goodQuote(mut);
    freshWallet(); const t2 = makeWindow(CFG, { allowed: true });
    S.start(t2.win); await sleep(40); await t2.type('1'); t2.go(); await sleep(60);
    ok(t2.sent.length === 0, 'nothing was signed when the answer pointed at ' + name);
    ok(t2.$('msg').textContent.length > 0 && t2.$('receive').textContent === '', '…the reader was told, and no figure from that answer was shown');
  }
  serve = () => goodQuote();

  /* ---- the wallet is asked again, right before signing, where it is and who it is */
  freshWallet(); let tw = makeWindow(CFG, { allowed: true });
  S.start(tw.win); await sleep(40); await tw.type('1');
  tw.flags.chain = '0x1'; tw.go(); await sleep(80);
  ok(tw.sent.length === 0 && tw.$('msg').textContent === S.T.fa.chainMoved, 'the wallet moved to another network after the price came: nothing is signed');
  freshWallet(); tw = makeWindow(CFG, { allowed: true });
  S.start(tw.win); await sleep(40); await tw.type('1');
  tw.flags.account = '0x' + '5'.repeat(40); tw.go(); await sleep(80);
  ok(tw.sent.length === 0 && tw.$('msg').textContent === S.T.fa.chainMoved, 'the wallet switched to another account: nothing is signed');
  freshWallet(); tw = makeWindow(CFG, { allowed: true });
  S.start(tw.win); await sleep(40); await tw.type('1');
  tw.flags.deafChain = true; tw.go(); await sleep(500);
  ok(tw.sent.length === 0 && tw.$('msg').textContent === S.T.fa.chainUnknown, 'a wallet that will not say which network it is on is not sent a transaction');

  /* ---- a price that has gone stale is fetched again instead of being signed */
  freshWallet(); let ts = makeWindow(CFG, { allowed: true });
  S.start(ts.win); await sleep(40); await ts.type('1');
  S.tune({ life: -1 }); const before = urls.length; ts.go(); await sleep(120); S.tune({ life: 60000 });
  ok(ts.sent.length === 0 && urls.length === before + 1, 'a stale price is not signed; a fresh one is fetched');
  ok(ts.$('msg').textContent === S.T.fa.refreshed && ts.need() === 'swap', '…and the reader is asked to look again before confirming');

  /* ---- a swap that throws away much of its value needs a deliberate tick */
  serve = () => goodQuote(q2 => { q2.estimate.fromAmountUSD = '100'; q2.estimate.toAmountUSD = '60'; });
  freshWallet(); let ta = makeWindow(CFG, { allowed: true });
  S.start(ta.win); await sleep(40); await ta.type('1');
  ok(ta.need() === 'ack' && ta.$('ackbox').hidden === false && ta.$('action').disabled === true, 'losing 40% of the value: the button is locked behind a tick box');
  ok(ta.$('impact').attrs['data-level'] === '2' && ta.$('tokenwarn').textContent === S.T.fa.impactHigh, '…and the loss is spelled out in red');
  ta.go(); await sleep(40);
  ok(ta.sent.length === 0, 'pressing the locked button signs nothing');
  ta.$('ack').checked = true; ta.$('ack').fire('change');
  ok(ta.need() === 'swap', 'after the tick the swap is allowed');
  serve = () => goodQuote(q2 => { q2.estimate.fromAmountUSD = '200'; q2.estimate.toAmountUSD = '120'; q2.action.fromAmount = '2000000000000000000'; q2.transactionRequest.value = '0x1bc16d674ec80000'; });
  await ta.type('2');
  ok(ta.$('ack').checked === false && ta.need() === 'ack', 'a new amount needs a new tick');
  serve = () => goodQuote(q2 => { q2.estimate.fromAmountUSD = '100'; q2.estimate.toAmountUSD = '99.6'; });
  freshWallet(); ta = makeWindow(CFG, { allowed: true });
  S.start(ta.win); await sleep(40); await ta.type('1');
  ok(ta.need() === 'swap' && ta.$('ackbox').hidden === true, 'an ordinary swap needs no tick');
  serve = () => goodQuote();

  /* ---- an absurd gas limit is not passed on */
  serve = () => goodQuote(q2 => { q2.transactionRequest.gasLimit = '0xffffffffff'; });
  freshWallet(); let tg = makeWindow(CFG, { allowed: true });
  S.start(tg.win); await sleep(40); await tg.type('1'); tg.go(); await sleep(80);
  ok(tg.sent.length === 1 && !('gas' in tg.sent[0]), 'a gas limit larger than a whole block is dropped; the wallet works it out itself');
  serve = () => goodQuote();

  /* ---- the picker */
  freshWallet(); let tp = makeWindow(CFG, { allowed: true });
  S.start(tp.win); await sleep(40);
  tp.$('ft').fire('click');
  ok(tp.$('dlg').hidden === false && tp.rows().length === 2, 'the token picker opens with the chain\'s list');
  ok(tp.rows().every(r => r.attrs.translate === 'no'), 'names in the picker are never handed to the translation layers');
  tp.$('dlg-q').value = 'usd'; tp.$('dlg-q').fire('input');
  ok(tp.rows().length === 1 && tp.rows()[0].kids[1]._text === 'USDT', 'typing filters the list');
  tp.$('dlg-close').fire('click');
  ok(tp.$('dlg').hidden === true, 'the picker closes');
  ok(tp.pick('ft', 'USDT') && tp.$('ft-n').textContent === 'USDT' && tp.$('tt-n').textContent === 'BNB', "picking the other side's token swaps the two");
  tp.$('fc').fire('click');
  const eth = tp.rows().find(r => r.kids[1]._text === 'Ethereum');
  ok(!!eth && eth.kids[0].attrs['data-badge'] === '1' && eth.kids[0].kids.length === 0, 'a picture path that points outside this site is ignored: a letter badge instead');
  tp.$('dlg-close').fire('click');

  /* a token outside the short list, looked up live — unverified: no borrowed logo, and a tick before any swap */
  const FAKE = '0x' + 'f'.repeat(40);
  token = { address: FAKE, decimals: 18, symbol: 'USDT', name: 'Tether USD', verificationStatus: 'unverified' };
  tp.$('tt').fire('click'); tp.$('dlg-q').value = FAKE; tp.$('dlg-q').fire('input');
  ok(tp.$('dlg-find').hidden === false, 'an address that is not on the list can be looked up on the network');
  tp.$('dlg-find').fire('click'); await sleep(40);
  const found = tp.rows()[0];
  ok(!!found && found.kids[0].attrs['data-badge'] === '1', 'an unverified token named USDT does not get the USDT logo');
  ok(found.kids[2]._text.indexOf('⚠') === 0, '…and is marked in the list');
  found.fire('click');
  serve = () => goodQuote(q2 => { q2.action.fromToken = { address: USDT, decimals: 18 }; q2.action.toToken = { address: FAKE, decimals: 18 }; q2.transactionRequest.value = '0x0'; });
  await tp.type('1');
  ok(tp.$('tokenwarn').textContent === S.T.fa.unverified && tp.need() === 'ack', 'a swap into an unverified token is warned about and locked behind the tick');
  serve = () => goodQuote(); token = null;

  /* ---- a token swap: the approval is for this swap's amount only */
  serve = () => goodQuote(q2 => {
    q2.action.fromToken = { address: USDT, decimals: 18, symbol: 'USDT' };
    q2.action.toToken = { address: BNB, decimals: 18, symbol: 'BNB' };
    q2.transactionRequest.value = '0x0';
  });
  freshWallet(); const t3 = makeWindow(CFG, { allowed: true, allowance: '0x0' });
  S.start(t3.win); await sleep(40);
  t3.pick('ft', 'USDT'); await t3.type('1');
  ok(t3.need() === 'approve' && t3.$('action-x').textContent === 'USDT', 'a token with no permission yet asks for approval first');
  t3.go(); await sleep(150);
  ok(t3.sent.length === 1 && t3.sent[0].to === USDT && t3.sent[0].data.indexOf('0x095ea7b3') === 0, 'the approval goes to the token itself');
  ok(t3.sent[0].data.slice(10, 74).indexOf(DIAMOND.slice(2).toLowerCase()) === 24, '…for the contract pinned for this chain');
  const amt = BigInt('0x' + t3.sent[0].data.slice(74));
  ok(amt === 1000000000000000000n && amt !== (2n ** 256n - 1n), 'it approves exactly this swap, not an unlimited amount');
  serve = () => goodQuote();

  /* ---- a swap between two networks is followed to the other side */
  serve = () => goodQuote(q2 => { q2.action.toChainId = 1; q2.action.toToken = { address: USDT, decimals: 6 }; });
  status = { status: 'DONE', receiving: { txHash: '0x' + 'cd'.repeat(32) } };
  freshWallet(); const tb = makeWindow(CFG, { allowed: true });
  S.start(tb.win); await sleep(40);
  tb.$('tc').fire('click'); tb.rows().find(r => r.kids[1]._text === 'Ethereum').fire('click');
  tb.pick('tt', 'USDT'); await tb.type('1'); tb.go(); await sleep(200);
  const lines = tb.$('status').kids;
  ok(tb.sent.length === 1 && urls.some(u => u.indexOf('/v1/status') > 0), 'after the first transaction lands, the bridge is asked how the rest went');
  ok(lines.length === 3 && lines[2].kids[0].attrs.href.indexOf('https://etherscan.io/tx/0xcdcd') === 0, 'the arrival is shown with a link on the destination network');
  serve = () => goodQuote(); status = null;

  /* ---- a wallet that allowed the site earlier: picked up with no pop-up and no button press */
  freshWallet(); const tq = makeWindow(CFG, { allowed: true });
  S.start(tq.win); await sleep(60);
  ok(tq.$('account').textContent.indexOf('0x1111') === 0 && tq.asked.length === 0, 'an already-allowed wallet appears on its own and is never asked again (this hung in SafePal)');

  /* ---- a wallet sitting on another of the offered networks: the page moves to it, nothing has to be switched */
  freshWallet(); const tf = makeWindow(CFG, { allowed: true, chainId: '0x1' });
  S.start(tf.win); await sleep(60);
  ok(tf.$('fc-n').textContent === 'Ethereum' && tf.need() !== 'chain', 'the page starts on the network the wallet is already on');
  freshWallet(); const tn = makeWindow(CFG, { allowed: true, chainId: '0x2329' });
  S.start(tn.win); await sleep(60);
  ok(tn.need() === 'chain' && tn.$('action-x').textContent === 'BNB Smart Chain', 'a network this page does not offer still asks for a switch, naming the network beside the label');

  /* ---- a wallet that takes a request and never answers (SafePal closes its message channel mid-flight) */
  freshWallet(); const td = makeWindow(CFG, { allowed: true, deaf: true });
  S.start(td.win); await sleep(40); await td.type('1'); await sleep(400);
  ok(td.$('receive').textContent.indexOf('550') === 0 && td.need() === 'swap', 'the price appears and the button works even when the wallet never answers');

  /* ---- the service is unreachable, or busy */
  global.fetch = () => Promise.reject(new Error('network down'));
  freshWallet(); const t4 = makeWindow(CFG, { allowed: true });
  S.start(t4.win); await sleep(40); await t4.type('1');
  ok(t4.sent.length === 0 && t4.$('msg').textContent.length > 0, 'when the price service is down nothing is signed and the reader is told');
  global.fetch = () => Promise.resolve({ ok: false, status: 429, text: () => Promise.resolve('{"message":"Rate limit exceeded"}') });
  freshWallet(); const t5 = makeWindow(CFG, { allowed: true });
  S.start(t5.win); await sleep(40); await t5.type('1');
  ok(t5.$('msg').textContent === S.T.fa.busyService, 'a busy price service is explained in plain words');

  /* ---------------------------------------------------------------- the file itself */
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'swap', 'swap.js'), 'utf8');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
  for (const w of ['eval(', 'new Function', 'innerHTML', 'outerHTML', 'document.write', 'insertAdjacentHTML', 'srcdoc',
    'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'importScripts', 'document.cookie', 'eth_sign', 'personal_sign',
    'signTypedData', 'eth_sendRawTransaction', 'privateKey', 'mnemonic', "createElement('script", 'createElement("script', '__swap']) {
    ok(code.indexOf(w) < 0, 'swap.js never uses ' + w);
  }
  const hosts = (code.match(/https?:\/\/[^'"\s)]+/g) || []);
  ok(hosts.length === 1 && hosts[0] === 'https://li.quest', 'the only address written into swap.js is https://li.quest');
  ok((code.match(/localStorage\.\w+\('([^']+)'/g) || []).every(x => x.indexOf("'ck_lang'") > 0), 'the only thing kept in the browser is the chosen site language');
  ok((code.match(/\bfetch\(/g) || []).length === 1, 'there is exactly one place that reaches the network');
  ok(code.indexOf('MAX_FEE = 0.03') > 0, 'the 3% ceiling on the fee is in the file itself');
  for (const lg of ['fa', 'ckb', 'en']) {
    ok(Object.keys(S.T[lg]).sort().join() === Object.keys(S.T.en).sort().join(), 'every message exists in ' + lg);
    ok(Object.values(S.T[lg]).every(v => !/[{}]/.test(v)), 'no message in ' + lg + ' is glued together from parts (the translation layers need whole sentences)');
  }

  console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASS'));
  process.exit(fails ? 1 : 0);
})();
