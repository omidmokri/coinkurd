#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/extension/ — صفحهٔ افزونهٔ گوگل کروم انتخاب + بستهٔ zip قابل نصب

منبع افزونه در chrome-extension/src است (Manifest V3). این اسکریپت در هر ساخت سایت:
  * از chrome-extension/src فایل /extension/entekhab-chrome-<version>.zip می‌سازد (همان بسته‌ای که در Chrome Web Store آپلود می‌شود)
  * صفحهٔ /extension/ را با راهنمای نصب می‌سازد
وقتی افزونه در Chrome Web Store منتشر شد، نشانی آن را در STORE_URL بگذارید تا دکمهٔ نصب یک‌کلیکی نمایش داده شود.
"""
import json
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402

STORE_URL = ""  # e.g. https://chromewebstore.google.com/detail/<id>
SRC = os.path.join(BP.ROOT, "chrome-extension", "src")
OUT = os.path.join(BP.ROOT, "extension")
e = BP.e


def package():
    ver = json.load(open(os.path.join(SRC, "manifest.json"), encoding="utf-8"))["version"]
    os.makedirs(OUT, exist_ok=True)
    name = f"entekhab-chrome-{ver}.zip"
    with zipfile.ZipFile(os.path.join(OUT, name), "w", zipfile.ZIP_DEFLATED) as z:
        for dp, _, fs in os.walk(SRC):
            for f in sorted(fs):
                full = os.path.join(dp, f)
                z.write(full, os.path.relpath(full, SRC))
    return ver, name, os.path.getsize(os.path.join(OUT, name))


def build():
    ver, name, size = package()
    shots = [f for f in ("market.png", "report.png", "alerts.png") if os.path.exists(os.path.join(BP.ROOT, "chrome-extension", "store", f))]
    gallery = "".join(f'<img src="/chrome-extension/store/{f}" alt="" loading="lazy" style="width:100%;border-radius:12px;border:1px solid var(--line);margin:6px 0">' for f in shots)
    store = (f'<p><a class="wbtn on" href="{e(STORE_URL)}" rel="noopener" target="_blank">⬇ نصب از Chrome Web Store</a></p>' if STORE_URL else
             '<p class="note">نسخهٔ Chrome Web Store به‌زودی منتشر می‌شود؛ تا آن زمان می‌توانید بستهٔ رسمی را مستقیم از همین صفحه نصب کنید (راهنما پایین صفحه).</p>')
    feats = "".join(f"<li>{x}</li>" for x in [
        "قیمت زندهٔ بیش از ۱۰۰ رمزارز با تغییر ۲۴ ساعته و نمودار کوچک، و قیمت بیت‌کوین (یا هر کوین دلخواه) روی آیکون مرورگر",
        "شاخص ترس و طمع، ارزش کل بازار و دامیننس بیت‌کوین",
        "گزارش هوشمند روزانهٔ بازار به فارسی، کوردی و انگلیسی",
        "آخرین پست‌های کانال Coin_Kurd و اعلان پست‌های تازه (اختیاری)",
        "هشدار قیمت: وقتی کوین به قیمت دلخواه شما برسد، اعلان می‌گیرید",
        "ماشین‌حساب معامله همان‌جا در افزونه: حجم پوزیشن، ریسک به بازده، سود و زیان، قیمت لیکوئید و کارمزد — با پر شدن خودکار قیمت ورود از نرخ زنده",
        "جست‌وجوی سریع از نوار آدرس: <code>ek</code> و فاصله، سپس نام کوین (مثلاً <code>ek btc</code>) یا <code>ek academy</code>",
        "دسترسی سریع به آکادمی کریپتو، شبیه‌ساز معامله، داشبورد و ربات تلگرام"])
    steps = "".join(f"<li>{x}</li>" for x in [
        f'فایل <a href="/extension/{name}" download><b>{name}</b></a> را دانلود کنید ({size // 1024} کیلوبایت).',
        "فایل zip را در یک پوشهٔ ثابت از حالت فشرده خارج کنید (این پوشه را بعداً پاک نکنید).",
        "در نوار آدرس کروم بنویسید <code dir=\"ltr\">chrome://extensions</code> و Enter بزنید.",
        "گزینهٔ <b>Developer mode</b> را در گوشهٔ بالای صفحه روشن کنید.",
        "روی <b>Load unpacked</b> بزنید و پوشه‌ای را که از zip بیرون آوردید انتخاب کنید.",
        "آیکون انتخاب را از منوی پازل 🧩 سنجاق (Pin) کنید تا قیمت روی آن دیده شود."])
    perms = "".join(f"<li><b>{a}</b>: {b}</li>" for a, b in [
        ("storage", "ذخیرهٔ تنظیمات، هشدارها و آخرین داده‌ها فقط روی همین مرورگر"),
        ("alarms", "به‌روزرسانی خودکار هر ۵ دقیقه"),
        ("notifications", "نمایش هشدار قیمت و پست تازه"),
        ("entekhab.net و data-api.binance.vision", "خواندن داده‌های عمومی بازار؛ افزونه هیچ صفحه‌ای از سایت‌های دیگر را نمی‌خواند")])
    body = (f'<div class="meta"><a href="/">خانه</a> / افزونهٔ کروم</div>'
            f'<h1>🧩 افزونهٔ گوگل کروم انتخاب</h1>'
            f'<p class="txt">بازار کریپتو همیشه یک کلیک با شما فاصله دارد: قیمت‌ها، ترس و طمع، گزارش روزانه، پست‌های Coin_Kurd و هشدار قیمت، بدون باز کردن سایت. '
            f'رایگان، بدون تبلیغ و بدون ردیابی. نسخهٔ {e(ver)} · سازگار با Chrome، Edge، Brave و Opera.</p>{store}'
            f'<p><a class="wbtn on" href="/extension/{name}" download>⬇ دانلود مستقیم ({e(name)})</a> '
            f'<a class="wbtn" href="https://github.com/omidmokri/coinkurd/tree/main/chrome-extension/src" rel="noopener" target="_blank">کد منبع</a></p>'
            f'{gallery}<h2>امکانات</h2><ul class="list" style="list-style:disc;padding-inline-start:20px">{feats}</ul>'
            f'<h2>نصب مستقیم (بدون Chrome Web Store)</h2><ol style="padding-inline-start:22px">{steps}</ol>'
            f'<h2>دسترسی‌ها و حریم خصوصی</h2><ul style="padding-inline-start:20px">{perms}</ul>'
            f'<p class="note">افزونه هیچ اطلاعات شخصی، تاریخچهٔ مرور یا داده‌ای از صفحه‌های دیگر جمع نمی‌کند و چیزی به سرور ما نمی‌فرستد. '
            f'<a href="/privacy/">حریم خصوصی</a> · اطلاعات آموزشی است، توصیهٔ مالی نیست.</p>')
    ld = {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Entekhab — Chrome extension", "applicationCategory": "BrowserApplication",
          "operatingSystem": "Chrome, Edge, Brave, Opera", "softwareVersion": ver, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
          "downloadUrl": f"{BP.SITE}/extension/{name}", "inLanguage": ["fa", "ckb", "en"]}
    url = BP.page("extension/", "افزونهٔ گوگل کروم انتخاب — قیمت کریپتو، گزارش بازار و هشدار قیمت",
                  "افزونهٔ رایگان کروم entekhab.net: قیمت زندهٔ رمزارزها روی آیکون، ترس و طمع، گزارش روزانهٔ بازار، پست‌های Coin_Kurd و هشدار قیمت",
                  body, f'<script type="application/ld+json">{BP.sj(ld)}</script>')
    print(f"extension page: {name} ({size} bytes)")
    return [url]


if __name__ == "__main__":
    build()
