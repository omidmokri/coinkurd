"""
Emergency proxy section, version 2 (the original bot_proxy.py is kept untouched as a fallback).

What is new compared with bot_proxy.py:
  * several public sources instead of one (each read through t.me/s like every other feed),
    parsing both t.me/proxy links and "Server: … Port: … Secret: …" text posts;
  * the admins can register several of the channel's own proxies (/addproxy, /delproxy);
  * a reachability score that uses what really matters — reports from users INSIDE Iran
    (👍/👎 under each proxy, per operator: MCI, Irancell, TCI, Rightel, Wi-Fi…) —
    combined with the outside TCP check, connect time, fake-TLS and port 443;
    reports decay with a 6-hour half-life so the list follows the filtering of the day;
  * the last good list is kept in the bot state, so the section still works when the
    source channels can't be read;
  * a "share" message: plain proxy links that can be forwarded to family or copied
    into any other app.
"""
import hashlib
import re
import socket
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

import bot_iran as IR
from bot_i18n import pick

SOURCES = [s.strip() for s in __import__("os").environ.get(
    "PROXY_SOURCES", "tavanaproxy,Proxy_Qavi,ProxyMTProto,Myporoxy,mtpro_xyz").split(",") if s.strip()]
MAX_SHOW = 8
CACHE_S = 900
HALF_LIFE = 6 * 3600
ISPS = ["mci", "irancell", "tci", "rightel", "wifi", "other"]
ISP_NAME = {"mci": {"fa": "همراه اول", "ckb": "هەمراه ئەووەڵ", "ar": "همراه أول (MCI)", "en": "MCI"},
            "irancell": {"fa": "ایرانسل", "ckb": "ئیرانسێڵ", "ar": "إيرانسل", "en": "Irancell"},
            "tci": {"fa": "مخابرات (ثابت)", "ckb": "موخابەرات", "ar": "مخابرات (ثابت)", "en": "TCI (fixed)"},
            "rightel": {"fa": "رایتل", "ckb": "ڕایتێڵ", "ar": "رايتل", "en": "Rightel"},
            "wifi": {"fa": "وای‌فای / سایر ثابت", "ckb": "وای‌فای", "kmr": "Wi-Fi / yên din", "ar": "واي فاي / ثابت آخر",
                     "en": "Wi-Fi / other fixed"},
            "other": {"fa": "خارج از ایران / سایر", "ckb": "دەرەوەی ئێران / تر", "kmr": "Derveyî Îranê / din",
                      "ar": "خارج إيران / أخرى", "en": "Outside Iran / other"}}
_cache = {"t": 0, "items": []}

LINK = re.compile(r"((?:https://t\.me|tg:/)/proxy\?[^\s<>\"']+)")
TXT = re.compile(r"Server:\s*([\w.\-]+)\s*Port:\s*(\d+)\s*Secret:\s*([0-9a-fA-F]{32,}|[A-Za-z0-9_\-=]{20,})", re.I)


def L(d, lang, /, **kw):
    s = pick(d, lang)
    return s.format(**kw) if kw else s


# ------------------------------------------------------------------ parsing
def norm(url):
    """-> (canonical https link, server, port, secret) or None"""
    try:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(url.replace("tg://proxy", "https://t.me/proxy")).query)
        server = (q.get("server") or [""])[0].strip().rstrip(".")
        port = int((q.get("port") or ["0"])[0])
        secret = (q.get("secret") or [""])[0].strip()
    except (ValueError, IndexError):
        return None
    if not server or not (0 < port < 65536) or not secret or server.lower() == "unknown":
        return None
    canon = "https://t.me/proxy?" + urllib.parse.urlencode({"server": server, "port": port, "secret": secret})
    return canon, server, port, secret


def parse_post(text, links=()):
    """every proxy found in one post (links in anchors, links in text, Server/Port/Secret blocks)"""
    found = []
    for u in list(links) + LINK.findall(text or ""):
        n = norm(u)
        if n:
            found.append(n)
    for server, port, secret in TXT.findall(text or ""):
        n = norm("https://t.me/proxy?" + urllib.parse.urlencode({"server": server, "port": port, "secret": secret}))
        if n:
            found.append(n)
    return found


def pid(server, port):
    return hashlib.sha1(f"{server.lower()}:{port}".encode()).hexdigest()[:8]


def fake_tls(secret):
    return secret.lower().startswith("ee")


def probe(host, port, timeout=3.0):
    """-> connect time in ms, or None"""
    t0 = time.time()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return int((time.time() - t0) * 1000)
    except OSError:
        return None


# ------------------------------------------------------------------ collection
def collect(read=None):
    """newest-first unique proxies from all sources (not yet probed)"""
    read = read or (lambda name: IR._fetch_channel(name))
    seen, items = set(), []
    for src in SOURCES:
        try:
            posts = read(src)
        except Exception:
            posts = []
        for p in reversed(posts[-4:]):
            for canon, server, port, secret in parse_post(p.get("text", ""), p.get("links") or []):
                key = (server.lower(), port)
                if key in seen:
                    continue
                seen.add(key)
                items.append({"id": pid(server, port), "url": canon, "host": server, "port": port,
                              "tls": fake_tls(secret), "src": src})
    return items[:60]


def refresh(s, read=None, prober=None):
    """collect + probe; result cached CACHE_S s and stored in s["px2"]["last"] as a fallback"""
    if time.time() - _cache["t"] < CACHE_S and _cache["items"]:
        return _cache["items"]
    prober = prober or probe
    items = collect(read)
    if items:
        with ThreadPoolExecutor(max_workers=16) as ex:
            for it, ms in zip(items, ex.map(lambda i: prober(i["host"], i["port"]), items)):
                it["ms"] = ms
                it["ok"] = ms is not None
        good = [i for i in items if i["ok"]][:30]
        if good:
            _cache.update(t=time.time(), items=items)
            px(s)["last"] = {"t": int(time.time()), "items": good}
            return items
        # every probe failed (more likely a network hiccup on our side than every proxy dying): keep the last good list
        _cache.update(t=time.time() - CACHE_S + 120, items=[])
        return (px(s).get("last") or {}).get("items", [])
    return (px(s).get("last") or {}).get("items", [])


# ------------------------------------------------------------------ feedback & scoring
def px(s):
    d = s.setdefault("px2", {})
    d.setdefault("fb", {})          # id -> {isp: [good, bad, ts]}
    d.setdefault("own", [])         # admin proxies: [link]
    return d


def vote(s, uid, isp, proxy_id, good):
    """record one report; one vote per user per proxy per 6 h"""
    d = px(s)
    key = f"{uid}:{proxy_id}"
    votes = d.setdefault("votes", {})
    now = time.time()
    if now - votes.get(key, 0) < HALF_LIFE:
        return False
    votes[key] = now
    if len(votes) > 5000:                                # keep it small
        for k in sorted(votes, key=votes.get)[:1000]:
            votes.pop(k, None)
    rec = d["fb"].setdefault(proxy_id, {}).setdefault(isp or "other", [0.0, 0.0, now])
    decay = 0.5 ** ((now - rec[2]) / HALF_LIFE)
    rec[0], rec[1], rec[2] = rec[0] * decay + (1 if good else 0), rec[1] * decay + (0 if good else 1), now
    return True


def feedback(s, proxy_id, isp=None):
    """-> (good, bad) decayed, for one operator or all of them"""
    now = time.time()
    g = b = 0.0
    for k, (gg, bb, ts) in (px(s)["fb"].get(proxy_id) or {}).items():
        if isp and k != isp:
            continue
        dec = 0.5 ** ((now - ts) / HALF_LIFE)
        g, b = g + gg * dec, b + bb * dec
    return g, b


def score(s, it, isp=None):
    """higher is better. In-Iran reports dominate; the outside check only says the server is up."""
    if not it.get("ok"):
        return -100
    g, b = feedback(s, it["id"], isp)
    if isp:                                              # also count other operators, at half weight
        g2, b2 = feedback(s, it["id"])
        g, b = g + (g2 - g) * 0.5, b + (b2 - b) * 0.5
    sc = 10 * (g - 1.5 * b) / (1 + g + b) ** 0.5
    sc += 4 if it.get("tls") else 0
    sc += 2 if it.get("port") == 443 else 0
    ms = it.get("ms") or 3000
    sc += max(0, 3 - ms / 300)
    return round(sc, 2)


def ranked(s, isp=None, read=None, prober=None):
    items = [dict(i) for i in refresh(s, read, prober) if i.get("ok")]
    for i in items:
        i["score"] = score(s, i, isp)
        i["g"], i["b"] = feedback(s, i["id"], isp)
    items.sort(key=lambda i: -i["score"])
    return items


# ------------------------------------------------------------------ texts
T = {
    "title": {"fa": "🛡 <b>پروکسی اضطراری تلگرام</b>", "ckb": "🛡 <b>پرۆکسی فریاکەوتنی تێلێگرام</b>",
              "kmr": "🛡 <b>Proxyên awarte yên Telegramê</b>", "ar": "🛡 <b>بروكسيات تيليغرام للطوارئ</b>",
              "en": "🛡 <b>Emergency Telegram proxies</b>"},
    "own": {"fa": "⭐️ <b>پروکسی اختصاصی Coin_Kurd</b>", "ckb": "⭐️ <b>پرۆکسی تایبەتی Coin_Kurd</b>",
            "kmr": "⭐️ <b>Proxyya taybet a Coin_Kurd</b>", "ar": "⭐️ <b>البروكسي الخاص بـ Coin_Kurd</b>",
            "en": "⭐️ <b>Coin_Kurd's own proxy</b>"},
    "public": {"fa": "🌐 <b>پروکسی‌های عمومی</b> — به ترتیب گزارش کاربران داخل ایران{isp}:",
               "ckb": "🌐 <b>پرۆکسییە گشتییەکان</b> — بەپێی ڕاپۆرتی بەکارهێنەرانی ناو ئێران{isp}:",
               "kmr": "🌐 <b>Proxyên giştî</b> — li gorî raporên bikarhênerên li Îranê{isp}:",
               "ar": "🌐 <b>بروكسيات عامة</b> — مرتبة حسب تقارير المستخدمين داخل إيران{isp}:",
               "en": "🌐 <b>Public proxies</b> — ranked by reports from users inside Iran{isp}:"},
    "legend": {"fa": "🔒 = fake-TLS (مقاوم‌تر) · 👍/👎 = بعد از امتحان بزن تا بقیه بدانند کدام <b>داخل ایران</b> کار می‌کند.",
               "ckb": "🔒 = fake-TLS (بەهێزتر) · 👍/👎 = دوای تاقیکردنەوە دابگرە تا خەڵکی تر بزانن کامیان <b>لەناو ئێران</b> کار دەکات.",
               "kmr": "🔒 = fake-TLS (xurtir) · 👍/👎 = piştî ceribandinê bitikîne da ku yên din bizanin kîjan <b>li Îranê</b> dixebite.",
               "ar": "🔒 = fake-TLS (أكثر مقاومة) · 👍/👎 = اضغط بعد التجربة ليعرف الآخرون أيها يعمل <b>داخل إيران</b>.",
               "en": "🔒 = fake-TLS (more resistant) · 👍/👎 = tap after trying so others know which ones work <b>inside Iran</b>."},
    "warn": {"fa": "⚠️ پروکسی عمومی را دیگران اداره می‌کنند: آی‌پی شما را می‌بینند، ولی پیام‌های تلگرام رمزنگاری‌شده می‌مانند.",
             "ckb": "⚠️ پرۆکسی گشتی کەسانی تر بەڕێوەی دەبەن: ئایپیەکەت دەبینن، بەڵام پەیامەکانی تێلێگرام هەر شاراوە دەمێننەوە.",
             "kmr": "⚠️ Proxyên giştî ji aliyê kesên din ve têne birêvebirin: IPya te dibînin, lê peyamên Telegramê şîfrekirî dimînin.",
             "ar": "⚠️ البروكسيات العامة يديرها آخرون: يرون عنوان IP الخاص بك، لكن رسائل تيليغرام تبقى مشفرة.",
             "en": "⚠️ Public proxies are run by others: they see your IP, but Telegram messages stay encrypted."},
    "none": {"fa": "فعلاً پروکسی فعالی پیدا نشد؛ چند دقیقهٔ دیگر دوباره امتحان کن.",
             "ckb": "ئێستا هیچ پرۆکسییەکی چالاک نەدۆزرایەوە؛ دواتر هەوڵ بدەرەوە.",
             "kmr": "Niha proxyeke çalak nehat dîtin; piştî çend deqeyan dîsa biceribîne.",
             "ar": "لا يوجد بروكسي يعمل الآن؛ حاول بعد دقائق.",
             "en": "No working proxy found right now; try again in a few minutes."},
    "isp_ask": {"fa": "📶 اینترنتت از کدام اپراتور است؟ (برای مرتب‌سازی دقیق‌تر پروکسی‌ها)",
                "ckb": "📶 ئینتەرنێتەکەت لە کام کۆمپانیایە؟ (بۆ ڕیزکردنی باشتری پرۆکسییەکان)",
                "kmr": "📶 Înterneta te ji kîjan operatorê ye? (ji bo rêzkirina baştir)",
                "ar": "📶 من أي مشغل يأتي الإنترنت لديك؟ (لترتيب أدق للبروكسيات)",
                "en": "📶 Which operator is your internet from? (for better ranking)"},
    "b_isp": {"fa": "📶 اپراتور من: {n}", "ckb": "📶 کۆمپانیاکەم: {n}", "kmr": "📶 Operatorê min: {n}",
              "ar": "📶 مشغلي: {n}", "en": "📶 My operator: {n}"},
    "b_share": {"fa": "📤 ارسال لیست برای دیگران", "ckb": "📤 ناردنی لیستەکە بۆ کەسانی تر", "kmr": "📤 Lîsteyê ji yên din re bişîne",
                "ar": "📤 إرسال القائمة للآخرين", "en": "📤 Share the list"},
    "thanks": {"fa": "ممنون! گزارشت ثبت شد ✅", "ckb": "سوپاس! ڕاپۆرتەکەت تۆمارکرا ✅", "kmr": "Spas! Rapora te hat tomarkirin ✅",
               "ar": "شكراً! تم تسجيل تقريرك ✅", "en": "Thanks! Report saved ✅"},
    "dup": {"fa": "برای این پروکسی قبلاً گزارش داده‌ای (هر ۶ ساعت یک بار).", "ckb": "پێشتر ڕاپۆرتت داوە (هەر ٦ کاتژمێر جارێک).",
            "kmr": "Te berê ji bo vê proxyê rapor da (her 6 saetan carekê).", "ar": "سبق أن أبلغت عن هذا البروكسي (مرة كل 6 ساعات).",
            "en": "You already reported this proxy (once every 6 h)."},
    "share_head": {"fa": "🛡 پروکسی‌های تلگرام (Coin_Kurd) — روی هر لینک بزن:",
                   "ckb": "🛡 پرۆکسییەکانی تێلێگرام (Coin_Kurd) — لەسەر هەر بەستەرێک دابگرە:",
                   "kmr": "🛡 Proxyên Telegramê (Coin_Kurd) — li ser her girêdanekê bitikîne:",
                   "ar": "🛡 بروكسيات تيليغرام (Coin_Kurd) — اضغط على أي رابط:",
                   "en": "🛡 Telegram proxies (Coin_Kurd) — tap any link:"},
}


def isp_label(isp, lang):
    return pick(ISP_NAME.get(isp, ISP_NAME["other"]), lang)


def section(s, lang, esc, isp=None, read=None, prober=None):
    """-> (html text, inline keyboard rows)"""
    out = [L(T["title"], lang), ""]
    rows = []
    d = px(s)
    own = (s.get("proxy") or "").strip()
    own_links = list(dict.fromkeys(d["own"] + [u for u in LINK.findall(own)]))
    if own or own_links:
        out.append(L(T["own"], lang))
        if own:
            out += [esc(own)]
        out.append("")
        for i, u in enumerate(own_links[:4], 1):
            rows.append([{"text": f"⭐️ Coin_Kurd {i}", "url": u.replace("tg://proxy", "https://t.me/proxy")}])
    items = ranked(s, isp, read, prober)[:MAX_SHOW]
    if items:
        tag = f" ({isp_label(isp, lang)})" if isp else ""
        out.append(L(T["public"], lang, isp=tag))
        for i in items:
            rep = f" 👍{i['g']:.0f}" if i["g"] >= 0.5 else ""
            rep += f" 👎{i['b']:.0f}" if i["b"] >= 0.5 else ""
            label = f"{'🔒' if i['tls'] else '🔓'} {i['host'][:18]}:{i['port']}{rep}"
            rows.append([{"text": label[:40], "url": i["url"]},
                         {"text": "👍", "callback_data": f"pf:{i['id']}:1"},
                         {"text": "👎", "callback_data": f"pf:{i['id']}:0"}])
        out += ["", L(T["legend"], lang)]
    elif not (own or own_links):
        out.append(L(T["none"], lang))
    out += ["", L(T["warn"], lang)]
    rows.append([{"text": L(T["b_isp"], lang, n=isp_label(isp, lang) if isp else "?"), "callback_data": "px:isp"},
                 {"text": L(T["b_share"], lang), "callback_data": "px:share"}])
    return "\n".join(out), rows


def isp_keyboard(lang):
    rows, row = [], []
    for k in ISPS:
        row.append({"text": isp_label(k, lang), "callback_data": f"isp:{k}"})
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    return rows


def share_text(s, lang, isp=None, n=10):
    """plain message with raw links — forwardable, copyable into other apps"""
    d = px(s)
    links = list(dict.fromkeys(d["own"] + LINK.findall(s.get("proxy") or "")))
    links += [i["url"] for i in ranked(s, isp)[:n]]
    links = [u.replace("tg://proxy", "https://t.me/proxy") for u in links][:n + 4]
    return "\n".join([L(T["share_head"], lang), ""] + links)


def best_links(s, n=5):
    """for the outage kit push"""
    d = px(s)
    own = list(dict.fromkeys(d["own"] + LINK.findall(s.get("proxy") or "")))
    return [u.replace("tg://proxy", "https://t.me/proxy") for u in own][:3] + [i["url"] for i in ranked(s)[:n]]
