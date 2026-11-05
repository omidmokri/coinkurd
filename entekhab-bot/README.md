<p align="center">
  <img src="branding/entekhab-logo.webp" alt="entekhab.net" width="180">
</p>

<h1 align="center">ربات معامله‌گر انتخاب</h1>
<p align="center">
  <b>Entekhab trading bot</b> · <b>بۆتی بازرگانیی ئەنتخاب</b><br>
  توزیع فارسی/کوردی <a href="https://www.freqtrade.io/">Freqtrade</a> — خودمیزبان، متن‌باز، GPL-3.0
</p>

---

## این چیست و چه چیزی نیست

**هست:** یک بستهٔ آماده که موتور متن‌باز Freqtrade را با پیکربندی محافظه‌کارانه، ۴۶۵
استراتژی جامعه و مستندات فارسی/کوردی/انگلیسی روی سرور **خودتان** بالا می‌آورد.

**نیست:**

- موتور معاملاتی تازه‌ای نیست. موتور همان Freqtrade است و از ایمیج رسمی گرفته می‌شود
  (جزئیات و انتساب کامل در [`NOTICE.md`](NOTICE.md)).
- سرویس میزبانی‌شده نیست. انتخاب حساب، کلید یا پول شما را نمی‌بیند. هر کس روی سرور خودش
  اجرا می‌کند و کلید API پیش خودش می‌ماند.
- مشاورهٔ مالی یا سیگنال نیست و سودی وعده نمی‌دهد.

## شروع سریع

```bash
git clone https://github.com/omidmokri/coinkurd.git
cd coinkurd/entekhab-bot
./install.sh
```

یا بدون گیت: پوشهٔ `entekhab-bot/` را از
[entekhab.net/trade-bot](https://entekhab.net/trade-bot/) دانلود کنید.

پیش‌نیاز: Docker و Docker Compose v2. راهنمای گام‌به‌گام:
[`docs/01-quickstart.fa.md`](docs/01-quickstart.fa.md)

## پیش‌فرض‌هایی که عمداً محافظه‌کارانه‌اند

| تنظیم | مقدار | چرا |
|---|---|---|
| `dry_run` | `true` | ربات تا وقتی خودتان این را `false` نکنید با پول واقعی معامله نمی‌کند |
| `api_server.enabled` | `false` | REST API می‌تواند پول جابه‌جا کند؛ پیش‌فرض خاموش و فقط روی `127.0.0.1` |
| `force_entry_enable` | `false` | ورود دستی اجباری خاموش |
| `cancel_open_orders_on_exit` | `true` | هنگام خاموش کردن، سفارش‌های باز لغو می‌شوند |
| فهرست سیاه | توکن‌های اهرمی (`3L/3S/UP/DOWN/BULL/BEAR`) | رفتارشان با استراتژی‌های اسپات جور نیست |
| فیلترها | `AgeFilter`, `SpreadFilter`, `VolatilityFilter`, `RangeStabilityFilter` | حذف جفت‌ارزهای تازه، کم‌عمق و بیش‌ازحد پرنوسان |

محافظ‌ها (`StoplossGuard`, `MaxDrawdown`, `LowProfitPairs`, `CooldownPeriod`) در
[`config/protections.strategy-snippet.json`](config/protections.strategy-snippet.json) آمده‌اند.
در Freqtrade امروزی محافظ‌ها باید **داخل کلاس استراتژی** باشند، نه در کانفیگ؛ روش
گذاشتنشان در [`docs/03-strategies.fa.md`](docs/03-strategies.fa.md) است.

## ۴۶۵ استراتژی — با برچسب صادقانه

همهٔ استراتژی‌های مخزن متن‌باز
[davidzr/freqtrade-strategies](https://github.com/davidzr/freqtrade-strategies)
بدون هیچ تغییری در بستهٔ `user_data/strategies/community-strategies.zip` هستند (۲٫۲ مگابایت،
اثر انگشت SHA-256 در `community-strategies.json`). `install.sh` بسته را در
`user_data/strategies/community/` باز می‌کند. فهرست ماشین‌خوان هر ۴۶۵ تا با فرادادهٔ کامل در
[`strategies-index.json`](strategies-index.json) است و مرورگر آن در
[entekhab.net/trade-bot](https://entekhab.net/trade-bot/).

چیزهایی که باید قبل از استفاده بدانید — همه با بررسی خودکار همین فایل‌ها به دست آمده،
نه از روی ادعای کسی:

- **۴۶۲ از ۴۶۵** هنوز رابط **نسخهٔ ۲** Freqtrade را دارند
  (`populate_buy_trend` / `populate_sell_trend`). روی Freqtrade امروزی **بدون تبدیل اجرا
  نمی‌شوند**. دستور رسمی تبدیل:
  `docker compose run --rm entekhab-bot strategy-updater --strategy-list <Name>`
  (نسخهٔ اصلی در `user_data/strategies_orig_updater/` می‌ماند.)
- **۲۳۹ از ۴۶۵** پارامترهای hyperopt را به‌صورت ثابت در فایل دارند — یعنی روی یک دورهٔ
  مشخص از گذشته بهینه شده‌اند. این کلاسیک‌ترین شکل **بیش‌برازش (overfitting)** است.
- مخزن مبدأ **بایگانی شده** و از **فوریهٔ ۲۰۲۴** به‌روزرسانی نشده.
- فقط **۹۷ تا** محافظ (`protections`) تعریف کرده‌اند؛ بقیه هیچ ترمز خودکاری ندارند.
- **۴ استراتژی** در بررسی ایستای ما نشانهٔ **نگاه‌به‌آینده** دارند (`BB_RPB_TSL_SMA_Tranz_TB_1_1_1`,
  `custom`, `Ichi`, `LookaheadStrategy`). این بررسی کامل نیست و جای `freqtrade lookahead-analysis`
  را نمی‌گیرد؛ آن را روی هر استراتژی‌ای که می‌خواهید اجرا کنید بگیرید.
- هیچ عدد عملکردی (سود، وین‌ریت، رتبه) در این مخزن نیست و ما هم نساخته‌ایم. اگر جایی
  رتبه‌بندی دیدید، آن رتبه مال یک بک‌تست روی یک بازهٔ خاص است، نه مال آینده.

### دربارهٔ `NotAnotherSMAOffsetStrategyHO`

این عضو خانوادهٔ NASOS (نوشتهٔ `@Rallipanos`) است و در سال‌های ۲۰۲۱–۲۰۲۲ در خیلی از
بک‌تست‌های جامعه رتبهٔ بالا گرفت. همان فایل اینجا هست. چیزی که در آن رتبه‌ها معمولاً گفته
نمی‌شود:

- `stoploss = -0.35` — یعنی هر معامله می‌تواند **۳۵٪** زیان بدهد پیش از آنکه حد ضرر بخورد.
  بک‌تست‌های درخشانش عمدتاً از همین «صبر کردن تا برگشت» می‌آید و در بازار نزولی ممتد
  همین ویژگی به ضرر بزرگ تبدیل می‌شود.
- پارامترهایش (`ewo_high`, `low_offset`, `rsi_buy`, …) با hyperopt روی یک دورهٔ مشخص
  تنظیم شده‌اند. رتبهٔ بک‌تست روی همان دوره، **تضمین نتیجهٔ زنده نیست**.
- رابط نسخهٔ ۲ دارد؛ باید اول تبدیلش کنید.

اگر می‌خواهید جدی بسنجیدش، از دوره‌ای غیر از دورهٔ بهینه‌سازی استفاده کنید و حتماً
`walk-forward` و `lookahead-analysis` بگیرید:

```bash
docker compose run --rm entekhab-bot lookahead-analysis --strategy NotAnotherSMAOffsetStrategyHO
docker compose run --rm entekhab-bot backtesting --strategy NotAnotherSMAOffsetStrategyHO \
    --timerange 20250101-20251101 --breakdown month
```

## مستندات

| فایل | موضوع |
|---|---|
| [`docs/01-quickstart.fa.md`](docs/01-quickstart.fa.md) | نصب، دادهٔ تاریخی، اولین بک‌تست، اجرای آزمایشی |
| [`docs/02-risk.fa.md`](docs/02-risk.fa.md) | پیش از اینکه `dry_run` را خاموش کنید |
| [`docs/03-strategies.fa.md`](docs/03-strategies.fa.md) | تبدیل v2→v3، محافظ‌ها، انتخاب استراتژی |
| [`docs/04-telegram.fa.md`](docs/04-telegram.fa.md) | کنترل ربات از تلگرام |
| [`docs/quickstart.ckb.md`](docs/quickstart.ckb.md) | ڕێنمایی خێرا بە کوردی |
| [`docs/quickstart.en.md`](docs/quickstart.en.md) | English quickstart |

## لایسنس

GPL-3.0 — [`LICENSE`](LICENSE). منشأ کد، کپی‌رایت نویسندگان و فهرست دقیق تغییرات در
[`NOTICE.md`](NOTICE.md). انتخاب به پروژهٔ Freqtrade وابسته نیست و از سوی آن تأیید نشده.

## هشدار

معاملهٔ خودکار رمزارز می‌تواند کل سرمایه را از بین ببرد. هیچ‌چیز در این مخزن توصیهٔ
سرمایه‌گذاری نیست. نویسندگان Freqtrade، نویسندگان استراتژی‌ها و entekhab.net هیچ مسئولیتی
در قبال زیان شما ندارند. اول با `dry_run` کار کنید، بعد با پولی که از دست دادنش زندگی
شما را تغییر نمی‌دهد.
