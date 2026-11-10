#!/usr/bin/env python3
"""Builds /dca/ — DCA vs lump sum on real Binance history, in the visitor's browser (fa / ckb / en in one page).
The page is a shell; the tool is assets/dca.js. Run after build_pages.py."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import build_strategy_lab as SL  # noqa: E402  (same form styles)
from reality_common import L  # noqa: E402

e = BP.e
VER = "3"
T = {
    "title": L("شبیه‌ساز خرید پلکانی (DCA) در برابر خرید یکجا", "هاوشێوەکەری کڕینی پلەپلە (DCA) بەرامبەر کڕینی یەکجار",
               "DCA vs lump sum simulator"),
    "desc": L("یک بودجه را یا یکجا بخر، یا در خریدهای مساوی هفتگی و ماهانه پخش کن. با قیمت‌های واقعی بایننس و کارمزد، ببین کدام جلو بود، افت دارایی در هر کدام چقدر بود، و در تمام تاریخچهٔ ارز چند بار DCA برده است.",
              "بودجەیەک یان یەکجار بکڕە، یان لە کڕینی یەکسانی هەفتانە و مانگانەدا دابەشی بکە. بە نرخی ڕاستەقینەی بایننس و کرێ، ببینە کامیان پێشکەوت، داکەوتنی سامان چەند بوو، و لە هەموو مێژووی دراوەکەدا DCA چەند جار بردیەوە.",
              "Spend a budget at once, or split it into equal weekly or monthly buys. On real Binance prices and fees, see which came out ahead, how deep each one's drawdown was, and how often DCA won across the coin's whole history."),
    "home": L("خانه", "ماڵەوە", "Home"),
    "local": L("همه‌چیز در مرورگر خودت اجرا می‌شود: قیمت‌ها مستقیم از بایننس می‌آیند و هیچ داده‌ای از تو ذخیره یا ارسال نمی‌شود.",
               "هەموو شتێک لە وێبگەڕی خۆتدا دەکرێت: نرخەکان ڕاستەوخۆ لە بایننسەوە دێن و هیچ داتایەکی تۆ پاشەکەوت یان نێردراو نییە.",
               "Everything runs in your own browser: prices come straight from Binance and nothing about you is stored or sent."),
    "method": L("روش و قواعد صداقت", "ڕێباز و یاساکانی ڕاستگۆیی", "Method and honesty rules"),
}
METH = L([
    "هر دو روش با یک مبلغ شروع می‌کنند. پولی که DCA هنوز خرج نکرده نقد حساب می‌شود (بدون سود)، پس منحنی ارزش و افت دارایی دو روش قابل مقایسه است.",
    "هر خرید با قیمت باز شدن همان روز و با کسر کارمزد انجام می‌شود؛ ارزش نهایی با قیمت بسته‌شدن آخرین روز حساب می‌شود.",
    "خرید ماهانه همان روز از ماه را دنبال می‌کند؛ اگر آن روز کندلی نبود، اولین روز بعد.",
    "«همهٔ تاریخ‌های شروع»: همان طول دوره و برنامهٔ خرید برای هر روز شروع ممکن در تاریخچهٔ ارز اجرا می‌شود (این‌جا هر ماه ۳۰ روز است). دوره‌ها روی هم افتاده‌اند و مستقل نیستند.",
    "گرید فقط خرید: پله‌ها سفارش خرید محدودند و با کف هر روز سنجیده می‌شوند، که با کندل روزانه دقیق است. گریدی که بفروشد هم شبیه‌سازی نمی‌شود، چون ترتیب سقف و کف داخل روز معلوم نیست و نتیجه را می‌سازد.",
    "فقط ارزهایی که امروز در بایننس هستند قابل آزمون‌اند (سوگیری بازماندگی) و گذشته تضمین آینده نیست. این ابزار آموزشی است و توصیهٔ مالی نیست."],
    [
    "هەردوو ڕێگا بە یەک بڕ پارە دەست پێدەکەن؛ ئەو پارەیەی DCA هێشتا خەرجی نەکردووە بە نەختینە دەژمێردرێت (بێ قازانج).",
    "هەر کڕینێک بە نرخی کردنەوەی هەمان ڕۆژ و دوای بڕینی کرێ دەکرێت؛ بەهای کۆتایی بە نرخی داخستنی دوایین ڕۆژە.",
    "کڕینی مانگانە هەمان ڕۆژی مانگ دەگرێتە بەر؛ ئەگەر ئەو ڕۆژە مۆمی نەبوو، یەکەم ڕۆژی دواتر.",
    "«هەموو بەروارەکانی دەستپێک»: هەمان درێژی و بەرنامە بۆ هەر ڕۆژێکی دەستپێکی گونجاو دووبارە دەکرێتەوە (لێرە مانگ ٣٠ ڕۆژە). ماوەکان یەکتر دەگرنەوە و سەربەخۆ نین.",
    "گریدی تەنها کڕین: پلەکان فەرمانی کڕینی سنووردارن و بە نزمیی هەر ڕۆژێک دەپێورێن، کە بە مۆمی ڕۆژانە وردە. گریدێک کە بفرۆشێت هاوشێوە ناکرێت، چونکە ڕیزی بەرزی و نزمیی ناو ڕۆژ نەزانراوە.",
    "تەنها ئەو دراوانەی ئەمڕۆ لە بایننسن تاقی دەکرێنەوە؛ ڕابردوو گەرەنتیی داهاتوو نییە. ئامۆژگاریی دارایی نییە."],
    [
    "Both start with the same money. Cash DCA has not spent yet is counted as cash (no return), so the value curves and drawdowns of the two compare like with like.",
    "Every buy is made at that day's open after the fee; the final value uses the last day's close.",
    "Monthly buys keep the same day of the month; if that day has no candle, the next day.",
    "\"Every possible start date\" re-runs the same length and schedule from every start day in the coin's history (a month counts as 30 days there). The periods overlap and are not independent.",
    "Buy-only grid: the levels are buy limits checked against each day's low, which daily candles measure exactly. A grid that also sells is not simulated: the order of the day's high and low is unknown and would decide the result.",
    "Only coins listed on Binance today can be tested (survivorship bias), and the past does not guarantee the future. An educational tool, not financial advice."])

CSS = """
#dca{margin:14px 0}#dca select,#dca input{background:#000;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 9px;font:inherit;font-size:.86rem;max-width:100%}
#dca input[type=number]{font-family:'Space Grotesk',Vazirmatn,monospace;direction:ltr}
.dc-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.dc-cols h3{margin:10px 0 4px}
"""


def page():
    def intro(lg):
        return (f"<div class='meta'><a href='/'>{T['home'][lg]}</a> / {e(T['title'][lg])}</div>"
                f"<h1>{e(T['title'][lg])}</h1><p class='rc-lead'>{e(T['desc'][lg])}</p><p class='note'>{e(T['local'][lg])}</p>")

    def meth(lg):
        items = "".join(f"<li>{e(x)}</li>" for x in METH[lg])
        return f"<details class='rc-meth'><summary>{T['method'][lg]}</summary><ul>{items}</ul></details>"

    body = (BR.tri(intro) + "<div id='dca'><p class='mut'>…</p></div>" + BR.tri(meth)
            + f"<script>{BR.LANG_JS}</script>" + BP.LWC + f"<script src='/assets/dca.js?v={VER}' defer></script>")
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": T["title"]["en"], "description": T["desc"]["en"],
          "applicationCategory": "FinanceApplication", "operatingSystem": "Any", "url": "https://entekhab.net/dca/",
          "inLanguage": ["fa", "ckb", "en"], "isAccessibleForFree": True}
    extra = f"<style>{BR.RCSS}{SL.CSS}{CSS}</style><script type='application/ld+json'>{BP.sj(ld)}</script>"
    return BP.page("dca/", T["title"]["fa"], T["desc"]["fa"], body, extra)


def main():
    url = page()
    BR.add_to_sitemap([url])
    print("dca:", url)


if __name__ == "__main__":
    main()
