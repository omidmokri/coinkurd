# استراتژی‌ها: انتخاب، تبدیل و تنظیم

## فهرست

`strategies-index.json` در ریشهٔ همین پوشه، فهرست ماشین‌خوان هر ۴۶۵ استراتژی است.
همهٔ فیلدهایش با تحلیل ایستای خود فایل‌ها ساخته شده‌اند — **هیچ بک‌تستی اجرا نشده و
هیچ عدد عملکردی در آن نیست.**

| فیلد | یعنی |
|---|---|
| `cls` | نام کلاس — همین را به `--strategy` می‌دهید |
| `tf` | تایم‌فریم اعلام‌شدهٔ استراتژی |
| `stoploss` | حد ضرر ثابت؛ `-0.35` یعنی تحمل ۳۵٪ زیان در هر معامله |
| `api` | `2` یا `3` — نسخهٔ رابط Freqtrade |
| `needs_migration` | `true` یعنی قبل از اجرا باید تبدیل شود |
| `hardcoded_hyperopt` | `true` یعنی پارامترها روی یک دورهٔ گذشته بهینه و ثابت شده‌اند |
| `protections` | `true` یعنی خودش ترمز خودکار دارد |
| `deps` | کتابخانه‌های لازم بیرون از Freqtrade |
| `authors` | نامی که داخل خود فایل آمده |
| `flags` | نشانهٔ ایستای نگاه‌به‌آینده (مثل `shift(-n)`) |

مرورگر همین فهرست با جست‌وجو و فیلتر: <https://entekhab.net/trade-bot/>

## تبدیل v2 → v3

۴۶۲ استراتژی رابط قدیمی دارند. ابزار رسمی خود Freqtrade:

```bash
# یکی
docker compose run --rm entekhab-bot strategy-updater --strategy-list NotAnotherSMAOffsetStrategyHO

# همهٔ پوشه (طول می‌کشد)
docker compose run --rm entekhab-bot strategy-updater
```

نسخهٔ اصلی در `user_data/strategies_orig_updater/` دست‌نخورده می‌ماند. خود Freqtrade
این تبدیل را «best effort» می‌خواند: نتیجه را باز کنید و بخوانید. مهم‌ترین تغییرها:

| قدیم | جدید |
|---|---|
| `populate_buy_trend` | `populate_entry_trend` |
| `populate_sell_trend` | `populate_exit_trend` |
| ستون `'buy'` | `'enter_long'` |
| ستون `'sell'` | `'exit_long'` |
| `custom_sell` | `custom_exit` |
| `buy_tag` | `enter_tag` |
| `sell_reason` | `exit_reason` |

مرجع کامل: <https://www.freqtrade.io/en/stable/strategy_migration/>

## افزودن محافظ به استراتژی

در Freqtrade امروزی محافظ‌ها داخل کلاس استراتژی تعریف می‌شوند، نه در کانفیگ. محتوای
`config/protections.strategy-snippet.json` را این‌طور داخل کلاس بگذارید:

```python
class YourStrategy(IStrategy):

    @property
    def protections(self):
        return [
            {"method": "StoplossGuard", "lookback_period_candles": 60,
             "trade_limit": 4, "stop_duration_candles": 60, "only_per_pair": False},
            {"method": "MaxDrawdown", "lookback_period_candles": 200,
             "trade_limit": 20, "stop_duration_candles": 100, "max_allowed_drawdown": 0.2},
            {"method": "LowProfitPairs", "lookback_period_candles": 360,
             "trade_limit": 2, "stop_duration_candles": 60, "required_profit": 0.02},
            {"method": "CooldownPeriod", "stop_duration_candles": 5},
        ]
```

## وابستگی‌ها

بیشتر استراتژی‌ها `talib` و `technical` می‌خواهند که در ایمیج رسمی هستند. ۵۸ تا
`pandas_ta` و ۲۱ تا `finta` می‌خواهند که نیستند. برای آن‌ها یک ایمیج سفارشی بسازید:

```dockerfile
# docker/Dockerfile.custom
FROM freqtradeorg/freqtrade:stable
USER root
RUN pip install --no-cache-dir pandas-ta finta
USER ftuser
```

و در `docker-compose.yml` به‌جای `image:` از `build:` استفاده کنید.

## نوشتن استراتژی خودتان

اگر از قواعد خودتان شروع می‌کنید و نه از فایل آمادهٔ کسی دیگر، دو چیز را رعایت کنید:

1. هیچ‌جا از دادهٔ آینده استفاده نکنید — نه `shift(-n)`، نه مقدار کندل جاری که هنوز
   بسته نشده. `lookahead-analysis` را روی هر نسخه بگیرید.
2. خطوط و سطوحی که خودتان روی چارت کشیده‌اید را به‌عنوان ورودی معامله داخل کد نگذارید؛
   آن‌ها با دانستن ادامهٔ نمودار کشیده شده‌اند و بک‌تست را بی‌معنی می‌کنند. اگر قاعده‌ای
   در ذهنتان هست، همان قاعده را کد کنید تا خودِ کد خط را از دادهٔ گذشته بسازد.

راهنمای رسمی: <https://www.freqtrade.io/en/stable/strategy-customization/>
