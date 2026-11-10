#!/usr/bin/env python3
"""Builds /strategy-lab/ — the in-browser strategy back-tester (fa / ckb / en in one page).
The page is a shell: the tool itself is assets/strategy-lab.js (prices from Binance spot in the visitor's
browser, market context from data/lab_context.json). Run after build_pages.py."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
from reality_common import L  # noqa: E402

e = BP.e
VER = "2"
T = {
    "title": L("آزمایشگاه استراتژی", "تاقیگەی ستراتیژ", "Strategy lab"),
    "desc": L("قانون معاملهٔ خودت را بنویس، پس از کارمزد بک‌تست کن، با آزمون جایگشت ببین لبه واقعی است یا شانس، و با واک-فوروارد بسنج روی دادهٔ دیده‌نشده هم کار می‌کند یا نه.",
              "یاسای مامەڵەی خۆت بنووسە، دوای کرێ باکتێستی بکە، بە تاقیکردنەوەی جێگۆڕکێ ببینە لێوار ڕاستەقینەیە یان هەڵکەوت، و بە واک-فۆروارد بیپێوە لەسەر داتای نەبینراو.",
              "Write your own trading rule, back-test it after costs, see with a permutation test whether the edge is real or luck, and check with walk-forward whether it holds on unseen data."),
    "home": L("خانه", "ماڵەوە", "Home"),
    "local": L("همه‌چیز در مرورگر خودت اجرا می‌شود: قیمت‌ها مستقیم از بایننس می‌آیند و هیچ داده‌ای از تو ذخیره یا ارسال نمی‌شود.",
               "هەموو شتێک لە وێبگەڕی خۆتدا دەکرێت: نرخەکان ڕاستەوخۆ لە بایننسەوە دێن و هیچ داتایەکی تۆ پاشەکەوت یان نێردراو نییە.",
               "Everything runs in your own browser: prices come straight from Binance and nothing about you is stored or sent."),
    "method": L("روش و قواعد صداقت", "ڕێباز و یاساکانی ڕاستگۆیی", "Method and honesty rules"),
}
METH = L([
    "سیگنال روی بسته‌شدن کندل خوانده و در باز شدن کندل بعد اجرا می‌شود؛ هیچ نگاهی به آینده نیست.",
    "حد ضرر و حد سود داخل هر کندل بررسی می‌شوند. اگر هر دو در یک کندل ممکن بوده باشند، بدترین حالت (حد ضرر) فرض می‌شود و اگر قیمت با گپ از سطح رد شده باشد، معامله با قیمت باز شدن بسته می‌شود.",
    "کارمزد و لغزش در هر دو طرف هر معامله کسر می‌شود. بازده «خرید و نگهداری» برای مقایسه بدون هزینه است.",
    "آزمون جایگشت (روش تیموتی مسترز): گپ‌های بین کندل‌ها و شکل درون هر کندل جداگانه به‌هم ریخته می‌شوند؛ توزیع بازده همان است ولی هر الگویی از بین می‌رود. p = (تعداد نسخه‌های تصادفیِ بهتر یا مساوی + ۱) ÷ (تعداد نسخه‌ها + ۱).",
    "واک-فوروارد بدون بهینه‌سازی: دوره به ۵ بخش پشت‌سرهم تقسیم و قانون روی هر بخش جدا اجرا می‌شود. با بهینه‌سازی: ۴۰٪ اول فقط آموزش است؛ برای هر یک از ۴ بخش بعدی بهترین مقدار فقط روی همهٔ داده‌های قبل از آن انتخاب و روی همان بخش سنجیده می‌شود.",
    "فقط ارزهایی که امروز در بایننس هستند قابل آزمون‌اند (سوگیری بازماندگی) و گذشته تضمین آینده نیست. این ابزار آموزشی است و توصیهٔ مالی نیست."],
    [
    "سیگناڵ لە داخستنی مۆمدا دەخوێنرێتەوە و لە کردنەوەی مۆمی دواتردا جێبەجێ دەکرێت؛ هیچ تەماشایەکی داهاتوو نییە.",
    "سنووری زیان و قازانج لەناو هەر مۆمێکدا دەپشکنرێن؛ ئەگەر هەردووکیان لە یەک مۆمدا ببن، خراپترین حاڵەت (سنووری زیان) دادەنرێت.",
    "کرێ و خلیسکان لە هەردوو لای هەر مامەڵەیەک دەبڕدرێت.",
    "تاقیکردنەوەی جێگۆڕکێ (ڕێبازی تیمۆتی ماستەرز): بۆشاییەکانی نێوان مۆمەکان و شێوەی ناو هەر مۆمێک جیا جیا تێکەڵ دەکرێن.",
    "واک-فۆروارد: ماوەکە دابەش دەکرێت؛ لەگەڵ باشترکردن، باشترین بەها تەنها لەسەر ڕابردوو هەڵدەبژێردرێت و لەسەر بەشی دواتر دەپێورێت.",
    "تەنها ئەو دراوانەی ئەمڕۆ لە بایننسن تاقی دەکرێنەوە؛ ڕابردوو گەرەنتیی داهاتوو نییە. ئامۆژگاریی دارایی نییە."],
    [
    "A signal is read at a candle's close and executed at the next candle's open; nothing looks ahead.",
    "Stop-loss and take-profit are checked inside each candle. If both could have been hit in the same candle the worse one (the stop) is assumed, and a gap through a level fills at the open.",
    "Fee and slippage are charged on both sides of every trade. Buy & hold, shown for comparison, carries no costs.",
    "Permutation test (Timothy Masters' method): the gaps between candles and the shape inside each candle are shuffled separately; the return distribution stays the same but any pattern is destroyed. p = (random copies as good or better + 1) ÷ (copies + 1).",
    "Walk-forward without optimisation: the period is cut into 5 consecutive stretches and the rule is run on each. With optimisation: the first 40% only trains; for each of the next 4 stretches the best value is chosen on all earlier data and judged on that stretch.",
    "Only coins listed on Binance today can be tested (survivorship bias), and the past does not guarantee the future. An educational tool, not financial advice."])

CSS = """
#slab{margin:14px 0}.sl-form h3{margin:16px 0 6px;font-size:.98rem;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sl-row{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end;margin:8px 0}
.sl-row label{display:flex;flex-direction:column;gap:4px;font-size:.78rem;color:var(--mute)}
#slab select,#slab input{background:#000;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 9px;font:inherit;font-size:.86rem;max-width:100%}
#slab input[type=number]{font-family:'Space Grotesk',Vazirmatn,monospace;direction:ltr}
.sl-cond{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:7px 0;border-top:1px dashed var(--line)}
.sl-x{background:none;border:1px solid var(--line);color:var(--mute);border-radius:99px;width:30px;height:30px;cursor:pointer}
.sl-x:hover{border-color:#ef4444;color:#ef4444}
.sl-run{background:var(--acc);color:#000;border:0;border-radius:99px;padding:9px 18px;font:inherit;font-weight:800;cursor:pointer}
.sl-run[disabled]{opacity:.45;cursor:not-allowed}.sl-pre{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}
"""


def page():
    def intro(lg):
        return (f"<div class='meta'><a href='/'>{T['home'][lg]}</a> / {e(T['title'][lg])}</div>"
                f"<h1>{e(T['title'][lg])}</h1><p class='rc-lead'>{e(T['desc'][lg])}</p><p class='note'>{e(T['local'][lg])}</p>")

    def meth(lg):
        items = "".join(f"<li>{e(x)}</li>" for x in METH[lg])
        return f"<details class='rc-meth' open><summary>{T['method'][lg]}</summary><ul>{items}</ul></details>"

    body = (BR.tri(intro) + "<div id='slab'><p class='mut'>…</p></div>" + BR.tri(meth)
            + f"<script>{BR.LANG_JS}</script>" + BP.LWC + f"<script src='/assets/strategy-lab.js?v={VER}' defer></script>")
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": T["title"]["en"], "description": T["desc"]["en"],
          "applicationCategory": "FinanceApplication", "operatingSystem": "Any", "url": "https://entekhab.net/strategy-lab/",
          "inLanguage": ["fa", "ckb", "en"], "isAccessibleForFree": True}
    extra = f"<style>{BR.RCSS}{CSS}</style><script type='application/ld+json'>{BP.sj(ld)}</script>"
    return BP.page("strategy-lab/", T["title"]["fa"], T["desc"]["fa"], body, extra)


def main():
    url = page()
    BR.add_to_sitemap([url])
    print("strategy lab:", url)


if __name__ == "__main__":
    main()
