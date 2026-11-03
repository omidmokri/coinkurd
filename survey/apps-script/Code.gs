/**
 * ===================================================================
 *  بک‌اند ذخیره پاسخ‌های پرسشنامه — Google Apps Script
 *
 *  این کد پاسخ‌ها را در یک Google Sheet ذخیره می‌کند.
 *  هیچ IP، ایمیل یا شناسه شخصی ثبت نمی‌شود (Apps Script اصلاً
 *  IP را در اختیار اسکریپت نمی‌گذارد).
 *
 *  راه‌اندازی در ۶ گام — راهنمای کامل در README.md
 * ===================================================================
 */

/* ـــــــــــــــــ ۱) این دو مقدار را تغییر دهید ـــــــــــــــــ */

// رمز داشبورد. این را فقط داخل ویرایشگر Apps Script عوض کنید و مقدار
// واقعی را در مخزن گیت‌هاب ذخیره نکنید: مخزن coinkurd عمومی است و هر
// فایلی در آن از راه entekhab.net قابل خواندن است.
// همین رمز را موقع ورود به صفحه داشبورد تایپ می‌کنید؛ در جایی ذخیره نمی‌شود.
const DASHBOARD_TOKEN = 'CHANGE-ME-1406';

// نام برگه (tab) داخل فایل Sheet
const SHEET_NAME = 'responses';

/* ــــــــــــــــــــــــ تنظیمات ثابت ــــــــــــــــــــــــ */

// ترتیب ستون‌ها — با جدول کدگذاری «بسته پرسشنامه» یکی است
const COLS = [
  'ts', 'dur_sec',
  'screen', 'age', 'gender', 'marital', 'edu', 'job',
  'activity', 'age_onset', 'freq30', 'max_bet', 'help_seek',
  // PGSI
  'pgsi1','pgsi2','pgsi3','pgsi4','pgsi5','pgsi6','pgsi7','pgsi8','pgsi9',
  'pgsi_total','pgsi_band',
  // BEAQ
  'beaq1','beaq2','beaq3','beaq4','beaq5','beaq6','beaq7','beaq8',
  'beaq9','beaq10','beaq11','beaq12','beaq13','beaq14','beaq15',
  'beaq_total','beaq_p1','beaq_p2','beaq_p3',
  // AAQ-II
  'aaq1','aaq2','aaq3','aaq4','aaq5','aaq6','aaq7',
  'aaq_total','aaq_p1','aaq_p2','aaq_p3',
  // DERS
  'ders1','ders2','ders3','ders4','ders5','ders6','ders7','ders8','ders9',
  'ders10','ders11','ders12','ders13','ders14','ders15','ders16','ders17','ders18',
  'ders19','ders20','ders21','ders22','ders23','ders24','ders25','ders26','ders27',
  'ders28','ders29','ders30','ders31','ders32','ders33','ders34','ders35','ders36',
  'ders_nonacc','ders_goals','ders_impulse','ders_aware','ders_strat','ders_clarity',
  'ders_total',
  // کنترل توجه
  'attn1','attn2'
];

/* ــــــــــــــــــــــــ دریافت پاسخ ــــــــــــــــــــــــ */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // بررسی ساده صحت: باید دست‌کم چند کلید اصلی داشته باشد
    if (typeof data !== 'object' || data === null || !data.ts) {
      return json({ ok: false, error: 'bad payload' });
    }

    const sheet = getSheet();
    const row = COLS.map(function (c) {
      const v = data[c];
      return (v === undefined || v === null) ? '' : v;
    });
    sheet.appendRow(row);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ــــــــــــــــــــــــ خواندن برای داشبورد ــــــــــــــــــــــــ */

function doGet(e) {
  try {
    const token = (e && e.parameter && e.parameter.token) || '';
    if (token !== DASHBOARD_TOKEN) {
      return json({ ok: false, error: 'unauthorized' });
    }

    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return json({ ok: true, rows: [] });

    const head = values[0];
    const rows = values.slice(1).map(function (r) {
      const o = {};
      head.forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });

    return json({ ok: true, rows: rows, n: rows.length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ــــــــــــــــــــــــ کمکی‌ها ــــــــــــــــــــــــ */

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(COLS);
    sh.getRange(1, 1, 1, COLS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * برای آزمایش دستی: این تابع را یک بار از منوی Run اجرا کنید
 * تا برگه و سطر عنوان ساخته شود و مجوزها را تأیید کنید.
 */
function setup() {
  const sh = getSheet();
  Logger.log('برگه آماده است: ' + sh.getName() + ' با ' + COLS.length + ' ستون');
}
