/* ===================================================================
   داشبورد سه‌بعدی نتایج
   drawScatter : ابر نقاط شرکت‌کنندگان در فضای سه‌بعدی متغیرها
   drawBars    : نمودار میله‌ای سه‌بعدی طبقات PGSI
   =================================================================== */
import * as T from './three.module.js';
import { OrbitControls } from './OrbitControls.js';

const BAND_COLOR = { none: 0x5fd6a0, low: 0x8ed07a, mod: 0xf0b254, high: 0xff8a8a };
export const BAND_FA = { none: 'بدون مشکل', low: 'خطر کم', mod: 'خطر متوسط',
                         high: 'قمار مشکل‌ساز' };

function sprite(text, size = 34, color = '#aab6d0') {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  const font = `700 ${size}px Vazirmatn, sans-serif`;
  x.font = font;
  const w = Math.ceil(x.measureText(text).width) + 26, h = size + 22;
  c.width = w * 2; c.height = h * 2; x.scale(2, 2);
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 8;
  x.fillStyle = color; x.fillText(text, w / 2, h / 2);
  const tex = new T.CanvasTexture(c); tex.minFilter = T.LinearFilter;
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true,
                                                depthWrite: false }));
  s.scale.set(w / 110, h / 110, 1);
  return s;
}

function baseScene(host, camPos) {
  const W = () => host.clientWidth, H = () => host.clientHeight;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(46, W() / H(), 0.1, 200);
  cam.position.set(...camPos);
  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.enableDamping = true; ctl.dampingFactor = 0.08;
  ctl.autoRotate = true; ctl.autoRotateSpeed = 0.45;
  renderer.domElement.addEventListener('pointerdown', () => ctl.autoRotate = false);
  scene.add(new T.AmbientLight(0xffffff, 0.6));
  const p = new T.PointLight(0x9fb8ff, 80, 80); p.position.set(8, 10, 8); scene.add(p);
  /* فاصله دوربین را چنان تنظیم می‌کند که جعبه محتوا در هر نسبت‌تصویری
     کامل داخل کادر بماند (روی موبایل بریده نشود) */
  let fit = null;
  const applyFit = () => {
    if (!fit || !W() || !H()) return;
    const half = (cam.fov * Math.PI / 180) / 2;
    const aspect = W() / H();
    const dV = fit.h / Math.tan(half);
    const dH = fit.w / (Math.tan(half) * aspect);
    const d = Math.max(dV, dH);
    const dir = cam.position.clone().sub(ctl.target).normalize();
    cam.position.copy(ctl.target).add(dir.multiplyScalar(d));
    ctl.update();
  };
  const ro = new ResizeObserver(() => {
    if (!W() || !H()) return;
    cam.aspect = W() / H(); cam.updateProjectionMatrix(); renderer.setSize(W(), H());
    applyFit();
  });
  ro.observe(host);
  const fitTo = (w, h) => { fit = { w, h }; applyFit(); };
  return { renderer, scene, cam, ctl, ro, fitTo };
}

/* ------------------------------------------------------------------
   ابر نقاط سه‌بعدی: X = اجتناب تجربه‌ای، Y = تنظیم هیجان،
   Z = انعطاف‌ناپذیری، رنگ و اندازه = شدت اختلال قمار
   ------------------------------------------------------------------ */
export function drawScatter(host, rows) {
  const { renderer, scene, cam, ctl, ro, fitTo } = baseScene(host, [6.6, 5.3, 8.4]);
  ctl.target.set(0, 0, 0);
  fitTo(6.1, 6.0);

  const S = 4.2;                       // نیم‌طول هر محور

  /* نرمال‌سازی بر پایه دامنه واقعی داده‌ها (نه دامنه نظری) تا ابر نقاط
     فضا را پر کند و الگو خوانا باشد */
  const span = key => {
    const v = rows.map(r => +r[key]).filter(Number.isFinite);
    if (!v.length) return [0, 1];
    let a = Math.min(...v), b = Math.max(...v);
    const pad = (b - a) * 0.08 || 1;
    return [a - pad, b + pad];
  };
  const SP = { x: span('beaq_total'), y: span('ders_total'), z: span('aaq_total') };
  const norm = (v, [a, b]) => (b === a ? 0 : ((v - a) / (b - a) - 0.5) * 2 * S);

  /* محورها */
  const axes = [
    { dir: [1, 0, 0], color: 0x6ea8ff, name: 'اجتناب تجربه‌ای' },
    { dir: [0, 1, 0], color: 0xf0b254, name: 'تنظیم هیجان' },
    { dir: [0, 0, 1], color: 0x9d8cff, name: 'انعطاف‌ناپذیری' },
  ];
  axes.forEach(a => {
    const v = new T.Vector3(...a.dir).multiplyScalar(S);
    const g = new T.BufferGeometry().setFromPoints([v.clone().negate(), v]);
    scene.add(new T.Line(g, new T.LineBasicMaterial({ color: a.color,
      transparent: true, opacity: 0.55 })));
    const lab = sprite(a.name, 32, '#' + a.color.toString(16).padStart(6, '0'));
    lab.position.copy(v.clone().multiplyScalar(1.17));
    scene.add(lab);
  });

  /* شبکه کف */
  const grid = new T.GridHelper(S * 2, 10, 0x2a3450, 0x1d2742);
  grid.material.transparent = true; grid.material.opacity = 0.22;
  grid.position.y = -S;
  scene.add(grid);

  /* نقاط */
  const pts = [];
  rows.forEach(r => {
    const x = +r.beaq_total, y = +r.ders_total, z = +r.aaq_total, p = +r.pgsi_total;
    if (![x, y, z, p].every(Number.isFinite)) return;
    const key = p === 0 ? 'none' : p <= 2 ? 'low' : p <= 7 ? 'mod' : 'high';
    const col = BAND_COLOR[key];
    const m = new T.Mesh(
      new T.SphereGeometry(0.09 + (p / 27) * 0.17, 14, 14),
      new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55,
        roughness: 0.3, transparent: true, opacity: 0.9 }));
    m.position.set(norm(x, SP.x), norm(y, SP.y), norm(z, SP.z));
    m.userData.target = m.position.clone();
    m.position.multiplyScalar(0.01);
    scene.add(m); pts.push(m);
  });

  let raf; const t0 = performance.now();
  (function loop(now) {
    raf = requestAnimationFrame(loop);
    const k = Math.min(1, (now - t0) / 1100);
    const e = 1 - Math.pow(1 - k, 3);
    pts.forEach((m, i) => {
      const d = Math.min(1, Math.max(0, (e - (i / pts.length) * 0.25) / 0.75));
      m.position.copy(m.userData.target).multiplyScalar(0.01 + d * 0.99);
    });
    ctl.update(); renderer.render(scene, cam);
  })(t0);

  return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose();
                 host.querySelector('canvas')?.remove(); };
}

/* ------------------------------------------------------------------
   میله‌های سه‌بعدی طبقات PGSI
   ------------------------------------------------------------------ */
export function drawBars(host, counts) {
  const { renderer, scene, cam, ctl, ro, fitTo } = baseScene(host, [0, 2.7, 7.4]);
  ctl.target.set(0, 1.25, 0);
  fitTo(3.6, 3.1);

  const keys = ['none', 'low', 'mod', 'high'];
  const max = Math.max(1, ...keys.map(k => counts[k] || 0));
  const bars = [];

  keys.forEach((k, i) => {
    const n = counts[k] || 0;
    const h = 0.25 + (n / max) * 2.9;
    const x = (i - 1.5) * 1.75;
    const col = BAND_COLOR[k];

    const m = new T.Mesh(
      new T.CylinderGeometry(0.52, 0.52, h, 36),
      new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4,
        roughness: 0.3, metalness: 0.3, transparent: true, opacity: 0.92 }));
    m.position.set(x, h / 2, 0);
    m.userData = { h };
    m.scale.y = 0.01;
    scene.add(m); bars.push(m);

    const cap = new T.Mesh(
      new T.TorusGeometry(0.54, 0.02, 8, 48),
      new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7 }));
    cap.rotation.x = Math.PI / 2; cap.position.set(x, 0.01, 0);
    scene.add(cap);

    const lv = sprite(String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]), 40, '#ffffff');
    lv.position.set(x, h + 0.55, 0); scene.add(lv);
    const ln = sprite(BAND_FA[k], 28, '#' + col.toString(16).padStart(6, '0'));
    ln.position.set(x, -0.5, 0); scene.add(ln);
  });

  const grid = new T.GridHelper(9, 9, 0x2a3450, 0x1d2742);
  grid.material.transparent = true; grid.material.opacity = 0.2;
  scene.add(grid);

  let raf; const t0 = performance.now();
  (function loop(now) {
    raf = requestAnimationFrame(loop);
    const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3);
    bars.forEach((m, i) => {
      const d = Math.min(1, Math.max(0, (e - i * 0.1) / 0.7));
      m.scale.y = 0.01 + d * 0.99;
      m.position.y = (m.userData.h * m.scale.y) / 2;
    });
    ctl.update(); renderer.render(scene, cam);
  })(t0);

  return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose();
                 host.querySelector('canvas')?.remove(); };
}

/* ------------------------------------------------------------------
   همبستگی پیرسون
   ------------------------------------------------------------------ */
export function pearson(a, b) {
  const p = a.map((v, i) => [v, b[i]])
             .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = p.length;
  if (n < 3) return null;
  const mx = p.reduce((s, q) => s + q[0], 0) / n;
  const my = p.reduce((s, q) => s + q[1], 0) / n;
  let sxy = 0, sx = 0, sy = 0;
  p.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2; });
  if (!sx || !sy) return null;
  return sxy / Math.sqrt(sx * sy);
}

export function describe(v) {
  const x = v.filter(Number.isFinite);
  if (!x.length) return { n: 0, m: null, sd: null, min: null, max: null };
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  const sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, x.length - 1));
  return { n: x.length, m, sd, min: Math.min(...x), max: Math.max(...x) };
}
