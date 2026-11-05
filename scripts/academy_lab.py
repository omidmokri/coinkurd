# -*- coding: utf-8 -*-
"""HTML of /academy/lab/ — the behaviour lives in assets/academy-lab.js (everything runs in the browser, virtual money only)."""


def f(id_, label, val="", typ="number", step="any", extra=""):
    return f'<label>{label}<input id="{id_}" type="{typ}" step="{step}" value="{val}" inputmode="decimal" {extra}></label>'


def sel(id_, label, opts):
    o = "".join(f'<option value="{v}">{t}</option>' for v, t in opts)
    return f'<label>{label}<select id="{id_}">{o}</select></label>'


NAV = [("sim", "📈 شبیه‌ساز معامله"), ("journal", "📒 ژورنال"), ("backtest", "🧮 بک‌تست"), ("calc-size", "📐 حجم پوزیشن"),
       ("calc-rr", "⚖️ ریسک به بازده"), ("calc-pnl", "💰 سود و زیان"), ("calc-liq", "💥 قیمت لیکوئید"), ("calc-fee", "🧾 کارمزد"),
       ("calc-supply", "🪙 توکنومیکس"), ("hash", "#️⃣ هش"), ("keys", "🔑 کلید و امضا"), ("tx", "🔗 تراکنش واقعی")]

HTML = (
    '<div id="ac" data-page="lab"><h1>🧪 آزمایشگاه آکادمی</h1>'
    '<p class="txt">همهٔ ابزارها در مرورگر شما اجرا می‌شوند و فقط با <b>سرمایهٔ مجازی</b> کار می‌کنند؛ هیچ اتصالی به حساب صرافی یا کیف پول وجود ندارد. '
    'نتیجهٔ شبیه‌ساز، بک‌تست و ماشین‌حساب‌ها آموزشی است و تضمینی برای عملکرد واقعی بازار نیست.</p>'
    '<nav class="lab-nav">' + "".join(f'<a class="ac-chip" href="#{a}">{b}</a>' for a, b in NAV) + '</nav>'

    # ---------------------------------------------------------------- simulator
    '<section class="lab-card" id="sim"><h2>📈 شبیه‌ساز معامله روی دادهٔ تاریخی</h2>'
    '<p class="note">یک نقطهٔ تصادفی از گذشته انتخاب می‌شود و فقط کندل‌های تا «اکنونِ شبیه‌سازی» را می‌بینید؛ آینده تا زمانی که کندل بعد را باز نکنید پنهان است. '
    'سفارش‌ها با کندل بعدی پر می‌شوند و اگر حد ضرر و حد سود در یک کندل لمس شوند، فرض محافظه‌کارانه «اول حد ضرر» اعمال می‌شود.</p>'
    '<div class="lab-bar">'
    '<select id="sSym" class="lab-in"><option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option><option>BNBUSDT</option></select>'
    '<select id="sIv" class="lab-in"><option value="1d">روزانه</option><option value="4h">۴ ساعته</option><option value="1h">۱ ساعته</option></select>'
    '<select id="sMode" class="lab-in"><option value="spot">اسپات</option><option value="fut">فیوچرز</option></select>'
    '<button class="ac-btn ghost" id="sNew" type="button">🎲 شروع دورهٔ تازه</button>'
    '<label class="note" style="display:flex;gap:4px;align-items:center"><input type="checkbox" id="sEma" checked> EMA20/50</label></div>'
    '<div class="lab-chart"><canvas id="sCv"></canvas></div>'
    '<div class="lab-bar"><button class="ac-btn" id="sNext" type="button">▶ کندل بعد</button><button class="ac-btn ghost" id="sNext5" type="button">⏩ ۵ کندل</button>'
    '<button class="ac-btn ghost" id="sPlay" type="button">⏯ پخش خودکار</button><button class="ac-btn ghost" id="sDraw" type="button">✏️ رسم سطح</button>'
    '<button class="ac-btn ghost" id="sClr" type="button">پاک‌کردن سطوح</button><span class="lab-msg" id="sMsg"></span></div>'
    '<div class="lab-out" id="sAcct"></div>'
    '<h3>ثبت سفارش</h3><div class="lab-form">'
    + sel("oSide", "جهت", [("long", "خرید / لانگ"), ("short", "فروش / شورت (فقط فیوچرز)")])
    + sel("oType", "نوع سفارش", [("market", "Market (کندل بعد)"), ("limit", "Limit"), ("stop", "Stop (شکست)")])
    + f("oPx", "قیمت سفارش (Limit/Stop)")
    + f("oRisk", "ریسک هر معامله ٪ سرمایه", "1")
    + f("oSl", "حد ضرر")
    + f("oTp", "حد سود")
    + f("oLev", "اهرم (فیوچرز)", "3", step="1", extra='min="1" max="20"')
    + '</div><p class="note" id="oCalc"></p>'
    '<div class="lab-bar"><button class="ac-btn" id="oGo" type="button">ثبت سفارش</button><button class="ac-btn ghost" id="oClose" type="button">بستن پوزیشن در کندل بعد</button>'
    '<button class="ac-btn ghost" id="oCancel" type="button">لغو سفارش‌های باز</button></div>'
    '<div class="lab-scroll"><table class="lab-tbl" id="sTbl"></table></div></section>'

    # ---------------------------------------------------------------- journal
    '<section class="lab-card" id="journal"><h2>📒 ژورنال معاملاتی</h2><p class="note">معامله‌های شبیه‌ساز خودکار اینجا ثبت می‌شوند. معامله‌های فرضی دیگر را هم دستی وارد کنید، دلیل ورود و احساس خود را بنویسید و بعد آمار را بسنجید.</p>'
    '<div class="lab-form">' + f("jSym", "نماد", "BTCUSDT", "text") + sel("jSide", "جهت", [("long", "لانگ"), ("short", "شورت")])
    + f("jEn", "ورود") + f("jEx", "خروج") + f("jSl", "حد ضرر") + f("jQty", "مقدار (واحد)")
    + f("jRisk", "ریسک این معامله (٪)") + sel("jPlan", "مطابق پلن بود؟", [("", "نامشخص"), ("1", "بله"), ("0", "خیر")])
    + sel("jEmo", "حس هنگام ورود", [("calm", "آرام و طبق برنامه"), ("fomo", "ترس از جاماندن (FOMO)"), ("revenge", "جبران ضرر قبلی"), ("unsure", "مردد")])
    + f("jNote", "دلیل ورود / درس گرفته‌شده", "", "text") + '</div>'
    '<div class="lab-bar"><button class="ac-btn" id="jAdd" type="button">افزودن به ژورنال</button><button class="ac-btn ghost" id="jCsv" type="button">⬇ CSV</button>'
    '<button class="ac-btn ghost" id="jClr" type="button">پاک‌کردن ژورنال</button>'
    '<a class="ac-btn ghost" href="/academy/psychology/#jr">🧠 تحلیل روان‌شناختی این ژورنال</a></div>'
    '<div class="lab-out" id="jStats"></div><div class="lab-scroll"><table class="lab-tbl" id="jTbl"></table></div></section>'

    # ---------------------------------------------------------------- backtest
    '<section class="lab-card" id="backtest"><h2>🧮 بک‌تست آموزشی</h2>'
    '<p class="note">سیگنال فقط با کندل‌های بسته‌شده محاسبه و معامله در <b>قیمت باز کندل بعد</b> اجرا می‌شود؛ هیچ دادهٔ آینده‌ای وارد محاسبه نمی‌شود. کارمزد هر طرف کسر می‌شود. '
    'بهینه‌سازی پارامتر روی یک دوره و آزمودن روی همان دوره، نتیجه را فریبنده می‌کند (بیش‌برازش)؛ همیشه روی دورهٔ دیگری هم امتحان کنید.</p>'
    '<div class="lab-form">' + sel("bSym", "نماد", [("BTCUSDT", "BTCUSDT"), ("ETHUSDT", "ETHUSDT"), ("SOLUSDT", "SOLUSDT"), ("BNBUSDT", "BNBUSDT")])
    + sel("bIv", "تایم‌فریم", [("1d", "روزانه"), ("4h", "۴ ساعته"), ("1h", "۱ ساعته")])
    + sel("bStrat", "استراتژی", [("ema", "تقاطع دو EMA"), ("rsi", "برگشت RSI"), ("brk", "شکست سقف N کندل")])
    + f("bP1", "پارامتر ۱ (EMA سریع / RSI ورود / N)", "20", step="1") + f("bP2", "پارامتر ۲ (EMA کند / RSI خروج / N خروج)", "50", step="1")
    + f("bFee", "کارمزد هر طرف ٪", "0.1") + f("bSl", "حد ضرر ٪ (۰ = ندارد)", "0") + f("bSplit", "٪ داده برای دورهٔ آزمون خارج از نمونه", "30", step="1")
    + '</div><div class="lab-bar"><button class="ac-btn" id="bRun" type="button">اجرای بک‌تست</button><span class="lab-msg" id="bMsg"></span></div>'
    '<div class="lab-chart" style="height:240px"><canvas id="bCv"></canvas></div><div class="lab-out" id="bOut"></div></section>'

    # ---------------------------------------------------------------- calculators
    '<section class="lab-card" id="calc-size"><h2>📐 محاسبه‌گر حجم پوزیشن</h2><p class="note">حجم = (سرمایه × درصد ریسک) ÷ فاصلهٔ ورود تا حد ضرر. اگر قیمت به حد ضرر برسد، فقط همان درصد ریسک از دست می‌رود (بدون احتساب لغزش و کارمزد).</p>'
    '<div class="lab-form">' + f("zCap", "سرمایه (دلار)", "1000") + f("zRisk", "ریسک ٪", "1") + f("zEn", "قیمت ورود", "100") + f("zSl", "حد ضرر", "95") + '</div><div class="lab-out" id="zOut"></div></section>'

    '<section class="lab-card" id="calc-rr"><h2>⚖️ ریسک به بازده و نرخ برد سربه‌سر</h2>'
    '<div class="lab-form">' + f("rEn", "ورود", "100") + f("rSl", "حد ضرر", "95") + f("rTp", "حد سود", "112") + f("rFee", "کارمزد رفت و برگشت ٪", "0.2") + f("rWin", "نرخ برد مورد انتظار ٪", "40") + '</div><div class="lab-out" id="rOut"></div></section>'

    '<section class="lab-card" id="calc-pnl"><h2>💰 ماشین‌حساب سود و زیان</h2>'
    '<div class="lab-form">' + sel("pSide", "جهت", [("long", "لانگ"), ("short", "شورت")]) + f("pEn", "ورود", "100") + f("pEx", "خروج", "108") + f("pQty", "مقدار (واحد)", "10")
    + f("pLev", "اهرم", "1", step="1") + f("pFee", "کارمزد هر طرف ٪", "0.1") + '</div><div class="lab-out" id="pOut"></div></section>'

    '<section class="lab-card" id="calc-liq"><h2>💥 قیمت تقریبی لیکوئید (مارجین ایزوله)</h2><p class="note">فرمول ساده‌شده: لانگ ≈ ورود × (۱ − ۱/اهرم + نرخ نگهداری)، شورت ≈ ورود × (۱ + ۱/اهرم − نرخ نگهداری). صرافی‌ها کارمزد، فاندینگ و پلکان نرخ نگهداری را هم لحاظ می‌کنند؛ عدد واقعی را در صرافی ببینید.</p>'
    '<div class="lab-form">' + sel("lSide", "جهت", [("long", "لانگ"), ("short", "شورت")]) + f("lEn", "ورود", "100") + f("lLev", "اهرم", "10", step="1") + f("lMm", "نرخ مارجین نگهداری ٪", "0.5") + '</div><div class="lab-out" id="lOut"></div></section>'

    '<section class="lab-card" id="calc-fee"><h2>🧾 کارمزد معاملاتی و کارمزد شبکه</h2><h3>کارمزد صرافی</h3>'
    '<div class="lab-form">' + f("fAmt", "مبلغ معامله (دلار)", "1000") + f("fMk", "کارمزد Maker ٪", "0.1") + f("fTk", "کارمزد Taker ٪", "0.1") + f("fN", "تعداد معامله در ماه", "20", step="1") + '</div><div class="lab-out" id="fOut1"></div>'
    '<h3>کارمزد شبکهٔ بیت‌کوین</h3><div class="lab-form">' + f("fRate", "نرخ کارمزد (sat/vB)", "10") + f("fVb", "اندازهٔ تراکنش (vB)", "141", step="1") + f("fBtc", "قیمت فرضی BTC (دلار)", "60000") + '</div><div class="lab-out" id="fOut2"></div>'
    '<h3>کارمزد گس اتریوم</h3><div class="lab-form">' + f("fGas", "گس مصرفی (واحد)", "21000", step="1") + f("fBase", "Base fee (gwei)", "10") + f("fTip", "Priority fee (gwei)", "1") + f("fEth", "قیمت فرضی ETH (دلار)", "3000") + '</div><div class="lab-out" id="fOut3"></div>'
    '<p class="note">نرخ‌ها و قیمت‌ها پیش‌فرض و فرضی‌اند؛ نرخ لحظه‌ای را در mempool.space و etherscan.io/gastracker ببینید. انتقال سادهٔ ETH دقیقاً ۲۱٬۰۰۰ واحد گس مصرف می‌کند؛ تراکنش‌های قرارداد بیشتر.</p></section>'

    '<section class="lab-card" id="calc-supply"><h2>🪙 ارزش بازار، FDV و ساختار عرضه</h2>'
    '<div class="lab-form">' + f("cPx", "قیمت (دلار)", "2") + f("cCirc", "عرضهٔ در گردش", "500000000") + f("cTot", "عرضهٔ کل", "800000000") + f("cMax", "عرضهٔ حداکثری (خالی = نامحدود)", "1000000000")
    + f("cUnl", "آزادسازی ماهانه (توکن)", "10000000") + f("cVol", "حجم معاملات ۲۴ ساعته (دلار)", "40000000") + '</div><div class="lab-out" id="cOut"></div></section>'

    # ---------------------------------------------------------------- crypto primitives
    '<section class="lab-card" id="hash"><h2>#️⃣ آزمایشگاه هش SHA-256</h2><p class="note">یک حرف را تغییر دهید و ببینید تقریباً نیمی از بیت‌های خروجی عوض می‌شوند (اثر بهمنی). همه چیز در مرورگر خودتان با Web Crypto محاسبه می‌شود.</p>'
    '<textarea id="hIn" rows="3">Coin_Kurd</textarea><div class="lab-mono" id="hOut">…</div><p class="note" id="hDiff"></p>'
    '<h3>استخراج مینیاتوری (اثبات کار)</h3><p class="note">nonce را آن‌قدر افزایش می‌دهیم تا هش «داده + nonce» با تعداد مشخصی صفر شروع شود. هر صفر هگز، کار را حدود ۱۶ برابر سخت‌تر می‌کند.</p>'
    '<div class="lab-bar"><select id="hDiffSel" class="lab-in"><option value="1">۱ صفر</option><option value="2">۲ صفر</option><option value="3" selected>۳ صفر</option><option value="4">۴ صفر</option><option value="5">۵ صفر</option></select>'
    '<button class="ac-btn" id="hMine" type="button">⛏ استخراج</button><button class="ac-btn ghost" id="hStop" type="button">توقف</button></div><div class="lab-mono" id="hMineOut">—</div></section>'

    '<section class="lab-card" id="keys"><h2>🔑 کلید عمومی، کلید خصوصی و امضای دیجیتال</h2>'
    '<p class="note">این نمایش از منحنی استاندارد P-256 در Web Crypto استفاده می‌کند؛ بیت‌کوین و اتریوم از منحنی secp256k1 (ECDSA و در بیت‌کوین Schnorr هم) استفاده می‌کنند، اما منطق یکی است: '
    'امضا فقط با کلید خصوصی ساخته می‌شود و هر کسی با کلید عمومی می‌تواند آن را تأیید کند. کلیدهای این صفحه آزمایشی‌اند و ذخیره نمی‌شوند؛ هرگز کلید واقعی خود را در هیچ سایتی وارد نکنید.</p>'
    '<div class="lab-bar"><button class="ac-btn" id="kGen" type="button">ساخت جفت کلید آزمایشی</button></div>'
    '<p class="note">کلید عمومی (قابل انتشار):</p><div class="lab-mono" id="kPub">—</div>'
    '<details><summary>کلید خصوصی آزمایشی (فقط برای دیدن؛ در دنیای واقعی هرگز نشان داده نمی‌شود)</summary><div class="lab-mono" id="kPriv">—</div></details>'
    '<p class="note">پیام:</p><textarea id="kMsg" rows="2">ارسال ۰٫۱ واحد به آدرس علی</textarea>'
    '<div class="lab-bar"><button class="ac-btn ghost" id="kSign" type="button">✍️ امضا با کلید خصوصی</button><button class="ac-btn ghost" id="kVer" type="button">✅ تأیید با کلید عمومی</button>'
    '<button class="ac-btn ghost" id="kTamper" type="button">🕵️ دستکاری پیام</button></div><p class="note">امضا:</p><div class="lab-mono" id="kSig">—</div><p class="lab-msg" id="kRes"></p></section>'

    '<section class="lab-card" id="tx"><h2>🔗 کالبدشکافی یک تراکنش واقعی بیت‌کوین</h2><p class="note">شناسهٔ تراکنش (txid) را وارد کنید یا یک تراکنش تازه از mempool بیاورید. داده مستقیماً از mempool.space خوانده می‌شود؛ اگر در شبکهٔ شما در دسترس نباشد، پیام خطا می‌بینید.</p>'
    '<div class="lab-bar" style="flex-wrap:nowrap"><input id="tId" class="lab-in" style="flex:1" placeholder="txid (۶۴ کاراکتر هگز)" maxlength="64" dir="ltr"><button class="ac-btn" id="tGo" type="button">بررسی</button></div>'
    '<div class="lab-bar"><button class="ac-btn ghost" id="tRecent" type="button">🎲 یک تراکنش تازه از mempool</button><span class="lab-msg" id="tMsg"></span></div><div id="tOut"></div></section>'
    '<p class="note">آموزشی است، توصیهٔ مالی نیست. <a href="/academy/">بازگشت به آکادمی</a></p></div>'
)
