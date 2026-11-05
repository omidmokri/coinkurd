# استراتژی‌ها

این پوشه دو چیز دارد:

| مسیر | چیست |
|---|---|
| `community-strategies.zip` | **۴۶۵ استراتژی**، کپی بدون تغییر از مخزن متن‌باز [davidzr/freqtrade-strategies](https://github.com/davidzr/freqtrade-strategies) (GPL-3.0) |
| `community-strategies.json` | اندازه و اثر انگشت SHA-256 بسته، برای بررسی سلامت فایل |
| `community/` | بعد از اجرای `install.sh` ساخته می‌شود و فایل‌های باز شده اینجا می‌آیند |

`install.sh` خودش بسته را باز می‌کند. دستی:

```bash
unzip -o community-strategies.zip -d community
sha256sum community-strategies.zip   # با مقدار داخل community-strategies.json مقایسه کنید
```

فراداده و برچسب هر استراتژی (تایم‌فریم، حد ضرر، نیاز به تبدیل v3، پارامتر hyperopt ثابت،
نشانهٔ نگاه‌به‌آینده) در `../../strategies-index.json` است و مرورگرش در
<https://entekhab.net/trade-bot/>.

## پیش از استفاده

- **۴۶۲ از ۴۶۵** رابط نسخهٔ ۲ Freqtrade را دارند و بدون تبدیل اجرا نمی‌شوند:
  `docker compose run --rm entekhab-bot strategy-updater --strategy-list <Name>`
- **۲۳۹ از ۴۶۵** پارامترهای hyperopt را روی یک دورهٔ گذشته ثابت کرده‌اند — خطر بیش‌برازش.
- **۴ تا** نشانهٔ ایستای نگاه‌به‌آینده دارند؛ `LookaheadStrategy` اصلاً نمونهٔ آموزشی همین
  مشکل است و برای معامله ساخته نشده.
- مخزن مبدأ از فوریهٔ ۲۰۲۴ بایگانی شده است.

کپی‌رایت هر فایل متعلق به نویسندهٔ همان فایل است؛ هیچ فایلی ویرایش یا به نام انتخاب امضا
نشده. جزئیات در [`../../NOTICE.md`](../../NOTICE.md).
