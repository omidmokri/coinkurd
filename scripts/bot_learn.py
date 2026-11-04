"""
Education & local content for the Coin_Kurd bot:
  * a 5-step "safe start" course (short, button-driven, in fa / ckb / kmr / ar / en)
  * regulatory warnings for Iraq (federal), the Kurdistan Region, Iran and Türkiye — dated, sourced,
    and explicitly "not legal advice", because the rules change
  * community news: headlines about Kurdistan / Iraq / Iran filtered out of the bot's news feeds
  * scam reports: users can send a suspicious link/account to the admins

Regulatory notes were checked on 2026-11-04; update REG_CHECKED and the texts when the rules change.
"""
import re
from datetime import datetime, timezone

from bot_i18n import pick

REG_CHECKED = "2026-11-04"


def L(d, lang, /, **kw):
    s = pick(d, lang)
    return s.format(**kw) if kw else s


# ================================================================== safe-start course
LESSONS = [
    {"fa": ("📘 <b>۱/۵ — قبل از شروع</b>\n"
            "• کریپتو خیلی پرنوسان است؛ کاهش ۵۰٪ تا ۹۰٪ قیمت بارها اتفاق افتاده.\n"
            "• فقط پولی بگذار که از دست دادنش زندگی‌ات را خراب نکند. با مبلغ کم شروع کن.\n"
            "• هیچ‌کس «سود تضمینی» نمی‌دهد. هر کس وعدهٔ سود ثابت روزانه/ماهانه داد، به احتمال زیاد کلاهبردار است.\n"
            "• قبل از هر خرید از خودت بپرس: اگر فردا نصف شد چه می‌کنم؟"),
     "ckb": ("📘 <b>١/٥ — پێش دەستپێکردن</b>\n"
             "• کریپتۆ زۆر دەگۆڕێت؛ دابەزینی ٥٠٪ تا ٩٠٪ چەندین جار ڕوویداوە.\n"
             "• تەنها ئەو پارەیە دابنێ کە لەدەستدانی ژیانت تێک نادات. بە بڕی کەم دەست پێبکە.\n"
             "• کەس «قازانجی گەرەنتیکراو» نادات. هەر کەس بەڵێنی قازانجی جێگیری دا، زۆر لەوانەیە فێڵباز بێت.\n"
             "• پێش هەر کڕینێک بپرسە: ئەگەر سبەی نیوەی کەم بوو چی دەکەم؟"),
     "kmr": ("📘 <b>1/5 — Berî destpêkê</b>\n"
             "• Kripto pir diguhere; daketina 50% heta 90% gelek caran çêbûye.\n"
             "• Tenê pereyê ku windakirina wî jiyana te xera neke deyne. Bi mîqdareke biçûk dest pê bike.\n"
             "• Kes «qezenca garantîkirî» nade. Kî soza qezenca sabît bide, pir caran xapînok e.\n"
             "• Berî her kirînê bipirse: heke sibê nîv bibe ez ê çi bikim?"),
     "ar": ("📘 <b>1/5 — قبل أن تبدأ</b>\n"
            "• العملات الرقمية شديدة التقلب؛ تكرر هبوط الأسعار بين 50٪ و90٪.\n"
            "• استثمر فقط مالاً لا تتضرر حياتك بخسارته، وابدأ بمبلغ صغير.\n"
            "• لا أحد يمنح «ربحاً مضموناً»؛ من يعدك بربح ثابت يومي أو شهري فهو غالباً محتال.\n"
            "• قبل أي شراء اسأل نفسك: ماذا سأفعل إن انخفض للنصف غداً؟"),
     "en": ("📘 <b>1/5 — Before you start</b>\n"
            "• Crypto is very volatile; 50–90% drawdowns have happened many times.\n"
            "• Only put in money whose loss would not damage your life. Start small.\n"
            "• Nobody gives “guaranteed profit”. Anyone promising a fixed daily/monthly return is very likely a scammer.\n"
            "• Before every buy ask yourself: what will I do if it halves tomorrow?")},
    {"fa": ("🔐 <b>۲/۵ — کیف پول و کلیدها</b>\n"
            "• عبارت بازیابی (۱۲ یا ۲۴ کلمه) = خودِ پولت. آن را روی کاغذ بنویس، عکس نگیر، در گوشی یا ایمیل ذخیره نکن و به هیچ‌کس نده — حتی «پشتیبانی».\n"
            "• پول روی صرافی مال صرافی است تا وقتی برداشت کنی؛ برای مبلغ بزرگ از کیف پول شخصی استفاده کن.\n"
            "• کد تأیید دومرحله‌ای (2FA) را با اپ احراز هویت فعال کن، نه پیامک.\n"
            "• قبل از ارسال، شبکه (TRC20 / BEP20 / ERC20) و چند حرف اول و آخر آدرس را دوباره چک کن؛ ارسال اشتباه برنمی‌گردد."),
     "ckb": ("🔐 <b>٢/٥ — جزدان و کلیلەکان</b>\n"
             "• ڕستەی گەڕاندنەوە (١٢ یان ٢٤ وشە) = پارەکەت خۆی. لەسەر کاغەز بینووسە، وێنەی مەگرە و بە کەسی مەدە — تەنانەت «پشتگیری».\n"
             "• پارە لەسەر ئاڵوگۆڕخانە هی ئاڵوگۆڕخانەیە تا دەیکێشیتەوە؛ بۆ بڕی گەورە جزدانی کەسی بەکاربهێنە.\n"
             "• 2FA بە ئەپی ڕەسەنایەتی چالاک بکە، نەک SMS.\n"
             "• پێش ناردن، تۆڕ (TRC20 / BEP20 / ERC20) و سەرەتا و کۆتایی ناونیشانەکە بپشکنە؛ ناردنی هەڵە ناگەڕێتەوە."),
     "kmr": ("🔐 <b>2/5 — Cûzdan û mifte</b>\n"
             "• Hevoka vegerandinê (12 an 24 peyv) = pereyê te bixwe. Li ser kaxezê binivîse, wêne negire û nede kesî — ne jî «piştgirî».\n"
             "• Pereyê li ser borsayê heta ku tu derxînî yê borsayê ye; ji bo mîqdarên mezin cûzdana xwe bi kar bîne.\n"
             "• 2FA bi appa piştrastkirinê veke, ne SMS.\n"
             "• Berî şandinê tor (TRC20 / BEP20 / ERC20) û destpêk û dawiya navnîşanê kontrol bike; şandina şaş venagere."),
     "ar": ("🔐 <b>2/5 — المحافظ والمفاتيح</b>\n"
            "• عبارة الاسترداد (12 أو 24 كلمة) = أموالك نفسها. اكتبها على ورق، لا تصوّرها، ولا تعطها لأحد — ولا حتى «الدعم الفني».\n"
            "• المال على المنصة ملك المنصة حتى تسحبه؛ للمبالغ الكبيرة استخدم محفظتك الشخصية.\n"
            "• فعّل التحقق بخطوتين عبر تطبيق مصادقة لا عبر الرسائل القصيرة.\n"
            "• قبل الإرسال تحقق من الشبكة (TRC20 / BEP20 / ERC20) ومن بداية العنوان ونهايته؛ الإرسال الخاطئ لا يُسترد."),
     "en": ("🔐 <b>2/5 — Wallets & keys</b>\n"
            "• Your recovery phrase (12 or 24 words) IS your money. Write it on paper, never photograph it, never give it to anyone — not even “support”.\n"
            "• Coins on an exchange belong to the exchange until you withdraw; use your own wallet for larger amounts.\n"
            "• Turn on 2FA with an authenticator app, not SMS.\n"
            "• Before sending, re-check the network (TRC20 / BEP20 / ERC20) and the first and last characters of the address; wrong transfers can't be reversed.")},
    {"fa": ("🏦 <b>۳/۵ — انتخاب صرافی</b>\n"
            "• صرافی‌های جهانی معمولاً کاربران کشورهای تحریم‌شده را نمی‌پذیرند و ممکن است حساب و دارایی را مسدود کنند؛ شرایط استفاده را بخوان.\n"
            "• صرافی‌های داخلی هم هک می‌شوند (مثل حملهٔ ۹۰ میلیون دلاری به نوبیتکس در خرداد ۱۴۰۴) و ممکن است برداشت را محدود کنند.\n"
            "• همهٔ دارایی را در یک صرافی نگه ندار.\n"
            "• اپ را فقط از لینک رسمی سایت صرافی نصب کن؛ اپ‌ها و سایت‌های جعلی شبیه صرافی‌ها زیادند."),
     "ckb": ("🏦 <b>٣/٥ — هەڵبژاردنی ئاڵوگۆڕخانە</b>\n"
             "• ئاڵوگۆڕخانە جیهانییەکان زۆرجار بەکارهێنەری وڵاتانی سزادراو قبوڵ ناکەن و دەکرێت هەژمار بوەستێنن؛ مەرجەکان بخوێنەرەوە.\n"
             "• ئاڵوگۆڕخانە ناوخۆییەکانیش هاک دەکرێن (وەک هێرشی ٩٠ ملیۆن دۆلاری بۆ نۆبیتێکس لە حوزەیرانی ٢٠٢٥).\n"
             "• هەموو سامانەکەت لە یەک ئاڵوگۆڕخانەدا مەهێڵەرەوە.\n"
             "• ئەپ تەنها لە بەستەری فەرمی دابمەزرێنە؛ ئەپی ساختە زۆرن."),
     "kmr": ("🏦 <b>3/5 — Hilbijartina borsayê</b>\n"
             "• Borsayên cîhanî pir caran bikarhênerên welatên ceza-lêkirî qebûl nakin û dikarin hesab bicemidînin; şertan bixwîne.\n"
             "• Borsayên navxweyî jî têne hackkirin (wek êrîşa 90 mîlyon dolarî li ser Nobitex di Hezîrana 2025an de).\n"
             "• Hemû malê xwe li yek borsayê nehêle.\n"
             "• Appê tenê ji girêdana fermî saz bike; appên sexte pir in."),
     "ar": ("🏦 <b>3/5 — اختيار المنصة</b>\n"
            "• المنصات العالمية غالباً لا تقبل مستخدمي الدول الخاضعة للعقوبات وقد تجمّد الحساب والأصول؛ اقرأ الشروط.\n"
            "• المنصات المحلية تُخترق أيضاً (مثل هجوم 90 مليون دولار على نوبيتكس في يونيو 2025) وقد تقيّد السحب.\n"
            "• لا تحتفظ بكل أصولك في منصة واحدة.\n"
            "• ثبّت التطبيق من الرابط الرسمي فقط؛ التطبيقات والمواقع المزيفة كثيرة."),
     "en": ("🏦 <b>3/5 — Choosing an exchange</b>\n"
            "• Global exchanges usually don't accept users from sanctioned countries and may freeze the account and funds; read the terms.\n"
            "• Local exchanges get hacked too (e.g. the ~$90M Nobitex hack in June 2025) and may limit withdrawals.\n"
            "• Don't keep everything on one exchange.\n"
            "• Install apps only from the exchange's official site; fake look-alike apps and sites are common.")},
    {"fa": ("🚩 <b>۴/۵ — کلاهبرداری‌های رایج</b>\n"
            "• «پشتیبانی» یا «ادمین» که اول پیام می‌دهد. ادمین‌های Coin_Kurd هرگز اول پیام نمی‌دهند و پول یا رمز نمی‌خواهند.\n"
            "• گروه‌های پامپ، سیگنال VIP با «سود تضمینی»، شرکت‌های فارکس/کریپتوی بی‌مجوز.\n"
            "• توکن هانی‌پات: می‌خری ولی نمی‌توانی بفروشی — قبل از خرید آدرس قرارداد را در 🔎 بررسی کن.\n"
            "• لینک‌های ایردراپ و «اتصال کیف پول» که اجازهٔ برداشت می‌گیرند.\n"
            "• معاملهٔ نفر به نفر (P2P) خارج از صرافی و رسید جعلی بانکی."),
     "ckb": ("🚩 <b>٤/٥ — فێڵە باوەکان</b>\n"
             "• «پشتگیری» یان «ئەدمین» کە یەکەم جار نامە دەنێرێت. ئەدمینەکانی Coin_Kurd هەرگیز یەکەم جار نامە نانێرن و پارە یان وشەی نهێنی داوا ناکەن.\n"
             "• گرووپی پەمپ، سیگناڵی VIP بە «قازانجی گەرەنتی»، کۆمپانیای بێ مۆڵەت.\n"
             "• تۆکنی هانی‌پۆت: دەیکڕیت بەڵام ناتوانیت بیفرۆشیت — پێش کڕین لە 🔎 بیپشکنە.\n"
             "• بەستەری ئێیردرۆپ و «پەیوەستکردنی جزدان».\n"
             "• مامەڵەی P2P لە دەرەوەی ئاڵوگۆڕخانە و پسوولەی بانکی ساختە."),
     "kmr": ("🚩 <b>4/5 — Xapandinên berbelav</b>\n"
             "• «Piştgirî» an «admin» ku pêşî peyamê dişîne. Adminên Coin_Kurd tu carî pêşî peyamê naşînin û pere an şîfre naxwazin.\n"
             "• Komên pump, sînyalên VIP bi «qezenca garantî», şirketên bê destûr.\n"
             "• Tokena honeypot: tu dikirî lê nikarî bifiroşî — berî kirînê di 🔎 de kontrol bike.\n"
             "• Girêdanên airdrop û «girêdana cûzdanê».\n"
             "• Bazirganiya P2P li derveyî borsayê û belgeyên bankê yên sexte."),
     "ar": ("🚩 <b>4/5 — عمليات احتيال شائعة</b>\n"
            "• «دعم فني» أو «مشرف» يراسلك أولاً. مشرفو Coin_Kurd لا يراسلونك أولاً أبداً ولا يطلبون مالاً أو كلمة مرور.\n"
            "• مجموعات الضخ، إشارات VIP «بربح مضمون»، شركات فوركس/كريبتو غير مرخصة.\n"
            "• رمز Honeypot: تشتري ولا تستطيع البيع — افحص عنوان العقد في 🔎 قبل الشراء.\n"
            "• روابط الإيردروب و«ربط المحفظة» التي تأخذ صلاحية السحب.\n"
            "• التداول من شخص لشخص خارج المنصة وإيصالات بنكية مزيفة."),
     "en": ("🚩 <b>4/5 — Common scams</b>\n"
            "• “Support” or “admins” who message you first. Coin_Kurd admins never DM first and never ask for money or passwords.\n"
            "• Pump groups, VIP signals with “guaranteed profit”, unlicensed forex/crypto companies.\n"
            "• Honeypot tokens: you can buy but not sell — check the contract in 🔎 before buying.\n"
            "• Airdrop and “connect wallet” links that grab spending approval.\n"
            "• Person-to-person (P2P) deals outside an exchange and fake bank receipts.")},
    {"fa": ("📏 <b>۵/۵ — اولین معامله‌ها</b>\n"
            "• همیشه قبل از ورود، حد ضرر را مشخص کن و حجم را با <code>/size</code> حساب کن (مثلاً ریسک ۱٪ سرمایه در هر معامله).\n"
            "• اهرم (فیوچرز) را تا وقتی تجربه نداری کنار بگذار؛ بیشتر حساب‌ها با اهرم صفر می‌شوند.\n"
            "• خرید پله‌ای (DCA) با <code>/dca</code> برای شروع، استرس کمتری دارد.\n"
            "• از هر معامله یادداشت بنویس؛ کارنامهٔ واقعی سیگنال‌ها را در «📈 کارنامه» ببین."),
     "ckb": ("📏 <b>٥/٥ — یەکەم مامەڵەکان</b>\n"
             "• هەمیشە پێش چوونەژوورەوە ستۆپ دیاری بکە و قەبارە بە <code>/size</code> حیساب بکە (بۆ نموونە ١٪ مەترسی لە هەر مامەڵەیەک).\n"
             "• لیڤەرێج تا ئەزموونت نییە دابنێ؛ زۆربەی هەژمارەکان بە لیڤەرێج سفر دەبن.\n"
             "• کڕینی پلەیی (DCA) بە <code>/dca</code> بۆ دەستپێکردن ئارامترە.\n"
             "• لە هەر مامەڵەیەک تێبینی بنووسە."),
     "kmr": ("📏 <b>5/5 — Bazirganiyên yekem</b>\n"
             "• Berî ketinê her tim stopê diyar bike û mezinahiyê bi <code>/size</code> hesab bike (mînak 1% xeter di her bazirganiyê de).\n"
             "• Heta ku tecrûbeya te tune be leverage bihêle; piraniya hesaban bi leverage sifir dibin.\n"
             "• Kirîna gav bi gav (DCA) bi <code>/dca</code> ji bo destpêkê aramtir e.\n"
             "• Ji her bazirganiyê not binivîse."),
     "ar": ("📏 <b>5/5 — صفقاتك الأولى</b>\n"
            "• حدد وقف الخسارة دائماً قبل الدخول واحسب الحجم بـ <code>/size</code> (مثلاً مخاطرة 1٪ من رأس المال لكل صفقة).\n"
            "• ابتعد عن الرافعة المالية حتى تكتسب خبرة؛ معظم الحسابات تُصفّر بسببها.\n"
            "• الشراء الدوري (DCA) عبر <code>/dca</code> أقل توتراً للبداية.\n"
            "• دوّن ملاحظاتك عن كل صفقة، وراجع سجل الأداء الحقيقي للإشارات في «📈 سجل الأداء»."),
     "en": ("📏 <b>5/5 — Your first trades</b>\n"
            "• Always set the stop-loss before entering and size the trade with <code>/size</code> (e.g. risk 1% of capital per trade).\n"
            "• Stay away from leverage (futures) until you have experience; most accounts that blow up used leverage.\n"
            "• Starting with DCA (<code>/dca</code>) is far less stressful.\n"
            "• Journal every trade; check the real track record of signals in “📈 Track record”.")},
]

# ================================================================== regulation (dated, sourced)
REG = {
    "iq": {"fa": ("🇮🇶 <b>عراق (فدرال)</b>\n"
                  "• بانک مرکزی عراق از ۲۰۱۷ معامله و استفاده از رمزارزها را ممنوع اعلام کرده و هشدار داده است.\n"
                  "• بانک مرکزی می‌گوید به هیچ شرکت معاملهٔ سهام، فلزات یا کریپتو مجوز نداده و علیه شرکت‌های مدعی مجوز اقدام قانونی می‌کند.\n"
                  "• نتیجهٔ عملی: هیچ حمایت قانونی‌ای برای سرمایه‌گذار وجود ندارد؛ شرکت‌هایی که «با مجوز» تبلیغ می‌کنند را جدی بگیر و دوری کن."),
           "ckb": ("🇮🇶 <b>عێراق (فیدراڵ)</b>\n"
                   "• بانکی ناوەندیی عێراق لە ٢٠١٧ـەوە مامەڵە و بەکارهێنانی دراوی دیجیتاڵی قەدەغە کردووە.\n"
                   "• بانکی ناوەندی دەڵێت مۆڵەتی بە هیچ کۆمپانیایەکی بازرگانی پشک، کانزا یان کریپتۆ نەداوە و ڕێکاری یاسایی دەگرێتەبەر.\n"
                   "• ئەنجام: هیچ پاراستنێکی یاسایی بۆ وەبەرهێنەر نییە."),
           "kmr": ("🇮🇶 <b>Iraq (federal)</b>\n"
                   "• Banka Navendî ya Iraqê ji 2017an ve bazirganî û bikaranîna kriptoyê qedexe kiriye.\n"
                   "• Bank dibêje destûr nedaye tu şirketeke bazirganiya pişk, metal an kriptoyê.\n"
                   "• Encam: tu parastina qanûnî ji bo veberhêneran tune."),
           "ar": ("🇮🇶 <b>العراق (الاتحادي)</b>\n"
                  "• يحظر البنك المركزي العراقي منذ 2017 التعامل بالعملات المشفرة ويحذّر منها.\n"
                  "• يؤكد البنك أنه لم يرخّص أي شركة لتداول الأسهم أو المعادن أو العملات المشفرة ويلاحق قانونياً الشركات التي تدّعي الترخيص.\n"
                  "• عملياً: لا توجد حماية قانونية للمستثمر؛ احذر الشركات التي تعلن أنها «مرخّصة»."),
           "en": ("🇮🇶 <b>Iraq (federal)</b>\n"
                  "• The Central Bank of Iraq has prohibited dealing in crypto since 2017 and keeps warning against it.\n"
                  "• The CBI says it licenses no company to trade stocks, metals or crypto, and pursues firms that claim its licence.\n"
                  "• In practice: investors have no legal protection; be wary of any company advertising itself as “licensed”.")},
    "krd": {"fa": ("☀️ <b>اقلیم کردستان</b>\n"
                   "• فروردین ۱۴۰۴ (آوریل ۲۰۲۵): ادارهٔ امنیت عمومی اربیل معامله‌گری کریپتو را ممنوع کرد.\n"
                   "• خرداد ۱۴۰۴ (ژوئن ۲۰۲۵): حکومت اقلیم دستور بستن همهٔ شرکت‌های کریپتو و فارکس را داد و کمیته‌ای در وزارت کشور با اختیار بازرسی تشکیل شد (پس از کلاهبرداری حدود ۱۵ میلیون دلاری در دهوک).\n"
                   "• ۳ مه ۲۰۲۶: وزارت کشور اقلیم اعلام کرد هیچ شرکتی مجوز ندارد، این معاملات طبق قوانین ممنوع است و فعالان با تعطیلی و پیگرد قانونی روبه‌رو می‌شوند.\n"
                   "• توصیه: پول را به شرکت یا «مدیر حساب» نسپار؛ اگر کلاهبرداری دیدی گزارش بده."),
            "ckb": ("☀️ <b>هەرێمی کوردستان</b>\n"
                    "• نیسانی ٢٠٢٥: بەڕێوەبەرایەتی ئاسایشی گشتیی هەولێر بازرگانی کریپتۆی قەدەغە کرد.\n"
                    "• حوزەیرانی ٢٠٢٥: حکومەتی هەرێم فەرمانی داخستنی هەموو کۆمپانیاکانی کریپتۆ و فۆرێکسی دا و لیژنەیەک لە وەزارەتی ناوخۆ پێکهات (دوای فێڵێکی نزیکەی ١٥ ملیۆن دۆلاری لە دهۆک).\n"
                    "• ٣ی ئایاری ٢٠٢٦: وەزارەتی ناوخۆی هەرێم ڕایگەیاند هیچ کۆمپانیایەک مۆڵەتی نییە، ئەم مامەڵانە قەدەغەن و ئەوانەی کاری پێدەکەن داخستن و لێپرسینەوەی یاسایی ڕووبەڕوویان دەبێتەوە.\n"
                    "• ئامۆژگاری: پارە بە کۆمپانیا یان «بەڕێوەبەری هەژمار» مەدە؛ ئەگەر فێڵت بینی ڕاپۆرت بدە."),
            "kmr": ("☀️ <b>Herêma Kurdistanê</b>\n"
                    "• Nîsana 2025: Ewlehiya Giştî ya Hewlêrê bazirganiya kriptoyê qedexe kir.\n"
                    "• Hezîrana 2025: HHK ferman da ku hemû şirketên kripto û forexê werin girtin; komîteyek li Wezareta Navxwe hat avakirin (piştî xapandineke nêzî 15 mîlyon dolarî li Duhokê).\n"
                    "• 3ê Gulana 2026: Wezareta Navxwe ragihand ku tu şirket destûr nîne, ev bazirganî qedexe ye û kesên ku dikin dê rûbirûyê girtin û darizandinê bibin.\n"
                    "• Şîret: pere nede şirket an «rêveberê hesab»; heke xapandin dît rapor bike."),
            "ar": ("☀️ <b>إقليم كردستان</b>\n"
                   "• أبريل 2025: مديرية الأمن العام في أربيل حظرت تداول العملات المشفرة.\n"
                   "• يونيو 2025: أمرت حكومة الإقليم بإغلاق جميع شركات الكريبتو والفوركس وشُكلت لجنة في وزارة الداخلية بصلاحية المداهمة (بعد احتيال بنحو 15 مليون دولار في دهوك).\n"
                   "• 3 مايو 2026: أعلنت وزارة داخلية الإقليم أنه لا توجد شركة مرخّصة، وأن هذه التعاملات محظورة، ويواجه العاملون فيها الإغلاق والمساءلة القانونية.\n"
                   "• نصيحة: لا تسلّم أموالك لشركة أو «مدير حساب»؛ وبلّغ عن أي احتيال."),
            "en": ("☀️ <b>Kurdistan Region</b>\n"
                   "• April 2025: Erbil's General Security Directorate banned crypto trading locally.\n"
                   "• June 2025: the KRG ordered all crypto and forex companies closed; an Interior Ministry committee can raid premises (after a ~$15M scam in Duhok).\n"
                   "• 3 May 2026: the KRG Interior Ministry said no company is licensed, these transactions are prohibited, and operators face closure and legal action.\n"
                   "• Advice: don't hand money to a company or “account manager”; report scams.")},
    "ir": {"fa": ("🇮🇷 <b>ایران</b>\n"
                  "• پرداخت با رمزارز در داخل کشور ممنوع است و درگاه‌های ریالی صرافی‌ها زیر نظر بانک مرکزی محدود می‌شوند؛ قوانین اغلب ناگهانی تغییر می‌کنند.\n"
                  "• پس از هک نوبیتکس (خرداد ۱۴۰۴) ساعات فعالیت صرافی‌های داخلی محدود شد (طبق گزارش‌ها ۱۰ تا ۲۰).\n"
                  "• در قطعی‌های اینترنت، دسترسی به صرافی‌ها، برداشت و حتی قیمت‌ها مختل می‌شود؛ برنامهٔ «🆘 قطعی» ربات را ببین.\n"
                  "• صرافی‌های خارجی به‌خاطر تحریم ممکن است حساب کاربران ایرانی را مسدود کنند."),
           "ckb": ("🇮🇷 <b>ئێران</b>\n"
                   "• پارەدان بە کریپتۆ لەناو وڵات قەدەغەیە و دەروازە ڕیاڵییەکان لەژێر چاودێری بانکی ناوەندین؛ یاساکان زۆرجار لەناکاو دەگۆڕێن.\n"
                   "• دوای هاکی نۆبیتێکس (حوزەیرانی ٢٠٢٥) کاتی کارکردنی ئاڵوگۆڕخانە ناوخۆییەکان سنووردار کرا.\n"
                   "• لە پچڕانی ئینتەرنێتدا دەستگەیشتن بە ئاڵوگۆڕخانە و کێشانەوە تێکدەچێت؛ بەشی «🆘 پچڕان» ببینە.\n"
                   "• ئاڵوگۆڕخانە بیانییەکان لەبەر سزاکان دەکرێت هەژماری ئێرانییەکان بوەستێنن."),
           "kmr": ("🇮🇷 <b>Îran</b>\n"
                   "• Dravdan bi kriptoyê li hundir qedexe ye û derîyên rialî di bin çavdêriya bankê de ne; qanûn gelek caran ji nişkê ve diguherin.\n"
                   "• Piştî hackkirina Nobitex (Hezîran 2025) demên xebatê yên borsayên navxweyî hatin sînorkirin.\n"
                   "• Di qutbûna înternetê de gihîştina borsayan û derxistin tevlihev dibe; beşa «🆘» bibîne.\n"
                   "• Borsayên biyanî ji ber cezayan dikarin hesabên Îranî bicemidînin."),
           "ar": ("🇮🇷 <b>إيران</b>\n"
                  "• الدفع بالعملات المشفرة داخل البلاد محظور، وبوابات الريال في المنصات مقيدة بإشراف البنك المركزي؛ القواعد تتغير فجأة كثيراً.\n"
                  "• بعد اختراق نوبيتكس (يونيو 2025) قُيّدت ساعات عمل المنصات المحلية (بحسب التقارير من 10 إلى 20).\n"
                  "• أثناء انقطاع الإنترنت يتعطل الوصول للمنصات والسحب وحتى الأسعار؛ راجع قسم «🆘 الانقطاع».\n"
                  "• قد تجمّد المنصات الأجنبية حسابات الإيرانيين بسبب العقوبات."),
           "en": ("🇮🇷 <b>Iran</b>\n"
                  "• Paying with crypto inside the country is banned and exchanges' rial gateways are restricted under central-bank oversight; rules often change overnight.\n"
                  "• After the Nobitex hack (June 2025) domestic exchanges' operating hours were limited (reportedly 10:00–20:00).\n"
                  "• During internet shutdowns, access to exchanges, withdrawals and even prices break down; see the bot's “🆘 Outage” section.\n"
                  "• Foreign exchanges may freeze Iranian users' accounts because of sanctions.")},
    "tr": {"fa": ("🇹🇷 <b>ترکیه</b>\n"
                  "• از آوریل ۲۰۲۱ پرداخت کالا و خدمات با رمزارز ممنوع است.\n"
                  "• از تیر ۱۴۰۳ (ژوئیهٔ ۲۰۲۴) صرافی‌ها باید از سازمان بازار سرمایه (SPK) مجوز بگیرند؛ فقط از صرافی‌های دارای مجوز استفاده کن."),
           "ckb": ("🇹🇷 <b>تورکیا</b>\n"
                   "• لە نیسانی ٢٠٢١ـەوە پارەدان بە کریپتۆ بۆ کاڵا و خزمەتگوزاری قەدەغەیە.\n"
                   "• لە تەممووزی ٢٠٢٤ـەوە ئاڵوگۆڕخانەکان دەبێت مۆڵەت لە دەستەی بازاڕی سەرمایە (SPK) وەربگرن."),
           "kmr": ("🇹🇷 <b>Tirkiye</b>\n"
                   "• Ji Nîsana 2021an ve dravdana bi kriptoyê ji bo kel û xizmetan qedexe ye.\n"
                   "• Ji Tîrmeha 2024an ve borsa divê ji Desteya Bazara Sermayeyê (SPK) destûr bigirin; tenê yên bi destûr bi kar bîne."),
           "ar": ("🇹🇷 <b>تركيا</b>\n"
                  "• منذ أبريل 2021 يُحظر الدفع بالعملات المشفرة مقابل السلع والخدمات.\n"
                  "• منذ يوليو 2024 يجب على المنصات الحصول على ترخيص هيئة أسواق المال (SPK)؛ استخدم المنصات المرخّصة فقط."),
           "en": ("🇹🇷 <b>Türkiye</b>\n"
                  "• Paying for goods and services with crypto has been banned since April 2021.\n"
                  "• Since July 2024 crypto platforms need a licence from the Capital Markets Board (SPK); use licensed ones only.")},
}
REG_SOURCES = ["https://en.964media.com/47304/",
               "https://www.agbi.com/banking-finance/2025/06/kurdish-authorities-clamp-down-on-crypto-trading/",
               "https://cointelegraph.com/news/iran-crypto-curfew-nobitex-100m-hack"]
REG_DISC = {"fa": "⚖️ این خلاصه مشاورهٔ حقوقی نیست؛ قوانین تغییر می‌کنند. آخرین بررسی: {d}",
            "ckb": "⚖️ ئەمە ئامۆژگاری یاسایی نییە؛ یاساکان دەگۆڕێن. دوایین پشکنین: {d}",
            "kmr": "⚖️ Ev ne şîreta qanûnî ye; qanûn diguherin. Kontrola dawî: {d}",
            "ar": "⚖️ هذا الملخص ليس استشارة قانونية؛ القوانين تتغير. آخر مراجعة: {d}",
            "en": "⚖️ Not legal advice; rules change. Last checked: {d}"}

# ================================================================== menu texts
M = {
    "head": {"fa": "📚 <b>آموزش و امنیت</b>\nبرای شروع امن، از «شروع امن» قدم‌به‌قدم جلو برو.",
             "ckb": "📚 <b>فێربوون و ئاسایش</b>\nبۆ دەستپێکی ئارام، «دەستپێکی ئارام» هەنگاو بە هەنگاو ببینە.",
             "kmr": "📚 <b>Perwerde û ewlehî</b>\nJi bo destpêkeke ewle, gav bi gav «Destpêka ewle» bişopîne.",
             "ar": "📚 <b>التعلم والأمان</b>\nللبداية الآمنة، تابع «البداية الآمنة» خطوة بخطوة.",
             "en": "📚 <b>Learn & stay safe</b>\nFor a safe start, go through “Safe start” step by step."},
    "b_start": {"fa": "🧭 شروع امن (۵ قدم)", "ckb": "🧭 دەستپێکی ئارام (٥ هەنگاو)", "kmr": "🧭 Destpêka ewle (5 gav)",
                "ar": "🧭 البداية الآمنة (5 خطوات)", "en": "🧭 Safe start (5 steps)"},
    "b_reg": {"fa": "⚖️ قوانین منطقه", "ckb": "⚖️ یاساکانی ناوچە", "kmr": "⚖️ Qanûnên herêmê", "ar": "⚖️ قوانين المنطقة",
              "en": "⚖️ Local rules"},
    "b_local": {"fa": "🗞 اخبار منطقه", "ckb": "🗞 هەواڵی ناوچە", "kmr": "🗞 Nûçeyên herêmê", "ar": "🗞 أخبار المنطقة",
                "en": "🗞 Regional news"},
    "b_report": {"fa": "🚩 گزارش کلاهبرداری", "ckb": "🚩 ڕاپۆرتی فێڵ", "kmr": "🚩 Rapora xapandinê", "ar": "🚩 الإبلاغ عن احتيال",
                 "en": "🚩 Report a scam"},
    "b_check": {"fa": "🔎 بررسی توکن (CA)", "ckb": "🔎 پشکنینی تۆکن (CA)", "kmr": "🔎 Kontrola tokenê (CA)",
                "ar": "🔎 فحص رمز (CA)", "en": "🔎 Check a token (CA)"},
    "b_next": {"fa": "بعدی ⬅️", "ckb": "دواتر ⬅️", "kmr": "Pêş ➡️", "ar": "التالي ⬅️", "en": "Next ➡️"},
    "b_prev": {"fa": "➡️ قبلی", "ckb": "➡️ پێشتر", "kmr": "⬅️ Paş", "ar": "➡️ السابق", "en": "⬅️ Back"},
    "done": {"fa": "🎓 آفرین! دورهٔ شروع امن تمام شد.", "ckb": "🎓 ئافەرین! خولەکە تەواو بوو.", "kmr": "🎓 Aferîn! Kurs qediya.",
             "ar": "🎓 أحسنت! أنهيت دورة البداية الآمنة.", "en": "🎓 Well done — you finished Safe start."},
    "report_ask": {"fa": "🚩 لینک، آیدی یا توضیح کلاهبرداری را در یک پیام بفرست تا برای ادمین‌ها ارسال شود. (اطلاعات حساس مثل رمز یا عبارت بازیابی نفرست.)",
                   "ckb": "🚩 بەستەر، ئایدی یان ڕوونکردنەوەی فێڵەکە لە یەک پەیامدا بنێرە بۆ ئەدمینەکان. (وشەی نهێنی مەنێرە.)",
                   "kmr": "🚩 Girêdan, ID an şiroveya xapandinê di yek peyamê de bişîne da ku ji adminan re biçe. (Şîfre neşîne.)",
                   "ar": "🚩 أرسل في رسالة واحدة الرابط أو المعرّف أو وصف الاحتيال ليصل إلى المشرفين. (لا ترسل كلمات مرور أو عبارة الاسترداد.)",
                   "en": "🚩 Send the link, handle or a description in one message and it goes to the admins. (Don't send passwords or recovery phrases.)"},
    "report_ok": {"fa": "✅ گزارشت برای ادمین‌ها ارسال شد. ممنون که به امنیت جامعه کمک می‌کنی.",
                  "ckb": "✅ ڕاپۆرتەکەت نێردرا بۆ ئەدمینەکان. سوپاس.", "kmr": "✅ Rapora te ji adminan re hat şandin. Spas.",
                  "ar": "✅ أُرسل بلاغك إلى المشرفين. شكراً لمساعدتك في حماية المجتمع.", "en": "✅ Report sent to the admins. Thanks for protecting the community."},
    "local_head": {"fa": "🗞 <b>اخبار مرتبط با منطقه</b> (کردستان، عراق، ایران)", "ckb": "🗞 <b>هەواڵی ناوچە</b> (کوردستان، عێراق، ئێران)",
                   "kmr": "🗞 <b>Nûçeyên herêmê</b> (Kurdistan, Iraq, Îran)", "ar": "🗞 <b>أخبار المنطقة</b> (كردستان، العراق، إيران)",
                   "en": "🗞 <b>Regional news</b> (Kurdistan, Iraq, Iran)"},
    "local_none": {"fa": "فعلاً خبر منطقه‌ای تازه‌ای نیست.", "ckb": "ئێستا هەواڵی نوێی ناوچە نییە.", "kmr": "Niha nûçeyeke nû ya herêmê tune.",
                   "ar": "لا توجد أخبار إقليمية جديدة حالياً.", "en": "No fresh regional news right now."},
}


def menu(lang):
    b = lambda k, d: {"text": L(M[k], lang), "callback_data": d}
    return L(M["head"], lang), [[b("b_start", "ln:0")], [b("b_reg", "lg:all"), b("b_local", "lc:0")],
                                [b("b_check", "m:token"), b("b_report", "lr:0")]]


def lesson(i, lang):
    i = max(0, min(i, len(LESSONS) - 1))
    text = L(LESSONS[i], lang)
    nav = []
    if i > 0:
        nav.append({"text": L(M["b_prev"], lang), "callback_data": f"ln:{i - 1}"})
    if i < len(LESSONS) - 1:
        nav.append({"text": L(M["b_next"], lang), "callback_data": f"ln:{i + 1}"})
    else:
        text += "\n\n" + L(M["done"], lang)
    return text, [nav, [{"text": "📚", "callback_data": "m:learn"}]]


def regulation(lang, region="all"):
    order = ["krd", "iq", "ir", "tr"]
    if region in REG:
        order = [region] + [r for r in order if r != region]
    parts = [L(REG[r], lang) for r in order]
    src = "\n".join(f"• {u}" for u in REG_SOURCES)
    text = "\n\n".join(parts) + "\n\n" + L(REG_DISC, lang, d=REG_CHECKED) + "\n" + src
    rows = [[{"text": "☀️", "callback_data": "lg:krd"}, {"text": "🇮🇶", "callback_data": "lg:iq"},
             {"text": "🇮🇷", "callback_data": "lg:ir"}, {"text": "🇹🇷", "callback_data": "lg:tr"}],
            [{"text": "📚", "callback_data": "m:learn"}]]
    return text, rows


LOCAL_RX = re.compile(r"kurd|erbil|irbil|hewl[eê]r|sulayman|slemani|duhok|dohuk|iraq|baghdad|iran|tehran|nobitex|"
                      r"کرد|کورد|اربیل|هەولێر|سلیمانی|سلێمانی|دهوک|دهۆک|عراق|عێراق|ایران|ئێران|تهران|نوبیتکس|تومان|ریال", re.I)


def local_news(D, lang, n=8):
    """headlines mentioning the region, newest first, from all the bot's feeds"""
    news = D.load("news") or {}
    pool = list(((news.get("regional") or {}).get("items")) or []) + list(news.get("items") or [])
    try:
        cn = D.load("cryptonews") or {}
        pool += list(cn.get("items") or []) if isinstance(cn, dict) else []
    except Exception:
        pass
    hits, seen = [], set()
    for it in pool:
        title = it.get("title") or ""
        if not title or title in seen:
            continue
        seen.add(title)
        regional = it in ((news.get("regional") or {}).get("items") or [])
        if regional or LOCAL_RX.search(title):
            hits.append(it)

    def ts(it):
        try:
            return datetime.fromisoformat(str(it.get("date")).replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0

    hits.sort(key=ts, reverse=True)
    out = [L(M["local_head"], lang), ""]
    for it in hits[:n]:
        out.append(f"• <a href=\"{D.e(it.get('url', ''))}\">{D.e(it.get('title', ''))[:140]}</a> — {D.e(it.get('source', ''))}")
    if len(out) == 2:
        out.append(L(M["local_none"], lang))
    return "\n".join(out), [[{"text": "🔄", "callback_data": "lc:0"}, {"text": "📚", "callback_data": "m:learn"}]]


def stamp():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
