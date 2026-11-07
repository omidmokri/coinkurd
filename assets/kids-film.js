/* The academy's animated shorts. Characters, sets and camera are drawn as SVG and
   moved by the browser; the dialogue, the music and the sound effects are timed
   against the same clock. Nothing here is a video file: an episode is data, so it
   plays in any language, reads out as a storyboard for a screen reader, and stops
   moving for anyone who asks for reduced motion. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  function li() { var l = (window.EKL && window.EKL()) || "fa"; return l === "ckb" ? 1 : l === "en" ? 2 : 0; }
  function T(a) { return !a ? "" : (Array.isArray(a) ? (a[li()] || a[0]) : a); }
  var RM = matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------------ cast */
  /* every character is built from the same parts so they can all blink, talk,
     bob and point with one piece of code */
  var CAST = {
    roj:  {c: "#f7931a", c2: "#ffd9a8", ear: "fox",  name: ["رۆژ", "ڕۆژ", "Roj"]},
    aso:  {c: "#a78bfa", c2: "#e9e2ff", ear: "owl",  name: ["ئاسۆ", "ئاسۆ", "Aso"]},
    zip:  {c: "#2dd4bf", c2: "#d2fff8", ear: "bot",  name: ["زیپ", "زیپ", "Zip"]},
    fel:  {c: "#64607a", c2: "#9b94b8", ear: "mask", name: ["فێڵباز", "فێڵباز", "Trickster"]}
  };
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function charNode(id, act) {
    var d = CAST[id];
    var pos = el("g", {class: "kf-pos", "data-ch": id});          /* carries the transform attribute */
    var mv = el("g", {class: "kf-act-" + (act || "idle")});       /* carries the acting animation */
    var g = el("g", {class: "kf-ch kf-" + id});                   /* carries the idle bob */
    var body = el("g", {class: "kf-body"});
    /* tail or cape behind the body */
    if (d.ear === "fox") body.appendChild(el("path", {class: "kf-tail", d: "M30 86 q-30 4 -36 -22 q14 14 34 2 z", fill: d.c, opacity: ".9"}));
    if (d.ear === "mask") body.appendChild(el("path", {class: "kf-tail", d: "M28 40 q-26 28 -12 62 q10 -34 22 -44 z", fill: d.c, opacity: ".55"}));
    body.appendChild(el("ellipse", {cx: 50, cy: 78, rx: 24, ry: 26, fill: d.c}));
    body.appendChild(el("ellipse", {cx: 50, cy: 84, rx: 14, ry: 17, fill: d.c2, opacity: ".85"}));
    /* arms */
    body.appendChild(el("g", {class: "kf-armL"})).appendChild(el("ellipse", {cx: 26, cy: 76, rx: 7, ry: 12, fill: d.c}));
    body.appendChild(el("g", {class: "kf-armR"})).appendChild(el("ellipse", {cx: 74, cy: 76, rx: 7, ry: 12, fill: d.c}));
    var head = el("g", {class: "kf-head"});
    if (d.ear === "fox") {
      head.appendChild(el("path", {d: "M28 28 l4 -24 l18 14 z", fill: d.c}));
      head.appendChild(el("path", {d: "M72 28 l-4 -24 l-18 14 z", fill: d.c}));
    } else if (d.ear === "owl") {
      head.appendChild(el("path", {d: "M30 22 l-2 -18 l16 10 z", fill: d.c}));
      head.appendChild(el("path", {d: "M70 22 l2 -18 l-16 10 z", fill: d.c}));
    } else if (d.ear === "bot") {
      head.appendChild(el("rect", {x: 48, y: -4, width: 4, height: 14, fill: d.c}));
      head.appendChild(el("circle", {cx: 50, cy: -7, r: 5, fill: "#fbbf24", class: "kf-blip"}));
    } else {
      head.appendChild(el("path", {d: "M22 30 q28 -30 56 0 q-6 -16 -28 -16 q-22 0 -28 16 z", fill: d.c}));
    }
    head.appendChild(el(d.ear === "bot" ? "rect" : "circle",
      d.ear === "bot" ? {x: 26, y: 18, width: 48, height: 42, rx: 12, fill: d.c}
                      : {cx: 50, cy: 38, r: 25, fill: d.c}));
    head.appendChild(el("ellipse", {cx: 50, cy: 46, rx: 15, ry: 12, fill: d.c2}));
    var eyes = el("g", {class: "kf-eyes"});
    [38, 62].forEach(function (x) {
      eyes.appendChild(el("ellipse", {cx: x, cy: 36, rx: 7, ry: 8, fill: "#fff"}));
      eyes.appendChild(el("circle", {cx: x + 1, cy: 37, r: 3.4, fill: "#15131c"}));
      eyes.appendChild(el("circle", {cx: x + 2.4, cy: 35.4, r: 1.2, fill: "#fff"}));
    });
    head.appendChild(eyes);
    if (d.ear === "mask") head.appendChild(el("path", {d: "M28 32 h44 v9 h-44 z", fill: "#15131c", opacity: ".75"}));
    head.appendChild(el("ellipse", {cx: 50, cy: 44, rx: 3.6, ry: 2.6, fill: "#2a2733"}));
    head.appendChild(el("ellipse", {class: "kf-mouth", cx: 50, cy: 52, rx: 5, ry: 2.2, fill: "#2a2733"}));
    g.appendChild(body); g.appendChild(head);
    mv.appendChild(g); pos.appendChild(mv);
    return pos;
  }

  /* ------------------------------------------------------------------ sets */
  function bgNode(kind) {
    var g = el("g", {class: "kf-bg kf-bg-" + kind});
    function sky(a, b) {
      var lg = el("linearGradient", {id: "sk" + kind, x1: 0, y1: 0, x2: 0, y2: 1});
      lg.appendChild(el("stop", {offset: 0, "stop-color": a}));
      lg.appendChild(el("stop", {offset: 1, "stop-color": b}));
      var defs = el("defs"); defs.appendChild(lg); g.appendChild(defs);
      g.appendChild(el("rect", {x: 0, y: 0, width: 960, height: 540, fill: "url(#sk" + kind + ")"}));
    }
    if (kind === "market") {
      sky("#1b2a4a", "#3d2a4f");
      g.appendChild(el("circle", {cx: 790, cy: 120, r: 54, fill: "#f7931a", opacity: ".9", class: "kf-sun"}));
      [[-40, 470, 420], [280, 480, 460], [620, 465, 480]].forEach(function (h) {
        g.appendChild(el("ellipse", {cx: h[0] + 200, cy: h[1] + 120, rx: h[2], ry: 160, fill: "#24314f"}));
      });
      [[190, "#f7931a"], [430, "#2dd4bf"], [670, "#a78bfa"]].forEach(function (s, i) {
        g.appendChild(el("rect", {x: s[0], y: 300, width: 118, height: 86, rx: 8, fill: "#1a2138"}));
        g.appendChild(el("path", {d: "M" + (s[0] - 10) + " 300 l69 -38 l69 38 z", fill: s[1], opacity: ".85",
          class: "kf-flap", style: "--d:" + i * .4 + "s"}));
      });
      g.appendChild(el("rect", {x: 0, y: 452, width: 960, height: 88, fill: "#141a2c"}));
    } else if (kind === "chain") {
      sky("#0d1026", "#241a3e");
      for (var i = 0; i < 46; i++)
        g.appendChild(el("circle", {cx: Math.random() * 960, cy: Math.random() * 420, r: Math.random() * 1.8 + .6,
          fill: "#fff", opacity: .25 + Math.random() * .6, class: "kf-star", style: "--d:" + (Math.random() * 3).toFixed(1) + "s"}));
      [140, 340, 540, 740].forEach(function (x, k) {
        g.appendChild(el("rect", {x: x, y: 112 + (k % 2 ? 40 : 0), width: 104, height: 104, rx: 16,
          fill: "#2b2550", stroke: "#7c6cff", "stroke-width": 3, class: "kf-float", style: "--d:" + k * .5 + "s"}));
        if (x < 740) g.appendChild(el("line", {x1: x + 104, y1: 164 + (k % 2 ? 40 : 0), x2: x + 200,
          y2: 164 + ((k + 1) % 2 ? 40 : 0), stroke: "#7c6cff", "stroke-width": 5, "stroke-linecap": "round", opacity: ".7"}));
      });
    } else if (kind === "night") {
      sky("#07080f", "#16121f");
      g.appendChild(el("rect", {x: 620, y: 70, width: 250, height: 180, rx: 10, fill: "#101828", stroke: "#2a3350", "stroke-width": 4}));
      g.appendChild(el("circle", {cx: 800, cy: 120, r: 26, fill: "#e8e4d0", opacity: ".8"}));
      g.appendChild(el("rect", {x: 0, y: 440, width: 960, height: 100, fill: "#15131c"}));
      g.appendChild(el("g", {class: "kf-phone"})).appendChild(el("rect", {x: 150, y: 300, width: 96, height: 170, rx: 14,
        fill: "#0b0d14", stroke: "#ef4444", "stroke-width": 3}));
      g.appendChild(el("rect", {x: 160, y: 314, width: 76, height: 130, rx: 7, fill: "#ef4444", opacity: ".22", class: "kf-glow"}));
    } else {
      sky("#0a1420", "#122233");
      [[90, 250], [190, 185], [290, 275], [390, 140], [490, 210], [590, 95], [690, 165], [790, 60]].forEach(function (p, k) {
        var up = k % 3 !== 1;
        g.appendChild(el("line", {x1: p[0] + 18, y1: p[1] - 34, x2: p[0] + 18, y2: p[1] + 118,
          stroke: up ? "#34d399" : "#fb7185", "stroke-width": 4}));
        g.appendChild(el("rect", {x: p[0], y: p[1], width: 36, height: 86, rx: 5,
          fill: up ? "#34d399" : "#fb7185", opacity: ".92", class: "kf-float", style: "--d:" + k * .22 + "s"}));
      });
      g.appendChild(el("rect", {x: 0, y: 440, width: 960, height: 100, fill: "#0a1016"}));
    }
    return g;
  }

  /* ------------------------------------------------------------------ player */
  function Player(host, ep, opts) {
    opts = opts || {};
    var stage = el("svg", {viewBox: "0 0 960 540", class: "kf-stage", role: "img"});
    var cam = el("g", {class: "kf-cam"}), bg = el("g"), cast = el("g");
    cam.appendChild(bg); cam.appendChild(cast); stage.appendChild(cam);
    var wrap = document.createElement("div"); wrap.className = "kf-wrap";
    var bubble = document.createElement("div"); bubble.className = "kf-bubble";
    var sub = document.createElement("div"); sub.className = "kf-sub";
    wrap.appendChild(stage); wrap.appendChild(bubble); wrap.appendChild(sub);
    host.appendChild(wrap);

    var bar = document.createElement("div"); bar.className = "kf-bar";
    var play = document.createElement("button"); play.className = "kf-b kf-play"; play.type = "button";
    var rep = document.createElement("button"); rep.className = "kf-b"; rep.type = "button"; rep.textContent = "↻";
    var mut = document.createElement("button"); mut.className = "kf-b"; mut.type = "button"; mut.textContent = "🔊";
    var prog = document.createElement("div"); prog.className = "kf-prog"; prog.appendChild(document.createElement("i"));
    var sc = document.createElement("span"); sc.className = "kf-sc";
    bar.appendChild(play); bar.appendChild(rep); bar.appendChild(prog); bar.appendChild(sc); bar.appendChild(mut);
    host.appendChild(bar);

    var i = 0, line = 0, t0 = 0, raf = 0, on = false, muted = false, timer = 0;
    var nodes = {};

    function setScene(n) {
      var s = ep.scenes[n];
      bg.innerHTML = ""; cast.innerHTML = ""; nodes = {};
      bg.appendChild(bgNode(s.bg));
      (s.cast || []).forEach(function (c) {
        var g = charNode(c.who, c.act);
        var t = "translate(" + c.at[0] + "," + c.at[1] + ") scale(" + (c.s || 1.6) + ")";
        if (c.flip) t += " translate(100,0) scale(-1,1)";
        g.setAttribute("transform", t);
        cast.appendChild(g);
        nodes[c.who] = g.querySelector(".kf-ch");
      });
      var z = s.cam || [1, 0, 0];
      cam.style.transformOrigin = "480px 270px";
      cam.style.transition = RM.matches ? "none" : "transform 2.4s ease-in-out";
      cam.style.transform = "scale(" + z[0] + ") translate(" + z[1] + "px," + z[2] + "px)";
      sc.textContent = (n + 1) + "/" + ep.scenes.length;
      prog.firstChild.style.width = Math.round((n + 1) / ep.scenes.length * 100) + "%";
    }

    function speak() {
      var s = ep.scenes[i], L = s.lines[line];
      if (!L) { i++; line = 0; return i < ep.scenes.length ? (setScene(i), speak()) : finish(); }
      Object.keys(nodes).forEach(function (k) { nodes[k].classList.remove("kf-talk"); });
      if (nodes[L.who]) nodes[L.who].classList.add("kf-talk");
      var txt = T(L.t);
      bubble.textContent = txt;
      bubble.className = "kf-bubble show " + (L.side === "r" ? "r" : "l");
      sub.innerHTML = "";
      var nm = document.createElement("b"); nm.textContent = T((CAST[L.who] || {}).name) + ": ";
      sub.appendChild(nm); sub.appendChild(document.createTextNode(txt));
      if (L.sfx && window.KSND) window.KSND.sfx(L.sfx);
      var dur = Math.max(1700, Math.min(7000, txt.length * 72));
      timer = setTimeout(function () { line++; speak(); }, dur);
    }

    function finish() {
      on = false; play.textContent = "▶";
      bubble.className = "kf-bubble";
      Object.keys(nodes).forEach(function (k) { nodes[k].classList.remove("kf-talk"); });
      if (window.KSND) { window.KSND.stop(); window.KSND.sfx("win"); }
      if (opts.onEnd) opts.onEnd();
    }
    function start() {
      on = true; play.textContent = "⏸";
      if (window.KSND && ep.music) window.KSND.play(ep.music);
      setScene(i); speak();
    }
    function pause() {
      on = false; play.textContent = "▶"; clearTimeout(timer);
      if (window.KSND) window.KSND.stop();
    }
    play.onclick = function () { on ? pause() : start(); };
    rep.onclick = function () { clearTimeout(timer); i = 0; line = 0; start(); };
    mut.onclick = function () { muted = !muted; mut.textContent = muted ? "🔇" : "🔊"; if (window.KSND) window.KSND.mute(muted); };

    setScene(0);
    bubble.textContent = T(ep.logline); bubble.className = "kf-bubble show l";
    play.textContent = "▶";
    this.stop = pause;
    addEventListener("ek-lang", function () { if (on) { bubble.textContent = T(ep.scenes[i].lines[line] ? ep.scenes[i].lines[line].t : ep.logline); } });
  }

  /* ---------------------------------------------------------------- karaoke */
  function Karaoke(host, sg, music) {
    var stage = el("svg", {viewBox: "250 200 460 260", class: "kf-stage-mini", role: "img"});
    var band = el("g");
    (sg.cast || ["roj"]).forEach(function (who, k) {
      var g = charNode(who, "idle");
      g.setAttribute("transform", "translate(" + (300 + k * 230) + ",230) scale(1.9)");
      band.appendChild(g);
    });
    stage.appendChild(band);
    host.appendChild(stage);

    var ly = document.createElement("div"); ly.className = "kf-ly";
    var ps = sg.lines.map(function (l) {
      var p = document.createElement("p");
      if (l[1]) p.className = "ch";
      p.textContent = T(l[2]);
      ly.appendChild(p); return p;
    });
    host.appendChild(ly);

    var bar = document.createElement("div"); bar.className = "kf-bar";
    var play = document.createElement("button"); play.className = "kf-b kf-play"; play.type = "button"; play.textContent = "▶";
    var mut = document.createElement("button"); mut.className = "kf-b"; mut.type = "button"; mut.textContent = "🔊";
    var prog = document.createElement("div"); prog.className = "kf-prog"; prog.appendChild(document.createElement("i"));
    bar.appendChild(play); bar.appendChild(prog); bar.appendChild(mut);
    host.appendChild(bar);

    var on = false, muted = false;
    function light(bar16) {
      var cur = -1;
      sg.lines.forEach(function (l, k) { if (l[0] <= bar16) cur = k; });
      ps.forEach(function (p, k) { p.classList.toggle("on", k === cur); });
      band.querySelectorAll(".kf-ch").forEach(function (c) { c.classList.add("kf-talk"); });
      prog.firstChild.style.width = Math.round(((bar16 % 16) / 16) * 100) + "%";
    }
    play.onclick = function () {
      if (!window.KSND) return;
      if (on) { window.KSND.stop(); on = false; play.textContent = "▶";
                band.querySelectorAll(".kf-ch").forEach(function (c) { c.classList.remove("kf-talk"); });
                ps.forEach(function (p) { p.classList.remove("on"); }); return; }
      on = true; play.textContent = "⏸";
      var bars = music.bars || 4;
      window.KSND.play(music, function (step, loop) {
        var barNo = (loop * bars + Math.floor(step / 16)) % 16;
        light(barNo);
      });
    };
    mut.onclick = function () { muted = !muted; mut.textContent = muted ? "🔇" : "🔊"; if (window.KSND) window.KSND.mute(muted); };
    addEventListener("ek-lang", function () { ps.forEach(function (p, k) { p.textContent = T(sg.lines[k][2]); }); });
  }

  window.KFILM = {Player: Player, Karaoke: Karaoke, cast: CAST, charNode: charNode, bgNode: bgNode, T: T};
})();
