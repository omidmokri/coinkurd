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
          "volume_spike": "جهش حجم معاملات"}
e = html.escape
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
header .w{display:flex;justify-content:space-between;align-items:center;gap:12px}.logo{font-family:'Space Grotesk',monospace;font-weight:700;color:var(--ink)}.logo b{color:var(--acc)}
nav a{color:var(--mute);margin-inline-start:16px;font-size:.9rem}main{padding:32px 0 60px}
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


def page(path, title, desc, body, extra_head="", lang="fa"):
    url = f"{SITE}/{path}"
    doc = f"""<!doctype html><html lang="{lang}" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} | entekhab.net</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{url}">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{url}"><meta property="og:site_name" content="entekhab.net">
<meta name="theme-color" content="#f7931a"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23f7931a'/><text x='50' y='72' text-anchor='middle' font-size='64' font-weight='900' font-family='Arial'>₿</text></svg>">
<style>{CSS}</style>{extra_head}</head><body>
<header><div class="w"><a class="logo" href="/">entekhab<b>.net</b></a><nav><a href="/#feed">آرشیو</a><a href="/coins/">کوین‌ها</a><a href="/dashboard/">داشبورد بازار</a><a href="https://t.me/Coin_Kurd" rel="noopener">تلگرام</a></nav></div></header>
<main class="w">{body}</main>
<footer><div class="w">© entekhab.net — داده‌ها به‌صورت خودکار از کانال <a href="https://t.me/Coin_Kurd">Coin_Kurd</a>، Binance، CoinGecko و alternative.me به‌روز می‌شوند. هیچ‌یک از مطالب توصیهٔ مالی نیست.</div></footer></body></html>"""
    full = os.path.join(ROOT, path, "index.html") if path else os.path.join(ROOT, "index.html")
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w", encoding="utf-8").write(doc)
    return url


def impact_html(im):
    if not im:
        return ""
    def cls(v):
        return "up" if v and v > 0 else "down" if v and v < 0 else ""
    cells = "".join(f'<div class="kpi"><small>{lbl}</small><b class="{cls(im.get(k))}">{"—" if im.get(k) is None else f"{im[k]:+.2f}%"}</b></div>'
                    for k, lbl in (("r1h", "۱ ساعت بعد"), ("r4h", "۴ ساعت بعد"), ("r24h", "۲۴ ساعت بعد"), ("mfe", "بیشترین رشد ۲۴h"), ("mae", "بیشترین افت ۲۴h")))
    s = f'<h2>حرکت قیمت {e(im["coin"])} بعد از انتشار</h2><div class="grid"><div class="kpi"><small>قیمت لحظهٔ انتشار</small><b>{fmt_price(im["p0"])}</b></div>{cells}</div>'
    if im.get("signal"):
        sg = im["signal"]
        res = {"tp1": "✅ هدف اول لمس شد", "stop": "❌ حد ضرر فعال شد", "open": "⏳ هنوز باز", "ambiguous": "⚠️ هدف و حد ضرر در یک کندل"}[sg["result"]]
        s += f'<p class="txt">سیگنال {"لانگ" if sg["side"] == "long" else "شورت"} — ورود {sg["entry"]} · حد ضرر {sg["sl"] or "—"} · اهداف {", ".join(map(str, sg["tps"])) or "—"} → <b>{res}</b></p>'
    s += '<p class="note">محاسبه با کندل‌های ۱ ساعتهٔ Binance؛ نتیجهٔ گذشته تضمینی برای آینده نیست.</p>'
    return s


def build_post(p):
    cat = CATS.get(p["category"], {"name": {"fa": p["category"]}, "icon": ""})
    tr = p.get("tr") or {}
    title = p["title"]
    desc = plain(p["text"]) or title
    img = p["photos"][0] if p.get("photos") else ""
    coins = "".join(f'<a class="pill" href="/coins/{c.lower()}/">{c}</a>' for c in p.get("coins", []))
    body = f'<div class="meta"><span class="pill">{cat.get("icon","")} {e(cat["name"].get("fa",""))}</span>{coins}<time datetime="{p.get("date","")}">{fmt_date(p.get("date",""))}</time><span>👁 {e(p.get("views") or "—")}</span></div>'
    body += f'<h1>{e(title)}</h1>'
    if img:
        body += f'<img class="img" src="{e(img)}" alt="{e(title)}" loading="lazy">'
    body += f'<div class="txt">{rich(p["text"])}</div>'
    for lg, lbl in (("ckb", "کوردی (سۆرانی)"), ("en", "English")):
        if tr.get(lg):
            d = ' dir="ltr"' if lg == "en" else ""
            body += f'<details{d} lang="{lg}"><summary>{lbl}: {e(tr[lg]["title"])}</summary><div class="txt">{rich(tr[lg]["text"])}</div></details>'
    if p.get("footer"):
        ic = lambda u: "👾 " if "discord" in u else "🎥 " if "youtu" in u else "📸 " if "instagram" in u else "💬 " if "twitter" in u or "x.com" in u else ""  # noqa: E731
        body += '<div class="social">' + "".join(f'<a href="{e(f["url"])}" rel="noopener" target="_blank">{ic(f["url"])}{e(f["label"])}</a>' for f in p["footer"]) + "</div>"
    body += impact_html(impact.get(str(p["id"])))
    body += f'<p class="note"><a href="{e(p["url"])}">مشاهدهٔ این پست در تلگرام ↗</a> · <a href="/#p{p["id"]}">نمایش در آرشیو</a></p>'
    ld = {"@context": "https://schema.org", "@type": "NewsArticle", "headline": title[:110], "datePublished": p.get("date"),
          "inLanguage": ["fa"] + [k for k in ("ckb", "en") if tr.get(k)], "image": [img] if img else [],
          "author": {"@type": "Organization", "name": "Coin_Kurd", "url": "https://t.me/Coin_Kurd"},
          "publisher": {"@type": "Organization", "name": "entekhab.net", "url": SITE},
          "mainEntityOfPage": f"{SITE}/p/{p['id']}/", "description": desc, "about": p.get("coins", [])}
    head = f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>'
    if img:
        head += f'<meta property="og:image" content="{e(img)}"><meta name="twitter:card" content="summary_large_image">'
    return page(f"p/{p['id']}/", title, desc, body, head)


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
    body = f'<div class="meta"><a href="/coins/">کوین‌ها</a> / {c}</div><h1>{e(name)} ({c})</h1>'
    tv = TV.get(c, f"BINANCE:{c}USDT")
    body += f'''<div class="tv"><div class="tradingview-widget-container" style="height:100%"><div class="tradingview-widget-container__widget" style="height:100%"></div>
<script src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>{json.dumps({"autosize": True, "symbol": tv, "interval": "60", "theme": "dark", "style": "1", "locale": "en", "backgroundColor": "rgba(18,18,18,1)", "allow_symbol_change": False, "save_image": False, "support_host": "https://www.tradingview.com"})}</script></div></div>'''
    body += '<h2>وضعیت تکنیکال (۱ ساعته)</h2>'
    if m:
        tr = {"up": "صعودی", "down": "نزولی", "range": "خنثی / رنج"}[m["trend"]]
        ch = m.get("chg24")
        body += f'''<div class="grid"><div class="kpi"><small>قیمت (هنگام ساخت صفحه)</small><b>{fmt_price(m["price"])}</b></div>
<div class="kpi"><small>تغییر ۲۴ ساعته</small><b class="{"up" if (ch or 0) > 0 else "down"}">{"—" if ch is None else f"{ch:+.2f}%"}</b></div>
<div class="kpi"><small>RSI 14</small><b>{m["rsi"]}</b></div><div class="kpi"><small>روند (EMA20/50)</small><b>{tr}</b></div>
<div class="kpi"><small>سقف ۴۸ ساعت</small><b>{fmt_price(m["hi48"])}</b></div><div class="kpi"><small>کف ۴۸ ساعت</small><b>{fmt_price(m["lo48"])}</b></div></div>
<p class="note">به‌روزرسانی: {fmt_date(market.get("updated_at",""))} — منبع Binance. قیمت لحظه‌ای را در نمودار بالا ببینید.</p>'''
        opps = [o for o in market.get("opportunities", []) if o["coin"] == c]
        if opps:
            body += "<h2>فرصت‌های کشف‌شده توسط اسکنر</h2><ul class=list>" + "".join(
                f'<li>{OPP_FA.get(o["type"], o["type"])} · قدرت {o["strength"]} · اطمینان {"بالا" if o["confidence"] == "high" else "متوسط"}<small>تایم‌فریم {o["tf"]} — صرفاً یافتهٔ تکنیکال، نه توصیهٔ خرید/فروش</small></li>' for o in opps) + "</ul>"
    else:
        body += '<p class="note">دادهٔ بازار Binance برای این دارایی در دسترس نیست.</p>'
    ims = [impact[str(p["id"])] for p in cposts if str(p["id"]) in impact and impact[str(p["id"])].get("r24h") is not None]
    body += f'<h2>حضور در کانال</h2><div class="grid"><div class="kpi"><small>۲۴ ساعت</small><b>{n24}</b></div><div class="kpi"><small>۷ روز</small><b>{n7}</b></div><div class="kpi"><small>۳۰ روز</small><b>{n30}</b></div><div class="kpi"><small>کل آرشیو</small><b>{len(cposts)}</b></div></div>'
    if ims:
        avg = sum(x["r24h"] for x in ims) / len(ims)
        upn = sum(1 for x in ims if x["r24h"] > 0)
        body += f'<h2>کارنامهٔ پست‌ها</h2><p class="txt">در {len(ims)} پست اخیر دربارهٔ {c}، قیمت ۲۴ ساعت بعد از انتشار به‌طور میانگین <b class="{"up" if avg > 0 else "down"}">{avg:+.2f}%</b> حرکت کرد و در {upn} مورد ({upn*100//len(ims)}٪) بالاتر بود.</p>'
    body += "<h2>آخرین مطالب</h2><ul class=list>" + "".join(
        f'<li><a href="/p/{p["id"]}/">{e(p["title"])}</a><small>{fmt_date(p.get("date",""))} · {e(CATS.get(p["category"],{}).get("name",{}).get("fa",""))}</small></li>' for p in cposts[:60]) + "</ul>"
    desc = f"{name}: قیمت زنده، تحلیل تکنیکال، فرصت‌های اسکنر و {len(cposts)} مطلب مرتبط در entekhab.net"
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": f"{name} ({c})", "about": {"@type": "Thing", "name": name}, "url": f"{SITE}/coins/{c.lower()}/"}
    return page(f"coins/{c.lower()}/", f"{name} ({c}) — قیمت، تحلیل و اخبار", desc, body, f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')


def main():
    urls = [(f"{SITE}/", None)]
    by_coin = {}
    for p in posts:
        for c in p.get("coins", []):
            by_coin.setdefault(c, []).append(p)
    for p in posts:
        urls.append((build_post(p), p.get("date")))
    for c in set(by_coin) | set(MK):
        urls.append((build_coin(c, by_coin.get(c, [])), market.get("updated_at")))
    order = sorted(set(by_coin) | set(MK), key=lambda c: -len(by_coin.get(c, [])))
    body = "<h1>کوین‌ها</h1><p class=txt>پروفایل هر دارایی با قیمت زنده، وضعیت تکنیکال، فرصت‌های اسکنر و مطالب مرتبط.</p><div class=coins>" + "".join(
        f'<a href="/coins/{c.lower()}/">{c} <small style="color:#9a9a94">{len(by_coin.get(c, []))}</small></a>' for c in order) + "</div>"
    urls.append((page("coins/", "کوین‌ها — پروفایل ارزهای دیجیتال", "فهرست ارزهای دیجیتال با قیمت زنده، تحلیل و آرشیو مطالب", body), market.get("updated_at")))
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u, d in urls:
        lm = f"<lastmod>{d[:10]}</lastmod>" if d else ""
        sm.append(f"<url><loc>{e(u)}</loc>{lm}</url>")
    sm.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(sm))
    open(os.path.join(ROOT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
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
                  + f'<table class="otab"><tr>{coins}</tr></table><p class="disc">Binance · {fmt_date(m.get("updated_at",""))} · یافته‌های تکنیکال خودکارند و توصیهٔ خرید یا فروش نیستند.</p>')
    by = {}
    for r in impact.values():
        if r.get("r24h") is not None:
            by.setdefault(r["coin"], []).append(r["r24h"])
    rws = ""
    for c, a in sorted(by.items(), key=lambda kv: -len(kv[1]))[:10]:
        if len(a) < 2:
            continue
        av = sum(a) / len(a)
        rws += f'<tr><td><a href="/coins/{c.lower()}/">{c}</a></td><td class="num">{len(a)}</td><td class="num">{av:+.2f}%</td><td class="num">{sum(1 for x in a if x > 0)*100//len(a)}%</td></tr>'
    out["imp"] = '<h3>کارنامهٔ پست‌ها: حرکت قیمت ۲۴ ساعت بعد از انتشار</h3>' + (f'<table class="otab"><tr><th>کوین</th><th>پست</th><th>میانگین ۲۴h</th><th>درصد مثبت</th></tr>{rws}</table>' if rws else '<p class="disc">داده هنوز کافی نیست.</p>') + '<p class="disc">Binance 1h</p>'
    h = load("health.json", {})
    out["fresh"] = f'<span>اسکنر: {fmt_date(m.get("updated_at",""))}</span><span>آرشیو تلگرام: {fmt_date(meta.get("updated_at",""))}</span><span>سلامت سیستم: {e(h.get("status","—"))}</span>'
    return out


def post_li(p):
    cat = CATS.get(p["category"], {}).get("name", {}).get("fa", "")
    return f'<li><a href="/p/{p["id"]}/">{e(p["title"])}</a><small>{fmt_date(p.get("date",""))} · {e(cat)} · {" ".join(p.get("coins", [])[:4])}</small></li>'


def prerender():
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
        '<b id="nextTitle" dir="auto">…</b>': f'<b id="nextTitle" dir="auto">{e(posts[0]["title"]) if posts else "…"}</b>',
        '<div class="fresh" id="fresh"></div>': f'<div class="fresh" id="fresh">{it["fresh"]}</div>',
        '<div class="ibox" id="fngBox"></div>': f'<div class="ibox" id="fngBox">{it.get("fng","")}</div>',
        '<div class="ibox" id="globBox"></div>': f'<div class="ibox" id="globBox">{it.get("glob","")}</div>',
        '<div class="ibox wide" id="oppBox"></div>': f'<div class="ibox wide" id="oppBox">{it["opp"]}</div>',
        '<div class="ibox wide" id="impBox"></div>': f'<div class="ibox wide" id="impBox">{it["imp"]}</div>',
        '<div class="hall" id="hallGrid"></div>': '<div class="hall" id="hallGrid">' + "".join(
            f'<a class="tile" href="/categories/{c["id"]}/" style="--c:{c["color"]}"><span class="ic">{c["icon"]}</span><div><b>{e(c["name"]["fa"])}</b><small>{meta["by_category"].get(c["id"],0)}</small></div></a>'
            for c in meta.get("categories", []) if meta.get("by_category", {}).get(c["id"])) + "</div>",
        '<div class="wrap" id="out"></div>': '<div class="wrap" id="out"><ul class="list">' + "".join(post_li(p) for p in posts[:40]) + '</ul><p><a href="/sitemap.xml">همهٔ مطالب</a></p></div>',
    }
    miss = [k for k in reps if k not in s]
    for k, v in reps.items():
        s = s.replace(k, v, 1)
    open(idx, "w", encoding="utf-8").write(s)
    # /dashboard/
    css_x = ".big{font-size:2.4rem;font-weight:700;font-family:'Space Grotesk',monospace}.otab{width:100%;border-collapse:collapse}.otab td,.otab th{padding:8px;border-bottom:1px solid var(--line);text-align:start}.num{direction:ltr;unicode-bidi:isolate}.disc{color:var(--mute);font-size:.8rem}.fresh span{border:1px solid var(--line);border-radius:999px;padding:3px 10px;margin:3px;display:inline-block;font-size:.8rem;color:var(--mute)}.ibox{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px;margin:10px 0}"
    body = f'<h1>داشبورد هوشمند بازار</h1><div class="fresh">{it["fresh"]}</div>' + "".join(f'<div class="ibox">{it.get(k,"")}</div>' for k in ("fng", "glob", "opp", "imp"))
    urls = [page("dashboard/", "داشبورد هوشمند بازار کریپتو", "اسکنر خودکار فرصت‌ها، شاخص ترس و طمع، وضعیت کل بازار و کارنامهٔ واقعی تحلیل‌ها", body, f"<style>{css_x}</style>")]
    # /categories/<id>/
    for c in meta.get("categories", []):
        ps = [p for p in posts if p["category"] == c["id"]]
        if not ps:
            continue
        body = f'<div class="meta"><a href="/">خانه</a> / دسته‌ها</div><h1>{c["icon"]} {e(c["name"]["fa"])}</h1><p class="note">{e(c["name"].get("ckb",""))} · {e(c["name"].get("en",""))} — {len(ps)} مطلب</p><ul class="list">' + "".join(post_li(p) for p in ps[:200]) + "</ul>"
        urls.append(page(f"categories/{c['id']}/", f'{c["name"]["fa"]} — {c["name"].get("en","")}', f'آرشیو مطالب دستهٔ {c["name"]["fa"]} در entekhab.net', body))
    print(f"prerendered index (missing placeholders: {miss}); extra pages {len(urls)}")
    return urls


if __name__ == "__main__":
    main()
    extra = prerender()
    sm = os.path.join(ROOT, "sitemap.xml")
    s = open(sm, encoding="utf-8").read().replace("</urlset>", "".join(f"<url><loc>{e(u)}</loc></url>" for u in extra) + "</urlset>")
    open(sm, "w", encoding="utf-8").write(s)
