/* /kids/ — the children's and teenagers' academy.
   One file, no dependencies. The profile and the stars live in localStorage under
   ck_kids and are never sent anywhere. Sound is synthesised with the Web Audio API,
   so the page ships no audio files and borrows no music. */
(function () {
  "use strict";
  var LS = "ck_kids", S = {age: "", av: "", nm: "", stars: 0, done: {}, snd: 1};
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(LS) || "{}")); } catch (e) {}
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }
  function li() { var l = (window.EKL && window.EKL()) || "fa"; return l === "ckb" ? 1 : l === "en" ? 2 : 0; }
  function T(a) { return !a ? "" : (Array.isArray(a) ? (a[li()] || a[0]) : a); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function D(id) { return document.getElementById(id); }
  function J(id) { var e = D(id); try { return e ? JSON.parse(e.textContent) : null; } catch (x) { return null; } }

  /* ---------------------------------------------------------- sound
     one engine for the whole academy: kids-sound.js synthesises everything, so
     there is never a second audio context and the mute switch covers it all */
  var muted = !S.snd;
  function K() { return window.KSND; }
  var SND = {
    tap:  function () { if (K() && !muted) K().sfx("tap"); },
    good: function () { if (K() && !muted) K().sfx("good"); },
    bad:  function () { if (K() && !muted) K().sfx("bad"); },
    win:  function () { if (K() && !muted) K().sfx("win"); }
  };

  /* ---------------------------------------------------------- confetti (skipped if motion is reduced) */
  function cheer() {
    SND.win();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var cv = el("canvas", "kd-conf"), x = cv.getContext("2d"), W, H, P = [], t0 = Date.now();
    document.body.appendChild(cv);
    function size() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
    size();
    var cols = ["#f7931a", "#7c6cff", "#34d399", "#38bdf8", "#fb7185", "#fbbf24"];
    for (var i = 0; i < 110; i++) P.push({x: Math.random() * W, y: -20 - Math.random() * H * .5,
      v: 2 + Math.random() * 3.4, s: 4 + Math.random() * 6, a: Math.random() * 6.28,
      c: cols[i % cols.length], w: (Math.random() - .5) * .18});
    (function f() {
      x.clearRect(0, 0, W, H);
      P.forEach(function (p) {
        p.y += p.v; p.a += p.w; p.x += Math.sin(p.a) * 1.1;
        x.save(); x.translate(p.x, p.y); x.rotate(p.a);
        x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); x.restore();
      });
      if (Date.now() - t0 < 2300) requestAnimationFrame(f); else cv.remove();
    })();
  }

  /* ---------------------------------------------------------- progress */
  function key(w, k) { return w + ":" + k; }
  function mark(w, k, stars) {
    if (S.done[key(w, k)]) return false;
    S.done[key(w, k)] = 1; S.stars += (stars || 1); save(); return true;
  }
  function wdone(w, ids) { var n = 0; ids.forEach(function (i) { if (S.done[key(w, i)]) n++; }); return n; }

  /* ---------------------------------------------------------- the "who you are" bar */
  function meBar() {
    var b = D("kdMe"); if (!b) return;
    var A = J("kdAvs") || [], a = A.filter(function (x) { return x[0] === S.av; })[0] || A[0] || ["fox", "🦊"];
    b.querySelector(".av").textContent = a[1];
    b.querySelector(".who").textContent = S.nm || T(a[2]);
    b.querySelector(".kd-st").textContent = "⭐ " + S.stars;
    var sb = b.querySelector(".kd-snd");
    if (sb) {
      sb.textContent = muted ? "🔇" : "🔊";
      sb.onclick = function () {
        muted = !muted; S.snd = muted ? 0 : 1; save();
        sb.textContent = muted ? "🔇" : "🔊";
        if (K()) K().mute(muted);
        if (!muted) SND.tap();
      };
    }
    document.querySelectorAll(".kd").forEach(function (r) { r.dataset.age = S.age || "kid"; });
  }

  /* ---------------------------------------------------------- onboarding */
  function setup() {
    var box = D("kdSet"); if (!box) return;
    var go = D("kdGo"), nm = D("kdNm");
    function upd() { go.disabled = !(S.age && S.av); }
    box.querySelectorAll(".kd-age").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.a === S.age));
      b.onclick = function () {
        S.age = b.dataset.a; SND.tap();
        box.querySelectorAll(".kd-age").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        document.querySelectorAll(".kd").forEach(function (r) { r.dataset.age = S.age; });
        upd();
      };
    });
    box.querySelectorAll(".kd-av").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === S.av));
      b.onclick = function () {
        S.av = b.dataset.v; SND.tap();
        box.querySelectorAll(".kd-av").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        upd();
      };
    });
    if (nm) nm.value = S.nm || "";
    upd();
    go.onclick = function () {
      S.nm = (nm && nm.value || "").slice(0, 24); save(); cheer();
      setTimeout(function () { location.href = go.dataset.next || "/kids/"; }, 450);
    };
  }

  /* ---------------------------------------------------------- hub */
  function hub() {
    var h = D("kdHub"); if (!h) return;
    if (!S.age || !S.av) { location.replace("/kids/start/"); return; }
    meBar();
    (J("kdWorlds") || []).forEach(function (w) {
      var c = h.querySelector('.kd-w[data-w="' + w.id + '"]'); if (!c) return;
      var n = wdone(w.id, w.items), p = w.items.length ? n / w.items.length : 0;
      c.querySelector(".kd-bar i").style.width = Math.round(p * 100) + "%";
      var s = c.querySelector(".kd-pc"); if (s) s.textContent = n + "/" + w.items.length;
    });
    var bd = D("kdBadges");
    if (bd) bd.querySelectorAll(".kd-badge").forEach(function (b) {
      b.classList.toggle("on", !!S.done[b.dataset.b] || (b.dataset.need && S.stars >= +b.dataset.need));
    });
  }

  /* ---------------------------------------------------------- games */
  function fb(host, good, text) {
    var f = host.querySelector(".kd-fb") || host.appendChild(el("div", "kd-fb"));
    f.className = "kd-fb show " + (good ? "good" : "bad");
    f.innerHTML = "";
    f.appendChild(el("b", "", T(good ? UIs.right : UIs.wrong)));
    if (text) f.appendChild(el("span", "", text));
    (good ? SND.good : SND.bad)();
  }
  var UIs = {};

  function gMatch(host, g, done) {
    host.appendChild(el("p", "how", T(UIs.g_match) + " · " + T(UIs.tap_pair)));
    var wrap = el("div", "kd-mt"), L = el("div", "col"), R = el("div", "col");
    var left = g.pairs.map(function (p, i) { return {i: i, t: p[0]}; });
    var right = g.pairs.map(function (p, i) { return {i: i, t: p[1]}; });
    right.sort(function () { return Math.random() - .5; });
    left.sort(function () { return Math.random() - .5; });
    var pick = null, left_ = 0;
    function tile(o, col) {
      var b = el("button", "kd-tile", T(o.t));
      b.type = "button"; b.setAttribute("aria-pressed", "false");
      b.onclick = function () {
        if (b.classList.contains("ok")) return;
        SND.tap();
        if (!pick) { pick = {b: b, i: o.i, c: col}; b.setAttribute("aria-pressed", "true"); return; }
        if (pick.c === col) { pick.b.setAttribute("aria-pressed", "false"); pick = {b: b, i: o.i, c: col}; b.setAttribute("aria-pressed", "true"); return; }
        pick.b.setAttribute("aria-pressed", "false");
        if (pick.i === o.i) {
          pick.b.classList.add("ok"); b.classList.add("ok"); left_--;
          SND.good();
          if (!left_) { fb(host, true, ""); done(); }
        } else {
          var a = pick.b; a.classList.add("bad"); b.classList.add("bad");
          setTimeout(function () { a.classList.remove("bad"); b.classList.remove("bad"); }, 360);
          SND.bad();
        }
        pick = null;
      };
      return b;
    }
    left_ = g.pairs.length;
    left.forEach(function (o) { L.appendChild(tile(o, "l")); });
    right.forEach(function (o) { R.appendChild(tile(o, "r")); });
    wrap.appendChild(L); wrap.appendChild(R); host.appendChild(wrap);
  }

  function gSort(host, g, done) {
    host.appendChild(el("p", "how", T(UIs.g_sort)));
    var bins = el("div", "kd-bins"), pool = el("div", "kd-pool"), left = g.items.length;
    var boxes = g.bins.map(function (b, bi) {
      var d = el("div", "kd-bin"); d.appendChild(el("b", "", T(b))); d.dataset.b = bi;
      d.addEventListener("dragover", function (e) { e.preventDefault(); d.classList.add("over"); });
      d.addEventListener("dragleave", function () { d.classList.remove("over"); });
      d.addEventListener("drop", function (e) {
        e.preventDefault(); d.classList.remove("over");
        var id = e.dataTransfer.getData("text/plain");
        drop(document.getElementById(id), bi);
      });
      bins.appendChild(d); return d;
    });
    function drop(t, bi) {
      if (!t) return;
      if (+t.dataset.bin === bi) {
        t.classList.add("ok"); t.draggable = false; t.removeAttribute("aria-pressed");
        boxes[bi].appendChild(t); left--;
        SND.good();
        if (!left) { fb(host, true, ""); done(); }
      } else {
        t.classList.add("bad"); setTimeout(function () { t.classList.remove("bad"); }, 360);
        SND.bad();
      }
    }
    var sel = null;
    g.items.forEach(function (it, i) {
      var b = el("button", "kd-tile", T(it[0]));
      b.type = "button"; b.id = "kdit" + i; b.dataset.bin = it[1]; b.draggable = true;
      b.addEventListener("dragstart", function (e) { e.dataTransfer.setData("text/plain", b.id); });
      b.onclick = function () {   /* tapping works too: pick a card, then tap a basket */
        if (b.classList.contains("ok")) return;
        SND.tap();
        if (sel) sel.setAttribute("aria-pressed", "false");
        sel = (sel === b) ? null : b;
        if (sel) b.setAttribute("aria-pressed", "true");
      };
      pool.appendChild(b);
    });
    boxes.forEach(function (d, bi) {
      d.addEventListener("click", function () { if (sel) { var s = sel; sel = null; s.setAttribute("aria-pressed", "false"); drop(s, bi); } });
    });
    host.appendChild(pool); host.appendChild(bins);
  }

  function gMemory(host, g, done) {
    host.appendChild(el("p", "how", T(UIs.g_mem)));
    var cards = [];
    g.pairs.forEach(function (p, i) {
      cards.push({i: i, f: T(p[0]), k: "t"});
      cards.push({i: i, f: p[1], k: "e"});
    });
    cards.sort(function () { return Math.random() - .5; });
    var grid = el("div", "kd-mem"), open = [], lock = 0, left = g.pairs.length, moves = 0;
    var mv = el("p", "how", "");
    cards.forEach(function (c) {
      var b = el("button", "kd-card"); b.type = "button";
      var back = el("span", "back", "❔"), face = el("span", "face", c.f);
      b.appendChild(back); b.appendChild(face);
      b.onclick = function () {
        if (lock || b.classList.contains("up") || b.classList.contains("ok")) return;
        b.classList.add("up"); open.push({b: b, i: c.i}); SND.tap();
        if (open.length === 2) {
          moves++; mv.textContent = moves + " " + T(UIs.moves);
          if (open[0].i === open[1].i && open[0].b !== open[1].b) {
            open.forEach(function (o) { o.b.classList.add("ok"); o.b.classList.remove("up"); });
            open = []; left--; SND.good();
            if (!left) { fb(host, true, ""); done(); }
          } else {
            lock = 1; SND.bad();
            setTimeout(function () { open.forEach(function (o) { o.b.classList.remove("up"); }); open = []; lock = 0; }, 760);
          }
        }
      };
      grid.appendChild(b);
    });
    host.appendChild(grid); host.appendChild(mv);
  }

  function gPath(host, g, done) {
    host.appendChild(el("p", "how", T(UIs.g_path)));
    var box = el("div", "kd-path"), i = 0;
    host.appendChild(box);
    function step() {
      if (i >= g.steps.length) { fb(host, true, ""); done(); return; }
      var s = g.steps[i], d = el("div", "st");
      d.appendChild(el("p", "", T(s.s)));
      var o = el("div", "opts");
      s.o.forEach(function (op) {
        var b = el("button", "kd-opt", T(op[0])); b.type = "button";
        b.onclick = function () {
          d.querySelectorAll(".kd-opt").forEach(function (x) { x.disabled = true; });
          b.classList.add(op[1] ? "ok" : "no");
          var w = el("p", "kd-fb show " + (op[1] ? "good" : "bad"));
          w.appendChild(el("b", "", T(op[1] ? UIs.right : UIs.wrong)));
          w.appendChild(el("span", "", T(s.why)));
          d.appendChild(w);
          (op[1] ? SND.good : SND.bad)();
          i++; setTimeout(step, 900);
        };
        o.appendChild(b);
      });
      d.appendChild(o); box.appendChild(d);
      d.scrollIntoView({block: "nearest", behavior: "smooth"});
    }
    step();
  }

  var ENG = {match: gMatch, sort: gSort, memory: gMemory, path: gPath};

  /* ---------------------------------------------------------- quiz, with a gentle difficulty nudge */
  function quiz(host, qs, wid, done) {
    var i = 0, right = 0;
    function draw() {
      host.innerHTML = "";
      if (i >= qs.length) {
        var w = el("div", "kd-win");
        w.appendChild(el("div", "big", right === qs.length ? "🏆" : right >= qs.length - 1 ? "🎉" : "💪"));
        w.appendChild(el("h3", "", T(UIs.score) + ": " + right + " " + T(UIs.of) + " " + qs.length));
        var again = el("button", "kd-btn", T(UIs.again)); again.type = "button";
        again.onclick = function () { i = 0; right = 0; draw(); };
        w.appendChild(again);
        host.appendChild(w);
        if (right >= Math.ceil(qs.length * .75)) { done(right === qs.length ? 2 : 1); cheer(); }
        return;
      }
      var q = qs[i], h = el("div", "qh");
      h.appendChild(el("b", "", T(q.q)));
      h.appendChild(el("span", "qn", (i + 1) + " " + T(UIs.of) + " " + qs.length));
      host.appendChild(h);
      var o = el("div", "kd-opts");
      q.a.forEach(function (a, ai) {
        var b = el("button", "kd-opt", T(a)); b.type = "button";
        b.onclick = function () {
          o.querySelectorAll(".kd-opt").forEach(function (x) { x.disabled = true; });
          var ok = ai === q.c;
          b.classList.add(ok ? "ok" : "no");
          if (!ok) o.children[q.c].classList.add("ok");
          if (ok) right++;
          var f = el("div", "kd-fb show " + (ok ? "good" : "bad"));
          f.appendChild(el("b", "", T(ok ? UIs.right : UIs.wrong)));
          f.appendChild(el("span", "", T(q.why)));
          host.appendChild(f);
          (ok ? SND.good : SND.bad)();
          var nx = el("button", "kd-btn pri", T(UIs.next)); nx.type = "button";
          nx.style.marginTop = "12px";
          nx.onclick = function () { i++; draw(); };
          host.appendChild(nx);
          nx.focus();
        };
        o.appendChild(b);
      });
      host.appendChild(o);
    }
    draw();
  }

  /* ---------------------------------------------------------- world page */
  function world() {
    var w = D("kdWorld"); if (!w) return;
    if (!S.age || !S.av) { location.replace("/kids/start/"); return; }
    meBar();
    var data = J("kdW"); if (!data) return;
    /* lessons are already in the page: mark the ones that were read */
    document.querySelectorAll("[data-les]").forEach(function (s) {
      var id = s.dataset.les, b = s.querySelector(".kd-read");
      if (!b) return;
      function paint() { b.textContent = S.done[key(data.id, id)] ? "✓ " + T(UIs.done) : T(UIs.cont); }
      b.onclick = function () {
        if (mark(data.id, id, 1)) { SND.good(); }
        paint(); dots();
        var n = s.nextElementSibling;
        if (n) n.scrollIntoView({behavior: "smooth", block: "start"});
      };
      paint();
    });
    function dots() {
      document.querySelectorAll(".kd-dot[data-k]").forEach(function (d) {
        d.classList.toggle("ok", !!S.done[key(data.id, d.dataset.k)]);
      });
      var st = document.querySelector("#kdMe .kd-st"); if (st) st.textContent = "⭐ " + S.stars;
    }
    dots();
    (data.games || []).forEach(function (g) {
      var host = D("g-" + g.id); if (!host || !ENG[g.type]) return;
      ENG[g.type](host, g, function () {
        if (mark(data.id, g.id, 2)) cheer(); else SND.win();
        dots();
      });
    });
    var qh = D("kdQuiz");
    if (qh && data.quiz) quiz(qh, data.quiz, data.id, function (s) { mark(data.id, "quiz", s + 1); dots(); });
  }

  /* ---------------------------------------------------------- the shorts, the songs, the cast */
  function media() {
    var M = J("kdMedia");
    if (!M || !window.KFILM) return;
    document.querySelectorAll("[data-ep]").forEach(function (h) {
      var ep = (M.eps || {})[h.dataset.ep];
      if (!ep || h.dataset.on) return;
      h.dataset.on = "1";
      new window.KFILM.Player(h, ep, {onEnd: function () {
        if (ep.world && mark(ep.world, "film:" + ep.id, 2)) cheer();
        var st = document.querySelector("#kdMe .kd-st");
        if (st) st.textContent = "⭐ " + S.stars;
        document.querySelectorAll('.kd-dot[data-k="film:' + ep.id + '"]').forEach(function (d) { d.classList.add("ok"); });
      }});
    });
    document.querySelectorAll("[data-song]").forEach(function (h) {
      var sg = (M.songs || {})[h.dataset.song];
      if (!sg || h.dataset.on) return;
      h.dataset.on = "1";
      new window.KFILM.Karaoke(h, sg, sg.music);
    });
    var th = D("kdTheme");
    if (th && !th.dataset.on) {
      th.dataset.on = "1";
      var spinning = false;
      th.onclick = function () {
        if (!window.KSND) return;
        var tune = (M.music || {})[th.dataset.theme];
        if (!tune) return;
        if (spinning) { window.KSND.stop(); spinning = false; th.classList.remove("on"); return; }
        window.KSND.play(tune); spinning = true; th.classList.add("on");
      };
    }
    document.querySelectorAll("[data-char]").forEach(function (h) {
      if (h.dataset.on) return;
      h.dataset.on = "1";
      var sv = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      sv.setAttribute("viewBox", "-10 -16 120 124"); sv.setAttribute("class", "kd-charsvg");
      sv.appendChild(window.KFILM.charNode(h.dataset.char));
      h.insertBefore(sv, h.firstChild);
    });
  }

  /* ---------------------------------------------------------- a reminder to look away */
  function rest() {
    var box = D("kdRest"); if (!box) return;
    var t = setTimeout(function () {
      box.classList.add("show"); SND.tap();
    }, 20 * 60 * 1000);
    var b = box.querySelector("button");
    if (b) b.onclick = function () { box.classList.remove("show"); clearTimeout(t); };
  }

  function phs() {
    var l = (window.EKL && window.EKL()) || "fa";
    var k = l === "ckb" ? "phCkb" : l === "en" ? "phEn" : "phFa";
    document.querySelectorAll("[data-ph-fa]").forEach(function (x) {
      if (x.dataset[k]) x.placeholder = x.dataset[k];
    });
  }
  function boot() {
    UIs = J("kdUI") || {};
    phs(); addEventListener("ek-lang", phs);
    document.querySelectorAll(".kd").forEach(function (r) { r.dataset.age = S.age || "kid"; });
    setup(); hub(); world(); media(); rest();
    addEventListener("ek-lang", function () {
      meBar();
      /* the games and the quiz are drawn from data, so draw them again in the new language */
      if (!D("kdWorld")) return;
      document.querySelectorAll('[id^="g-"]').forEach(function (h) { h.innerHTML = ""; });
      var q = D("kdQuiz"); if (q) q.innerHTML = "";
      world();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
