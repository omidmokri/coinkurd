# راهنمای شروع — ربات معامله‌گر انتخاب

## ۰. پیش‌نیاز

یک سرور لینوکسی (VPS یا کامپیوتر خودتان که همیشه روشن است) با Docker و Docker Compose v2.

```bash
docker --version && docker compose version
```

ربات باید ۲۴ ساعته روشن بماند. اگر لپ‌تاپ را می‌بندید، ربات هم می‌خوابد و معاملهٔ باز
بدون نگهبان می‌ماند.

## ۱. گرفتن فایل‌ها

```bash
git clone https://github.com/omidmokri/coinkurd.git
cd coinkurd/entekhab-bot
./install.sh
```

`install.sh` فقط ایمیج رسمی Freqtrade را می‌کشد، `.env` می‌سازد و پیکربندی را اعتبارسنجی
می‌کند. هیچ معامله‌ای انجام نمی‌دهد.

## ۲. دادهٔ تاریخی

بدون داده نه بک‌تست ممکن است نه گرم‌کردن اندیکاتورها:

```bash
docker compose run --rm entekhab-bot download-data \
    --timerange 20240101- --timeframes 5m 1h --exchange binance
```

داده در `user_data/data/binance/` ذخیره می‌شود و چند صد مگابایت می‌گیرد.

## ۳. تبدیل استراتژی به رابط نسخهٔ ۳

۴۶۲ استراتژی از ۴۶۵ تا هنوز رابط قدیمی دارند و بدون این گام اجرا نمی‌شوند:

```bash
docker compose run --rm entekhab-bot strategy-updater \
    --strategy-list NotAnotherSMAOffsetStrategyHO
```

نسخهٔ اصلی دست‌نخورده در `user_data/strategies_orig_updater/` می‌ماند. خود Freqtrade
این تبدیل را «best effort» می‌نامد — یعنی نتیجه را باید خودتان بخوانید و بررسی کنید.

## ۴. اولین بک‌تست

```bash
docker compose run --rm entekhab-bot backtesting \
    --strategy NotAnotherSMAOffsetStrategyHO \
    --timerange 20250101-20251101 \
    --breakdown month
```

`--breakdown month` را جدی بگیرید: یک عدد کل سود می‌تواند حاصل دو ماه خوب و ده ماه
بد باشد. تفکیک ماهانه این را لو می‌دهد.

## ۵. بررسی نگاه‌به‌آینده

قبل از هر نتیجه‌گیری، این را بگیرید:

```bash
docker compose run --rm entekhab-bot lookahead-analysis \
    --strategy NotAnotherSMAOffsetStrategyHO --timerange 20250101-20251101
```

اگر ابزار بگوید استراتژی از دادهٔ آینده استفاده می‌کند، هر عددی که بک‌تست داده بی‌معنی
است. استراتژی را دور بیندازید یا اشکالش را پیدا کنید؛ آن را «خوش‌شانس» ندانید.

## ۶. اجرای آزمایشی (کاغذی)

`dry_run` پیش‌فرض `true` است. یعنی ربات با پول فرضی معامله می‌کند و رفتار واقعی‌اش را
می‌بینید:

```bash
docker compose up -d
docker compose logs -f
```

دست‌کم **چند هفته** در این حالت بگذارید. بک‌تست روی گذشتهٔ تمیز اجرا می‌شود؛ اجرای
آزمایشی روی بازار واقعی با تأخیر، لغزش و سفارش‌های پرنشده روبه‌رو می‌شود.

## ۷. توقف

```bash
docker compose down
```

## بعد از این

- [`02-risk.fa.md`](02-risk.fa.md) — قبل از رفتن به پول واقعی
- [`03-strategies.fa.md`](03-strategies.fa.md) — انتخاب و تنظیم استراتژی
- [`04-telegram.fa.md`](04-telegram.fa.md) — کنترل از تلگرام
- مستندات رسمی Freqtrade: <https://www.freqtrade.io/en/stable/>
