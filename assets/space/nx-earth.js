/* entekhab.net · the homepage's real Earth (owner's request, 2026-11-27: "real space, a real Earth, not a cartoon").
   nxEarth(nx, cbox, o) takes the place of the coin and the galaxy on the homepage stage (assets/nx-home.js calls it
   instead of nxCoin when <html> has the class ek-earth, which the head script of scripts/chrome.py sets on "/").
   - At once: a still photograph of the Earth (earth-still.webp, rendered by the same engine) stands where the coin was,
     drawn by assets/space/nx-earth.css, so the first paint already shows it.
   - When the page is idle: three.js (the site's own copy) and assets/space/space.js are loaded and one canvas behind the
     whole stage draws the real sky (15,500 catalogued stars, the Milky Way) and the turning Earth (NASA Blue Marble by day,
     Black Marble city lights by night, moving clouds, ocean glint, the atmosphere), framed exactly over the still picture,
     which then fades out.
   - Without WebGL, on a machine without a graphics chip (nx-lite), with the data saver or under 1 GB of memory, the still
     Earth stays: nothing heavy is fetched. A lost graphics context brings the still picture back.
   It returns the coin's interface (pause, pulse, face, set, motion), so nx-home.js drives it like the coin. */
(function (w) {
  'use strict';
  var d = document, de = d.documentElement, BASE = '/assets/space/', V = '1';
  var FOV = 32, FILL = 0.96 * 0.43;   // the still picture is 96% of the box's height; the globe is 43% of the picture

  function webgl() {
    try { var c = d.createElement('canvas'); return !!(w.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }
  function load(src, ok, bad) {
    var s = d.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = bad; d.head.appendChild(s);
  }

  w.nxEarth = function (nx, cbox, o) {
    o = o || {};
    var st = null, held = false, kick = 0, cv = null;
    var api = {
      pause: function (b) { held = !!b; if (st) st.hold = held; },
      pulse: function () { kick = 1; },
      face: function () { }, set: function () { },
      motion: function () { return null; }
    };
    var nc = navigator.connection || {};
    if (nc.saveData || de.classList.contains('nx-lite') || (navigator.deviceMemory || 8) <= 1 || !webgl()) return api;
    var bg = nx.querySelector('.nx-bg');
    if (!bg) return api;

    function lost() {
      nx.classList.remove('nx-e3');
      if (st) st.hold = true;
      if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
      st = null;
    }
    function start() {
      if (!w.EKSpace || !w.THREE) return;
      cv = d.createElement('canvas');
      cv.className = 'nx-ecv'; cv.setAttribute('aria-hidden', 'true');
      bg.appendChild(cv);
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost(); });
      try {
        st = new w.EKSpace.Stage(cv, {
          fov: FOV, distance: 4, drag: false, faceLon: 44, tilt: 0.36, spin: 0.012,
          sun: new w.THREE.Vector3(-0.62, 0.28, 0.78).normalize(), exposure: 1.05, atmo: 0.9,
          starGain: 1.35, milky: 0.8,
          /* put the globe exactly where the still picture is: the centre of the coin's box, the same size */
          frame: function (cam, W, H) {
            var B = cv.getBoundingClientRect(), c = cbox.getBoundingClientRect();
            if (!c.height || !B.height) return;
            var cx = c.left + c.width / 2 - B.left, cy = c.top + c.height / 2 - B.top, rpx = c.height * FILL;
            cam.position.set(0, 0, (H / 2) / (rpx * Math.tan(FOV * Math.PI / 360)));
            cam.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
          },
          onload: function () {
            setTimeout(function () { if (st) { nx.classList.add('nx-e3'); if (o.onready) o.onready(); } }, 120);
          }
        });
      } catch (e) { lost(); return; }
      st.hold = held;
      st.onTick = function (dt) {
        if (kick > 0 && st.earth) { st.earth.mesh.rotation.y += kick * dt * 2.4; kick = Math.max(0, kick - dt * 0.7); }
      };
      /* the stage's layout settles after fonts and its entry animation: measure again when it changes */
      if ('ResizeObserver' in w) { var ro = new ResizeObserver(function () { if (st) st.resize(); }); ro.observe(nx); ro.observe(cbox); }
      setTimeout(function () { if (st) st.resize(); }, 1300);
    }
    function go() {
      if (w.EKSpace) return start();
      var next = function () { load(BASE + 'space.js?v=' + V, start, lost); };
      if (w.THREE) next(); else load('/assets/vendor/three/three.min.js', next, lost);
    }
    go();
    return api;
  };
})(window);
