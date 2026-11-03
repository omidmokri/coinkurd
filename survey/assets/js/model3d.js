/* ===================================================================
   مدل مفهومی سه‌بعدی پژوهش
   چهار متغیر پنهان و مسیرهای a1, a2, b, c′1, c′2 و همبستگی r
   =================================================================== */
import * as T from './three.module.js';
import { OrbitControls } from './OrbitControls.js';

export const NODES = [
  { id: 'ea', fa: 'اجتناب تجربه‌ای', en: 'BEAQ', role: 'پیش‌بین (برون‌زا)',
    color: 0x6ea8ff, pos: [3.3, 1.7, 0.9],
    desc: 'تمایل‌نداشتن به تماس با تجربه‌های درونی ناخوشایند و کوشش برای تغییر یا گریز از ' +
          'آن‌ها، حتی به بهای آسیب رفتاری. با پرسشنامه کوتاه اجتناب تجربه‌ای (۱۵ گویه) سنجیده می‌شود.' },
  { id: 'pi', fa: 'انعطاف‌ناپذیری روان‌شناختی', en: 'AAQ-II', role: 'پیش‌بین (برون‌زا)',
    color: 0x9d8cff, pos: [3.3, -1.8, -0.9],
    desc: 'غلبه سفت‌وسخت واکنش‌های درونی بر ارزش‌ها در هدایت رفتار. با پرسشنامه پذیرش و ' +
          'عمل ـ نسخه دوم (۷ گویه) سنجیده می‌شود.' },
  { id: 'er', fa: 'تنظیم هیجان', en: 'DERS', role: 'میانجی',
    color: 0xf0b254, pos: [0, 2.0, 0],
    desc: 'توانایی آگاهی، پذیرش و مهار رفتار هنگام هیجان منفی و دسترسی به راهبردهای مؤثر. ' +
          'با مقیاس دشواری در تنظیم هیجان (۳۶ گویه، ۶ خرده‌مقیاس) سنجیده می‌شود؛ ' +
          'نمره بالاتر یعنی تنظیم ضعیف‌تر.' },
  { id: 'gd', fa: 'شدت اختلال قمار', en: 'PGSI', role: 'ملاک (درون‌زا)',
    color: 0x5fd6a0, pos: [-3.4, -0.3, 0],
    desc: 'میزان درگیری مشکل‌ساز در قمار و پیامدهای زیان‌بار آن. با شاخص شدت قمار ' +
          'مشکل‌ساز (۹ گویه، دامنه ۰ تا ۲۷) سنجیده می‌شود.' },
];

const PATHS = [
  { from: 'ea', to: 'er', label: 'a1', bend: 0.55, color: 0x6ea8ff },
  { from: 'pi', to: 'er', label: 'a2', bend: 0.75, color: 0x9d8cff },
  { from: 'er', to: 'gd', label: 'b',  bend: 0.55, color: 0xf0b254 },
  { from: 'ea', to: 'gd', label: "c′1", bend: -0.75, color: 0x6ea8ff },
  { from: 'pi', to: 'gd', label: "c′2", bend: -0.55, color: 0x9d8cff },
];

/* ---------- برچسب متنی روی بوم ---------- */
function label(text, { size = 46, color = '#eef2fb', weight = 700, pad = 18 } = {}) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const font = `${weight} ${size}px Vazirmatn, sans-serif`;
  x.font = font;
  const w = Math.ceil(x.measureText(text).width) + pad * 2;
  const h = size + pad * 2;
  c.width = w * 2; c.height = h * 2; x.scale(2, 2);
  x.font = font;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.85)'; x.shadowBlur = 10;
  x.fillStyle = color;
  x.fillText(text, w / 2, h / 2);
  const tex = new T.CanvasTexture(c);
  tex.minFilter = T.LinearFilter;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true,
                                                 depthWrite: false }));
  sp.scale.set(w / 100, h / 100, 1);
  return sp;
}

export function drawModel(host, onSelect) {
  const W = () => host.clientWidth, H = () => host.clientHeight;

  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x070b16, 0.028);
  const cam = new T.PerspectiveCamera(45, W() / H(), 0.1, 200);
  cam.position.set(0.5, 2.4, 11.5);

  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.enableDamping = true; ctl.dampingFactor = 0.07;
  ctl.minDistance = 6; ctl.maxDistance = 22;
  ctl.autoRotate = true; ctl.autoRotateSpeed = 0.5;
  ctl.target.set(0, 0.1, 0);

  scene.add(new T.AmbientLight(0xffffff, 0.5));
  const l1 = new T.PointLight(0x7aa2ff, 90, 60); l1.position.set(6, 6, 8); scene.add(l1);
  const l2 = new T.PointLight(0xf0b254, 55, 60); l2.position.set(-6, -3, -6); scene.add(l2);

  const byId = {};
  const pickable = [];

  /* ---------- گره‌ها ---------- */
  NODES.forEach(n => {
    const g = new T.Group();
    g.position.set(...n.pos);

    const sphere = new T.Mesh(
      new T.IcosahedronGeometry(0.72, 4),
      new T.MeshStandardMaterial({ color: n.color, emissive: n.color,
        emissiveIntensity: 0.42, roughness: 0.22, metalness: 0.35 }));
    sphere.userData.nodeId = n.id;
    g.add(sphere); pickable.push(sphere);

    const glow = new T.Mesh(
      new T.IcosahedronGeometry(1.18, 2),
      new T.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.09,
                                side: T.BackSide }));
    g.add(glow);

    const ring = new T.Mesh(
      new T.TorusGeometry(1.05, 0.016, 10, 72),
      new T.MeshBasicMaterial({ color: n.color, transparent: true, opacity: 0.5 }));
    ring.rotation.x = Math.PI / 2.1;
    g.add(ring);

    const lab = label(n.fa, { size: 42 });
    lab.position.set(0, 1.42, 0);
    g.add(lab);
    const sub = label(n.en, { size: 30, color: '#8fa3c8', weight: 500 });
    sub.position.set(0, 1.03, 0);
    g.add(sub);

    scene.add(g);
    byId[n.id] = { group: g, sphere, glow, ring, node: n };
  });

  /* ---------- مسیرها ---------- */
  const P = id => new T.Vector3(...NODES.find(n => n.id === id).pos);

  function arrow(from, to, bend, color, text, dashed) {
    const a = P(from), b = P(to);
    const dir = new T.Vector3().subVectors(b, a);
    const len = dir.length();
    const start = a.clone().add(dir.clone().normalize().multiplyScalar(0.8));
    const end = b.clone().sub(dir.clone().normalize().multiplyScalar(1.05));
    const mid = new T.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const up = new T.Vector3(0, 1, 0.35).normalize();
    mid.add(up.multiplyScalar(bend * len * 0.26));
    const curve = new T.QuadraticBezierCurve3(start, mid, end);

    const tube = new T.Mesh(
      new T.TubeGeometry(curve, 48, dashed ? 0.016 : 0.032, 8, false),
      new T.MeshStandardMaterial({ color, emissive: color,
        emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.2,
        transparent: true, opacity: dashed ? 0.4 : 0.85 }));
    scene.add(tube);

    if (!dashed) {
      const tgt = curve.getPointAt(1), prev = curve.getPointAt(0.965);
      const cone = new T.Mesh(
        new T.ConeGeometry(0.12, 0.34, 18),
        new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4,
                                     roughness: 0.35 }));
      cone.position.copy(tgt);
      cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0),
        new T.Vector3().subVectors(tgt, prev).normalize());
      scene.add(cone);
    }

    const lp = curve.getPointAt(0.5).clone().add(new T.Vector3(0, 0.3, 0));
    const lab = label(text, { size: 36, color: '#dbe5ff' });
    lab.position.copy(lp);
    scene.add(lab);
    return { tube, curve };
  }

  const tubes = PATHS.map(p => arrow(p.from, p.to, p.bend, p.color, p.label, false));
  arrow('ea', 'pi', 0, 0x8d9bc4, 'r', true);

  /* ---------- ذرات روی مسیرها ---------- */
  const flow = [];
  tubes.forEach(({ curve }, i) => {
    for (let k = 0; k < 3; k++) {
      const m = new T.Mesh(new T.SphereGeometry(0.055, 10, 10),
        new T.MeshBasicMaterial({ color: PATHS[i].color }));
      m.userData = { curve, t: k / 3 + Math.random() * 0.1, sp: 0.0016 + Math.random() * 0.001 };
      scene.add(m); flow.push(m);
    }
  });

  /* ---------- ستاره‌ها ---------- */
  const N = 700, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 16 + Math.random() * 26, th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const sg = new T.BufferGeometry();
  sg.setAttribute('position', new T.BufferAttribute(pos, 3));
  scene.add(new T.Points(sg, new T.PointsMaterial({ size: 0.09, color: 0x7f92bd,
    transparent: true, opacity: 0.55 })));

  /* ---------- انتخاب گره ---------- */
  const ray = new T.Raycaster(), ptr = new T.Vector2();
  let selected = null;
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0] : e).clientX;
    const cy = (e.touches ? e.touches[0] : e).clientY;
    ptr.x = ((cx - r.left) / r.width) * 2 - 1;
    ptr.y = -((cy - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, cam);
    const hit = ray.intersectObjects(pickable, false)[0];
    if (hit) select(hit.object.userData.nodeId);
  }
  function select(id) {
    selected = id;
    Object.values(byId).forEach(o => {
      const on = o.node.id === id;
      o.sphere.material.emissiveIntensity = on ? 0.95 : 0.42;
      o.glow.material.opacity = on ? 0.22 : 0.09;
      o.ring.material.opacity = on ? 0.95 : 0.5;
    });
    onSelect && onSelect(NODES.find(n => n.id === id));
  }
  renderer.domElement.addEventListener('pointerdown', e => { ctl.autoRotate = false; });
  renderer.domElement.addEventListener('click', pick);

  /* ---------- حلقه ---------- */
  let raf;
  const t0 = performance.now();
  (function loop(now) {
    raf = requestAnimationFrame(loop);
    const t = (now - t0) / 1000;
    Object.values(byId).forEach((o, i) => {
      o.group.position.y = o.node.pos[1] + Math.sin(t * 0.8 + i * 1.4) * 0.09;
      o.ring.rotation.z += 0.004;
      o.sphere.rotation.y += 0.0035;
    });
    flow.forEach(m => {
      m.userData.t = (m.userData.t + m.userData.sp) % 1;
      m.position.copy(m.userData.curve.getPointAt(m.userData.t));
    });
    ctl.update();
    renderer.render(scene, cam);
  })(t0);

  /* دوربین را بر پایه نسبت‌تصویری عقب/جلو می‌برد تا جعبه محتوا (شامل
     برچسب‌های فارسی که پهن‌اند) روی هیچ اندازه‌ای بریده نشود */
  const FIT_W = 6.6, FIT_H = 3.95;
  const applyFit = () => {
    if (!W() || !H()) return;
    const half = (cam.fov * Math.PI / 180) / 2;
    const d = Math.max(FIT_H / Math.tan(half),
                       FIT_W / (Math.tan(half) * (W() / H())));
    const dir = cam.position.clone().sub(ctl.target).normalize();
    cam.position.copy(ctl.target).add(dir.multiplyScalar(d));
    ctl.update();
  };
  applyFit();

  const ro = new ResizeObserver(() => {
    if (!W() || !H()) return;
    cam.aspect = W() / H(); cam.updateProjectionMatrix(); renderer.setSize(W(), H());
    applyFit();
  });
  ro.observe(host);

  return { select, dispose: () => { cancelAnimationFrame(raf); ro.disconnect();
    renderer.dispose(); host.querySelector('canvas')?.remove(); } };
}
