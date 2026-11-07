/* /kids/ — progress, tick boxes, timer, print and in-page links for "Bitcoin for Juniors".
   Nothing leaves the browser: progress is kept in localStorage under "ck_b4j". */
(function () {
  'use strict';
  var KEY = 'ck_b4j', S = { d: {}, c: {} }, DATA = null;
  var DIG = { fa: '۰۱۲۳۴۵۶۷۸۹', ckb: '٠١٢٣٤٥٦٧٨٩' };

  function load() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); S = { d: o.d || {}, c: o.c || {} }; } catch (e) { S = { d: {}, c: {} }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: progress lasts for this visit only */ } }
  function lang() { return (window.EKL && window.EKL()) || 'fa'; }
  function dig(n, l) {
    var s = String(n);
    return DIG[l] ? s.replace(/\d/g, function (c) { return DIG[l].charAt(+c); }) : s;
  }
  function tpl(l, a, b) {
    var i = l === 'fa' ? 0 : l === 'ckb' ? 1 : 2;
    var t = (DATA && DATA.ui && DATA.ui.done_n && DATA.ui.done_n[i]) || '{a}/{b}';
    return t.replace('{a}', dig(a, l)).replace('{b}', dig(b, l));
  }

  function paint() {
    var l = lang(), all = 0, done = 0;
    document.querySelectorAll('.b4j-ac[data-act]').forEach(function (a) { a.classList.toggle('done', !!S.d[a.dataset.act]); });
    document.querySelectorAll('[data-done]').forEach(function (b) { b.setAttribute('aria-pressed', S.d[b.dataset.done] ? 'true' : 'false'); });
    document.querySelectorAll('.b4j-ck').forEach(function (c) {
      var on = !!S.c[c.dataset.k];
      c.checked = on;
      var li = c.closest('li');
      if (li) { li.classList.add('ck'); li.classList.toggle('on', on); }
    });
    if (DATA && DATA.mods) {
      DATA.mods.forEach(function (m) {
        var n = m.acts.length, d = m.acts.filter(function (a) { return S.d[a]; }).length;
        all += n; done += d;
        var card = document.querySelector('.b4j-mod[data-mod="' + m.id + '"]');
        if (card) {
          card.querySelector('.b4j-bar i').style.width = (n ? Math.round(100 * d / n) : 0) + '%';
          card.querySelector('.pc').textContent = d ? tpl(l, d, n) : '';
        }
      });
      var box = document.getElementById('b4jAll');
      if (box) { box.hidden = !done; box.textContent = done ? tpl(l, done, all) : ''; }
    }
  }

  function goHash() {
    var h = decodeURIComponent((location.hash || '').slice(1));
    if (!h) return;
    var el = document.getElementById(lang() + '-' + h) || document.getElementById(h);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }

  /* ---- timer */
  var T = { sel: 300, left: 300, end: 0, run: false, h: 0, ctx: null };
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function show() {
    var box = document.getElementById('b4jTimer');
    if (!box) return;
    var s = Math.max(0, Math.round(T.left));
    box.querySelector('.tm').textContent = two(Math.floor(s / 60)) + ':' + two(s % 60);
  }
  function beep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) {
        var a = T.ctx || (T.ctx = new C());
        [0, 0.3, 0.6].forEach(function (d) {
          var o = a.createOscillator(), g = a.createGain();
          o.frequency.value = 880; g.gain.value = 0.18;
          o.connect(g); g.connect(a.destination);
          o.start(a.currentTime + d); o.stop(a.currentTime + d + 0.2);
        });
      }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch (e) { /* no sound is fine */ }
  }
  function stop() { T.run = false; clearInterval(T.h); }
  function tick() {
    var box = document.getElementById('b4jTimer');
    T.left = (T.end - Date.now()) / 1000;
    if (T.left <= 0) {
      T.left = 0; stop(); show();
      if (box) { box.classList.add('end'); box.querySelector('.up').hidden = false; }
      beep();
      return;
    }
    show();
  }
  function timerClick(b) {
    var box = document.getElementById('b4jTimer');
    if (!box) return;
    if (b.dataset.min) {
      stop(); T.sel = T.left = +b.dataset.min * 60;
      box.classList.remove('end'); box.querySelector('.up').hidden = true;
      box.querySelectorAll('.pr button').forEach(function (x) { x.classList.toggle('on', x === b); });
      show();
    } else if (b.dataset.t === 'go') {
      if (T.run) return;
      if (T.left <= 0) T.left = T.sel;
      try { var C = window.AudioContext || window.webkitAudioContext; if (C && !T.ctx) T.ctx = new C(); if (T.ctx && T.ctx.resume) T.ctx.resume(); } catch (e) { /* ignore */ }
      box.classList.remove('end'); box.querySelector('.up').hidden = true;
      T.end = Date.now() + T.left * 1000; T.run = true;
      T.h = setInterval(tick, 250); tick();
    } else if (b.dataset.t === 'pause') {
      if (T.run) { T.left = (T.end - Date.now()) / 1000; stop(); show(); }
    } else if (b.dataset.t === 'reset') {
      stop(); T.left = T.sel; box.classList.remove('end'); box.querySelector('.up').hidden = true; show();
    }
  }

  /* ---- events */
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.classList && t.classList.contains('b4j-ck')) {
      if (t.checked) S.c[t.dataset.k] = 1; else delete S.c[t.dataset.k];
      save(); paint();
    }
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t.closest) return;
    var li = t.closest('li');
    if (li && li.classList.contains('ck') && !t.closest('a') && t.tagName !== 'INPUT') {
      var cb = li.querySelector('.b4j-ck');
      if (cb && cb.closest('li') === li) cb.click();
    }
    var d = t.closest('[data-done]');
    if (d) { var id = d.dataset.done; if (S.d[id]) delete S.d[id]; else S.d[id] = 1; save(); paint(); }
    if (t.closest('[data-print]')) window.print();
    var tt = t.closest('[data-timer-toggle]');
    if (tt) {
      var box = document.getElementById('b4jTimer');
      if (box) { box.hidden = !box.hidden; tt.setAttribute('aria-expanded', String(!box.hidden)); }
    }
    var tb = t.closest('#b4jTimer button');
    if (tb) timerClick(tb);
  });
  window.addEventListener('hashchange', goHash);
  window.addEventListener('ek-lang', function () { paint(); goHash(); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { load(); paint(); } });

  function init() {
    try { var el = document.getElementById('b4jData'); DATA = el ? JSON.parse(el.textContent) : null; } catch (e) { DATA = null; }
    load(); paint(); show();
    var first = document.querySelector('#b4jTimer .pr button[data-min="5"]');
    if (first) first.classList.add('on');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
