"""
Emergency proxy section of the bot.

1) The channel's own (dedicated) proxy, set by an admin with /setproxy, always comes first.
2) Public MTProto proxies from @tavanaproxy (read through t.me/s, like every other feed),
   de-duplicated and checked with a quick TCP connect so dead servers are dropped.
   The check runs from the bot's server (outside Iran), so "✅" means "online", not
   "reachable from inside Iran".
"""
import re
import socket
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

import bot_iran as IR
from bot_i18n import pick

SOURCE = "tavanaproxy"
MAX_SHOW = 8
CACHE_S = 900
_cache = {"t": 0, "items": []}

LINK = re.compile(r"(https://t\.me/proxy\?[^\s<>\"]+)")
FLAGS = {"germany": "🇩🇪", "آلمان": "🇩🇪", "finland": "🇫🇮", "فنلاند": "🇫🇮", "russia": "🇷🇺", "روسیه": "🇷🇺",
         "united states": "🇺🇸", "آمریکا": "🇺🇸", "netherlands": "🇳🇱", "هلند": "🇳🇱", "united kingdom": "🇬🇧",
         "انگلیس": "🇬🇧", "france": "🇫🇷", "فرانسه": "🇫🇷", "poland": "🇵🇱", "لهستان": "🇵🇱", "sweden": "🇸🇪",
         "سوئد": "🇸🇪", "lithuania": "🇱🇹", "canada": "🇨🇦", "hong kong": "🇭🇰", "south korea": "🇰🇷",
         "romania": "🇷🇴", "cyprus": "🇨🇾", "malaysia": "🇲🇾", "ireland": "🇮🇪", "israel": "🇮🇱", "اسرائیل": "🇮🇱"}


def parse(text):
    """-> [(country, url)] in post order: a country line followed by its t.me/proxy link"""
    out, country = [], ""
    for raw in (text or "").split("\n"):
        line = raw.strip()
        if not line:
            continue
        m = LINK.search(line)
        if m:
            out.append((country, m.group(1)))
            country = ""
        else:
            country = line[:30]
    return out


def server_port(url):
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    host = (q.get("server") or [""])[0].rstrip(".")
    try:
        port = int((q.get("port") or ["0"])[0])
    except ValueError:
        port = 0
    return host, port


def alive(host, port, timeout=3.0):
    if not host or not port:
        return False
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def latest():
    """[{country, flag, url, ok}] newest first, checked, cached CACHE_S seconds"""
    if time.time() - _cache["t"] < CACHE_S and _cache["items"]:
        return _cache["items"]
    posts = IR._fetch_channel(SOURCE)
    seen, items = set(), []
    for p in reversed(posts[-3:]):                       # newest posts first
        for country, url in parse(p.get("text", "")):
            key = server_port(url)
            if key in seen or not key[0]:
                continue
            seen.add(key)
            items.append({"country": country, "url": url, "host": key[0], "port": key[1],
                          "flag": FLAGS.get(country.lower(), "🌐")})
    items = items[:24]
    with ThreadPoolExecutor(max_workers=12) as ex:
        for it, ok in zip(items, ex.map(lambda i: alive(i["host"], i["port"]), items)):
            it["ok"] = ok
    items.sort(key=lambda i: not i["ok"])
    if items:
        _cache.update(t=time.time(), items=items)
    return items or _cache["items"]


T = {
    "title": {"fa": "🛡 <b>پروکسی اضطراری تلگرام</b>", "ckb": "🛡 <b>پرۆکسی فریاکەوتنی تێلێگرام</b>",
              "en": "🛡 <b>Emergency Telegram proxies</b>"},
    "own": {"fa": "⭐️ <b>پروکسی اختصاصی Coin_Kurd</b>", "ckb": "⭐️ <b>پرۆکسی تایبەتی Coin_Kurd</b>",
            "en": "⭐️ <b>Coin_Kurd's own proxy</b>"},
    "public": {"fa": "🌐 <b>پروکسی‌های عمومی</b> — روی دکمه بزن تا تلگرام وصل شود:",
               "ckb": "🌐 <b>پرۆکسییە گشتییەکان</b> — دوگمەکە دابگرە بۆ پەیوەندیکردن:",
               "en": "🌐 <b>Public proxies</b> — tap a button to connect Telegram:"},
    "legend": {"fa": "✅ = همین چند دقیقه پیش آنلاین بود (از سرور خارج ایران بررسی شده؛ ممکن است داخل ایران فیلتر باشد)",
               "ckb": "✅ = چەند خولەک لەمەوبەر ئۆنلاین بوو (لە دەرەوەی ئێران پشکنراوە؛ لەوانەیە لەناو ئێران فلتەر بێت)",
               "en": "✅ = online a few minutes ago (checked from outside Iran; it may still be filtered inside Iran)"},
    "warn": {"fa": "⚠️ پروکسی عمومی را دیگران اداره می‌کنند: آی‌پی شما را می‌بینند، ولی پیام‌های تلگرام رمزنگاری‌شده می‌مانند. برای حساب‌های مهم، پروکسی اختصاصی بهتر است.",
             "ckb": "⚠️ پرۆکسی گشتی کەسانی تر بەڕێوەی دەبەن: ئایپیەکەت دەبینن، بەڵام پەیامەکانی تێلێگرام هەر شاراوە دەمێننەوە.",
             "en": "⚠️ Public proxies are run by strangers: they see your IP, though Telegram messages stay encrypted. Prefer the dedicated proxy for important accounts."},
    "none": {"fa": "فعلاً پروکسی فعالی پیدا نشد؛ چند دقیقهٔ دیگر دوباره امتحان کن.",
             "ckb": "ئێستا هیچ پرۆکسییەکی چالاک نەدۆزرایەوە؛ دواتر هەوڵ بدەرەوە.",
             "en": "No working proxy found right now; try again in a few minutes."},
}


def section(s, lang, esc):
    """-> (html text, inline keyboard rows)"""
    out = [pick(T["title"], lang), ""]
    rows = []
    own = (s.get("proxy") or "").strip()
    if own:
        out += [pick(T["own"], lang), esc(own), ""]
        for u in LINK.findall(own)[:3]:
            rows.append([{"text": "⭐️ Coin_Kurd", "url": u}])
    items = [i for i in latest() if i["ok"]][:MAX_SHOW]
    if items:
        out.append(pick(T["public"], lang))
        for i in items:
            label = f"✅ {i['flag']} {i['country'] or i['host']}"[:40]
            rows.append([{"text": label, "url": i["url"]}])
        out += ["", pick(T["legend"], lang)]
    elif not own:
        out.append(pick(T["none"], lang))
    out += ["", pick(T["warn"], lang)]
    return "\n".join(out), rows
