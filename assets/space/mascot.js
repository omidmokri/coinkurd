/* entekhab.net · "Nima", the support guide (preview).
   An original hooded guide in a pearl-white visor mask with orange circuit traces, studio headphones and a mic.
   Pure SVG + CSS, no images. It breathes, blinks, follows the pointer and lights its mouth slit while it speaks.
   EKGuide.svg(scale) returns the drawing; EKGuide.widget(opt) mounts the support button and panel. ES5. */
(function (W, D) {
  'use strict';
  /* The guide is Omid's own hooded-mask artwork, cut out of its background, brought to life in layers:
     the bust breathes and turns toward the pointer in 3D, the blue circuits and eyes pulse (a separate light-only
     layer, blended additively, with a soft bloom), a scan line passes over the mask, and the light quickens while
     it speaks. v = 1 or 2 (the two portraits). */
  var BASE = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, '');
  var EYES = { 1: [[38.6, 29.6], [61.2, 29.4]], 2: [[39.2, 29.8], [60.9, 29.6]] };
  function svg(v) {
    v = v === 1 ? 1 : 2;
    var u = BASE + 'guide-' + v + '.webp', g = BASE + 'guide-' + v + '-glow.webp', e = EYES[v];
    return '<div class="ekg-svg ekg-v' + v + '" aria-hidden="true"><div class="ekg-head">' +
      '<div class="ekg-aura"></div>' +
      '<img class="ekg-base" src="' + u + '" alt="" draggable="false" decoding="async">' +
      '<img class="ekg-glow" src="' + g + '" alt="" draggable="false" decoding="async">' +
      '<img class="ekg-glow ekg-bloom" src="' + g + '" alt="" draggable="false" decoding="async">' +
      '<i class="ekg-eye" style="left:' + e[0][0] + '%;top:' + e[0][1] + '%"></i><i class="ekg-eye" style="left:' + e[1][0] + '%;top:' + e[1][1] + '%"></i>' +
      '<div class="ekg-scan" style="-webkit-mask-image:url(' + u + ');mask-image:url(' + u + ')"></div>' +
      '</div></div>';
  }

  // the look: breathing, blink, traces, scan, pointer and speech
  var CSS = '' +
'.ekg-svg{position:relative;width:100%;height:100%;perspective:700px}' +
'.ekg-head{position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 70%;animation:ekg-br 5.4s ease-in-out infinite;transition:rotate .1s}' +
'.ekg-tilt{position:absolute;inset:0;transition:transform .6s cubic-bezier(.2,.8,.2,1)}' +
'.ekg-head img{position:absolute;left:0;top:0;width:100%;height:auto;user-select:none;-webkit-user-drag:none;pointer-events:none}' +
'.ekg-glow{mix-blend-mode:screen;opacity:.75;animation:ekg-gl 3.8s ease-in-out infinite}' +
'.ekg-bloom{filter:blur(7px) brightness(1.8);opacity:.55;animation:ekg-gl 3.8s ease-in-out infinite reverse}' +
'.ekg-aura{position:absolute;left:12%;right:12%;top:6%;height:62%;border-radius:50%;background:radial-gradient(closest-side,rgba(60,130,255,.30),rgba(60,130,255,.08) 60%,transparent);filter:blur(10px);animation:ekg-gl 5.2s ease-in-out infinite}' +
'.ekg-eye{position:absolute;width:9%;aspect-ratio:1.6;margin:-2.6% 0 0 -4.5%;border-radius:50%;background:radial-gradient(closest-side,#fff 0,#bfe0ff 18%,rgba(70,150,255,.75) 42%,transparent);mix-blend-mode:screen;filter:blur(1px);animation:ekg-ey 6.2s ease-in-out infinite}' +
'.ekg-scan{position:absolute;inset:0;-webkit-mask-size:100% auto;mask-size:100% auto;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;pointer-events:none;' +
 'background:linear-gradient(180deg,transparent 0,transparent 44%,rgba(150,205,255,.0) 46%,rgba(170,215,255,.5) 49.4%,rgba(255,255,255,.75) 50%,rgba(150,205,255,.0) 52%,transparent 54%);background-size:100% 260%;background-repeat:no-repeat;mix-blend-mode:screen;animation:ekg-sc 7.5s ease-in-out infinite}' +
'.ekg-talk .ekg-glow{animation:ekg-tk .34s ease-in-out infinite alternate}' +
'.ekg-talk .ekg-eye{animation:ekg-tk .3s ease-in-out infinite alternate}' +
'.ekg-talk .ekg-head{animation:ekg-nod .9s ease-in-out infinite}' +
'@keyframes ekg-br{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-.8%) scale(1.012)}}' +
'@keyframes ekg-nod{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(-.6%) rotate(-.6deg)}70%{transform:translateY(.3%) rotate(.5deg)}}' +
'@keyframes ekg-gl{0%,100%{opacity:.35}50%{opacity:.95}}' +
'@keyframes ekg-ey{0%,44%,52%,100%{opacity:.9;transform:scale(1)}47%{opacity:.15;transform:scale(.6,.2)}49%{opacity:1;transform:scale(1.35)}}' +
'@keyframes ekg-sc{0%,55%{background-position:0 110%;opacity:0}60%{opacity:1}88%{background-position:0 -10%;opacity:1}92%,100%{background-position:0 -10%;opacity:0}}' +
'@keyframes ekg-tk{from{opacity:.45}to{opacity:1}}' +
'@media (prefers-reduced-motion:reduce){.ekg-svg *{animation:none!important;transition:none!important}.ekg-scan{display:none}}' +
// the support widget
'.ekg-fab{position:fixed;inset-inline-end:18px;bottom:18px;z-index:60;width:66px;height:66px;border-radius:50%;border:0;padding:0;cursor:pointer;' +
 'background:radial-gradient(circle at 50% 30%,#1f2229,#050608 70%);box-shadow:0 0 0 1.5px rgba(255,210,122,.6),0 0 0 6px rgba(247,147,26,.1),0 14px 40px rgba(0,0,0,.6),0 0 34px rgba(70,150,255,.35);' +
 'transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s}' +
'.ekg-fab:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 0 0 1px rgba(255,210,122,.8),0 0 0 8px rgba(247,147,26,.12),0 18px 46px rgba(0,0,0,.65),0 0 48px rgba(247,147,26,.4)}' +
'.ekg-fab:focus-visible{outline:2px solid #ffd27a;outline-offset:4px}' +

'.ekg-fab-wrap{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 35%,#13233d,#04060a 72%)}' +
'.ekg-fab .ekg-svg{position:absolute;width:250%;height:auto;aspect-ratio:720/883;left:-75%;top:-34%}' +
'.ekg-ava .ekg-svg{width:150%;height:auto;aspect-ratio:720/883;margin:-8% 0 0 -25%}' +
'.ekg-ava{border-radius:16px;overflow:hidden;background:radial-gradient(circle at 50% 30%,#13233d,#04060a 75%)}' +
'.ekg-dot{position:absolute;top:2px;inset-inline-end:2px;width:13px;height:13px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px #050608,0 0 12px #34d399}' +
'.ekg-hint{position:fixed;inset-inline-end:94px;bottom:30px;z-index:60;max-width:240px;padding:10px 14px;border-radius:14px;font:500 .86rem/1.6 var(--f,system-ui);color:#f4efe6;' +
 'background:linear-gradient(155deg,rgba(255,255,255,.09),rgba(255,255,255,.02)),rgba(8,9,12,.82);border:1px solid rgba(255,255,255,.12);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
 'box-shadow:0 18px 40px rgba(0,0,0,.5);opacity:0;transform:translateY(8px);transition:opacity .4s,transform .4s cubic-bezier(.2,.8,.2,1);pointer-events:none}' +
'.ekg-hint.on{opacity:1;transform:none}' +
'.ekg-panel{position:fixed;inset-inline-end:18px;bottom:96px;z-index:61;width:min(380px,calc(100vw - 24px));max-height:min(620px,calc(100vh - 120px));display:flex;flex-direction:column;border-radius:22px;overflow:hidden;' +
 'background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.015) 40%),rgba(6,7,10,.9);border:1px solid rgba(255,255,255,.12);' +
 '-webkit-backdrop-filter:blur(18px) saturate(1.2);backdrop-filter:blur(18px) saturate(1.2);box-shadow:0 0 0 1px rgba(247,147,26,.12),0 30px 80px rgba(0,0,0,.7);' +
 'opacity:0;transform:translateY(14px) scale(.98);transform-origin:bottom right;pointer-events:none;transition:opacity .35s,transform .45s cubic-bezier(.2,.8,.2,1)}' +
'[dir=rtl] .ekg-panel{transform-origin:bottom left}' +
'.ekg-panel.on{opacity:1;transform:none;pointer-events:auto}' +
'.ekg-top{display:flex;align-items:center;gap:12px;padding:16px 16px 10px;position:relative}' +
'.ekg-top::after{content:"";position:absolute;inset-inline:16px;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(247,147,26,.5),transparent)}' +
'.ekg-ava{flex:0 0 auto;width:62px;height:62px;position:relative}' +
'.ekg-who b{display:block;font:800 1.02rem var(--f,system-ui);color:#fff}' +
'.ekg-who span{display:flex;align-items:center;gap:6px;font:500 .78rem var(--f,system-ui);color:#9aa3ad}' +
'.ekg-who span::before{content:"";width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399}' +
'.ekg-x{margin-inline-start:auto;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#cfd6de;cursor:pointer;font:400 1.1rem/1 system-ui}' +
'.ekg-x:hover{border-color:#f7931a;color:#fff}' +
'.ekg-log{flex:1;overflow:auto;padding:14px 16px 6px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin}' +
'.ekg-m{max-width:88%;padding:10px 13px;border-radius:16px;font:400 .9rem/1.75 var(--f,system-ui);color:#eef1f4;white-space:pre-line}' +
'.ekg-m.b{align-self:flex-start;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-start-start-radius:4px}' +
'.ekg-m.u{align-self:flex-end;background:linear-gradient(135deg,#ffd27a,#f7931a);color:#120a00;font-weight:600;border-start-end-radius:4px}' +
'.ekg-m a{color:#ffd27a}' +
'.ekg-chips{display:flex;flex-wrap:wrap;gap:8px;padding:8px 16px 16px}' +
'.ekg-chip{padding:8px 12px;border-radius:999px;border:1px solid rgba(247,147,26,.4);background:rgba(247,147,26,.07);color:#ffe3b8;font:600 .8rem var(--f,system-ui);cursor:pointer;transition:background .2s,border-color .2s,transform .2s}' +
'.ekg-chip:hover{background:rgba(247,147,26,.18);border-color:#f7931a;transform:translateY(-1px)}' +
'.ekg-chip:focus-visible,.ekg-x:focus-visible{outline:2px solid #ffd27a;outline-offset:2px}' +
'@media (max-width:520px){.ekg-fab{width:58px;height:58px;inset-inline-end:14px;bottom:14px}.ekg-panel{inset-inline-end:12px;bottom:84px}.ekg-hint{display:none}}';

  function css() {
    if (D.getElementById('ekg-css')) return;
    var s = D.createElement('style'); s.id = 'ekg-css'; s.textContent = CSS; D.head.appendChild(s);
  }

  // make one drawing follow the pointer: the face turns, the eyes look
  function follow(root, area) {
    var head = root.querySelector('.ekg-head');
    if (!head || W.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var tilt = D.createElement('div'); tilt.className = 'ekg-tilt';
    head.parentNode.insertBefore(tilt, head); tilt.appendChild(head);
    (area || W).addEventListener('pointermove', function (e) {
      var r = root.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * .35;
      var dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 600)), dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 600));
      tilt.style.transform = 'rotateY(' + (dx * 9).toFixed(2) + 'deg) rotateX(' + (-dy * 6).toFixed(2) + 'deg)';
    }, { passive: true });
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* opt: {lang, t:{name,role,hello,hint,chips:[[label, answer, href?]]}} */
  function widget(opt) {
    css();
    var t = opt.t, fab = D.createElement('button'), hint = D.createElement('div'), p = D.createElement('div');
    fab.className = 'ekg-fab'; fab.type = 'button'; fab.setAttribute('aria-label', t.name + ' · ' + t.role);
    fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'ekg-panel');
    fab.innerHTML = '<span class="ekg-fab-wrap">' + svg(opt.v) + '</span><span class="ekg-dot"></span>';
    hint.className = 'ekg-hint'; hint.textContent = t.hint;
    p.className = 'ekg-panel'; p.id = 'ekg-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', t.name);
    p.innerHTML = '<div class="ekg-top"><div class="ekg-ava">' + svg() + '</div><div class="ekg-who"><b>' + esc(t.name) + '</b><span>' + esc(t.role) + '</span></div>' +
      '<button class="ekg-x" type="button" aria-label="' + esc(t.close) + '">×</button></div><div class="ekg-log" aria-live="polite"></div><div class="ekg-chips"></div>';
    D.body.appendChild(hint); D.body.appendChild(p); D.body.appendChild(fab);
    var log = p.querySelector('.ekg-log'), chips = p.querySelector('.ekg-chips'), ava = p.querySelector('.ekg-ava');
    follow(fab); follow(ava);
    var busy = null;
    function say(text, href, label) {
      var m = D.createElement('div'); m.className = 'ekg-m b'; log.appendChild(m);
      ava.classList.add('ekg-talk'); fab.classList.add('ekg-talk');
      var i = 0, red = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
      clearInterval(busy);
      function done() {
        clearInterval(busy); m.textContent = text;
        if (href) { var a = D.createElement('a'); a.href = href; a.textContent = ' ' + label + ' ←'; if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } m.appendChild(D.createElement('br')); m.appendChild(a); }
        ava.classList.remove('ekg-talk'); fab.classList.remove('ekg-talk'); log.scrollTop = log.scrollHeight;
      }
      if (red) return done();
      busy = setInterval(function () { i += 2; m.textContent = text.slice(0, i); log.scrollTop = log.scrollHeight; if (i >= text.length) done(); }, 22);
    }
    t.chips.forEach(function (c) {
      var b = D.createElement('button'); b.type = 'button'; b.className = 'ekg-chip'; b.textContent = c[0];
      b.addEventListener('click', function () {
        var u = D.createElement('div'); u.className = 'ekg-m u'; u.textContent = c[0]; log.appendChild(u);
        setTimeout(function () { say(c[1], c[2], c[3]); }, 260);
      });
      chips.appendChild(b);
    });
    var first = true;
    function open(on) {
      p.classList.toggle('on', on); fab.setAttribute('aria-expanded', on ? 'true' : 'false'); hint.classList.remove('on');
      if (on && first) { first = false; say(t.hello); }
      if (on) setTimeout(function () { (chips.firstChild || p).focus(); }, 60);
    }
    fab.addEventListener('click', function () { open(!p.classList.contains('on')); });
    p.querySelector('.ekg-x').addEventListener('click', function () { open(false); fab.focus(); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && p.classList.contains('on')) { open(false); fab.focus(); } });
    if (opt.hintAfter !== false) setTimeout(function () { if (!p.classList.contains('on')) { hint.classList.add('on'); setTimeout(function () { hint.classList.remove('on'); }, 6500); } }, opt.hintAfter || 2600);
    return { open: open, say: say, el: p, fab: fab };
  }

  W.EKGuide = { svg: svg, css: css, follow: follow, widget: widget };
})(window, document);
