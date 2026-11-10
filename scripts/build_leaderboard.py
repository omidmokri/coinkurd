#!/usr/bin/env python3
"""Builds /leaderboard/ — the paper-trading leaderboard (fa / ckb / en). The page is a shell; assets/leaderboard.js
reads /data/leaderboard.json, which the bot writes (scripts/bot_paper.py). Run after build_pages.py."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import build_strategy_lab as SL  # noqa: E402  (button style)
from reality_common import L  # noqa: E402

e = BP.e
VER = "1"
T = {
    "title": L("جدول برترین‌های معاملهٔ آزمایشی", "خشتەی باشترینەکانی مامەڵەی تاقیکاری", "Paper-trading leaderboard"),
    "desc": L("رقابت با ۱۰٬۰۰۰ دلار مجازی در ربات تلگرام انتخاب: قیمت هر معامله را خود ربات از بایننس ثبت می‌کند، پس نتیجه‌ها قابل دستکاری نیست. رتبه‌بندی بعد از کارمزد، با بیشترین افت و سورتینو.",
              "ڕکابەری بە ١٠٬٠٠٠ دۆلاری مەجازی لە بۆتی تێلێگرامی ئینتخاب: نرخی هەر مامەڵەیەک بۆتەکە خۆی لە بایننس تۆمار دەکات، بۆیە ئەنجامەکان دەستکاری ناکرێن.",
              "Compete with $10,000 of virtual money in the Entekhab Telegram bot: the bot itself records every trade's price from Binance, so results cannot be edited. Ranked after fees, with max drawdown and Sortino."),
    "home": L("خانه", "ماڵەوە", "Home"),
}
CSS = """
#lb{margin:14px 0}.lb-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.lb-tabs button{background:#000;color:var(--ink);border:1px solid var(--line);border-radius:99px;padding:6px 14px;font:inherit;cursor:pointer}
.lb-tabs button.on{background:var(--acc);color:#000;border-color:var(--acc);font-weight:800}
"""


def page():
    def intro(lg):
        return (f"<div class='meta'><a href='/'>{T['home'][lg]}</a> / {e(T['title'][lg])}</div>"
                f"<h1>{e(T['title'][lg])}</h1><p class='rc-lead'>{e(T['desc'][lg])}</p>")

    body = BR.tri(intro) + "<div id='lb'><p class='mut'>…</p></div>" + f"<script>{BR.LANG_JS}</script><script src='/assets/leaderboard.js?v={VER}' defer></script>"
    extra = f"<style>{BR.RCSS}{SL.CSS}{CSS}</style>"
    return BP.page("leaderboard/", T["title"]["fa"], T["desc"]["fa"], body, extra)


def main():
    url = page()
    BR.add_to_sitemap([url])
    print("leaderboard:", url)


if __name__ == "__main__":
    main()
