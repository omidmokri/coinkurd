/* entekhab.net — اخبار چندمنبعی v2
   فارسی ← کریپتو جهانی ← بازارهای جهانی · خواندن خبر داخل همین سایت (پنجرهٔ خوانش) · ترجمهٔ هم‌زمان
   داده: data/news.json (سبک) + data/news_body.json (چکیده‌ها، فقط هنگام باز کردن خبر)
   این فایل بعد از اسکریپت اصلی index.html اجرا می‌شود و از توابع سراسری آن (X, T, lang, esc, su, ago, fmtN, markRead, RD) استفاده می‌کند. */
(function () {
  'use strict';
  const NT = {
    fa: {
      tFa: 'فارسی', tEn: 'کریپتو جهانی', tW: 'بازارهای جهانی', all: 'همه', live: 'زنده', srcOn: 'منبع فعال', upd: 'به‌روزرسانی',
      q: 'جستجو در اخبار…', tr: 'ترجمهٔ هم‌زمان', trOn: 'روشن', trOff: 'خاموش', allSrc: 'همهٔ منابع', more: 'خبرهای بیشتر',
      none: 'خبری با این فیلتر پیدا نشد.', breaking: 'تازه‌ترین‌ها', srcN: 'منبع', read: 'خواندن خبر', close: 'بستن',
      orig: 'متن اصلی', trd: 'ترجمه', noSum: 'ناشر برای این خبر چکیده‌ای منتشر نکرده است؛ تیتر و منابع بالا را ببینید.',
      loading: 'در حال آماده‌سازی…', related: 'خبرهای مرتبط', prev: 'خبر قبلی', next: 'خبر بعدی', share: 'اشتراک‌گذاری',
      copied: 'لینک کپی شد', listen: 'شنیدن', attrib: 'متن کامل در سایت ناشر', srcs: 'منابع گزارش‌دهنده', trWait: 'ترجمهٔ این خبر تا چند دقیقهٔ دیگر آماده می‌شود.',
      autoTr: 'ترجمهٔ خودکار مرورگر', aiTr: 'ترجمهٔ هوش مصنوعی Entekhab', own: 'گزارش اختصاصی کوین کورد', coins: 'کوین‌های مرتبط',
      sec_coinkurd: 'کوین کورد', sec_crypto: 'کریپتو', sec_economy: 'اقتصاد ایران', watch: 'لیست من', note: 'چکیدهٔ کوتاه همان است که ناشر منتشر کرده؛ حق نشر متن کامل با ناشر است.',
      f_gold: 'طلا و سکه', f_fx: 'دلار و ارز', f_stock: 'بورس', f_oil: 'نفت و انرژی', f_crypto: 'رمزارز', f_news: 'عمومی',
      security: 'امنیت و هک', regulation: 'قانون‌گذاری', etf_institutional: 'ETF و نهادی', onchain: 'آنچین و نهنگ‌ها', technical: 'تحلیل قیمت', news: 'عمومی',
      w_rates: 'بهره و تورم', w_stocks: 'سهام', w_commod: 'طلا و نفت', w_fx: 'ارزها', w_trade: 'تجارت و تعرفه', w_macro: 'اقتصاد کلان'
    },
    ckb: {
      tFa: 'فارسی', tEn: 'کریپتۆی جیهانی', tW: 'بازاڕە جیهانییەکان', all: 'هەموو', live: 'ڕاستەوخۆ', srcOn: 'سەرچاوەی چالاک', upd: 'نوێکردنەوە',
      q: 'گەڕان لە هەواڵەکان…', tr: 'وەرگێڕانی هاوکات', trOn: 'کراوە', trOff: 'داخراو', allSrc: 'هەموو سەرچاوەکان', more: 'هەواڵی زیاتر',
      none: 'هیچ هەواڵێک بەم فلتەرە نەدۆزرایەوە.', breaking: 'نوێترینەکان', srcN: 'سەرچاوە', read: 'خوێندنەوە', close: 'داخستن',
      orig: 'دەقی ئەسڵی', trd: 'وەرگێڕان', noSum: 'بڵاوکەرەوە پوختەی بۆ ئەم هەواڵە بڵاو نەکردۆتەوە.',
      loading: 'ئامادە دەکرێت…', related: 'هەواڵی پەیوەندیدار', prev: 'پێشوو', next: 'دواتر', share: 'هاوبەشکردن',
      copied: 'بەستەر کۆپی کرا', listen: 'گوێگرتن', attrib: 'دەقی تەواو لە ماڵپەڕی بڵاوکەرەوە', srcs: 'سەرچاوەکان', trWait: 'وەرگێڕانی ئەم هەواڵە بەم زووانە ئامادە دەبێت.',
      autoTr: 'وەرگێڕانی خۆکاری وێبگەڕ', aiTr: 'وەرگێڕانی زیرەکی دەستکردی Entekhab', own: 'ڕاپۆرتی تایبەتی کۆین کورد', coins: 'دراوە پەیوەندیدارەکان',
      sec_coinkurd: 'کۆین کورد', sec_crypto: 'کریپتۆ', sec_economy: 'ئابووری ئێران', watch: 'لیستی من', note: 'پوختەکە هەمان ئەوەیە کە بڵاوکەرەوە بڵاوی کردۆتەوە.',
      f_gold: 'ئاڵتوون و سکە', f_fx: 'دۆلار و دراو', f_stock: 'بۆرس', f_oil: 'نەوت و وزە', f_crypto: 'دراوی دیجیتاڵ', f_news: 'گشتی',
      security: 'ئاسایش و هاک', regulation: 'یاسادانان', etf_institutional: 'ETF و دامەزراوەیی', onchain: 'ئۆنچەین و نەهەنگ', technical: 'شیکاری نرخ', news: 'گشتی',
      w_rates: 'سوود و هەڵاوسان', w_stocks: 'پشک', w_commod: 'ئاڵتوون و نەوت', w_fx: 'دراوەکان', w_trade: 'بازرگانی و باج', w_macro: 'ئابووری گشتی'
    },
    en: {
      tFa: 'Persian', tEn: 'Global crypto', tW: 'World markets', all: 'All', live: 'Live', srcOn: 'sources online', upd: 'updated',
      q: 'Search the news…', tr: 'Live translation', trOn: 'on', trOff: 'off', allSrc: 'All sources', more: 'More stories',
      none: 'No stories match this filter.', breaking: 'Latest', srcN: 'sources', read: 'Read', close: 'Close',
      orig: 'Original', trd: 'Translation', noSum: 'The publisher did not include a summary for this story.',
      loading: 'Loading…', related: 'Related stories', prev: 'Previous', next: 'Next', share: 'Share',
      copied: 'Link copied', listen: 'Listen', attrib: 'Full story on the publisher’s site', srcs: 'Reported by', trWait: 'A translation of this story will be ready in a few minutes.',
      autoTr: 'Browser translation', aiTr: 'Entekhab AI translation', own: 'Coin Kurd exclusive', coins: 'Related coins',
      sec_coinkurd: 'Coin Kurd', sec_crypto: 'Crypto', sec_economy: 'Iran economy', watch: 'My list', note: 'The short summary is the one the publisher syndicates; the full text belongs to the publisher.',
      f_gold: 'Gold & coins', f_fx: 'Dollar & FX', f_stock: 'Stocks', f_oil: 'Oil & energy', f_crypto: 'Crypto', f_news: 'General',
      security: 'Security', regulation: 'Regulation', etf_institutional: 'ETFs & institutions', onchain: 'On-chain', technical: 'Price analysis', news: 'General',
      w_rates: 'Rates & inflation', w_stocks: 'Stocks', w_commod: 'Gold & oil', w_fx: 'Currencies', w_trade: 'Trade & tariffs', w_macro: 'Macro'
    }
  };
  // topic icons are glossy SVG tiles (assets/ic/nw-*.svg, made by scripts/make_icons.py) instead of emoji
  const ICON = { sec_coinkurd: 1, sec_crypto: 1, sec_economy: 1, f_gold: 1, f_fx: 1, f_stock: 1, f_oil: 1, f_crypto: 1, f_news: 1,
    security: 1, regulation: 1, etf_institutional: 1, onchain: 1, technical: 1, news: 1,
    w_rates: 1, w_stocks: 1, w_commod: 1, w_fx: 1, w_trade: 1, w_macro: 1 };
  const IC = (k, cl) => `<img class="nw-ic${cl ? ' ' + cl : ''}" src="/assets/ic/${k}.svg" alt="" loading="lazy" decoding="async" onerror="this.remove()">`;
  const icOf = it => ICON[it.category] ? 'nw-' + it.category : ICON['sec_' + it.sec] ? 'nw-sec_' + it.sec : 'nw-f_news';
  const L = k => (NT[lang] || NT.fa)[k] || NT.fa[k] || k;
  const LS = { get(k, d) { try { const v = localStorage.getItem('ekn_' + k); return v == null ? d : JSON.parse(v) } catch (e) { return d } },
    set(k, v) { try { localStorage.setItem('ekn_' + k, JSON.stringify(v)) } catch (e) { } } };
  const st = { tab: LS.get('tab', 'fa'), f: 'all', src: '', q: '', n: 13, tr: LS.get('tr', true), mounted: '', open: null, orig: false };
  const H = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h % 360 };
  const isFaTab = () => st.tab === 'fa';
  const lists = () => { const n = X.news || {}; return { fa: (n.regional && n.regional.items) || [], en: n.items || [], w: (n.world && n.world.items) || [] } };
  const cur = () => lists()[st.tab] || [];
  const wantTr = it => st.tr && (it._fa ? (lang === 'en' || (lang === 'ckb' && !!it.tckb)) : lang !== 'en');   // English UI translates Persian; fa/ckb UI translates English
  const trTitle = it => { if (!wantTr(it)) return null; return (lang === 'en' ? it.ten : (it['t' + lang] || (!it._fa && it.tfa))) || CT.get(it.title + '|' + tgt(it)) || null };
  const tgt = it => lang === 'en' ? 'en' : (lang === 'ckb' ? 'ckb' : 'fa');
  const shownTitle = it => trTitle(it) || it.title;
  const dirOf = s => /[؀-ۿ]/.test(s) ? 'rtl' : 'ltr';
  const AR = () => T('dir') === 'ltr' ? ['←', '→'] : ['→', '←'];
  const srcList = it => it.sources && it.sources.length ? it.sources : [{ source: it.source, url: it.url }];

  /* ---------- body (summaries) loaded on demand ---------- */
  let bodyP = null;
  const body = () => bodyP || (bodyP = fetch('data/news_body.json?v=' + Math.floor(Date.now() / 12e4)).then(r => r.ok ? r.json() : { b: {} }).then(j => j.b || {}).catch(() => { bodyP = null; return {} }));

  /* ---------- on-device browser translation (Chrome Translator API) as a fallback ---------- */
  const CT = new Map(); const TRS = {};
  const hasTR = () => 'Translator' in self;
  async function translator(from, to) {
    const k = from + '>' + to; if (TRS[k]) return TRS[k];
    if (!hasTR()) return null;
    try {
      const a = await self.Translator.availability({ sourceLanguage: from, targetLanguage: to });
      if (a === 'unavailable') return null;
      return (TRS[k] = await self.Translator.create({ sourceLanguage: from, targetLanguage: to }));
    } catch (e) { return null }
  }
  async function ctr(text, from, to) {
    const k = text + '|' + to; if (CT.has(k)) return CT.get(k);
    let t = await translator(from, to);
    if (!t && to === 'ckb') { t = await translator(from, 'fa') }
    if (!t) return null;
    try { const r = await t.translate(text); CT.set(k, r); return r } catch (e) { return null }
  }

  /* ---------- helpers ---------- */
  function filtered() {
    let a = cur();
    if (st.f === 'watch') { let WL = []; try { WL = JSON.parse(localStorage.getItem('ek_watch') || '[]') } catch (e) { } a = a.filter(i => (i.coins || []).some(c => WL.includes(c))) }
    else if (st.f.startsWith('sec:')) a = a.filter(i => i.sec === st.f.slice(4));
    else if (st.f.startsWith('cat:')) a = a.filter(i => i.category === st.f.slice(4));
    if (st.src) a = a.filter(i => srcList(i).some(s => s.source === st.src));
    if (st.q) { const q = st.q.toLowerCase(); a = a.filter(i => (i.title + ' ' + (i.tfa || '') + ' ' + (i.tckb || '') + ' ' + (i.coins || []).join(' ')).toLowerCase().includes(q)) }
    return a;
  }
  const findItem = id => { const l = lists(); for (const k of ['fa', 'en', 'w']) { const i = l[k].find(x => x.id === id); if (i) return [i, k] } return [null, null] };
  function chips() {
    const a = cur(), cnt = f => a.filter(f).length, out = [['all', L('all'), a.length]];
    if (isFaTab()) {
      ['coinkurd', 'crypto', 'economy'].forEach(s => { const n = cnt(i => i.sec === s); if (n) out.push(['sec:' + s, L('sec_' + s), n, 'nw-sec_' + s]) });
      ['f_gold', 'f_fx', 'f_stock', 'f_oil'].forEach(c => { const n = cnt(i => i.category === c); if (n) out.push(['cat:' + c, L(c), n, 'nw-' + c]) });
    } else {
      const cats = st.tab === 'en' ? ['security', 'regulation', 'etf_institutional', 'onchain', 'technical', 'news'] : ['w_rates', 'w_stocks', 'w_commod', 'w_fx', 'w_trade', 'w_macro'];
      cats.forEach(c => { const n = cnt(i => i.category === c); if (n) out.push(['cat:' + c, L(c), n, 'nw-' + c]) });
    }
    let WL = []; try { WL = JSON.parse(localStorage.getItem('ek_watch') || '[]') } catch (e) { }
    if (WL.length) { const n = cnt(i => (i.coins || []).some(c => WL.includes(c))); if (n) out.push(['watch', L('watch'), n, 'ui-star']) }
    return out.map(([k, t, n, ic]) => `<button class="nw-chip${st.f === k ? ' on' : ''}" data-nwf="${esc(k)}">${ic ? IC(ic) : ''}${esc(t)} <small>${fmtN(n)}</small></button>`).join('');
  }
  function thumb(it, cls, noTitle) {
    // no picture: a title card (topic icon, the headline itself, the publisher) instead of a lone emoji
    const h = H(it.source), t = shownTitle(it);
    const ph = `<div class="nw-ph${noTitle ? ' nw-ph-src' : ''}" style="--h:${h}">${IC(icOf(it), 'nw-phi')}${noTitle ? '' : `<b class="nw-pt" dir="${dirOf(t)}">${esc(t)}</b>`}<small>${esc(it.source)}</small></div>`;
    if (!it.img) return `<div class="${cls}">${ph}</div>`;
    return `<div class="${cls}">${ph}<img class="nw-im" src="${esc(su(it.img))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`;
  }
  function meta(it) {
    const s = srcList(it), h = H(it.source);
    return `<span class="nw-src" style="--h:${h}">${esc(it.source)}</span>${s.length > 1 ? `<span class="nw-multi" title="${esc(s.map(x => x.source).join('، '))}">+${fmtN(s.length - 1)} ${L('srcN')}</span>` : ''}<span class="nw-ago">${ago(it.date)}</span>`;
  }
  function titleHTML(it) {
    const t = trTitle(it);
    const need = !t && wantTr(it) && hasTR();
    return `<span class="nw-tt" dir="${dirOf(t || it.title)}"${need ? ` data-ctr="${esc(it.id)}"` : ''}>${esc(t || it.title)}</span>${t ? `<span class="nw-ot" dir="${dirOf(it.title)}">${esc(it.title)}</span>` : ''}`;
  }
  function card(it, read) {
    const tc = !it.img && !(wantTr(it) && !trTitle(it));     // the cover carries the headline, so the body does not repeat it
    return `<button class="nw-card${read ? ' rd' : ''}${it.own ? ' own' : ''}${tc ? ' tcard' : ''}" data-nwo="${esc(it.id)}">${thumb(it, 'nw-th')}<div class="nw-cb"><div class="nw-meta">${meta(it)}</div><div class="nw-t">${titleHTML(it)}</div>${(it.coins || []).length ? `<div class="nw-coins">${it.coins.slice(0, 4).map(c => `<span class="coin">${esc(c)}</span>`).join('')}</div>` : ''}</div></button>`;
  }
  function hero(it, read) {
    return `<button class="nw-hero${read ? ' rd' : ''}" data-nwo="${esc(it.id)}">${thumb(it, 'nw-hth', true)}<div class="nw-hb"><div class="nw-meta">${it.own ? `<span class="nw-own">${IC('ui-star')}${L('own')}</span>` : ''}${meta(it)}</div><div class="nw-ht">${titleHTML(it)}</div><span class="nw-cta">${L('read')} ${AR()[1]}</span></div></button>`;
  }
  function ticker() {
    const l = lists(), all = [...l.fa.slice(0, 6).map(i => [i, 'nw-tab-fa']), ...l.en.slice(0, 5).map(i => [i, 'nw-tab-en']), ...l.w.slice(0, 3).map(i => [i, 'nw-tab-w'])]
      .sort((a, b) => a[0].date < b[0].date ? 1 : -1).slice(0, 12);
    if (!all.length) return '';
    const row = all.map(([i, e]) => `<button data-nwo="${esc(i.id)}">${IC(e)}${esc(shownTitle(i))} <small>· ${esc(i.source)}</small></button>`).join('<i>◆</i>');
    return `<div class="nw-tick"><span class="nw-tl"><span class="nw-dot"></span>${L('breaking')}</span><div class="nw-tw"><div class="nw-tr">${row}<i>◆</i>${row}</div></div></div>`;
  }

  /* ---------- main box ---------- */
  function shell() {
    const n = X.news, l = lists();
    const feeds = Object.assign({}, n.feeds || {}, (n.regional || {}).feeds || {}, (n.world || {}).feeds || {});
    const ok = Object.values(feeds).filter(f => f.ok).length;
    const srcs = [...new Set(cur().flatMap(i => srcList(i).map(s => s.source)))].sort();
    const tab = (k, ic, lab, c) => `<button class="${st.tab === k ? 'on' : ''}" data-nwt="${k}">${IC(ic)}${lab} <small>${fmtN(c)}</small></button>`;
    return `<h3>${T('newsT')}</h3>
      <div class="nw-top"><span class="nw-live"><span class="nw-dot"></span>${L('live')}</span><span>${fmtN(ok)} ${L('srcOn')}</span><span>· ${L('upd')} ${ago(n.updated_at)}</span></div>
      ${ticker()}
      <div class="nw-tabs" role="tablist">${tab('fa', 'nw-tab-fa', L('tFa'), l.fa.length)}${tab('en', 'nw-tab-en', L('tEn'), l.en.length)}${l.w.length ? tab('w', 'nw-tab-w', L('tW'), l.w.length) : ''}</div>
      <div class="nw-bar"><input id="nwQ" type="search" placeholder="${esc(L('q'))}" value="${esc(st.q)}" autocomplete="off">
        <select id="nwS" aria-label="${esc(L('allSrc'))}"><option value="">${esc(L('allSrc'))} (${fmtN(srcs.length)})</option>${srcs.map(s => `<option${s === st.src ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
        ${(st.tab !== 'fa' ? lang !== 'en' : lang !== 'fa') ? '' : '<!--'}<button id="nwTr" class="nw-trb${st.tr ? ' on' : ''}" type="button" aria-pressed="${st.tr}">🌐 ${L('tr')}: <b>${st.tr ? L('trOn') : L('trOff')}</b></button>${(st.tab !== 'fa' ? lang !== 'en' : lang !== 'fa') ? '' : '-->'}</div>
      <div class="nw-chips" id="nwC">${chips()}</div>
      <div id="nwL"></div>`;
  }
  function list() {
    const box = document.getElementById('nwL'); if (!box) return;
    const a = filtered(), RDS = RD.get();
    if (!a.length) { box.innerHTML = `<p class="disc" style="padding:24px 0;text-align:center">${L('none')}</p>`; return }
    const hi = a.slice(0, 4).findIndex(i => i.img), h = a[hi < 0 ? 0 : hi], rest = a.filter(i => i !== h).slice(0, st.n - 1);
    box.innerHTML = hero(h, RDS.has(h.url)) + `<div class="nw-grid">${rest.map(i => card(i, RDS.has(i.url))).join('')}</div>` +
      (a.length > st.n ? `<button class="nw-more" id="nwM">${L('more')} <small>(${fmtN(a.length - st.n)})</small></button>` : '') +
      `<p class="disc nw-foot">${L('note')}</p>`;
    clientTitles(box);
  }
  async function clientTitles(root) {
    const els = [...root.querySelectorAll('[data-ctr]')].slice(0, 30);
    for (const el of els) {
      const [it] = findItem(el.dataset.ctr); if (!it) continue;
      const r = await ctr(it.title, it._fa ? 'fa' : 'en', tgt(it));
      if (r && el.isConnected) { el.textContent = r; el.dir = dirOf(r); el.removeAttribute('data-ctr'); if (!el.nextElementSibling) el.insertAdjacentHTML('afterend', `<span class="nw-ot" dir="${dirOf(it.title)}">${esc(it.title)}</span>`) }
    }
  }
  function mount() {
    const box = document.getElementById('newsBox'); if (!box) return;
    injectCSS();
    if (!X.news || !X.news.items) { box.innerHTML = `<h3>${T('newsT')}</h3><p class="disc">${T('noData')}</p>`; return }
    const L3 = lists(); L3.fa.forEach(i => i._fa = 1);
    [L3.fa, L3.en, L3.w].forEach(a => a.forEach(i => { if (!i.id) { let h = 5381; for (const c of i.url) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; i.id = 'u' + h.toString(36) } }));
    if (!lists()[st.tab] || !lists()[st.tab].length) st.tab = lists().fa.length ? 'fa' : 'en';
    box.classList.add('nw-box');
    const sig = lang + '|' + X.news.updated_at + '|' + st.tab + '|' + st.tr;
    if (st.mounted === sig && box.querySelector('#nwL')) { return }
    const foc = document.activeElement && document.activeElement.id === 'nwQ';
    box.innerHTML = shell(); st.mounted = sig; list();
    if (foc) { const q = box.querySelector('#nwQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length) }
    clientTitles(box.querySelector('.nw-tick') || box);
    if (!mount.deep) { mount.deep = 1; const m = location.hash.match(/^#news=([\w-]+)/); if (m) setTimeout(() => open(m[1], true), 50) }
  }
  const remount = () => { st.mounted = ''; mount() };

  /* ---------- reader (in-site) ---------- */
  function ensureOv() {
    let ov = document.getElementById('nwOv'); if (ov) return ov;
    document.body.insertAdjacentHTML('beforeend', `<div class="nw-ov" id="nwOv" hidden><div class="nw-bk" data-nwx></div><article class="nw-rd" role="dialog" aria-modal="true" tabindex="-1"></article></div>`);
    return document.getElementById('nwOv');
  }
  async function open(id, fromHash) {
    const [it, k] = findItem(id); if (!it) return;
    const ov = ensureOv(), rd = ov.querySelector('.nw-rd');
    const wasOpen = !ov.hidden; st.open = id; ov.hidden = false; document.documentElement.classList.add('nw-lock');
    if (!fromHash) { const u = location.pathname + location.search + '#news=' + id; wasOpen ? history.replaceState({ nw: id }, '', u) : history.pushState({ nw: id }, '', u) }
    markRead(it.url);
    const seq = list.seq = (list.seq || 0) + 1;
    rd.innerHTML = readerHTML(it, k, null); rd.scrollTop = 0; rd.focus({ preventScroll: true });
    const b = await body(); if (seq !== list.seq) return;
    rd.innerHTML = readerHTML(it, k, b[it.id] || {});
    const need = rd.querySelectorAll('[data-ctrx]');
    for (const el of need) { const r = await ctr(el.dataset.src === 't' ? it.title : ((b[it.id] || {}).s || ''), it._fa ? 'fa' : 'en', tgt(it)); if (seq !== list.seq) return; if (r) { el.textContent = r; el.dir = dirOf(r); const lb = rd.querySelector('.nw-eng'); if (lb) lb.textContent = '🌐 ' + L('autoTr') } }
    const li = document.querySelector(`#newsBox [data-nwo="${CSS.escape(id)}"]`); if (li) li.classList.add('rd');
  }
  function readerHTML(it, k, b) {
    const lst = k === 'fa' ? lists().fa : k === 'w' ? lists().w : lists().en;
    const arr = st.tab === k ? filtered() : lst, ix = arr.indexOf(it), prv = arr[ix - 1], nxt = arr[ix + 1];
    const tr = wantTr(it) && !st.orig;
    const tT = tr ? trTitle(it) : null;
    const sOrig = b ? (b.s || '') : null;
    const sTr = b && tr ? (lang === 'en' ? b.en : (b[lang] || (!it._fa && b.fa))) : null;
    const showS = tr && sTr ? sTr : sOrig;
    const canClient = tr && !sTr && hasTR() && sOrig;
    const rel = lst.filter(x => x !== it && ((it.coins || []).length ? (x.coins || []).some(c => it.coins.includes(c)) : x.category === it.category)).slice(0, 6);
    const paras = s => s.split(/\n+/).filter(x => x.trim()).map(p => `<p>${esc(p)}</p>`).join('');
    const engine = tr && (tT || sTr) ? `<span class="nw-eng">🤖 ${L('aiTr')}</span>` : '';
    return `<header class="nw-rh"><button class="nw-x" data-nwx aria-label="${esc(L('close'))}">✕</button><div class="nw-rnav">
        <button ${prv ? `data-nwo="${esc(prv.id)}"` : 'disabled'} aria-label="${esc(L('prev'))}">${AR()[0]} ${L('prev')}</button><button ${nxt ? `data-nwo="${esc(nxt.id)}"` : 'disabled'} aria-label="${esc(L('next'))}">${L('next')} ${AR()[1]}</button></div></header>
      ${it.img ? `<div class="nw-rim">${thumb(it, 'nw-rth')}</div>` : ''}
      <div class="nw-rc">
        <div class="nw-meta">${it.own ? `<span class="nw-own">${IC('ui-star')}${L('own')}</span>` : ''}${meta(it)}${ICON[it.category] ? `<span class="nw-cat">${IC('nw-' + it.category)}${L(it.category)}</span>` : ''}</div>
        <h2 class="nw-rt" dir="${dirOf(tT || it.title)}"${tr && !tT && hasTR() ? ' data-ctrx data-src="t"' : ''}>${esc(tT || it.title)}</h2>
        ${tT ? `<p class="nw-rot" dir="${dirOf(it.title)}">${esc(it.title)}</p>` : ''}
        ${wantTr(it) ? `<div class="nw-rtg"><button class="${!st.orig ? 'on' : ''}" data-nwor="0">🌐 ${L('trd')}</button><button class="${st.orig ? 'on' : ''}" data-nwor="1">${L('orig')}</button>${engine}</div>` : ''}
        <div class="nw-rs" dir="${dirOf(showS || it.title)}">${b === null ? `<div class="nw-skel"></div><div class="nw-skel"></div><div class="nw-skel s"></div>` :
          showS ? `<div${canClient ? ' data-ctrx data-src="s"' : ''}>${paras(showS)}</div>` : `<p class="disc">${L('noSum')}</p>`}
          ${b && tr && sOrig && !sTr && !hasTR() && lang !== 'en' ? `<p class="disc">⏳ ${L('trWait')}</p>` : ''}</div>
        ${(it.coins || []).length ? `<div class="nw-rcoins"><small>${L('coins')}:</small> ${it.coins.map(c => `<a class="coin" href="coins/${esc(c.toLowerCase())}/">${esc(c)}</a>`).join(' ')}</div>` : ''}
        <div class="nw-ract"><button data-nwsh="${esc(it.id)}">🔗 ${L('share')}</button>${'speechSynthesis' in window ? `<button data-nwsp>🔊 ${L('listen')}</button>` : ''}</div>
        <div class="nw-rsrc"><small>${L('srcs')}:</small> ${srcList(it).map(s => `<span class="nw-src" style="--h:${H(s.source)}">${esc(s.source)}</span>`).join(' ')}
          ${it.own ? '' : `<a class="nw-att" href="${esc(su(it.url))}" target="_blank" rel="noopener nofollow">${L('attrib')} ↗</a>`}</div>
        ${rel.length ? `<h4 class="nw-relh">${L('related')}</h4><div class="nw-rel">${rel.map(x => `<button data-nwo="${esc(x.id)}">${thumb(x, 'nw-relth')}<span><b dir="${dirOf(shownTitle(x))}">${esc(shownTitle(x))}</b><small>${esc(x.source)} · ${ago(x.date)}</small></span></button>`).join('')}</div>` : ''}
      </div>`;
  }
  function close(fromPop) {
    const ov = document.getElementById('nwOv'); if (!ov || ov.hidden) return;
    ov.hidden = true; st.open = null; document.documentElement.classList.remove('nw-lock');
    try { speechSynthesis.cancel() } catch (e) { }
    if (!fromPop && /^#news=/.test(location.hash)) history.back();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const t = e.target;
    const o = t.closest('[data-nwo]'); if (o) { e.preventDefault(); open(o.dataset.nwo); return }
    if (t.closest('[data-nwx]')) { close(); return }
    const tb = t.closest('[data-nwt]'); if (tb) { st.tab = tb.dataset.nwt; st.f = 'all'; st.src = ''; st.n = 13; LS.set('tab', st.tab); remount(); return }
    const f = t.closest('[data-nwf]'); if (f) { st.f = f.dataset.nwf; st.n = 13; document.getElementById('nwC').innerHTML = chips(); list(); return }
    if (t.closest('#nwM')) { st.n += 12; list(); return }
    if (t.closest('#nwTr')) { st.tr = !st.tr; LS.set('tr', st.tr); if (st.tr) translator('en', 'fa'); remount(); return }
    const or = t.closest('[data-nwor]'); if (or) { st.orig = or.dataset.nwor === '1'; if (st.open) open(st.open, true); return }
    const sh = t.closest('[data-nwsh]'); if (sh) {
      const [it] = findItem(sh.dataset.nwsh), url = location.origin + '/#news=' + sh.dataset.nwsh;
      if (navigator.share) navigator.share({ title: it ? shownTitle(it) : 'entekhab.net', url }).catch(() => { });
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => { sh.textContent = '✅ ' + L('copied') }).catch(() => { });
      return;
    }
    if (t.closest('[data-nwsp]')) {
      const ss = window.speechSynthesis; if (ss.speaking) { ss.cancel(); return }
      const rd = document.querySelector('.nw-rd'), txt = [rd.querySelector('.nw-rt'), rd.querySelector('.nw-rs')].map(x => x ? x.textContent : '').join('. ');
      const code = dirOf(txt) === 'rtl' ? (lang === 'ckb' ? 'ckb' : 'fa') : 'en', v = ss.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(code)) || (code === 'ckb' ? ss.getVoices().find(x => /^fa/i.test(x.lang || '')) : null);
      if (!v) { alert(T('noVoice')); return } const u = new SpeechSynthesisUtterance(txt); u.voice = v; u.lang = v.lang; ss.speak(u);
    }
  });
  document.addEventListener('input', e => { if (e.target.id === 'nwQ') { st.q = e.target.value.trim(); st.n = 13; list() } });
  document.addEventListener('change', e => { if (e.target.id === 'nwS') { st.src = e.target.value; st.n = 13; list() } });
  document.addEventListener('error', e => { const im = e.target; if (im && im.classList && im.classList.contains('nw-im')) im.remove() }, true);
  document.addEventListener('keydown', e => {
    const ov = document.getElementById('nwOv'); if (!ov || ov.hidden) return;
    if (e.key === 'Escape') close();
    const rtl = document.documentElement.dir !== 'ltr' && T('dir') !== 'ltr';
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const nxt = (e.key === 'ArrowLeft') === rtl; const b = ov.querySelectorAll('.nw-rnav button')[nxt ? 1 : 0]; if (b && b.dataset.nwo) open(b.dataset.nwo) }
  });
  window.addEventListener('popstate', () => { const m = location.hash.match(/^#news=([\w-]+)/); if (m) open(m[1], true); else close(true) });

  /* ---------- styles ---------- */
  function injectCSS() {
    if (document.getElementById('nwCSS')) return;
    const css = `
.nw-box{position:relative}
.nw-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:.75rem;color:var(--mute);margin:-6px 0 10px}
.nw-live{display:inline-flex;align-items:center;gap:6px;color:#22c55e;font-weight:800}
.nw-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.7);animation:nwP 1.8s infinite;display:inline-block}
@keyframes nwP{70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.nw-tick{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(90deg,rgba(247,147,26,.10),rgba(255,255,255,.02));padding:6px 10px;margin:0 0 12px;overflow:hidden}
.nw-tl{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:.75rem;color:var(--lime);white-space:nowrap}
.nw-tw{overflow:hidden;flex:1;mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.nw-tr{display:inline-flex;gap:14px;white-space:nowrap;animation:nwM 70s linear infinite;align-items:center}
[dir=rtl] .nw-tr{animation-name:nwMr}
.nw-tick:hover .nw-tr{animation-play-state:paused}
.nw-tr button{background:none;border:0;color:var(--ink);font:inherit;font-size:.8rem;cursor:pointer;padding:2px 0}
.nw-tr button:hover{color:var(--lime)}.nw-tr small{color:var(--mute)}.nw-tr i{color:var(--lime);font-style:normal;font-size:.55rem;opacity:.7}
@keyframes nwM{to{transform:translateX(-50%)}}@keyframes nwMr{to{transform:translateX(50%)}}
@media (prefers-reduced-motion:reduce){.nw-tr{animation:none}.nw-dot{animation:none}}
.nw-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
.nw-tabs button{flex:1 1 auto;padding:9px 14px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--mute);font:inherit;font-size:.86rem;font-weight:700;cursor:pointer;transition:.2s}
.nw-tabs button small{opacity:.7;font-weight:500;margin-inline-start:4px}
.nw-tabs button.on{background:var(--lime);border-color:var(--lime);color:#000}
.nw-tabs button:not(.on):hover{border-color:var(--lime);color:var(--ink)}
.nw-bar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}
.nw-bar input,.nw-bar select{flex:1 1 160px;min-width:0;background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--ink);border-radius:10px;padding:8px 12px;font:inherit;font-size:.82rem}
.nw-bar select{flex:0 1 190px}.nw-bar select option{background:#141414}
.nw-trb{border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--mute);border-radius:10px;padding:8px 12px;font:inherit;font-size:.8rem;cursor:pointer;white-space:nowrap}
.nw-trb.on{border-color:#38bdf8;color:#e0f2fe;background:rgba(56,189,248,.12)}
.nw-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin:0 0 12px;scrollbar-width:thin}
.nw-chip{flex:0 0 auto;font:inherit;font-size:.76rem;padding:5px 12px;border-radius:99px;border:1px solid var(--line);color:var(--mute);background:none;cursor:pointer}
.nw-chip small{opacity:.65}.nw-chip.on{border-color:var(--lime);color:var(--ink);background:rgba(247,147,26,.14)}
.nw-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:0;width:100%;text-align:start;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#171717;color:var(--ink);cursor:pointer;padding:0;font:inherit;margin:0 0 12px;transition:.25s}
.nw-hero:hover{border-color:var(--lime);transform:translateY(-2px);box-shadow:0 14px 40px -18px rgba(247,147,26,.45)}
.nw-hth{position:relative;min-height:210px;overflow:hidden}
.nw-hb{padding:16px 18px;display:flex;flex-direction:column;gap:10px;justify-content:center}
.nw-ht .nw-tt{font-size:1.12rem;font-weight:800;line-height:1.65;display:block}
.nw-cta{color:var(--lime);font-weight:800;font-size:.8rem}
[dir=ltr] .nw-cta{direction:ltr}
.nw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.nw-card{display:flex;flex-direction:column;text-align:start;padding:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#161616;color:var(--ink);cursor:pointer;font:inherit;transition:.2s;min-width:0}
.nw-card:hover{border-color:rgba(247,147,26,.7);transform:translateY(-2px)}
.nw-card.own{border-color:rgba(247,147,26,.35)}
.nw-th{position:relative;aspect-ratio:16/9;overflow:hidden;background:#1d1d1d}
.nw-th img,.nw-hth img,.nw-rth img,.nw-relth img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .5s}
.nw-card:hover .nw-th img,.nw-hero:hover .nw-hth img{transform:scale(1.05)}
.nw-ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;gap:6px;padding:12px 14px;overflow:hidden;color:#fff;
background:radial-gradient(130% 110% at 85% 0%,hsla(var(--h),75%,48%,.55),transparent 60%),linear-gradient(160deg,hsla(var(--h),45%,22%,1),hsla(calc(var(--h) + 30),40%,9%,1))}
.nw-ph::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 2px,transparent 2px 9px);pointer-events:none}
.nw-ph .nw-phi{position:absolute;top:10px;inset-inline-end:10px;width:30px;height:30px;margin:0;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45))}
.nw-pt{position:relative;font-size:.95rem;font-weight:800;line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 2px 12px rgba(0,0,0,.5);width:100%;text-align:start}
.nw-ph small{position:relative;font-size:.7rem;opacity:.75;font-weight:600;letter-spacing:.02em}
.nw-card.tcard .nw-t{display:none}.nw-ph-src{justify-content:center;align-items:center;text-align:center}.nw-ph-src .nw-phi{position:relative;top:auto;inset-inline-end:auto;width:64px;height:64px}.nw-ph-src small{font-size:.9rem;opacity:.9}
.nw-ic{width:1.25em;height:1.25em;vertical-align:-.3em;margin-inline-end:.35em;display:inline-block}
.nw-cb{padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px;flex:1}
.nw-t .nw-tt{font-size:.86rem;font-weight:700;line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nw-ot{display:block;font-size:.7rem;color:var(--mute);margin-top:3px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.nw-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.7rem;color:var(--mute)}
.nw-src{padding:1px 8px;border-radius:99px;font-weight:700;color:hsl(var(--h),85%,72%);background:hsla(var(--h),70%,50%,.14);border:1px solid hsla(var(--h),70%,50%,.3)}
.nw-multi{color:#fbbf24;font-weight:700}.nw-own{color:#000;background:var(--lime);border-radius:99px;padding:1px 8px;font-weight:800}
.nw-cat{opacity:.85}
.nw-coins{display:flex;gap:4px;flex-wrap:wrap;margin-top:auto}
.nw-card.rd,.nw-hero.rd{opacity:.62}
.nw-more{display:block;margin:14px auto 4px;padding:10px 22px;border-radius:99px;border:1px solid var(--lime);color:var(--lime);background:none;font:inherit;font-weight:800;cursor:pointer}
.nw-more:hover{background:var(--lime);color:#000}
.nw-foot{margin-top:10px;font-size:.7rem}
html.nw-lock,html.nw-lock body{overflow:hidden}
.nw-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}
.nw-ov[hidden]{display:none}
.nw-bk{position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:nwF .2s}
.nw-rd{position:relative;width:min(780px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#111;border:1px solid var(--line);border-radius:20px;color:var(--ink);box-shadow:0 30px 80px -20px rgba(0,0,0,.8);animation:nwU .28s cubic-bezier(.2,.8,.2,1);outline:none;overscroll-behavior:contain}
@keyframes nwF{from{opacity:0}}@keyframes nwU{from{opacity:0;transform:translateY(24px) scale(.98)}}
.nw-rh{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;background:rgba(17,17,17,.88);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.nw-x{width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--ink);font-size:1rem;cursor:pointer}
.nw-rnav{display:flex;gap:6px}.nw-rnav button{border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--ink);border-radius:99px;padding:6px 12px;font:inherit;font-size:.76rem;cursor:pointer}
.nw-rnav button:disabled{opacity:.3;cursor:default}
.nw-rim{position:relative}.nw-rth{position:relative;aspect-ratio:2/1;overflow:hidden;background:#1a1a1a}
.nw-rc{padding:16px 20px 22px}
.nw-rt{font-size:1.35rem;line-height:1.7;font-weight:900;margin:10px 0 4px}
.nw-rot{color:var(--mute);font-size:.8rem;margin:0 0 8px;line-height:1.5}
.nw-rtg{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:8px 0 12px}
.nw-rtg button{font:inherit;font-size:.74rem;padding:4px 12px;border-radius:99px;border:1px solid var(--line);background:none;color:var(--mute);cursor:pointer}
.nw-rtg button.on{border-color:#38bdf8;color:#e0f2fe;background:rgba(56,189,248,.12)}
.nw-eng{font-size:.68rem;color:var(--mute)}
.nw-rs{font-size:.98rem;line-height:2.05;margin:6px 0 14px}.nw-rs p{margin:0 0 10px}
.nw-skel{height:14px;border-radius:6px;margin:10px 0;background:linear-gradient(90deg,#1c1c1c,#2a2a2a,#1c1c1c);background-size:200% 100%;animation:nwS 1.2s infinite}.nw-skel.s{width:60%}
@keyframes nwS{to{background-position:-200% 0}}
.nw-rcoins{margin:0 0 12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.nw-ract{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
.nw-ract button{font:inherit;font-size:.8rem;padding:7px 14px;border-radius:99px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--ink);cursor:pointer}
.nw-ract button:hover{border-color:var(--lime)}
.nw-rsrc{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:.74rem;color:var(--mute);border-top:1px solid var(--line);padding-top:12px}
.nw-att{margin-inline-start:auto;font-size:.7rem;color:var(--mute);text-decoration:underline dotted}
.nw-relh{margin:18px 0 8px;font-size:.92rem}
.nw-rel{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
.nw-rel button{display:flex;gap:10px;align-items:center;text-align:start;padding:6px;border:1px solid var(--line);border-radius:12px;background:#161616;color:var(--ink);font:inherit;cursor:pointer;min-width:0}
.nw-rel button:hover{border-color:var(--lime)}
.nw-relth{position:relative;flex:0 0 72px;height:52px;border-radius:8px;overflow:hidden}.nw-relth .nw-ph{padding:6px}.nw-relth .nw-pt,.nw-relth .nw-ph small{display:none}.nw-relth .nw-phi{inset:0;margin:auto;width:24px;height:24px}
.nw-rel span{display:flex;flex-direction:column;min-width:0}.nw-rel b{font-size:.76rem;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.nw-rel small{font-size:.66rem;color:var(--mute)}
@media(max-width:700px){.nw-hero{grid-template-columns:1fr}.nw-hth{min-height:0;aspect-ratio:16/9}.nw-grid{grid-template-columns:1fr 1fr}.nw-t .nw-tt{font-size:.8rem}
 .nw-ov{padding:0;align-items:flex-end}.nw-rd{max-height:94vh;border-radius:18px 18px 0 0}.nw-rt{font-size:1.15rem}.nw-rc{padding:14px 16px 26px}.nw-bar select{flex:1 1 140px}}
@media(max-width:420px){.nw-grid{grid-template-columns:1fr}.nw-card{flex-direction:row}.nw-th{flex:0 0 112px;aspect-ratio:auto;min-height:92px}.nw-th .nw-pt{font-size:.78rem;-webkit-line-clamp:4}.nw-th .nw-ph small{display:none}.nw-th .nw-phi{width:22px;height:22px}}
`;
    const s = document.createElement('style'); s.id = 'nwCSS'; s.textContent = css; document.head.appendChild(s);
  }

  window.EKN = { mount, remount, open, close };
  if (typeof X !== 'undefined' && X.news) remount();
})();
