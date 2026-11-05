# افزونهٔ گوگل کروم انتخاب (Entekhab Chrome extension)

Manifest V3 · نسخهٔ ۱.۱.۰ · سازگار با Chrome، Edge، Brave و Opera

- `src/` — کد افزونه (همان چیزی که در Chrome Web Store آپلود می‌شود)
- `store/` — تصاویر فروشگاه: سه اسکرین‌شات ۱۲۸۰×۸۰۰ و کاشی تبلیغاتی ۴۴۰×۲۸۰
- بستهٔ zip در هر ساخت سایت به‌طور خودکار در `/extension/entekhab-chrome-<version>.zip` ساخته می‌شود (`scripts/build_extension.py`).

## امکانات
قیمت زنده (داده‌های entekhab.net + قیمت لحظه‌ای Binance)، عدد قیمت روی آیکون، ترس و طمع، ارزش کل بازار، دامیننس، گزارش روزانهٔ بازار (fa/ckb/en)،
آخرین پست‌های Coin_Kurd و اعلان پست تازه، هشدار قیمت، جست‌وجو از نوار آدرس با کلیدواژهٔ `ek`،
و دسترسی یک‌کلیکی به دانشنامهٔ سه‌زبانهٔ بازارهای مالی (`ek encyclopedia`) و ربات معامله‌گر انتخاب (`ek bot`).

## انتشار نسخهٔ جدید
1. `version` را در `src/manifest.json` بالا ببرید.
2. سایت ساخته می‌شود و zip تازه در `/extension/` قرار می‌گیرد؛ همان zip را در داشبورد توسعه‌دهندهٔ Chrome Web Store آپلود کنید.
3. بعد از تأیید گوگل، نشانی صفحهٔ افزونه را در `STORE_URL` در `scripts/build_extension.py` بگذارید.

---

## متن فهرست فروشگاه (Store listing)

**Name (fa):** انتخاب | Entekhab — قیمت کریپتو، گزارش بازار و دانشنامه
**Name (en):** Entekhab — Crypto prices, market report & encyclopedia
**Category:** Tools (یا News & Weather) · **Language:** Persian (default), English

**Description (fa):**
افزونهٔ رسمی entekhab.net و کانال Coin_Kurd. بازار کریپتو همیشه یک کلیک با شما فاصله دارد:
• قیمت زندهٔ بیش از ۱۰۰ رمزارز با تغییر ۲۴ ساعته و نمودار کوچک
• قیمت بیت‌کوین (یا هر کوین دلخواه) روی آیکون مرورگر
• شاخص ترس و طمع، ارزش کل بازار و دامیننس بیت‌کوین
• گزارش هوشمند روزانهٔ بازار به فارسی، کوردی و انگلیسی
• آخرین پست‌های کانال Coin_Kurd و اعلان پست‌های تازه (اختیاری)
• هشدار قیمت: وقتی کوین به قیمت دلخواه شما برسد، اعلان می‌گیرید
• جست‌وجو از نوار آدرس: «ek btc»، «ek encyclopedia» یا «ek academy»
• دسترسی سریع به دانشنامهٔ بازارهای مالی (۵۰۶ مدخل فارسی، کوردی و انگلیسی)، آکادمی کریپتو، شبیه‌ساز معامله و ربات تلگرام
رایگان، بدون تبلیغ و بدون ردیابی. همهٔ تنظیمات فقط روی مرورگر شما ذخیره می‌شود. اطلاعات آموزشی است و توصیهٔ مالی نیست.

**Description (en):**
The official extension of entekhab.net and the Coin_Kurd channel: live prices for 100+ cryptocurrencies with 24h change and sparklines, your chosen coin's price on the toolbar badge, Fear & Greed, total market cap and BTC dominance, a daily AI market report (Persian, Kurdish, English), the latest Coin_Kurd posts with optional notifications, price alerts, one-click access to the trilingual encyclopedia of financial markets, and omnibox search ("ek btc", "ek encyclopedia"). Free, no ads, no tracking — settings stay in your browser. Not financial advice.

**Single purpose:** Show cryptocurrency market data and the entekhab.net market report, with optional price alerts.

**Permission justifications**
- `storage`: saves the user's settings (language, badge coin, alerts) and the last market snapshot locally.
- `alarms`: refreshes market data every 5 minutes for the badge and price alerts.
- `notifications`: shows price-alert and (opt-in) new-post notifications.
- Host `https://entekhab.net/*`: reads the site's public market JSON, report and post list.
- Host `https://data-api.binance.vision/*`: reads public live prices for the badge coin and alert coins.
- Remote code: none — all JavaScript is packaged in the extension.

**Data usage:** The extension does not collect or transmit any user data. Privacy policy: https://entekhab.net/privacy/
**Homepage / support:** https://entekhab.net/extension/ · https://t.me/Coin_Kurd
