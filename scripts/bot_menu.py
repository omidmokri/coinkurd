"""
Navigation architecture of the Kurd Kurdistan Bot (redesign v3).

One source of truth for:
  * the 8-button home screen (no more 30-button wall),
  * the four sub-menus (analysis & tools, opportunities, news & content, settings & more),
  * the name, icon and one-line description of every section, in fa / ckb / kmr / ar / en,
  * the navigation standard: every screen ends with  ⬅️ <parent>  +  🏠 Home,  and a ⭐ toggle
    to pin the section to the user's favourites row on the home screen,
  * the welcome message and the intro texts of the main sections,
  * favourites and recently used sections.

refbot.py renders the content of each section; this module decides where it sits and how you get
back. Section keys are the existing callback keys ("m:<key>"), so old buttons in old chats keep working.
"""
from bot_i18n import pick

HOME = "main"


def L(d, lang, /, **kw):
    s = pick(d, lang)
    return s.format(**kw) if kw else s


# ================================================================== section catalogue
# key: (icon, {name}, {one-line description})
S = {
    "g_reality": ("🎯", {"fa": "واقعیت‌سنج", "ckb": "ڕاستیپێو", "kmr": "Pîvana rastiyê", "ar": "مقياس الواقع",
                         "en": "Reality check"},
                  {"fa": "فاصلهٔ حرف بازار با واقعیتِ قابل‌بازبینی — اصطکاک محلی، هزینه فرصت، کارنامهٔ سیگنال‌ها.",
                   "ckb": "دووری قسەی بازاڕ لە ڕاستییەکە — ئاستەنگی ناوخۆیی، تێچووی دەرفەت، کارنامەی سیگناڵ.",
                   "kmr": "Dûrahiya gotina bazarê ji rastiyê.", "ar": "الفجوة بين كلام السوق والواقع.",
                   "en": "The gap between what the market says and what can be checked."}),
    "friction": ("🧱", {"fa": "اصطکاک محلی ایران", "ckb": "ئاستەنگیی ناوخۆیی", "kmr": "Astenga herêmî",
                        "ar": "الاحتكاك المحلي", "en": "Iran friction"},
                 {"fa": "اختلاف تتر و دلار آزاد، اصطکاک صرافی‌ها، اینترنت و اخبار محلی در یک عدد.",
                  "ckb": "جیاوازیی تەتەر و دۆلار، ئاستەنگیی بۆرسەکان و ئینتەرنێت لە یەک ژمارەدا.",
                  "kmr": "Cudahiya Tether û dolar di yek jimarê de.", "ar": "الفارق بين تيثر والدولار في رقم واحد.",
                  "en": "Tether versus the free dollar, exchange friction, connectivity and local news, in one number."}),
    "oppcost": ("🧮", {"fa": "هزینه فرصت تومان", "ckb": "تێچووی دەرفەت", "kmr": "Lêçûna derfetê",
                       "ar": "تكلفة الفرصة", "en": "Opportunity cost"},
                {"fa": "اگر به‌جای کریپتو دلار یا طلا یا سپرده می‌گرفتی، امروز چقدر داشتی؟",
                 "ckb": "ئەگەر لەبریی کریپتۆ دۆلار یان زێڕت کڕیبووایە، ئەمڕۆ چەندت هەبوو؟",
                 "kmr": "Eger te dolar an zêr bikira, îro çi hebû?", "ar": "لو اشتريت دولارًا أو ذهبًا بدل العملات؟",
                 "en": "If you had held the dollar, gold or a deposit instead, what would it be worth today?"}),
    "today": ("☀️", {"fa": "امروز در بازار", "ckb": "ئەمڕۆ لە بازاڕ", "kmr": "Îro li bazarê", "ar": "اليوم في السوق",
                     "en": "Today in the market"},
              {"fa": "۲۴ ساعت گذشته در یک نگاه: بازار، اصطکاک ایران، اسکنر، پست‌ها و کلاس امشب.",
               "ckb": "٢٤ کاتژمێری ڕابردوو بە یەک نیگا: بازاڕ، گیروگرفتی ئێران، سکانەر، پۆست و وانەی ئەمشەو.",
               "kmr": "24 saetên dawî bi nihêrînekê.", "ar": "آخر ٢٤ ساعة في لمحة: السوق، احتكاك إيران، الماسح، المنشورات ودرس الليلة.",
               "en": "The last 24 hours at a glance: market, Iran friction, scanner, posts and tonight's class."}),
    "tools": ("🧮", {"fa": "ماشین‌حساب‌ها", "ckb": "ژمێرەرەکان", "kmr": "Hesabker", "ar": "الحاسبات", "en": "Calculators"},
              {"fa": "حجم پوزیشن، پله‌های سود، میانگین خرید، فاندینگ، جبران ضرر و بیشتر.",
               "ckb": "قەبارەی پۆزیشن، پلەکانی قازانج، تێکڕای کڕین، فاندینگ، قەرەبووی زیان و زیاتر.",
               "kmr": "Mezinahiya pozîsyonê, TP, navînî, funding û bêtir.", "ar": "حجم الصفقة، مستويات الربح، متوسط الشراء، التمويل والمزيد.",
               "en": "Position size, take-profit ladder, average entry, funding, loss recovery and more."}),
    "class": ("🎓", {"fa": "کلاس شبانه", "ckb": "وانەی شەوانە", "kmr": "Dersa şevê", "ar": "الدرس الليلي", "en": "Nightly class"},
              {"fa": "هر شب ۲۰:۰۰ تهران در دیسکورد: زمان، لینک ورود و شمارش معکوس.",
               "ckb": "هەموو شەوێک ٢٠:٠٠ تاران لە دیسکۆرد: کات، بەستەر و ژماردنی پێچەوانە.",
               "kmr": "Her şev 20:00 Tehran li Discordê.", "ar": "كل ليلة ٢٠:٠٠ بتوقيت طهران على ديسكورد.",
               "en": "Every night 20:00 Tehran on Discord: time, join link and countdown."}),
    "trackrec": ("🧾", {"fa": "کارنامهٔ واقعی کانال", "ckb": "کارنامەی ڕاستەقینەی کەناڵ", "kmr": "Qeyda rastîn a kanalê",
                        "ar": "السجل الحقيقي للقناة", "en": "Channel's real record"},
                 {"fa": "بعد از پست‌های کانال بیت‌کوین چه کرد، در برابر ساعت‌های تصادفی همان دوره — با آزمون آماری.",
                  "ckb": "دوای پۆستەکانی کەناڵ بیتکۆین چی کرد، بەرامبەر کاتژمێرە هەڕەمەکییەکان — بە تاقیکردنەوەی ئاماری.",
                  "kmr": "Piştî postên kanalê bîtkoyn çi kir, li hember saetên tesadufî.",
                  "ar": "ماذا فعل البيتكوين بعد منشورات القناة مقارنة بساعات عشوائية — باختبار إحصائي.",
                  "en": "What bitcoin did after the channel's posts, against random hours of the same period — with a statistical test."}),
    "ledger": ("📒", {"fa": "دفتر عملکرد سیگنال‌ها", "ckb": "دەفتەری کارایی سیگناڵ", "kmr": "Defterê sînyalan",
                      "ar": "سجل أداء الإشارات", "en": "Signal ledger"},
               {"fa": "هر پیش‌بینی با قفل زمانی ثبت می‌شود و نتیجه‌اش بعداً خودکار بررسی می‌شود.",
                "ckb": "هەر پێشبینییەک بە قوفڵی کاتی تۆمار دەکرێت و دواتر هەڵدەسەنگێنرێت.",
                "kmr": "Her pêşbînî bi kilîta demê tê tomarkirin.", "ar": "كل توقع يُسجل بقفل زمني ويُقيَّم لاحقًا.",
                "en": "Every call is time-locked when made and settled automatically later."}),
    "stratlab": ("🧪", {"fa": "آزمایشگاه استراتژی", "ckb": "تاقیگەی ستراتیژ", "kmr": "Laboratuwara stratejiyê", "ar": "مختبر الاستراتيجيات", "en": "Strategy lab"},
                 {"fa": "قانون معاملهٔ خودت را بنویس و پس از کارمزد بک‌تست کن؛ آزمون جایگشت می‌گوید لبه واقعی است یا شانس و واک-فوروارد پایداری را روی دادهٔ دیده‌نشده می‌سنجد.",
                  "ckb": "یاسای مامەڵەی خۆت بنووسە و دوای کرێ باکتێستی بکە؛ جێگۆڕکێ و واک-فۆروارد ڕاستیی لێوارەکە دەپێون.",
                  "kmr": "Qaîdeya xwe binivîse û piştî lêçûnan biceribîne.", "ar": "اكتب قاعدتك واختبرها بعد الرسوم مع اختبار التبديل والتحقق الأمامي.",
                  "en": "Write your own trading rule and back-test it after costs; a permutation test tells a real edge from luck and walk-forward checks it on unseen data."}),
    "truth": ("⚖️", {"fa": "آزمایشگاه حقیقت سیگنال‌ها", "ckb": "تاقیگەی ڕاستیی سیگناڵەکان", "kmr": "Laboratuwara rastiya sînyalan",
                    "ar": "مختبر حقيقة الإشارات", "en": "Signal Truth Lab"},
              {"fa": "همهٔ سیگنال‌ها پس از کارمزد، برون‌نمونه و با اصلاح آزمون چندگانه — نتیجه‌های منفی هم.",
               "ckb": "هەموو سیگناڵەکان دوای کرێ، دەرەوەی نموونە و بە ڕاستکردنەوەی تاقیکردنەوە زۆرەکان — ئەنجامە نەرێنییەکانیش.",
               "kmr": "Hemû sînyal piştî lêçûnan, derveyî nimûneyê.", "ar": "كل الإشارات بعد الرسوم، خارج العينة ومع تصحيح الاختبارات المتعددة.",
               "en": "Every signal net of costs, out-of-sample, corrected for multiple tests — negative results too."}),
    "regime": ("🧭", {"fa": "رادار رژیم بازار", "ckb": "ڕاداری دۆخی بازاڕ", "kmr": "Radara rewşa bazarê",
                     "ar": "رادار حالة السوق", "en": "Market-regime radar"},
               {"fa": "احتمال صعودی، نزولی، خنثی یا پرنوسانِ بی‌جهت بودن بازار بیت‌کوین و احتمال تغییر آن.",
                "ckb": "ئەگەری بەرزبوونەوە، دابەزین، مامناوەند یان هەڵاوسانی بازاڕی بیتکۆین و ئەگەری گۆڕانی.",
                "kmr": "Îhtîmala rewşên bazara bîtkoynê.", "ar": "احتمال كل حالة لسوق البيتكوين واحتمال تغيرها.",
                "en": "How likely Bitcoin is in a bull, bear, sideways or high-volatility regime, and the chance of a switch."}),
    "anomaly": ("🔎", {"fa": "شکارچی ناهنجاری", "ckb": "ڕاوکەری نائاسایی", "kmr": "Nêçîrvanê anormaliyan",
                      "ar": "صائد الشذوذ", "en": "Anomaly hunter"},
                {"fa": "حجم، قیمت، خرید و فروش تهاجمی، OI و فاندینگ غیرعادی امروز — با بک‌تست آنچه بعدش شد.",
                 "ckb": "قەبارە، نرخ، کڕین و فرۆشتنی هێرشبەر، OI و فاندینگی نائاسایی ئەمڕۆ.",
                 "kmr": "Qebare, biha, OI û fundinga ne asayî ya îro.", "ar": "الحجم والسعر وOI والتمويل غير المعتاد اليوم.",
                 "en": "Today's unusual volume, price, aggressive flow, OI and funding — with a back-test of what followed."}),
    "hype2": ("🔥", {"fa": "نیمه‌عمر هیاهو", "ckb": "نیوەتەمەنی هەرا", "kmr": "Nîv-jiyana gurrê",
                     "ar": "نصف عمر الضجيج", "en": "Hype half-life"},
              {"fa": "هر روایت بازار چند وقت زنده می‌ماند و الان در کدام مرحله است.",
               "ckb": "هەر گێڕانەوەیەک چەند دەژیێت و ئێستا لە چ قۆناغێکدایە.",
               "kmr": "Her vegotin çiqas dijî û niha li ku ye.", "ar": "كم تعيش كل سردية وأين هي الآن.",
               "en": "How long each market narrative lives, and where it stands now."}),
    "silent": ("🤫", {"fa": "خروج خاموش", "ckb": "دەرچوونی بێدەنگ", "kmr": "Derketina bêdeng",
                      "ar": "الخروج الصامت", "en": "Silent exit"},
               {"fa": "وقتی حرف بازار هنوز خوش‌بین است ولی رفتار پول چیز دیگری می‌گوید.",
                "ckb": "کاتێک قسەی بازاڕ خۆشبینە بەڵام ڕەفتاری پارە شتێکی تر دەڵێت.",
                "kmr": "Dema gotin xweşbîn e lê pere tiştekî din dibêje.",
                "ar": "حين يبقى الكلام متفائلًا بينما يقول سلوك المال غير ذلك.",
                "en": "When the talk is still upbeat but the money is behaving otherwise."}),
    "corr": ("🔗", {"fa": "همبستگی محلی", "ckb": "پەیوەندیی ناوخۆیی", "kmr": "Girêdana herêmî",
                    "ar": "الارتباط المحلي", "en": "Local correlation"},
             {"fa": "کریپتو در برابر دلار، تتر، طلا و سکه — با ماتریس همبستگی واقعی.",
              "ckb": "کریپتۆ بەرامبەر دۆلار و تەتەر و زێڕ — بە ماتریسی ڕاستەقینە.",
              "kmr": "Krîpto li hember dolar, Tether û zêr.", "ar": "العملات مقابل الدولار وتيثر والذهب.",
              "en": "Crypto against the dollar, tether and gold, as a real correlation matrix."}),
    "enc": ("📖", {"fa": "دانشنامهٔ کریپتو", "ckb": "زانستنامەی کریپتۆ", "kmr": "Zanistnameya krîptoyê",
                   "ar": "موسوعة الكريبتو", "en": "Crypto encyclopedia"},
            {"fa": "۵۰۶ واژه به سه زبان — واژه را بنویس تا همان تعریفی را بدهم که در سایت آمده.",
             "ckb": "٥٠٦ وشە بە سێ زمان — وشەکە بنووسە و هەمان پێناسەی ماڵپەڕ وەردەگریت.",
             "kmr": "506 peyv bi sê zimanan — peyvê binivîse.",
             "ar": "506 مصطلحات بثلاث لغات — اكتب الكلمة.",
             "en": "506 entries in three languages — type a word and get the site's own definition."}),
    "cmp": ("⚖️", {"fa": "مقایسهٔ دو ارز", "ckb": "بەراوردی دوو دراو", "kmr": "Berhevdana du diravan",
                   "ar": "مقارنة عملتين", "en": "Compare two coins"},
            {"fa": "ده معیار و هشت ژن، همان‌طور که در صفحهٔ مقایسهٔ سایت می‌آید.",
             "ckb": "دە پێوەر و هەشت جین، وەک پەڕەی بەراوردی ماڵپەڕ.",
             "kmr": "Deh pîvan û heşt jîn, wekî rûpela berhevdanê.",
             "ar": "عشرة معايير وثمانية جينات، كما في صفحة المقارنة.",
             "en": "Ten measures and eight genes, exactly as the site's comparison page lays them out."}),
    "sentim": ("📊", {"fa": "شاخص احساسات اخبار", "ckb": "پێوەری هەستی هەواڵ", "kmr": "Pîvana hestê nûçeyan",
                      "ar": "مؤشر مشاعر الأخبار", "en": "News sentiment"},
               {"fa": "لحن خبرهای ۲۴ ساعت گذشته، برای کل بازار و به تفکیک ارز.",
                "ckb": "شێوازی هەواڵەکانی ٢٤ کاتژمێر، بۆ بازاڕ و بۆ هەر دراوێک.",
                "kmr": "Awaza nûçeyên 24 saetan, ji bo bazarê û her dirav.",
                "ar": "نبرة أخبار 24 ساعة، للسوق ولكل عملة.",
                "en": "The tone of the last 24 hours of news, market-wide and coin by coin."}),
    "whales": ("🐳", {"fa": "رادار نهنگ‌ها", "ckb": "ڕاداری نەهەنگەکان", "kmr": "Radara nehengan",
                      "ar": "رادار الحيتان", "en": "Whale radar"},
               {"fa": "انتقال‌های بزرگ زنجیره در ۲۴ ساعت گذشته — بدون تفسیر ساختگی.",
                "ckb": "گواستنەوە گەورەکانی زنجیرە لە ٢٤ کاتژمێر، بێ لێکدانەوەی ساختە.",
                "kmr": "Veguhestinên mezin ên zincîrê di 24 saetan de.",
                "ar": "التحويلات الكبيرة على الشبكة في 24 ساعة.",
                "en": "Large on-chain transfers over the last 24 hours, with no invented reading."}),
    "analysis": ("🧭", {"fa": "تحلیل بازار", "ckb": "شیکاریی بازاڕ", "kmr": "Analîza bazarê",
                        "ar": "تحليل السوق", "en": "Market analysis"},
                 {"fa": "رژیم بازار، سه سناریو با احتمال، و ارزیابی نهایی — بر پایهٔ دادهٔ زمان‌دار، بدون عدد ساختگی.",
                  "ckb": "ڕژێمی بازاڕ، سێ سیناریۆ بە ڕێژەی ئەگەر، و هەڵسەنگاندنی کۆتایی.",
                  "kmr": "Rejîma bazarê, sê senaryo bi îhtîmal, û nirxandina dawî.",
                  "ar": "نظام السوق، ثلاثة سيناريوهات باحتمالات، والتقييم النهائي.",
                  "en": "Market regime, three scenarios with probabilities, and a final verdict."}),
    # ---------------------------------------------------------------- home level
    "token": ("🔎", {"fa": "بررسی توکن (CA)", "ckb": "پشکنینی تۆکن (CA)", "kmr": "Kontrola tokenê (CA)", "ar": "فحص الرمز (CA)",
                    "en": "Token check (CA)"},
              {"fa": "قیمت، نقدینگی، هولدرها و امنیت قرارداد هر توکن با آدرس قرارداد.",
               "ckb": "نرخ، لیکویدیتی، هۆڵدەر و ئاسایشی گرێبەستی هەر تۆکنێک بە ناونیشانەکەی.",
               "kmr": "Biha, likîdîte, xwedan û ewlehiya peymanê bi navnîşana tokenê.",
               "ar": "السعر والسيولة والحاملون وأمان العقد لأي رمز عبر عنوان عقده.",
               "en": "Price, liquidity, holders and contract safety of any token by its address."}),
    "pf": ("💼", {"fa": "پورتفولیو من", "ckb": "پۆرتفۆلیۆکەم", "kmr": "Portfolyoya min", "ar": "محفظتي", "en": "My portfolio"},
           {"fa": "ارزش کل دارایی‌ها، تغییرات روزانه و کیف‌پول‌های فقط‌خواندنی.",
            "ckb": "بەهای گشتی سامان، گۆڕانی ڕۆژانە و جزدانی تەنها-خوێندنەوە.",
            "kmr": "Nirxa giştî, guherîna rojane û cûzdanên tenê-xwendin.",
            "ar": "القيمة الإجمالية لأصولك والتغير اليومي ومحافظ للقراءة فقط.",
            "en": "Total value, daily change and read-only wallets."}),
    "center": ("🔔", {"fa": "مرکز هشدارها", "ckb": "ناوەندی ئاگادارییەکان", "kmr": "Navenda hişyariyan", "ar": "مركز التنبيهات",
                     "en": "Alert centre"},
               {"fa": "هشدار قیمت، لانچ جدید، نهنگ‌ها، حجم غیرعادی و نقدینگی.",
                "ckb": "ئاگاداری نرخ، لانچی نوێ، نەهەنگ، قەبارەی نائاسایی و لیکویدیتی.",
                "kmr": "Hişyariyên bihayê, destpêkên nû, neheng, qebare û likîdîte.",
                "ar": "تنبيهات السعر والإطلاقات الجديدة والحيتان والحجم غير العادي والسيولة.",
                "en": "Price, new-launch, whale, unusual-volume and liquidity alerts."}),
    "mkt": ("📈", {"fa": "وضعیت بازار", "ckb": "دۆخی بازاڕ", "kmr": "Rewşa bazarê", "ar": "حالة السوق", "en": "Market status"},
            {"fa": "دامیننس، ترس و طمع، ارزش کل، حجم و دلار و تتر به تومان.",
             "ckb": "دۆمینانس، ترس و تەماح، بەهای گشتی، قەبارە و دۆلار و تەتەر.",
             "kmr": "Dominance, tirs û çavbirçîtî, nirxa giştî, qebare û dolar/tether.",
             "ar": "الهيمنة ومؤشر الخوف والطمع والقيمة الكلية والحجم والدولار والتيثر بالتومان.",
             "en": "Dominance, fear & greed, total cap, volume, and dollar/tether in toman."}),
    "g_analysis": ("🧠", {"fa": "تحلیل و ابزارها", "ckb": "شیکاری و ئامرازەکان", "kmr": "Analîz û amûr", "ar": "التحليل والأدوات",
                         "en": "Analysis & tools"},
                   {"fa": "ابزارهای تخصصی برای تحلیل تکنیکال، بنیادی، آنچین و بررسی عمیق بازار.",
                    "ckb": "ئامرازی پسپۆڕانە بۆ شیکاری تەکنیکی، بنەڕەتی، ئۆنچەین و قووڵی بازاڕ.",
                    "kmr": "Amûrên pispor ji bo analîza teknîkî, bingehîn, on-chain û kûr.",
                    "ar": "أدوات متخصصة للتحليل الفني والأساسي وبيانات السلسلة والفحص العميق للسوق.",
                    "en": "Specialist tools for technical, fundamental and on-chain analysis."}),
    "g_opps": ("🎯", {"fa": "فرصت‌یابی", "ckb": "دۆزینەوەی دەرفەت", "kmr": "Dîtina derfetan", "ar": "اكتشاف الفرص", "en": "Opportunities"},
               {"fa": "شناسایی فرصت‌های احتمالی معاملاتی با اسکنرها و شاخص‌های بازار.",
                "ckb": "دۆزینەوەی دەرفەتی ئەگەری بە سکانەر و پێوەرەکانی بازاڕ.",
                "kmr": "Dîtina derfetên muhtemel bi skaner û nîşanderên bazarê.",
                "ar": "رصد الفرص التداولية المحتملة بالماسحات ومؤشرات السوق.",
                "en": "Possible trade setups from scanners and market indicators."}),
    "g_news": ("📰", {"fa": "اخبار و محتوا", "ckb": "هەواڵ و ناوەڕۆک", "kmr": "Nûçe û naverok", "ar": "الأخبار والمحتوى",
                     "en": "News & content"},
               {"fa": "آخرین اخبار، روایت‌های داغ، رویدادها و گزارش‌های تحلیلی.",
                "ckb": "دوایین هەواڵ، چیرۆکە گەرمەکان، ڕووداو و ڕاپۆرتی شیکاری.",
                "kmr": "Nûçeyên dawî, çîrokên germ, bûyer û raporên analîzê.",
                "ar": "آخر الأخبار والروايات الساخنة والأحداث والتقارير التحليلية.",
                "en": "Latest news, hot narratives, events and analytical reports."}),
    "g_more": ("⚙️", {"fa": "تنظیمات و بیشتر", "ckb": "ڕێکخستن و زیاتر", "kmr": "Mîheng û bêtir", "ar": "الإعدادات والمزيد",
                     "en": "Settings & more"},
               {"fa": "زبان، آموزش و امنیت، پروکسی، شرایط قطعی اینترنت و امکانات تکمیلی.",
                "ckb": "زمان، فێربوون و ئاسایش، پرۆکسی، پچڕانی ئینتەرنێت و زیاتر.",
                "kmr": "Ziman, perwerde û ewlehî, proxy, qutbûna înternetê û bêtir.",
                "ar": "اللغة والتعلم والأمان والبروكسي وانقطاع الإنترنت وميزات إضافية.",
                "en": "Language, learning & safety, proxies, internet outages and extras."}),
    # ---------------------------------------------------------------- analysis & tools
    "coin": ("🪙", {"fa": "تحلیل کوین", "ckb": "شیکاری دراو", "kmr": "Analîza coinê", "ar": "تحليل عملة", "en": "Coin analysis"},
             {"fa": "تحلیل تکنیکال و بنیادی هر ارز دیجیتال.", "ckb": "شیکاری تەکنیکی و بنەڕەتی هەر دراوێک.",
              "kmr": "Analîza teknîkî û bingehîn a her coinê.", "ar": "تحليل فني وأساسي لأي عملة رقمية.",
              "en": "Technical and fundamental view of any coin."}),
    "chain": ("⛓", {"fa": "آنچین بیت‌کوین", "ckb": "ئۆنچەینی بیتکۆین", "kmr": "On-chain a Bitcoinê", "ar": "بيانات البيتكوين على السلسلة",
                   "en": "Bitcoin on-chain"},
              {"fa": "فعالیت شبکه، نهنگ‌ها و جریان صرافی‌ها.", "ckb": "چالاکی تۆڕ، نەهەنگەکان و ڕەوتی ئاڵوگۆڕخانەکان.",
               "kmr": "Çalakiya torê, neheng û herikîna borsayan.", "ar": "نشاط الشبكة والحيتان وتدفقات المنصات.",
               "en": "Network activity, whales and exchange flows."}),
    "ind": ("📡", {"fa": "اندیکاتورها", "ckb": "ئیندیکاتۆرەکان", "kmr": "Îndîkator", "ar": "المؤشرات", "en": "Indicators"},
            {"fa": "شاخص‌ها و اندیکاتورهای کردستانی و تکنیکال.", "ckb": "ئیندیکاتۆرە کوردستانی و تەکنیکییەکان.",
             "kmr": "Îndîkatorên Kurdistanî û teknîkî.", "ar": "المؤشرات الكردستانية والفنية.",
             "en": "Kurdistani and technical indicators."}),
    "cycle": ("🌀", {"fa": "چرخه بازار و ارزش‌گذاری", "ckb": "خولی بازاڕ و نرخاندن", "kmr": "Çerxa bazarê û nirxandin",
                    "ar": "دورة السوق والتقييم", "en": "Market cycle & valuation"},
              {"fa": "جایگاه بازار در چرخه و مدل‌های ارزش‌گذاری.", "ckb": "شوێنی بازاڕ لە خولەکەدا و مۆدێلی نرخاندن.",
               "kmr": "Cihê bazarê di çerxê de û modelên nirxandinê.", "ar": "موقع السوق في الدورة ونماذج التقييم.",
               "en": "Where the market sits in its cycle, and valuation models."}),
    "deriv": ("⚖️", {"fa": "مشتقات و فاندینگ", "ckb": "دەرهاوێشتە و فاندینگ", "kmr": "Derîvatîf û funding", "ar": "المشتقات والتمويل",
                    "en": "Derivatives & funding"},
              {"fa": "نرخ فاندینگ، اوپن اینترست و لیکوئیدیشن‌ها.", "ckb": "ڕێژەی فاندینگ، ئۆپن ئینتەرێست و لیکویدەیشن.",
               "kmr": "Funding rate, open interest û likîdasyon.", "ar": "معدل التمويل والعقود المفتوحة والتصفيات.",
               "en": "Funding rate, open interest and liquidations."}),
    "lab": ("🧪", {"fa": "آزمایشگاه", "ckb": "تاقیگە", "kmr": "Laboratuwar", "ar": "المختبر", "en": "Lab"},
            {"fa": "مونت‌کارلو، حافظهٔ بازار، نوسان، آپشن‌ها و ابزارهای آزمایشی.",
             "ckb": "مۆنتی کارلۆ، بیرەوەری بازاڕ، لەرزین و ئامرازی تاقیکاری.",
             "kmr": "Monte Carlo, bîra bazarê, volatîlîte û amûrên ceribandinê.",
             "ar": "مونت كارلو وذاكرة السوق والتقلب والخيارات وأدوات تجريبية.",
             "en": "Monte Carlo, market memory, volatility, options and experiments."}),
    "council": ("🏛", {"fa": "شورای هوش مصنوعی", "ckb": "ئەنجومەنی AI", "kmr": "Encumena AI", "ar": "مجلس الذكاء الاصطناعي",
                      "en": "AI council"},
                {"fa": "دیدگاه چند مدل هوش مصنوعی دربارهٔ بازار.", "ckb": "بۆچوونی چەند مۆدێلی AI دەربارەی بازاڕ.",
                 "kmr": "Nêrînên çend modelên AI li ser bazarê.", "ar": "آراء عدة نماذج ذكاء اصطناعي حول السوق.",
                 "en": "Views of several AI models on the market."}),
    "brain": ("🧠", {"fa": "مغز بازار", "ckb": "مێشکی بازاڕ", "kmr": "Mejiyê bazarê", "ar": "عقل السوق", "en": "Market brain"},
              {"fa": "جمع‌بندی هوشمند شرایط کلان بازار.", "ckb": "کورتەی زیرەکی دۆخی گشتی بازاڕ.",
               "kmr": "Kurteya jîr a rewşa giştî ya bazarê.", "ar": "خلاصة ذكية لظروف السوق العامة.",
               "en": "Smart summary of the overall market regime."}),
    "battle": ("⚔️", {"fa": "نبرد من", "ckb": "شەڕی من", "kmr": "Şerê min", "ar": "معركتي", "en": "My Battle"},
               {"fa": "بازار زندهٔ بیت‌کوین به شکل یک جبههٔ سه‌بعدی روی سایت.", "ckb": "بازاڕی زیندووی بیتکۆین وەک بەرەیەکی سێ‌ڕەهەندی لەسەر ماڵپەڕ.",
                "kmr": "Bazara zindî ya Bitcoin wek eniyeke sêalî li ser malperê.", "ar": "سوق البيتكوين الحي على شكل جبهة ثلاثية الأبعاد على الموقع.",
                "en": "The live Bitcoin market as a 3D front on the site."}),
    "flows": ("💧", {"fa": "جریان سکتورها", "ckb": "ڕەوتی سێکتەرەکان", "kmr": "Herikîna sektoran", "ar": "تدفقات القطاعات",
                    "en": "Sector flows"},
              {"fa": "پول به کدام بخش‌های بازار می‌رود.", "ckb": "پارە بەرەو کام بەشی بازاڕ دەچێت.",
               "kmr": "Pere diçe kîjan beşên bazarê.", "ar": "إلى أي قطاعات يتجه المال.",
               "en": "Which market sectors money is flowing into."}),
    # ---------------------------------------------------------------- opportunities
    "opps": ("🎯", {"fa": "فرصت‌ها (اسکنر بازار)", "ckb": "دەرفەتەکان (سکانەر)", "kmr": "Derfet (skaner)", "ar": "الفرص (ماسح السوق)",
                   "en": "Scanner opportunities"},
             {"fa": "اسکن و شناسایی فرصت‌های احتمالی بازار، با کارنامهٔ واقعی هر الگو.",
              "ckb": "سکانکردنی بازاڕ بۆ دەرفەتی ئەگەری، لەگەڵ ئەنجامی ڕاستەقینەی هەر شێوازێک.",
              "kmr": "Skankirina bazarê ji bo derfetan, bi encama rastîn a her şêwazê.",
              "ar": "مسح السوق لرصد الفرص المحتملة مع السجل الفعلي لكل نمط.",
              "en": "Scans for possible setups, each with its real track record."}),
    "movers": ("🚀", {"fa": "بیشترین رشد و افت", "ckb": "زۆرترین بەرزبوون و دابەزین", "kmr": "Herî zêde bilind/nizm",
                     "ar": "الأكثر ارتفاعاً وانخفاضاً", "en": "Top gainers & losers"},
               {"fa": "ارزهای دارای بیشترین تغییر قیمت و دلیل حرکت.", "ckb": "ئەو دراوانەی زۆرترین گۆڕانیان هەبووە و هۆکارەکەی.",
                "kmr": "Coinên herî zêde guherîn û sedema wê.", "ar": "العملات الأكثر تغيراً وسبب الحركة.",
                "en": "Coins with the biggest moves, and why."}),
    "dca": ("📆", {"fa": "خرید پله‌ای و حجم معامله", "ckb": "کڕینی پلەیی و قەبارەی مامەڵە", "kmr": "DCA û mezinahiya bazirganiyê",
                  "ar": "الشراء الدوري وحجم الصفقة", "en": "DCA & position size"},
            {"fa": "برنامهٔ خرید پله‌ای و محاسبهٔ حجم بر اساس ریسک.", "ckb": "پلانی کڕینی پلەیی و ژمێرەری قەبارە بەپێی مەترسی.",
             "kmr": "Plana DCA û hesabkirina mezinahiyê li gorî xeterê.", "ar": "خطة الشراء الدوري وحساب الحجم حسب المخاطرة.",
             "en": "DCA plans and risk-based position sizing."}),
    "follow": ("👀", {"fa": "دنبال کردن کیف‌پول‌ها", "ckb": "شوێنکەوتنی جزدانەکان", "kmr": "Şopandina cûzdanan", "ar": "متابعة المحافظ",
                     "en": "Follow wallets"},
               {"fa": "رصد خرید و فروش کیف‌پول‌های مهم و نهنگ‌ها.", "ckb": "چاودێری کڕین و فرۆشتنی جزدانە گرنگەکان.",
                "kmr": "Şopandina kirîn û firotina cûzdanên girîng.", "ar": "رصد شراء وبيع المحافظ المهمة والحيتان.",
                "en": "Track buys and sells of notable wallets."}),
    "score": ("🏅", {"fa": "امتیاز انتخاب", "ckb": "خاڵی ئینتیخاب", "kmr": "Pûana Entekhab", "ar": "تقييم انتخاب", "en": "Entekhab score"},
              {"fa": "رتبه‌بندی ارزها بر اساس تکنیکال، احساسات، اخبار و کانال.", "ckb": "ڕیزبەندی دراوەکان بەپێی تەکنیکی، هەست، هەواڵ و کەناڵ.",
               "kmr": "Rêzkirina coinan li gorî teknîk, hest, nûçe û kanalê.", "ar": "ترتيب العملات وفق التحليل الفني والمزاج والأخبار والقناة.",
               "en": "Coins ranked by technicals, sentiment, news and the channel."}),
    # ---------------------------------------------------------------- news & content
    "news": ("📰", {"fa": "اخبار بازار", "ckb": "هەواڵی بازاڕ", "kmr": "Nûçeyên bazarê", "ar": "أخبار السوق", "en": "Market news"},
             {"fa": "آخرین اخبار مهم کریپتو.", "ckb": "دوایین هەواڵە گرنگەکانی کریپتۆ.", "kmr": "Nûçeyên girîng ên dawî yên kriptoyê.",
              "ar": "آخر أخبار الكريبتو المهمة.", "en": "The latest important crypto news."}),
    "narr": ("🔥", {"fa": "روایت‌های داغ", "ckb": "چیرۆکە گەرمەکان", "kmr": "Çîrokên germ", "ar": "الروايات الساخنة", "en": "Hot narratives"},
             {"fa": "ترندها و روایت‌هایی که بازار را حرکت می‌دهند.", "ckb": "ئەو ترێندانەی بازاڕ دەجووڵێنن.",
              "kmr": "Trendên ku bazarê dilivînin.", "ar": "الاتجاهات والروايات التي تحرك السوق.",
              "en": "Trends and stories moving the market."}),
    "events": ("📅", {"fa": "تقویم اقتصادی", "ckb": "ڕۆژژمێری ئابووری", "kmr": "Salnameya aborî", "ar": "التقويم الاقتصادي",
                     "en": "Economic calendar"},
               {"fa": "رویدادهای اقتصادی و کریپتویی پیش رو.", "ckb": "ڕووداوە ئابووری و کریپتۆییەکانی داهاتوو.",
                "kmr": "Bûyerên aborî û kripto yên pêş.", "ar": "الأحداث الاقتصادية والكريبتو القادمة.",
                "en": "Upcoming economic and crypto events."}),
    "week": ("🗓", {"fa": "خلاصه هفتگی", "ckb": "پوختەی هەفتانە", "kmr": "Kurteya heftane", "ar": "الملخص الأسبوعي", "en": "Weekly summary"},
             {"fa": "گزارش هفتگی وضعیت بازار.", "ckb": "ڕاپۆرتی هەفتانەی بازاڕ.", "kmr": "Rapora heftane ya bazarê.",
              "ar": "تقرير أسبوعي عن حالة السوق.", "en": "Weekly market report."}),
    "posts": ("📢", {"fa": "پست‌های کانال", "ckb": "پۆستەکانی کەناڵ", "kmr": "Postên kanalê", "ar": "منشورات القناة", "en": "Channel posts"},
              {"fa": "محتوای کانال رسمی Coin_Kurd و جستجو در آرشیو.", "ckb": "ناوەڕۆکی کەناڵی فەرمی و گەڕان لە ئەرشیڤ.",
               "kmr": "Naveroka kanala fermî û lêgerîn di arşîvê de.", "ar": "محتوى القناة الرسمية والبحث في الأرشيف.",
               "en": "The official channel's posts, with archive search."}),
    "track": ("📈", {"fa": "کارنامه سیگنال‌ها", "ckb": "ئەنجامی سیگناڵەکان", "kmr": "Encamên sînyalan", "ar": "سجل الإشارات",
                    "en": "Signal track record"},
              {"fa": "عملکرد واقعی و تاریخی سیگنال‌ها و پست‌ها.", "ckb": "ئەنجامی ڕاستەقینەی سیگناڵ و پۆستەکان.",
               "kmr": "Performansa rastîn a sînyal û postan.", "ar": "الأداء الفعلي والتاريخي للإشارات والمنشورات.",
               "en": "Real, historical performance of signals and posts."}),
    # ---------------------------------------------------------------- settings & more
    "lang": ("🌐", {"fa": "تغییر زبان", "ckb": "گۆڕینی زمان", "kmr": "Guhertina ziman", "ar": "تغيير اللغة", "en": "Language"},
             {"fa": "فارسی، کوردی سۆرانی، کرمانجی، عربی یا انگلیسی.", "ckb": "فارسی، کوردی سۆرانی، کورمانجی، عەرەبی یان ئینگلیزی.",
              "kmr": "Farisî, Soranî, Kurmancî, Erebî an Îngilîzî.", "ar": "الفارسية أو الكردية السورانية أو الكرمانجية أو العربية أو الإنجليزية.",
              "en": "Persian, Sorani, Kurmanji, Arabic or English."}),
    "learn": ("📚", {"fa": "آموزش و امنیت", "ckb": "فێربوون و ئاسایش", "kmr": "Perwerde û ewlehî", "ar": "التعلم والأمان",
                    "en": "Learning & safety"},
              {"fa": "آکادمی کریپتو و مسیر یادگیری سایت، شروع امن، قوانین منطقه و گزارش کلاهبرداری.",
               "ckb": "ئەکادیمیای کریپتۆ، دەستپێکی ئارام، یاساکان و ڕاپۆرتی فێڵ.",
               "kmr": "Akademiya kriptoyê, destpêka ewle, qanûn û rapora xapandinê.",
               "ar": "أكاديمية الكريبتو ومسار التعلم، البداية الآمنة، قوانين المنطقة والإبلاغ عن الاحتيال.",
               "en": "Crypto academy & learning path, safe start, local rules and scam reports."}),
    "proxy": ("🛡", {"fa": "پروکسی اضطراری", "ckb": "پرۆکسی فریاکەوتن", "kmr": "Proxyya awarte", "ar": "بروكسي الطوارئ",
                    "en": "Emergency proxy"},
              {"fa": "پروکسی‌های تلگرام، مرتب‌شده با گزارش کاربران داخل ایران.", "ckb": "پرۆکسییەکانی تێلێگرام بەپێی ڕاپۆرتی بەکارهێنەرانی ناو ئێران.",
               "kmr": "Proxyên Telegramê li gorî raporên bikarhênerên li Îranê.", "ar": "بروكسيات تيليغرام مرتبة حسب تقارير المستخدمين داخل إيران.",
               "en": "Telegram proxies ranked by reports from users inside Iran."}),
    "outage": ("🆘", {"fa": "راهنمای قطعی اینترنت", "ckb": "ڕێنمایی پچڕانی ئینتەرنێت", "kmr": "Rêbera qutbûna înternetê",
                     "ar": "دليل انقطاع الإنترنت", "en": "Internet-outage guide"},
               {"fa": "وضعیت اینترنت ایران، کیت آمادگی و قیمت‌های سبک.", "ckb": "دۆخی ئینتەرنێتی ئێران، کیتی ئامادەیی و نرخی سووک.",
                "kmr": "Rewşa înterneta Îranê, kîta amadebûnê û bihayên sivik.", "ar": "حالة إنترنت إيران وحقيبة الاستعداد والأسعار الخفيفة.",
                "en": "Iran's internet status, readiness kit and lite prices."}),
    "ref": ("🎁", {"fa": "دعوت دوستان و پاداش", "ckb": "بانگهێشت و خەڵات", "kmr": "Vexwendin û xelat", "ar": "دعوة الأصدقاء والمكافأة",
                  "en": "Invite & earn"},
            {"fa": "با لینک خودت دوستانت را دعوت کن و امتیاز بگیر.", "ckb": "بە بەستەرەکەت هاوڕێکانت بانگهێشت بکە و خاڵ وەربگرە.",
             "kmr": "Bi girêdana xwe hevalan vexwîne û pûan bistîne.", "ar": "ادعُ أصدقاءك برابطك واجمع النقاط.",
             "en": "Invite friends with your link and earn points."}),
    "paper": ("📒", {"fa": "معاملهٔ آزمایشی و جدول برترین‌ها", "ckb": "مامەڵەی تاقیکاری و خشتەی باشترینەکان", "kmr": "Bazirganiya ceribandinê",
                    "ar": "التداول التجريبي والمتصدرون", "en": "Paper trading & leaderboard"},
              {"fa": "با ۱۰٬۰۰۰ دلار مجازی و قیمت واقعی بایننس معامله کن و اگر خواستی در جدول برترین‌ها رقابت کن.",
               "ckb": "بە ١٠٬٠٠٠ دۆلاری مەجازی و نرخی ڕاستەقینەی بایننس مامەڵە بکە و ئەگەر ویستت لە خشتەکەدا ڕکابەری بکە.",
               "kmr": "Bi 10,000 dolarên virtual û bihayên rastîn ên Binance bazirganî bike.", "ar": "تداول بـ 10,000 دولار افتراضي وأسعار Binance الحقيقية.",
               "en": "Trade $10,000 of virtual money on real Binance prices, and compete on the leaderboard if you like."}),
    "predict": ("🎲", {"fa": "بازی پیش‌بینی بازار", "ckb": "یاری پێشبینی بازاڕ", "kmr": "Lîstika pêşbîniya bazarê",
                      "ar": "لعبة توقع السوق", "en": "Market prediction game"},
                {"fa": "پیش‌بینی کن و با بقیه رقابت کن.", "ckb": "پێشبینی بکە و ڕکابەری بکە.", "kmr": "Pêşbînî bike û pêşbaziyê bike.",
                 "ar": "توقّع وتنافس مع الآخرين.", "en": "Predict and compete with others."}),
    # ---------------------------------------------------------------- inner screens (reached from a section)
    "irr": ("💵", {"fa": "دلار و تتر (تومان)", "ckb": "دۆلار و تەتەر (تمەن)", "kmr": "Dolar û tether (tomen)", "ar": "الدولار والتيثر (تومان)",
                  "en": "Dollar & tether (toman)"}, {}),
    "lite": ("📋", {"fa": "قیمت‌های سبک", "ckb": "نرخی سووک", "kmr": "Bihayên sivik", "ar": "أسعار خفيفة", "en": "Lite prices"}, {}),
    "alerts": ("💲", {"fa": "هشدارهای قیمت من", "ckb": "ئاگادارییەکانی نرخم", "kmr": "Hişyariyên bihayê min", "ar": "تنبيهات أسعاري",
                     "en": "My price alerts"}, {}),
    "top": ("🏆", {"fa": "برترین دعوت‌کنندگان", "ckb": "باشترین بانگهێشتکەران", "kmr": "Vexwendkerên herî baş", "ar": "أفضل الداعين",
                  "en": "Top inviters"}, {}),
}
LAB_ITEMS = ["mc", "mem", "vol", "opt", "xex", "dev", "macro", "dna"]

HOME_ITEMS = ["token", "pf", "center", "mkt", "g_analysis", "g_reality", "g_opps", "g_news", "g_more"]
GROUPS = {
    "g_analysis": ["analysis", "coin", "tools", "cmp", "chain", "ind", "cycle", "deriv", "lab", "council", "brain", "flows", "battle"],
    "g_opps": ["opps", "movers", "dca", "follow", "score"],
    "g_news": ["today", "class", "news", "narr", "events", "week", "posts", "track"],
    "g_reality": ["truth", "stratlab", "regime", "anomaly", "friction", "oppcost", "trackrec", "ledger", "hype2", "silent", "corr", "sentim", "whales"],
    "g_more": ["lang", "learn", "enc", "proxy", "outage", "ref", "predict", "paper"],
}
PARENT = {k: HOME for k in HOME_ITEMS}
for g, items in GROUPS.items():
    for k in items:
        PARENT[k] = g
PARENT.update({"irr": "mkt", "lite": "mkt", "alerts": "center", "top": "ref"})
PARENT.update({k: "lab" for k in LAB_ITEMS})
FAVABLE = {k for k in S if not k.startswith("g_")}


def name(key, lang, icon=True):
    if key not in S:
        return key
    ic, nm, _ = S[key]
    return (ic + " " if icon else "") + L(nm, lang)


def desc(key, lang):
    if key in S and S[key][2]:
        return L(S[key][2], lang)
    return ""


# ================================================================== texts
T = {
    "welcome": {
        "fa": ("🌞 <b>به Kurd Kurdistan Bot خوش آمدید</b>\nدستیار هوشمند کریپتو برای جامعه کردی\n\n"
               "تحلیل دقیق • هشدار هوشمند • ابزارهای حرفه‌ای\nبازار ارزهای دیجیتال را هوشمندانه‌تر بررسی کنید.\n\n"
               "از منوی زیر بخش موردنظر خود را انتخاب کنید."),
        "ckb": ("🌞 <b>بەخێربێن بۆ Kurd Kurdistan Bot</b>\nیاریدەدەری زیرەکی کریپتۆ بۆ کۆمەڵگەی کورد\n\n"
                "شیکاری ورد • ئاگاداری زیرەک • ئامرازی پرۆفیشناڵ\nبازاڕی دراوی دیجیتاڵ زیرەکانەتر بپشکنە.\n\n"
                "لە لیستی خوارەوە بەشێک هەڵبژێرە."),
        "kmr": ("🌞 <b>Bi xêr hatî Kurd Kurdistan Bot</b>\nAlîkarê jîr ê kriptoyê ji bo civaka Kurd\n\n"
                "Analîza rast • Hişyariya jîr • Amûrên profesyonel\nBazara kriptoyê jîrtir binirxîne.\n\n"
                "Ji menuya jêrîn beşekê hilbijêre."),
        "ar": ("🌞 <b>مرحباً بك في Kurd Kurdistan Bot</b>\nمساعد الكريبتو الذكي للمجتمع الكردي\n\n"
               "تحليل دقيق • تنبيهات ذكية • أدوات احترافية\nتابع سوق العملات الرقمية بذكاء أكبر.\n\n"
               "اختر القسم الذي تريده من القائمة أدناه."),
        "en": ("🌞 <b>Welcome to Kurd Kurdistan Bot</b>\nSmart crypto assistant for the Kurdish community\n\n"
               "Precise analysis • Smart alerts • Pro tools\nFollow the crypto market more intelligently.\n\n"
               "Pick a section from the menu below."),
    },
    "home": {"fa": "🌞 <b>Kurd Kurdistan Bot</b> · {status}\nدستیار هوشمند کریپتو\n\nبخش موردنظر را انتخاب کنید 👇",
             "ckb": "🌞 <b>Kurd Kurdistan Bot</b> · {status}\nیاریدەدەری زیرەکی کریپتۆ\n\nبەشێک هەڵبژێرە 👇",
             "kmr": "🌞 <b>Kurd Kurdistan Bot</b> · {status}\nAlîkarê jîr ê kriptoyê\n\nBeşekê hilbijêre 👇",
             "ar": "🌞 <b>Kurd Kurdistan Bot</b> · {status}\nمساعد الكريبتو الذكي\n\nاختر القسم 👇",
             "en": "🌞 <b>Kurd Kurdistan Bot</b> · {status}\nSmart crypto assistant\n\nPick a section 👇"},
    "online": {"fa": "🟢 آنلاین · داده‌ها {m} دقیقه پیش", "ckb": "🟢 ئۆنلاین · داتا {m} خولەک لەمەوبەر",
               "kmr": "🟢 Serhêl · dane {m} deq berê", "ar": "🟢 متصل · البيانات قبل {m} دقيقة", "en": "🟢 Online · data {m} min ago"},
    "delayed": {"fa": "🟡 آنلاین · داده‌ها با تأخیر ({m} دقیقه)", "ckb": "🟡 ئۆنلاین · داتا دواکەوتووە ({m} خولەک)",
                "kmr": "🟡 Serhêl · dane dereng ({m} deq)", "ar": "🟡 متصل · البيانات متأخرة ({m} دقيقة)",
                "en": "🟡 Online · data delayed ({m} min)"},
    "online0": {"fa": "🟢 آنلاین", "ckb": "🟢 ئۆنلاین", "kmr": "🟢 Serhêl", "ar": "🟢 متصل", "en": "🟢 Online"},
    "fav": {"fa": "⭐ علاقه‌مندی‌ها", "ckb": "⭐ دڵخوازەکان", "kmr": "⭐ Bijare", "ar": "⭐ المفضلة", "en": "⭐ Favourites"},
    "recent": {"fa": "🕘 اخیراً", "ckb": "🕘 دوایین", "kmr": "🕘 Dawî", "ar": "🕘 مؤخراً", "en": "🕘 Recent"},
    "b_home": {"fa": "🏠 خانه", "ckb": "🏠 سەرەکی", "kmr": "🏠 Mal", "ar": "🏠 الرئيسية", "en": "🏠 Home"},
    "b_back": {"fa": "⬅️ {p}", "ckb": "⬅️ {p}", "kmr": "⬅️ {p}", "ar": "⬅️ {p}", "en": "⬅️ {p}"},
    "b_fav_add": {"fa": "☆ افزودن به علاقه‌مندی", "ckb": "☆ زیادکردن بۆ دڵخواز", "kmr": "☆ Li bijareyan zêde bike",
                  "ar": "☆ أضف إلى المفضلة", "en": "☆ Add to favourites"},
    "b_fav_del": {"fa": "⭐ حذف از علاقه‌مندی", "ckb": "⭐ لابردن لە دڵخواز", "kmr": "⭐ Ji bijareyan rake",
                  "ar": "⭐ إزالة من المفضلة", "en": "⭐ Remove from favourites"},
    "fav_added": {"fa": "⭐ به علاقه‌مندی‌ها اضافه شد؛ در صفحهٔ اصلی می‌بینی.", "ckb": "⭐ زیادکرا؛ لە پەڕەی سەرەکی دەیبینیت.",
                  "kmr": "⭐ Hat zêdekirin; li rûpela sereke dibînî.", "ar": "⭐ أُضيف إلى المفضلة؛ ستجده في الصفحة الرئيسية.",
                  "en": "⭐ Added — it now shows on the home screen."},
    "fav_removed": {"fa": "از علاقه‌مندی‌ها حذف شد.", "ckb": "لابرا.", "kmr": "Hat rakirin.", "ar": "أُزيل من المفضلة.", "en": "Removed."},
    "group_hint": {"fa": "یکی از بخش‌ها را انتخاب کنید.", "ckb": "بەشێک هەڵبژێرە.", "kmr": "Beşekê hilbijêre.", "ar": "اختر قسماً.",
                   "en": "Choose a section."},
    # intros of the main screens (design doc §5.2–5.5)
    "intro_token": {
        "fa": "🔍 <b>بررسی توکن</b>\nآدرس قرارداد (CA) توکن موردنظر را ارسال کنید تا اطلاعات و تحلیل آن نمایش داده شود.\n\nاطلاعات قابل بررسی:\n• قیمت و ارزش بازار\n• نقدینگی و تعداد هولدرها\n• وضعیت امنیت قرارداد\n• توزیع توکن و تمرکز مالکیت\n• تحلیل سریع بازار\n\n✍️ آدرس قرارداد را ارسال کنید (اتریوم، BSC، Base، سولانا، ترون، TON…).",
        "ckb": "🔍 <b>پشکنینی تۆکن</b>\nناونیشانی گرێبەستی (CA) تۆکنەکە بنێرە بۆ پیشاندانی زانیاری و شیکارییەکەی.\n\nزانیارییەکان:\n• نرخ و بەهای بازاڕ\n• لیکویدیتی و ژمارەی هۆڵدەر\n• ئاسایشی گرێبەست\n• دابەشبوون و چڕبوونەوەی خاوەندارێتی\n• شیکاری خێرای بازاڕ\n\n✍️ ناونیشانی گرێبەست بنێرە.",
        "kmr": "🔍 <b>Kontrola tokenê</b>\nNavnîşana peymanê (CA) bişîne da ku agahî û analîz were nîşandan.\n\nAgahî:\n• Biha û nirxa bazarê\n• Likîdîte û hejmara xwedanan\n• Ewlehiya peymanê\n• Belavbûn û kombûna xwedaniyê\n• Analîza bilez a bazarê\n\n✍️ Navnîşana peymanê bişîne.",
        "ar": "🔍 <b>فحص الرمز</b>\nأرسل عنوان عقد الرمز (CA) لعرض معلوماته وتحليله.\n\nما يتم فحصه:\n• السعر والقيمة السوقية\n• السيولة وعدد الحاملين\n• أمان العقد\n• توزيع الرمز وتركّز الملكية\n• تحليل سريع للسوق\n\n✍️ أرسل عنوان العقد (إيثريوم، BSC، Base، سولانا، ترون، TON…).",
        "en": "🔍 <b>Token check</b>\nSend the token's contract address (CA) to see its data and analysis.\n\nWhat is checked:\n• Price and market cap\n• Liquidity and holder count\n• Contract safety\n• Token distribution and ownership concentration\n• Quick market read\n\n✍️ Send the contract address (Ethereum, BSC, Base, Solana, Tron, TON…)."},
    "intro_pf": {
        "fa": "📊 <b>پورتفولیو من</b>\nدارایی‌های دیجیتال خود را مدیریت و عملکرد سرمایه‌گذاری‌تان را بررسی کنید.",
        "ckb": "📊 <b>پۆرتفۆلیۆکەم</b>\nسامانی دیجیتاڵت بەڕێوەببە و ئەنجامی وەبەرهێنانەکەت ببینە.",
        "kmr": "📊 <b>Portfolyoya min</b>\nMalê xwe yê dîjîtal birêve bibe û performansê bibîne.",
        "ar": "📊 <b>محفظتي</b>\nأدر أصولك الرقمية وتابع أداء استثماراتك.",
        "en": "📊 <b>My portfolio</b>\nManage your digital assets and track how they perform."},
    "intro_center": {
        "fa": "🔔 <b>مرکز هشدارها</b>\nهشدارهای بازار را متناسب با نیاز خود مدیریت کنید.\nانواع: تغییرات قیمت · لانچ توکن‌های جدید · فعالیت نهنگ‌ها · حجم غیرعادی · نقدینگی (از صفحهٔ هر توکن)\n\nبرای روشن/خاموش کردن روی هر گزینه بزنید.",
        "ckb": "🔔 <b>ناوەندی ئاگادارییەکان</b>\nئاگادارییەکانی بازاڕ بەپێی پێویستی خۆت بەڕێوەببە.\nجۆرەکان: نرخ · لانچی نوێ · نەهەنگ · قەبارەی نائاسایی · لیکویدیتی\n\nبۆ هەڵکردن/کوژاندنەوە لەسەر هەر بژاردەیەک دابگرە.",
        "kmr": "🔔 <b>Navenda hişyariyan</b>\nHişyariyên bazarê li gorî hewcedariya xwe birêve bibe.\nCure: biha · destpêkên nû · neheng · qebareya ne asayî · likîdîte\n\nJi bo vekirin/girtinê li ser her vebijarkê bitikîne.",
        "ar": "🔔 <b>مركز التنبيهات</b>\nأدر تنبيهات السوق حسب حاجتك.\nالأنواع: تغيّر السعر · إطلاق رموز جديدة · نشاط الحيتان · حجم غير عادي · السيولة (من صفحة كل رمز)\n\nاضغط على أي خيار للتشغيل أو الإيقاف.",
        "en": "🔔 <b>Alert centre</b>\nManage market alerts the way you need them.\nTypes: price moves · new token launches · whale activity · unusual volume · liquidity (from each token's page)\n\nTap any option to switch it on or off."},
    "intro_mkt": {
        "fa": "📈 <b>وضعیت کلی بازار</b>\nنمای کلی بازار و شاخص‌های مهم؛ بر اساس آخرین داده‌های دریافتی.",
        "ckb": "📈 <b>دۆخی گشتی بازاڕ</b>\nتێڕوانینی گشتی و پێوەرە گرنگەکان؛ بەپێی دوایین داتا.",
        "kmr": "📈 <b>Rewşa giştî ya bazarê</b>\nDîtina giştî û nîşanderên girîng; li gorî daneyên dawî.",
        "ar": "📈 <b>الحالة العامة للسوق</b>\nنظرة عامة على السوق ومؤشراته المهمة وفق آخر البيانات.",
        "en": "📈 <b>Market overview</b>\nThe big picture and key indicators, from the latest data received."},
}


# ================================================================== state helpers
def recent(x, key):
    """remember the last sections the user opened (feature screens only)"""
    if key not in FAVABLE or key in ("lang", "irr", "lite", "alerts", "top"):
        return
    r = [k for k in x.get("recent", []) if k != key]
    x["recent"] = ([key] + r)[:6]


def toggle_fav(x, key):
    f = x.setdefault("fav", [])
    if key in f:
        f.remove(key)
        return False
    f.insert(0, key)
    del f[6:]
    return True


# ================================================================== screens
def status_line(lang, market_age_min, outage_level="ok"):  # the outage itself is shown as a button on home
    if market_age_min is None:
        return L(T["online0"], lang)
    m = max(0, int(market_age_min))
    if m > 45:                                  # never present old data as live
        return L(T["delayed"], lang, m=m)
    return L(T["online"], lang, m=m)


def home(x, lang, status, outage_btn=None):
    """-> (text, rows): 8 sections in a 2×4 grid, plus favourites/recent and the outage banner if any"""
    rows = []
    if outage_btn:
        rows.append([outage_btn])
    quick = [k for k in (x.get("fav") or []) if k in S][:3]
    label = None
    if quick:
        label = "⭐"
    else:
        quick = [k for k in (x.get("recent") or []) if k in S][:3]
        label = "🕘" if quick else None
    if quick:
        rows.append([{"text": (label + " " + name(k, lang, icon=False))[:28], "callback_data": "m:" + k} for k in quick])
    items = HOME_ITEMS
    for i in range(0, len(items), 2):
        rows.append([{"text": name(k, lang), "callback_data": "m:" + k} for k in items[i:i + 2]])
    return L(T["home"], lang, status=status), rows


def group(key, lang):
    """-> (text, rows) for one of the four sub-menus: title, one-line description, list with descriptions, buttons"""
    items = GROUPS[key]
    out = [f"{S[key][0]} <b>{L(S[key][1], lang)}</b>", L(S[key][2], lang), ""]
    for k in items:
        out.append(f"{S[k][0]} <b>{L(S[k][1], lang)}</b> — {desc(k, lang)}")
    out += ["", "👇 " + L(T["group_hint"], lang)]
    rows = []
    for i in range(0, len(items), 2):
        rows.append([{"text": name(k, lang), "callback_data": "m:" + k} for k in items[i:i + 2]])
    rows.append([{"text": L(T["b_home"], lang), "callback_data": "m:" + HOME}])
    return "\n".join(out), rows


def nav_row(key, lang, x=None):
    """standard bottom row: ⬅️ parent + 🏠 home (just 🏠 when the parent is home)"""
    parent = PARENT.get(key, HOME)
    row = []
    if parent != HOME:
        row.append({"text": L(T["b_back"], lang, p=name(parent, lang, icon=False))[:30], "callback_data": "m:" + parent})
    row.append({"text": L(T["b_home"], lang), "callback_data": "m:" + HOME})
    return row


def decorate(key, text, kb, lang, x):
    """apply the navigation & message standard to a rendered screen:
       one-line description under the title, old '⬅️ Menu' buttons replaced by the standard nav row,
       a favourite toggle on feature screens."""
    if key == HOME or key.startswith("g_"):
        return text, kb
    d = desc(key, lang)
    if d and text and key not in ("token", "pf", "center", "mkt") and "\n" in text:
        first, rest = text.split("\n", 1)
        text = f"{first}\n<i>{d}</i>\n{rest}"
    elif d and text and "\n" not in text and key not in ("token",):
        text = f"{text}\n<i>{d}</i>"
    rows = [list(r) for r in ((kb or {}).get("inline_keyboard") or [])]
    clean = []
    for r in rows:
        r2 = [b for b in r if b.get("callback_data") != "m:" + HOME]
        if r2:
            clean.append(r2)
    if key in FAVABLE and key not in ("lang", "irr", "lite", "alerts", "top") and x is not None:
        on = key in (x.get("fav") or [])
        clean.append([{"text": L(T["b_fav_del" if on else "b_fav_add"], lang), "callback_data": "fv:" + key}])
    clean.append(nav_row(key, lang, x))
    return text, {"inline_keyboard": clean}


def coin_nav(lang):
    """back row under a coin card and its sub-views: ⬅️ coin list + 🏠"""
    return [{"text": L(T["b_back"], lang, p=name("coin", lang, icon=False))[:30], "callback_data": "m:coin"},
            {"text": L(T["b_home"], lang), "callback_data": "m:" + HOME}]


# ================================================================== public bot profile (name, about, description)
# Shown in Telegram search, on t.me/Kurd_kurdistan_bot and in the empty chat before /start.
# Limits: name 64, short description 120, description 512 characters.
PROFILE = {
    "": {   # default = Persian (+ one Sorani line); Telegram has no separate Sorani UI language code
        "name": "Kurd Kurdistan Bot | ربات کوین کورد",
        "short": "دستیار کریپتوی Coin_Kurd: دلار و تتر، بررسی توکن، هشدار، پروکسی · دعوت کن، اندیکاتور هدیه بگیر · entekhab.net/bot",
        "desc": ("🌞 Kurd Kurdistan Bot — دستیار هوشمند کریپتوی Coin_Kurd\n"
                 "💵 قیمت لحظه‌ای دلار، تتر، طلا و کریپتو + هشدار قیمت\n"
                 "🔎 بررسی توکن با آدرس قرارداد و هشدار اسکم\n"
                 "🐋 نهنگ‌ها، لانچ‌ها، تحلیل، اخبار · 🛡 پروکسی اضطراری\n"
                 "🎁 با {n} دعوت موفق، اندیکاتور Kurdistan Roj RSI هدیه بگیر\n\n"
                 "📢 t.me/Coin_Kurd\n💬 t.me/Coin_Kurd_Group\n🌐 entekhab.net/bot\n"
                 "𝕏 x.com/omid_mokri · 📷 instagram.com/coin_kurd\n\n"
                 "رایگان؛ هیچ‌وقت کلید یا رمز نمی‌خواهد. بۆ دەستپێکردن 👇 Start"),
    },
    "en": {
        "name": "Kurd Kurdistan Bot | Coin_Kurd crypto",
        "short": "Coin_Kurd crypto assistant: prices, token & scam check, alerts, proxies · invite friends, win an indicator",
        "desc": ("🌞 Kurd Kurdistan Bot — the smart crypto assistant of Coin_Kurd\n"
                 "💵 Live dollar/tether, gold & crypto prices + price alerts\n"
                 "🔎 Token check by contract address with scam warnings\n"
                 "🐋 Whales, launches, analysis, news · 🛡 emergency proxies\n"
                 "🎁 {n} successful invites = Kurdistan Roj RSI indicator as a gift\n\n"
                 "📢 t.me/Coin_Kurd\n💬 t.me/Coin_Kurd_Group\n🌐 entekhab.net/bot\n"
                 "𝕏 x.com/omid_mokri · 📷 instagram.com/coin_kurd\n\n"
                 "Free; never asks for keys or passwords. Tap Start 👇"),
    },
    "ar": {
        "name": "Kurd Kurdistan Bot | بوت كوين كورد",
        "short": "مساعد كريبتو من Coin_Kurd: الأسعار، فحص الرموز والاحتيال، تنبيهات، بروكسي · ادعُ أصدقاءك واربح مؤشراً",
        "desc": ("🌞 Kurd Kurdistan Bot — مساعد الكريبتو الذكي لقناة Coin_Kurd\n"
                 "💵 أسعار الدولار والتيثر والذهب والكريبتو + تنبيهات السعر\n"
                 "🔎 فحص الرمز بعنوان العقد مع تحذيرات الاحتيال\n"
                 "🐋 الحيتان والإطلاقات والتحليل والأخبار · 🛡 بروكسي الطوارئ\n"
                 "🎁 {n} دعوات ناجحة = مؤشر Kurdistan Roj RSI هدية\n\n"
                 "📢 t.me/Coin_Kurd\n💬 t.me/Coin_Kurd_Group\n🌐 entekhab.net/bot\n"
                 "𝕏 x.com/omid_mokri · 📷 instagram.com/coin_kurd\n\n"
                 "مجاني؛ لا يطلب أبداً مفاتيح أو كلمات مرور. اضغط Start 👇"),
    },
    "ku": {   # Kurdish clients (Kurmanji)
        "name": "Kurd Kurdistan Bot | Coin_Kurd",
        "short": "Alîkarê kriptoyê yê Coin_Kurd: biha, kontrola token û xapandinê, hişyarî, proxy · hevalan vexwîne, xelat bistîne",
        "desc": ("🌞 Kurd Kurdistan Bot — alîkarê jîr ê kriptoyê yê Coin_Kurd\n"
                 "💵 Bihayên dolar, tether, zêr û kriptoyê + hişyariya bihayê\n"
                 "🔎 Kontrola tokenê bi navnîşana peymanê û hişyariya xapandinê\n"
                 "🐋 Neheng, destpêkên nû, analîz, nûçe · 🛡 proxyên awarte\n"
                 "🎁 {n} vexwendinên serkeftî = îndîkatora Kurdistan Roj RSI diyarî\n\n"
                 "📢 t.me/Coin_Kurd\n💬 t.me/Coin_Kurd_Group\n🌐 entekhab.net/bot\n"
                 "𝕏 x.com/omid_mokri · 📷 instagram.com/coin_kurd\n\n"
                 "Belaş; tu carî mifte an şîfre naxwaze. Start bitikîne 👇"),
    },
}


def profile(reward_at):
    """PROFILE with the invite goal filled in"""
    return {code: {k: v.replace("{n}", str(reward_at)) for k, v in p.items()} for code, p in PROFILE.items()}


# links shown under the welcome banner
LINKS = [("📢", "https://t.me/Coin_Kurd", {"fa": "کانال", "ckb": "کەناڵ", "kmr": "Kanal", "ar": "القناة", "en": "Channel"}),
         ("💬", "https://t.me/Coin_Kurd_Group", {"fa": "گروه", "ckb": "گرووپ", "kmr": "Kom", "ar": "المجموعة", "en": "Group"}),
         ("🌐", "https://entekhab.net/bot/", {"fa": "راهنما و سایت", "ckb": "ڕێنمایی و ماڵپەڕ", "kmr": "Rêber û malper",
                                              "ar": "الدليل والموقع", "en": "Guide & site"}),
         ("𝕏", "https://x.com/omid_mokri", {"fa": "X", "ckb": "X", "kmr": "X", "ar": "X", "en": "X"}),
         ("📷", "https://www.instagram.com/coin_kurd/", {"fa": "اینستاگرام", "ckb": "ئینستاگرام", "kmr": "Instagram", "ar": "إنستغرام",
                                                         "en": "Instagram"})]


def links_rows(lang):
    b = [{"text": f"{ic} {L(nm, lang)}", "url": url} for ic, url, nm in LINKS]
    return [b[:3], b[3:]]
