/* ===================================================================
   موتور پرسشنامه
   =================================================================== */
import { CONFIG, HELP } from './config.js';
import { SCREEN, DEMO, SCALES } from './items.js';
import { computeAll, band, fa } from './scoring.js';
import { saveDraft, loadDraft, clearDraft, submit, isLive,
         localRows, toCSV, download } from './storage.js';
import { drawFeedback } from './feedback3d.js';

const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t);
  if (c) n.className = c; if (h !== undefined) n.innerHTML = h; return n; };

const state = { answers: {}, step: 0, t0: Date.now(), done: false };
let steps = [];

/* ---------------------------- ساخت مراحل ---------------------------- */
function buildSteps() {
  const s = [{ kind: 'consent' }, { kind: 'screen' }, { kind: 'demo' }];
  for (const sc of SCALES) {
    // جریان گویه‌ها شامل سؤال کنترل توجه
    const flow = sc.items.map((text, i) => ({ id: `${sc.id}${i + 1}`, text, n: i + 1 }));
    if (sc.attention) {
      flow.splice(sc.attention.after, 0,
        { id: sc.attention.id, text: sc.attention.text, attn: true });
    }
    const size = sc.chunk || flow.length;
    for (let i = 0; i < flow.length; i += size) {
      s.push({ kind: 'scale', scale: sc, items: flow.slice(i, i + size),
               part: Math.floor(i / size) + 1,
               parts: Math.ceil(flow.length / size) });
    }
  }
  s.push({ kind: 'submit' });
  return s;
}

/* ---------------------------- کمک‌ها ---------------------------- */
function toast(msg, err) {
  let t = $('.toast');
  if (!t) { t = el('div', 'toast'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.toggle('err', !!err);
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 3600);
}

function optionRow(qid, anchors, grid) {
  const box = el('div', 'opts' + (grid ? ' grid' : ''));
  anchors.forEach(a => {
    const lab = el('label', 'opt');
    lab.innerHTML =
      `<input type="radio" name="${qid}" value="${a.value}">` +
      `<span>${a.label}${a.sub ? `<span class="k">${a.sub}</span>` : ''}</span>`;
    const input = lab.querySelector('input');
    if (state.answers[qid] === a.value) { lab.classList.add('sel'); input.checked = true; }
    input.addEventListener('change', () => {
      state.answers[qid] = a.value;
      box.querySelectorAll('.opt').forEach(o => o.classList.remove('sel'));
      lab.classList.add('sel');
      lab.closest('.q')?.classList.add('answered');
      lab.closest('.q')?.classList.remove('missing');
      saveDraft(state);
      updateBar();
    });
    box.appendChild(lab);
  });
  return box;
}

function qBlock(num, text, qid, anchors, grid) {
  const q = el('div', 'q');
  q.dataset.qid = qid;
  if (state.answers[qid] !== undefined) q.classList.add('answered');
  const head = el('div', 'q-head');
  head.appendChild(el('div', 'q-num', num === null ? '◆' : fa(num)));
  head.appendChild(el('div', 'q-text', text));
  q.appendChild(head);
  q.appendChild(optionRow(qid, anchors, grid));
  return q;
}

/* ---------------------------- نمایش مراحل ---------------------------- */
function render() {
  const root = $('#app');
  root.innerHTML = '';
  const st = steps[state.step];
  const box = el('div', 'step');

  if (st.kind === 'consent') renderConsent(box);
  else if (st.kind === 'screen') renderScreen(box);
  else if (st.kind === 'demo') renderDemo(box);
  else if (st.kind === 'scale') renderScale(box, st);
  else if (st.kind === 'submit') renderSubmit(box);

  root.appendChild(box);
  updateBar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nav(backLabel, nextLabel, onNext, canBack = true) {
  const row = el('div', 'btn-row');
  if (canBack && state.step > 0) {
    const b = el('button', 'btn btn-ghost', backLabel || 'مرحله قبل');
    b.onclick = () => { state.step--; render(); };
    row.appendChild(b);
  }
  const n = el('button', 'btn btn-primary', nextLabel || 'ادامه');
  n.onclick = onNext;
  row.appendChild(n);
  return row;
}

/* ---------- ۱) رضایت آگاهانه ---------- */
function renderConsent(box) {
  box.appendChild(el('div', 'eyebrow', 'پژوهش دانشگاهی · بی‌نام'));
  box.appendChild(el('h1', '', 'دعوت به شرکت در یک پژوهش دانشگاهی درباره شرط‌بندی و بازی‌های آنلاین'));
  const c = el('div', 'card');
  c.innerHTML = `
    <p>شرکت‌کننده گرامی، سلام.</p>
    <p>من <strong>${CONFIG.RESEARCHER}</strong>، دانشجوی کارشناسی ارشد روان‌شناسی بالینی
    ${CONFIG.UNIVERSITY} هستم و این پژوهش را زیر نظر استاد راهنما،
    <strong>${CONFIG.SUPERVISOR}</strong>، انجام می‌دهم. هدف این پژوهش، شناخت عوامل
    روان‌شناختی مرتبط با شرط‌بندی و بازی‌های شانسی آنلاین است. نتایج می‌تواند به طراحی
    خدمات پیشگیری و کمک بهتر به افرادی که به دلیل این فعالیت‌ها دچار مشکل می‌شوند کمک کند.</p>
    <h3>چه کسانی می‌توانند شرکت کنند؟</h3>
    <p>افراد ۱۸ سال و بالاتر ساکن ایران که در ۱۲ ماه گذشته دست‌کم یک بار شرط‌بندی یا بازی
    شانسی آنلاین انجام داده‌اند.</p>
    <h3>شرکت چگونه است؟</h3>
    <p>پاسخ به چند پرسشنامه کوتاه، در مجموع حدود ۱۵ تا ۲۰ دقیقه. پاسخ درست یا غلطی وجود
    ندارد؛ لطفاً صادقانه و بر پایه تجربه واقعی خود پاسخ دهید.</p>
    <h3>گمنامی و محرمانگی</h3>
    <p>این پرسشنامه کاملاً بی‌نام است. هیچ نام، شماره تلفن، ایمیل، شهر دقیق یا نشانی
    اینترنتی (IP) از شما ثبت نمی‌شود و هیچ راهی برای پیوند دادن پاسخ‌ها به هویت شما وجود
    ندارد. داده‌ها تنها به‌صورت آماری و گروهی در گزارش‌های علمی منتشر می‌شود.</p>
    <h3>داوطلبانه بودن</h3>
    <p>شرکت کاملاً اختیاری است. می‌توانید در هر مرحله، بدون هیچ پیامدی، صفحه را ببندید و
    منصرف شوید.</p>
    <h3>مزایا و خطرها</h3>
    <p>شرکت هیچ هزینه یا خطر مستقیمی ندارد. برخی پرسش‌ها درباره هیجان‌ها و تجربه‌های شما
    هستند و ممکن است شما را به فکر فرو ببرند؛ در پایان، منابع کمک رایگان و محرمانه معرفی
    شده است. هیچ پرداخت یا جایزه‌ای در نظر گرفته نشده است.</p>
    <p class="muted">پرسش‌ها: ${CONFIG.RESEARCHER_EMAIL} —
    این پژوهش با کد اخلاق ${CONFIG.ETHICS_CODE} در کمیته اخلاق در پژوهش
    دانشگاه آزاد اسلامی تصویب شده است.</p>`;
  box.appendChild(c);

  const lab = el('label', 'consent');
  lab.innerHTML = `<input type="checkbox">
    <span class="tick"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5 5L20 7"
      stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    <span>متن بالا را خوانده‌ام، ۱۸ سال یا بیشتر دارم و با آگاهی کامل و به‌طور داوطلبانه
    در این پژوهش شرکت می‌کنم.</span>`;
  const cb = lab.querySelector('input');
  cb.checked = !!state.answers.consent;
  lab.classList.toggle('on', !!state.answers.consent);
  cb.onchange = () => {
    state.answers.consent = cb.checked ? 1 : 0;
    lab.classList.toggle('on', cb.checked);
    saveDraft(state);
  };
  box.appendChild(lab);

  box.appendChild(nav(null, 'موافقم، شروع می‌کنم', () => {
    if (!state.answers.consent) return toast('برای ادامه باید رضایت خود را تأیید کنید.', true);
    state.step++; render();
  }, false));
}

/* ---------- ۲) غربالگری ---------- */
function renderScreen(box) {
  box.appendChild(el('h1', '', 'یک پرسش پیش از شروع'));
  const c = el('div', 'card');
  c.appendChild(qBlock(null, SCREEN.text, 'screen', SCREEN.options, false));
  box.appendChild(c);
  box.appendChild(nav(null, 'ادامه', () => {
    if (state.answers.screen === undefined) return toast('لطفاً به این پرسش پاسخ دهید.', true);
    if (state.answers.screen === 0) return renderExcluded();
    state.step++; render();
  }));
}

function renderExcluded() {
  $('#app').innerHTML = '';
  const b = el('div', 'step');
  b.innerHTML = `<h1>از توجه شما سپاسگزاریم</h1>
    <div class="card card-ok"><p>این پژوهش ویژه افرادی است که در ۱۲ ماه گذشته تجربه
    شرط‌بندی یا بازی شانسی آنلاین داشته‌اند. وقتی که گذاشتید ارزشمند بود.</p></div>`;
  $('#app').appendChild(b);
  $('.progress-shell')?.remove();
  clearDraft();
}

/* ---------- ۳) جمعیت‌شناختی ---------- */
function renderDemo(box) {
  box.appendChild(el('h1', '', 'چند پرسش کوتاه درباره شما'));
  box.appendChild(el('p', 'lead', 'این اطلاعات فقط برای توصیف گروه شرکت‌کنندگان به کار می‌رود.'));
  const c = el('div', 'card');
  DEMO.forEach((d, i) => {
    if (d.type === 'choice') {
      c.appendChild(qBlock(i + 1, d.text, d.id, d.options, d.options.length > 3));
    } else {
      const q = el('div', 'q');
      q.dataset.qid = d.id;
      if (state.answers[d.id] !== undefined) q.classList.add('answered');
      const head = el('div', 'q-head');
      head.appendChild(el('div', 'q-num', fa(i + 1)));
      head.appendChild(el('div', 'q-text', d.text));
      q.appendChild(head);
      const inp = el('input', 'field');
      inp.type = 'number'; inp.min = d.min; inp.max = d.max; inp.inputMode = 'numeric';
      inp.placeholder = d.unit || '';
      if (state.answers[d.id] !== undefined) inp.value = state.answers[d.id];
      inp.oninput = () => {
        const v = parseInt(inp.value, 10);
        if (!isNaN(v)) { state.answers[d.id] = v; q.classList.add('answered');
                         q.classList.remove('missing'); }
        else delete state.answers[d.id];
        saveDraft(state); updateBar();
      };
      q.appendChild(inp);
      c.appendChild(q);
    }
  });
  box.appendChild(c);
  box.appendChild(nav(null, 'ادامه', () => {
    const miss = DEMO.filter(d => state.answers[d.id] === undefined);
    if (miss.length) return flagMissing(miss.map(d => d.id));
    const age = state.answers.age;
    if (age < 18) { toast('شرکت در این پژوهش تنها برای افراد ۱۸ سال و بالاتر ممکن است.', true);
                    return renderExcluded(); }
    state.step++; render();
  }));
}

/* ---------- ۴) مقیاس‌ها ---------- */
function renderScale(box, st) {
  const sc = st.scale;
  const title = sc.parts > 1 || st.parts > 1
    ? `${sc.title} — بخش ${fa(st.part)} از ${fa(st.parts)}` : sc.title;
  box.appendChild(el('div', 'eyebrow', title));
  const c = el('div', 'card');
  c.appendChild(el('p', 'lead', sc.instruction));
  c.appendChild(el('hr', 'sep'));
  st.items.forEach(it => {
    c.appendChild(qBlock(it.attn ? null : it.n, it.text, it.id, sc.anchors, sc.grid));
  });
  box.appendChild(c);
  box.appendChild(nav(null, state.step === steps.length - 2 ? 'پایان پرسشنامه' : 'ادامه', () => {
    const miss = st.items.filter(i => state.answers[i.id] === undefined).map(i => i.id);
    if (miss.length) return flagMissing(miss);
    state.step++; render();
  }));
}

function flagMissing(ids) {
  toast(`${fa(ids.length)} پرسش بی‌پاسخ مانده است.`, true);
  ids.forEach(id => document.querySelector(`.q[data-qid="${id}"]`)?.classList.add('missing'));
  const first = document.querySelector(`.q[data-qid="${ids[0]}"]`);
  first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- ۵) ارسال ---------- */
function renderSubmit(box) {
  box.appendChild(el('h1', '', 'تقریباً تمام شد'));
  const c = el('div', 'card');
  c.innerHTML = `<p>با انتخاب دکمه زیر، پاسخ‌های شما به‌صورت <strong>بی‌نام</strong> ثبت
    می‌شود. پس از ثبت، امکان بازگشت و ویرایش وجود ندارد.</p>`;
  box.appendChild(c);
  const btn = el('button', 'btn btn-primary btn-lg', 'ثبت پاسخ‌ها');
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'در حال ثبت…';
    const dur = Math.round((Date.now() - state.t0) / 1000);
    const row = { ts: new Date().toISOString(), dur_sec: dur,
                  ...state.answers, ...computeAll(state.answers) };
    delete row.consent;
    try {
      const r = await submit(row);
      state.done = true; clearDraft();
      renderThanks(row, r.mode);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'تلاش دوباره';
      toast('ثبت ناموفق بود. اتصال اینترنت را بررسی و دوباره تلاش کنید.', true);
      console.error(e);
    }
  };
  const row = el('div', 'btn-row');
  const back = el('button', 'btn btn-ghost', 'بازگشت');
  back.onclick = () => { state.step--; render(); };
  row.appendChild(back); row.appendChild(btn);
  box.appendChild(row);
}

/* ---------- ۶) صفحه پایانی + بازخورد سه‌بعدی ---------- */
function renderThanks(row, mode) {
  $('.progress-shell')?.remove();
  const root = $('#app'); root.innerHTML = '';
  const b = el('div', 'step');

  b.appendChild(el('h1', '', 'سپاسگزارم'));
  b.appendChild(el('p', 'lead',
    'پاسخ‌های شما کاملاً بی‌نام ذخیره شد. وقتی که گذاشتید به این پژوهش کمک واقعی می‌کند.'));

  if (mode === 'local') {
    const w = el('div', 'card card-amber');
    w.innerHTML = `<p style="margin:0"><strong>حالت آزمایشی.</strong> نشانی Apps Script
      هنوز در <code>config.js</code> تنظیم نشده است، بنابراین این پاسخ فقط در همین مرورگر
      ذخیره شد و به شیت ارسال نشد.</p>`;
    b.appendChild(w);
  }

  if (CONFIG.SHOW_FEEDBACK && row.pgsi_total !== null) {
    const bd = band(row.pgsi_total);
    b.appendChild(el('h2', '', 'نمره شما'));
    const stage = el('div', 'stage');
    stage.style.height = 'min(60vh,440px)';
    stage.innerHTML = '<div class="hint">برای چرخاندن، بکشید</div>';
    b.appendChild(stage);
    const n = el('div', 'card');
    n.innerHTML = `<div style="font-size:34px;font-weight:700;line-height:1.4">
      ${fa(row.pgsi_total)} <span style="font-size:17px;color:var(--ink-3)">از ۲۷</span></div>
      <div style="font-size:18px;font-weight:700;margin:6px 0 10px">${bd.label}</div>
      <p style="margin:0">${bd.note}</p>`;
    b.appendChild(n);
    setTimeout(() => drawFeedback(stage, row.pgsi_total, bd.key), 60);
  }

  b.appendChild(el('h2', '', 'اگر شرط‌بندی برایتان مشکل‌ساز شده است'));
  b.appendChild(el('p', '',
    'بدانید که تنها نیستید و کمک گرفتن نشانه قدرت است. منابع زیر رایگان و محرمانه هستند:'));
  const hc = el('div', 'card');
  HELP.forEach(h => {
    const r = el('div', '');
    r.style.cssText = 'display:flex;gap:14px;align-items:baseline;padding:11px 0;' +
      'border-bottom:1px solid var(--line)';
    r.innerHTML = `<b style="font-size:20px;color:var(--gd);min-width:58px;
      font-variant-numeric:tabular-nums">${h.n}</b>
      <span><strong>${h.t}</strong>${h.d ? `<br><span class="muted">${h.d}</span>` : ''}</span>`;
    hc.appendChild(r);
  });
  hc.lastChild.style.borderBottom = 'none';
  b.appendChild(hc);
  b.appendChild(el('p', 'muted',
    `در صورت تمایل می‌توانید از طریق ${CONFIG.RESEARCHER_EMAIL} با پژوهشگر در ارتباط باشید.`));

  root.appendChild(b);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------------------- نوار پیشرفت ---------------------------- */
function totalQ() {
  let n = 1 + 1 + DEMO.length;
  SCALES.forEach(s => { n += s.items.length + (s.attention ? 1 : 0); });
  return n;
}
function answeredQ() {
  return Object.keys(state.answers).filter(k => state.answers[k] !== undefined).length;
}
function updateBar() {
  const bar = $('.bar i'), pct = $('.progress-shell .pct');
  if (!bar) return;
  const p = Math.min(100, Math.round(answeredQ() / totalQ() * 100));
  bar.style.width = p + '%';
  if (pct) pct.textContent = `${fa(p)}٪ — مرحله ${fa(state.step + 1)} از ${fa(steps.length)}`;
}

/* ---------------------------- راه‌اندازی ---------------------------- */
export function start() {
  steps = buildSteps();
  const d = loadDraft();
  if (d && d.answers && Object.keys(d.answers).length > 2 && !d.done) {
    if (confirm('پاسخ‌های نیمه‌تمام شما پیدا شد. ادامه می‌دهید؟')) {
      state.answers = d.answers; state.step = d.step || 0;
    } else clearDraft();
  }
  render();

  // ابزار پژوهشگر در حالت آزمایشی
  if (!isLive()) {
    const t = el('div', '');
    t.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:60;opacity:.45';
    const b = el('button', 'btn btn-ghost', 'خروجی CSV آزمایشی');
    b.style.cssText = 'font-size:12px;padding:8px 13px;min-height:auto;width:auto';
    t.onmouseenter = () => t.style.opacity = '1';
    t.onmouseleave = () => t.style.opacity = '.45';
    b.onclick = () => {
      const rows = localRows();
      if (!rows.length) return toast('هنوز پاسخ آزمایشی ثبت نشده است.', true);
      download('test-responses.csv', toCSV(rows));
    };
    t.appendChild(b); document.body.appendChild(t);
  }
}
