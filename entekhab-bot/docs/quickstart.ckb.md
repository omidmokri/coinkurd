# بۆتی بازرگانیی ئەنتخاب — ڕێنمایی خێرا

## ئەمە چییە

دابەشکردنێکی ئەنتخابە لەسەر بۆتی سەرچاوەکراوەی
[Freqtrade](https://www.freqtrade.io/): ڕێکخستنێکی وریا، ٤٦٥ ستراتیژی کۆمەڵگا، و
بەڵگەنامە بە فارسی، کوردی و ئینگلیزی. خودی بزوێنەرەکە هەمان Freqtradeی سەرەوەیە و
هیچ گۆڕانی تێدا نەکراوە؛ لە وێنەی فەرمیی Docker دەهێنرێت.

مافی لەبەرگرتنەوە، مۆڵەتنامە و لیستی تەواوی گۆڕانکارییەکان لە
[`../NOTICE.md`](../NOTICE.md). ئەنتخاب **پەیوەندیی بە پڕۆژەی Freqtradeوە نییە و
لەلایەن ئەوانەوە پەسەند نەکراوە**.

## ئەمە چی نییە

- خزمەتگوزاریی میوانداریکراو نییە. تۆ خۆت لەسەر سێرڤەری خۆت دەیخەیتە کار و
  کلیلەکانی API لای خۆت دەمێنێتەوە.
- ئامۆژگاریی دارایی نییە و بەڵێنی قازانج نادات.

## دامەزراندن

```bash
git clone https://github.com/omidmokri/coinkurd.git
cd coinkurd/entekhab-bot
./install.sh
```

پێویستی بە Docker و Docker Compose v2 هەیە. `dry_run` بە بنەڕەت `true`ـە — بۆت بە
پارەی خەیاڵی کار دەکات هەتا خۆت نەیگۆڕیت.

## یەکەم جار

```bash
docker compose run --rm entekhab-bot download-data --timerange 20240101- -t 5m 1h
docker compose run --rm entekhab-bot strategy-updater --strategy-list NotAnotherSMAOffsetStrategyHO
docker compose run --rm entekhab-bot lookahead-analysis --strategy NotAnotherSMAOffsetStrategyHO
docker compose run --rm entekhab-bot backtesting --strategy NotAnotherSMAOffsetStrategyHO \
    --timerange 20250101-20251101 --breakdown month
docker compose up -d && docker compose logs -f
```

## پێش ئەوەی بە پارەی ڕاستەقینە دەست پێبکەیت

- **٤٦٢ لە ٤٦٥** ستراتیژی هێشتا ڕووکاری **وەشانی ٢**ی Freqtrade بەکاردەهێنن و بەبێ
  گۆڕین لەسەر وەشانی ئێستا کار ناکەن.
- **٢٣٩ لە ٤٦٥** پارامەترەکانیان بە hyperopt لەسەر ماوەیەکی دیاریکراوی ڕابردوو
  ڕێکخراون و لە فایلەکەدا جێگیر کراون — مەترسیی زۆری overfitting.
- مەخزەنی سەرچاوە **ئەرشیڤ کراوە** و لە **شوباتی ٢٠٢٤**ەوە نوێ نەکراوەتەوە.
- هەندێک ستراتیژیی بەناوبانگ stoploss ـێکی زۆر فراوانیان هەیە
  (`NotAnotherSMAOffsetStrategyHO` بە `-0.35`، واتە ٣٥٪ زەرەر لە هەر مامەڵەیەکدا).
- بۆ هەر کلیلێکی API کە دەیدەیتە بۆتەکە، دەرهێنان (withdraw) بکوژێنەوە.

## مۆڵەتنامە

GPL-3.0 — [`../LICENSE`](../LICENSE). بەبێ هیچ گەرەنتییەک بڵاوکراوەتەوە.
