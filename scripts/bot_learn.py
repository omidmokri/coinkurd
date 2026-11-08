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
    "b_map": {"fa": "🗺 نقشهٔ یادگیری", "ckb": "🗺 نەخشەی فێربوون", "kmr": "🗺 Nexşeya fêrbûnê", "ar": "🗺 خريطة التعلم",
              "en": "🗺 Learning map"},
    "b_kids": {"fa": "🧒 بیت‌کوین برای کودکان", "ckb": "🧒 بیتکۆین بۆ منداڵان",
               "kmr": "🧒 Bitcoin ji bo zarokan", "ar": "🧒 البيتكوين للأطفال",
               "en": "🧒 Bitcoin for Juniors"},
    "b_lib": {"fa": "🎬 کتابخانهٔ فیلم، کتاب و ابزار", "ckb": "🎬 کتێبخانەی فیلم، کتێب و ئامراز",
              "kmr": "🎬 Pirtûkxaneya fîlm, pirtûk û amûran", "ar": "🎬 مكتبة الأفلام والكتب والأدوات",
              "en": "🎬 Library of films, books and tools"},
    "b_academy": {"fa": "🏛 آکادمی کریپتو و مسیر یادگیری سایت", "ckb": "🏛 ئەکادیمیای کریپتۆ و ڕێڕەوی فێربوون",
                  "kmr": "🏛 Akademiya kriptoyê û rêya fêrbûnê", "ar": "🏛 أكاديمية الكريبتو ومسار التعلم",
                  "en": "🏛 Crypto academy & learning path"},
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
    "done": {"fa": "🎓 آفرین! دورهٔ شروع امن تمام شد. قدم بعدی: آکادمی کریپتو و مسیر یادگیری سایت 👇",
             "ckb": "🎓 ئافەرین! خولەکە تەواو بوو. هەنگاوی دواتر: ئەکادیمیای کریپتۆ 👇", "kmr": "🎓 Aferîn! Kurs qediya. Gava din: akademiya kriptoyê 👇",
             "ar": "🎓 أحسنت! أنهيت دورة البداية الآمنة. الخطوة التالية: أكاديمية الكريبتو ومسار التعلم 👇",
             "en": "🎓 Well done — you finished Safe start. Next step: the crypto academy and learning path 👇"},
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
    return L(M["head"], lang), [[b("b_map", "lm:0")], [b("b_kids", "lk:0")], [b("b_lib", "ll:0")],
                                [b("b_academy", "la:0")],
                                [b("b_start", "ln:0")], [b("b_reg", "lg:all"), b("b_local", "lc:0")],
                                [b("b_check", "m:token"), b("b_report", "lr:0")]]


# ================================================================== entekhab.net academy (inside the bot)
SITE = "https://entekhab.net"
# faculty titles in the bot's other languages (Persian titles and the English ones come from academy_data)
FAC_T = {
    "f1": {"ckb": "بنەماکانی ئابووری و بازاڕی کریپتۆ", "kmr": "Bingehên aborî û bazara kriptoyê", "ar": "أساسيات الاقتصاد وسوق الكريبتو"},
    "f2": {"ckb": "بلۆکچەین و نهێنینووسی", "kmr": "Blockchain û kriptografî", "ar": "البلوكتشين والتشفير"},
    "f3": {"ckb": "بیتکۆین، ئیتریۆم و دراوە دیجیتاڵەکان", "kmr": "Bitcoin, Ethereum û kripto", "ar": "البيتكوين والإيثريوم والعملات الرقمية"},
    "f4": {"ckb": "جزدان و ئاسایشی سامان", "kmr": "Cûzdan û ewlehiya malê", "ar": "المحافظ وأمان الأصول"},
    "f5": {"ckb": "ئاڵوگۆڕخانەکان و میکانیزمی مامەڵە", "kmr": "Borsa û mekanîzmaya bazirganiyê", "ar": "المنصات وآلية التداول"},
    "f6": {"ckb": "شیکاری تەکنیکی", "kmr": "Analîza teknîkî", "ar": "التحليل الفني"},
    "f7": {"ckb": "شیکاری بنەڕەتی", "kmr": "Analîza bingehîn", "ar": "التحليل الأساسي"},
    "f8": {"ckb": "شیکاری ئۆنچەین", "kmr": "Analîza on-chain", "ar": "تحليل البيانات على السلسلة"},
    "f9": {"ckb": "بازرگانی پرۆفیشناڵ", "kmr": "Bazirganiya profesyonel", "ar": "التداول الاحترافي"},
    "f10": {"ckb": "بەڕێوەبردنی سەرمایە و مەترسی", "kmr": "Rêveberiya sermaye û xeterê", "ar": "إدارة رأس المال والمخاطر"},
    "f11": {"ckb": "DeFi، وێب ٣ و تەکنەلۆژیای پێشکەوتوو", "kmr": "DeFi, Web3 û teknolojiya pêşketî", "ar": "التمويل اللامركزي والويب 3 والتقنيات المتقدمة"},
    "f12": {"ckb": "توێژینەوەی پسپۆڕی و پڕۆژەی کۆتایی", "kmr": "Pisporî û projeya dawî", "ar": "التخصص والمشروع النهائي"},
    "f13": {"ckb": "ستراتیژی سێگۆشە و تونێل (ڕێبازی ئەندازیار ئومێد دەباغچی مکری)",
            "kmr": "Stratejiya Sêgoşe û Tunelê (Endazyar Omîd Debaxçî Mikrî)",
            "ar": "استراتيجية المثلثات والنفق (منهج المهندس أميد دباغتشي مكري)"},
}
# شمار دانشکده‌ها از academy_data خوانده می‌شود تا متن ربات هرگز از سایت عقب نماند.
_FA_D, _AR_D = "۰۱۲۳۴۵۶۷۸۹", "٠١٢٣٤٥٦٧٨٩"


def _num(n, lang="fa"):
    d = {"fa": _FA_D, "ckb": _AR_D}.get(lang)
    return "".join(d[int(c)] for c in str(n)) if d else str(n)


def _n_fac():
    try:
        import os
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import academy_data as AD
        return len(AD.FACULTIES)
    except Exception:
        return 0


_NFAC = _n_fac()

AC = {
    "title": {"fa": "🏛 <b>آکادمی کریپتو انتخاب</b>", "ckb": "🏛 <b>ئەکادیمیای کریپتۆی ئینتیخاب</b>", "kmr": "🏛 <b>Akademiya Kriptoyê ya Entekhab</b>",
              "ar": "🏛 <b>أكاديمية انتخاب للكريبتو</b>", "en": "🏛 <b>Entekhab Crypto Academy</b>"},
    "desc": {"fa": f"{_num(_NFAC)} دانشکده از صفر تا حرفه‌ای، با آزمون، شبیه‌ساز معامله و گواهی — رایگان در entekhab.net",
             "ckb": f"{_num(_NFAC, 'ckb')} کۆلێژ لە سفرەوە تا پرۆفیشناڵ، بە تاقیکردنەوە، سیمولەیتەر و بڕوانامە — بەخۆڕایی لە entekhab.net",
             "kmr": f"{_NFAC} fakulte ji sifirê heta profesyonel, bi ezmûn, sîmulator û sertîfîka — belaş li entekhab.net",
             "ar": f"{_num(_NFAC, 'ckb')} كلية من الصفر حتى الاحتراف، مع اختبارات ومحاكي تداول وشهادات — مجاناً على entekhab.net",
             "en": f"{_NFAC} faculties from zero to pro, with quizzes, a trading simulator and certificates — free on entekhab.net"},
    "stat": {"fa": "✅ {p} دانشکده منتشر شده · {n} درس · بقیه به‌ترتیب اضافه می‌شوند",
             "ckb": "✅ {p} کۆلێژ بڵاوکراوەتەوە · {n} وانە · ئەوانی تر بە ڕیز زیاد دەکرێن",
             "kmr": "✅ {p} fakulte hatine weşandin · {n} ders · yên din li pey hev tên",
             "ar": "✅ نُشرت {p} كليات · {n} درساً · وتُضاف البقية تباعاً",
             "en": "✅ {p} faculties published · {n} lessons · the rest are added in order"},
    "soon": {"fa": "به‌زودی", "ckb": "بەم زووانە", "kmr": "di nêzîk de", "ar": "قريباً", "en": "soon"},
    "path": {"fa": "🎓 <b>مسیر یادگیری</b> — ۳ سطح، ۱۲ درس کوتاه با آزمون؛ بهترین نقطهٔ شروع.",
             "ckb": "🎓 <b>ڕێڕەوی فێربوون</b> — ٣ ئاست، ١٢ وانەی کورت بە تاقیکردنەوە؛ باشترین خاڵی دەستپێک.",
             "kmr": "🎓 <b>Rêya fêrbûnê</b> — 3 ast, 12 dersên kurt bi ezmûn; cihê herî baş ê destpêkê.",
             "ar": "🎓 <b>مسار التعلم</b> — 3 مستويات و12 درساً قصيراً مع اختبارات؛ أفضل نقطة للبدء.",
             "en": "🎓 <b>Learning path</b> — 3 levels, 12 short lessons with quizzes; the best place to start."},
    "note": {"fa": "🔒 پیشرفت شما فقط در مرورگر خودتان ذخیره می‌شود. آموزشی است، توصیهٔ مالی نیست.",
             "ckb": "🔒 پێشکەوتنەکەت تەنها لە وێبگەڕەکەی خۆتدا هەڵدەگیرێت. فێرکارییە، ئامۆژگاری دارایی نییە.",
             "kmr": "🔒 Pêşketina te tenê di geroka te de tê tomarkirin. Perwerdeyî ye, ne şîreta darayî ye.",
             "ar": "🔒 يُحفظ تقدمك في متصفحك فقط. محتوى تعليمي وليس نصيحة مالية.",
             "en": "🔒 Your progress is stored only in your own browser. Educational, not financial advice."},
    "b_psy": {"fa": "🧠 روان‌شناسی معامله‌گر", "ckb": "🧠 دەروونناسیی مامەڵەکار",
              "kmr": "🧠 Psîkolojiya bazirganiyê", "ar": "🧠 سيكولوجية المتداول",
              "en": "🧠 Trading psychology"},
    "b_study": {"fa": "📖 خواندن درس‌ها در همین ربات", "ckb": "📖 خوێندنی وانەکان لە هەمان بۆت",
                "kmr": "📖 Dersan di vê botê de bixwîne", "ar": "📖 ادرس الدروس داخل البوت",
                "en": "📖 Study the lessons inside the bot"},
    "b_enter": {"fa": "🏛 ورود به آکادمی", "ckb": "🏛 چوونە ناو ئەکادیمیا", "kmr": "🏛 Têkeve akademiyê", "ar": "🏛 ادخل الأكاديمية",
                "en": "🏛 Open the academy"},
    "b_path": {"fa": "🎓 مسیر یادگیری", "ckb": "🎓 ڕێڕەوی فێربوون", "kmr": "🎓 Rêya fêrbûnê", "ar": "🎓 مسار التعلم", "en": "🎓 Learning path"},
    "b_lab": {"fa": "🧪 آزمایشگاه و شبیه‌ساز", "ckb": "🧪 تاقیگە و سیمولەیتەر", "kmr": "🧪 Laboratuwar û sîmulator", "ar": "🧪 المختبر والمحاكي",
              "en": "🧪 Lab & simulator"},
    "b_place": {"fa": "🧭 آزمون تعیین سطح", "ckb": "🧭 تاقیکردنەوەی ئاست", "kmr": "🧭 Ezmûna astê", "ar": "🧭 اختبار تحديد المستوى",
                "en": "🧭 Placement test"},
    "b_gloss": {"fa": "📖 واژه‌نامه", "ckb": "📖 فەرهەنگ", "kmr": "📖 Ferheng", "ar": "📖 المسرد", "en": "📖 Glossary"},
    "b_me": {"fa": "📊 داشبورد من", "ckb": "📊 داشبۆردەکەم", "kmr": "📊 Panela min", "ar": "📊 لوحتي", "en": "📊 My dashboard"},
    "b_back": {"fa": "📚 آموزش و امنیت", "ckb": "📚 فێربوون و ئاسایش", "kmr": "📚 Perwerde û ewlehî", "ar": "📚 التعلم والأمان",
               "en": "📚 Learning & safety"},
    "b_home": {"fa": "🏠 خانه", "ckb": "🏠 سەرەکی", "kmr": "🏠 Mal", "ar": "🏠 الرئيسية", "en": "🏠 Home"},
}

# ================================================================== the learning map, inside the bot
_FA_DIG = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
_CKB_DIG = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def _num(n, lang):
    s = str(n)
    return s.translate(_FA_DIG) if lang == "fa" else s.translate(_CKB_DIG) if lang in ("ckb", "ar") else s


def faculties():
    """[(faculty dict, n_lessons)] from the site's own academy data; [] if it can't be read"""
    try:
        import academy_data as AD
        content = AD.load_content()
        return [(f, len(getattr(content.get(f["id"]), "LESSONS", []) or [])) for f in AD.FACULTIES]
    except Exception:
        return []


def fac_title(f, lang):
    if lang == "fa":
        return f["title"]
    if lang == "en":
        return f.get("en") or f["title"]
    return FAC_T.get(f["id"], {}).get(lang) or f.get("en") or f["title"]


def academy(lang):
    """-> (text, rows): the site's academy, inside the bot — live list of faculties + direct links"""
    fs = faculties()
    pub = [(f, n) for f, n in fs if n]
    out = [L(AC["title"], lang), L(AC["desc"], lang)]
    if fs:
        out.append(L(AC["stat"], lang, p=_num(len(pub), lang), n=_num(sum(n for _, n in pub), lang)))
        out.append("")
        for f, n in fs:
            mark = "✅" if n else "⏳"
            tail = "" if n else f" <i>({L(AC['soon'], lang)})</i>"
            out.append(f"{mark} {f['icon']} {_num(f['n'], lang)}. {fac_title(f, lang)}{tail}")
    out += ["", L(AC["path"], lang), "", L(AC["note"], lang)]
    u = lambda k, path: {"text": L(AC[k], lang), "url": SITE + path}
    # اول درس‌های داخل ربات، بعد لینک‌های سایت: کسی که ربات را دارد نباید مجبور به باز کردن سایت باشد
    rows = [[{"text": L(M["b_map"], lang), "callback_data": "lm:0"}],
            [{"text": L(AC["b_study"], lang), "callback_data": "ak:f"}],
            [{"text": L(AC["b_psy"], lang), "callback_data": "py:m"}],
            [u("b_enter", "/academy/")]]
    fac_btns = [{"text": f"{f['icon']} {fac_title(f, lang)}"[:64], "url": f"{SITE}/academy/{f['id']}/"} for f, _ in pub]
    rows += [fac_btns[i:i + 2] for i in range(0, len(fac_btns), 2)]
    rows += [[u("b_path", "/learn/"), u("b_lab", "/academy/lab/")],
             [u("b_place", "/academy/placement/"), u("b_gloss", "/glossary/")],
             [u("b_me", "/academy/me/")],
             [{"text": L(AC["b_back"], lang), "callback_data": "m:learn"}, {"text": L(AC["b_home"], lang), "callback_data": "m:main"}]]
    return "\n".join(out), rows


MP = {
    "title": {"fa": "🗺 <b>نقشهٔ یادگیری</b>", "ckb": "🗺 <b>نەخشەی فێربوون</b>", "kmr": "🗺 <b>Nexşeya fêrbûnê</b>",
              "ar": "🗺 <b>خريطة التعلم</b>", "en": "🗺 <b>The learning map</b>"},
    "desc": {"fa": "هر چیزی که این سایت یاد می‌دهد، روی یک نقشه. داخل هر موضوع فهرستی از درس‌ها، اصطلاح‌ها، "
                   "ابزارها و منابعی است که همان درس‌ها به آن‌ها ارجاع می‌دهند — و می‌توانید تیک بزنید.",
             "ckb": "هەر شتێک ئەم ماڵپەڕە فێری دەکات، لەسەر یەک نەخشە. لە ناو هەر بابەتێکدا لیستێکە لە وانە، زاراوە، "
                    "ئامراز و ئەو سەرچاوانەی هەمان وانەکان ئاماژەیان پێ دەکەن — و دەتوانیت نیشانەیان بکەیت.",
             "kmr": "Her tiştê ev malper hîn dike, li ser nexşeyekê. Di nav her mijarê de lîsteyek ji ders, "
                    "peyv, amûr û çavkaniyan heye.",
             "ar": "كل ما يعلّمه هذا الموقع على خريطة واحدة. داخل كل موضوع قائمة من الدروس والمصطلحات والأدوات والمصادر.",
             "en": "Everything this site teaches, on one map. Inside each topic is a checklist of lessons, terms, "
                   "tools and the sources those lessons cite."},
    "stat": {"fa": "🧭 {t} موضوع — هر کدام با فهرست قابل تیک‌زدن خودش", "ckb": "🧭 {t} بابەت — هەریەکە بە لیستی نیشانەکردنی خۆی",
             "kmr": "🧭 {t} mijar — her yek bi lîsteya xwe", "ar": "🧭 {t} موضوعاً — لكلٍّ قائمته القابلة للتعليم",
             "en": "🧭 {t} topics — each with its own checklist"},
    "b_open": {"fa": "🗺 باز کردن نقشه", "ckb": "🗺 کردنەوەی نەخشە", "kmr": "🗺 Nexşeyê veke", "ar": "🗺 افتح الخريطة",
               "en": "🗺 Open the map"},
    "none": {"fa": "نقشه هنوز ساخته نشده است؛ کمی بعد دوباره امتحان کن.", "ckb": "نەخشەکە هێشتا دروست نەکراوە؛ دواتر هەوڵ بدەرەوە.",
             "kmr": "Nexşe hê nehatiye çêkirin; paşê dîsa biceribîne.", "ar": "لم تُبنَ الخريطة بعد؛ حاول لاحقاً.",
             "en": "The map has not been built yet; try again shortly."},
}


KD = {
    "title": {"fa": "🧒 <b>بیت‌کوین برای کودکان</b>", "ckb": "🧒 <b>بیتکۆین بۆ منداڵان</b>",
              "kmr": "🧒 <b>Bitcoin ji bo zarokan</b>", "ar": "🧒 <b>البيتكوين للأطفال</b>",
              "en": "🧒 <b>Bitcoin for Juniors</b>"},
    "desc": {"fa": "برنامهٔ درسی آزاد و رایگان «Bitcoin for Juniors» از سازمان غیرانتفاعی My First Bitcoin برای کودکان ۸ تا ۱۲ ساله: "
                   "۶ فصل و ۲۱ فعالیت با بازی، قصه و گفت‌وگو دربارهٔ ارزش، قیمت، زمان، انرژی، انصاف و حریم خصوصی — "
                   "و در پایان خودِ بیت‌کوین. لازم نیست کودکان مستقیم از بیت‌کوین استفاده کنند. "
                   "متن کامل به فارسی، کوردی سورانی و انگلیسی.",
             "ckb": "پرۆگرامی وانەیی کراوە و بێبەرامبەری «Bitcoin for Juniors» لە ڕێکخراوی ناقازانجی My First Bitcoin بۆ منداڵانی ٨ بۆ ١٢ ساڵ: "
                    "٦ بەش و ٢١ چالاکی بە یاری، چیرۆک و گفتوگۆ دەربارەی بەها، نرخ، کات، وزە، دادپەروەری و تایبەتێتی — "
                    "لە کۆتاییدا خودی بیتکۆین. پێویست ناکات منداڵان ڕاستەوخۆ بیتکۆین بەکاربهێنن. "
                    "دەقی تەواو بە فارسی، کوردیی سۆرانی و ئینگلیزی.",
             "kmr": "Bernameya dersê ya vekirî û belaş «Bitcoin for Juniors» ji rêxistina ne-qezencî My First Bitcoin, ji bo zarokên 8 heta 12 salî: "
                    "6 beş û 21 çalakî bi lîstik, çîrok û gotûbêj li ser nirx, biha, dem, enerjî, dadmendî û nehêniyê — "
                    "û di dawiyê de Bitcoin bi xwe. Ne pêwist e zarok rasterast Bitcoin bi kar bînin. "
                    "Nivîsa tevahî bi Farsî, Soranî û Îngilîzî ye.",
             "ar": "منهج مفتوح ومجاني «Bitcoin for Juniors» من منظمة My First Bitcoin غير الربحية للأطفال من ٨ إلى ١٢ سنة: "
                   "٦ فصول و٢١ نشاطًا بالألعاب والقصص والنقاش حول القيمة والسعر والوقت والطاقة والعدالة والخصوصية — "
                   "ثم البيتكوين نفسه في النهاية. لا يُطلب من الأطفال استخدام البيتكوين مباشرةً. "
                   "النص الكامل بالفارسية والكردية السورانية والإنجليزية.",
             "en": "The free, open “Bitcoin for Juniors” curriculum by the non-profit My First Bitcoin, for children aged 8 to 12: "
                   "6 modules and 21 activities of games, stories and discussion about value, price, time, energy, fairness and privacy — "
                   "and, at the end, Bitcoin itself. Children are not required to use Bitcoin directly. "
                   "Full text in Persian, Sorani Kurdish and English."},
    "note": {"fa": "ترجمه‌های فارسی و کوردی سورانی با هوش مصنوعی انجام شده‌اند و رسمی نیستند؛ متن انگلیسی کنار آن است. مجوز: CC BY-SA 4.0. "
                   "پیشرفت شما فقط در مرورگر خودتان ذخیره می‌شود. آموزشی است، توصیهٔ مالی نیست.",
             "ckb": "وەرگێڕانی فارسی و کوردیی سۆرانی بە زیرەکیی دەستکرد کراوە و فەرمی نییە؛ دەقی ئینگلیزی لەگەڵیدایە. مۆڵەت: CC BY-SA 4.0. "
                    "پێشکەوتنت تەنها لە وێبگەڕی خۆتدا پاشەکەوت دەکرێت. فێرکارییە، ئامۆژگاریی دارایی نییە.",
             "kmr": "Wergera Farsî û Soranî bi AI hatiye çêkirin û ne fermî ye; nivîsa Îngilîzî li kêleka wê ye. Lîsans: CC BY-SA 4.0. "
                    "Pêşketina te tenê di gerokê te de tê tomar kirin. Perwerdehî ye, ne şîreta darayî ye.",
             "ar": "الترجمتان الفارسية والكردية السورانية أُنجزتا بالذكاء الاصطناعي وليستا رسميتين؛ والنص الإنجليزي بجانبهما. الترخيص: CC BY-SA 4.0. "
                   "يُحفظ تقدمك في متصفحك فقط. المحتوى تعليمي وليس نصيحة مالية.",
             "en": "The Persian and Sorani Kurdish translations were made with AI and are unofficial; the English text sits beside them. "
                   "Licence: CC BY-SA 4.0. Your progress is kept only in your own browser. Educational, not financial advice."},
    "b_open": {"fa": "🧒 باز کردن برنامهٔ درسی", "ckb": "🧒 کردنەوەی پرۆگرامی وانەیی", "kmr": "🧒 Bernameyê veke",
               "ar": "🧒 افتح المنهج", "en": "🧒 Open the curriculum"},
    "b_par": {"fa": "👪 راهنمای والدین", "ckb": "👪 ڕێبەری دایک و باوکان", "kmr": "👪 Rêbera dê û bavan",
              "ar": "👪 دليل الأهل", "en": "👪 Parent guide"},
    "b_gloss": {"fa": "📖 واژه‌نامه", "ckb": "📖 وشەنامە", "kmr": "📖 Ferheng", "ar": "📖 المسرد",
                "en": "📖 Glossary"},
    "b_about": {"fa": "ℹ️ دربارهٔ این برنامه، مجوز و ترجمه", "ckb": "ℹ️ دەربارەی ئەم پرۆگرامە، مۆڵەت و وەرگێڕان",
                "kmr": "ℹ️ Der barê bernameyê, lîsans û wergerê", "ar": "ℹ️ عن المنهج والترخيص والترجمة",
                "en": "ℹ️ About the curriculum, licence and translation"},
    "mods": [
        (1, "🤝", {"fa": "مبادله، ارزش و قیمت", "ckb": "ئالوگۆڕ، بەها و نرخ", "kmr": "Danûstandin, nirx û biha",
                   "ar": "التبادل والقيمة والسعر", "en": "Exchange, Value, and Price"}),
        (2, "⏳", {"fa": "زمان، انرژی و پاداش", "ckb": "کات، وزە و پاداش", "kmr": "Dem, enerjî û xelat",
                   "ar": "الوقت والطاقة والمكافأة", "en": "Time, Energy, and Reward"}),
        (3, "🖥️", {"fa": "آنالوگ در برابر دیجیتال", "ckb": "ئەنالۆگ بەرامبەر دیجیتاڵ", "kmr": "Analog li hemberî dîjîtal",
                    "ar": "التناظري مقابل الرقمي", "en": "Analog vs. Digital"}),
        (4, "🔐", {"fa": "ایمنی، امنیت و حریم خصوصی", "ckb": "سەلامەتی، ئاسایش و تایبەتێتی", "kmr": "Ewlehî, ewlekarî û nehênî",
                   "ar": "السلامة والأمان والخصوصية", "en": "Safety, Security, and Privacy"}),
        (5, "💰", {"fa": "پول مهم است", "ckb": "پارە گرنگە", "kmr": "Pere girîng e",
                   "ar": "المال مهم", "en": "Money Matters"}),
        (6, "₿", {"fa": "مبانی بیت‌کوین", "ckb": "بنەماکانی بیتکۆین", "kmr": "Bingehên Bitcoinê",
                  "ar": "أساسيات البيتكوين", "en": "Bitcoin Basics"}),
    ],
}


def _num(n, lang):
    """a module number in the digits of the reader's language"""
    d = {"fa": "۰۱۲۳۴۵۶۷۸۹", "ckb": "٠١٢٣٤٥٦٧٨٩", "ar": "٠١٢٣٤٥٦٧٨٩"}.get(lang)
    return "".join(d[int(c)] for c in str(n)) if d else str(n)


def kids_screen(lang):
    """-> (text, rows): the 'Bitcoin for Juniors' course (open curriculum, CC BY-SA 4.0) with a button per module"""
    out = [L(KD["title"], lang), L(KD["desc"], lang), ""]
    for n, icon, t in KD["mods"]:
        out.append(f"{icon} {_num(n, lang)}. {L(t, lang)}")
    out += ["", L(KD["note"], lang)]
    rows = [[{"text": L(KD["b_open"], lang), "url": SITE + "/kids/"}]]
    btns = [{"text": f"{icon} {_num(n, lang)}. {L(t, lang)}"[:64], "url": f"{SITE}/kids/m{n}/"} for n, icon, t in KD["mods"]]
    rows += [btns[i:i + 2] for i in range(0, len(btns), 2)]
    rows += [[{"text": L(KD["b_par"], lang), "url": SITE + "/kids/parents/"},
              {"text": L(KD["b_gloss"], lang), "url": SITE + "/kids/glossary/"}]]
    rows += [[{"text": L(KD["b_about"], lang), "url": SITE + "/kids/about/"}]]
    rows += [[{"text": L(AC["b_back"], lang), "callback_data": "m:learn"},
              {"text": L(AC["b_home"], lang), "callback_data": "m:main"}]]
    return "\n".join(out), rows


# ================================================================== the markets library (mirrors the site's /#library)
LB = {
    "title": {"fa": "🎬 <b>کتابخانهٔ بازارهای مالی</b>", "ckb": "🎬 <b>کتێبخانەی بازاڕە داراییەکان</b>",
              "kmr": "🎬 <b>Pirtûkxaneya bazarên darayî</b>", "ar": "🎬 <b>مكتبة الأسواق المالية</b>",
              "en": "🎬 <b>Financial markets library</b>"},
    "desc": {"fa": "فیلم، مستند، کتاب، ابزار و منبع آموزشی رایگان — هر کدام با معرفی و درسی که برای معامله‌گر دارد، به فارسی، کوردی سورانی و انگلیسی.",
             "ckb": "فیلم، دۆکیۆمێنتاری، کتێب، ئامراز و سەرچاوەی فێرکاریی بێبەرامبەر — هەر یەکەیان بە ناساندن و ئەو وانەیەی بۆ بازرگان هەیەتی، بە فارسی، کوردیی سۆرانی و ئینگلیزی.",
             "kmr": "Fîlm, dokumenter, pirtûk, amûr û çavkaniyên fêrbûnê yên belaş — her yek bi danasîn û wê dersa ku ji bo bazirganekî heye, bi farisî, kurdiya soranî û îngilîzî.",
             "ar": "أفلام ووثائقيات وكتب وأدوات ومصادر تعلم مجانية — لكل منها تعريف والدرس الذي يقدمه للمتداول، بالفارسية والكردية السورانية والإنجليزية.",
             "en": "Films, documentaries, books, tools and free courses — each with what it is and what a trader can take from it, in Persian, Sorani Kurdish and English."},
    "note": {"fa": "هیچ فیلم، کتاب یا فایلی روی سایت گذاشته نشده؛ فقط معرفی و پیوند به صفحهٔ اطلاعات، سایت رسمی یا ناشر. هیچ‌کدام تضمین سود نیست.",
             "ckb": "هیچ فیلم، کتێب یان فایلێک لەسەر ماڵپەڕەکە دانەنراوە؛ تەنیا ناساندن و بەستەر بۆ پەڕەی زانیاری، ماڵپەڕی فەرمی یان بڵاوکەرەوە. هیچ کامیان دڵنیایی قازانج نین.",
             "kmr": "Li ser malperê fîlm, pirtûk an dosyeyek nehatiye danîn; tenê danasîn û girêdana rûpela zanyariyê, malpera fermî an weşanger. Yek jî garantiya qezencê nîne.",
             "ar": "لا يُستضاف أي فيلم أو كتاب أو ملف على الموقع؛ فقط تعريف ورابط إلى صفحة معلومات أو الموقع الرسمي أو الناشر. لا شيء منها يضمن ربحاً.",
             "en": "No film, book or file is hosted on the site — only a description and a link to an information page, official site or publisher. None of it guarantees a profit."},
    "b_open": {"fa": "📖 باز کردن کتابخانه", "ckb": "📖 کردنەوەی کتێبخانە", "kmr": "📖 Pirtûkxaneyê veke",
               "ar": "📖 افتح المكتبة", "en": "📖 Open the library"},
    "none": {"fa": "کتابخانه هنوز آماده نیست.", "ckb": "کتێبخانە هێشتا ئامادە نییە.",
             "kmr": "Pirtûkxane hîn ne amade ye.", "ar": "المكتبة ليست جاهزة بعد.", "en": "The library is not ready yet."},
}
LB_IC = {"film": "🎬", "doc": "🎥", "book": "📚", "tool": "🧰", "free": "🎓", "bio": "🧭"}
# the data file is trilingual like the site; the bot's other two languages get their names here
LB_CAT = {
    "film": {"kmr": "Fîlmên sînemayî", "ar": "أفلام روائية"},
    "doc":  {"kmr": "Dokumenter", "ar": "أفلام وثائقية"},
    "book": {"kmr": "Pirtûk", "ar": "كتب"},
    "tool": {"kmr": "Amûr û platform", "ar": "أدوات ومنصات"},
    "free": {"kmr": "Fêrbûna belaş", "ar": "تعلم مجاني"},
    "bio":  {"kmr": "Jiyannameyên bazirganan", "ar": "سير المتداولين"},
}


def _lib():
    """the same data file the site's library section reads; () when it is missing"""
    import json
    import os
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "library.json")
    try:
        d = json.load(open(path, encoding="utf-8"))
        return d.get("cats") or [], d.get("items") or []
    except Exception:
        return [], []


def library_screen(lang):
    """-> (text, rows): the categories of the site library, with how many entries each holds"""
    cats, items = _lib()
    if not cats or not items:
        return L(LB["none"], lang), [[{"text": L(AC["b_back"], lang), "callback_data": "m:learn"},
                                      {"text": L(AC["b_home"], lang), "callback_data": "m:main"}]]
    lg = lang if lang in ("fa", "ckb", "en") else "en"
    pick_t = lambda d: (d or {}).get(lg) or (d or {}).get("en") or (d or {}).get("fa") or ""
    out = [L(LB["title"], lang), L(LB["desc"], lang), ""]
    rows = [[{"text": L(LB["b_open"], lang), "url": SITE + "/#library"}]]
    btns = []
    for c in cats:
        n = sum(1 for it in items if it.get("cat") == c["k"])
        if not n:
            continue
        ic = LB_IC.get(c["k"], "•")
        name = LB_CAT.get(c["k"], {}).get(lang) or pick_t(c.get("t"))
        out.append(f"{ic} {name} — {_num(n, lang)}")
        btns.append({"text": f"{ic} {name}"[:64], "url": f"{SITE}/#library"})
    out += ["", L(LB["note"], lang)]
    rows += [btns[i:i + 2] for i in range(0, len(btns), 2)]
    rows += [[{"text": L(AC["b_back"], lang), "callback_data": "m:learn"},
              {"text": L(AC["b_home"], lang), "callback_data": "m:main"}]]
    return "\n".join(out), rows


def map_screen(lang):
    """-> (text, rows): the site's learning map, listed inside the bot with a link per topic.

    The list comes from the same academy data the academy screen reads, so it can never drift from
    the site; the counts in each topic's checklist live on the page itself.
    """
    fs = faculties()
    if not fs:
        return L(MP["none"], lang), [[{"text": L(AC["b_back"], lang), "callback_data": "m:learn"},
                                      {"text": L(AC["b_home"], lang), "callback_data": "m:main"}]]
    out = [L(MP["title"], lang), L(MP["desc"], lang), "",
           L(MP["stat"], lang, t=_num(len(fs), lang)), ""]
    for f, n in fs:
        mark = "✅" if n else "⏳"
        tail = "" if n else f" <i>({L(AC['soon'], lang)})</i>"
        out.append(f"{mark} {f['icon']} {fac_title(f, lang)}{tail}")
    out += ["", L(AC["note"], lang)]
    btns = [{"text": f"{f['icon']} {fac_title(f, lang)}"[:64], "url": f"{SITE}/map/{f['id']}/"} for f, _ in fs]
    rows = [[{"text": L(MP["b_open"], lang), "url": SITE + "/map/"}]]
    rows += [btns[i:i + 2] for i in range(0, len(btns), 2)]
    rows += [[{"text": L(AC["b_back"], lang), "callback_data": "m:learn"},
              {"text": L(AC["b_home"], lang), "callback_data": "m:main"}]]
    return "\n".join(out), rows


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
        return text, [nav, [{"text": L(M["b_academy"], lang), "callback_data": "la:0"}],
                      [{"text": "📚", "callback_data": "m:learn"}]]
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
