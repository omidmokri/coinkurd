#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ساخت صفحات ثابت و قابل‌ایندکس برای موتورهای جستجو (SSG)

  /p/<id>/            صفحهٔ مستقل هر پست (فارسی + کوردی + انگلیسی در صورت وجود ترجمه)
  /coins/<ticker>/    پروفایل هر کوین: قیمت زنده، وضعیت تکنیکال، فرصت‌ها، کارنامهٔ پست‌ها، آخرین مطالب
  /coins/             فهرست کوین‌ها
  /sitemap.xml  /robots.txt

این فایل‌ها در گیت کامیت نمی‌شوند؛ در هر اجرای ورک‌فلو از روی data/*.json ساخته می‌شوند.
"""
import chrome  # shared header/footer (scripts/chrome.py)
import onchain_page as OP  # /onchain/ analysis block and its compact form
import html
import json
import os
import re
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.environ.get("SITE_URL", "https://entekhab.net").rstrip("/")
D = os.path.join(ROOT, "data")


def load(n, default):
    try:
        return json.load(open(os.path.join(D, n), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return default


posts = load("posts.json", [])
meta = load("meta.json", {})
market = load("market.json", {})
impact = load("impact.json", {})
trackrec = load("trackrecord.json", {})


def tested_line(tr=None):
    """One honest sentence from the tested record (post hours vs matched random hours); never the raw average."""
    tr = trackrec if tr is None else tr
    t = ((tr.get("test") or {}).get("r24") or {})
    o, b = (tr.get("obs") or {}).get("r24"), (tr.get("base") or {}).get("r24")
    if t.get("p") is None or o is None or b is None:
        return '<p class="txt">آزمون کارنامهٔ کانال هنوز داده ندارد. <a href="/track-record/">کارنامهٔ آزموده‌شده</a></p>'
    sig = t["p"] < 0.05
    verdict = ("تفاوت از نظر آماری معنادار است" if sig else "هنوز تفاوت قابل‌اندازه‌گیری‌ای با ساعت‌های تصادفی دیده نمی‌شود")
    return (f'<p class="txt">در آزمون {tr.get("n_posts", "—")} پست کانال، بیت‌کوین ۲۴ ساعت بعد از پست‌ها به‌طور میانگین '
            f'<b>{o:+.2f}%</b> و در ساعت‌های تصادفیِ هم‌تراز <b>{b:+.2f}%</b> حرکت کرد (p = {t["p"]:.2f}) — {verdict}. '
            f'میانگین خام حرکت بعد از پست‌ها بدون مقایسه با بازار گمراه‌کننده است. <a href="/track-record/">کارنامهٔ آزموده‌شدهٔ کانال</a></p>')
news = load("news.json", {})
score = load("score.json", {})
SC = score.get("coins", {})
brain = load("brain.json", {})
DNA = (load("dna.json", {}) or {}).get("coins", {})
DERIV = {x["coin"]: x for x in (load("derivatives.json", {}) or {}).get("swaps", [])}
KIND = load("kind.json", {})
SCANS = (load("scanstats.json", {}) or {}).get("stats", {})
AUDIT = (load("scanaudit.json", {}) or {}).get("patterns", {})
CATS = {c["id"]: c for c in meta.get("categories", [])}
MK = {c["coin"]: c for c in market.get("coins", [])}
TV = {"BTC": "BITSTAMP:BTCUSD", "ETH": "BITSTAMP:ETHUSD", "TON": "OKX:TONUSDT", "GOLD": "OANDA:XAUUSD"}
NAMES = {"BTC": "Bitcoin · بیت‌کوین", "ETH": "Ethereum · اتریوم", "SOL": "Solana · سولانا", "BNB": "BNB",
         "XRP": "XRP · ریپل", "DOGE": "Dogecoin · دوج‌کوین", "TON": "Toncoin · تون‌کوین", "ADA": "Cardano · کاردانو",
         "AVAX": "Avalanche · آوالانچ", "LINK": "Chainlink · چین‌لینک", "DOT": "Polkadot · پولکادات",
         "TRX": "TRON · ترون", "LTC": "Litecoin · لایت‌کوین", "USDT": "Tether · تتر", "USDC": "USD Coin",
         "GOLD": "Gold · طلا", "SUI": "Sui", "NEAR": "NEAR", "PEPE": "Pepe", "SHIB": "Shiba Inu", "HYPE": "Hyperliquid"}
OPP_FA = {"rsi_oversold": "RSI اشباع فروش", "rsi_overbought": "RSI اشباع خرید", "ema_golden_cross": "تقاطع طلایی EMA20/50",
          "ema_death_cross": "تقاطع مرگ EMA20/50", "breakout_up": "شکست سقف ۴۸ ساعته", "breakdown": "شکست کف ۴۸ ساعته",
          "volume_spike": "جهش حجم معاملات", "bull_divergence": "واگرایی مثبت RSI", "bear_divergence": "واگرایی منفی RSI"}
e = html.escape


def sj(o):
    """JSON for inline <script> blocks: '<', '>' and '&' are escaped so data can never close the tag."""
    return json.dumps(o, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def su(u):
    """Only http(s), protocol-relative, site-relative or #hash links are allowed to come from data."""
    u = str(u or "").strip()
    return u if re.match(r"^(https?:)?//", u, re.I) or re.match(r"^/(?!/)", u) or u.startswith("#") else "#"


MD = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")


def rich(t):
    t = e(t or "")
    t = MD.sub(lambda m: f'<a href="{m.group(2)}" rel="noopener nofollow" target="_blank">{m.group(1)}</a>', t)
    t = re.sub(r'(^|[\s(])(https?://[^\s<]+)', r'\1<a href="\2" rel="noopener nofollow" target="_blank">\2</a>', t)
    return t.replace("\n", "<br>")


def plain(t, n=160):
    t = MD.sub(r"\1", t or "")
    t = re.sub(r"#\S+|https?://\S+", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:n] + ("…" if len(t) > n else "")



def post_img(p):
    """تصویر پست: همیشه نسخهٔ ذخیره‌شده در مخزن، و فقط در نبودش نشانی تلگرام.
    نشانی‌های cdn4.telesco.pe پس از چند ماه منقضی می‌شوند (scripts/postimg.py آن‌ها را محلی می‌کند)."""
    local = p.get("img") or ""
    if local.startswith(("/data/postimg/", "/data/deepimg/")):   # archived photo, or the dossier's own card
        return local
    return (p.get("photos") or [""])[0]

def fmt_date(iso):
    try:
        return datetime.fromisoformat(iso).strftime("%Y-%m-%d %H:%M UTC")
    except Exception:  # noqa: BLE001
        return ""


def fmt_price(v):
    if v is None:
        return "—"
    return f"{v:,.2f}" if v >= 1 else f"{v:.6g}"


CSS = """:root{--bg:#0a0a0a;--ink:#f4f4f2;--mute:#9a9a94;--acc:#f7931a;--line:rgba(255,255,255,.1);--card:#121212}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--ink);font-family:Vazirmatn,system-ui,sans-serif,'Apple Color Emoji','Noto Color Emoji';line-height:1.9}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
.w{max-width:960px;margin:0 auto;padding:0 16px}header{border-bottom:1px solid var(--line);padding:16px 0;position:sticky;top:0;background:rgba(10,10,10,.9);backdrop-filter:blur(10px);z-index:5}
header .w{display:flex;justify-content:space-between;align-items:center;gap:12px}.logo{font-family:'Space Grotesk',monospace;font-weight:700;color:var(--ink)}.lv-up{animation:lvu 1.2s ease-out}.lv-dn{animation:lvd 1.2s ease-out}@keyframes lvu{from{color:#22c55e}}@keyframes lvd{from{color:#ef4444}}.lvl{display:none;color:#22c55e;font-size:.7rem}html.live-on .lvl{display:inline}.acts{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px}.wbtn{display:inline-flex;gap:6px;align-items:center;background:#ffffff10;border:1px solid var(--line);color:var(--ink);border-radius:99px;padding:7px 14px;font:inherit;font-size:.85rem;cursor:pointer}.wbtn.on{border-color:var(--acc);color:var(--acc)}.faq{border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:8px 0}.faq summary{cursor:pointer;font-weight:700}.faq p{margin:8px 0 0}:focus-visible{outline:2px solid var(--acc);outline-offset:2px}.bnav{display:none}@media(max-width:700px){.bnav{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:95;background:rgba(10,10,10,.9);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-top:1px solid var(--line);padding:6px 0 calc(6px + env(safe-area-inset-bottom))}.bnav a{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.62rem;color:var(--mute)}.bnav a span{font-size:1.15rem;line-height:1}body{padding-bottom:62px}}.logo{display:flex;align-items:center;gap:8px}.logo img{height:40px;width:auto;display:block}@media(max-width:640px){.logo span{display:none}}.logo b{color:var(--acc)}
nav a{color:var(--mute);margin-inline-start:16px;font-size:.9rem}header nav{min-width:0}@media(max-width:760px){header .w{gap:10px}header nav{display:flex;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 14px),transparent);mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 14px),transparent)}header nav::-webkit-scrollbar{display:none}nav a{margin-inline-start:12px;flex:none}}main{padding:32px 0 60px}
h1{font-size:clamp(1.5rem,4vw,2.3rem);line-height:1.45;margin:10px 0 12px}h2{font-size:1.15rem;margin:34px 0 12px;color:var(--acc)}
.meta{color:var(--mute);font-size:.85rem;display:flex;gap:10px;flex-wrap:wrap;align-items:center}.pill{border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:.8rem;color:var(--ink)}
.img{width:100%;border-radius:10px;margin:18px 0;display:block}.txt{font-size:1.02rem;margin:18px 0}
details{border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:10px 0;background:var(--card)}summary{cursor:pointer;font-weight:700}
.social{display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;padding:12px 0;border-top:1px solid var(--line);margin-top:16px}.social a{border:1px solid var(--line);border-radius:999px;padding:4px 12px;white-space:nowrap;color:var(--ink);font-size:.85rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}.kpi small{color:var(--mute);display:block;font-size:.75rem}.kpi b{font-family:'Space Grotesk',monospace;font-size:1.2rem;direction:ltr;unicode-bidi:isolate;display:inline-block}
.up{color:#22c55e}.down{color:#ef4444}ul.list{list-style:none}ul.list li{border-bottom:1px solid var(--line);padding:10px 0}ul.list li small{color:var(--mute);display:block}
table{width:100%;border-collapse:collapse;font-size:.9rem}td,th{border-bottom:1px solid var(--line);padding:8px;text-align:start}th{color:var(--mute);font-weight:500}
.tv{height:420px;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:12px 0}.note{color:var(--mute);font-size:.8rem;margin-top:8px}
footer{border-top:1px solid var(--line);padding:24px 0;color:var(--mute);font-size:.85rem}
.coins a{display:inline-block;border:1px solid var(--line);border-radius:8px;padding:6px 12px;margin:4px;color:var(--ink);font-family:'Space Grotesk',monospace}"""


NAVFA = '<a href="/#feed">آرشیو</a><a href="/coins/">کوین‌ها</a><a href="/dashboard/">داشبورد بازار</a><a href="/replay/">بازپخش</a><a href="/lab/">🧪 آزمایشگاه</a><a href="/indicators/">📡 اندیکاتورها</a><a href="/dna/">🧬 DNA</a><a href="/status/">📊 شفافیت</a><a href="/academy/">🏛 آکادمی</a><a href="/learn/">🎓 آموزش</a><a href="/terminal/">🖥 ترمینال</a><a href="https://t.me/Coin_Kurd" rel="noopener">تلگرام</a>'
NAV_L = {"en": '<a href="/#feed">Archive</a><a href="/coins/">Coins</a><a href="/indicators/">📡 Indicators</a><a href="/dna/">🧬 DNA</a><a href="/terminal/">🖥 Terminal</a><a href="/learn/">🎓 Learn</a><a href="https://t.me/Coin_Kurd" rel="noopener">Telegram</a>',
         "ckb": '<a href="/#feed">ئەرشیڤ</a><a href="/coins/">دراوەکان</a><a href="/indicators/">📡 ئیندیکاتۆر</a><a href="/dna/">🧬 DNA</a><a href="/learn/">🎓 فێربوون</a><a href="https://t.me/Coin_Kurd" rel="noopener">تێلێگرام</a>'}


_BIGN = re.compile(r"[0-9۰-۹٠-٩][0-9۰-۹٠-٩,٬]{9,}(?:[.٫][0-9۰-۹٠-٩]+)?")
_DIG = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_FAD = str.maketrans("0123456789.", "۰۱۲۳۴۵۶۷۸۹٫")


def big(t, lang="fa"):
    """2,630,839,154,201.14 → 2.63 تریلیون (same rule as the homepage JS) so AI-report text stays readable"""
    def f(m):
        try:
            n = float(m.group(0).translate(_DIG).replace(",", "").replace("٬", "").replace("٫", "."))
        except ValueError:
            return m.group(0)
        if n < 1e9:
            return m.group(0)
        v = (f"{n / 1e12:.2f}" if n >= 1e12 else f"{n / 1e9:.1f}").rstrip("0").rstrip(".")
        if lang != "en":
            v = v.translate(_FAD)
        return v + ({"en": " trillion", "ckb": " تریلیۆن"}.get(lang, " تریلیون") if n >= 1e12 else {"en": " billion", "ckb": " ملیار"}.get(lang, " میلیارد"))
    return _BIGN.sub(f, t or "")


FOOT = {"fa": '© entekhab.net — داده‌ها به‌صورت خودکار از کانال <a href="https://t.me/Coin_Kurd">Coin_Kurd</a>، Binance، CoinGecko و alternative.me به‌روز می‌شوند. هیچ‌یک از مطالب توصیهٔ مالی نیست.',
        "ckb": '© entekhab.net — داتاکان بە شێوەی ئۆتۆماتیکی لە کەناڵی <a href="https://t.me/Coin_Kurd">Coin_Kurd</a>، Binance، CoinGecko و alternative.me نوێ دەکرێنەوە. هیچ کامێکیان ئامۆژگاریی دارایی نییە.',
        "en": '© entekhab.net — data is updated automatically from the <a href="https://t.me/Coin_Kurd">Coin_Kurd</a> channel, Binance, CoinGecko and alternative.me. Nothing here is financial advice.'}
CREDIT = {"fa": 'داده‌ها به‌صورت خودکار از کانال <a href="https://t.me/Coin_Kurd" rel="noopener noreferrer" target="_blank">Coin_Kurd</a>، Binance، CoinGecko و alternative.me به‌روز می‌شوند.',
          "ckb": 'داتاکان بە شێوەی ئۆتۆماتیکی لە کەناڵی <a href="https://t.me/Coin_Kurd" rel="noopener noreferrer" target="_blank">Coin_Kurd</a>، Binance، CoinGecko و alternative.me نوێ دەکرێنەوە.',
          "en": 'Data is updated automatically from the <a href="https://t.me/Coin_Kurd" rel="noopener noreferrer" target="_blank">Coin_Kurd</a> channel, Binance, CoinGecko and alternative.me.'}
# "recently viewed" for /me/ — stored only in the visitor's own browser (localStorage), never sent anywhere
RECENT_JS = ("try{var k='ek_recent',p=location.pathname,a=JSON.parse(localStorage.getItem(k)||'[]').filter(function(x){return x&&x.p!==p});"
             "a.unshift({p:p,t:document.title.replace(/\\s*\\|\\s*entekhab\\.net\\s*$/i,''),at:Date.now()});localStorage.setItem(k,JSON.stringify(a.slice(0,30)))}catch(e){}"
             "if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});"
             # what-if box on post pages: value today of $100 bought at the moment of publication (live Binance price)
             "document.querySelectorAll('[data-whatif]').forEach(function(el){var c=el.dataset.whatif,p0=+el.dataset.p0;if(!p0)return;"
             "fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol='+c+'USDT').then(function(r){return r.ok?r.json():null}).then(function(d){if(!d||!d.price){el.hidden=true;return}"
             "var v=100*d.price/p0,ch=(v-100);el.querySelector('b').innerHTML='$'+v.toFixed(2)+' <small class=\\''+(ch>=0?'up':'down')+'\\'>('+(ch>=0?'+':'')+ch.toFixed(2)+'%)</small>'}).catch(function(){el.hidden=true})});")


ICONS = ('<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">'
         '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">')
OG_DEFAULT = (f'<meta property="og:image" content="{SITE}/assets/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
              '<meta name="twitter:card" content="summary_large_image">')


BNAV = {"fa": ["خانه", "داشبورد", "نبرد", "آموزش", "فضای من"], "ckb": ["ماڵەوە", "داشبۆرد", "شەڕ", "فێربوون", "بۆشاییم"], "en": ["Home", "Dashboard", "Battle", "Learn", "My space"]}
HOME_NAME = {"fa": "خانه", "ckb": "ماڵەوە", "en": "Home"}


def crumbs_ld(body, title, url, lang="fa"):
    """BreadcrumbList from the page's own breadcrumb row (<div class="meta">a / b / c</div>); None when there is no trail"""
    m = re.search(r'<div class="meta">(.*?)</div>', body, re.S)
    if not m or " / " not in m.group(1):
        return ""
    items = [(HOME_NAME.get(lang, "Home"), f"{SITE}/")]
    for part in m.group(1).split(" / "):
        a = re.search(r'<a href="([^"]+)">(.*?)</a>', part)
        if a:
            if a.group(1) != "/":
                items.append((html.unescape(re.sub(r"<[^>]+>", "", a.group(2))), SITE + a.group(1)))
        else:
            txt = html.unescape(re.sub(r"<[^>]+>", "", part)).strip()
            if txt:
                items.append((txt[:80], url))
    if len(items) < 2:
        return ""
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList",
          "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}
    return f'<script type="application/ld+json">{sj(ld)}</script>'


WATCH_JS = ("document.querySelectorAll('[data-watch]').forEach(function(b){var c=b.dataset.watch,K='ek_watch';function g(){try{return JSON.parse(localStorage.getItem(K)||'[]')}catch(e){return []}}"
            "function d(){var on=g().indexOf(c)>=0;b.classList.toggle('on',on);b.querySelector('span').textContent=on?'در لیست مراقبت ✓':'افزودن به لیست مراقبت'}"
            "b.onclick=function(){var a=g();if(a.indexOf(c)>=0)a=a.filter(function(x){return x!==c});else a.push(c);try{localStorage.setItem(K,JSON.stringify(a.slice(0,20)))}catch(e){}d()};d()});")


def page(path, title, desc, body, extra_head="", lang="fa"):
    url = f"{SITE}/{path}"
    dirn = "ltr" if lang == "en" else "rtl"
    body = body.replace("</small><b", "</small> <b")          # a label and its number stay two words for readers without CSS
    body = body.replace('</b></div><div class="kpi"', '</b></div> <div class="kpi"')
    extra_head = extra_head + crumbs_ld(body, title, url, lang)
    doc = f"""<!doctype html><html lang="{lang}" dir="{dirn}"><head><meta charset="utf-8">{chrome.CSP_META}<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} | entekhab.net</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{url}">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{url}"><meta property="og:site_name" content="entekhab.net">
<meta name="theme-color" content="#f7931a"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
{ICONS}{"" if "og:image" in extra_head else OG_DEFAULT}
<style>{CSS}</style>{chrome.HEAD_TAGS}{extra_head}</head><body>
{chrome.header(lang)}
<main class="w">{body}</main>
<p class="ek-credit">{CREDIT.get(lang, CREDIT["fa"])}</p>{chrome.bottom(lang)}{chrome.footer(lang)}<script>{RECENT_JS}{WATCH_JS}</script>{chrome.BODY_TAGS}</body></html>"""
    full = os.path.join(ROOT, path, "index.html") if path else os.path.join(ROOT, "index.html")
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w", encoding="utf-8").write(doc)
    return url


LBL = {"strong": "قوی", "positive": "مثبت", "neutral": "خنثی", "weak": "ضعیف", "very_weak": "خیلی ضعیف"}
CMP = {"technical": "تکنیکال", "sentiment": "احساسات بازار", "news": "اخبار", "channel": "کارنامهٔ کانال"}


def score_html(c, full=True):
    v = SC.get(c)
    if not v:
        return ""
    rows = "".join(f'<tr><td>{CMP[k]}</td><td class="num">{round(x)}</td><td class="num">{round(v["weights"][k]*100)}%</td></tr>' for k, x in v["components"].items())
    s = f'<h2>امتیاز Entekhab</h2><div class="grid"><div class="kpi"><small>امتیاز کل (۰ تا ۱۰۰)</small><b>{v["score"]}</b></div><div class="kpi"><small>وضعیت</small><b>{LBL[v["label"]]}</b></div></div>'
    if full:
        s += f'<table style="margin-top:10px"><tr><th>جزء</th><th>امتیاز</th><th>وزن</th></tr>{rows}</table><p class="note">روش: ترکیب شفاف چهار جزء؛ ۵۰ یعنی خنثی. توصیف وضعیت فعلی است، نه پیش‌بینی یا توصیهٔ معاملاتی. به‌روزرسانی {fmt_date(score.get("updated_at",""))}.</p>'
    return s


def news_li(i):
    srcs = " · ".join(f'<a href="{e(su(x["url"]))}" rel="noopener nofollow" target="_blank">{e(x["source"])}</a>' for x in i["sources"])
    return f'<li dir="ltr"><a href="{e(su(i["url"]))}" rel="noopener nofollow" target="_blank">{e(i["title"])}</a><small>{srcs} · {fmt_date(i["date"])}</small></li>'


def impact_html(im):
    if not im:
        return ""
    def cls(v):
        return "up" if v and v > 0 else "down" if v and v < 0 else ""
    cells = "".join(f'<div class="kpi"><small>{lbl}</small><b class="{cls(im.get(k))}">{"—" if im.get(k) is None else f"{im[k]:+.2f}%"}</b></div>'
                    for k, lbl in (("r1h", "۱ ساعت بعد"), ("r4h", "۴ ساعت بعد"), ("r24h", "۲۴ ساعت بعد"), ("mfe", "بیشترین رشد ۲۴h"), ("mae", "بیشترین افت ۲۴h")))
    wi = (f'<div class="kpi" data-whatif="{e(im["coin"])}" data-p0="{im["p0"]}"><small>۱۰۰ دلار خرید در لحظهٔ انتشار، ارزش امروز</small><b>…</b></div>'
          if im.get("p0") and re.fullmatch(r"[A-Z0-9]{2,12}", im.get("coin") or "") and im["coin"] not in ("USDT", "USDC", "GOLD") else "")
    s = f'<h2>حرکت قیمت {e(im["coin"])} بعد از انتشار</h2><div class="grid"><div class="kpi"><small>قیمت لحظهٔ انتشار</small><b>{fmt_price(im["p0"])}</b></div>{cells}{wi}</div>'
    if im.get("signal"):
        sg = im["signal"]
        res = {"tp1": "✅ هدف اول لمس شد", "stop": "❌ حد ضرر فعال شد", "open": "⏳ هنوز باز", "ambiguous": "⚠️ هدف و حد ضرر در یک کندل"}[sg["result"]]
        s += f'<p class="txt">سیگنال {"لانگ" if sg["side"] == "long" else "شورت"} — ورود {sg["entry"]} · حد ضرر {sg["sl"] or "—"} · اهداف {", ".join(map(str, sg["tps"])) or "—"} → <b>{res}</b></p>'
    s += '<p class="note">محاسبه با کندل‌های ۱ ساعتهٔ Binance؛ نتیجهٔ گذشته تضمینی برای آینده نیست.</p>'
    return s


FOUNDER = {"@type": "Person", "name": "Omid Dabbaghchi Mokri", "url": f"{SITE}/about/",
           "sameAs": ["https://orcid.org/0009-0005-1289-0025", "https://www.tradingview.com/u/Coin_Kurd/", "https://x.com/omid_mokri"]}
AUTHOR = {"@type": "Organization", "name": "Coin Kurd", "url": f"{SITE}/about/", "sameAs": ["https://t.me/Coin_Kurd"], "founder": FOUNDER}
PUBLISHER = {"@type": "Organization", "name": "Entekhab (entekhab.net)", "url": SITE, "logo": {"@type": "ImageObject", "url": f"{SITE}/assets/apple-touch-icon.png"},
             "founder": FOUNDER, "foundingDate": "2003-12-22"}
NFA_FA = "این مطلب آموزشی و خبری است، نه توصیهٔ خرید و فروش؛ بازار رمزارز پرریسک است و تصمیم با خود شماست."


def related(p, n=6):
    """other posts on the same coins first, then the same category — newest first, never promos or repeats"""
    mine = set(p.get("coins") or [])
    pool = [q for q in posts if q["id"] != p["id"] and q.get("q") != "low" and q.get("title") != p.get("title")]
    same = [q for q in pool if mine & set(q.get("coins") or [])]
    cat = [q for q in pool if q["category"] == p["category"] and q not in same]
    near = sorted(same, key=lambda q: abs(q["id"] - p["id"]))[:n]
    near += sorted(cat, key=lambda q: abs(q["id"] - p["id"]))[: n - len(near)]
    return sorted(near, key=lambda q: -q["id"])


def build_post(p):
    cat = CATS.get(p["category"], {"name": {"fa": p["category"]}, "icon": ""})
    tr = p.get("tr") or {}
    title = p["title"]
    desc = plain(p["text"]) or title
    img = post_img(p)
    coins = "".join(f'<a class="pill" href="/coins/{c.lower()}/">{c}</a>' for c in p.get("coins", []))
    body = f'<div class="meta"><a class="pill" href="/categories/{e(p["category"])}/">{cat.get("icon","")} {e(cat["name"].get("fa",""))}</a>{coins}<time datetime="{p.get("date","")}">{fmt_date(p.get("date",""))}</time><span>👁 {e(p.get("views") or "—")}</span></div>'
    body += f'<h1>{e(title)}</h1>'
    if img:
        body += f'<img class="img" src="{e(img)}" alt="{e(title)}" loading="lazy" referrerpolicy="no-referrer">'
    body += f'<div class="txt">{rich(p["text"])}</div>'
    # each translation lives on its own page (hreflang-linked), so this page carries only the Persian text
    langs = [(lg, lbl) for lg, lbl in (("ckb", "کوردی (سۆرانی)"), ("en", "English")) if isinstance(tr.get(lg), dict) and tr[lg].get("text")]
    if langs:
        body += '<p class="note">این مطلب به زبان‌های دیگر: ' + " · ".join(
            f'<a href="/{lg}/p/{p["id"]}/" lang="{lg}" hreflang="{lg}"{" dir=ltr" if lg == "en" else ""}>{lbl}: {e(tr[lg].get("title") or "")}</a>' for lg, lbl in langs) + "</p>"
    if p.get("footer"):
        ic = lambda u: "👾 " if "discord" in u else "🎥 " if "youtu" in u else "📸 " if "instagram" in u else "💬 " if "twitter" in u or "x.com" in u else ""  # noqa: E731
        body += '<div class="social">' + "".join(f'<a href="{e(su(f["url"]))}" rel="noopener" target="_blank">{ic(f["url"])}{e(f["label"])}</a>' for f in p["footer"]) + "</div>"
    body += impact_html(impact.get(str(p["id"])))
    rel = related(p)
    if rel:
        body += "<h2>مطالب مرتبط</h2><ul class=list>" + "".join(post_li(q) for q in rel) + "</ul>"
    body += f'<p class="note">{NFA_FA} <a href="/methodology/">روش کار و منابع داده</a></p>'
    body += (f'<p class="note"><a href="{e(su(p["url"]))}">مشاهدهٔ این پست در تلگرام ↗</a> · <a href="/#p{p["id"]}">نمایش در آرشیو</a> · '
             f'<a href="{GROUP}" rel="noopener" target="_blank">💬 گفتگو در گروه تلگرام Coin_Kurd</a></p>')
    ld = {"@context": "https://schema.org", "@type": "NewsArticle", "headline": title[:110], "datePublished": p.get("date"),
          "dateModified": p.get("edited") or p.get("date"), "inLanguage": "fa", "image": [SITE + img if img.startswith("/") else img] if img else [],
          "author": AUTHOR, "publisher": PUBLISHER, "articleSection": cat["name"].get("fa", ""),
          "mainEntityOfPage": f"{SITE}/p/{p['id']}/", "description": desc,
          "about": [{"@type": "Thing", "name": NAMES.get(c, c), "url": f"{SITE}/coins/{c.lower()}/"} for c in p.get("coins", [])]}
    head = f'<script type="application/ld+json">{sj(ld)}</script>'
    if img:
        head += f'<meta property="og:image" content="{e(SITE + img if img.startswith("/") else img)}"><meta name="twitter:card" content="summary_large_image">'
    head += alt_links(p)
    if p.get("q") == "low":
        head += '<meta name="robots" content="noindex,follow">'           # promos / repeats: keep the page, keep it out of search
    return page(f"p/{p['id']}/", title, desc, body, head)


def alt_links(p):
    tr = p.get("tr") or {}
    alts = [("fa", f"{SITE}/p/{p['id']}/")] + [(lg, f"{SITE}/{lg}/p/{p['id']}/") for lg in ("ckb", "en") if isinstance(tr.get(lg), dict) and tr[lg].get("text")]
    if len(alts) == 1:
        return ""
    return "".join(f'<link rel="alternate" hreflang="{lg}" href="{u}">' for lg, u in alts) + f'<link rel="alternate" hreflang="x-default" href="{alts[0][1]}">'


GROUP = "https://t.me/Coin_Kurd_Group"
LBL_L = {"en": {"tg": "View this post on Telegram ↗", "fa": "Persian original", "arch": "Open in the archive", "nfa": "Educational, not financial advice.",
                "grp": "💬 Discuss in the Coin_Kurd Telegram group"},
         "ckb": {"tg": "بینینی ئەم پۆستە لە تێلێگرام ↗", "fa": "دەقی ئەسڵی فارسی", "arch": "کردنەوە لە ئەرشیڤ", "nfa": "فێرکارییە، ئامۆژگاریی دارایی نییە.",
                 "grp": "💬 گفتوگۆ لە گرووپی تێلێگرامی Coin_Kurd"}}


def build_post_lang(p, lg):
    """/en/p/<id>/ and /ckb/p/<id>/ — translated version of a post as its own page (hreflang-linked to the Persian original)"""
    t = (p.get("tr") or {}).get(lg)
    if not isinstance(t, dict) or not t.get("text"):
        return None
    L = LBL_L[lg]
    title = t.get("title") or p["title"]
    desc = plain(t["text"]) or title
    img = post_img(p)
    coins = "".join(f'<a class="pill" href="/coins/{c.lower()}/">{c}</a>' for c in p.get("coins", []))
    body = f'<div class="meta">{coins}<time datetime="{p.get("date", "")}">{fmt_date(p.get("date", ""))}</time></div><h1>{e(title)}</h1>'
    if img:
        body += f'<img class="img" src="{e(img)}" alt="{e(title)}" loading="lazy" referrerpolicy="no-referrer">'
    body += f'<div class="txt">{rich(t["text"])}</div>'
    body += f'<p class="note"><a href="/p/{p["id"]}/" lang="fa">{L["fa"]}</a> · <a href="{e(su(p["url"]))}">{L["tg"]}</a> · <a href="/#p{p["id"]}">{L["arch"]}</a> · <a href="{GROUP}" rel="noopener" target="_blank">{L["grp"]}</a> · {L["nfa"]}</p>'
    ld = {"@context": "https://schema.org", "@type": "NewsArticle", "headline": title[:110], "datePublished": p.get("date"), "inLanguage": lg,
          "image": [SITE + img if img.startswith("/") else img] if img else [], "author": AUTHOR,
          "publisher": PUBLISHER, "dateModified": p.get("edited") or p.get("date"), "mainEntityOfPage": f"{SITE}/{lg}/p/{p['id']}/",
          "description": desc, "translationOfWork": {"@id": f"{SITE}/p/{p['id']}/"}}
    head = f'<script type="application/ld+json">{sj(ld)}</script>' + alt_links(p)
    if img:
        head += f'<meta property="og:image" content="{e(SITE + img if img.startswith("/") else img)}"><meta name="twitter:card" content="summary_large_image">'
    if p.get("q") == "low":
        head += '<meta name="robots" content="noindex,follow">'
    return page(f"{lg}/p/{p['id']}/", title, desc, body, head, lang=lg)


def build_rss():
    """/feed.xml (Persian) and /en/feed.xml — the latest 50 real posts (promos and repeats excluded)"""
    good = [p for p in posts if p.get("q") != "low"][:50]
    now = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    def item(p, lg):
        t = p if lg == "fa" else (p.get("tr") or {}).get(lg)
        if not isinstance(t, dict) or not (t.get("title") or p.get("title")):
            return ""
        u = f"{SITE}/p/{p['id']}/" if lg == "fa" else f"{SITE}/{lg}/p/{p['id']}/"
        try:
            pd = datetime.fromisoformat(p["date"]).strftime("%a, %d %b %Y %H:%M:%S +0000")
        except Exception:  # noqa: BLE001
            pd = now
        return f"<item><title>{e(t.get('title') or p['title'])}</title><link>{u}</link><guid>{u}</guid><pubDate>{pd}</pubDate><description>{e(plain(t.get('text') or '', 400))}</description></item>"
    for lg, path, ttl in (("fa", "feed.xml", "entekhab.net — تحلیل و اخبار کریپتو"), ("en", "en/feed.xml", "entekhab.net — crypto analysis & news")):
        xml = (f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>{e(ttl)}</title><link>{SITE}/</link><description>{e(ttl)}</description>'
               f"<language>{lg}</language><lastBuildDate>{now}</lastBuildDate>" + "".join(item(p, lg) for p in good) + "</channel></rss>")
        full = os.path.join(ROOT, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        open(full, "w", encoding="utf-8").write(xml)
    print("rss: 2 feeds")


GENE_FA = {"liquidity": "نقدشوندگی", "volatility": "نوسان", "flow": "جریان خریداران", "sentiment": "احساسات خبری", "attention": "توجه رسانه‌ای",
           "leverage": "اهرم مشتقه", "developers": "فعالیت توسعه", "momentum": "مومنتوم"}


def intel_profile(c, m):
    """Coin Intelligence Profile: plain-language state, score breakdown with history, risks, DNA, derivatives, Coin_Kurd indicators"""
    v, d, dv = SC.get(c), DNA.get(c), DERIV.get(c)
    hist = (score.get("history") or {}).get(c) or []
    out = []
    bits = []
    if m:
        bits.append(f'روند ۱ ساعته {({"up": "صعودی", "down": "نزولی", "range": "خنثی"}).get(m.get("trend"), "—")} با RSI {m.get("rsi")}')
        if m.get("chg24") is not None:
            bits.append(f'تغییر ۲۴ ساعته {m["chg24"]:+.2f}٪')
    if v:
        bits.append(f'امتیاز Entekhab {v["score"]} ({LBL.get(v["label"], v["label"])})')
    if d:
        bits.append(f'DNA {d.get("code", "")}')
    if bits:
        out.append('<h2>خلاصهٔ هوشمند</h2><p class="txt">' + e(c) + " اکنون: " + "، ".join(e(b) for b in bits) + ".</p>")
    if v:
        def ch(n):
            return (v["score"] - hist[-1 - n][1]) if len(hist) > n else None
        c1, c7 = ch(1), ch(7)
        rows = "".join(f'<tr><td>{CMP[k]}</td><td class="num">{round(x)}</td><td class="num">{round(v["weights"][k] * 100)}%</td><td class="num">{round(x * v["weights"][k], 1)}</td></tr>'
                       for k, x in v["components"].items())
        inp = v.get("inputs") or {}
        c1s = "—" if c1 is None else f"{c1:+d}"
        c7s = "—" if c7 is None else f"{c7:+d}"
        out.append('<h2>امتیاز Entekhab — شفاف</h2><div class="grid">'
                   f'<div class="kpi"><small>امتیاز (۰ تا ۱۰۰)</small><b>{v["score"]}</b></div><div class="kpi"><small>وضعیت</small><b>{LBL[v["label"]]}</b></div>'
                   f'<div class="kpi"><small>تغییر ۲۴ ساعت</small><b>{c1s}</b></div><div class="kpi"><small>تغییر ۷ روز</small><b>{c7s}</b></div></div>'
                   f'<table style="margin-top:10px"><tr><th>جزء</th><th>امتیاز جزء</th><th>وزن</th><th>سهم در امتیاز</th></tr>{rows}</table>'
                   f'<p class="note">فرمول: امتیاز = جمع (امتیاز هر جزء × وزن آن). ورودی‌ها: {inp.get("news_48h", "—")} خبر در ۴۸ ساعت، {inp.get("channel_posts", "—")} پست کانال، '
                   f'شاخص ترس و طمع {inp.get("fng", "—")}. آخرین محاسبه {fmt_date(score.get("updated_at", ""))}. '
                   'محدودیت: برای ارزهای کم‌خبر، اجزای خبر و کانال اطلاعات کمی دارند؛ امتیاز توصیف وضعیت است، نه پیش‌بینی.</p>')
        if len(hist) >= 2:
            pts = hist[-60:]
            mn, mx = min(x[1] for x in pts), max(x[1] for x in pts)
            poly = " ".join(f"{i / max(1, len(pts) - 1) * 300:.1f},{58 - (x[1] - mn) / max(1, mx - mn) * 52:.1f}" for i, x in enumerate(pts))
            out.append(f'<svg viewBox="0 0 300 62" style="width:100%;height:70px;border:1px solid var(--line);border-radius:10px;margin-top:8px"><polyline points="{poly}" fill="none" stroke="#f7931a" stroke-width="2"/></svg>'
                       f'<p class="note">تاریخچهٔ امتیاز از {e(pts[0][0])} تا {e(pts[-1][0])} ({len(pts)} روز)</p>')
        buck = {"≥60": [], "45–59": [], "<45": []}
        for hh in (score.get("history") or {}).values():
            for i in range(len(hh) - 7):
                if hh[i][2] and hh[i + 7][2]:
                    r7 = (hh[i + 7][2] / hh[i][2] - 1) * 100
                    buck["≥60" if hh[i][1] >= 60 else "45–59" if hh[i][1] >= 45 else "<45"].append(r7)
        if sum(len(x) for x in buck.values()) >= 30:
            out.append('<p class="note">سنجش امتیاز با بازده واقعی ۷ روز بعد (همهٔ ارزها): ' + " · ".join(f"{k}: {sum(x) / len(x):+.2f}٪ (n={len(x)})" for k, x in buck.items() if x) + "</p>")
        else:
            out.append('<p class="note">سنجش امتیاز با بازده واقعی بعدی: تاریخچهٔ امتیاز از ۱ نوامبر ۲۰۲۶ ذخیره می‌شود؛ پس از دست‌کم ۷ روز نتیجه اینجا نمایش داده می‌شود.</p>')
    risks = []
    if m:
        if (m.get("rsi") or 50) >= 70:
            risks.append("RSI بالای ۷۰ (اشباع خرید کوتاه‌مدت)")
        if (m.get("rsi") or 50) <= 30:
            risks.append("RSI زیر ۳۰ (اشباع فروش کوتاه‌مدت)")
        if (m.get("qvol") or 0) < 5e6:
            risks.append("نقدشوندگی پایین (حجم ۲۴ ساعته زیر ۵ میلیون دلار) — لغزش قیمت بیشتر")
    if d:
        r = d.get("raw") or {}
        if (r.get("vol30") or 0) >= 80:
            risks.append(f'نوسان ۳۰ روزه بسیار بالا ({r["vol30"]}٪ سالانه)')
        if r.get("from_high") is not None and r["from_high"] <= -70:
            risks.append(f'{-r["from_high"]:.0f}٪ پایین‌تر از سقف ۱۰۰۰ روزه')
    if dv and dv.get("funding_ann") is not None and abs(dv["funding_ann"]) >= 30:
        risks.append(f'فاندینگ سالانهٔ {dv["funding_ann"]}٪ در OKX (اهرم یک‌طرفه)')
    out.append("<h2>ریسک‌ها و نکات قابل توجه</h2>" + ("<ul class=list>" + "".join(f"<li>{e(x)}</li>" for x in risks) + "</ul>" if risks else '<p class="note">پرچم ریسک خاصی از داده‌های فعلی دیده نمی‌شود.</p>'))
    if d:
        g = d.get("genes") or {}
        sim = "، ".join(f'<a href="/dna/{o.lower()}/">{e(o)}</a>' for o, _ in d.get("similar", [])[:5])
        out.append(f"<h2>DNA بازار {e(c)}</h2><table>" + "".join(f'<tr><td>{GENE_FA.get(k, k)}</td><td class="num">{"—" if x is None else x}</td></tr>' for k, x in g.items())
                   + f'</table><p class="note">کد: <span dir="ltr">{e(d.get("code", ""))}</span> · مشابه‌ها: {sim} · <a href="/dna/{c.lower()}/">صفحهٔ کامل DNA</a></p>')
    if dv:
        out.append(f'<h2>مشتقات (OKX)</h2><div class="grid"><div class="kpi"><small>فاندینگ ۸ ساعته</small><b>{dv.get("funding")}%</b></div>'
                   f'<div class="kpi"><small>فاندینگ سالانه</small><b>{dv.get("funding_ann")}%</b></div><div class="kpi"><small>Open Interest</small><b>${(dv.get("oi_usd") or 0) / 1e6:,.0f}M</b></div></div>')
    if c == "BTC" and KIND.get("power_law"):
        pl, sc = KIND["power_law"], KIND.get("style_cycle") or {}
        out.append(f'<h2>اندیکاتورهای Coin_Kurd</h2><p class="txt">قانون توان: ارزش منصفانه {pl["fair"]:,.0f} دلار ({pl["dev_pct"]:+.1f}٪) · '
                   f'چرخهٔ سبک: {e(sc.get("phase", "—"))} (Bull-Bear {sc.get("bull_bear", "—")}) — <a href="/indicators/">همهٔ اندیکاتورها و سیگنال‌ها</a></p>')
    return "".join(out)


THIN = set()                                                  # coin pages kept out of search for now (no posts, small market)
VOL_RANK = {c["coin"]: i for i, c in enumerate(sorted(market.get("coins", []), key=lambda x: -(x.get("qvol") or 0)))}


def fa_name(c):
    n = NAMES.get(c, c)
    return n.split(" · ")[-1] if " · " in n else n


def build_coin(c, cposts):
    m = MK.get(c)
    name = NAMES.get(c, c)
    now = datetime.now(timezone.utc)
    def within(p, days):
        try:
            return (now - datetime.fromisoformat(p["date"])).days < days
        except Exception:  # noqa: BLE001
            return False
    n24, n7, n30 = (sum(1 for p in cposts if within(p, d)) for d in (1, 7, 30))
    body = (f'<div class="meta"><a href="/coins/">کوین‌ها</a> / {c}</div><h1>{e(name)} ({c})</h1>'
            f'<p class="acts"><button class="wbtn" data-watch="{c}" type="button">⭐ <span>افزودن به لیست مراقبت</span></button> '
            f'<a class="wbtn" href="/tools/?cmp={",".join([c] + [x for x in ("BTC", "ETH", "SOL") if x != c][:2])}#compare">⚖️ مقایسه با کوین‌های اصلی</a> <a class="wbtn" href="/me/?paper={c}#paper">📝 معاملهٔ آزمایشی</a></p>')
    tv = TV.get(c, f"BINANCE:{c}USDT")
    body += f'''<div class="tv"><div class="tradingview-widget-container" style="height:100%"><div class="tradingview-widget-container__widget" style="height:100%"></div>
<script src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>{sj({"autosize": True, "symbol": tv, "interval": "60", "theme": "dark", "style": "1", "locale": "en", "backgroundColor": "rgba(18,18,18,1)", "allow_symbol_change": False, "save_image": False, "support_host": "https://www.tradingview.com"})}</script></div></div>'''
    body += '<h2>وضعیت تکنیکال (۱ ساعته)</h2>'
    if m:
        tr = {"up": "صعودی", "down": "نزولی", "range": "خنثی / رنج"}[m["trend"]]
        ch = m.get("chg24")
        body += f'''<div class="grid"><div class="kpi"><small>قیمت <span class="lvl">زنده</span></small><b data-live="{c}">{fmt_price(m["price"])}</b></div>
<div class="kpi"><small>تغییر ۲۴ ساعته</small><b class="{"up" if (ch or 0) > 0 else "down"}" data-livechg="{c}">{"—" if ch is None else f"{ch:+.2f}%"}</b></div>
<div class="kpi"><small>RSI (دورهٔ ۱۴)</small><b>{m["rsi"]}</b></div><div class="kpi"><small>روند (EMA20/50)</small><b>{tr}</b></div>
<div class="kpi"><small>سقف ۴۸ ساعت</small><b>{fmt_price(m["hi48"])}</b></div><div class="kpi"><small>کف ۴۸ ساعت</small><b>{fmt_price(m["lo48"])}</b></div></div>
<p class="note">به‌روزرسانی: {fmt_date(market.get("updated_at",""))} — منبع Binance. قیمت لحظه‌ای را در نمودار بالا ببینید.</p>'''
        opps = [o for o in market.get("opportunities", []) if o["coin"] == c]
        if opps:
            def rec(o):
                a = SCANS.get(o["type"]) or {}
                au = AUDIT.get(o["type"]) or {}
                if au.get("verdict") in ("better", "worse", "no_edge"):
                    tag = {"better": "بهتر از ساعت‌های تصادفی", "worse": "⚠️ در دست بازبینی: بدتر از ساعت‌های تصادفی",
                           "no_edge": "تفاوت معناداری با ساعت‌های تصادفی ندارد"}[au["verdict"]]
                    return f' · آزمون این الگو: {au["obs"]:+.2f}٪ در ۲۴ ساعت در برابر {au["mid"]:+.2f}٪ در ساعت‌های دیگر (p={au["p"]:.3f}، n={au["n"]}) — {tag}'
                return f' · پیشینهٔ این الگو: {a["win24"]}٪ مثبت پس از ۲۴ ساعت (n={a["n24"]})' if a.get("n24") else ""
            body += "<h2>فرصت‌های کشف‌شده توسط اسکنر</h2><ul class=list>" + "".join(
                f'<li><b class="{"down" if o.get("dir") == "bear" else "up"}">{"▼ نزولی" if o.get("dir") == "bear" else "▲ صعودی"}</b> · {OPP_FA.get(o["type"], o["type"])} · قدرت {o["strength"]} · اطمینان {"بالا" if o["confidence"] == "high" else "متوسط"}'
                + (f' · ابطال {fmt_price(o["inval"])} · هدف فرضی {fmt_price(o["target"])} · R:R {o["rr"]}' if o.get("inval") is not None else "")
                + f'<small>تایم‌فریم {o["tf"]}{rec(o)} — صرفاً یافتهٔ تکنیکال، نه توصیهٔ خرید/فروش</small></li>' for o in opps) + "</ul>"
    else:
        body += '<p class="note">دادهٔ بازار Binance برای این دارایی در دسترس نیست.</p>'
    body += intel_profile(c, m)
    cn = [i for i in news.get("items", []) if c in i.get("coins", [])][:15]
    if cn:
        body += "<h2>آخرین اخبار از منابع مختلف</h2><ul class=list>" + "".join(news_li(i) for i in cn) + "</ul>"
    ims = [impact[str(p["id"])] for p in cposts if str(p["id"]) in impact and impact[str(p["id"])].get("r24h") is not None]
    body += f'<h2>حضور در کانال</h2><div class="grid"><div class="kpi"><small>۲۴ ساعت</small><b>{n24}</b></div><div class="kpi"><small>۷ روز</small><b>{n7}</b></div><div class="kpi"><small>۳۰ روز</small><b>{n30}</b></div><div class="kpi"><small>کل آرشیو</small><b>{len(cposts)}</b></div></div>'
    if ims:
        body += f'<h2>کارنامهٔ پست‌ها</h2><p class="note">{len(ims)} پست اخیر دربارهٔ {c} در آرشیو.</p>' + tested_line()
    body += "<h2>آخرین مطالب</h2><ul class=list>" + "".join(
        f'<li><a href="/p/{p["id"]}/">{e(p["title"])}</a><small>{fmt_date(p.get("date",""))} · {e(CATS.get(p["category"],{}).get("name",{}).get("fa",""))}</small></li>' for p in cposts[:60]) + "</ul>"
    faq = [("امتیاز Entekhab برای " + c + " چطور محاسبه می‌شود؟", "امتیاز (۰ تا ۱۰۰) جمع وزنی چهار جزء است: تکنیکال (RSI، روند و فاصله از سقف و کف ۴۸ ساعته)، احساسات بازار (شاخص ترس و طمع)، اخبار ۴۸ ساعت اخیر و کارنامهٔ پست‌های کانال. وزن‌ها و سهم هر جزء در همین صفحه نمایش داده می‌شود. امتیاز توصیف وضعیت فعلی است، نه پیش‌بینی."),
           ("داده‌های این صفحه هر چند وقت به‌روز می‌شوند؟", "قیمت و تغییرات ۲۴ ساعته به‌صورت زنده از Binance می‌آیند؛ اسکنر تکنیکال، امتیاز و اخبار هر ۱۵ دقیقه با GitHub Actions بازسازی می‌شوند و زمان آخرین به‌روزرسانی کنار هر بخش نوشته شده است."),
           ("آیا این صفحه توصیهٔ خرید یا فروش " + c + " است؟", "خیر. همهٔ اعداد و یافته‌ها توصیف خودکار وضعیت بازار برای آموزش‌اند و کارنامهٔ واقعی هر الگو در صفحهٔ شفافیت منتشر می‌شود. تصمیم و مدیریت ریسک با خود شماست.")]
    body += "<h2>پرسش‌های متداول</h2>" + "".join(f'<details class="faq"><summary>{e(q)}</summary><p class="txt">{e(a)}</p></details>' for q, a in faq)
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}
    fn = fa_name(c)
    desc = (f"قیمت لحظه‌ای {fn} ({c})، تغییرات ۲۴ ساعته، RSI و روند EMA، امتیاز Entekhab با فرمول شفاف"
            + (f" و {len(cposts)} تحلیل و خبر دربارهٔ {fn}" if cposts else "") + " — به‌روزرسانی هر ۱۵ دقیقه.")
    head_x = ""
    if not cposts and VOL_RANK.get(c, 999) >= 60:
        THIN.add(c)
        head_x = '<meta name="robots" content="noindex,follow">'
        body = body.replace('<h2>وضعیت تکنیکال', '<p class="note">⚠️ دربارهٔ این دارایی هنوز مطلبی در آرشیو نیست و حجم معاملاتش کم است؛ اعداد این صفحه فقط توصیف خودکار بازارند و ریسک نقدشوندگی بالاست.</p><h2>وضعیت تکنیکال', 1)
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": f"{name} ({c})", "about": {"@type": "Thing", "name": name}, "url": f"{SITE}/coins/{c.lower()}/"}
    return page(f"coins/{c.lower()}/", f"قیمت {fn} ({c}) امروز — تحلیل تکنیکال و اخبار", desc, body,
                head_x + f'<script type="application/ld+json">{sj(ld)}</script><script type="application/ld+json">{sj(faq_ld)}</script><script src="/assets/live.js" defer></script>')


def build_methodology():
    """/methodology/ — where every number on the site comes from, how it is computed, and what it is not"""
    sc_w = " · ".join(f"{CMP[k]} {round(v * 100)}٪" for k, v in (("technical", .40), ("sentiment", .25), ("news", .20), ("channel", .15)))
    secs = [
        ("چه کسی پشت این سایت است", '<p class="txt">entekhab.net سایت کانال تلگرامی <a href="https://t.me/Coin_Kurd" rel="noopener" target="_blank">Coin_Kurd</a> است که از ۲ بهمن ۱۳۹۸ هر روز دربارهٔ بازار رمزارز می‌نویسد؛ بنیان‌گذار و مسئول محتوا امید دباغچی مکری است. داستان کامل و سوابق در <a href="/about/">صفحهٔ دربارهٔ ما</a> آمده است.</p>'),
        ("منابع داده", '<ul class="list">'
         '<li>پست‌ها: کانال عمومی Coin_Kurd در تلگرام؛ هر ۱۵ دقیقه خوانده و بایگانی می‌شود و پیوند هر پست به نسخهٔ تلگرامش در صفحهٔ همان پست هست.</li>'
         '<li>قیمت، کندل‌ها و حجم: Binance (کندل‌های ۱ ساعته)؛ RSI و EMA از همین کندل‌ها محاسبه می‌شوند.</li>'
         '<li>ارزش بازار، بخش‌ها و لوگوها: CoinGecko · شاخص ترس و طمع: alternative.me</li>'
         '<li>شبکهٔ بیت‌کوین: mempool.space و bitnodes · بازار مشتقات: OKX · اقتصاد کلان: FRED</li>'
         '<li>اخبار: چند خبرخوان RSS؛ هر خبر با پیوند منبع اصلی نمایش داده می‌شود.</li></ul>'),
        ("امتیاز Entekhab", f'<p class="txt">عددی بین ۰ تا ۱۰۰ برای هر کوین، بدون هوش مصنوعی و با فرمول ثابت؛ ۵۰ یعنی خنثی. وزن اجزا: {sc_w}. جزء تکنیکال از روند EMA20/50، فاصلهٔ قیمت از EMA20، RSI، تغییر ۲۴ ساعته، جایگاه قیمت در دامنهٔ ۴۸ ساعته و یافته‌های اسکنر ساخته می‌شود؛ احساسات از شاخص ترس و طمع، اخبار از تعداد خبرهای ۴۸ ساعت اخیر و خبرهای امنیتی منفی، و جزء کانال از <a href=\"/track-record/\">کارنامهٔ آزموده‌شده</a>: تا وقتی حرکت بعد از پست‌ها با ساعت‌های تصادفیِ هم‌تراز تفاوت معنادار (p &lt; 0.05) نداشته باشد، روی ۵۰ (خنثی) می‌ماند. اگر جزئی داده نداشته باشد، وزنش بین بقیه پخش می‌شود. این عدد توصیف وضعیت فعلی است، نه پیش‌بینی.</p>'),
        ("اسکنر و کارنامه", '<p class="txt">اسکنر روی کندل‌های ۱ ساعتهٔ Binance این الگوها را پیدا می‌کند: ' + "، ".join(OPP_FA.values()) +
         '. هر یافته با زمان و قیمت ثبت می‌شود و نتیجهٔ واقعی‌اش پس از ۲۴ ساعت، چه خوب چه بد، در <a href="/ledger/">دفتر شفافیت</a> و <a href="/reality/">صفحهٔ واقعیت‌سنج</a> منتشر می‌شود. حرکت قیمت بعد از هر پست کانال هم زیر همان پست آمده است.</p>'),
        ("دسته‌بندی و ترجمه", '<p class="txt">دستهٔ هر پست خودکار و از روی تیتر و متن خودِ پست تعیین می‌شود: یک پست فقط وقتی «تحلیل تکنیکال» است که واقعاً نمودار بخواند، و فقط وقتی «سیگنال» است که نقطهٔ ورود، حد ضرر یا هدف داشته باشد. ترجمه‌های کوردی سورانی و انگلیسی ماشینی‌اند و هر کدام صفحهٔ جدا دارند؛ متن اصلی همیشه فارسی است.</p>'),
        ("هوش مصنوعی کجا به کار می‌رود", '<p class="txt">گزارش‌های «مغز بازار» و «میز گرد» با مدل زبانی نوشته می‌شوند و همیشه با برچسب هوش مصنوعی نمایش داده می‌شوند. امتیاز Entekhab، اسکنر، کارنامه‌ها و اعداد بازار با فرمول ثابت و بدون هوش مصنوعی محاسبه می‌شوند.</p>'),
        ("محدودیت‌ها", '<p class="txt">داده‌ها ممکن است چند دقیقه تأخیر داشته باشند یا وقتی منبعی در دسترس نیست خالی بمانند؛ زمان آخرین به‌روزرسانی کنار هر بخش نوشته شده است. RSI و روند روی تایم‌فریم ۱ ساعته‌اند و برای دیدن تصویر بلندمدت کافی نیستند. دارایی‌های کم‌حجم ریسک نقدشوندگی بالایی دارند.</p>'),
        ("توصیهٔ مالی نیست", f'<p class="txt">{NFA_FA} نتیجهٔ گذشته تضمینی برای آینده نیست.</p>'),
        ("گزارش خطا و اصلاح", '<p class="txt">اگر عددی را نادرست دیدید، به <a href="https://t.me/Kurdistan_coin" rel="noopener" target="_blank">@Kurdistan_coin</a> در تلگرام خبر دهید؛ خطای تأییدشده در اولین به‌روزرسانی اصلاح می‌شود.</p>'),
    ]
    body = '<div class="meta"><a href="/">خانه</a> / روش کار و منابع داده</div><h1>روش کار، منابع داده و شفافیت</h1>' + "".join(f"<h2>{h}</h2>{t}" for h, t in secs)
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "روش کار، منابع داده و شفافیت entekhab.net", "url": f"{SITE}/methodology/",
          "inLanguage": "fa", "publisher": PUBLISHER}
    return page("methodology/", "روش کار، منابع داده و شفافیت", "اعداد entekhab.net از کجا می‌آیند: منابع داده، فرمول امتیاز Entekhab، اسکنر و کارنامهٔ واقعی آن، نقش هوش مصنوعی و محدودیت‌ها.",
                body, f'<script type="application/ld+json">{sj(ld)}</script>')


def main():
    urls = [(f"{SITE}/", None)]
    by_coin = {}
    for p in posts:
        for c in p.get("coins", []):
            by_coin.setdefault(c, []).append(p)
    for p in posts:
        u = build_post(p)
        if p.get("q") != "low":
            urls.append((u, p.get("date")))
        for lg in ("en", "ckb"):
            ul = build_post_lang(p, lg)
            if ul and p.get("q") != "low":
                urls.append((ul, p.get("date")))
    build_rss()
    build_methodology()
    for c in set(by_coin) | set(MK):
        u = build_coin(c, by_coin.get(c, []))
        if c not in THIN:
            urls.append((u, market.get("updated_at")))
    order = sorted(set(by_coin) | set(MK), key=lambda c: -len(by_coin.get(c, [])))
    body = "<h1>قیمت و تحلیل ارزهای دیجیتال</h1><p class=txt>پروفایل هر دارایی با قیمت زنده، وضعیت تکنیکال، فرصت‌های اسکنر، امتیاز Entekhab و مطالب مرتبط. عدد کنار هر نماد تعداد مطالب آرشیو دربارهٔ آن است. <a href=\"/methodology/\">روش محاسبه و منابع داده</a></p><div class=coins>" + "".join(
        f'<a href="/coins/{c.lower()}/">{c} <small style="color:#9a9a94">{len(by_coin.get(c, []))}</small></a>' for c in order) + "</div>"
    urls.append((page("coins/", "قیمت و تحلیل ارزهای دیجیتال — پروفایل کوین‌ها", f"قیمت زنده و تحلیل تکنیکال {len(order)} ارز دیجیتال، از بیت‌کوین و اتریوم تا آلت‌کوین‌ها، با امتیاز شفاف و آرشیو مطالب", body), market.get("updated_at")))
    for pth in ("bot/", "lab/", "dna/", "terminal/", "developers/", "status/", "weekly/", "battle/", "tools/", "safety/", "about/", "indicators/", "app/", "privacy/", "terms/", "methodology/"):  # /me/ is personal → robots Disallow, so not in the sitemap
        urls.append((f"{SITE}/{pth}", market.get("updated_at")))
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u, d in urls:
        lm = f"<lastmod>{d[:10]}</lastmod>" if d else ""
        sm.append(f"<url><loc>{e(u)}</loc>{lm}</url>")
    sm.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(sm))
    open(os.path.join(ROOT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nDisallow: /me/\nDisallow: /offline.html\nSitemap: {SITE}/sitemap.xml\n")
    print(f"pages={len(urls)} posts={len(posts)} coins={len(order)}")




# ====================================================================== prerender
# پیش‌رندر صفحهٔ اصلی + صفحات /dashboard/ و /categories/<id>/
# تا موتورهای جستجو و ابزارهایی که جاوااسکریپت اجرا نمی‌کنند هم دادهٔ واقعی ببینند.
# جاوااسکریپت صفحه بعد از بارگذاری همین بخش‌ها را با دادهٔ تازه جایگزین می‌کند.

def intel_html():
    m, out = market, {}
    if m.get("fng"):
        f = m["fng"]
        out["fng"] = f'<h3>شاخص ترس و طمع</h3><div class="big">{f["value"]}</div><p>{e(f["class"])}</p><p class="disc">alternative.me</p>'
    if m.get("global"):
        g = m["global"]
        out["glob"] = ('<h3>وضعیت کل بازار</h3><table class="otab">'
                       f'<tr><td>ارزش کل بازار</td><td class="num">${g["mcap"]/1e12:.2f}T ({g["mcap_chg24"]:+}%)</td></tr>'
                       f'<tr><td>حجم ۲۴ ساعته</td><td class="num">${g["vol"]/1e9:.1f}B</td></tr>'
                       f'<tr><td>دامیننس BTC</td><td class="num">{g["btc_d"]}%</td></tr><tr><td>دامیننس ETH</td><td class="num">{g["eth_d"]}%</td></tr></table><p class="disc">CoinGecko</p>')
    ops = m.get("opportunities", [])
    rows = "".join(f'<tr><td><a href="/coins/{o["coin"].lower()}/">{o["coin"]}</a></td><td>{OPP_FA.get(o["type"], o["type"])}</td><td class="num">{o["strength"]}</td><td>{"بالا" if o["confidence"] == "high" else "متوسط"}</td><td class="num">{fmt_price(o["price"])}</td></tr>' for o in ops[:14])
    coins = "".join(f'<td><a href="/coins/{c["coin"].lower()}/">{c["coin"]}</a><div class="num">{c["chg24"]:+}%</div><div class="num">RSI {c["rsi"]}</div></td>' for c in m.get("coins", [])[:10] if c.get("chg24") is not None)
    out["opp"] = ('<h3>اسکنر فرصت‌ها (۱ ساعته)</h3>' + (f'<table class="otab"><tr><th>کوین</th><th>یافته</th><th>قدرت</th><th>اطمینان</th><th>قیمت</th></tr>{rows}</table>' if rows else '<p class="disc">در حال حاضر الگوی قابل‌توجهی پیدا نشد.</p>')
                  + f'<div class="tsc"><table class="otab"><tr>{coins}</tr></table></div><p class="disc">{m.get("scanned", len(m.get("coins", [])))} کوین اسکن شد · Binance · {fmt_date(m.get("updated_at",""))} · یافته‌های تکنیکال خودکارند و توصیهٔ خرید یا فروش نیستند.</p>')
    out["imp"] = '<h3>کارنامهٔ کانال: آزمون در برابر ساعت‌های تصادفی</h3>' + tested_line() + '<p class="disc">Binance 1h · آزمون تصادفی‌سازی</p>'
    if brain.get("regime"):
        RG = {"bull": "صعودی", "bear": "نزولی", "sideways": "رنج / خنثی", "high_volatility": "نوسان بالا"}
        r, b = brain["regime"], brain["regime"]["breadth"]
        rp = (brain.get("report") or {}).get("fa")
        out["brain"] = (f'<h3>مغز بازار Entekhab</h3><p><b>رژیم بازار: {RG[r["regime"]]}</b> · پهنای بازار: {b["up_pct"]}% صعودی، {b["down_pct"]}% نزولی، میانگین تغییر ۲۴h {b["avg_chg24"]}% (n={b["n"]})</p>'
                        + (f'<div><b>{e(big(rp["headline"]))}</b><p style="white-space:pre-wrap">{e(big(rp["body"]))}</p><p class="disc">گزارش هوش مصنوعی ({e(brain.get("report_engine",""))}) — {fmt_date(brain.get("report_at",""))}؛ فقط از داده‌های همین صفحه. توصیهٔ مالی نیست.</p></div>' if rp else ""))
    arr = sorted(SC.items(), key=lambda kv: -kv[1]["score"])
    if arr:
        out["score"] = '<h3>امتیاز Entekhab</h3><p class="disc">تکنیکال ۴۰٪ · احساسات ۲۵٪ · اخبار ۲۰٪ · کارنامهٔ کانال ۱۵٪ — توصیف وضعیت، نه پیش‌بینی</p><table class="otab"><tr><th>کوین</th><th>امتیاز</th><th>وضعیت</th></tr>' + "".join(
            f'<tr><td><a href="/coins/{k.lower()}/">{k}</a></td><td class="num">{v["score"]}</td><td>{LBL[v["label"]]}</td></tr>' for k, v in arr[:12]) + "</table>"
    if news.get("items"):
        out["news"] = '<h3>اخبار چندمنبعی</h3><ul class="list">' + "".join(news_li(i) for i in news["items"][:15]) + "</ul>"
    h = load("health.json", {})
    out["fresh"] = f'<span>اسکنر: {fmt_date(m.get("updated_at",""))}</span><span>آرشیو تلگرام: {fmt_date(meta.get("updated_at",""))}</span><span>سلامت سیستم: {e(h.get("status","—"))}</span>'
    return out


def post_li(p):
    cat = CATS.get(p["category"], {}).get("name", {}).get("fa", "")
    return f'<li><a href="/p/{p["id"]}/">{e(p["title"])}</a><small>{fmt_date(p.get("date",""))} · {e(cat)} · {" ".join(p.get("coins", [])[:4])}</small></li>'


CAT_H1 = {"technical": "تحلیل تکنیکال ارزهای دیجیتال", "signal": "سیگنال و ستاپ‌های معاملاتی", "etf_institutional": "اخبار ETF و سرمایه‌گذاری نهادی در کریپتو",
          "regulation": "قانون‌گذاری و سیاست‌های رمزارز", "security": "امنیت، هک و کلاهبرداری در کریپتو", "onchain": "تحلیل آن‌چین و داده‌های بازار",
          "education": "آموزش ارز دیجیتال و بلاک‌چین", "products": "کتاب‌ها و اندیکاتورهای کوین کورد", "community": "اطلاعیه‌ها و کلاس‌های دیسکورد", "news": "اخبار بازار ارزهای دیجیتال"}
CAT_INTRO = {
    "technical": "پست‌هایی که واقعاً نمودار می‌خوانند: میانگین‌های متحرک، RSI، حمایت و مقاومت، الگوهای فصلی و تحلیل روند بیت‌کوین و آلت‌کوین‌ها.",
    "signal": "ستاپ‌های معاملاتی با نقطهٔ ورود، حد ضرر و هدف؛ نتیجهٔ واقعی هر کدام با کندل‌های Binance در صفحهٔ همان پست ثبت می‌شود.",
    "etf_institutional": "جریان ورود و خروج سرمایه به صندوق‌های ETF، خرید بیت‌کوین توسط شرکت‌ها و بانک‌ها و حرکت سرمایه‌گذاران نهادی.",
    "regulation": "قانون‌ها، لایحه‌ها، تصمیم‌های بانک‌های مرکزی و دادگاه‌ها و سیاست دولت‌ها دربارهٔ رمزارزها.",
    "security": "هک صرافی‌ها و پروتکل‌ها، کلاهبرداری‌ها، آسیب‌پذیری‌ها و تهدیدهایی مثل رایانهٔ کوانتومی.",
    "onchain": "داده‌های زنجیره و بازار: نهنگ‌ها، هش‌ریت و ماینرها، دامیننس، تصفیه‌ها، فاندینگ و شاخص ترس و طمع.",
    "education": "مفاهیم پایهٔ بلاک‌چین، بیت‌کوین و بازار، اصطلاحات معامله‌گری و راهنماهای گام‌به‌گام.",
    "products": "کتاب‌ها، اندیکاتورها و استراتژی‌های اختصاصی کوین کورد در TradingView و راهنمای استفاده از آن‌ها.",
    "community": "اطلاعیه‌های کانال و کلاس‌های شبانهٔ دیسکورد کوین کورد (هر شب ساعت ۸ به وقت تهران).",
    "news": "خبرهای روز بازار رمزارز: قیمت، رکوردها، ریزش‌ها و رویدادهایی که بازار را تکان می‌دهند.",
}


def prerender():
    good = [p for p in posts if p.get("q") != "low"]           # promos / repeats are not shown as "latest"
    idx = os.path.join(ROOT, "index.html")
    s = open(idx, encoding="utf-8").read()
    it = intel_html()
    n_cats = len([c for c in meta.get("by_category", {}) if meta["by_category"][c]])
    n_coins = len(meta.get("by_coin", {}))
    reps = {
        '<b id="sPosts">—</b>': f'<b id="sPosts">{len(posts)}</b>',
        '<b id="sCats">—</b>': f'<b id="sCats">{n_cats}</b>',
        '<b id="sCoins">—</b>': f'<b id="sCoins">{n_coins}</b>',
        '<b id="sUpd" style="font-size:1.2rem;padding-top:14px">—</b>': f'<b id="sUpd" style="font-size:1.2rem;padding-top:14px">{fmt_date(meta.get("updated_at",""))}</b>',
        '<b id="nextTitle" dir="auto">…</b>': f'<b id="nextTitle" dir="auto">{e(good[0]["title"]) if good else "…"}</b>',
        '<div class="fresh" id="fresh"></div>': f'<div class="fresh" id="fresh">{it["fresh"]}</div>',
        '<div class="ibox" id="fngBox"></div>': f'<div class="ibox" id="fngBox">{it.get("fng","")}</div>',
        '<div class="ibox" id="globBox"></div>': f'<div class="ibox" id="globBox">{it.get("glob","")}</div>',
        '<div class="ibox wide" id="oppBox"></div>': f'<div class="ibox wide" id="oppBox">{it["opp"]}</div>',
        '<div class="ibox wide" id="brainBox"></div>': f'<div class="ibox wide" id="brainBox">{it.get("brain","")}</div>',
        '<div class="ibox wide" id="scoreBox"></div>': f'<div class="ibox wide" id="scoreBox">{it.get("score","")}</div>',
        '<div class="ibox wide" id="newsBox"></div>': f'<div class="ibox wide" id="newsBox">{it.get("news","")}</div>',
        '<div class="ibox wide" id="impBox"></div>': f'<div class="ibox wide" id="impBox">{it["imp"]}</div>',
        '<div class="hall" id="hallGrid"></div>': '<div class="hall" id="hallGrid">' + "".join(
            f'<a class="tile" href="/categories/{c["id"]}/" style="--c:{c["color"]}"><span class="ic">{c["icon"]}</span><div><b>{e(c["name"]["fa"])}</b><small>{meta["by_category"].get(c["id"],0)}</small></div></a>'
            for c in meta.get("categories", []) if meta.get("by_category", {}).get(c["id"])) + "</div>",
        '<div class="wrap" id="out"></div>': '<div class="wrap" id="out"><ul class="list">' + "".join(post_li(p) for p in good[:40]) + '</ul><p><a href="/sitemap.xml">همهٔ مطالب</a></p></div>',
    }
    miss = [k for k in reps if k not in s]
    for k, v in reps.items():
        s = s.replace(k, v, 1)
    s = s.replace("</small><b", "</small> <b").replace('</b></div><div class="kpi"', '</b></div> <div class="kpi"')
    open(idx, "w", encoding="utf-8").write(s)
    # /dashboard/
    css_x = ".big{font-size:2.4rem;font-weight:700;font-family:'Space Grotesk',monospace}.tsc,.ibox{overflow-x:auto;-webkit-overflow-scrolling:touch}.otab{width:100%;border-collapse:collapse}.otab td,.otab th{padding:8px;border-bottom:1px solid var(--line);text-align:start}.num{direction:ltr;unicode-bidi:isolate}.disc{color:var(--mute);font-size:.8rem}.fresh span{border:1px solid var(--line);border-radius:999px;padding:3px 10px;margin:3px;display:inline-block;font-size:.8rem;color:var(--mute)}.ibox{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px;margin:10px 0}"
    body = f'<h1>داشبورد هوشمند بازار</h1><div class="fresh">{it["fresh"]}</div>' + "".join(f'<div class="ibox">{it.get(k,"")}</div>' for k in ("brain", "score", "fng", "glob", "opp", "news", "imp"))
    urls = [page("dashboard/", "داشبورد هوشمند بازار کریپتو", "اسکنر خودکار فرصت‌ها، شاخص ترس و طمع، وضعیت کل بازار و کارنامهٔ واقعی تحلیل‌ها", body, f"<style>{css_x}</style>")]
    # /categories/<id>/
    for c in meta.get("categories", []):
        ps = [p for p in posts if p["category"] == c["id"]]
        if not ps:
            continue
        body = f'<div class="meta"><a href="/">خانه</a> / دسته‌ها</div><h1>{c["icon"]} {e(CAT_H1.get(c["id"], c["name"]["fa"]))}</h1><p class="txt">{e(CAT_INTRO.get(c["id"], ""))}</p><p class="note">{e(c["name"].get("ckb",""))} · {e(c["name"].get("en",""))} — {len(ps)} مطلب · <a href="/methodology/">دسته‌ها چطور تعیین می‌شوند</a></p><ul class="list">' + "".join(post_li(p) for p in ps[:200]) + "</ul>"
        urls.append(page(f"categories/{c['id']}/", CAT_H1.get(c["id"], c["name"]["fa"]) + " — آرشیو " + c["name"]["fa"],
                         (CAT_INTRO.get(c["id"]) or f'آرشیو مطالب دستهٔ {c["name"]["fa"]}')[:155], body))
    urls.append(build_replay())
    print(f"prerendered index (missing placeholders: {miss}); extra pages {len(urls)}")
    return urls


REPLAY_JS = r"""
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RG={bull:'صعودی',bear:'نزولی',sideways:'رنج / خنثی',high_volatility:'نوسان بالا'};
let IDX=[];
async function init(){IDX=(await fetch('/data/history/index.json?'+Date.now()).then(r=>r.json())).slots;
  const days=[...new Set(IDX.map(s=>s.slot.slice(0,10)))];const sel=$('#day');sel.innerHTML=days.map(d=>`<option>${d}</option>`).join('');
  sel.value=days[days.length-1];sel.onchange=()=>slots();slots();
  const pts=IDX.filter(s=>s.btc);if(pts.length>1){const mn=Math.min(...pts.map(p=>p.btc)),mx=Math.max(...pts.map(p=>p.btc));
    $('#spark').innerHTML=`<polyline fill="none" stroke="#f7931a" stroke-width="1.5" points="${pts.map((p,i)=>`${(i/(pts.length-1)*600).toFixed(1)},${(70-(p.btc-mn)/((mx-mn)||1)*60).toFixed(1)}`).join(' ')}"/>`;}
}
function slots(){const d=$('#day').value;const ss=IDX.filter(s=>s.slot.startsWith(d));$('#slots').innerHTML=ss.map(s=>`<button data-s="${s.slot}">${s.slot.slice(11)}:00 UTC</button>`).join('');
  $('#slots').querySelectorAll('button').forEach(b=>b.onclick=()=>show(b.dataset.s));if(ss.length)show(ss[ss.length-1].slot)}
const big=t=>String(t||'').replace(/[0-9۰-۹٠-٩][0-9۰-۹٠-٩,٬]{9,}(?:[.٫][0-9۰-۹٠-٩]+)?/g,m=>{const n=+m.replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬]/g,'').replace('٫','.');if(!isFinite(n)||n<1e9)return m;return n>=1e12?(+(n/1e12).toFixed(2)).toLocaleString('fa-IR')+' تریلیون':(+(n/1e9).toFixed(1)).toLocaleString('fa-IR')+' میلیارد'});
async function show(slot){document.querySelectorAll('#slots button').forEach(b=>b.classList.toggle('on',b.dataset.s===slot));
  const s=await fetch(`/data/history/${slot}.json`).then(r=>r.json());const i=IDX.findIndex(x=>x.slot===slot);
  const later=[[1,'۶ ساعت بعد'],[4,'۲۴ ساعت بعد'],[28,'۷ روز بعد']].map(([n,l])=>{const x=IDX[i+n];if(!x||!x.btc||!s.prices.BTC)return `<div class="kpi"><small>${l}</small><b>—</b></div>`;const r=(x.btc/s.prices.BTC.price-1)*100;return `<div class="kpi"><small>BTC ${l}</small><b class="${r>=0?'up':'down'}">${r>=0?'+':''}${r.toFixed(2)}%</b></div>`}).join('');
  const rp=s.report&&s.report.fa;const rg=s.regime||{};
  $('#out').innerHTML=`<h2>وضعیت بازار در ${slot.replace('T',' ساعت ')}:00 UTC</h2>
  <div class="grid"><div class="kpi"><small>رژیم بازار</small><b>${RG[rg.regime]||'—'}</b></div><div class="kpi"><small>ترس و طمع</small><b>${s.fng??'—'}</b></div>
  ${Object.entries(s.prices).slice(0,6).map(([c,p])=>`<div class="kpi"><small>${c}</small><b>${p.price>=1?p.price.toLocaleString('en-US',{maximumFractionDigits:2}):p.price}</b><small class="${p.chg24>=0?'up':'down'}">${p.chg24>=0?'+':''}${p.chg24}% · RSI ${p.rsi}</small></div>`).join('')}</div>
  <h2>بعداً چه شد؟</h2><div class="grid">${later}</div>
  ${rp?`<h2>گزارش هوش مصنوعی در آن لحظه</h2><details open><summary>${esc(big(rp.headline))}</summary><div class="txt" style="white-space:pre-wrap">${esc(big(rp.body))}</div></details>`:''}
  ${s.opportunities&&s.opportunities.length?`<h2>یافته‌های اسکنر (اطمینان بالا)</h2><ul class="list">${s.opportunities.map(o=>`<li><a href="/coins/${o.coin.toLowerCase()}/">${o.coin}</a> — ${esc(o.type)}<small>قیمت ${o.price}</small></li>`).join('')}</ul>`:''}
  ${s.narratives&&s.narratives.length?`<h2>روایت‌های داغ</h2><ul class="list">${s.narratives.map(n=>`<li>${esc(n.name.fa)}<small>${n.mentions_24h} تیتر · عملکرد ${n.perf_24h??'—'}%</small></li>`).join('')}</ul>`:''}
  ${s.headlines&&s.headlines.length?`<h2>تیترهای آن لحظه</h2><ul class="list">${s.headlines.map(h=>`<li dir="ltr"><a href="${esc(h.url)}" target="_blank" rel="noopener nofollow">${esc(h.title)}</a><small>${esc(h.source)}</small></li>`).join('')}</ul>`:''}
  ${s.channel&&s.channel.length?`<h2>آخرین پست‌های کانال</h2><ul class="list">${s.channel.map(p=>`<li><a href="/p/${p.id}/">${esc(p.title)}</a></li>`).join('')}</ul>`:''}`}
init().catch(e=>$('#out').innerHTML='<p class=note>هنوز هیچ عکس فوری ذخیره نشده است.</p>');
"""


REG_FA = {"bull": "صعودی", "bear": "نزولی", "sideways": "رنج / خنثی", "high_volatility": "نوسان بالا"}


def snap_html(sn, full=True):
    """static summary of one Market Replay snapshot (shown without JavaScript and to search engines)"""
    reg = sn.get("regime") or {}
    b = reg.get("breadth") or {}
    pr = sn.get("prices") or {}
    g = sn.get("global") or {}
    h = [f'<div class="grid"><div class="kpi"><small>رژیم بازار</small><b>{e(REG_FA.get(reg.get("regime"), reg.get("regime") or "—"))}</b></div>'
         f'<div class="kpi"><small>ترس و طمع</small><b>{sn.get("fng", "—")}</b></div>'
         f'<div class="kpi"><small>پهنای بازار</small><b>{b.get("up_pct", "—")}٪ صعودی</b></div>'
         + (f'<div class="kpi"><small>BTC</small><b>${pr["BTC"]["price"]:,.0f}</b></div>' if pr.get("BTC") else "")
         + (f'<div class="kpi"><small>ارزش کل بازار</small><b>${g["mcap"] / 1e12:,.2f}T</b></div>' if g.get("mcap") else "") + "</div>"]
    rp = ((sn.get("report") or {}).get("fa") or {})
    if rp.get("headline"):
        bl = [big(x.strip("•-* ").strip()) for x in (rp.get("body") or "").split("\n") if x.strip()]
        h.append(f'<h2>{e(big(rp["headline"]))}</h2><ul class="list">' + "".join(f"<li>{e(x)}</li>" for x in (bl if full else bl[:2])) + "</ul>"
                 f'<p class="note">گزارش هوش مصنوعی · {e((sn.get("report_at") or "")[:16].replace("T", " "))} UTC — فقط از داده‌های همان لحظه</p>')
    if pr:
        def chs(v):
            return "—" if v.get("chg24") is None else "%+.2f%%" % v["chg24"]
        h.append("<h2>قیمت ارزهای اصلی</h2><table><tr><th>ارز</th><th>قیمت</th><th>۲۴ ساعت</th><th>RSI</th></tr>" + "".join(
            f'<tr><td><a href="/coins/{c.lower()}/">{e(c)}</a></td><td class="num">{fmt_price(v.get("price"))}</td><td class="num">{chs(v)}</td><td class="num">{v.get("rsi", "—")}</td></tr>'
            for c, v in pr.items()) + "</table>")
    op = sn.get("opportunities") or []
    if op and full:
        h.append("<h2>یافته‌های قوی اسکنر</h2><ul class=list>" + "".join(f'<li>{e(o["coin"])} · {OPP_FA.get(o["type"], o["type"])} · قدرت {o.get("strength")}</li>' for o in op[:10]) + "</ul>")
    hd = sn.get("headlines") or []
    if hd and full:
        h.append("<h2>تیترهای همان لحظه</h2><ul class=list>" + "".join(f'<li><a href="{e(su(x["url"]))}" rel="noopener nofollow" target="_blank" dir="ltr">{e(x["title"])}</a> <small>{e(x.get("source", ""))}</small></li>' for x in hd[:8]) + "</ul>")
    return "".join(h)


def build_daily():
    """/daily/<YYYY-MM-DD>/ — گزارش روزانهٔ بازار از آخرین عکس فوری هر روز (Market Replay) + /daily/ ؛ و محتوای ثابت صفحهٔ /replay/"""
    hd = os.path.join(D, "history")
    idx = load("history/index.json", {})
    slots = [s["slot"] for s in idx.get("slots", [])]
    if not slots:
        return []
    by_day = {}
    for sl in slots:
        by_day[sl[:10]] = sl                       # last slot of each day
    urls, days = [], sorted(by_day)
    for i, day in enumerate(days):
        try:
            sn = json.load(open(os.path.join(hd, f"{by_day[day]}.json"), encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        nav = " · ".join(x for x in ((f'<a href="/daily/{days[i - 1]}/">← {days[i - 1]}</a>' if i else ""), '<a href="/daily/">همهٔ روزها</a>', (f'<a href="/daily/{days[i + 1]}/">{days[i + 1]} →</a>' if i + 1 < len(days) else "")) if x)
        body = (f'<div class="meta"><a href="/">خانه</a> / <a href="/daily/">گزارش روزانه</a> / {day}</div><h1>گزارش روزانهٔ بازار کریپتو — {day}</h1>'
                f'<p class="note">عکس فوری {e(by_day[day])} UTC از «بازپخش بازار»؛ اعداد مربوط به همان لحظه است. <a href="/replay/">بازپخش تعاملی ←</a></p>'
                + snap_html(sn) + f'<p class="note">{nav}</p><p class="note">آموزشی است، توصیهٔ مالی نیست.</p>')
        rp = ((sn.get("report") or {}).get("fa") or {})
        urls.append(page(f"daily/{day}/", f"گزارش روزانهٔ بازار کریپتو {day}", (rp.get("headline") or f"وضعیت بازار کریپتو در {day}")[:200], body))
    hub = "<h1>گزارش روزانهٔ بازار کریپتو</h1><p class=\"txt\">آرشیو وضعیت روزانهٔ بازار: رژیم، ترس و طمع، قیمت‌ها، گزارش هوش مصنوعی و تیترها — از ۱ نوامبر ۲۰۲۶.</p><ul class=list>" + "".join(
        f'<li><a href="/daily/{d}/">{d}</a></li>' for d in reversed(days)) + "</ul>"
    urls.append(page("daily/", "گزارش روزانهٔ بازار کریپتو — آرشیو", "آرشیو گزارش روزانهٔ بازار کریپتو با داده‌های واقعی", hub))
    print(f"daily pages: {len(urls)}")
    return urls


SECTOR_FA = {"layer-1": "لایهٔ یک (L1)", "exchange-based-tokens": "توکن صرافی‌ها", "meme-token": "میم‌کوین‌ها", "artificial-intelligence": "هوش مصنوعی (AI)",
             "decentralized-finance-defi": "دیفای (DeFi)", "real-world-assets-rwa": "دارایی‌های واقعی (RWA)", "layer-2": "لایهٔ دو (L2)", "gaming": "گیمینگ",
             "stablecoins": "استیبل‌کوین‌ها", "liquid-staking-tokens": "استیکینگ نقد", "smart-contract-platform": "پلتفرم قرارداد هوشمند",
             "privacy-coins": "حریم خصوصی", "solana-ecosystem": "اکوسیستم سولانا", "ethereum-ecosystem": "اکوسیستم اتریوم", "depin": "DePIN",
             "oracle": "اوراکل", "storage": "ذخیره‌سازی", "nft": "NFT", "metaverse": "متاورس", "decentralized-exchange": "صرافی‌های غیرمتمرکز (DEX)",
             "lending-borrowing": "وام‌دهی و وام‌گیری", "non-fungible-tokens-nft": "NFT", "zero-knowledge-zk": "دانش صفر (ZK)"}



def build_feeds():
    """/onchain/ and /crypto-news/ — Persian and Sorani summaries written by the Telegram bot (data/onchain.json, data/cryptonews.json)"""
    urls = []
    spec = [("onchain.json", "onchain/", "تحلیل آنچین — ئاناڵیزی ئانچین",
             "خلاصهٔ تحلیل‌های آنچین بیت‌کوین و بازار کریپتو به فارسی و کوردی سورانی"),
            ("cryptonews.json", "crypto-news/", "اخبار کریپتو — هەواڵی کریپتۆ",
             "خلاصهٔ اخبار روز بازار کریپتو به فارسی و کوردی سورانی")]
    for fn, path, title, desc in spec:
        d = load(fn, {})
        items = d.get("items", [])
        cards = []
        for it in items[:40]:
            fa = e(it.get("fa", "")).replace("\n", "<br>")
            ckb = e(it.get("ckb", "")).replace("\n", "<br>")
            when = fmt_date(it.get("at") or it.get("made") or "")
            block = f'<article class="txt" style="border:1px solid var(--line);border-radius:14px;padding:16px;margin:14px 0">'
            ph = it.get("img") or it.get("photo") or ""
            if ph.startswith(("https://", "/data/feedimg/")):
                block += f'<img class="img" src="{e(ph)}" alt="" loading="lazy" referrerpolicy="no-referrer">'
            block += f'<small class="note">{when}</small><div lang="fa" dir="rtl">{fa}</div>'
            if ckb:
                block += f'<details style="margin-top:10px"><summary>کوردی سۆرانی</summary><div lang="ckb" dir="rtl">{ckb}</div></details>'
            block += "</article>"
            cards.append(block)
        head = OP.analysis_block(load, e, fmt_date) if path == "onchain/" else ""
        body = (f'<div class="meta"><a href="/">خانه</a> / {e(title)}</div><h1>{e(title)}</h1>'
                f'<p class="note">{e(desc)} · به‌روز خودکار از ربات Coin_Kurd</p>' + head
                + ("".join(cards) or '<p class="note">هنوز موردی منتشر نشده است.</p>')
                + '<p class="note">آموزشی است، توصیهٔ مالی نیست.</p>')
        urls.append(page(path, title, desc, body))
    v = load("deep.json", {}).get("items", [])
    cards = []
    for it in v[:60]:
        img = it.get("img") or ""
        from fetch import drop_label                 # the subject opens the card, never the channel's label
        body = e(drop_label(it.get("fa", ""))).replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>").replace("\n", "<br>")
        cards.append('<article class="txt" style="border:1px solid var(--line);border-radius:14px;padding:16px;margin:14px 0">'
                     + (f'<img class="img" src="{e(img)}" alt="" loading="lazy">' if img.startswith("/data/deepimg/") else "")
                     + f'<small class="note">{fmt_date(it.get("at", ""))}</small><div lang="fa" dir="rtl">{body}</div></article>')
    vt, vd = "پرونده‌های تحلیلی", "تحلیل عمیق مهم‌ترین رویدادهای روز کریپتو از دل گزارش معتبرترین رسانه‌های جهان، به پارسی"
    urls.append(page("dossier/", vt, vd, f'<div class="meta"><a href="/">خانه</a> / {vt}</div><h1>{vt}</h1><p class="note">{vd}</p>'
                     + ("".join(cards) or '<p class="note">هنوز پرونده‌ای منتشر نشده است.</p>') + '<p class="note">آموزشی است، توصیهٔ مالی نیست.</p>'))
    print(f"feed pages: {len(urls)}")
    return urls

LWC = '<script src="/assets/vendor/lightweight-charts.js"></script>'
CHART_JS = """<script>
function ekChart(id, rows, opt){var el=document.getElementById(id); if(!el||!window.LightweightCharts||!rows.length) return;
 var c=LightweightCharts.createChart(el,{height:opt.h||300,layout:{background:{color:'transparent'},textColor:'#9a9a94',fontFamily:'Vazirmatn'},
  grid:{vertLines:{color:'rgba(255,255,255,.05)'},horzLines:{color:'rgba(255,255,255,.05)'}},rightPriceScale:{borderVisible:false},
  timeScale:{borderVisible:false},handleScroll:false,handleScale:false});
 var s=opt.hist?c.addHistogramSeries({color:opt.color||'#f7931a'}):c.addLineSeries({color:opt.color||'#f7931a',lineWidth:3});
 s.setData(rows); if(opt.zero){s.createPriceLine({price:0,color:'rgba(255,255,255,.35)',lineWidth:1,lineStyle:2});}
 c.timeScale().fitContent(); new ResizeObserver(function(){c.applyOptions({width:el.clientWidth});}).observe(el);}
</script>"""


def _box(inner):
    return f'<div style="border:1px solid var(--line);border-radius:14px;padding:16px;margin:14px 0;background:var(--card)">{inner}</div>'


def _short(a):
    return (a[:6] + "…" + a[-4:]) if a and len(a) > 14 else (a or "—")


def build_hub():
    """/sentiment/ /predict/ /whales/ — data produced by the Telegram bot (bot_hub.py)"""
    urls = []
    # ---------------- sentiment
    d = load("sentiment.json", {})
    now = d.get("now")
    col = "#22c55e" if (now or 0) >= 12 else "#ef4444" if (now or 0) <= -12 else "#eab308"
    pos = 50 + (now or 0) / 2
    gauge = (f'<div style="font-size:52px;font-weight:900;color:{col}">{"—" if now is None else f"{now:+.0f}"}</div>'
             f'<div style="font-size:22px;font-weight:700">{e(d.get("label", "بدون داده"))}</div>'
             f'<div style="position:relative;height:14px;border-radius:7px;margin:14px 0;background:linear-gradient(90deg,#ef4444,#eab308,#22c55e)" dir="ltr">'
             f'<span style="position:absolute;top:-6px;left:calc({pos:.0f}% - 4px);width:8px;height:26px;border-radius:4px;background:#fff"></span></div>'
             f'<small class="note">بر پایهٔ {d.get("n24", 0)} خبر و تحلیل ۲۴ ساعت گذشته · از ۱۰۰- (خیلی نزولی) تا ۱۰۰+ (خیلی صعودی)</small>')
    coins = "".join(f'<div class="kpi"><small>{e(c)}</small><b style="color:{"#22c55e" if v["v"] >= 12 else "#ef4444" if v["v"] <= -12 else "#eab308"}">{v["v"]:+.0f}</b><small>{e(v["label"])} · {v["n"]} خبر</small></div>'
                    for c, v in (d.get("coins") or {}).items())
    rows = json.dumps([{"time": h["d"], "value": h["v"]} for h in d.get("history", [])])
    items = "".join(f'<li style="margin:8px 0"><b style="color:{"#22c55e" if x["score"] >= 12 else "#ef4444" if x["score"] <= -12 else "#eab308"}">{x["score"]:+d}</b> — {e(x["title"])}</li>'
                    for x in d.get("items", [])[:20])
    body = ('<div class="meta"><a href="/">خانه</a> / شاخص احساسات اخبار</div><h1>شاخص احساسات اخبار انتخاب</h1>'
            '<p class="note">هوش مصنوعی هر خبر، تحلیل آنچین و پروندهٔ تحلیلی را از نظر اثر بر بازار نمره می‌دهد؛ میانگین ۲۴ ساعت، حس و حال اخبار امروز بازار است</p>'
            + _box(gauge) + (f'<h2>به تفکیک ارز</h2><div class="grid">{coins}</div>' if coins else "")
            + '<h2>روند روزانهٔ شاخص</h2><div id="sentc" style="width:100%"></div>'
            + (f'<h2>خبرهای ۲۴ ساعت اخیر و نمرهٔ آن‌ها</h2><ul class="txt">{items}</ul>' if items else "")
            + f'<p class="note">به‌روزرسانی {fmt_date(d.get("updated_at", ""))} · آموزشی است، توصیهٔ مالی نیست</p>'
            + LWC + CHART_JS + f"<script>ekChart('sentc',{rows},{{zero:true,h:280}});</script>")
    urls.append(page("sentiment/", "شاخص احساسات اخبار کریپتو امروز", "شاخص اختصاصی انتخاب: حس و حال اخبار امروز بازار کریپتو، صعودی یا نزولی، به تفکیک بیت‌کوین و اتریوم", body))
    # ---------------- predictions
    d = load("predict.json", {})
    cards = []
    for r in d.get("rounds", [])[:12]:
        n = r.get("n") or 0
        bars = "".join(f'<div style="margin:6px 0">{e(o)} — {round(100 * c / n) if n else 0}٪<div style="height:8px;border-radius:4px;background:var(--line)"><div style="height:8px;border-radius:4px;background:var(--acc);width:{round(100 * c / n) if n else 0}%"></div></div></div>'
                       for o, c in zip(r.get("opts", []), r.get("tally", [])))
        res = (f'<p>🏁 نتیجه: <b>{e(r["opts"][r["result"]])}</b> · قیمت نهایی {r["final"]:,.0f} دلار</p>' if r.get("result") is not None
               else f'<p class="note">رأی‌گیری تا {e(r["close"][:16].replace("T", " "))} به وقت جهانی · <a href="https://t.me/Kurd_kurdistan_bot">رأی بده در ربات</a></p>')
        cards.append(_box(f'<small class="note">{"هفتگی" if r["kind"] == "weekly" else "روزانه"} · قیمت هنگام طرح {r["ref"]:,.0f} دلار · {n} شرکت‌کننده</small>'
                          f'<h3>{e(r["q"])}</h3>{bars}{res}'))
    top = "".join(f'<tr><td>{i}</td><td>{e(x["name"])}</td><td>{x["pts"]}</td><td>{x["ok"]} از {x["n"]}</td></tr>' for i, x in enumerate(d.get("top", []), 1))
    body = ('<div class="meta"><a href="/">خانه</a> / بازی پیش‌بینی</div><h1>بازی پیش‌بینی انتخاب</h1>'
            '<p class="note">هر روز یک سؤال و هر هفته یک سؤال بزرگ دربارهٔ قیمت بیت‌کوین؛ در ربات کوین کورد رأی بده، پاسخ درست روزانه ۳ و هفتگی ۱۰ امتیاز دارد. بازی با امتیاز است و پولی در کار نیست</p>'
            + ("".join(cards) or '<p class="note">اولین سؤال به‌زودی</p>')
            + (f'<h2>🏆 جدول برترین‌ها</h2><table class="txt" style="width:100%"><tr><th>#</th><th>نام</th><th>امتیاز</th><th>درست</th></tr>{top}</table>' if top else "")
            + f'<p class="note">به‌روزرسانی {fmt_date(d.get("updated_at", ""))}</p>')
    urls.append(page("predict/", "بازی پیش‌بینی قیمت بیت‌کوین", "هر روز و هر هفته قیمت بیت‌کوین را پیش‌بینی کن، امتیاز بگیر و در جدول برترین‌های انتخاب بالا برو", body))
    # ---------------- whales
    d = load("whales.json", {})
    names = {"BTC": "بیت‌کوین", "ETH": "اتریوم", "USDT": "تتر", "USDC": "یو‌اس‌دی‌سی"}
    exp = {"BTC": "https://mempool.space/tx/", "ETH": "https://etherscan.io/tx/", "USDT": "https://etherscan.io/tx/", "USDC": "https://etherscan.io/tx/"}
    kpis = "".join(f'<div class="kpi"><small>{names.get(a, a)} · ۲۴ ساعت</small><b>{v["n"]} انتقال</b><small>{v["amount"]:,.0f} {a} · ${v["usd"] / 1e6:,.0f}M</small></div>'
                   for a, v in (d.get("totals24") or {}).items())
    hrs = json.dumps([{"time": int(datetime.fromisoformat(h["h"] + ":00:00+00:00").timestamp()), "value": round(h["usd"] / 1e6, 1)} for h in d.get("hourly", [])])
    rows_ = "".join(f'<tr><td>{fmt_date(x["at"])}</td><td><b>{x["amount"]:,.0f} {e(x["asset"])}</b><br><small class="note">${x["usd"] / 1e6:,.1f}M</small></td>'
                    f'<td dir="ltr"><small>{e(_short(x.get("from", "")))} → {e(_short(x.get("to", "")))}</small></td>'
                    f'<td><a href="{exp.get(x["asset"], "#")}{e(x["tx"])}" target="_blank" rel="noopener">مشاهده</a></td></tr>' for x in d.get("events", [])[:60])
    m = d.get("min", {})
    body = ('<div class="meta"><a href="/">خانه</a> / رادار نهنگ‌ها</div><h1>رادار نهنگ‌های انتخاب</h1>'
            f'<p class="note">انتقال‌های بزرگ روی زنجیره: بیت‌کوین از {m.get("BTC", 500):,} واحد، اتریوم از {m.get("ETH", 1000):,} واحد و تتر و یو‌اس‌دی‌سی از {m.get("stable", 10_000_000) / 1e6:,.0f} میلیون دلار. هر بلاک تازه بررسی می‌شود. '
            'توجه: بخشی از این انتقال‌ها جابه‌جایی داخلی صرافی‌هاست و هر انتقال بزرگ لزوماً خرید یا فروش نیست</p>'
            + (f'<div class="grid">{kpis}</div>' if kpis else "")
            + '<h2>حجم انتقال‌های بزرگ در هر ساعت (میلیون دلار)</h2><div id="whc" style="width:100%"></div>'
            + (f'<h2>آخرین انتقال‌ها</h2><div style="overflow-x:auto"><table class="txt" style="width:100%"><tr><th>زمان</th><th>مقدار</th><th>از ← به</th><th>تراکنش</th></tr>{rows_}</table></div>' if rows_ else '<p class="note">هنوز انتقال بزرگی ثبت نشده است</p>')
            + f'<p class="note">به‌روزرسانی {fmt_date(d.get("updated_at", ""))}</p>'
            + LWC + CHART_JS + f"<script>ekChart('whc',{hrs},{{hist:true,h:240}});</script>")
    urls.append(page("whales/", "رادار نهنگ‌ها — انتقال‌های بزرگ بیت‌کوین، اتریوم و تتر", "رصد انتقال‌های بزرگ روی زنجیرهٔ بیت‌کوین، اتریوم، تتر و یو‌اس‌دی‌سی در ۲۴ ساعت گذشته", body))
    print(f"hub pages: {len(urls)}")
    return urls


def build_seo_extra():
    """/fear-greed/ و /sectors/ — صفحات ثابت شاخص ترس و طمع و بخش‌های بازار با دادهٔ واقعی"""
    urls = []
    fg = market.get("fng") or {}
    if fg.get("value") is not None:
        hist = fg.get("history") or []
        pts = " ".join(f"{i / max(1, len(hist) - 1) * 600:.1f},{100 - v:.1f}" for i, (_, v) in enumerate(hist))
        cls = {"Extreme Fear": "ترس شدید", "Fear": "ترس", "Neutral": "خنثی", "Greed": "طمع", "Extreme Greed": "طمع شدید"}.get(fg.get("class"), fg.get("class"))
        body = (f'<div class="meta"><a href="/">خانه</a> / شاخص ترس و طمع</div><h1>شاخص ترس و طمع کریپتو امروز: {fg["value"]} ({e(cls)})</h1>'
                f'<div class="grid"><div class="kpi"><small>امروز</small><b>{fg["value"]}</b></div><div class="kpi"><small>وضعیت</small><b>{e(cls)}</b></div>'
                + (f'<div class="kpi"><small>۷ روز پیش</small><b>{hist[-8][1]}</b></div>' if len(hist) >= 8 else "")
                + (f'<div class="kpi"><small>۳۰ روز پیش</small><b>{hist[0][1]}</b></div>' if hist else "") + "</div>"
                + (f'<svg viewBox="0 0 600 100" style="width:100%;height:140px;border:1px solid var(--line);border-radius:10px;margin:14px 0"><line x1="0" x2="600" y1="50" y2="50" stroke="#ffffff22"/><polyline points="{pts}" fill="none" stroke="#f7931a" stroke-width="2"/></svg><p class="note">۳۰ روز اخیر · منبع alternative.me · به‌روزرسانی {fmt_date(market.get("updated_at", ""))}</p>' if hist else "")
                + '<h2>این شاخص چیست؟</h2><p class="txt">شاخص ترس و طمع (۰ تا ۱۰۰) احساس کلی بازار کریپتو را از نوسان، حجم، شبکه‌های اجتماعی، دامیننس بیت‌کوین و روندها خلاصه می‌کند. '
                'زیر ۲۵ «ترس شدید»، ۲۵ تا ۴۵ «ترس»، ۴۵ تا ۵۵ «خنثی»، ۵۵ تا ۷۵ «طمع» و بالای ۷۵ «طمع شدید» است. ترس شدید گاهی با کف‌های بازار هم‌زمان بوده و طمع شدید با سقف‌ها — اما این قاعدهٔ قطعی نیست.</p>'
                '<p class="txt">برای دیدن رژیم بازار، پهنای بازار و گزارش هوش مصنوعی به <a href="/#intel">مغز بازار</a> و برای تاریخچهٔ روزانه به <a href="/daily/">گزارش‌های روزانه</a> بروید.</p><p class="note">آموزشی است، توصیهٔ مالی نیست.</p>')
        urls.append(page("fear-greed/", f"شاخص ترس و طمع کریپتو امروز — {fg['value']} ({cls})", f"شاخص ترس و طمع بازار کریپتو امروز {fg['value']} است ({cls}). نمودار ۳۰ روزه و توضیح شاخص.", body))
    fl = load("flows.json", {})
    secs = [x for x in fl.get("sectors", []) if not x.get("suspect")]
    if secs:
        rows = []
        for x in secs:
            nm = SECTOR_FA.get(x["id"], x["name"])
            ch = x.get("chg24")
            chs = "—" if ch is None else "%+.2f%%" % ch
            body = (f'<div class="meta"><a href="/">خانه</a> / <a href="/sectors/">بخش‌های بازار</a> / {e(nm)}</div><h1>وضعیت بخش {e(nm)} در بازار کریپتو</h1>'
                    f'<div class="grid"><div class="kpi"><small>ارزش بازار</small><b>${x["mcap"] / 1e9:,.1f}B</b></div><div class="kpi"><small>تغییر ۲۴ ساعت</small><b class="{"up" if (ch or 0) >= 0 else "down"}">{chs}</b></div>'
                    f'<div class="kpi"><small>ورود/خروج ارزش ۲۴h</small><b>${x.get("delta_usd", 0) / 1e9:+,.2f}B</b></div><div class="kpi"><small>حجم ۲۴h</small><b>${(x.get("vol24") or 0) / 1e9:,.1f}B</b></div></div>'
                    f'<p class="txt">نام در CoinGecko: <span dir="ltr">{e(x["name"])}</span>. «ورود/خروج ارزش» تغییر ارزش بازار این بخش در ۲۴ ساعت است، نه جریان پول خالص.</p>'
                    f'<p><a href="/terminal/#flow">آبشار سرمایه در ترمینال ←</a> · <a href="/sectors/">همهٔ بخش‌ها</a></p><p class="note">منبع CoinGecko · به‌روزرسانی {fmt_date(fl.get("updated_at", ""))} · آموزشی است، توصیهٔ مالی نیست.</p>')
            urls.append(page(f"sectors/{x['id']}/", f"بخش {nm} کریپتو — ارزش بازار و تغییرات امروز", f"وضعیت امروز بخش {nm} در بازار کریپتو: ارزش بازار، تغییر ۲۴ ساعته و حجم معاملات", body))
            rows.append(f'<tr><td><a href="/sectors/{x["id"]}/">{e(nm)}</a></td><td class="num">${x["mcap"] / 1e9:,.1f}B</td><td class="num {"up" if (ch or 0) >= 0 else "down"}">{chs}</td></tr>')
        hub = "<h1>بخش‌های بازار کریپتو</h1><p class=\"txt\">ارزش بازار و تغییر ۲۴ ساعتهٔ بخش‌های اصلی (CoinGecko).</p><table><tr><th>بخش</th><th>ارزش بازار</th><th>۲۴ ساعت</th></tr>" + "".join(rows) + "</table>"
        urls.append(page("sectors/", "بخش‌های بازار کریپتو — DeFi، AI، RWA، میم و …", "ارزش بازار و تغییرات بخش‌های اصلی بازار کریپتو", hub))
    print(f"seo extra pages: {len(urls)}")
    return urls


def build_replay():
    idx = load("history/index.json", {})
    last = (idx.get("slots") or [{}])[-1].get("slot")
    sn = load(f"history/{last}.json", {}) if last else {}
    ssr = (f'<p class="note">آخرین عکس فوری: {e(last)} UTC — <a href="/daily/">آرشیو گزارش‌های روزانه</a></p>' + snap_html(sn, full=False)) if sn else '<p class="note">در حال بارگذاری…</p>'
    css = "#slots button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;margin:4px;cursor:pointer;font-family:inherit}#slots button.on{background:var(--acc);color:#000}select{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px;font-family:inherit}.kpi small.up,.kpi small.down{display:block}"
    body = ('<h1>⏪ بازپخش بازار (Market Replay)</h1><p class="txt">وضعیت بازار، گزارش هوش مصنوعی، یافته‌های اسکنر، روایت‌ها و تیترها در هر لحظهٔ گذشته — و اینکه بعداً قیمت چه کرد. '
            'از ۱ نوامبر ۲۰۲۶ هر ۶ ساعت یک عکس فوری ذخیره می‌شود.</p>'
            '<svg id="spark" viewBox="0 0 600 75" style="width:100%;height:80px;border:1px solid var(--line);border-radius:10px;margin:8px 0"></svg>'
            '<p><label>روز: <select id="day"></select></label></p><div id="slots"></div><div id="out">' + ssr + '</div>')
    return page("replay/", "بازپخش بازار کریپتو (Market Replay)", "وضعیت بازار کریپتو در هر لحظهٔ گذشته: رژیم بازار، گزارش هوش مصنوعی، اسکنر، روایت‌ها و تیترها",
                body, f"<style>{css}</style><script defer>{REPLAY_JS}</script>".replace("<script defer>", "<script>document.addEventListener('DOMContentLoaded',()=>{").replace("</script>", "})</script>"))


def build_api():
    """API عمومی ثابت: /api/v1/*.json (فقط‌خواندنی، هر ۱۵ دقیقه به‌روز)"""
    base = os.path.join(ROOT, "api", "v1")
    os.makedirs(os.path.join(base, "coins"), exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    def w(rel, obj):
        json.dump({"generated_at": now, "source": SITE, **obj}, open(os.path.join(base, rel), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    w("market/overview.json".replace("/", "_"), {"regime": brain.get("regime"), "fng": market.get("fng"), "global": market.get("global"),
                                                 "gainers": brain.get("gainers"), "losers": brain.get("losers")})
    w("scanner_opportunities.json", {"updated_at": market.get("updated_at"), "scanned": market.get("scanned"), "opportunities": market.get("opportunities", [])})
    w("news_latest.json", {"updated_at": news.get("updated_at"), "items": news.get("items", [])[:100]})
    w("score.json", {"updated_at": score.get("updated_at"), "method": score.get("method"), "coins": SC})
    w("report.json", {"report_at": brain.get("report_at"), "engine": brain.get("report_engine"), "report": brain.get("report")})
    w("analysis.json", OP.api(load, SITE))     # the same report, compact, for the extension and the apps
    by = {}
    for r in impact.values():
        if r.get("r24h") is not None:
            by.setdefault(r["coin"], []).append(r["r24h"])
    w("signals_performance.json", {"by_coin": {c: {"n": len(a), "avg_r24h": round(sum(a) / len(a), 3), "pct_positive": round(sum(1 for x in a if x > 0) * 100 / len(a))} for c, a in by.items()}})
    w("posts_latest.json", {"posts": [{k: p.get(k) for k in ("id", "date", "title", "category", "coins", "url")} | {"page": f"{SITE}/p/{p['id']}/"} for p in posts[:100]]})
    for c in MK:
        w(f"coins/{c.lower()}.json", {"coin": c, "market": MK[c], "score": SC.get(c), "opportunities": [o for o in market.get("opportunities", []) if o["coin"] == c],
                                     "news": [i for i in news.get("items", []) if c in i.get("coins", [])][:20]})
    try:   # the Reality-check readings, in the same shape the bot renders — one source, every surface
        import bot_reality as BRL
        w("reality.json", {"note": "the reality-check readings, as shown in the bot and the extension",
                           **{lg: BRL.summary(lg) for lg in ("fa", "ckb", "en")}})
    except Exception as ex:  # noqa: BLE001
        print("reality summary skipped:", ex)
    try:   # the encyclopedia search index — the bot, the extension and the apps search the same file
        import bot_encyclopedia as ENC
        w("encyclopedia.json", ENC.api())
    except Exception as ex:  # noqa: BLE001
        print("encyclopedia index skipped:", ex)
    for nm in ("dna", "derivatives", "chain", "flows", "lab", "council", "wrapped", "indicators", "kind", "signals",
               "ledger", "hype", "friction", "localcorr", "silent_exit", "opportunity", "sentiment", "whales"):
        dd = load(f"{nm}.json", None)
        if dd:
            w(f"{nm}.json", {"data": dd})
    idx = sorted(os.path.relpath(os.path.join(dp, f), base) for dp, _, fs in os.walk(base) for f in fs)
    json.dump({"endpoints": [f"{SITE}/api/v1/{x}" for x in idx if x != "index.json"], "note": "free, read-only, updated every 15 minutes; attribution to entekhab.net appreciated; not financial advice"},
              open(os.path.join(base, "index.json"), "w"), indent=1)
    print(f"api endpoints: {len(idx)}")


GN_FA = {"liquidity": "نقدشوندگی", "volatility": "نوسان", "flow": "جریان خریداران", "sentiment": "احساسات خبری", "attention": "توجه رسانه‌ای",
         "leverage": "اهرم مشتقه", "developers": "فعالیت توسعه", "momentum": "مومنتوم"}


def build_dna():
    """/dna/<coin>/ — صفحات ثابت قابل ایندکس برای DNA هر ارز (همان صفحهٔ تعاملی با ارز از پیش انتخاب‌شده + خلاصهٔ متنی)"""
    dna = load("dna.json", {})
    tpl_p = os.path.join(ROOT, "dna", "index.html")
    if not dna.get("coins") or not os.path.exists(tpl_p):
        return []
    tpl = open(tpl_p, encoding="utf-8").read()
    urls = []
    for c, d in dna["coins"].items():
        g = d.get("genes", {})
        genes_txt = "، ".join(f"{GN_FA.get(k, k)} {('—' if v is None else v)}" for k, v in g.items())
        sim = "، ".join(f"{o} ({s}٪)" for o, s in d.get("similar", [])[:5])
        ts = d.get("twin_stats") or {}
        title = f"DNA بازار {c} — {NAMES.get(c, c)}"
        desc = f"DNA تحلیلی {c}: {genes_txt}. ارزهای مشابه: {sim or '—'}."
        seo = (f'<h2>DNA {e(c)}</h2><p>{e(desc)}</p>'
               f'<p>کد DNA: <span dir="ltr">{e(d.get("code", ""))}</span> · همبستگی با BTC: {e(str((d.get("raw") or {}).get("corr_btc")))}'
               + (f' · دوقلوهای تاریخی: {ts.get("up30")}/{ts.get("n")} صعودی پس از ۳۰ روز (میانگین {ts.get("avg30")}٪)' if ts else "")
               + f' · به‌روزرسانی {e(dna.get("updated_at", "")[:16])} UTC</p>'
               + "<p>" + " · ".join(f'<a href="/dna/{o.lower()}/">{e(o)}</a>' for o in [x for x, _ in d.get("similar", [])]) + "</p>")
        url = f"{SITE}/dna/{c.lower()}/"
        doc = (tpl.replace("<title>Market DNA — DNA بازار ارزهای دیجیتال | entekhab.net</title>", f"<title>{e(title)} | entekhab.net</title>")
               .replace('<link rel="canonical" href="https://entekhab.net/dna/">', f'<link rel="canonical" href="{url}">')
               .replace('<meta name="description" content="', f'<meta name="description" content="{e(desc[:300])} — ', 1)
               .replace('<div id="seo" class="disc" style="margin:30px 0"></div>', f'<div id="seo" class="disc" style="margin:30px 0">{seo}</div>')
               .replace('<script src="/assets/ui.js"></script>', f'<script>window.DNA_COIN={sj(c)}</script><script src="/assets/ui.js"></script>'))
        out = os.path.join(ROOT, "dna", c.lower(), "index.html")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w", encoding="utf-8").write(doc)
        urls.append(url)
    print(f"dna pages: {len(urls)}")
    return urls


def build_weekly():
    """/weekly/ مجلهٔ هفتگی بازار (#94) — از data/weekly/<ISO-week>.json؛ هر شماره صفحهٔ ثابت خودش را دارد"""
    wd = os.path.join(D, "weekly")
    if not os.path.isdir(wd):
        return []
    issues = []
    for f in sorted(os.listdir(wd)):
        if f.endswith(".json"):
            try:
                issues.append(json.load(open(os.path.join(wd, f), encoding="utf-8")))
            except Exception:  # noqa: BLE001
                pass
    if not issues:
        return []
    css = ".mag h2{margin-top:26px}.mag table{width:100%;border-collapse:collapse}.mag td,.mag th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:start}.num{direction:ltr;unicode-bidi:isolate}.pos{color:#22c55e}.neg{color:#ef4444}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.cards div{border:1px solid var(--line);border-radius:12px;padding:12px}"
    pct = lambda v: "—" if v is None else f'<span class="num {"pos" if v >= 0 else "neg"}">{"+" if v >= 0 else ""}{v}%</span>'  # noqa: E731
    urls = []

    def body(it, nav):
        w = it.get("wrapped") or {}
        b = w.get("btc") or {}
        rep = ((it.get("brain") or {}).get("report") or {}).get("fa") or {}
        h = [f'<div class="meta"><a href="/">خانه</a> / <a href="/weekly/">مجلهٔ هفتگی</a></div><div class="mag"><h1>مجلهٔ هفتگی بازار — {e(it["week"])}</h1>',
             f'<p class="note">{e(it["from"])} تا {e(it["to"])} · ساخته‌شده از دادهٔ واقعی Binance، اخبار، کانال Coin_Kurd و هوش مصنوعی Entekhab</p>']
        if b:
            h.append(f'<div class="cards"><div><b>BTC این هفته</b><br>{pct(b.get("chg"))}<br><small class="note">${fm(b.get("low"))} – ${fm(b.get("high"))}</small></div>'
                     f'<div><b>بزرگ‌ترین روز</b><br><span class="num">{e(str((b.get("biggest_day") or {}).get("date")))}</span> {pct((b.get("biggest_day") or {}).get("chg"))}</div>'
                     f'<div><b>روزهای سبز</b><br><span class="num">{b.get("green_days")}/{w.get("days")}</span></div>'
                     f'<div><b>کوین‌های مثبت</b><br><span class="num">{w.get("up_count")}/{w.get("n_coins")}</span></div></div>')
        if rep.get("headline"):
            h.append(f'<h2>{e(rep["headline"])}</h2><div class="txt">{rich(rep.get("body", ""))}</div>')
        if w.get("top_gainers"):
            h.append('<h2>برندگان و بازندگان هفته</h2><table><tr><th>بیشترین رشد</th><th></th><th>بیشترین افت</th><th></th></tr>' + "".join(
                f'<tr><td><a href="/coins/{g["coin"].lower()}/">{e(g["coin"])}</a></td><td>{pct(g["chg"])}</td><td><a href="/coins/{l["coin"].lower()}/">{e(l["coin"])}</a></td><td>{pct(l["chg"])}</td></tr>'
                for g, l in zip(w["top_gainers"], w.get("top_losers", []))) + "</table>")
        if it.get("council") and it["council"].get("fa"):
            h.append(f'<h2>نتیجهٔ میزگرد هوش مصنوعی</h2><p>{e(it["council"]["fa"])}</p>')
        if it.get("narratives"):
            h.append("<h2>روایت‌های داغ</h2><ul>" + "".join(f'<li>{e((n.get("name") or {}).get("fa") or "")} — {n.get("mentions_24h")} تیتر · {pct(n.get("perf_24h"))}</li>' for n in it["narratives"]) + "</ul>")
        if it.get("events"):
            h.append("<h2>رویدادهای اقتصادی و واکنش بیت‌کوین</h2><table><tr><th></th><th>۱ ساعت بعد</th><th>۴ ساعت بعد</th></tr>" + "".join(
                f'<tr><td>{e(x.get("title_fa") or x.get("title") or "")} <small class="note">{e((x.get("date") or "")[:10])}</small></td><td>{pct(x.get("btc_1h"))}</td><td>{pct(x.get("btc_4h"))}</td></tr>' for x in it["events"]) + "</table>")
        if it.get("headlines"):
            h.append("<h2>تیترهای مهم</h2><ul>" + "".join(f'<li><a href="{e(su(n["url"]))}" rel="noopener nofollow" target="_blank" dir="ltr">{e(n["title"])}</a> <small class="note">{e(n["source"])}</small></li>' for n in it["headlines"]) + "</ul>")
        if it.get("dna_momentum"):
            h.append("<h2>DNA هفته</h2><p>بیشترین مومنتوم: " + "، ".join(f'<a href="/dna/{c.lower()}/">{e(c)}</a> ({v})' for c, v in it["dna_momentum"]) +
                     "<br>بیشترین سهم خریداران: " + "، ".join(f'<a href="/dna/{c.lower()}/">{e(c)}</a> ({v}٪)' for c, v in (it.get("dna_flow") or [])) + "</p>")
        if it.get("channel"):
            h.append("<h2>از کانال Coin_Kurd</h2><ul>" + "".join(f'<li><a href="/p/{x["id"]}/">{e(x.get("title") or "")}</a></li>' for x in it["channel"]) + "</ul>")
        h.append('<p class="note">آموزشی است، توصیهٔ مالی نیست. <a href="/lab/#wrapS">تصویر Wrapped هفته را بساز و منتشر کن ←</a></p>' + nav + "</div>")
        return "".join(h)

    arch = '<h2>آرشیو شماره‌ها</h2><ul>' + "".join(f'<li><a href="/weekly/{e(it["week"].lower())}/">{e(it["week"])}</a> <small class="note">{e(it["from"])} – {e(it["to"])}</small></li>' for it in reversed(issues)) + "</ul>"
    for it in issues:
        urls.append(page(f'weekly/{it["week"].lower()}/', f'مجلهٔ هفتگی بازار کریپتو {it["week"]}', f'خلاصهٔ هفتهٔ {it["from"]} تا {it["to"]}: بیت‌کوین، برندگان و بازندگان، روایت‌ها، رویدادها و تحلیل هوش مصنوعی', body(it, arch), f"<style>{css}</style>"))
    urls.append(page("weekly/", "مجلهٔ هفتگی بازار کریپتو — آخرین شماره", "مجلهٔ هفتگی entekhab.net: خلاصهٔ تصویری و تحلیلی بازار کریپتو هر هفته", body(issues[-1], arch), f"<style>{css}</style>"))
    print(f"weekly issues: {len(issues)}")
    return urls


def fm(v):
    try:
        return f"{float(v):,.0f}"
    except (TypeError, ValueError):
        return "—"


def build_compare():
    """/compare/<a>-vs-<b>/ (#61 #93) — مقایسهٔ واقعی دو ارز با DNA و داده‌های زنده؛ ۶۶ صفحه برای ۱۲ ارز پرحجم"""
    dna = load("dna.json", {}).get("coins") or {}
    if not dna:
        return []
    top = [c for c, _ in sorted(dna.items(), key=lambda kv: -(kv[1]["raw"].get("qvol30") or 0))][:12]
    css = ".cmp{width:100%;border-collapse:collapse}.cmp td,.cmp th{padding:8px;border-bottom:1px solid var(--line);text-align:start}.num{direction:ltr;unicode-bidi:isolate}.win{color:#22c55e;font-weight:700}"
    rows = [("price", "قیمت (دلار)", 0), ("ret7", "بازده ۷ روز ٪", 1), ("ret30", "بازده ۳۰ روز ٪", 1), ("ret90", "بازده ۹۰ روز ٪", 1), ("vol30", "نوسان ۳۰ روزه ٪ (کمتر = آرام‌تر)", -1),
            ("taker7", "سهم خریداران ٪", 1), ("funding_ann", "فاندینگ سالانه ٪", 0), ("commits30", "کامیت‌های ۳۰ روز", 1), ("corr_btc", "همبستگی با BTC", 0), ("from_high", "فاصله از سقف ۱۰۰۰ روزه ٪", 1)]
    urls = []
    for i, a in enumerate(top):
        for b in top[i + 1:]:
            A, B = dna[a], dna[b]
            shared = [g for g in A["genes"] if A["genes"][g] is not None and B["genes"].get(g) is not None]
            sim = round((1 - (sum((A["genes"][g] - B["genes"][g]) ** 2 for g in shared) / len(shared)) ** 0.5 / 100) * 100) if shared else None
            tr = []
            wa = wb = 0
            for k, label, d in rows:
                va, vb = A["raw"].get(k), B["raw"].get(k)
                ca = cb = ""
                if d and va is not None and vb is not None and va != vb:
                    if (va > vb) == (d > 0):
                        ca, wa = ' class="num win"', wa + 1
                    else:
                        cb, wb = ' class="num win"', wb + 1
                fmt = lambda v: "—" if v is None else (f"{v:,.6g}" if isinstance(v, float) else str(v))  # noqa: E731
                tr.append(f'<tr><td>{label}</td><td{ca or " class=num"}>{fmt(va)}</td><td{cb or " class=num"}>{fmt(vb)}</td></tr>')
            genes = "".join(f'<tr><td>ژن {e(GN_FA.get(g, g))}</td><td class="num">{A["genes"][g] if A["genes"][g] is not None else "—"}</td><td class="num">{B["genes"].get(g) if B["genes"].get(g) is not None else "—"}</td></tr>' for g in A["genes"])
            body = (f'<div class="meta"><a href="/">خانه</a> / مقایسه</div><h1>{e(a)} یا {e(b)}؟ مقایسهٔ داده‌محور</h1>'
                    f'<p class="note">{e(NAMES.get(a, a))} در برابر {e(NAMES.get(b, b))} — شباهت DNA: <b class="num">{sim if sim is not None else "—"}٪</b> · امتیاز معیارها: <b class="num">{a} {wa} : {wb} {b}</b> · به‌روزرسانی هر ۳ ساعت</p>'
                    f'<table class="cmp"><tr><th>معیار</th><th>{e(a)}</th><th>{e(b)}</th></tr>{"".join(tr)}{genes}</table>'
                    f'<p><a href="/dna/{a.lower()}/">DNA {e(a)}</a> · <a href="/dna/{b.lower()}/">DNA {e(b)}</a> · <a href="/lab/#discS">⚔️ دوئل تعاملی</a> · <a href="/coins/{a.lower()}/">{e(a)}</a> · <a href="/coins/{b.lower()}/">{e(b)}</a></p>'
                    '<p class="note">برنده در هر ردیف فقط بر اساس همان معیار مشخص شده است؛ این مقایسه آموزشی است و توصیهٔ مالی نیست.</p>')
            urls.append(page(f"compare/{a.lower()}-vs-{b.lower()}/", f"{a} یا {b}؟ مقایسهٔ {NAMES.get(a, a)} و {NAMES.get(b, b)}",
                             f"مقایسهٔ داده‌محور {a} و {b}: بازده، نوسان، سهم خریداران، فاندینگ، فعالیت توسعه، همبستگی و DNA بازار", body, f"<style>{css}</style>"))
    hub = "<h1>مقایسهٔ ارزها</h1><ul>" + "".join(f'<li><a href="{u}">{e(u.rsplit("/", 2)[-2].replace("-vs-", " یا ").upper())}</a></li>' for u in urls) + "</ul>"
    urls.append(page("compare/", "مقایسهٔ ارزهای دیجیتال", "مقایسهٔ داده‌محور ارزهای پرحجم با DNA بازار", hub, f"<style>{css}</style>"))
    print(f"compare pages: {len(urls)}")
    return urls


def build_indicators():
    """/indicators/<id>/ — صفحهٔ ثابت هر اندیکاتور Coin_Kurd (تصویر، توضیح، بک‌تست، سیگنال‌ها) + /signals/ + خلاصهٔ متنی برای موتورهای جستجو"""
    ind = load("indicators.json", {})
    tpl_p = os.path.join(ROOT, "indicators", "index.html")
    if not ind.get("items") or not os.path.exists(tpl_p):
        return []
    tpl = open(tpl_p, encoding="utf-8").read()
    kind_ = load("kind.json", {})
    urls = []
    KFA = {"strategy": "استراتژی", "indicator": "اندیکاتور"}
    AFA = {"invite-only": "دعوتی", "open-source": "متن‌باز"}

    def seo_of(it):
        t = it["t"]["fa"]
        h = f'<h2>{e(it["name"])}</h2><p>{e(t["sum"])}</p><ul>' + "".join(f"<li>{e(x)}</li>" for x in t["how"]) + "</ul>"
        if it.get("bt"):
            b = it["bt"]
            h += (f'<p>بک‌تست چارت انتشار ({e(it["chart"])}): سود کل {e(b["pnl"])}، بیشترین افت {e(b["dd"])}، معاملات سودده {e(b["win"])} ({e(b["trades"])})، '
                  f'فاکتور سود {e(b["pf"])} — منبع: گزارش استراتژی TradingView.</p>')
        h += f'<p>{KFA.get(it["kind"], "")} · {AFA.get(it["access"], "")} · <a href="{e(su(it["url"]))}" rel="noopener">TradingView</a></p>'
        h += f'<p lang="en" dir="ltr">{e(it["t"]["en"]["sum"])}</p><p lang="ckb">{e(it["t"]["ckb"]["sum"])}</p>'
        return h

    for it in ind["items"]:
        t = it["t"]["fa"]
        url = f"{SITE}/indicators/{it['id']}/"
        title = f"{it['name']} — {KFA.get(it['kind'], '')} اختصاصی Coin_Kurd در TradingView"
        desc = t["sum"][:300]
        extra = ""
        if it["id"] == "kurdistani-power-law" and kind_.get("power_law"):
            pl = kind_["power_law"]
            extra = f'<p>اکنون: ارزش منصفانه {pl["fair"]:,.0f} دلار، قیمت {pl["price"]:,.0f} دلار ({pl["dev_pct"]:+.1f}٪) — به‌روزرسانی {e(kind_.get("updated_at", "")[:16])} UTC</p>'
        if it["id"] == "kurdistani-style-cycle" and kind_.get("style_cycle"):
            sc = kind_["style_cycle"]
            extra = f'<p>اکنون: فاز {e(sc["phase"])}، Bull-Bear {sc["bull_bear"]}، NUPL {sc["nupl"]}، MVRV {sc["mvrv"]} — {e(sc["date"])}</p>'
        ld = {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": it["name"], "applicationCategory": "FinanceApplication",
              "operatingSystem": "TradingView (Pine Script)", "description": it["t"]["en"]["sum"], "url": it["url"], "image": f"{SITE}/assets/tv-{it['tv']}.webp",
              "author": {"@type": "Person", "name": "Omid Dabbaghchi Mokri (Coin_Kurd)", "url": "https://www.tradingview.com/u/Coin_Kurd/"},
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"} if it["access"] == "open-source" else None}
        ld = {k: v for k, v in ld.items() if v is not None}
        doc = (tpl.replace("<title>اندیکاتورهای اختصاصی Coin_Kurd و سیگنال‌های TradingView | entekhab.net</title>", f"<title>{e(title)} | entekhab.net</title>")
               .replace('<link rel="canonical" href="https://entekhab.net/indicators/">', f'<link rel="canonical" href="{url}"><script type="application/ld+json">{sj(ld)}</script>')
               .replace('<meta name="description" content="', f'<meta name="description" content="{e(desc)} — ', 1)
               .replace('<meta property="og:title" content="اندیکاتورهای اختصاصی Coin_Kurd | entekhab.net">', f'<meta property="og:title" content="{e(it["name"])} | entekhab.net">')
               .replace('<meta property="og:image" content="https://entekhab.net/assets/tv-jxwqCFUw.webp">', f'<meta property="og:image" content="{SITE}/assets/tv-{it["tv"]}.webp">')
               .replace('<div id="seo" class="disc" style="margin:30px 0"></div>', f'<div id="seo" class="disc" style="margin:30px 0">{seo_of(it)}{extra}</div>')
               .replace('<script src="/assets/ui.js"></script>', f'<script>window.IND_ID={sj(it["id"])}</script><script src="/assets/ui.js"></script>'))
        out = os.path.join(ROOT, "indicators", it["id"], "index.html")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w", encoding="utf-8").write(doc)
        urls.append(url)
    hub_seo = "<h2>فهرست اندیکاتورها</h2><ul>" + "".join(f'<li><a href="/indicators/{it["id"]}/">{e(it["name"])}</a> — {e(it["t"]["fa"]["sum"][:180])}</li>' for it in ind["items"]) + "</ul>"
    hub = tpl.replace('<div id="seo" class="disc" style="margin:30px 0"></div>', f'<div id="seo" class="disc" style="margin:30px 0">{hub_seo}</div>')
    open(tpl_p, "w", encoding="utf-8").write(hub)
    sig = (hub.replace('<link rel="canonical" href="https://entekhab.net/indicators/">', f'<link rel="canonical" href="{SITE}/signals/">')
              .replace("<title>اندیکاتورهای اختصاصی Coin_Kurd و سیگنال‌های TradingView | entekhab.net</title>", "<title>سیگنال‌های اندیکاتورهای Coin_Kurd و نتیجهٔ واقعی آن‌ها | entekhab.net</title>")
              .replace('<script src="/assets/ui.js"></script>', '<script>window.IND_TAB="signals"</script><script src="/assets/ui.js"></script>'))
    os.makedirs(os.path.join(ROOT, "signals"), exist_ok=True)
    open(os.path.join(ROOT, "signals", "index.html"), "w", encoding="utf-8").write(sig)
    urls += [f"{SITE}/indicators/", f"{SITE}/signals/"]
    print(f"indicator pages: {len(urls)}")
    return urls


# ---------------------------------------------------------------- learning hub + glossary
LANG_JS = ("(function(){var L;try{L=localStorage.getItem('ck_lang')}catch(e){}L=L||'fa';function ap(l){L=l;try{localStorage.setItem('ck_lang',l)}catch(e){}"
           "document.documentElement.lang=l;document.documentElement.dir=l==='en'?'ltr':'rtl';"
           "document.querySelectorAll('[data-lang]').forEach(function(e){e.hidden=e.dataset.lang!==l});"
           "document.querySelectorAll('.lsw button').forEach(function(b){b.classList.toggle('on',b.dataset.l===l)});"
           "window.dispatchEvent(new CustomEvent('ek-lang',{detail:l}))}window.EKL=function(){return L};"
           "document.querySelectorAll('.lsw').forEach(function(w){w.addEventListener('click',function(e){var b=e.target.closest('button');if(b)ap(b.dataset.l)})});ap(L)})();")
LSW = '<div class="lsw"><button data-l="fa">فارسی</button><button data-l="ckb">کوردی</button><button data-l="en">English</button></div>'
LEARN_CSS = (".lsw{display:flex;gap:6px;margin:6px 0 14px}.lsw button{background:none;border:1px solid var(--line);color:var(--mute);border-radius:99px;padding:5px 12px;cursor:pointer;font:inherit;font-size:.82rem}"
             ".lsw button.on{background:var(--acc);border-color:var(--acc);color:#000;font-weight:800}"
             ".gl{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:10px;margin-top:12px}.gt{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:var(--card)}"
             ".gt h3{margin:0 0 6px;font-size:1rem}.gt p{margin:0;color:#d6d6d0;font-size:.88rem;line-height:1.85}.gt a.more{font-size:.78rem}.gch{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}"
             ".gch button{background:none;border:1px solid var(--line);color:var(--mute);border-radius:99px;padding:4px 11px;cursor:pointer;font:inherit;font-size:.8rem}.gch button.on{border-color:var(--acc);color:var(--ink);background:rgba(247,147,26,.14)}"
             "#gq{width:100%;max-width:520px;background:#000;border:1px solid var(--line);color:var(--ink);border-radius:12px;padding:10px 14px;font:inherit}"
             ".lv{border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:14px 0;background:var(--card)}.lv>h2{margin:0 0 8px}"
             ".ls{border-top:1px solid var(--line);padding:10px 0}.ls summary{cursor:pointer;font-weight:700;list-style:none;display:flex;gap:8px;align-items:center}.ls summary::-webkit-details-marker{display:none}"
             ".ls p{line-height:1.95;color:#dcdcd6}.ls .done{margin-inline-start:auto;font-size:.78rem;color:var(--mute)}.ls.read summary:before{content:'✅'}.ls:not(.read) summary:before{content:'📘'}"
             ".chips a{display:inline-block;margin:2px;padding:2px 9px;border-radius:99px;background:#ffffff10;font-size:.78rem}"
             ".qz{margin-top:12px;border-top:1px dashed var(--line);padding-top:12px}.qq{margin:10px 0}.qq label{display:block;margin:4px 0;cursor:pointer;font-size:.9rem}"
             ".qq.ok{border-inline-start:3px solid #22c55e;padding-inline-start:8px}.qq.no{border-inline-start:3px solid #ef4444;padding-inline-start:8px}"
             ".pbar{height:10px;border-radius:9px;background:#ffffff12;overflow:hidden;margin:8px 0}.pbar i{display:block;height:100%;background:linear-gradient(90deg,#c86f00,#f7931a)}"
             ".btn2{display:inline-block;background:var(--acc);color:#000;border:0;border-radius:99px;padding:8px 16px;font:inherit;font-weight:800;cursor:pointer}"
             ".btn3{display:inline-block;background:none;color:var(--ink);border:1px solid var(--line);border-radius:99px;padding:6px 14px;font:inherit;cursor:pointer}"
             "#cert canvas{max-width:100%;border-radius:12px;margin-top:10px;border:1px solid var(--line)}")
_ZW = re.compile("[‌‍‎‏]")


def _norm(t):
    return _ZW.sub("", (t or "").replace("ي", "ی").replace("ك", "ک")).lower()


def _kw_re(kws):
    parts = [re.escape(_norm(k)) for k in kws if k]
    return re.compile(r"(?<![\w؀-ۿ])(?:" + "|".join(parts) + ")") if parts else None


_PS = sorted(posts, key=lambda p: p.get("date") or "", reverse=True)


def channel_examples(kws, n=5):
    rx = _kw_re(kws)
    if not rx:
        return []
    out = []
    for p in _PS:                                     # newest first
        if p.get("q") == "low" or p.get("kind") in ("promo", "notice"):
            continue
        if rx.search(_norm((p.get("title") or "") + " " + (p.get("text") or ""))):
            out.append(p)
            if len(out) >= n:
                break
    return out


def build_learn():
    """/glossary/, /glossary/<term>/ and /learn/ (learning path with quizzes and a local certificate)"""
    import learn_data as LD
    urls = []
    G = {g[0]: g for g in LD.GLOSSARY}
    def tri(fa, ckb, en, tag="span"):
        return (f'<{tag} data-lang="fa">{fa}</{tag}><{tag} data-lang="ckb" hidden>{ckb}</{tag}>'
                f'<{tag} data-lang="en" hidden dir="ltr">{en}</{tag}>')
    # ---- term pages
    for slug, grp, fat, fad, kt, kd, et, ed, kws in LD.GLOSSARY:
        ex = channel_examples(kws)
        rel = [g for g in LD.GLOSSARY if g[1] == grp and g[0] != slug][:8]
        exh = ("<ul class=list>" + "".join(f'<li><a href="/p/{p["id"]}/">{e(p["title"])}</a> <small class="note">{fmt_date(p.get("date", ""))}</small></li>' for p in ex) + "</ul>"
               if ex else '<p class="note">هنوز مثالی از این اصطلاح در آرشیو کانال پیدا نشد.</p>')
        body = (f'<div class="meta"><a href="/">خانه</a> / <a href="/glossary/">واژه‌نامه</a> / {e(fat)}</div>'
                f'<h1>{e(fat)} <small class="note" dir="ltr">— {e(et)}</small></h1><p class="txt">{e(fad)}</p>'
                f'<h2 lang="ckb">کوردی: {e(kt)}</h2><p class="txt" lang="ckb">{e(kd)}</p>'
                f'<h2 dir="ltr" lang="en">English: {e(et)}</h2><p class="txt" dir="ltr" lang="en">{e(ed)}</p>'
                f'<h2>نمونه‌هایی از کانال Coin_Kurd</h2>{exh}'
                '<h2>اصطلاحات مرتبط</h2><p class="chips">' + "".join(f'<a href="/glossary/{g[0]}/">{e(g[2])}</a>' for g in rel) + '</p>'
                '<p class="note"><a href="/learn/">🎓 مسیر یادگیری گام‌به‌گام</a> · <a href="/glossary/">همهٔ اصطلاحات</a> · آموزشی است، توصیهٔ مالی نیست.</p>')
        ld = {"@context": "https://schema.org", "@type": "DefinedTerm", "name": fat, "alternateName": [et, kt], "description": fad,
              "inDefinedTermSet": f"{SITE}/glossary/", "url": f"{SITE}/glossary/{slug}/"}
        urls.append(page(f"glossary/{slug}/", f"{fat} ({et}) — معنی و توضیح ساده", fad[:155], body,
                         f'<script type="application/ld+json">{sj(ld)}</script><style>{LEARN_CSS}</style>'))
    # ---- glossary hub (interactive: search, group filter, language)
    cards = "".join(
        f'<div class="gt" data-g="{g[1]}" data-s="{e(_norm(" ".join([g[2], g[4], g[6], g[3]])))}"><h3><a href="/glossary/{g[0]}/">{tri(e(g[2]), e(g[4]), e(g[6]))}</a></h3>'
        f'<p>{tri(e(g[3]), e(g[5]), e(g[7]))}</p><a class="more" href="/glossary/{g[0]}/">{tri("نمونه از کانال ←", "نموونە لە کەناڵ ←", "Channel examples →")}</a></div>'
        for g in LD.GLOSSARY)
    chips = '<button class="on" data-g="">' + tri("همه", "هەموو", "All") + "</button>" + "".join(
        f'<button data-g="{k}">{tri(e(v["fa"]), e(v["ckb"]), e(v["en"]))}</button>' for k, v in LD.GROUPS.items())
    hub = (f'<h1>{tri("واژه‌نامهٔ تعاملی کریپتو", "فەرهەنگی کارلێکەری کریپتۆ", "Interactive crypto glossary")}</h1>{LSW}'
           f'<p class="txt">{tri(f"{len(LD.GLOSSARY)} اصطلاح ضروری بازار کریپتو به زبان ساده، به سه زبان — هر کدام با نمونه‌های واقعی از پست‌های کانال Coin_Kurd.", f"{len(LD.GLOSSARY)} زاراوەی پێویستی بازاڕی کریپتۆ بە زمانێکی سادە، بە سێ زمان — هەریەکە بە نموونەی ڕاستەقینە لە کەناڵی Coin_Kurd.", f"{len(LD.GLOSSARY)} essential crypto terms in plain language, in three languages — each with real examples from Coin_Kurd channel posts.")}</p>'
           '<input id="gq" type="search" placeholder="🔎 جستجو… / Search…" autocomplete="off"><div class="gch" id="gch">' + chips + '</div>'
           f'<div class="gl" id="gl">{cards}</div><p class="note" id="gn"></p><p class="note"><a href="/learn/">🎓 مسیر یادگیری</a> · آموزشی است، توصیهٔ مالی نیست.</p>')
    gjs = ("(function(){var q=document.getElementById('gq'),G='';function nz(t){return (t||'').replace(/[\\u200c-\\u200f]/g,'').replace(/ي/g,'ی').replace(/ك/g,'ک').toLowerCase()}"
           "function f(){var s=nz(q.value),n=0;document.querySelectorAll('.gt').forEach(function(c){var v=(!G||c.dataset.g===G)&&(!s||c.dataset.s.indexOf(s)>=0);c.hidden=!v;if(v)n++});document.getElementById('gn').textContent=n+' / " + str(len(LD.GLOSSARY)) + "'}"
           "q.addEventListener('input',f);document.getElementById('gch').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;G=b.dataset.g;"
           "document.querySelectorAll('#gch button').forEach(function(x){x.classList.toggle('on',x===b)});f()});f()})();")
    urls.append(page("glossary/", "واژه‌نامهٔ تعاملی کریپتو — اصطلاحات بازار به زبان ساده", "اصطلاحات ضروری کریپتو و تحلیل تکنیکال به فارسی، کوردی و انگلیسی با نمونه‌های واقعی از کانال Coin_Kurd",
                     hub, f"<style>{LEARN_CSS}</style><script>document.addEventListener('DOMContentLoaded',function(){{{LANG_JS}{gjs}}})</script>"))
    # ---- learning path
    lv_html = []
    for lv in LD.LEVELS:
        ls_html = []
        for (lvl, slug, tt, bd, terms, kws, link) in [x for x in LD.LESSONS if x[0] == lv["id"]]:
            ex = channel_examples(kws, 3)
            paras = "".join(tri(e(a), e(b), e(c), "p") for a, b, c in zip(bd["fa"], bd["ckb"] + [""] * 9, bd["en"]))
            chips = '<p class="chips">' + "".join(f'<a href="/glossary/{t}/">{tri(e(G[t][2]), e(G[t][4]), e(G[t][6]))}</a>' for t in terms) + "</p>"
            exh = ('<p class="note">' + tri("از کانال:", "لە کەناڵ:", "From the channel:") + " " + " · ".join(f'<a href="/p/{p["id"]}/">{e(p["title"][:70])}</a>' for p in ex) + "</p>") if ex else ""
            lk = f'<p><a class="btn3" href="{link[0]}">🔗 {tri(e(link[1]["fa"]), e(link[1]["ckb"]), e(link[1]["en"]))}</a></p>' if link else ""
            ls_html.append(f'<details class="ls" data-ls="{slug}"><summary>{tri(e(tt["fa"]), e(tt["ckb"]), e(tt["en"]))}<span class="done"></span></summary>{paras}{chips}{exh}{lk}'
                           f'<p><button class="btn3 rd" data-ls="{slug}">{tri("✔ خواندم", "✔ خوێندمەوە", "✔ Mark as read")}</button></p></details>')
        qs = LD.QUIZ[lv["id"]]
        qh = "".join(f'<div class="qq" data-a="{a}"><p><b>{i + 1}.</b> {tri(e(q["fa"]), e(q["ckb"]), e(q["en"]))}</p>' + "".join(
            f'<label><input type="radio" name="{lv["id"]}q{i}" value="{j}"> {tri(e(o["fa"][j]), e(o["ckb"][j]), e(o["en"][j]))}</label>' for j in range(len(o["fa"]))) + "</div>"
            for i, (q, o, a) in enumerate(qs))
        lv_html.append(f'<section class="lv" id="{lv["id"]}"><h2>{lv["icon"]} {tri(e(lv["fa"]), e(lv["ckb"]), e(lv["en"]))}</h2>{"".join(ls_html)}'
                       f'<div class="qz"><h3>{tri("آزمون این سطح", "تاقیکردنەوەی ئەم ئاستە", "Level quiz")} <small class="note">{tri("قبولی: ۴ از ۵", "دەرچوون: ٤ لە ٥", "Pass: 4 of 5")}</small></h3>{qh}'
                       f'<button class="btn2 qchk" data-lv="{lv["id"]}">{tri("بررسی پاسخ‌ها", "پشکنینی وەڵامەکان", "Check answers")}</button> <span class="qres" data-lv="{lv["id"]}"></span></div></section>')
    body = (f'<h1>{tri("🎓 مسیر یادگیری کریپتو — از صفر تا پیشرفته", "🎓 ڕێڕەوی فێربوونی کریپتۆ — لە سفرەوە تا پێشکەوتوو", "🎓 Crypto learning path — from zero to advanced")}</h1>{LSW}'
            f'<p class="txt">{tri("سه سطح، دوازده درس کوتاه، با اصطلاحات واژه‌نامه و نمونه‌های واقعی از کانال Coin_Kurd. هر سطح یک آزمون پنج‌سؤالی دارد؛ با قبولی در هر سه سطح گواهی پایان مسیر را دریافت می‌کنید. پیشرفت فقط در مرورگر خودتان ذخیره می‌شود.", "سێ ئاست، دوازدە وانەی کورت، بە زاراوەکانی فەرهەنگ و نموونەی ڕاستەقینە لە کەناڵی Coin_Kurd. هەر ئاستێک تاقیکردنەوەیەکی پێنج پرسیاری هەیە؛ بە دەرچوون لە هەر سێ ئاست بڕوانامەی کۆتایی وەردەگریت. پێشکەوتن تەنها لە وێبگەڕەکەتدا هەڵدەگیرێت.", "Three levels, twelve short lessons, with glossary terms and real examples from the Coin_Kurd channel. Each level has a five-question quiz; pass all three to get your completion certificate. Progress is stored only in your own browser.")}</p>'
            f'<div class="pbar"><i id="pb" style="width:0"></i></div><p class="note" id="pt"></p>{"".join(lv_html)}'
            f'<section class="lv" id="cert"><h2>🏅 {tri("گواهی پایان مسیر", "بڕوانامەی کۆتایی ڕێڕەو", "Completion certificate")}</h2><div id="certIn"></div></section>'
            f'<p class="note"><a href="/glossary/">📖 {tri("واژه‌نامهٔ کامل", "فەرهەنگی تەواو", "Full glossary")}</a> · {tri("آموزشی است، توصیهٔ مالی نیست.", "فێرکارییە، ئامۆژگاریی دارایی نییە.", "Educational, not financial advice.")}</p>')
    ljs = r"""(function(){var K='ek_learn',S;try{S=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){S={}}S.read=S.read||{};S.pass=S.pass||{};
function sv(){try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}
var TX={fa:{rd:'خوانده شد',pass:'قبول شدید',fail:'دوباره تلاش کنید',of:'از',lessons:'درس خوانده شده',levels:'سطح قبول شده',locked:'برای دریافت گواهی باید در آزمون هر سه سطح قبول شوید.',name:'نام شما روی گواهی',make:'ساخت گواهی',dl:'دانلود گواهی',t1:'گواهی پایان مسیر یادگیری کریپتو',t2:'این گواهی تأیید می‌کند که',t3:'سه سطح مبتدی، تحلیل تکنیکال و پیشرفته را با موفقیت گذرانده است',t4:'گواهی آموزشی entekhab.net — مدرک رسمی نیست'},
ckb:{rd:'خوێندرایەوە',pass:'دەرچوویت',fail:'دووبارە هەوڵ بدەرەوە',of:'لە',lessons:'وانەی خوێندراو',levels:'ئاستی دەرچوو',locked:'بۆ وەرگرتنی بڕوانامە دەبێت لە تاقیکردنەوەی هەر سێ ئاست دەربچیت.',name:'ناوت لەسەر بڕوانامە',make:'دروستکردنی بڕوانامە',dl:'داگرتنی بڕوانامە',t1:'بڕوانامەی کۆتایی ڕێڕەوی فێربوونی کریپتۆ',t2:'ئەم بڕوانامەیە پشتڕاستی دەکاتەوە کە',t3:'سێ ئاستی سەرەتایی، شیکاریی تەکنیکی و پێشکەوتووی بە سەرکەوتوویی تەواو کردووە',t4:'بڕوانامەی فێرکاریی entekhab.net — بڕوانامەی فەرمی نییە'},
en:{rd:'read',pass:'Passed',fail:'Try again',of:'of',lessons:'lessons read',levels:'levels passed',locked:'Pass all three level quizzes to unlock your certificate.',name:'Your name on the certificate',make:'Create certificate',dl:'Download certificate',t1:'Crypto Learning Path — Certificate of Completion',t2:'This certifies that',t3:'has successfully completed the Beginner, Technical Analysis and Advanced levels',t4:'An entekhab.net learning certificate — not an official qualification'}};
function T(k){var l=(window.EKL&&EKL())||'fa';return (TX[l]||TX.fa)[k]}
var LS=[].slice.call(document.querySelectorAll('details.ls')),LV=['l1','l2','l3'];
function upd(){var r=0;LS.forEach(function(d){var on=!!S.read[d.dataset.ls];d.classList.toggle('read',on);if(on)r++;d.querySelector('.done').textContent=on?T('rd'):''});
 var p=LV.filter(function(l){return S.pass[l]>=4}).length,tot=LS.length+LV.length;document.getElementById('pb').style.width=Math.round((r+p)*100/tot)+'%';
 document.getElementById('pt').textContent=r+' '+T('of')+' '+LS.length+' '+T('lessons')+' · '+p+' '+T('of')+' 3 '+T('levels');
 LV.forEach(function(l){var el=document.querySelector('.qres[data-lv="'+l+'"]');if(S.pass[l]!=null&&!el.dataset.fresh)el.textContent=(S.pass[l]>=4?'✅ '+T('pass'):'↻ '+T('fail'))+' ('+S.pass[l]+'/5)'});cert(p===3)}
document.addEventListener('click',function(e){var b=e.target.closest('.rd');if(b){S.read[b.dataset.ls]=1;sv();var d=b.closest('details');d.open=false;upd();return}
 var q=e.target.closest('.qchk');if(q){var l=q.dataset.lv,sc=0;document.querySelectorAll('#'+l+' .qq').forEach(function(x,i){var c=x.querySelector('input:checked'),ok=c&&+c.value===+x.dataset.a;if(ok)sc++;x.classList.toggle('ok',!!ok);x.classList.toggle('no',!ok)});
  S.pass[l]=Math.max(S.pass[l]||0,sc);sv();var el=document.querySelector('.qres[data-lv="'+l+'"]');el.dataset.fresh=1;el.textContent=(sc>=4?'✅ '+T('pass'):'↻ '+T('fail'))+' ('+sc+'/5)';upd()}});
function cert(open){var box=document.getElementById('certIn');if(!open){box.innerHTML='<p class="note">🔒 '+T('locked')+'</p>';return}
 if(box.dataset.ready===((window.EKL&&EKL())||'fa'))return;box.dataset.ready=(window.EKL&&EKL())||'fa';
 box.innerHTML='<p><input id="cn" maxlength="40" placeholder="'+T('name')+'" style="background:#000;border:1px solid var(--line);color:var(--ink);border-radius:10px;padding:8px 12px;font:inherit;min-width:min(100%,260px)"> <button class="btn2" id="cm">🏅 '+T('make')+'</button></p><div id="co"></div>';
 document.getElementById('cm').onclick=function(){var n=(document.getElementById('cn').value||'').trim().slice(0,40);if(!n)return;var l=(window.EKL&&EKL())||'fa',rtl=l!=='en';
  var cv=document.createElement('canvas');cv.width=1600;cv.height=1130;var x=cv.getContext('2d');var g=x.createLinearGradient(0,0,1600,1130);g.addColorStop(0,'#1a1006');g.addColorStop(.5,'#0b0c0f');g.addColorStop(1,'#071018');x.fillStyle=g;x.fillRect(0,0,1600,1130);
  x.strokeStyle='#f7931a';x.lineWidth=6;x.strokeRect(40,40,1520,1050);x.strokeStyle='rgba(247,147,26,.35)';x.lineWidth=2;x.strokeRect(62,62,1476,1006);
  var img=new Image();img.onload=function(){var h=230,w=img.width*h/img.height;x.drawImage(img,800-w/2,95,w,h);fin()};img.onerror=fin;img.src='/assets/logo-hero.webp';
  function fin(){x.textAlign='center';x.direction=rtl?'rtl':'ltr';x.fillStyle='#f7931a';x.font='800 50px Vazirmatn,Tahoma,sans-serif';x.fillText(T('t1'),800,400);
   x.fillStyle='#cfcfcf';x.font='400 34px Vazirmatn,Tahoma,sans-serif';x.fillText(T('t2'),800,480);x.fillStyle='#fff';x.font='900 76px Vazirmatn,Tahoma,sans-serif';x.fillText(n,800,590);
   x.fillStyle='#cfcfcf';x.font='400 32px Vazirmatn,Tahoma,sans-serif';x.fillText(T('t3'),800,670);
   var d=new Date();x.fillStyle='#9a9a94';x.font='400 28px Vazirmatn,Tahoma,sans-serif';x.fillText(d.toLocaleDateString(l==='en'?'en-GB':l==='ckb'?'ar-IQ':'fa-IR',{year:'numeric',month:'long',day:'numeric'}),800,770);
   x.fillText('L1 '+S.pass.l1+'/5 · L2 '+S.pass.l2+'/5 · L3 '+S.pass.l3+'/5',800,820);x.fillStyle='#f7931a';x.font='700 40px "Space Grotesk",sans-serif';x.direction='ltr';x.fillText('entekhab.net/learn',800,960);
   x.fillStyle='#777';x.font='400 22px Vazirmatn,Tahoma,sans-serif';x.direction=rtl?'rtl':'ltr';x.fillText(T('t4'),800,1010);
   var u=cv.toDataURL('image/png'),o=document.getElementById('co');o.innerHTML='';o.appendChild(cv);var a=document.createElement('a');a.className='btn2';a.download='entekhab-certificate.png';a.href=u;a.textContent='⬇ '+T('dl');a.style.marginTop='10px';o.appendChild(a)}}}
addEventListener('ek-lang',function(){var b=document.getElementById('certIn');if(b)b.dataset.ready='';upd()});upd();
if(location.hash){var t=document.querySelector(location.hash);if(t&&t.tagName==='DETAILS')t.open=true}})();"""
    ld = {"@context": "https://schema.org", "@type": "Course", "name": "مسیر یادگیری کریپتو — entekhab.net", "description": "سه سطح آموزش کریپتو و تحلیل تکنیکال با آزمون و گواهی",
          "provider": {"@type": "Organization", "name": "entekhab.net", "sameAs": "https://t.me/Coin_Kurd"}, "inLanguage": ["fa", "ckb", "en"], "isAccessibleForFree": True}
    urls.append(page("learn/", "مسیر یادگیری کریپتو — آموزش رایگان از مبتدی تا پیشرفته با آزمون و گواهی", "سه سطح آموزش کریپتو و تحلیل تکنیکال به فارسی، کوردی و انگلیسی: درس‌های کوتاه، واژه‌نامه، نمونه‌های واقعی کانال Coin_Kurd، آزمون و گواهی",
                     body, f'<script type="application/ld+json">{sj(ld)}</script><style>{LEARN_CSS}</style>'
                           f"<script>document.addEventListener('DOMContentLoaded',function(){{{LANG_JS}{ljs}}})</script>"))
    print(f"learn pages: {len(urls)}")
    return urls


if __name__ == "__main__":
    main()
    build_api()
    extra = prerender()
    extra += build_dna()
    extra += build_weekly()
    extra += build_compare()
    extra += build_indicators()
    extra += build_daily()
    extra += build_feeds()
    extra += build_hub()
    extra += build_seo_extra()
    extra += build_learn()
    try:  # CRYPTO MASTER ACADEMY (/academy/) — never allowed to break the rest of the site build
        import build_academy
        extra += build_academy.build()
    except Exception as ex:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print("academy build failed:", ex)
    try:  # Chrome extension download page (/extension/)
        import build_extension
        extra += build_extension.build()
    except Exception as ex:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print("extension page failed:", ex)
    try:
        import build_psych
        build_psych.build()
    except Exception as ex:                                   # noqa: BLE001
        print("psychology page failed:", ex)
    print("chrome:", chrome.inject_static())   # keep the shared header/footer identical on the hand-written pages too
    sm = os.path.join(ROOT, "sitemap.xml")
    s = open(sm, encoding="utf-8").read().replace("</urlset>", "".join(f"<url><loc>{e(u)}</loc></url>" for u in extra) + "</urlset>")
    open(sm, "w", encoding="utf-8").write(s)
