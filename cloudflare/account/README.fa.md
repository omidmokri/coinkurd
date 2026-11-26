# حساب اختیاری entekhab.net

ورود اختیاری و نگه‌داشتن داده‌های کاربر روی همهٔ دستگاه‌ها. بدون ورود، سایت دقیقاً مثل قبل کار می‌کند.

- **سرویس:** Cloudflare Worker + D1، هر دو در طرح رایگان.
- **روش‌های ورود:** گیت‌هاب، گوگل، تلگرام، کیف پول اتریوم (فقط امضای یک پیام)، passkey، پیوند ایمیل.
- **داده‌ها:** رمزگذاری‌شده (AES-256-GCM) نگه داشته می‌شوند. هر کلید جدا همگام می‌شود؛ تغییر تازه‌تر می‌برد و حذف‌ها هم منتقل می‌شوند. در اولین ورود، داده‌های مرورگر با حساب ادغام می‌شود و چیزی پاک نمی‌شود.
- **روشن کردن:** کل این بخش تا وقتی `api` در `assets/account/config.js` خالی است خاموش است.

## قدم‌های راه‌اندازی (هرکدام با تأیید صاحب سایت)

1. **دامنه:** `entekhab.net` باید در Cloudflare باشد (عوض کردن nameserverها در Joker به Cloudflare). کوکی ورود فقط روی `api.entekhab.net` کار می‌کند، نه روی `workers.dev`.
2. **پایگاه داده و Worker:**
   ```
   cd cloudflare/account && npm ci
   npx wrangler d1 create entekhab-account        # id را در wrangler.toml بگذار
   npx wrangler d1 execute entekhab-account --remote --file schema.sql
   npx wrangler secret put DATA_KEY               # 32 بایت تصادفی base64url
   npx wrangler deploy
   ```
3. **گیت‌هاب:** یک OAuth App بساز.
   - Homepage: `https://entekhab.net`
   - Callback: `https://api.entekhab.net/v1/auth/github/callback`
   - `GITHUB_CLIENT_ID` و `GITHUB_CLIENT_SECRET` را با `wrangler secret put` بگذار.
4. **گوگل:** در Google Cloud یک OAuth client از نوع Web بساز.
   - Redirect: `https://api.entekhab.net/v1/auth/google/callback`
   - JavaScript origin: `https://entekhab.net`
   - دامنه‌ها (scope): فقط `openid` و `email`.
   - `GOOGLE_CLIENT_ID` و `GOOGLE_CLIENT_SECRET` را بگذار.
5. **تلگرام:**
   - یک ربات فقط برای ورود بساز و در ‎@BotFather با `/setdomain` دامنه را `entekhab.net` بگذار.
   - توکن را خودت با `wrangler secret put TG_BOT_TOKEN` بگذار.
   - نام ربات را در `TG_BOT_NAME` بنویس.
6. **ایمیل (اختیاری):**
   - یک حساب رایگان Resend بساز و رکوردهای SPF/DKIM آن را در DNS بگذار.
   - `RESEND_KEY` را بگذار و `EMAIL_FROM` را مثلاً `entekhab.net <login@entekhab.net>` بنویس.
7. **روشن کردن:** در `assets/account/config.js`:
   ```
   api: 'https://api.entekhab.net'
   ```
   `VER` در `scripts/chrome.py` را هم یکی بالا ببر.

هر روشی که کلیدش گذاشته نشود، دکمه‌اش خودبه‌خود پنهان می‌ماند. passkey و کیف پول کلید لازم ندارند.

## آزمون

```
npm test
```

آزمون‌ها سرویس را با Miniflare اجرا می‌کنند و همهٔ روش‌های ورود، ادغام، همگام‌سازی، سهمیه‌ها و حذف حساب را می‌سنجند.

## نکته‌های امنیتی

- **نشست:** نشست در کوکی `__Host-` با HttpOnly، Secure و SameSite=Lax است. فقط هش آن ذخیره می‌شود. هر نشست حداکثر ۹۰ روز بی‌استفاده و ۳۶۵ روز در کل اعتبار دارد.
- **قدم‌های ورود:** هر مرحلهٔ ورود به مرورگری بسته است که آن را شروع کرده، و فقط یک بار کار می‌کند.
- **درخواست‌ها:** هر درخواست POST باید از خود سایت بیاید (بررسی Origin).
- **گیت‌هاب و گوگل:** با PKCE کار می‌کنند. افزودن روش ورود به حساب فقط از دکمهٔ خود سایت شروع می‌شود.
- **حذف روش ورود:** با حذف یک روش ورود، نشست‌های دیگر بسته می‌شوند. «خروج از همهٔ دستگاه‌ها» هم هست.
- **سهمیه‌ها:**
  - ساخت حساب: ۱۰ در روز از هر شبکه (IPv6 به ازای هر ‎/64)، و سقف کل روزانه.
  - ایمیل: ۵ در ساعت و ۱۰ در روز از هر شبکه، ۳ در ساعت برای هر نشانی، و سقف کل روزانه.
  - داده: ۶۰۰ کلید و ۳ مگابایت برای هر حساب.
- **چه چیزی ذخیره نمی‌شود:** نشانی ایمیل و IP ذخیره نمی‌شوند. زبان نمایش هر دستگاه هم مال همان دستگاه است و همگام نمی‌شود.
