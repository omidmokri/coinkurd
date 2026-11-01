# -*- coding: utf-8 -*-
"""
قواعد دسته‌بندی خودکار پست‌های کانال Coin_Kurd
هر دسته: شناسه، نام سه‌زبانه، آیکون، و کلیدواژه‌ها (فارسی / کوردی سورانی / انگلیسی / هشتگ)
امتیازدهی: هر کلیدواژه‌ی پیدا‌شده یک امتیاز؛ هشتگ‌ها وزن ۲ دارند.
"""

CATEGORIES = [
    {
        "id": "technical",
        "name": {"fa": "تحلیل تکنیکال", "ckb": "شیکاری تەکنیکی", "en": "Technical Analysis"},
        "icon": "📈",
        "color": "#22d3ee",
        "keywords": [
            "تحلیل_تکنیکال", "تحلیل تکنیکال", "مقاومت", "حمایت", "روند", "الگو", "کندل",
            "فیبوناچی", "واگرایی", "شکست", "پولبک", "اصلاح", "هدف قیمتی", "تارگت",
            "خط روند", "ترندلاین", "بادی وی", "body v", "روژ", "roj", "کانال قیمتی",
            "rsi", "macd", "ema", "sma", "ichimoku", "ایچیموکو", "بولینگر", "میانگین متحرک",
            "ناحیه عرضه", "ناحیه تقاضا", "اوردر بلاک", "لیکوییدیتی",
            "شیکاری", "بەرگری", "پاڵپشتی", "ڕەوت",
            "support", "resistance", "trendline", "breakout", "pullback", "pattern", "chart",
        ],
    },
    {
        "id": "signal",
        "weight": 1.8,
        "name": {"fa": "سیگنال و معامله", "ckb": "سیگناڵ و مامەڵە", "en": "Signals & Trades"},
        "icon": "🎯",
        "color": "#f472b6",
        "keywords": [
            "سیگنال", "ورود", "خروج", "استاپ", "حد ضرر", "حد سود", "لانگ", "شورت",
            "اهرم", "لوریج", "پوزیشن", "نقطه ورود", "تی پی", "اس ال",
            "signal", "entry", "stop loss", "take profit", "long", "short", "leverage", "tp", "sl",
            "سیگناڵ", "مامەڵە",
        ],
    },
    {
        "id": "etf_institutional",
        "name": {"fa": "ETF و نهادی", "ckb": "ETF و دامەزراوەیی", "en": "ETF & Institutional"},
        "icon": "🏦",
        "color": "#a78bfa",
        "keywords": [
            "etf", "ای_تی_اف", "ای تی اف", "خزانه", "خزانه_داری", "صندوق", "نهادی",
            "بلک راک", "بلک‌راک", "blackrock", "فیدلیتی", "fidelity", "گری اسکیل", "grayscale",
            "کوین بیس", "کوین_بیس", "coinbase", "مایکرواستراتژی", "microstrategy", "strategy",
            "فرانکلین", "franklin", "بیتوایز", "bitwise", "vaneck", "ark",
            "ورود سرمایه", "خروج سرمایه", "خروج_سرمایه", "ورود_سرمایه", "inflow", "outflow",
            "شرکت", "موسسه", "بانک", "jpmorgan", "goldman", "morgan stanley", "citi",
        ],
    },
    {
        "id": "regulation",
        "name": {"fa": "قانون‌گذاری و سیاست", "ckb": "یاسا و سیاسەت", "en": "Regulation & Policy"},
        "icon": "⚖️",
        "color": "#fbbf24",
        "keywords": [
            "قانون", "قانونگذاری", "قانون_گذاری", "تنظیم", "تنظیم_گری", "رگولاتور", "مقررات",
            "sec", "cftc", "فدرال رزرو", "فدرال", "fed", "نرخ بهره", "بانک مرکزی", "بانک_مرکزی",
            "ذخیره استراتژیک", "ذخیره_استراتژیک", "سنا", "سناتور", "کنگره", "کاخ سفید", "ترامپ",
            "دولت", "وزیر", "مجلس", "دادگاه", "ممنوع", "مجوز", "لایحه", "مالیات",
            "یاسا", "حکومەت", "بانکی ناوەندی",
            "regulation", "lawmaker", "senate", "congress", "bill", "tax", "ban", "license", "reserve",
            "روسیه", "امریکا", "آمریکا", "اروپا", "ژاپن", "کره",
        ],
    },
    {
        "id": "security",
        "weight": 2.0,
        "name": {"fa": "امنیت و هک", "ckb": "ئاسایش و هاک", "en": "Security & Hacks"},
        "icon": "🛡️",
        "color": "#f87171",
        "keywords": [
            "هک", "هکر", "سرقت", "دزدی", "اکسپلویت", "کلاهبرداری", "اسکم", "رگ پول", "باگ",
            "نفوذ", "آسیب پذیری", "آسیب‌پذیری", "فیشینگ", "بدافزار", "لیکوئید",
            "hack", "exploit", "scam", "rug pull", "phishing", "stolen", "breach", "drain",
            "هاک", "دزین",
        ],
    },
    {
        "id": "onchain",
        "name": {"fa": "آن‌چین و داده", "ckb": "ئۆنچەین و داتا", "en": "On-chain & Data"},
        "icon": "🔗",
        "color": "#34d399",
        "keywords": [
            "آن چین", "آنچین", "آن‌چین", "on-chain", "onchain", "نهنگ", "نهنگ_ها", "whale",
            "عرضه", "عرضه در گردش", "تقاضا", "هش ریت", "هشریت", "hashrate", "ماینر", "ماینینگ", "mining",
            "استخراج", "فعال", "آدرس فعال", "حجم", "volume", "دامیننس", "dominance", "مارکت کپ",
            "ارزش بازار", "سرمایه بازار", "glassnode", "cryptoquant", "santiment", "داده",
            "ذخایر صرافی", "exchange reserve", "fear", "greed", "ترس و طمع", "فاندینگ", "funding",
            "اوپن اینترست", "open interest", "لیکوییدیشن", "liquidation",
        ],
    },
    {
        "id": "education",
        "name": {"fa": "آموزش", "ckb": "فێرکاری", "en": "Education"},
        "icon": "🎓",
        "color": "#60a5fa",
        "keywords": [
            "آموزش", "آموزشی", "چیست", "چگونه", "چطور", "درس", "نکته", "راهنما", "مفهوم",
            "وایت پپر", "وایت_پپر", "whitepaper", "ساتوشی", "satoshi", "بلاکچین", "blockchain",
            "تاریخچه", "فناوری", "تعریف", "اصطلاح", "مبتدی", "تازه کار",
            "فێرکاری", "چۆن", "چییە",
            "tutorial", "guide", "learn", "explained", "what is", "how to", "basics",
        ],
    },
    {
        "id": "products",
        "weight": 1.3,
        "name": {"fa": "کتاب و اندیکاتور", "ckb": "کتێب و ئیندیکاتۆر", "en": "Books & Indicators"},
        "icon": "📚",
        "color": "#fb923c",
        "keywords": [
            "کتاب", "اندیکاتور", "استراتژی معاملاتی", "استراتژی کردستان", "تریدینگ ویو", "تریدینگ‌ویو", "tradingview",
            "درک روند", "اطلس", "سبک های معاملاتی", "نقاط طلایی", "kurdistani", "kurdistan roj",
            "کوردستانی", "کردستانی", "روژ", "روژ کردستان", "pine", "پاین",
            "کتێب", "ئیندیکاتۆر", "ستراتیژی",
            "indicator", "strategy", "book", "volume", "جلد", "انتشار", "منتشر شد",
        ],
    },
    {
        "id": "community",
        "name": {"fa": "اطلاعیه و جامعه", "ckb": "ئاگاداری و کۆمەڵگە", "en": "Community & Announcements"},
        "icon": "📣",
        "color": "#e879f9",
        "keywords": [
            "دیسکورد", "discord", "گروه", "جلسه", "لایو", "استریم", "پخش زنده", "وبینار",
            "اطلاعیه", "اعلام", "دعوت", "عضویت", "لینک", "کلاس", "دوره", "جلسات شبانه",
            "پشتیبانی", "ادمین", "تلگرام", "کانال", "یوتیوب", "youtube",
            "کۆمەڵگە", "ئاگاداری", "گرووپ",
            "join", "session", "live", "stream", "community", "announcement",
        ],
    },
    {
        "id": "news",
        "weight": 0.6,
        "name": {"fa": "خبر بازار", "ckb": "هەواڵی بازاڕ", "en": "Market News"},
        "icon": "📰",
        "color": "#94a3b8",
        "keywords": [
            "خبر", "اخبار", "بازار", "رمزارز", "ارزهای دیجیتال", "ارزهای‌دیجیتال", "کریپتو", "crypto",
            "قیمت", "رکورد", "سقف", "کف", "ریزش", "رشد", "صعود", "نزول", "افت", "جهش",
            "هەواڵ", "بازاڕ", "نرخ",
            "news", "price", "market", "rally", "crash", "dump", "pump", "ath",
        ],
    },
]

DEFAULT_CATEGORY = "news"

# نقشه نام/نماد کوین‌ها → تیکر
COINS = {
    "BTC": ["بیتکوین", "بیت کوین", "بیت‌کوین", "بیتکۆین", "bitcoin", "btc", "#btc"],
    "ETH": ["اتریوم", "ئیسریۆم", "ethereum", "eth", "ether"],
    "USDT": ["تتر", "تێتەر", "usdt", "tether"],
    "USDC": ["usdc"],
    "BNB": ["بایننس کوین", "bnb", "binance coin"],
    "SOL": ["سولانا", "سۆلانا", "solana", "sol"],
    "XRP": ["ریپل", "ڕیپڵ", "xrp", "ripple"],
    "ADA": ["کاردانو", "cardano", "ada"],
    "DOGE": ["دوج کوین", "دوج", "dogecoin", "doge"],
    "TRX": ["ترون", "tron", "trx"],
    "TON": ["تون کوین", "toncoin", "ton"],
    "AVAX": ["آوالانچ", "avalanche", "avax"],
    "DOT": ["پولکادات", "polkadot", "dot"],
    "LINK": ["چین لینک", "چین‌لینک", "chainlink", "link"],
    "MATIC": ["پالیگان", "polygon", "matic", "pol"],
    "LTC": ["لایت کوین", "litecoin", "ltc"],
    "SHIB": ["شیبا", "shiba", "shib"],
    "PEPE": ["پپه", "pepe"],
    "SUI": ["سویی", "sui"],
    "APT": ["آپتوس", "aptos", "apt"],
    "ARB": ["آربیتروم", "arbitrum", "arb"],
    "OP": ["آپتیمیزم", "optimism"],
    "NEAR": ["نیر", "near"],
    "ATOM": ["کازماس", "cosmos", "atom"],
    "UNI": ["یونی سواپ", "یونی‌سواپ", "uniswap", "uni"],
    "HYPE": ["هایپرلیکوئید", "hyperliquid", "hype"],
    "XAUT": ["xaut", "tether gold"],
    "WBETH": ["wbeth"],
    "RLUSD": ["rlusd"],
    "GOLD": ["طلا", "زێڕ", "gold", "xau"],
}

# کلمات کوتاهی که فقط به‌صورت توکن مستقل باید تطبیق شوند (تا مثلاً sol در solution نگیرد)
SHORT_TOKENS = {"btc", "eth", "sol", "xrp", "ada", "trx", "ton", "dot", "link", "ltc", "sui", "apt",
                "arb", "uni", "near", "atom", "pol", "op", "tp", "sl", "sec", "fed", "ark", "ema",
                "sma", "rsi", "macd", "hype", "shib", "doge", "bnb", "ath", "ban", "bill", "tax",
                "long", "short", "live", "join", "volume", "book", "chart", "news", "price", "market",
                "strategy", "indicator", "gold", "xau", "reserve", "ether", "pepe", "avax", "matic",
                "usdt", "usdc", "xaut", "wbeth", "rlusd", "etf"}
