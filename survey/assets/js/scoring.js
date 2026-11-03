/* ===================================================================
   نمره‌گذاری — هماهنگ با پیوست پ پایان‌نامه و نحو lavaan پیوست ث
   =================================================================== */
import { SCALES, DERS_SUB, PGSI_BANDS } from './items.js';

const scaleOf = id => SCALES.find(s => s.id === id);

/** معکوس‌سازی یک گویه: min+max-x */
function rev(x, anchors) {
  const vs = anchors.map(a => a.value);
  return Math.min(...vs) + Math.max(...vs) - x;
}

/** آرایه نمره‌های یک مقیاس پس از اعمال معکوس‌سازی (ایندکس ۱-پایه) */
export function scored(id, answers) {
  const s = scaleOf(id);
  const out = {};
  s.items.forEach((_, i) => {
    const n = i + 1;
    const raw = answers[`${id}${n}`];
    if (raw === undefined || raw === null) return;
    out[n] = s.reverse.includes(n) ? rev(raw, s.anchors) : raw;
  });
  return out;
}

const sum = (o, keys) => keys.reduce((a, k) => a + (o[k] ?? 0), 0);
const complete = (id, answers) => {
  const s = scaleOf(id);
  return s.items.every((_, i) => answers[`${id}${i + 1}`] !== undefined);
};

/** بسته‌بندی گویه‌ها: n بسته با توزیع متوالی چرخشی */
function parcels(o, count, n) {
  const p = Array.from({ length: n }, () => []);
  for (let i = 1; i <= count; i++) p[(i - 1) % n].push(o[i] ?? 0);
  return p.map(a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : null);
}

export function computeAll(answers) {
  const r = {};

  /* --- PGSI --- */
  const p = scored('pgsi', answers);
  r.pgsi_total = complete('pgsi', answers) ? sum(p, Object.keys(p).map(Number)) : null;
  r.pgsi_band = r.pgsi_total === null ? null : band(r.pgsi_total).key;

  /* --- BEAQ --- */
  const b = scored('beaq', answers);
  r.beaq_total = complete('beaq', answers) ? sum(b, Object.keys(b).map(Number)) : null;
  const bp = parcels(b, 15, 3);
  r.beaq_p1 = bp[0]; r.beaq_p2 = bp[1]; r.beaq_p3 = bp[2];

  /* --- AAQ-II --- */
  const a = scored('aaq', answers);
  r.aaq_total = complete('aaq', answers) ? sum(a, Object.keys(a).map(Number)) : null;
  const ap = parcels(a, 7, 3);
  r.aaq_p1 = ap[0]; r.aaq_p2 = ap[1]; r.aaq_p3 = ap[2];

  /* --- DERS --- */
  const d = scored('ders', answers);
  for (const [k, items] of Object.entries(DERS_SUB)) r[k] = sum(d, items);
  r.ders_total = complete('ders', answers)
    ? Object.keys(DERS_SUB).reduce((x, k) => x + r[k], 0) : null;

  /* --- کنترل توجه --- */
  r.attn1 = answers.attn1 === undefined ? null : (answers.attn1 === 6 ? 1 : 0);
  r.attn2 = answers.attn2 === undefined ? null : (answers.attn2 === 1 ? 1 : 0);

  return r;
}

export function band(total) {
  return PGSI_BANDS.find(b => total <= b.max) ?? PGSI_BANDS[PGSI_BANDS.length - 1];
}

/** دامنه نظری هر مقیاس — برای نرمال‌سازی نمایش */
export const RANGE = {
  pgsi: [0, 27], beaq: [15, 90], aaq: [7, 49], ders: [36, 180],
};

/** عدد فارسی */
export const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
