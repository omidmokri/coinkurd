/* ===================================================================
   ذخیره‌سازی پاسخ‌ها
   اگر CONFIG.APPS_SCRIPT_URL پر باشد → ارسال به Google Sheet
   اگر خالی باشد → حالت آزمایشی: ذخیره در مرورگر + خروجی CSV
   در هیچ حالتی IP، ایمیل یا شناسه شخصی ثبت نمی‌شود.
   =================================================================== */
import { CONFIG } from './config.js';

const LS_DRAFT = 'q_draft_v1';
const LS_LOCAL = 'q_local_rows_v1';

export const isLive = () => !!CONFIG.APPS_SCRIPT_URL;

/* ---------------------------- پیش‌نویس ---------------------------- */
export function saveDraft(state) {
  if (!CONFIG.SAVE_DRAFT) return;
  try { localStorage.setItem(LS_DRAFT, JSON.stringify(state)); } catch (_) {}
}
export function loadDraft() {
  if (!CONFIG.SAVE_DRAFT) return null;
  try { return JSON.parse(localStorage.getItem(LS_DRAFT) || 'null'); } catch (_) { return null; }
}
export function clearDraft() {
  try { localStorage.removeItem(LS_DRAFT); } catch (_) {}
}

/* ---------------------------- ارسال ---------------------------- */
export async function submit(row) {
  if (!isLive()) {
    const rows = localRows();
    rows.push(row);
    try { localStorage.setItem(LS_LOCAL, JSON.stringify(rows)); } catch (_) {}
    return { ok: true, mode: 'local' };
  }
  // text/plain از preflight جلوگیری می‌کند؛ Apps Script بدنه را به‌صورت متن می‌خواند
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(row),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const out = await res.json().catch(() => ({ ok: true }));
  if (out && out.ok === false) throw new Error(out.error || 'رد شد');
  return { ok: true, mode: 'live' };
}

/* ------------------------ حالت آزمایشی ------------------------ */
export function localRows() {
  try { return JSON.parse(localStorage.getItem(LS_LOCAL) || '[]'); } catch (_) { return []; }
}
export function clearLocal() {
  try { localStorage.removeItem(LS_LOCAL); } catch (_) {}
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap(Object.keys))];
  const esc = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))]
    .join('\n');
}

export function download(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ------------------------ خواندن برای داشبورد ------------------------ */
export async function fetchRows(token) {
  if (!isLive()) return localRows();
  const u = new URL(CONFIG.APPS_SCRIPT_URL);
  u.searchParams.set('token', token);
  const res = await fetch(u.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || 'دسترسی رد شد');
  return out.rows || [];
}
