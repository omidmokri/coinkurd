#!/usr/bin/env python3
"""Builds /derivatives/ — leverage pressure for BTC, ETH and SOL (fa / ckb / en in one page).
The page is a shell; assets/derivatives.js reads /data/derivatives.json (scripts/derivatives.py, OKX public API)
in the browser, so the numbers stay fresh between builds. Run after build_pages.py."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
from reality_common import L  # noqa: E402

e = BP.e
VER = "1"
T = {
    "title": L("داشبورد مشتقات: فاندینگ، اوپن اینترست، لیکوییدیشن", "داشبۆردی دەرهاتەکان: فەندینگ، ئۆپن ئینتەرێست، لیکویدکردن",
               "Derivatives dashboard: funding, open interest, liquidations"),
    "desc": L("فشار اهرم در بیت‌کوین، اتریوم و سولانا: نرخ فاندینگ ۸ ساعته و سالانه، اوپن اینترست و تغییر ۲۴ ساعته، لیکوییدیشن لانگ و شورت در ۲۴ ساعت و نسبت لانگ به شورت، با توضیح ساده برای هر عدد.",
              "پەستانی لیڤەرێج لە بیتکۆین، ئیتریۆم و سۆلانا: فەندینگی ٨ کاتژمێری و ساڵانە، ئۆپن ئینتەرێست و گۆڕانی ٢٤ کاتژمێر، لیکویدی لۆنگ و شۆرت و ڕێژەی لۆنگ بۆ شۆرت، لەگەڵ ڕوونکردنەوەی سادە.",
              "Leverage pressure in Bitcoin, Ether and Solana: 8-hour and annual funding, open interest and its 24-hour change, long and short liquidations over 24 hours and the long/short ratio, each with a plain explanation."),
    "home": L("خانه", "ماڵەوە", "Home"),
    "term": L("نقشهٔ حرارتی فاندینگ ۴۰ قرارداد و جریان خرید و فروش در ترمینال", "نەخشەی گەرمیی فەندینگی ٤٠ گرێبەست لە تێرمیناڵ", "Funding heatmap of 40 contracts and taker flow in the terminal"),
}
CSS = """
#dv{margin:14px 0}.dv-tabs{display:flex;gap:8px;margin:6px 0 14px}.dv-tabs button{background:#000;color:var(--ink);border:1px solid var(--line);border-radius:99px;padding:7px 18px;font:inherit;font-weight:800;cursor:pointer}
.dv-tabs button.on{background:var(--acc);color:#000;border-color:var(--acc)}
.dv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}
.dv-c{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px}
.dv-c small{color:var(--mute);font-size:.8rem}.dv-c>b{font-size:1.6rem;font-family:'Space Grotesk',Vazirmatn,monospace}.dv-c em{font-style:normal;color:var(--mute);font-size:.8rem}
.dv-c p{margin:8px 0 0;font-size:.8rem;line-height:1.8;color:#c9c9c2}.dv-row{display:flex;justify-content:space-between;gap:8px;font-size:.82rem;flex-wrap:wrap}
.dv-bar{display:flex;height:9px;border-radius:99px;overflow:hidden;background:#222;margin:6px 0}.dv-l,.dv-r{background:#ef4444}.dv-s,.dv-g{background:#22c55e}
.dv-tag{font-size:.72rem;padding:2px 8px;border-radius:99px;vertical-align:middle;border:1px solid var(--line)}.dv-tag.f_ext{background:#ef444433;color:#fca5a5;border-color:#ef4444}
.dv-tag.f_high{background:#f59e0b33;color:#fcd34d}.dv-tag.f_neg{background:#38bdf833;color:#7dd3fc}
.dv-sp{width:100%;height:46px;display:block;margin-top:4px}.dv-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin:14px 0}
.dv-charts .dv-sp{height:90px}.dv-charts h3,.dv-two h3{font-size:.9rem;margin:6px 0}.dv-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.dv-two ul{list-style:none;padding:0;margin:0;font-size:.85rem;line-height:2}
"""


def page():
    def intro(lg):
        return (f"<div class='meta'><a href='/'>{T['home'][lg]}</a> / {e(T['title'][lg])}</div>"
                f"<h1>{e(T['title'][lg])}</h1><p class='rc-lead'>{e(T['desc'][lg])}</p>")

    def more(lg):
        return f"<p class='note'><a href='/terminal/#deriv'>📟 {e(T['term'][lg])}</a></p>"

    body = (BR.tri(intro) + "<div id='dv'><p class='mut'>…</p></div>" + BR.tri(more)
            + f"<script>{BR.LANG_JS}</script><script src='/assets/derivatives.js?v={VER}' defer></script>")
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": T["title"]["en"], "description": T["desc"]["en"],
          "url": "https://entekhab.net/derivatives/", "inLanguage": ["fa", "ckb", "en"]}
    extra = f"<style>{BR.RCSS}{CSS}</style><script type='application/ld+json'>{BP.sj(ld)}</script>"
    return BP.page("derivatives/", T["title"]["fa"], T["desc"]["fa"], body, extra)


def main():
    url = page()
    BR.add_to_sitemap([url])
    print("derivatives:", url)


if __name__ == "__main__":
    main()
