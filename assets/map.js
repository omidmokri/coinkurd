/* /map/ — force-directed topic graph (hub) + checklist behaviour (topic pages).
   No dependencies. Reads its data from <script type="application/json" id="mpData">.
   Progress lives in localStorage under ck_map and is shared by both views. */
(function () {
  "use strict";
  var LS = "ck_map", ST = {};
  try { ST = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { ST = {}; }
  function save() { try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (e) {} }
  function lang() { return (window.EKL && window.EKL()) || "fa"; }
  function li() { var l = lang(); return l === "ckb" ? 1 : l === "en" ? 2 : 0; }
  function txt(a) { return (a && (a[li()] || a[0])) || ""; }
  function nz(t) {
    return (t || "").replace(/[‌-‏]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
  }
  function data(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ checklist */
  function checklist() {
    var box = document.getElementById("mpList");
    if (!box) return;
    var rows = [].slice.call(box.querySelectorAll(".mp-r input"));
    var ring = document.getElementById("mpRing"), rtx = document.getElementById("mpRtx");
    var cnt = document.getElementById("mpCnt"), C = 2 * Math.PI * 28;

    function paint() {
      var d = 0;
      rows.forEach(function (i) {
        var on = !!ST[i.dataset.r];
        i.checked = on;
        i.closest(".mp-r").classList.toggle("on", on);
        if (on) d++;
      });
      box.querySelectorAll(".mp-sec").forEach(function (s) {
        var all = s.querySelectorAll(".mp-r input"), k = 0;
        all.forEach(function (i) { if (i.checked) k++; });
        var c = s.querySelector("h2 small b");
        if (c) c.textContent = k + "/" + all.length;
      });
      var p = rows.length ? d / rows.length : 0;
      if (ring) ring.setAttribute("stroke-dasharray", (C * p).toFixed(1) + " " + C.toFixed(1));
      if (rtx) rtx.textContent = Math.round(p * 100) + "%";
      if (cnt) cnt.textContent = d + " / " + rows.length;
    }
    box.addEventListener("click", function (e) {
      if (e.target.closest("a") || e.target.tagName === "INPUT") return;
      var r = e.target.closest(".mp-r");
      if (!r) return;
      var i = r.querySelector("input");
      i.checked = !i.checked;
      i.dispatchEvent(new Event("change", { bubbles: true }));
    });
    box.addEventListener("change", function (e) {
      var i = e.target.closest(".mp-r input");
      if (!i) return;
      if (i.checked) ST[i.dataset.r] = 1; else delete ST[i.dataset.r];
      save(); paint();
    });
    var q = document.getElementById("mpFq");
    if (q) q.addEventListener("input", function () {
      var s = nz(q.value);
      box.querySelectorAll(".mp-r").forEach(function (r) {
        r.hidden = !!s && nz(r.dataset.s).indexOf(s) < 0;
      });
      box.querySelectorAll(".mp-sec").forEach(function (sec) {
        var any = [].slice.call(sec.querySelectorAll(".mp-r")).some(function (r) { return !r.hidden; });
        sec.hidden = !any;
      });
    });
    var rs = document.getElementById("mpReset");
    if (rs) rs.addEventListener("click", function () {
      rows.forEach(function (i) { delete ST[i.dataset.r]; });
      save(); paint();
    });
    paint();
  }

  /* ------------------------------------------------------------------ hub */
  function hub() {
    var D = data("mpData"), cv = document.getElementById("mpCv");
    if (!D || !cv) return;
    var N = D.nodes, L = D.links, CL = D.clusters, ctx = cv.getContext("2d");
    var W = 0, H = 0, dpr = 1, view = { s: 1, ox: 0, oy: 0 }, alpha = 1, hot = null, held = null;

    /* progress per faculty, from the shared checklist state */
    function prog(n) {
      if (!n.rs || !n.rs.length) return 0;
      var d = 0; n.rs.forEach(function (r) { if (ST[r]) d++; });
      return d / n.rs.length;
    }

    N.forEach(function (n, i) {
      var a = (i / N.length) * Math.PI * 2;
      n.x = Math.cos(a) * (n.k === "f" ? 150 : 250) + (Math.random() - .5) * 40;
      n.y = Math.sin(a) * (n.k === "f" ? 150 : 250) + (Math.random() - .5) * 40;
      n.vx = n.vy = 0;
      n.r = n.k === "f" ? 15 : 8;
      n.hit = 1;
    });
    var byId = {}; N.forEach(function (n) { byId[n.id] = n; });
    var E = L.map(function (l) { return [byId[l[0]], byId[l[1]], l[2]]; })
             .filter(function (l) { return l[0] && l[1]; });

    function sizeUp() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var b = cv.getBoundingClientRect();
      W = b.width; H = b.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!view.set) { view.ox = W / 2; view.oy = H / 2; view.s = Math.min(1, W / 760); view.set = 1; }
    }

    function step() {
      var i, j, a, b, dx, dy, d2, d, f;
      for (i = 0; i < N.length; i++) {
        for (j = i + 1; j < N.length; j++) {
          a = N[i]; b = N[j];
          dx = b.x - a.x; dy = b.y - a.y; d2 = dx * dx + dy * dy || .01;
          if (d2 > 360000) continue;
          d = Math.sqrt(d2); f = 2600 / d2;
          dx /= d; dy /= d;
          a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
        }
      }
      for (i = 0; i < E.length; i++) {
        a = E[i][0]; b = E[i][1];
        dx = b.x - a.x; dy = b.y - a.y; d = Math.sqrt(dx * dx + dy * dy) || .01;
        f = (d - E[i][2]) * .035;
        dx = dx / d * f; dy = dy / d * f;
        a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
      }
      var ar = Math.max(.6, Math.min(2.2, (W || 800) / (H || 500)));
      var gx = .0035 / ar, gy = .0035 * ar;
      for (i = 0; i < N.length; i++) {
        a = N[i];
        a.vx -= a.x * gx; a.vy -= a.y * gy;
        if (a === held) { a.vx = a.vy = 0; continue; }
        a.vx *= .80; a.vy *= .80;
        a.x += a.vx * alpha; a.y += a.vy * alpha;
      }
      alpha = Math.max(alpha * .997, .18);
    }

    var touched = 0;
    function fit(snap) {
      if (!N.length || !W) return;
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (var i = 0; i < N.length; i++) {
        var n = N[i];
        if (n.x < x0) x0 = n.x; if (n.y < y0) y0 = n.y;
        if (n.x > x1) x1 = n.x; if (n.y > y1) y1 = n.y;
      }
      var pad = Math.min(46, W * .06) + 22;
      var s2 = Math.min((W - pad * 2) / ((x1 - x0) || 1), (H - pad * 2) / ((y1 - y0) || 1));
      s2 = Math.max(.26, Math.min(1.4, s2));
      var ox = W / 2 - (x0 + x1) / 2 * s2, oy = H / 2 - (y0 + y1) / 2 * s2;
      var k = snap ? 1 : .12;
      view.s += (s2 - view.s) * k; view.ox += (ox - view.ox) * k; view.oy += (oy - view.oy) * k;
    }
    function sx(n) { return n.x * view.s + view.ox; }
    function sy(n) { return n.y * view.s + view.oy; }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var i, a, b;
      for (i = 0; i < E.length; i++) {
        a = E[i][0]; b = E[i][1];
        var lit = a.hit && b.hit;
        ctx.strokeStyle = lit ? "rgba(255,255,255,.13)" : "rgba(255,255,255,.04)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx(a), sy(a)); ctx.lineTo(sx(b), sy(b)); ctx.stroke();
      }
      var lbl = [];
      for (i = 0; i < N.length; i++) {
        a = N[i];
        var r = a.r * Math.max(view.s, .55), col = (CL[a.g] || "#f7931a");
        var x = sx(a), y = sy(a);
        if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
        ctx.globalAlpha = a.hit ? 1 : .18;
        if (a === hot) { ctx.beginPath(); ctx.arc(x, y, r + 6, 0, 6.284); ctx.fillStyle = col + "33"; ctx.fill(); }
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.284);
        ctx.fillStyle = a.live ? col : "#0b0c10";
        ctx.fill();
        ctx.lineWidth = a.k === "f" ? 2 : 1.4; ctx.strokeStyle = col; ctx.stroke();
        var p = prog(a);
        if (p > 0) {
          ctx.beginPath(); ctx.arc(x, y, r + 3.5, -1.5708, -1.5708 + 6.2832 * p);
          ctx.lineWidth = 2.5; ctx.strokeStyle = "#ffffff"; ctx.stroke();
        }
        if (a.k === "f" || view.s > .82 || a === hot) lbl.push([a, x, y, r]);
        ctx.globalAlpha = 1;
      }
      var l = lang(), rtl = l !== "en", small = W < 560;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.direction = rtl ? "rtl" : "ltr";
      lbl.sort(function (p, q) { return (p[0].k === "f" ? 0 : 1) - (q[0].k === "f" ? 0 : 1); });
      var box = [];
      for (i = 0; i < lbl.length; i++) {
        a = lbl[i][0];
        var fs = a.k === "f" ? (small ? 12 : 13) : (small ? 10 : 11);
        ctx.font = (a.k === "f" ? "700 " : "400 ") + fs + "px Vazirmatn,Tahoma,sans-serif";
        var t = txt(a.t), m = ctx.measureText(t).width;
        var x = lbl[i][1], y = lbl[i][2] + lbl[i][3] + 5, h2 = fs + 4;
        var r = [x - m / 2 - 4, y - 2, m + 8, h2], clash = 0;
        if (a !== hot) {
          for (var b2 = 0; b2 < box.length; b2++) {
            var o = box[b2];
            if (r[0] < o[0] + o[2] && o[0] < r[0] + r[2] && r[1] < o[1] + o[3] && o[1] < r[1] + r[3]) { clash = 1; break; }
          }
        }
        if (clash) continue;
        box.push(r);
        ctx.globalAlpha = a.hit ? 1 : .2;
        ctx.fillStyle = "rgba(5,6,8,.74)";
        ctx.fillRect(r[0], r[1], r[2], r[3]);
        ctx.fillStyle = a.k === "f" ? "#f3f3ef" : "#b9b9b2";
        ctx.fillText(t, x, y);
        ctx.globalAlpha = 1;
      }
    }

    var raf = 0;
    function loop() { step(); if (!touched) fit(); draw(); raf = requestAnimationFrame(loop); }

    /* ---- pointer */
    function at(ev) {
      var b = cv.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top, best = null, bd = 1e9;
      for (var i = 0; i < N.length; i++) {
        var n = N[i], dx = sx(n) - x, dy = sy(n) - y, d = dx * dx + dy * dy;
        var rr = (n.r * Math.max(view.s, .55) + 9); rr *= rr;
        if (d < rr && d < bd) { bd = d; best = n; }
      }
      return { n: best, x: x, y: y };
    }
    var down = null, moved = 0;
    cv.addEventListener("pointerdown", function (e) {
      var h = at(e);
      touched = 1;
      down = { x: h.x, y: h.y, ox: view.ox, oy: view.oy, n: h.n };
      held = h.n; moved = 0; alpha = Math.max(alpha, .7);
      cv.classList.add("drag"); cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", function (e) {
      var h = at(e);
      if (!down) { if (hot !== h.n) { hot = h.n; cv.title = h.n ? txt(h.n.t) : ""; } return; }
      moved += Math.abs(h.x - down.x) + Math.abs(h.y - down.y);
      if (down.n) { down.n.x = (h.x - view.ox) / view.s; down.n.y = (h.y - view.oy) / view.s; }
      else { view.ox = down.ox + (h.x - down.x); view.oy = down.oy + (h.y - down.y); }
    });
    function up(e) {
      if (down && down.n && moved < 7) location.href = down.n.u;
      down = null; held = null; cv.classList.remove("drag");
      if (e && e.pointerId != null && cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
    }
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", function (e) {
      e.preventDefault();
      touched = 1;
      var b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      var k = Math.exp(-e.deltaY * .0014), s2 = Math.min(2.6, Math.max(.4, view.s * k));
      k = s2 / view.s;
      view.ox = x - (x - view.ox) * k; view.oy = y - (y - view.oy) * k; view.s = s2;
    }, { passive: false });

    /* ---- search over nodes, lessons and terms */
    var q = document.getElementById("mpQ"), res = document.getElementById("mpRes");
    function hit(s) {
      var any = 0;
      N.forEach(function (n) {
        n.hit = !s || nz(n.t.join(" ")).indexOf(s) >= 0 ? 1 : 0;
        if (n.hit) any++;
      });
      if (!any) N.forEach(function (n) { n.hit = 1; });
      alpha = Math.max(alpha, .5);
    }
    if (q) q.addEventListener("input", function () {
      var s = nz(q.value);
      hit(s);
      if (!res) return;
      if (!s) { res.hidden = true; res.innerHTML = ""; return; }
      var out = [];
      for (var i = 0; i < D.find.length && out.length < 24; i++) {
        var f = D.find[i];
        if (f.h === undefined) f.h = nz(f.t.join(" ") + " " + f.w.join(" "));
        if (f.h.indexOf(s) >= 0) out.push(f);
      }
      res.hidden = false;
      res.innerHTML = out.length
        ? out.map(function (f) {
            return '<a href="' + f.u + '"><b>' + esc(txt(f.t)) + "</b><small>" + esc(txt(f.w)) + "</small></a>";
          }).join("")
        : '<p class="mp-hint">' + esc(D.nores) + "</p>";
    });
    function esc(t) {
      return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    /* ---- per-card progress bars in the list view */
    document.querySelectorAll(".mp-card[data-rs]").forEach(function (c) {
      var rs = c.dataset.rs ? c.dataset.rs.split(" ") : [], d = 0;
      rs.forEach(function (r) { if (ST[r]) d++; });
      var b = c.querySelector(".mp-pb i");
      if (b) b.style.width = (rs.length ? Math.round(d * 100 / rs.length) : 0) + "%";
    });

    sizeUp();
    for (var w0 = 0; w0 < 140; w0++) step();   /* start close to settled, then drift gently */
    alpha = .55; fit(1);
    addEventListener("resize", sizeUp);
    addEventListener("ek-lang", function () { alpha = Math.max(alpha, .3); });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (var i = 0; i < 400; i++) step();
      alpha = 0; fit(1); draw();
      addEventListener("resize", draw);
      cv.addEventListener("pointermove", draw); cv.addEventListener("pointerup", draw);
      cv.addEventListener("wheel", draw); if (q) q.addEventListener("input", draw);
    } else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting && !raf) loop();
          else if (!en.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
        });
      });
      io.observe(cv);
    }
  }

  function phs() {
    document.querySelectorAll("[data-ph-fa]").forEach(function (el) {
      var l = lang();
      el.placeholder = el.dataset["ph" + (l === "ckb" ? "Ckb" : l === "en" ? "En" : "Fa")] || el.placeholder;
    });
  }
  function boot() { phs(); addEventListener("ek-lang", phs); checklist(); hub(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
