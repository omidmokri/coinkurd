# NOTICE — منشأ کد، لایسنس و تغییرات

«ربات معامله‌گر انتخاب» (Entekhab trading bot) **موتور معاملاتی تازه‌ای نیست**. این یک
توزیع (distribution) است: پیکربندی، مستندات فارسی/کوردی/انگلیسی، برندینگ انتخاب و مجموعهٔ
استراتژی‌ها، روی موتور متن‌باز **Freqtrade**.

## ۱. Freqtrade

- پروژه: <https://github.com/freqtrade/freqtrade> · <https://www.freqtrade.io/>
- کپی‌رایت: © The Freqtrade Team و مشارکت‌کنندگان آن
- لایسنس: **GNU General Public License v3.0** — متن کامل در فایل [`LICENSE`](LICENSE)

موتور Freqtrade در این مخزن **کپی یا تغییر داده نشده است**. `docker-compose.yml` ایمیج
رسمی `freqtradeorg/freqtrade:stable` را از Docker Hub می‌گیرد، بنابراین هر به‌روزرسانی و
وصلهٔ امنیتی بالادست مستقیم به شما می‌رسد.

نام و نشان «Freqtrade» علامت تجاری پروژهٔ Freqtrade است. GPL حقی روی علائم تجاری نمی‌دهد و
نمی‌دهیم وانمود کنیم که نداده: **انتخاب هیچ وابستگی به پروژهٔ Freqtrade ندارد و از سوی آن
تأیید نشده است.** نام «انتخاب» فقط روی همین لایهٔ پیکربندی و مستندات است، نه روی موتور.

## ۲. استراتژی‌ها

پوشهٔ `user_data/strategies/community/` شامل **۴۶۵ استراتژی** است که **بدون هیچ تغییری**
(verbatim) از این مخزن کپی شده‌اند:

- منبع: <https://github.com/davidzr/freqtrade-strategies>
- لایسنس: **GNU General Public License v3.0**
- وضعیت: این مخزن **بایگانی (archived)** شده است؛ آخرین تغییرش **۱۰ فوریهٔ ۲۰۲۴** بوده.
- کپی‌رایت هر فایل متعلق به نویسندهٔ همان فایل است. نام نویسنده‌ها (مثل `@Rallipanos`,
  `iterativ`, `werkkrew`, `froggleston` و ده‌ها نفر دیگر) داخل خود فایل‌ها آمده و
  **پاک نشده است**. هیچ فایلی به نام انتخاب بازنویسی یا امضا نشده.

## ۳. تغییراتی که انتخاب اعمال کرده (الزام بند ۵ GPL)

تاریخ: ۱۴ آبان ۱۴۰۵ / 2026-11-05

1. افزودن `docker-compose.yml` و `install.sh` مخصوص انتخاب (فایل تازه، کد Freqtrade تغییر نکرده).
2. افزودن `config/config.entekhab.json` — پیکربندی تازه با پیش‌فرض‌های محافظه‌کارانه
   (`dry_run: true`، فهرست سیاه جفت‌ارزهای اهرمی، فیلترهای نقدشوندگی و نوسان).
3. افزودن `config/protections.strategy-snippet.json` — محافظ‌ها که در Freqtrade امروزی
   باید داخل کلاس استراتژی باشند، نه در کانفیگ.
4. افزودن مستندات فارسی، کوردی و انگلیسی در `docs/`.
5. افزودن `strategies-index.json` — فهرست ماشین‌خوان ۴۶۵ استراتژی با فراداده‌ای که
   به‌صورت ایستا از خود فایل‌ها استخراج شده (کلاس، تایم‌فریم، حد ضرر، وابستگی‌ها، نسخهٔ رابط).
6. کپی ۴۶۵ فایل استراتژی، **بدون ویرایش محتوا**؛ تنها ساختار پوشه از
   `strategies/<Name>/<Name>.py` به `user_data/strategies/community/<Name>.py` تخت شده است.
7. افزودن لوگوی انتخاب در `branding/` — این لوگو **متعلق به entekhab.net است و مشمول GPL
   نیست**؛ اگر این توزیع را فورک می‌کنید، لوگو را بردارید.

## ۴. متن کامل اخطار GPL

```
This program is free software: you can redistribute it and/or modify it under the terms
of the GNU General Public License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.
```

کد منبع کامل همین چیزی است که می‌بینید: این مخزن، به‌اضافهٔ مخزن بالادست Freqtrade که
`docker-compose.yml` به آن اشاره می‌کند.
