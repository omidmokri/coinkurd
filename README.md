# Coin_Kurd ₿ — سایت خودکار کانال تلگرام

سایتی ایستا (GitHub Pages) که پست‌های کانال عمومی **t.me/Coin_Kurd** را هر ساعت می‌خواند، با قواعد کلیدواژه/هشتگ دسته‌بندی می‌کند و در یک رابط سه‌زبانه (فارسی / کوردی سورانی / English) با نماهای کارت، تایم‌لاین، نقشهٔ حرارتی و آمار منتشر می‌کند.

## راه‌اندازی (۵ دقیقه)

1. یک ریپازیتوری جدید در GitHub بسازید (مثلاً `coinkurd-site`) و همهٔ این فایل‌ها را در شاخهٔ `main` آپلود/پوش کنید.
2. **Settings → Pages → Build and deployment → Source** را روی **GitHub Actions** بگذارید.
3. **Settings → Actions → General → Workflow permissions** را روی **Read and write permissions** بگذارید (برای این‌که ربات بتواند `data/` را کامیت کند).
4. به تب **Actions** بروید، ورک‌فلوی «Sync Telegram → Site» را باز کنید و **Run workflow** بزنید. برای بار اول مقدار `pages` را مثلاً `50` بگذارید تا حدود ۱۰۰۰ پست آخر بک‌فیل شود (هر صفحه ≈ ۲۰ پست).
5. آدرس سایت: `https://<username>.github.io/<repo>/`

از این به بعد هر ساعت (دقیقهٔ ۱۷) ورک‌فلو خودش اجرا می‌شود، پست‌های جدید را می‌گیرد، دسته‌بندی می‌کند، در `data/posts.json` کامیت و سایت را دوباره منتشر می‌کند. با هر پوش به `main` هم اجرا می‌شود.

> **توجه:** پوشهٔ `data/` فعلاً چند پست نمونه دارد (برای پیش‌نمایش). با اولین اجرای ورک‌فلو جایگزین داده‌های واقعی کانال می‌شود.

## ساختار

```
index.html                 رابط کاربری (یک فایل، بدون وابستگی build)
data/posts.json            پست‌ها (خروجی خودکار)
data/meta.json             آمار، دسته‌ها، اطلاعات کانال
scripts/fetch.py           واکشی از t.me/s/Coin_Kurd + دسته‌بندی
scripts/categories.py      دسته‌ها، کلیدواژه‌ها، نقشهٔ کوین‌ها  ← اینجا را ویرایش کنید
.github/workflows/update.yml  زمان‌بندی ساعتی + انتشار Pages
tests/fixture.html         نمونهٔ HTML تلگرام برای تست آفلاین
```

## سفارشی‌سازی دسته‌ها

در `scripts/categories.py` هر دسته یک `id`، نام سه‌زبانه، آیکون، رنگ، کلیدواژه‌ها و (اختیاری) `weight` دارد. کلیدواژهٔ یافت‌شده در متن ۱ امتیاز و در هشتگ ۲ امتیاز می‌گیرد؛ دستهٔ با بیشترین امتیاز «دستهٔ اصلی» و دو دستهٔ بعدی با امتیاز ≥۲ «برچسب فرعی» می‌شوند. اگر هیچ کلیدواژه‌ای پیدا نشود، پست به «خبر بازار» می‌رود.

پس از تغییر قواعد، برای بازدسته‌بندی همهٔ پست‌ها:
```bash
python scripts/fetch.py --pages 0     # فقط فایل موجود را بازنویسی نمی‌کند؛ به‌جای آن:
python - <<'EOF2'
import json,sys; sys.path.insert(0,'scripts'); from fetch import *
posts=json.load(open('data/posts.json',encoding='utf-8')); d={}
for p in posts:
    c=classify(p['text'],p['hashtags']); p['category']=c['category']; p['tags']=c['tags']; p['coins']=detect_coins(p['text'],p['hashtags']); d[p['id']]=p
save(d,'Coin_Kurd',{})
EOF2
```

## اجرای محلی

```bash
pip install -r requirements.txt
python scripts/fetch.py --pages 5          # از اینترنت
python scripts/fetch.py --html tests/fixture.html   # آفلاین
python -m http.server 8000                 # سپس http://localhost:8000
```

## محدودیت‌ها

- فقط کانال‌های **عمومی** که پیش‌نمایش وب (t.me/s/…) دارند پشتیبانی می‌شوند.
- تصاویر و ویدیوها مستقیماً از CDN تلگرام نمایش داده می‌شوند (کپی نمی‌شوند).
- بک‌فیل خیلی عمیق (هزاران صفحه) ممکن است از طرف تلگرام محدود شود؛ `--delay` را بیشتر کنید یا در چند نوبت اجرا کنید.

## قابلیت‌های هوشمند (فاز ۱، فقط با API رایگان)

| اسکریپت | کار | منبع |
|---|---|---|
| `scripts/market.py` | داشبورد بازار + اسکنر فرصت‌ها (RSI، تقاطع EMA، شکست سقف/کف ۴۸h، جهش حجم) برای ۲۲ کوین | Binance (data-api.binance.vision)، CoinGecko، alternative.me |
| `scripts/impact.py` | کارنامهٔ واقعی پست‌ها: قیمت هنگام انتشار، حرکت ۱/۴/۲۴ ساعت بعد، MFE/MAE؛ سیگنال‌های ساختاریافته (ورود/حد ضرر/هدف) هم ارزیابی می‌شوند | Binance |
| `scripts/health.py` | نگهبان سلامت؛ با تغییر وضعیت در تلگرام هشدار می‌دهد | — |
| `scripts/build_pages.py` | صفحات ثابت قابل‌ایندکس: `/p/<id>/`، `/coins/<ticker>/`، `sitemap.xml`، `robots.txt` | data/*.json |

ورک‌فلو هر ۱۵ دقیقه اجرا می‌شود؛ هر مرحله مستقل است و شکست یکی مانع انتشار بقیه نمی‌شود.

**هشدار تلگرام (اختیاری):** در Settings → Secrets → Actions دو سکرت بسازید:
`TG_BOT_TOKEN` (توکن ربات از @BotFather) و `TG_ALERT_CHAT` (شناسهٔ چت شما یا گروه خصوصی).
