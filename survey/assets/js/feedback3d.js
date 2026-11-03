/* ===================================================================
   بازخورد سه‌بعدی نمره PGSI به شرکت‌کننده
   حلقه‌ای از ۲۷ بخش که تا نمره فرد روشن می‌شود، با هسته درخشان.
   لحن تصویری عمداً آرام است، نه هشداردهنده.
   =================================================================== */
import * as T from './three.module.js';

const BAND_COLOR = {
  none: 0x5fd6a0, low: 0x8ed07a, mod: 0xf0b254, high: 0xff8a8a,
};

export function drawFeedback(host, score, bandKey) {
  const W = () => host.clientWidth, H = () => host.clientHeight;
  const color = new T.Color(BAND_COLOR[bandKey] ?? 0x6ea8ff);

  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(40, W() / H(), 0.1, 100);
  cam.position.set(0, 5.0, 7.6);
  cam.lookAt(0, -0.2, 0);

  scene.add(new T.AmbientLight(0xffffff, 0.45));
  const key = new T.PointLight(color.getHex(), 110, 40);
  key.position.set(0, 2.5, 5); scene.add(key);
  const rim = new T.PointLight(0x4a6fd8, 55, 40);
  rim.position.set(-5, -2, -4); scene.add(rim);

  const group = new T.Group();
  scene.add(group);

  /* ---- حلقه ۲۷ بخشی ---- */
  const SEG = 27, R = 3.1;
  const segs = [];
  for (let i = 0; i < SEG; i++) {
    const on = i < score;
    const a0 = (i / SEG) * Math.PI * 2 - Math.PI / 2;
    const geo = new T.BoxGeometry(0.34, on ? 1.05 : 0.22, 0.34);
    const mat = new T.MeshStandardMaterial({
      color: on ? color : new T.Color(0x2a3450),
      emissive: on ? color : new T.Color(0x000000),
      emissiveIntensity: on ? 0.75 : 0,
      roughness: 0.32, metalness: 0.55,
      transparent: true, opacity: on ? 1 : 0.5,
    });
    const m = new T.Mesh(geo, mat);
    m.position.set(Math.cos(a0) * R, 0, Math.sin(a0) * R);
    m.lookAt(0, 0, 0);
    m.userData = { on, i };
    m.scale.y = 0.01;
    group.add(m); segs.push(m);
  }

  /* ---- هسته ---- */
  const core = new T.Mesh(
    new T.IcosahedronGeometry(0.78, 3),
    new T.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.6,
      roughness: 0.18, metalness: 0.3, transparent: true, opacity: 0.92,
    }));
  group.add(core);

  const halo = new T.Mesh(
    new T.IcosahedronGeometry(1.3, 2),
    new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.075,
                              side: T.BackSide }));
  group.add(halo);

  /* ---- حلقه راهنمای کف ---- */
  const guide = new T.Mesh(
    new T.TorusGeometry(R, 0.012, 8, 128),
    new T.MeshBasicMaterial({ color: 0x5a6a92, transparent: true, opacity: 0.45 }));
  guide.rotation.x = Math.PI / 2;
  guide.position.y = -0.55;
  group.add(guide);

  /* ---- ذرات ---- */
  const N = 420, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 4.2 + Math.random() * 4.2, th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.55;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const pg = new T.BufferGeometry();
  pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const dust = new T.Points(pg, new T.PointsMaterial({
    size: 0.045, color: 0x9fb4e8, transparent: true, opacity: 0.5 }));
  scene.add(dust);

  /* ---- تعامل ---- */
  let drag = false, px = 0, py = 0, ry = 0, rx = 0, auto = true;
  const dom = renderer.domElement;
  const down = e => { drag = true; auto = false;
    px = (e.touches ? e.touches[0] : e).clientX;
    py = (e.touches ? e.touches[0] : e).clientY; };
  const move = e => {
    if (!drag) return;
    const x = (e.touches ? e.touches[0] : e).clientX;
    const y = (e.touches ? e.touches[0] : e).clientY;
    ry += (x - px) * 0.007; rx = Math.max(-0.7, Math.min(0.7, rx + (y - py) * 0.005));
    px = x; py = y;
  };
  const up = () => { drag = false; };
  dom.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);

  /* ---- انیمیشن ---- */
  const t0 = performance.now();
  let raf;
  (function loop(now) {
    raf = requestAnimationFrame(loop);
    const t = (now - t0) / 1000;

    // پر شدن تدریجی بخش‌ها
    segs.forEach((m, i) => {
      const delay = i * 0.055;
      const k = Math.max(0, Math.min(1, (t - 0.35 - delay) / 0.5));
      m.scale.y = 0.01 + k * (1 - 0.01);
      m.position.y = 0;
    });

    const pulse = 1 + Math.sin(t * 1.5) * 0.035;
    core.scale.setScalar(pulse);
    halo.scale.setScalar(pulse * (1 + Math.sin(t * 0.9) * 0.05));
    core.rotation.y += 0.0025; core.rotation.x += 0.0012;

    if (auto) ry += 0.0022;
    group.rotation.y = ry; group.rotation.x = rx;
    dust.rotation.y = -ry * 0.25 + t * 0.012;

    renderer.render(scene, cam);
  })(t0);

  /* ---- بازاندازه ---- */
  const ro = new ResizeObserver(() => {
    if (!W() || !H()) return;
    cam.aspect = W() / H(); cam.updateProjectionMatrix();
    renderer.setSize(W(), H());
  });
  ro.observe(host);

  return () => { cancelAnimationFrame(raf); ro.disconnect();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    renderer.dispose(); host.querySelector('canvas')?.remove(); };
}
