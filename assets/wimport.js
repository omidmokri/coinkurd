/* entekhab.net — bring a watchlist from the Telegram bot: /?w=BTC,ETH
   Nothing is saved until the visitor presses "save"; then the coins are merged into localStorage['ek_watch'] (max 20). */
(function () {
  'use strict';
  var K = 'ek_watch', MAX = 20;
  function parse(s) {
    var out = [];
    String(s || '').slice(0, 200).split(/[,\-\s]+/).forEach(function (p) {
      p = p.trim().toUpperCase();
      if (/^[A-Z0-9]{2,12}$/.test(p) && out.indexOf(p) < 0) out.push(p);
    });
    return out.slice(0, MAX);
  }
  function get() { try { var a = JSON.parse(localStorage.getItem(K) || '[]'); return Array.isArray(a) ? a : [] } catch (e) { return [] } }
  function merge(cur, add) {
    var a = cur.slice();
    add.forEach(function (x) { if (a.indexOf(x) < 0) a.push(x) });
    return a.slice(0, MAX);
  }
  window.EKW = { parse: parse, merge: merge };
  var q; try { q = new URLSearchParams(location.search).get('w') } catch (e) { q = null }
  if (!q) return;
  var syms = parse(q); if (!syms.length) return;
  var lg = 'fa'; try { lg = localStorage.getItem('ck_lang') || document.documentElement.lang || 'fa' } catch (e) { }
  if (['fa', 'ckb', 'en'].indexOf(lg) < 0) lg = 'fa';
  var T = {
    fa: ['⭐ لیست شما از ربات', 'این ارزها را به لیست مراقبت همین مرورگر اضافه کنم؟', 'ذخیره در این مرورگر', 'نه، ممنون', 'ذخیره شد ✓ — فیلتر «لیست من» در اخبار', 'از قبل در لیست شما بودند'],
    ckb: ['⭐ لیستەکەت لە ڕۆبۆتەوە', 'ئەم دراوانە بۆ لیستی چاودێریی ئەم وێبگەڕە زیاد بکەم؟', 'پاشەکەوت لەم وێبگەڕە', 'نەخێر، سوپاس', 'پاشەکەوت کرا ✓ — فلتەری «لیستی من» لە هەواڵەکان', 'پێشتر لە لیستەکەت بوون'],
    en: ['⭐ Your list from the bot', "Add these coins to this browser's watchlist?", 'Save to this browser', 'No thanks', 'Saved ✓ — see the “My list” filter in the news', 'Already in your list']
  }[lg];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function clean() { try { var u = new URL(location.href); u.searchParams.delete('w'); history.replaceState(null, '', u.pathname + u.search + u.hash) } catch (e) { } }
  var have = get(), fresh = syms.filter(function (x) { return have.indexOf(x) < 0 });
  var st = document.createElement('style');
  st.textContent = '#ekWI{position:fixed;z-index:9999;inset-inline:12px;bottom:12px;max-width:520px;margin-inline:auto;background:var(--card,#161616);border:1px solid var(--acc,#f7931a);border-radius:18px;padding:14px 16px;color:var(--ink,#eee);box-shadow:0 10px 40px rgba(0,0,0,.6);font-size:.92rem}#ekWI b{display:block;margin-bottom:4px}#ekWI .c{direction:ltr;unicode-bidi:isolate;font-family:var(--mono,monospace);color:var(--acc,#f7931a);word-break:break-word;margin:6px 0 10px}#ekWI .r{display:flex;gap:8px;flex-wrap:wrap}#ekWI button{font:inherit;border-radius:99px;padding:7px 16px;cursor:pointer;border:1px solid var(--line,#333);background:none;color:inherit}#ekWI button.s{background:var(--acc,#f7931a);border-color:var(--acc,#f7931a);color:#111;font-weight:700}';
  document.head.appendChild(st);
  var box = document.createElement('div'); box.id = 'ekWI'; box.setAttribute('role', 'dialog'); box.dir = lg === 'en' ? 'ltr' : 'rtl';
  if (!fresh.length) {
    box.innerHTML = '<b>' + esc(T[0]) + '</b><div>' + esc(T[5]) + '</div><div class="c">' + esc(syms.join(' · ')) + '</div><div class="r"><button class="x">' + '✕' + '</button></div>';
  } else {
    box.innerHTML = '<b>' + esc(T[0]) + '</b><div>' + esc(T[1]) + '</div><div class="c">' + esc(fresh.join(' · ')) + '</div><div class="r"><button class="s">' + esc(T[2]) + '</button><button class="x">' + esc(T[3]) + '</button></div>';
  }
  function close() { box.remove(); clean() }
  box.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('s')) {
      try { localStorage.setItem(K, JSON.stringify(merge(get(), fresh))) } catch (er) { }
      box.innerHTML = '<b>' + esc(T[4]) + '</b>'; clean();
      setTimeout(function () { try { location.hash = 'newsBox'; location.reload() } catch (er) { box.remove() } }, 1500);
    } else close();
  });
  (document.body ? Promise.resolve() : new Promise(function (r) { document.addEventListener('DOMContentLoaded', r) })).then(function () { document.body.appendChild(box) });
})();
