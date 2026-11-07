# دانشنامهٔ سه‌زبانهٔ بازارهای مالی

واژه‌نامه و دانشنامهٔ اصطلاحات مالی، رمزارز، بلاک‌چین و معامله‌گری در سه زبان **انگلیسی، فارسی و کوردی سۆرانی**.
ساخته‌شده برای entekhab.net و کانال Coin_Kurd.

**506 مدخل · ۱۸ دسته · 264 فرمول · 124 منبع (84 نشانی تأییدشده) · ۱۷ ماشین‌حساب**

---

## اجرا

سایت کاملاً ایستا است و به هیچ سرور یا مرحلهٔ بیلدی نیاز ندارد. کافی است پوشه روی GitHub Pages قرار بگیرد:

```
https://<user>.github.io/<repo>/encyclopedia/
```

برای اجرای محلی:

```bash
python3 -m http.server 8777     # سپس http://localhost:8777/
```

## ساختار فایل‌ها

| فایل | کار |
|---|---|
| `index.html` | پوستهٔ برنامهٔ تک‌صفحه‌ای |
| `app.css` | تمام استایل‌ها، تم روشن و تیره، پشتیبانی RTL |
| `app.js` | مسیریاب، موتور جستجو، صفحهٔ مدخل، ۱۷ ماشین‌حساب، آکادمی، نقشهٔ مفاهیم، داشبورد ویرایشی |
| `index.json` | نمایهٔ سبک (۶۸۴ کیلوبایت) — اول بارگذاری می‌شود و جستجو روی آن کار می‌کند |
| `terms/01.json` … `terms/18.json` | متن کامل مدخل‌ها، شارد‌شده بر حسب دسته — فقط شارد دستهٔ مدخلِ بازشده (حدود نیم مگابایت) دانلود می‌شود، نه کل ۸ مگابایت |
| `meta.json` | دسته‌ها، وضعیت‌های اصطلاح‌شناسی، فرهنگ واژگان، فهرست منابع |
| `t/{en,fa,ckb}/*.html` | ۱٬۵۱۸ صفحهٔ ایستا، یکی برای هر مدخل در هر زبان — برای موتورهای جستجو |
| `sitemap.xml` | نقشهٔ سایت با hreflang برای هر سه زبان |

## افزودن یا اصلاح یک مدخل

۱. مدخل را در `../data/chunks/` ویرایش یا اضافه کنید (طرح‌وارهٔ کامل در `../standards/EDITORIAL_STANDARD.md`).
۲. اعتبارسنجی:

```bash
python3 tests/validate.py        # طرح‌واره، ارجاع‌های متقابل، منابع، LaTeX، محدودیت طول
```

۳. بازسازی دادهٔ سایت و صفحه‌های ایستا:

```bash
python3 build.py site
cp data/index.json data/terms.json data/meta.json site/
```

۴. آزمون‌ها:

```bash
node tests/calc.test.js          # ۷۷ گزارهٔ ریاضی ماشین‌حساب‌ها
node tests/browser.test.js       # مرورگر واقعی: RTL، جستجو، سرریز افقی، تم تیره
node tests/static.test.js        # صفحه‌های ایستا، hreflang، JSON-LD، لینک‌های شکسته
```

اعتبارسنج اجازه نمی‌دهد مدخلی با منبع ناشناخته، ارجاع متقابل بی‌مقصد، یا وضعیت `published` وارد شود.

## سه قاعده‌ای که این پروژه را از یک واژه‌نامهٔ معمولی جدا می‌کند

**۱. فهرست بستهٔ منابع.** هر مدخل فقط می‌تواند از `sources.json` نقل کند. هیچ نشانی ساختگی وجود ندارد؛ ۴۸ نشانی واقعاً بازیابی شده‌اند و ۱۶ منبع چاپی بدون نشانی ثبت شده‌اند.

**۲. صداقت دربارهٔ کوردی.** اصطلاح‌شناسی مالی کوردی سۆرانی برای بسیاری از مفاهیم تثبیت‌شده نیست. 325 معادل در این دانشنامه **پیشنهادی** علامت خورده‌اند — ساختهٔ همین پروژه، نه استاندارد — و اصطلاح انگلیسی همیشه کنارشان حفظ شده است.

**۳. هیچ مدخلی منتشرشده نیست.** چهار مرحلهٔ بازبینی (زبانی، مالی، بین‌زبانی، منابع) برای هر 506 مدخل روی مقدار `model-drafted` است. هیچ متخصص انسانی هنوز امضا نکرده، پس هیچ مدخلی `published` علامت نخورده است. داشبورد «کنترل کیفیت» این را صریح نشان می‌دهد.

## آنچه هنوز انجام نشده

- بازبینی زبانی توسط گویشور بومی کوردی سۆرانی و فارسی
- بازبینی مالی توسط متخصص موضوعی
- تأیید دوبارهٔ منابع و افزودن شمارهٔ صفحه برای منابع چاپی
- فاز ۲ کامل شد (۵۰۶ مدخل). فاز بعدی در صورت تمایل: ۱٬۵۰۰ مدخل — ولی سقف واقعیِ پوشش عمیق و منبع‌دار در این حوزه حدود ۳٬۰۰۰ تا ۵٬۰۰۰ اصطلاح است، نه بیشتر.

## نکته دربارهٔ روش مهندس امید دباغچی مکری

سه مدخل (`body-v`، `pivot-trendline`، `body-break`) روش اختصاصی نگارنده را مستند می‌کنند و با وضعیت `author-framework` علامت خورده‌اند: اجماع علمی نیستند و به‌صورت مستقل اعتبارسنجی نشده‌اند. فرمول‌بندی ریاضی بادی وی توسط همین پروژه از متن آموزشی نگارنده استخراج شده و پیش از قطعی شدن باید توسط خود او تأیید شود.

---

## English summary

A trilingual (English / Persian / Kurdish Sorani) encyclopedia of financial-market, cryptocurrency and trading terminology. 506 entries, each written natively in three languages at four depths, with the mechanism, worked numeric examples, the formula where one exists, cited sources from a closed registry, and an explicit editorial review state. Static site, no build step, no tracking. 17 financial calculators with unit-tested maths. 1,518 indexable static term pages with hreflang. Entry text is sharded by category and loaded on demand.

Nothing here is investment advice. Nothing is marked published, because no human expert has reviewed it yet.

**License:** content CC BY-NC-SA 4.0 · code MIT
