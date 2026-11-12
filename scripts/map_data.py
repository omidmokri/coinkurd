# -*- coding: utf-8 -*-
"""Kurdish titles and UI strings for /map/ — the learning map.

The map does not hold any teaching content of its own. Every row on it points at
something that already exists on the site (an academy lesson, a glossary term, a
lab tool, a page) or at a source the academy lesson itself cites. This file only
adds what the underlying data is missing: Sorani Kurdish titles (the academy is
written in Persian with English titles) and the map's own interface strings.

A missing key falls back to Persian, so the map never shows an empty row.
"""

# ---------------------------------------------------------------- interface
UI = {
    "t":      ("نقشهٔ یادگیری", "نەخشەی فێربوون", "Learning map"),
    "h1":     ("می‌خواهم یاد بگیرم…", "دەمەوێت فێربم…", "I want to learn…"),
    "lead":   ("هر گره یک موضوع است. روی آن کلیک کنید تا فهرست کارهای آن موضوع باز شود:"
               " درس‌های سایت، اصطلاح‌ها، ابزارها و منابعی که همان درس‌ها به آن‌ها ارجاع می‌دهند."
               " هر چیزی را که خواندید تیک بزنید؛ پیشرفت فقط در مرورگر خودتان می‌ماند.",
               "هەر گرێیەک بابەتێکە. کلیکی لێ بکە تا لیستی کارەکانی ئەو بابەتە بکرێتەوە:"
               " وانەکانی ماڵپەر، زاراوەکان، ئامرازەکان و ئەو سەرچاوانەی هەمان وانەکان ئاماژەیان پێ دەکەن."
               " هەر شتێک خوێندتەوە نیشانەی بکە؛ پێشکەوتن تەنها لە وێبگەڕی خۆتدا دەمێنێتەوە.",
               "Every node is a topic. Open one for its checklist: the site's own lessons, the terms,"
               " the tools, and the sources those lessons cite. Tick off whatever you have read —"
               " progress stays in your own browser."),
    "search": ("🔎 موضوع، درس یا اصطلاح…", "🔎 بابەت، وانە یان زاراوە…", "🔎 A topic, a lesson, a term…"),
    "nores":  ("چیزی پیدا نشد.", "هیچ شتێک نەدۆزرایەوە.", "Nothing found."),
    "topics": ("موضوع", "بابەت", "topics"),
    "res":    ("منبع", "سەرچاوە", "resources"),
    "done":   ("انجام‌شده", "تەواوکراو", "done"),
    "all":    ("همهٔ موضوع‌ها", "هەموو بابەتەکان", "All topics"),
    "soon":   ("درس‌های این موضوع در حال تولید است؛ آن‌چه پایین می‌بینید همین حالا در دسترس است.",
               "وانەکانی ئەم بابەتە لە بەرهەمهێناندان؛ ئەوەی خوارەوە دەبینیت ئێستا بەردەستە.",
               "The lessons for this topic are still being written; what you see below is available now."),
    "fac":    ("دانشکده", "کۆلێژ", "Faculty"),
    "zoom":   ("نقشه را بکشید و با چرخ ماوس بزرگ کنید.", "نەخشە ڕاکێشە و بە چەرخی ماوس گەورەی بکە.",
               "Drag the map; scroll to zoom."),
    "list":   ("نمایش فهرستی", "پیشاندانی لیستی", "List view"),
    "graph":  ("نمایش نقشه", "پیشاندانی نەخشە", "Map view"),
    "back":   ("↩ نقشهٔ یادگیری", "↩ نەخشەی فێربوون", "↩ Learning map"),
    "reset":  ("پاک‌کردن تیک‌های این موضوع", "سڕینەوەی نیشانەکانی ئەم بابەتە", "Clear this topic's ticks"),
    "s_les":  ("درس‌های سایت", "وانەکانی ماڵپەر", "Lessons on this site"),
    "s_ext":  ("منابع بیرونی", "سەرچاوەکانی دەرەکی", "Outside sources"),
    "s_trm":  ("اصطلاح‌هایی که باید بدانید", "زاراوەکانی پێویست", "Terms you should know"),
    "s_tol":  ("ابزار و تمرین عملی", "ئامراز و ڕاهێنانی کرداری", "Tools & hands-on practice"),
    "s_pat":  ("مسیر یادگیری و آزمون", "ڕێڕەوی فێربوون و تاقیکردنەوە", "Learning path & quizzes"),
    "min":    ("دقیقه", "خولەک", "min"),
    "lv":     ("سطح", "ئاست", "level"),
    "nextt":  ("موضوع بعدی", "بابەتی دواتر", "Next topic"),
    "prevt":  ("موضوع پیشین", "بابەتی پێشوو", "Previous topic"),
    "note":   ("آموزشی است، توصیهٔ مالی نیست.", "فێرکارییە، ئامۆژگاریی دارایی نییە.",
               "Educational, not financial advice."),
    "hubnote": ("همهٔ درس‌ها، اصطلاح‌ها و ابزارهای entekhab.net روی یک نقشه — به فارسی، کوردی و انگلیسی.",
                "هەموو وانە، زاراوە و ئامرازەکانی entekhab.net لەسەر یەک نەخشە — بە فارسی، کوردی و ئینگلیزی.",
                "Every lesson, term and tool on entekhab.net on one map — in Persian, Kurdish and English."),
}

# ---------------------------------------------------------------- clusters (graph colouring)
# faculty id -> cluster key; clusters only group the nodes visually on the map
CLUSTER = {
    "f1": "base", "f2": "tech", "f3": "asset", "f4": "sec", "f5": "trade",
    "f6": "ta", "f7": "fa", "f8": "chain", "f9": "trade", "f10": "risk",
    "f11": "tech", "f12": "research", "f13": "ta",
}
CLUSTERS = {
    "base":     (("بنیان‌ها", "بنەڕەتەکان", "Foundations"), "#f7931a"),
    "tech":     (("فناوری", "تەکنەلۆژیا", "Technology"), "#7c6cff"),
    "asset":    (("دارایی‌ها", "سەرمایەکان", "Assets"), "#2dd4bf"),
    "sec":      (("امنیت", "ئاسایش", "Security"), "#ef4444"),
    "trade":    (("معامله", "مامەڵە", "Trading"), "#22c55e"),
    "ta":       (("تحلیل تکنیکال", "شیکاریی تەکنیکی", "Technical analysis"), "#38bdf8"),
    "fa":       (("تحلیل فاندامنتال", "شیکاریی بنەڕەتی", "Fundamental analysis"), "#eab308"),
    "chain":    (("آنچین", "ئۆن‌چەین", "On-chain"), "#a3e635"),
    "risk":     (("ریسک", "مەترسی", "Risk"), "#fb7185"),
    "research": (("پژوهش", "توێژینەوە", "Research"), "#c084fc"),
}

# ---------------------------------------------------------------- Kurdish: faculties
FAC_CKB = {
    "f1": "بنەڕەتەکانی ئابووری و بازاڕی کریپتۆ",
    "f2": "بلۆکچەین و نهێنینووسین",
    "f3": "بیتکۆین، ئیسیریۆم و کریپتۆکان",
    "f4": "جزدان و ئاسایشی سەرمایە",
    "f5": "بۆرسەکان و کارکردی مامەڵەکان",
    "f6": "شیکاریی تەکنیکی",
    "f7": "شیکاریی بنەڕەتی",
    "f8": "شیکاریی ئۆن‌چەین",
    "f9": "مامەڵەکردنی پیشەیی",
    "f10": "بەڕێوەبردنی سەرمایە و مەترسی",
    "f11": "دیفای، وێب ٣ و تەکنەلۆژیای پێشکەوتوو",
    "f12": "توێژینەوەی تایبەت و پڕۆژەی کۆتایی",
    "f13": "ستراتیژی سێگۆشە و تونێل (ڕێبازی ئەندازیار ئومێد دەباغچی مکری)",
}

# ---------------------------------------------------------------- short labels for the graph
# a node on the map is a few words wide; a faculty whose title carries an attribution is drawn
# by the method's name alone. The full title is still the page's heading and its card.
FAC_SHORT = {
    "f13": ("استراتژی مثلثات و تونل", "ستراتیژی سێگۆشە و تونێل", "The Triangles & Tunnel method"),
}

# ---------------------------------------------------------------- faculty summaries (ckb, en)
# the academy stores its summaries in Persian only; these are the same sentence in the
# other two languages, so a topic page reads in whichever language the site is set to
FAC_SUM = {
    "f1": ("پارە، هەڵاوسان، دراوی بەردەست، دابینکردن و داواکاری، بەهای بازاڕ و پێکهاتەی دابینکردنی کریپتۆ —"
           " ئەو زمانی هاوبەشە کە بەشی دیکەی خولەکە لەسەری دروست دەبێت.",
           "Money, inflation, liquidity, supply and demand, market capitalisation and how crypto supply is"
           " structured — the shared vocabulary the rest of the course is built on."),
    "f2": ("بلۆک، هاش، کلیلی گشتی و تایبەت، واژووی دیجیتاڵ، ڕێککەوتنی PoW و PoS، فۆرک، چینەکان، پردەکان"
           " و سێگۆشەی بلۆکچەین.",
           "Blocks, hashes, public and private keys, digital signatures, PoW and PoS consensus, forks,"
           " layers, bridges and the blockchain trilemma."),
    "f3": ("بیتکۆین، ئیسیریۆم و گرێبەستی زیرەک، تۆڕەکانی خێرا، ستەیبڵکۆین، جۆرەکانی تۆکن، تۆکنۆمیکس،"
           " وایتپەیپەر و دۆزینەوەی فێڵ.",
           "Bitcoin, Ethereum and smart contracts, high-throughput chains, stablecoins, token types,"
           " tokenomics, whitepapers and spotting scams."),
    "f4": ("جزدانی گەرم و سارد، ئەمانەتی و نائەمانەتی، ڕستەی گەڕاندنەوە، تۆڕەکانی گواستنەوە، گاز،"
           " ڕەزامەندیی گرێبەست، فیشینگ و ئەندازیاریی کۆمەڵایەتی.",
           "Hot and cold wallets, custodial and non-custodial, seed phrases, transfer networks, gas,"
           " contract approvals, phishing and social engineering."),
    "f5": ("بۆرسەی ناوەندی و نائاوەندی، دەفتەری داواکاری، جۆرەکانی داواکاری، سپرێد و سلیپیج، کرێ، سپات،"
           " مارجین، فیوچەرز، لیڤەرج، لیکویدکردن و فاندینگ.",
           "Centralised and decentralised exchanges, the order book, order types, spread and slippage,"
           " fees, spot, margin, futures, leverage, liquidation and funding."),
    "f6": ("کەندیل، تایمفرەیم، ڕەوت، پاڵپشت و بەربەست، هێڵی ڕەوت، شکان و پوڵبەک، قەبارە، نەخشەکان،"
           " فیبۆناچی، ئیندیکاتۆرەکان، پێکهاتەی بازاڕ و کاری چەند تایمفرەیمی.",
           "Candles, timeframes, trend, support and resistance, trendlines, breakouts and pullbacks,"
           " volume, patterns, Fibonacci, indicators, market structure and multi-timeframe work."),
    "f7": ("هەڵسەنگاندنی پڕۆژە، ئابووریی تۆکن، داهاتی پڕۆتۆکۆل، TVL، بەکارهێنەری چالاک، ئازادکردنی تۆکن،"
           " وەبەرهێنەران، هاوڕکێبەران و مەترسیی یاسایی.",
           "Valuing a project, token economics, protocol revenue, TVL, active users, token unlocks,"
           " investors, competitors and regulatory risk."),
    "f8": ("خوێندنەوەی خودی زنجیرە: ناونیشان و مامەڵەکان، ڕەوتی هاتوو و ڕۆیشتووی بۆرسەکان، نەهەنگەکان،"
           " دابەشبوونی دابینکردن، MVRV، NUPL، SOPR و خولەکانی بازاڕ.",
           "Reading the chain itself: addresses and transactions, exchange in- and outflows, whales,"
           " supply distribution, MVRV, NUPL, SOPR and market cycles."),
    "f9": ("دروستکردنی سیستەمی مامەڵە: یاسای چوونەژوورەوە و دەرەوە، وەستانی زەرەر و ئامانج، R:R،"
           " بەکتێست بێ‌نیگای داهاتوو، فۆرواردتێست، ڕێژەی بردن، چاوەڕوانیی ماتماتیکی، داکشان و مێشکی بازرگان.",
           "Building a trading system: entry and exit rules, stops and targets, R:R, backtesting without"
           " look-ahead, forward testing, win rate, expectancy, drawdown and the trader's own mind."),
    "f10": ("سەرمایەی بەر مەترسی و مەترسیی جێگیر، دیاریکردنی قەبارەی پۆزیشن، کۆنترۆڵی داکشان، مەترسیی"
            " دراوی بەردەست و لای بەرامبەر، لیڤەرج، پەیوەندی، جیاوازکردن و پلانی قەیران.",
            "Risk capital and fixed risk, position sizing, drawdown control, liquidity and counterparty"
            " risk, leverage, correlation, diversification and crisis plans."),
    "f11": ("قەرزدانی نائاوەندی، حەوزی دراوی بەردەست و زەرەری ناجێگیر، یێلد فارمینگ، ستەیکینگ و"
            " ڕیستەیکینگ، DAO، NFT، RWA، بەڵگەی ZK، ڕۆڵئاپ، MEV و ئاسایشی گرێبەست.",
            "Decentralised lending, liquidity pools and impermanent loss, yield farming, staking and"
            " restaking, DAOs, NFTs, RWAs, ZK proofs, rollups, MEV and contract security."),
    "f12": ("هەڵبژاردنی تایبەتمەندی و بردنی توێژینەوەیەکی ڕاستەقینە لە پرسیارەوە تا بەرگری.",
            "Choosing a specialisation and carrying one real piece of research from question to defence."),
    "f13": ("ترێندلاینی لەشی، پیڤۆتەکان، پێنج ناوچە و چوار ئامانجی سێگۆشە، تونێل، دەستەئاڵا، کوژ،"
            " چوونەژوورەوەی بادی‌وەی، وەستانی زەرەری ١٪ و سنوورەکانی ڕاستگۆیانەی ڕێباز.",
            "The body-based trendline, pivots, the triangle's five zones and four targets, the tunnel,"
            " the flag-pole, Kouzh, the BodyWay entry, the 1% stop and the method's honest limits."),
}

# ---------------------------------------------------------------- Kurdish: courses
CRS_CKB = {
    "f1-c1": "پارە و مێژووی",
    "f1-c2": "نرخ، هەڵاوسان و سیاسەتی دراوی",
    "f1-c3": "پێکهاتەی بازاڕی کریپتۆ",
    "f2-c1": "بنەڕەتەکانی بلۆکچەین",
    "f2-c2": "نهێنینووسینی کرداری",
    "f2-c3": "ڕێککەوتن و پەسەندکردنی مامەڵە",
    "f2-c4": "گەشەسەندن، پانکردنەوە و پەیوەندیی زنجیرەکان",
    "f3-c1": "بیتکۆین و تۆڕەکانی گرێبەستی زیرەک",
    "f3-c2": "ستەیبڵکۆینەکان و جۆرەکانی تۆکن",
    "f3-c3": "بنکە و گێڕانەوەکانی بازاڕ",
    "f3-c4": "هەڵسەنگاندنی پڕۆژە و دۆزینەوەی فێڵ",
    "f4-c1": "بنەڕەتەکانی جزدان و کلیلەکان",
    "f4-c2": "گواستنەوەی سەلامەت و کارلێک لەگەڵ گرێبەستەکان",
    "f4-c3": "بەرگری لە هێرش و پلانی گەڕاندنەوە",
    "f13-c1": "بنەڕەتی ڕێباز: لەش، پیڤۆت و ڕێگرێشن",
    "f13-c2": "نەخشەی سێگۆشە: پێنج ناوچە و چوار ئامانج",
    "f13-c3": "نەخشەی تونێل (کەناڵ)",
    "f13-c4": "دەستەئاڵا و کوژ",
    "f13-c5": "ڕێبازی بادی‌وەی: چوونەژوورەوە، وەستانی زەرەر، قەبارە و چوونەدەرەوە",
    "f13-c6": "شیکاریی گشتی، چێکلیست و سنوورەکانی ڕێباز",
}

# ---------------------------------------------------------------- Kurdish: lessons
LES_CKB = {
    "f1-c1-l1": "پارە چییە و چ کارێک دەکات؟",
    "f1-c1-l2": "مێژووی پارە، بانکداری و لەدایکبوونی بیتکۆین",
    "f1-c1-l3": "پارەی فیات، پارەی دیجیتاڵ، کریپتۆ و CBDC",
    "f1-c2-l1": "دابینکردن و داواکاری و دۆزینەوەی نرخ",
    "f1-c2-l2": "هەڵاوسان، ڕێژەی سوو، دراوی بەردەست و سیاسەتی دراوی",
    "f1-c3-l1": "بەهای بازاڕ و مانای ڕاستەقینەی",
    "f1-c3-l2": "دابینکردنی گشتی، بەردەست و زۆرترین؛ FDV، بڵاوکردنەوە و لاوازبوونی بەها",
    "f1-c3-l3": "ئاسانیی فرۆشتن، قەبارەی مامەڵە و قەبارەی ساختە",
    "f1-c3-l4": "کۆین بەرامبەر تۆکن؛ بازاڕی سپات بەرامبەر داڕێژراوەکان",
    "f2-c1-l1": "بلۆکچەین چییە؟ دەفتەری دابەشکراو، نۆد و پەسەندکەرەکان",
    "f2-c1-l2": "پێکهاتەی بلۆک و زنجیرەبوونی بلۆکەکان",
    "f2-c2-l1": "فەنکشنی هاش و SHA-256",
    "f2-c2-l2": "کلیلی گشتی، کلیلی تایبەت و ناونیشان",
    "f2-c2-l3": "واژووی دیجیتاڵ: ECDSA و Schnorr",
    "f2-c3-l1": "بەڵگەی کار (PoW): کانکردن، قورسی و هێرشی ٥١٪",
    "f2-c3-l2": "بەڵگەی بەش (PoS): پەسەندکەر، ستەیکینگ و سلاشینگ",
    "f2-c3-l3": "ڕێککەوتن، کۆتاییبوون و ژیانی یەک مامەڵە",
    "f2-c4-l1": "فۆرکەکان: فۆرکی نەرم، فۆرکی سەخت و لێکجیابوونی زنجیرە",
    "f2-c4-l2": "سێگۆشەی بلۆکچەین، چینی ١ و چینی ٢",
    "f2-c4-l3": "پردەکانی نێوان‌زنجیرە و وانەی هاکەکانی گەورە",
    "f3-c1-l1": "بیتکۆین: فەلسەفە، سنووری دابینکردن و هاڤینگ",
    "f3-c1-l2": "ئیسیریۆم و گرێبەستی زیرەک: EVM، گاز و سووتاندنی کرێ",
    "f3-c1-l3": "تۆڕەکانی خێرا وەک سۆلانا: خێرایی، تێچوو و نرخی",
    "f3-c2-l1": "ستەیبڵکۆینەکان: پاڵپشت، شکانی پێگ و وانەی تێرا و USDC",
    "f3-c2-l2": "جۆرەکانی تۆکن: فەرمانڕەوایی، بەکارهێنان و میمکۆین",
    "f3-c3-l1": "ئۆراکڵەکان و بنکە: Chainlink و مەترسیی دەستکاریی نرخ",
    "f3-c3-l2": "ژیریی دەستکرد و بلۆکچەین: بەکارهێنانی ڕاستەقینە یان هەرا؟",
    "f3-c4-l1": "تۆکنۆمیکس: دابینکردن، ئازادکردن و لاوازبوونی بەها",
    "f3-c4-l2": "خوێندنەوەی وایتپەیپەر و هەڵسەنگاندنی تیم و نەخشەڕێ",
    "f3-c4-l3": "دۆزینەوەی فێڵ: ڕاگ‌پوڵ، پەمپ و دەمپ و پلانی پۆنزی",
    "f4-c1-l1": "جزدانی گەرم و جزدانی سارد",
    "f4-c1-l2": "جزدانی ئەمانەتی و نائەمانەتی",
    "f4-c1-l3": "ڕستەی گەڕاندنەوە، کلیلی تایبەت و واژووکردنی مامەڵە",
    "f4-c2-l1": "تۆڕەکان، ناونیشانەکان و گواستنەوەی بێ‌هەڵە",
    "f4-c2-l2": "کرێی تۆڕ و گاز",
    "f4-c2-l3": "ڕەزامەندیی تۆکن، گرێبەستی زیانبەخش و واژووی کوێرانە",
    "f4-c3-l1": "فیشینگ و ئەندازیاریی کۆمەڵایەتی",
    "f4-c3-l2": "ئاسایشی جزدانی ڕەقەکالا",
    "f4-c3-l3": "پلانی پاشەکەوت، گەڕاندنەوە و میرات",
    "f13-c1-l1": "چوارچێوەی ڕێباز: بۆچی تەنها سێگۆشە و تونێل؟",
    "f13-c1-l2": "لەش بەرامبەر سێبەر: بەرکەوتنی ڕەوا و ژماردنی لەگ",
    "f13-c1-l3": "پیڤۆتی سەرکەوتوو و داکەوتوو و لۆژیکی ئەلگۆریتمیی ترێندلاین",
    "f13-c1-l4": "بیست بنەما: ڕێگرێشن، فنەر، ڕێک و لاری",
    "f13-c1-l5": "درەختی زانین: نەخشەی هێڵی و RSI بە ماوەی ١٧",
    "f13-c2-l1": "کێشانی سێگۆشە و دابەشکردنی بۆ پێنج ناوچە",
    "f13-c2-l2": "چوار ئامانجی سێگۆشە و یاسای ناوچەی دەرچوون",
    "f13-c2-l3": "ملی سێگۆشە و ناوچەی هیوا",
    "f13-c2-l4": "ڕێک، گاپ، سێبەر و یاسای ٨٥ بە ١٥",
    "f13-c2-l5": "سێگۆشەی پێچەوانە (لێکدوورکەوتوو) و ئامانجەکانی",
    "f13-c3-l1": "کێشانی تونێل، ڕێک و هێڵی ناوەڕاست",
    "f13-c3-l2": "چوار ئامانجی تونێل: هێڵی ناوەڕاست، وەلامدانەوە، کوژ و بەرزی",
    "f13-c3-l3": "وەلامدانەوەی کۆتایی ڕەوت، پوڵبەک و نەخشەی «کەج»",
    "f13-c3-l4": "ڕەنجی ئاسۆیی، کەناڵەکانی پەمبەیی و گۆڕینی مودی بازاڕ",
    "f13-c4-l1": "دەستەئاڵا: سێ بەرزی و ئامانجەکانی",
    "f13-c4-l2": "شەش مەرجی ڕەوایی دەستەئاڵا",
    "f13-c4-l3": "کوژ: پێناسە، ئامانج و کاریگەریی لەسەر دەستەئاڵا",
    "f13-c5-l1": "ترێندلاینی ڕەوای لەشی و پێنج ڕەواییی ڕەوت",
    "f13-c5-l2": "چوونەژوورەوە: سی لەسەدی لەش یان شکانی ڕەنجی ورد",
    "f13-c5-l3": "وەستانی زەرەر لە پشت سێبەری کەندیلی پێش شکان، مەترسیی یەک لەسەد و قەبارەی گۆڕاو",
    "f13-c5-l4": "بادی‌وەی وەک ئامانجی تەواو و سواریی ڕەوت بە ترێندلاینی پلیکانەیی",
    "f13-c5-l5": "فلتەری RSI 17، لای پازدە لەسەد، ڕەواییی پێچەوانەی نەخشە و کاتێک وەستانی زەرەر دەکەوێت",
    "f13-c6-l1": "شیکاریی گشتی: سێگۆشەی دۆمیناسی تێتەر، دۆمیناسی بیتکۆین و TOTAL3",
    "f13-c6-l2": "لێکدوورکەوتن و لێکنزیکبوون: دوو پلە، خاڵی چوونەژوورەوە، و پێشینەیی ترێندلاینی RSI بەسەر نەخشە",
    "f13-c6-l3": "فلۆچارت و چێکلیستی مامەڵە: لە ج-١ تا ج-١٠",
    "f13-c6-l4": "ژۆرناڵ، دەروونزانیی مامەڵە و سنوورەکانی ڕاستگۆیانەی ئەم ڕێبازە",
}

# ---------------------------------------------------------------- glossary groups per faculty
# keys are the group ids in learn_data.GROUPS
GLOS = {
    "f1": ["basics", "macro"], "f2": ["basics"], "f3": ["basics"], "f4": ["defi"],
    "f5": ["risk", "deriv"], "f6": ["ta"], "f7": ["basics", "macro"], "f8": ["deriv"],
    "f9": ["risk", "ta"], "f10": ["risk"], "f11": ["defi", "deriv"], "f12": ["macro"],
    "f13": ["mokri", "ta"],
}
# learn-path level per faculty (ids in learn_data.LEVELS)
PATH = {"f1": "l1", "f2": "l1", "f3": "l1", "f4": "l1", "f5": "l1",
        "f6": "l2", "f7": "l3", "f8": "l3", "f9": "l3", "f10": "l3",
        "f11": "l3", "f12": "l3", "f13": "l2"}

# ---------------------------------------------------------------- site tools per faculty
# (url, fa, ckb, en) — every url is checked against the built site before it is written
LAB = "/academy/lab/"
TOOLS = {
    "f1": [(LAB + "#calc-supply", "ماشین‌حساب توکنومیکس", "ژمێرەری تۆکنۆمیکس", "Tokenomics calculator"),
           ("/fear-greed/", "شاخص ترس و طمع", "پێوەری ترس و تەماح", "Fear & Greed index")],
    "f2": [(LAB + "#hash", "آزمایشگاه هش", "تاقیگەی هاش", "Hash lab"),
           (LAB + "#keys", "کلید و امضا", "کلیل و واژوو", "Keys & signatures"),
           (LAB + "#tx", "کاوش یک تراکنش واقعی", "پشکنینی مامەڵەیەکی ڕاستەقینە", "Explore a real transaction"),
           ("/onchain/", "تحلیل آنچین", "ئاناڵیزی ئانچین", "On-chain analysis")],
    "f3": [("/encyclopedia/", "دانشنامهٔ بازارهای مالی", "زانستنامەی بازاڕە داراییەکان", "Encyclopedia of financial markets"),
           ("/dna/", "DNA بازار", "DNAی بازاڕ", "Market DNA"),
           ("/compare/", "مقایسهٔ ارزها", "بەراوردی دراوەکان", "Compare coins")],
    "f4": [("/safety/", "بررسی امنیت توکن", "پشکنینی ئاسایشی تۆکن", "Token safety check")],
    "f5": [(LAB + "#calc-fee", "ماشین‌حساب کارمزد", "ژمێرەری کرێ", "Fee calculator"),
           (LAB + "#calc-liq", "قیمت لیکوئید", "نرخی لیکویدکردن", "Liquidation price"),
           ("/terminal/", "ترمینال", "تێرمیناڵ", "Terminal")],
    "f6": [("/indicators/", "اندیکاتورهای اختصاصی", "ئیندیکاتۆرە تایبەتەکان", "Signature indicators"),
           ("/battle/", "نبرد کن", "شەڕ بکە", "Fight"),
           (LAB + "#backtest", "بک‌تست", "بەکتێست", "Backtest"),
           ("/lab/", "آزمایشگاه بازار", "تاقیگەی بازاڕ", "Market lab")],
    "f7": [("/encyclopedia/", "دانشنامهٔ بازارهای مالی", "زانستنامەی بازاڕە داراییەکان", "Encyclopedia of financial markets"),
           ("/sectors/", "بخش‌های بازار", "بەشەکانی بازاڕ", "Market sectors"),
           ("/dossier/", "پرونده‌های تحلیلی", "دۆسیە شیکارییەکان", "Analysis dossiers")],
    "f8": [("/onchain/", "تحلیل آنچین", "ئاناڵیزی ئانچین", "On-chain analysis"),
           ("/whales/", "رادار نهنگ‌ها", "ڕاداری نەهەنگەکان", "Whale radar")],
    "f9": [(LAB + "#sim", "شبیه‌ساز معامله", "لاسایکەری مامەڵە", "Trade simulator"),
           (LAB + "#journal", "ژورنال معاملاتی", "ژۆرناڵی مامەڵە", "Trading journal"),
           ("/academy/psychology/", "روان‌شناسی معامله‌گر", "دەروونناسیی بازرگان", "Trader psychology"),
           ("/track-record/", "کارنامهٔ واقعی کانال", "کارنامەی ڕاستەقینەی کەناڵ", "The channel's real record")],
    "f10": [(LAB + "#calc-size", "حجم پوزیشن", "قەبارەی پۆزیشن", "Position size"),
            (LAB + "#calc-rr", "ریسک به بازده", "مەترسی بۆ قازانج", "Risk/reward"),
            (LAB + "#calc-pnl", "سود و زیان", "قازانج و زەرەر", "Profit & loss")],
    "f11": [("/encyclopedia/", "دانشنامهٔ بازارهای مالی", "زانستنامەی بازاڕە داراییەکان", "Encyclopedia of financial markets"),
            ("/sectors/", "بخش‌های بازار", "بەشەکانی بازاڕ", "Market sectors")],
    "f12": [("/developers/", "API توسعه‌دهندگان", "API بۆ گەشەپێدەران", "Developer API"),
            ("/methodology/", "روش کار و منابع داده", "ڕێگای کار و سەرچاوەی داتا", "Methodology & data sources")],
    "f13": [("/academy/f13/", "دانشکدهٔ روش مهندس امید دباغچی مکری", "کۆلێژی ڕێبازی ئەندازیار ئومێد دەباغچی مکری", "The Mokri-method faculty"),
            ("/battle/", "نبرد کن", "شەڕ بکە", "Fight")],
}


def tri(d, key, i):
    """i: 0=fa 1=ckb 2=en — with a Persian fallback"""
    v = d.get(key)
    return v[i] if v else ""
