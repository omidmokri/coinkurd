/* entekhab.net read-aloud — main thread (ES module, loaded on first use by chrome.js).

   What it reads, always on the visitor's command:
     reader.page()        the page's own content (between the header's #ek-main and the footer)
     reader.range(r)      a text selection
     reader.element(el)   one section, chosen in "pick" mode (reader.pick())

   Voices, per sentence, by the sentence's own script (not just the page language: a Persian page
   quotes English, a Sorani page quotes Persian):
     en  : the device's own voice (Web Speech), local voices preferred
     fa  : a local device voice when one exists (Android, macOS), else the site's Piper voice
     ckb : the site's Vekol voice (no device ships a Sorani voice)
   The site's voices run in /assets/reader-worker.js; the visitor is asked once, with the size,
   before one is downloaded. Numbers, percentages, dollar amounts and ranges are spelled out in
   Persian or Sorani first, because a voice reading digits one by one is useless for a markets site. */

const de = document.documentElement;
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
const UI = () => { const l = (de.getAttribute('lang') || 'fa').toLowerCase(); return l.startsWith('ckb') || l === 'ku' ? 'ckb' : l.startsWith('en') ? 'en' : 'fa'; };

/* ---------------- UI strings ---------------- */
const TX = {
  fa: {
    play: 'ادامه', pause: 'مکث', stop: 'توقف', speed: 'سرعت', prep: 'آماده‌سازی…',
    dl: (l, p) => `بارگیری صدای ${l}… ${p}٪`, of: (a, b) => `${a} از ${b}`, none: 'متنی برای خواندن پیدا نشد.',
    pick: 'روی هر بخشی که می‌خواهید خوانده شود بزنید — Esc برای لغو', noen: 'این دستگاه صدای انگلیسی ندارد؛ جمله‌های انگلیسی رد می‌شوند.',
    err: 'پخش صدا ممکن نشد', askT: l => `صدای ${l} — یک‌بار بارگیری`,
    askB: (l, mb) => `این دستگاه صدای ${l} ندارد، پس سایت صدای خودش را می‌دهد: حدود ${mb} مگابایت، فقط یک‌بار. بعد از آن بدون اینترنت کار می‌کند. متن شما هیچ‌وقت از دستگاه‌تان خارج نمی‌شود.`,
    yes: 'بارگیری و پخش', no: 'نه، ممنون', ckbCr: 'صدای کوردی: Vekol-TTS از Revge (CC BY-NC 4.0)', faCr: 'صدای فارسی: Piper — amir',
    L: { fa: 'فارسی', ckb: 'کوردی', en: 'انگلیسی' }, close: 'بستن'
  },
  ckb: {
    play: 'بەردەوامبوون', pause: 'وەستان', stop: 'ڕاگرتن', speed: 'خێرایی', prep: 'ئامادەکردن…',
    dl: (l, p) => `داگرتنی دەنگی ${l}… ٪${p}`, of: (a, b) => `${a} لە ${b}`, none: 'هیچ دەقێک بۆ خوێندنەوە نەدۆزرایەوە.',
    pick: 'لەسەر هەر بەشێک کە دەتەوێت بخوێندرێتەوە دابگرە — Esc بۆ پاشگەزبوونەوە', noen: 'ئەم ئامێرە دەنگی ئینگلیزیی نییە؛ ڕستە ئینگلیزییەکان تێدەپەڕێنرێن.',
    err: 'لێدانی دەنگ نەکرا', askT: l => `دەنگی ${l} — یەکجار داگرتن`,
    askB: (l, mb) => `ئەم ئامێرە دەنگی ${l}ی نییە، بۆیە ماڵپەڕەکە دەنگی خۆی دەدات: نزیکەی ${mb} مێگابایت، تەنها یەکجار. دواتر بەبێ ئینتەرنێت کار دەکات. دەقەکەت هەرگیز لە ئامێرەکەت دەرناچێت.`,
    yes: 'داگرتن و لێدان', no: 'نەخێر، سوپاس', ckbCr: 'دەنگی کوردی: Vekol-TTS لە Revge (CC BY-NC 4.0)', faCr: 'دەنگی فارسی: Piper — amir',
    L: { fa: 'فارسی', ckb: 'کوردی', en: 'ئینگلیزی' }, close: 'داخستن'
  },
  en: {
    play: 'Resume', pause: 'Pause', stop: 'Stop', speed: 'Speed', prep: 'Preparing…',
    dl: (l, p) => `Downloading the ${l} voice… ${p}%`, of: (a, b) => `${a} of ${b}`, none: 'Nothing to read here.',
    pick: 'Tap the part you want read aloud — Esc to cancel', noen: 'This device has no English voice; English sentences are skipped.',
    err: 'Could not play audio', askT: l => `${l} voice — one-time download`,
    askB: (l, mb) => `This device has no ${l} voice, so the site supplies its own: about ${mb} MB, downloaded once. After that it works offline. Your text never leaves your device.`,
    yes: 'Download and play', no: 'No thanks', ckbCr: 'Kurdish voice: Vekol-TTS by Revge (CC BY-NC 4.0)', faCr: 'Persian voice: Piper — amir',
    L: { fa: 'Persian', ckb: 'Kurdish', en: 'English' }, close: 'Close'
  }
};
const t = () => TX[UI()];
const DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩' };
const nd = (s, l = UI()) => DIG[l] ? String(s).replace(/\d/g, d => DIG[l][d]) : String(s);

/* ---------------- numbers to words ---------------- */
const FA = {
  ones: ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'],
  teens: ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'],
  tens: ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'],
  hund: ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'],
  big: [[1e12, 'تریلیون'], [1e9, 'میلیارد'], [1e6, 'میلیون'], [1e3, 'هزار']], and: ' و ', zero: 'صفر'
};
const CK = {
  ones: ['', 'یەک', 'دوو', 'سێ', 'چوار', 'پێنج', 'شەش', 'حەوت', 'هەشت', 'نۆ'],
  teens: ['دە', 'یازدە', 'دوازدە', 'سێزدە', 'چواردە', 'پازدە', 'شازدە', 'حەڤدە', 'هەژدە', 'نۆزدە'],
  tens: ['', '', 'بیست', 'سی', 'چل', 'پەنجا', 'شەست', 'حەفتا', 'هەشتا', 'نەوەد'],
  hund: null, big: [[1e12, 'تریلیۆن'], [1e9, 'ملیار'], [1e6, 'ملیۆن'], [1e3, 'هەزار']], and: ' و ', zero: 'سفر'
};
function u100(n, W) { if (n < 10) return W.ones[n]; if (n < 20) return W.teens[n - 10]; const r = n % 10, tt = W.tens[(n / 10) | 0]; return r ? tt + W.and + W.ones[r] : tt; }
function u1000(n, W) {
  if (n < 100) return u100(n, W);
  const h = (n / 100) | 0, r = n % 100;
  const hw = W.hund ? W.hund[h] : (h === 1 ? 'سەد' : W.ones[h] + 'سەد');
  return r ? hw + W.and + u100(r, W) : hw;
}
function spell(n, W) {
  if (!Number.isSafeInteger(n)) return null;
  if (n === 0) return W.zero;
  const parts = [];
  for (const [div, word] of W.big) if (n >= div) { const q = Math.floor(n / div); n %= div; parts.push(q === 1 && div === 1e3 ? word : u1000(q, W) + ' ' + word); }
  if (n) parts.push(u1000(n, W));
  return parts.join(W.and);
}
function digitsOneByOne(s, W) { return [...s].map(d => d === '0' ? W.zero : W.ones[+d]).join(' '); }

const TO_ASCII = s => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu;
const TICK = {
  fa: { BTC: 'بیت‌کوین', ETH: 'اتریوم', USDT: 'تتر', USD: 'دلار', RSI: 'آر اس آی', ETF: 'ای تی اف', SOL: 'سولانا', XRP: 'ریپل', BNB: 'بی ان بی', TON: 'تون', DOGE: 'دوج' },
  ckb: { BTC: 'بیتکۆین', ETH: 'ئیسریۆم', USDT: 'تێسەر', USD: 'دۆلار', RSI: 'ئاڕ ئێس ئای', ETF: 'ئی تی ئێف', SOL: 'سۆلانا', XRP: 'ڕیپڵ', BNB: 'بی ئێن بی', TON: 'تۆن', DOGE: 'دۆج' }
};

function numbers(s, lang) {
  const W = lang === 'ckb' ? CK : FA;
  const pct = lang === 'ckb' ? 'لەسەدا' : 'درصد', usd = lang === 'ckb' ? 'دۆلار' : 'دلار', to = lang === 'ckb' ? ' بۆ ' : ' تا ';
  const point = lang === 'ckb' ? ' پۆینت ' : ' ممیز ', minus = lang === 'ckb' ? 'کەم ' : 'منفی ';
  s = TO_ASCII(s);
  s = s.replace(/(\d)[,٬](?=\d{3}(?!\d))/g, '$1');                         // 97,000 -> 97000
  s = s.replace(/\$\s?(\d[\d.٫]*)/g, '$1 ' + usd + ' ').replace(/(\d)\s?\$/g, '$1 ' + usd + ' ');
  s = s.replace(/(\d)\s?([KMB])\b/g, (m, d, u) => d + ' ' + ({ K: W.big[3][1], M: W.big[2][1], B: W.big[1][1] })[u]);
  if (lang === 'ckb') s = s.replace(/(\d[\d.٫]*)\s?[%٪]/g, ' ' + pct + ' $1 ').replace(/[%٪]\s?(\d[\d.٫]*)/g, ' ' + pct + ' $1 ');
  else s = s.replace(/[%٪]\s?(\d[\d.٫]*)/g, '$1 ' + pct + ' ').replace(/(\d[\d.٫]*)\s?[%٪]/g, '$1 ' + pct + ' ');
  s = s.replace(/(\d)\s?[-–]\s?(?=\d)/g, '$1' + to);
  s = s.replace(/(^|[\s(])[-−](?=\d)/g, '$1' + minus);
  s = s.replace(/(\d+)[.٫](\d+)/g, (m, a, b) => {
    const A = spell(+a, W) ?? digitsOneByOne(a, W);
    const B = /^0/.test(b) || b.length > 3 ? digitsOneByOne(b, W) : spell(+b, W);
    return ' ' + A + point + B + ' ';
  });
  s = s.replace(/\d+/g, m => ' ' + (m.length > 15 ? digitsOneByOne(m, W) : (spell(+m, W) ?? digitsOneByOne(m, W))) + ' ');
  return s;
}

const CKB_FOLD = { 'ك': 'ک', 'ھ': 'ه', 'ہ': 'ه', 'ۀ': 'ە', 'ة': 'ە', 'ى': 'ی', 'ي': 'ی', 'ﻯ': 'ی', 'ﺉ': 'ئ', 'ٸ': 'ئ', 'ؤ': 'و', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ڭ': 'گ', '‌': '', '‍': '', 'ـ': '', '“': '"', '”': '"', '’': "'", '‘': "'", '—': '-', '–': '-', '…': '.', '«': '"', '»': '"' };
function normalize(s, lang) {
  s = s.replace(EMOJI, ' ').replace(/[•·▲▼►◄→←↑↓✓✔✗✕|]/g, ' ');
  if (lang === 'en') return s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\b[A-Z]{2,5}\b/g, w => TICK[lang][w] || w);
  s = numbers(s, lang);
  if (lang === 'ckb') s = [...s].map(c => CKB_FOLD[c] ?? c).join('').replace(/[A-Za-z]+/g, ' ');
  return s.replace(/\s+/g, ' ').replace(/\s+([.،,؛;:!?؟])/g, '$1').trim();
}

/* ---------------- language of a sentence ---------------- */
const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g, LA = /[A-Za-z]/g, KU = /[ێۆڕڵەڤ]/;
function langOf(s, page) {
  const a = (s.match(AR) || []).length, b = (s.match(LA) || []).length;
  if (!a && !b) return /\d/.test(s) ? page : null;
  if (b > a * 1.5) return 'en';
  if (!a) return 'en';
  if (KU.test(s)) return 'ckb';
  return page === 'ckb' ? 'ckb' : 'fa';
}

/* ---------------- collecting text from the page ---------------- */
const SKIP = 'script,style,noscript,template,svg,canvas,iframe,video,audio,input,textarea,select,button,[aria-hidden="true"],[hidden],.marquee,.ek-skip,#ekh,#ekf,#ekb,#eks,.ek-rd,.ek-rd-dlg,.ek-rd-bub,.ek-rd-toast';
const INLINE = new Set(['inline', 'inline-block', 'contents', 'inline-flex']);
const blockCache = new WeakMap();
function blockOf(n) {
  for (let e = n.parentElement; e; e = e.parentElement) {
    let b = blockCache.get(e);
    if (b === undefined) { b = !INLINE.has(getComputedStyle(e).display); blockCache.set(e, b); }
    if (b) return e;
  }
  return document.body;
}
function visible(el) {
  if (el.checkVisibility) return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  return !!(el.offsetParent || el.getClientRects().length);
}
function textNodes(root, clip) {
  const out = [], seen = new Map();
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !/\S/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
      if (clip && !clip.intersectsNode(n)) return NodeFilter.FILTER_REJECT;
      let ok = seen.get(p);
      if (ok === undefined) { ok = !p.closest(SKIP) && visible(p); seen.set(p, ok); }
      return ok ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n);
  return out;
}

/* Build sentences with DOM ranges (for highlighting) from text nodes, never merging across blocks. */
function sentences(nodes, clip, page) {
  const pieces = []; let txt = '', lastBlock = null;
  for (const n of nodes) {
    let a = 0, b = n.nodeValue.length;
    if (clip) { if (n === clip.startContainer) a = clip.startOffset; if (n === clip.endContainer) b = clip.endOffset; }
    if (b <= a) continue;
    const blk = blockOf(n);
    if (lastBlock && blk !== lastBlock) txt += '\n';
    lastBlock = blk;
    pieces.push({ n, a, g: txt.length });
    txt += n.nodeValue.slice(a, b);
  }
  const at = g => { let lo = 0, hi = pieces.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pieces[m].g <= g) lo = m; else hi = m - 1; } const p = pieces[lo]; return [p.n, Math.min(p.a + (g - p.g), p.n.nodeValue.length)]; };
  /* sentence ends: a block break, or end punctuation followed by space/end — never the dot inside
     2.5 or $97.5K, which a plain split on "." would cut in half */
  const segs = []; let from = 0;
  const END = '.!?؟…';
  for (let k = 0; k < txt.length; k++) {
    const c = txt[k];
    if (c === '\n') { segs.push([from, k]); from = k + 1; continue; }
    if (END.includes(c)) {
      let j = k; while (j + 1 < txt.length && END.includes(txt[j + 1])) j++;
      if (j + 1 >= txt.length || /\s/.test(txt[j + 1])) { segs.push([from, j + 1]); from = j + 1; }
      k = j;
    }
  }
  if (from < txt.length) segs.push([from, txt.length]);
  const out = [];
  for (const [g0, g1] of segs) {
    const raw = txt.slice(g0, g1); if (!/[\p{L}\p{N}]/u.test(raw)) continue;
    const lead = raw.length - raw.trimStart().length, s0 = g0 + lead, s1 = g0 + raw.trimEnd().length;
    if (s1 <= s0) continue;
    const text = txt.slice(s0, s1), lang = langOf(text, page);
    if (!lang) continue;
    for (const [c0, c1] of chunk(text, lang)) {
      const r = document.createRange();
      try { const [sn, so] = at(s0 + c0), [en, eo] = at(s0 + c1 - 1); r.setStart(sn, so); r.setEnd(en, eo + 1); } catch (e) { }
      out.push({ raw: text.slice(c0, c1), lang, range: r });
    }
  }
  return out;
}
/* long sentences: break at clause marks, then at spaces; Vekol wants short pieces (<=70 chars) */
function chunk(s, lang) {
  const max = lang === 'ckb' ? 70 : lang === 'fa' ? 200 : 260;
  if (s.length <= max) return [[0, s.length]];
  const out = []; let i = 0;
  while (s.length - i > max) {
    const win = s.slice(i, i + max);
    let cut = Math.max(win.lastIndexOf('،'), win.lastIndexOf(','), win.lastIndexOf('؛'), win.lastIndexOf(';'), win.lastIndexOf(':'));
    if (cut < max * 0.4) cut = win.lastIndexOf(' ');
    if (cut < max * 0.3) cut = max - 1;
    out.push([i, i + cut + 1]); i += cut + 1;
    while (s[i] === ' ') i++;
  }
  if (i < s.length) out.push([i, s.length]);
  return out;
}

/* ---------------- voices ---------------- */
let voices = [];
function loadVoices() {
  return new Promise(res => {
    if (!('speechSynthesis' in window)) return res([]);
    const v = speechSynthesis.getVoices(); if (v.length) return res(voices = v);
    const done = () => res(voices = speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true }); setTimeout(done, 1500);
  });
}
function deviceVoice(lang) {
  const c = voices.filter(v => v.lang.toLowerCase().replace('_', '-').split('-')[0] === lang);
  if (!c.length) return null;
  const local = c.filter(v => v.localService);
  if (lang !== 'en') return local[0] || null;               // fa: only on-device voices; else ours
  const pick = arr => arr.find(v => /en-(US|GB)/i.test(v.lang)) || arr[0];
  return pick(local) || pick(c);
}

/* ---------------- worker ---------------- */
let W = null, wid = 0; const wait = new Map(), progressCb = { fn: null };
function worker() {
  if (W) return W;
  W = new Worker(new URL('./reader-worker.js?v=' + (import.meta.url.split('?v=')[1] || '1'), import.meta.url), { type: 'module' });
  W.onmessage = e => {
    const m = e.data;
    if (m.op === 'progress') { progressCb.fn && progressCb.fn(m); return; }
    const p = wait.get(m.id); if (!p) return; wait.delete(m.id);
    m.ok ? p.res(m) : p.rej(new Error(m.err));
  };
  W.onerror = e => { for (const p of wait.values()) p.rej(new Error(e.message || 'worker')); wait.clear(); };
  return W;
}
function call(msg, transfer) { return new Promise((res, rej) => { const id = ++wid; wait.set(id, { res, rej }); worker().postMessage({ id, ...msg }, transfer || []); }); }

/* ---------------- UI ---------------- */
const IC = {
  pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="M7 5l12 7-12 7z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>'
};
const svg = n => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
let bar = null, els = {};
function ensureBar() {
  if (bar) return bar;
  bar = document.createElement('div'); bar.className = 'ek-rd'; bar.setAttribute('role', 'region'); bar.setAttribute('dir', UI() === 'en' ? 'ltr' : 'rtl');
  bar.innerHTML = `<button type="button" class="ek-rd-b ek-rd-pp"></button><button type="button" class="ek-rd-b ek-rd-st"></button>` +
    `<button type="button" class="ek-rd-b ek-rd-sp"></button><div class="ek-rd-tx"><b></b><small></small></div><i class="ek-rd-pg"><i></i></i>`;
  document.body.appendChild(bar);
  els = { pp: bar.querySelector('.ek-rd-pp'), st: bar.querySelector('.ek-rd-st'), sp: bar.querySelector('.ek-rd-sp'), b: bar.querySelector('.ek-rd-tx b'), cr: bar.querySelector('.ek-rd-tx small'), pg: bar.querySelector('.ek-rd-pg i') };
  els.pp.onclick = () => R.toggle(); els.st.onclick = () => R.stop(); els.sp.onclick = () => R.cycleRate();
  return bar;
}
function paint() {
  if (!bar) return; const T = t();
  bar.setAttribute('aria-label', T.speed);
  els.pp.innerHTML = svg(R.paused ? 'play' : 'pause'); els.pp.title = els.pp.ariaLabel = R.paused ? T.play : T.pause;
  els.st.innerHTML = svg('stop'); els.st.title = els.st.ariaLabel = T.stop;
  els.sp.textContent = nd(R.rate) + '×'; els.sp.title = els.sp.ariaLabel = T.speed;
}
function status(text, credit) { ensureBar(); els.b.textContent = text || ''; if (credit !== undefined) els.cr.textContent = credit || ''; }
function progress(i, n) { if (els.pg) els.pg.style.width = (n ? Math.round(100 * i / n) : 0) + '%'; }
function toast(text, ms = 3200) {
  let el = document.querySelector('.ek-rd-toast');
  if (!el) { el = document.createElement('div'); el.className = 'ek-rd-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text; el.classList.add('on'); clearTimeout(el._t); if (ms) el._t = setTimeout(() => el.classList.remove('on'), ms);
  return el;
}
function ask(lang, bytes) {
  const T = t(), mb = nd(Math.round(bytes / 1e6));
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'ek-rd-dlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('dir', UI() === 'en' ? 'ltr' : 'rtl');
    d.innerHTML = `<div class="ek-rd-card"><h3></h3><p></p><div class="ek-rd-act"><button type="button" class="ek-rd-yes"></button><button type="button" class="ek-rd-no"></button></div></div>`;
    d.querySelector('h3').textContent = T.askT(T.L[lang]); d.querySelector('p').textContent = T.askB(T.L[lang], mb);
    const y = d.querySelector('.ek-rd-yes'), n = d.querySelector('.ek-rd-no'); y.textContent = T.yes; n.textContent = T.no;
    const end = v => { d.remove(); document.removeEventListener('keydown', esc, true); res(v); };
    const esc = e => { if (e.key === 'Escape') { e.preventDefault(); end(false); } };
    y.onclick = () => end(true); n.onclick = () => end(false); d.onclick = e => { if (e.target === d) end(false); };
    document.addEventListener('keydown', esc, true);
    document.body.appendChild(d); y.focus();
  });
}

/* highlight + follow */
const HL = window.CSS && CSS.highlights && window.Highlight ? CSS.highlights : null;
let userScrolled = 0;
['wheel', 'touchmove', 'keydown'].forEach(ev => addEventListener(ev, e => { if (ev !== 'keydown' || /Arrow|Page|Home|End|Space/.test(e.code)) userScrolled = Date.now(); }, { passive: true }));
function mark(r) {
  if (HL) { if (r) HL.set('ek-read', new Highlight(r)); else HL.delete('ek-read'); }
  if (!r || Date.now() - userScrolled < 5000) return;
  const b = r.getBoundingClientRect(); if (!b.height) return;
  const top = 90, bottom = innerHeight - 110;
  if (b.top < top || b.bottom > bottom) scrollBy({ top: b.top - innerHeight * 0.35, behavior: 'smooth' });
}

/* ---------------- the reader ---------------- */
const RATES = [0.8, 1, 1.25, 1.5];
const R = {
  items: [], i: 0, gen: 0, paused: false, playing: false, rate: +ls.get('ek-rd-rate') || 1,
  ac: null, src: null, pre: new Map(), webOK: true,

  audio() {
    if (!this.ac || this.ac.state === 'closed') this.ac = window.__ekAC || new (window.AudioContext || window.webkitAudioContext)();
    window.__ekAC = this.ac; return this.ac;
  },
  async page() {
    const start = document.getElementById('ek-main'), foot = document.getElementById('ekf');
    const r = document.createRange();
    if (start) r.setStartAfter(start); else r.setStart(document.body, 0);
    if (foot) r.setEndBefore(foot); else r.setEnd(document.body, document.body.childNodes.length);
    return this.run(sentences(textNodes(document.body, r), null, UI()));
  },
  async range(r) {
    const root = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    const nodes = r.commonAncestorContainer.nodeType === 3 ? [r.commonAncestorContainer] : textNodes(root, r);
    return this.run(sentences(nodes, r, UI()));
  },
  async element(el) { return this.run(sentences(textNodes(el, null), null, UI())); },

  async run(items) {
    this.stop(true);
    const gen = ++this.gen;
    this.audio().resume().catch(() => { });
    ensureBar(); paint(); bar.classList.add('on'); status(t().prep, '');
    if (!items.length) { toast(t().none); this.stop(); return; }
    await loadVoices();
    if (gen !== this.gen) return;

    /* which languages need the site's own voice? ask once per language, with the size */
    const need = new Set();
    for (const it of items) {
      if (it.lang === 'en') { it.voice = deviceVoice('en'); if (!it.voice) it.skip = true; continue; }
      it.voice = it.lang === 'fa' ? deviceVoice('fa') : null;
      if (!it.voice) { it.neural = true; need.add(it.lang); }
    }
    if (items.some(it => it.skip) && items.some(it => it.lang === 'en')) toast(t().noen);
    for (const lang of need) {
      if (ls.get('ek-rd-ok-' + lang)) continue;
      const info = await call({ op: 'cached', lang }).catch(() => null);
      if (gen !== this.gen) return;
      if (info && info.cached) { ls.set('ek-rd-ok-' + lang, '1'); continue; }
      const ok = await ask(lang, info ? info.bytes : 0);
      if (gen !== this.gen) return;
      if (ok) ls.set('ek-rd-ok-' + lang, '1'); else items.forEach(it => { if (it.lang === lang) it.skip = true; });
    }
    this.items = items.filter(it => !it.skip);
    if (!this.items.length) { this.stop(); return; }
    this.i = 0; this.playing = true; this.paused = false; paint();
    this.audio().resume().catch(() => { });
    try { await this.loop(gen); } catch (e) { if (gen === this.gen) { toast(t().err + ' — ' + (e.message || e), 6000); this.stop(); } }
  },

  creditFor(lang) { return lang === 'ckb' ? t().ckbCr : lang === 'fa' ? t().faCr : ''; },
  pcm(k) {
    /* render ahead: the worker queues requests in order, so the next sentences render while one plays */
    if (!this.pre.has(k)) {
      const it = this.items[k];
      this.pre.set(k, call({ op: 'synth', lang: it.lang, text: normalize(it.raw, it.lang), rate: this.rate }));
    }
    return this.pre.get(k);
  },
  async loop(gen) {
    const n = this.items.length;
    while (this.i < n && gen === this.gen) {
      const it = this.items[this.i];
      status(t().of(nd(this.i + 1), nd(n)), it.neural ? this.creditFor(it.lang) : '');
      progress(this.i, n); mark(it.range);
      if (it.neural) {
        progressCb.fn = m => { if (gen === this.gen && m.lang === it.lang && m.loaded < m.total) status(t().dl(t().L[m.lang], nd(Math.floor(100 * m.loaded / m.total)))); };
        for (let k = this.i + 1, got = 0; k < n && got < 2; k++) if (this.items[k].neural) { this.pcm(k); got++; }
        const { pcm, sr } = await this.pcm(this.i);
        if (gen !== this.gen) return;
        status(t().of(nd(this.i + 1), nd(n)), this.creditFor(it.lang));
        if (pcm && pcm.length) await this.playPcm(pcm, sr, gen);
      } else {
        await this.speak(it, gen);
      }
      if (gen !== this.gen) return;
      this.pre.delete(this.i);
      this.i++;
    }
    if (gen === this.gen) { progress(n, n); this.stop(); }
  },
  playPcm(pcm, sr, gen) {
    return new Promise(res => {
      const ac = this.audio(), buf = ac.createBuffer(1, pcm.length, sr);
      buf.copyToChannel(pcm, 0);
      const s = ac.createBufferSource(); s.buffer = buf; s.connect(ac.destination);
      s.onended = () => { if (this.src === s) this.src = null; res(); };
      this.src = s; s.start();
      if (this.paused) ac.suspend();
      if (gen !== this.gen) { try { s.stop(); } catch (e) { } res(); }
    });
  },
  speak(it, gen) {
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(normalize(it.raw, it.lang));
      u.voice = it.voice; u.lang = it.voice.lang; u.rate = this.rate;
      let done = false; const fin = () => { if (!done) { done = true; clearInterval(keep); res(); } };
      u.onend = fin; u.onerror = fin;
      /* Chrome stops long utterances after ~15 s unless nudged */
      const keep = setInterval(() => { if (gen !== this.gen) return fin(); if (!this.paused && speechSynthesis.speaking) { speechSynthesis.pause(); speechSynthesis.resume(); } }, 10000);
      speechSynthesis.speak(u);
    });
  },
  toggle() {
    if (!this.playing) return;
    this.paused = !this.paused;
    const it = this.items[this.i];
    if (it && it.neural) { this.paused ? this.audio().suspend() : this.audio().resume(); }
    else if ('speechSynthesis' in window) { this.paused ? speechSynthesis.pause() : speechSynthesis.resume(); }
    paint();
  },
  cycleRate() {
    this.rate = RATES[(RATES.indexOf(this.rate) + 1) % RATES.length] || 1;
    ls.set('ek-rd-rate', String(this.rate));
    for (const k of [...this.pre.keys()]) if (k > this.i) this.pre.delete(k);   // re-render ahead at the new speed
    paint();
  },
  stop(keepBar) {
    this.gen++; this.playing = false; this.paused = false; this.pre.clear(); progressCb.fn = null;
    if (this.src) { try { this.src.stop(); } catch (e) { } this.src = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(() => { });
    mark(null);
    if (bar && !keepBar) bar.classList.remove('on');
  },

  /* pick mode: hover outlines a section, a click/tap reads it */
  pick() {
    this.stop();
    const T = t(); let hov = null;
    const tip = toast(T.pick, 0);
    de.classList.add('ek-rd-picking');
    const blockAt = el => {
      if (!el || el.closest(SKIP)) return null;
      let b = el.closest('p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,pre,article,section,[class*="card"]');
      if (!b) for (b = el; b && b !== document.body; b = b.parentElement) if ((b.innerText || '').trim().length >= 20) break;
      return b && b !== document.body ? b : null;
    };
    const over = e => { const b = blockAt(e.target); if (b === hov) return; hov && hov.classList.remove('ek-rd-hov'); hov = b; hov && hov.classList.add('ek-rd-hov'); };
    const end = () => { de.classList.remove('ek-rd-picking'); hov && hov.classList.remove('ek-rd-hov'); tip.classList.remove('on'); removeEventListener('mouseover', over, true); removeEventListener('click', click, true); removeEventListener('keydown', key, true); };
    const click = e => { const b = blockAt(e.target); if (!b) return; e.preventDefault(); e.stopPropagation(); end(); this.element(b); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); end(); } };
    addEventListener('mouseover', over, true); addEventListener('click', click, true); addEventListener('keydown', key, true);
  }
};

export { normalize, langOf, chunk };
export default R;
