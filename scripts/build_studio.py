#!/usr/bin/env python3
"""Builds /studio/ — Pine Studio: write Pine Script v5/v6 and see it live on a Binance chart, back-test strategies,
with Smart Money Concepts and Kronos forecast layers (fa / ckb / en in one page).
The page is a shell: the tool is assets/studio/ (studio.js, worker.js running PineTS by LuxAlgo, smc.js).
assets/studio/ is free software under the GNU AGPL v3, because PineTS is; the rest of the site is unaffected.
Run after build_pages.py."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
from reality_common import L  # noqa: E402

e = BP.e
VER = "3"
SRC = "https://github.com/omidmokri/coinkurd/tree/main/assets/studio"
T = {
    "title": L("استودیو پاین: کدنویسی و بک‌تست زنده", "ستۆدیۆی پاین: کۆدنووسین و باکتێستی زیندوو", "Pine Studio: live coding and back-testing"),
    "desc": L("Pine Script نسخهٔ ۵ و ۶ را بنویس یا از TradingView بیاور و همان لحظه روی نمودار زندهٔ بایننس ببین، بدون نیاز به TradingView. استراتژی‌ها را بک‌تست کن و لایهٔ اسمارت مانی و پیش‌بینی هوش مصنوعی Kronos را روی نمودار بینداز.",
              "Pine Script v5 و v6 بنووسە یان لە TradingView بیهێنە و دەستبەجێ لەسەر چارتی زیندووی بایننس ببینە، بێ پێویستی بە TradingView. ستراتیژەکان باکتێست بکە و چینی سمارت مەنی و پێشبینیی AIی Kronos بخە سەر چارت.",
              "Write Pine Script v5/v6, or paste it from TradingView, and see it at once on a live Binance chart, no TradingView needed. Back-test strategies, and add Smart Money Concepts and Kronos AI forecast layers."),
    "home": L("خانه", "ماڵەوە", "Home"),
    "local": L("همه‌چیز در مرورگر خودت اجرا می‌شود: کندل‌ها مستقیم از بایننس می‌آیند و کدهایت فقط در همین مرورگر ذخیره می‌شوند.",
               "هەموو شتێک لە وێبگەڕی خۆتدا دەکرێت: مۆمەکان ڕاستەوخۆ لە بایننسەوە دێن و کۆدەکانت تەنها لەم وێبگەڕەدا پاشەکەوت دەکرێن.",
               "Everything runs in your own browser: candles come straight from Binance and your scripts are saved only in this browser."),
    "how": L("راهنما و منابع", "ڕێنمایی و سەرچاوەکان", "Guide and sources"),
}
HOW = L([
    "از منوی «نمونه‌ها» شروع کن یا کد Pine خودت را بچسبان و Ctrl+Enter بزن. در حالت «زنده» با بسته شدن هر کندل، کد دوباره اجرا می‌شود.",
    "برای بک‌تست، به‌جای indicator() از strategy() استفاده کن. سود خالص، درصد برد، ضریب سود، بیشترین افت، شارپ، سورتینو، منحنی سرمایه و فهرست معاملات در «تستر استراتژی» می‌آیند. کارمزد را در strategy() با commission_value بده.",
    "لایهٔ SMC (اسمارت مانی): سقف و کف‌های چرخشی، شکست ساختار (BOS) و تغییر کاراکتر (CHoCH)، اوردر بلاک، شکاف ارزش منصفانه (FVG)، نقدینگی برابر و جاروشدن آن، سقف و کف دیروز و هفتهٔ قبل و ناحیهٔ پریمیوم/دیسکانت.",
    "لایهٔ Kronos: پیش‌بینی مدل پایهٔ هوش مصنوعی Kronos (AAAI 2026، مجوز MIT) که هر ساعت برای ارزهای اصلی در تایم‌فریم یک‌ساعته ساخته می‌شود. یک برآورد آماری است، نه سیگنال.",
    "موتور اجرای Pine، کتابخانهٔ متن‌باز PineTS از LuxAlgo است (مجوز AGPL-3.0). به همین دلیل کد این ابزار هم متن‌باز است. برخی امکانات پیشرفتهٔ Pine (مانند request.security چندتایم‌فریمی) ممکن است کامل پشتیبانی نشوند.",
    "Pine Script علامت تجاری TradingView است و این ابزار وابسته به TradingView نیست. آموزشی است و توصیهٔ مالی نیست."],
    [
    "لە «نموونەکان» دەست پێبکە یان کۆدی Pineی خۆت دابنێ و Ctrl+Enter لێبدە. لە دۆخی «زیندوو» بە داخستنی هەر مۆمێک کۆدەکە دووبارە جێبەجێ دەکرێت.",
    "بۆ باکتێست لەجیاتی indicator() لە strategy() کەڵک وەربگرە. قازانجی پاک، ڕێژەی بردنەوە، داکەوتن، شارپ و لیستی مامەڵەکان لە «تاقیکەری ستراتیژ»دا دێن.",
    "چینی SMC: لوتکە و بنە سووڕاوەکان، BOS و CHoCH، ئۆردەر بلۆک، FVG، شلەیی و ماشینی ئەو، لوتکە و بنی دوێنێ و هەفتەی پێشوو و ناوچەی پرێمیۆم/دیسکاونت.",
    "چینی Kronos: پێشبینیی مۆدێلی بنەڕەتیی AIی Kronos (مۆڵەتی MIT) کە هەموو کاتژمێرێک بۆ دراوە سەرەکییەکان دروست دەکرێت. خەمڵاندنێکی ئامارییە، نەک سیگناڵ.",
    "بزوێنەری Pine، کتێبخانەی کراوەی PineTSی LuxAlgoیە (مۆڵەتی AGPL-3.0)، بۆیە کۆدی ئەم ئامرازەش کراوەیە.",
    "Pine Script نیشانەی بازرگانیی TradingViewە و ئەم ئامرازە پەیوەست بە TradingView نییە. فێرکارییە، ئامۆژگاریی دارایی نییە."],
    [
    "Start from “Examples” or paste your own Pine code and press Ctrl+Enter. In “Live” mode the script re-runs as each candle closes.",
    "To back-test, use strategy() instead of indicator(). Net profit, win rate, profit factor, max drawdown, Sharpe, Sortino, the equity curve and every trade appear in the “Strategy tester”. Set fees in strategy() with commission_value.",
    "SMC layer: swing highs and lows, break of structure (BOS) and change of character (CHoCH), order blocks, fair value gaps (FVG), equal-high/low liquidity and its sweeps, previous day and week highs and lows, and the premium/discount zones.",
    "Kronos layer: forecasts from the Kronos foundation model for candlesticks (AAAI 2026, MIT licence), made every hour for the main coins on the 1-hour chart. A statistical estimate, not a signal.",
    "Pine runs on LuxAlgo's open-source PineTS (AGPL-3.0), so this tool's code is open source too. Some advanced Pine features (such as multi-timeframe request.security) may not be fully supported.",
    "Pine Script is a trademark of TradingView; this tool is not affiliated with TradingView. Educational, not financial advice."])

CSS = """
main.w:has(#studio){max-width:1600px}
#studio{margin:12px 0;--pb:#0b111b;--pl:#1f2937}
.ps-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
.ps-coin{width:92px;background:#000;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 9px;font:inherit;font-weight:800;text-transform:uppercase;direction:ltr}
.ps-seg{display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;direction:ltr}
.ps-seg button{background:none;border:0;color:var(--mute);padding:6px 9px;font:inherit;font-size:.82rem;cursor:pointer}
.ps-seg button.on{background:var(--acc);color:#000;font-weight:800}
.ps-n,.ps-ex,.ps-name{background:#000;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 8px;font:inherit;font-size:.82rem;max-width:100%}
.ps-name{width:130px}
.ps-run{background:var(--acc);color:#000;border:0;border-radius:99px;padding:8px 16px;font:inherit;font-weight:800;cursor:pointer}
.ps-run small{opacity:.6;font-weight:600;font-size:.7rem}.ps-run.busy{opacity:.6}
.ps-chk{display:flex;gap:5px;align-items:center;font-size:.82rem;color:var(--mute);cursor:pointer;border:1px solid var(--line);border-radius:99px;padding:5px 10px}
.ps-price{margin-inline-start:auto;font-family:'Space Grotesk',Vazirmatn,monospace;font-size:1.05rem;direction:ltr}.ps-price.up{color:#16c784}.ps-price.dn{color:#ea3943}
.ps-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,38%);gap:10px;min-height:560px}
[dir=rtl] .ps-main{direction:ltr}[dir=rtl] .ps-main>*{direction:rtl}
.ps-chart{position:relative;background:var(--pb);border:1px solid var(--pl);border-radius:14px;overflow:hidden;min-height:560px}
.ps-chart-in{position:absolute;inset:0}.ps-ovl{position:absolute;left:0;top:0;pointer-events:none;z-index:3}
.ps-status{position:absolute;inset-inline:12px;bottom:40px;z-index:4;font-size:.82rem;background:rgba(0,0,0,.75);border-radius:10px;padding:6px 10px;display:none}
.ps-status.on{display:block}.ps-status.err{color:#fca5a5;border:1px solid #7f1d1d}
.ps-legend{position:absolute;left:10px;top:8px;z-index:4;font-size:.78rem;color:var(--mute);direction:ltr;pointer-events:none;text-shadow:0 1px 2px #000}
.ps-legend b{color:var(--ink)}
.ps-side{display:flex;flex-direction:column;gap:6px;min-width:0}
.ps-edbar{display:flex;flex-wrap:wrap;gap:6px}
.ps-btn{background:none;border:1px solid var(--line);color:var(--ink);border-radius:99px;padding:5px 11px;font:inherit;font-size:.8rem;cursor:pointer}.ps-btn:hover{border-color:var(--acc)}
.ps-ed{position:relative;flex:1;min-height:420px;background:#05080f;border:1px solid var(--pl);border-radius:14px;overflow:hidden;direction:ltr;font:13px/1.55 'JetBrains Mono','Fira Code',Consolas,monospace}
.ps-gut{position:absolute;left:0;top:0;bottom:0;width:38px;margin:0;padding:10px 6px 10px 0;text-align:right;color:#475569;overflow:hidden;font:inherit;background:#070b14;border-right:1px solid #111827;user-select:none}
.ps-hl,.ps-ta{position:absolute;left:38px;right:0;top:0;bottom:0;margin:0;padding:10px 12px;font:inherit;white-space:pre;overflow:auto;tab-size:4}
.ps-hl{color:#cbd5e1;pointer-events:none}.ps-ta{background:transparent;color:transparent;caret-color:#f7931a;border:0;outline:0;resize:none}
.ps-ta::selection{background:rgba(247,147,26,.25)}
.ps-hl .k{color:#c084fc;font-style:normal}.ps-hl .f{color:#38bdf8;font-style:normal}.ps-hl .n{color:#fbbf24;font-style:normal}.ps-hl .s{color:#86efac;font-style:normal}.ps-hl .c{color:#64748b}
.ps-errl{background:rgba(239,68,68,.18);box-shadow:inset 3px 0 #ef4444}
.ps-hint{font-size:.76rem;color:var(--mute);margin:0}
.ps-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-top:12px;border-bottom:1px solid var(--line)}
.ps-tabs button{background:none;border:0;border-bottom:2px solid transparent;color:var(--mute);padding:8px 12px;font:inherit;font-size:.86rem;cursor:pointer}
.ps-tabs button.on{color:var(--ink);border-color:var(--acc);font-weight:800}
.ps-panes{background:var(--pb);border:1px solid var(--pl);border-top:0;border-radius:0 0 14px 14px;padding:12px;min-height:180px}
.ps-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.ps-card{background:#05080f;border:1px solid var(--pl);border-radius:12px;padding:9px 11px;display:flex;flex-direction:column;gap:3px}
.ps-card small{color:var(--mute);font-size:.72rem}.ps-card b{font-family:'Space Grotesk',Vazirmatn,monospace;font-size:1rem}
.up{color:#16c784}.dn{color:#ea3943}.ps-mut{color:var(--mute);font-size:.86rem}
.ps-eq{height:240px;position:relative;margin-top:6px}
.ps-tw{max-height:360px;overflow:auto}.ps-tbl{width:100%;border-collapse:collapse;font-size:.8rem}
.ps-tbl th,.ps-tbl td{padding:6px 8px;border-bottom:1px solid #111827;text-align:start}.ps-tbl small{color:var(--mute)}
.ps-e{color:#fca5a5}.ps-e code{display:block;white-space:pre-wrap;direction:ltr;text-align:left;margin-top:4px;color:#fecaca}.ps-ok{color:#86efac}.ps-w{color:#fde68a}.ps-a{margin:3px 0}
.ps-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.ps-smc ul{margin:4px 0;padding-inline-start:18px;font-size:.84rem}
.ps-toast{position:fixed;bottom:24px;inset-inline-start:50%;transform:translateX(-50%);background:var(--acc);color:#000;font-weight:800;border-radius:99px;padding:8px 16px;z-index:99}
.ps-scta{width:100%;min-height:170px;background:#05080f;color:#cbd5e1;border:1px solid var(--pl);border-radius:12px;padding:10px;font:12.5px/1.55 'JetBrains Mono',Consolas,monospace;direction:ltr;text-align:left;resize:vertical;tab-size:4;margin:6px 0}
.ps-scan tr[data-s]{cursor:pointer}.ps-scan tr[data-s]:hover{background:rgba(247,147,26,.06)}.ps-scan tr.hit{background:rgba(22,199,132,.07)}
.ps-hook{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.ps-hook small{color:var(--mute);min-width:110px}
.ps-hook code{flex:1;min-width:240px;background:#05080f;border:1px solid var(--pl);border-radius:10px;padding:7px 10px;direction:ltr;text-align:left;font-size:.78rem;word-break:break-all}
.ps-feed{margin-top:10px;max-height:380px;overflow:auto}
@media (max-width:900px){.ps-main{grid-template-columns:1fr}.ps-chart{min-height:420px}.ps-ed{min-height:300px}.ps-price{margin-inline-start:0}}
"""


def page():
    def intro(lg):
        return (f"<div class='meta'><a href='/'>{T['home'][lg]}</a> / {e(T['title'][lg])}</div>"
                f"<h1>{e(T['title'][lg])}</h1><p class='rc-lead'>{e(T['desc'][lg])}</p><p class='note'>{e(T['local'][lg])}</p>")

    def how(lg):
        items = "".join(f"<li>{e(x)}</li>" for x in HOW[lg])
        src = {"fa": "کد منبع این ابزار (AGPL-3.0)", "ckb": "کۆدی سەرچاوەی ئەم ئامرازە (AGPL-3.0)", "en": "Source code of this tool (AGPL-3.0)"}[lg]
        return (f"<details class='rc-meth'><summary>{T['how'][lg]}</summary><ul>{items}</ul>"
                f"<p><a href='{SRC}' rel='noopener'>{src}</a> · <a href='https://github.com/LuxAlgo/PineTS' rel='noopener'>PineTS</a> · "
                f"<a href='https://github.com/shiyu-coder/Kronos' rel='noopener'>Kronos</a> · "
                f"<a href='https://github.com/joshyattridge/smart-money-concepts' rel='noopener'>smart-money-concepts</a></p></details>")

    body = (BR.tri(intro) + "<div id='studio'><p class='mut'>…</p></div>" + BR.tri(how)
            + f"<script>{BR.LANG_JS}</script><script src='/assets/vendor/lwc5.js'></script>"
            + f"<script src='/assets/studio/smc.js?v={VER}' defer></script><script src='/assets/studio/studio.js?v={VER}' defer></script>")
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": T["title"]["en"], "description": T["desc"]["en"],
          "applicationCategory": "FinanceApplication", "operatingSystem": "Any", "url": "https://entekhab.net/studio/",
          "inLanguage": ["fa", "ckb", "en"], "isAccessibleForFree": True, "license": "https://www.gnu.org/licenses/agpl-3.0.html"}
    extra = f"<style>{BR.RCSS}{CSS}</style><script type='application/ld+json'>{BP.sj(ld)}</script>"
    return BP.page("studio/", T["title"]["fa"], T["desc"]["fa"], body, extra)


def main():
    url = page()
    BR.add_to_sitemap([url])
    print("pine studio:", url)


if __name__ == "__main__":
    main()
