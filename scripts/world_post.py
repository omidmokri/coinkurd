#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
«جهان زنده» in the channel — the owner's request of 2026-11-15: every night at 24:00 Tehran an album of four images
(کوردی · فارسی · العربية · English) «the world in the day that just ended» goes to @Coin_Kurd without asking him; and the
same for the week (Friday 24:00), the Jalali month (the night its last day ends) and the Jalali year (the night before
Nowruz, 1 Farvardin 00:00). Several can fall on one night: they go one after the other — day, week, month, year.

What a post holds (scripts/world_data.py FACTS + Bitcoin's chain + Binance's public prices):
  births, deaths (UN WPP 2024), Bitcoin mined in the period (by block timestamps: the first block at or after the start
  to the last one before the end, mempool.space; × the subsidy schedule), Bitcoin's price at the start and the end
  (Binance BTCUSDT one-minute open), fossil CO₂ (Global Carbon Budget 2026), military spending (SIPRI 2025), and the
  world's population at the end. A yearly figure is spread evenly over the period, as on the page.
The pictures and captions are drawn by the page's own studio (assets/world/studio.js) in headless Chrome, so a post looks
exactly like «ساخت پست» on entekhab.net/world/.

Checks before anything is sent (a failed check sends nothing for that period): every number present and positive, the
Bitcoin count consistent with the blocks (blocks × subsidy), four PNGs of 1080 × 1080 that are not blank, the caption
within Telegram's 1024 characters, the bot allowed to post, the period not posted before (data/world_posts.json).

Run:  python3 scripts/world_post.py --dry-run [--at 2026-11-21T20:31Z] [--out DIR]     (renders, checks, sends nothing)
      python3 scripts/world_post.py --wait                                            (CI: waits for 24:00 Tehran, posts)
Test: python3 tests/test_world_post.py
"""
import argparse
import base64
import functools
import html
import http.server
import io
import json
import os
import socketserver
import subprocess
import sys
import threading
import time
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import world_data as WD  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, "data", "world_posts.json")
TEH = timezone(timedelta(hours=3, minutes=30))          # Iran has kept +03:30 all year since 2022
CHAT = os.environ.get("WORLD_POST_CHAT", "@Coin_Kurd")
LANGS = ("ckb", "fa", "ar", "en")                       # the site's order: Kurdish first, English last
KINDS = ("daily", "weekly", "monthly", "yearly")
LATE_MAX_H = 6                                          # a run later than this after midnight posts nothing (stale)
SIG = ('<a href="https://t.me/+QdxOfpXU3tdhOTA0">🅲🅾️🅸🅽 🅺🆄🆁🅳 </a>👾<a href="https://discord.gg/BewcJHRBZ">Discord</a> '
       '🎥<a href="https://www.youtube.com/channel/UCUzxNwejhNtSGaOZaI2ku5w">Youtube</a> '
       '📸<a href="https://www.instagram.com/coin_kurd">Instagram</a> 💬<a href="https://twitter.com/omid_mokri">X</a>')

# ------------------------------------------------------------------------------------------------ the Jalali calendar
# jalaali-js (Behrooz Borkhatari's algorithm, MIT), with Python's proleptic ordinals in place of Julian day numbers
_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]


def _div(a, b):
    return int(a / b)


def _mod(a, b):
    return a - int(a / b) * b


def _jal_cal(jy):
    gy, leap_j, jp, jump = jy + 621, -14, _BREAKS[0], 0
    for jm in _BREAKS[1:]:
        jump = jm - jp
        if jy < jm:
            break
        leap_j += _div(jump, 33) * 8 + _div(_mod(jump, 33), 4)
        jp = jm
    n = jy - jp
    leap_j += _div(n, 33) * 8 + _div(_mod(n, 33) + 3, 4)
    if _mod(jump, 33) == 4 and jump - n == 4:
        leap_j += 1
    leap_g = _div(gy, 4) - _div((_div(gy, 100) + 1) * 3, 4) - 150
    march = 20 + leap_j - leap_g
    if jump - n < 6:
        n = n - jump + _div(jump + 4, 33) * 33
    leap = _mod(_mod(n + 1, 33) - 1, 4)
    return (4 if leap == -1 else leap), gy, march


def j2g(jy, jm, jd):
    _, gy, march = _jal_cal(jy)
    return date.fromordinal(date(gy, 3, march).toordinal() + (jm - 1) * 31 - _div(jm, 7) * (jm - 7) + jd - 1)


def g2j(d):
    jy = d.year - 621
    leap, gy, march = _jal_cal(jy)
    k = d.toordinal() - date(gy, 3, march).toordinal()
    if k >= 0:
        if k <= 185:
            return jy, 1 + _div(k, 31), _mod(k, 31) + 1
        k -= 186
    else:
        jy -= 1
        k += 179
        if leap == 1:
            k += 1
    return jy, 7 + _div(k, 30), _mod(k, 30) + 1


# ------------------------------------------------------------------------------------------------------- the periods
def periods(now_utc):
    """the periods that ended at the last Tehran midnight before now_utc: [(kind, start, end)] (aware datetimes, Tehran)"""
    end = now_utc.astimezone(TEH).replace(hour=0, minute=0, second=0, microsecond=0)
    out = [("daily", end - timedelta(days=1), end)]
    if end.weekday() == 5:                                     # Saturday 00:00 = Friday 24:00: the Iranian week ended
        out.append(("weekly", end - timedelta(days=7), end))
    jy, jm, jd = g2j(end.date())
    if jd == 1:                                                # the last day of a Jalali month ended
        py, pm = (jy, jm - 1) if jm > 1 else (jy - 1, 12)
        out.append(("monthly", datetime.combine(j2g(py, pm, 1), datetime.min.time(), TEH), end))
        if jm == 1:                                            # … and of the year: Nowruz
            out.append(("yearly", datetime.combine(j2g(jy - 1, 1, 1), datetime.min.time(), TEH), end))
    return out


def flow_total(per_year, start, end):
    """a yearly total spread evenly over [start, end), year by (UTC) calendar year"""
    t, a, b = 0.0, start.astimezone(timezone.utc), end.astimezone(timezone.utc)
    while a < b:
        nxt = min(b, datetime(a.year + 1, 1, 1, tzinfo=timezone.utc))
        t += per_year * (nxt - a).total_seconds() / WD.year_len_s(a.year)
        a = nxt
    return t


# ---------------------------------------------------------------------------------------------- labels in 4 languages
MONTHS = {
    "fa": ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"],
    "ckb": ["خاکەلێوە", "گوڵان", "جۆزەردان", "پووشپەڕ", "گەلاوێژ", "خەرمانان", "ڕەزبەر", "گەڵاڕێزان", "سەرماوەز", "بەفرانبار", "ڕێبەندان", "ڕەشەمێ"],
    "ar": ["فروردين", "أرديبهشت", "خرداد", "تير", "مرداد", "شهريور", "مهر", "آبان", "آذر", "دي", "بهمن", "إسفند"],
    "en": ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"],
}
GMONTHS = {
    "fa": ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"],
    "ckb": ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەمموز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"],
    "ar": ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
}
WEEKDAYS = {  # Python weekday(): Monday = 0
    "fa": ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه", "یکشنبه"],
    "ckb": ["دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە", "یەکشەممە"],
    "ar": ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
    "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
}
TITLE = {
    "daily": {"fa": "جهان در روزی که گذشت", "ckb": "جیهان لەو ڕۆژەی ڕابرد", "ar": "العالم في اليوم الذي مضى", "en": "The world in the day that ended"},
    "weekly": {"fa": "جهان در هفته‌ای که گذشت", "ckb": "جیهان لەو هەفتەیەی ڕابرد", "ar": "العالم في الأسبوع الذي مضى", "en": "The world in the week that ended"},
    "monthly": {"fa": "جهان در ماهی که گذشت", "ckb": "جیهان لەو مانگەی ڕابرد", "ar": "العالم في الشهر الذي مضى", "en": "The world in the month that ended"},
    "yearly": {"fa": "جهان در سالی که گذشت", "ckb": "جیهان لەو ساڵەی ڕابرد", "ar": "العالم في العام الذي مضى", "en": "The world in the year that ended"},
}
DIG = {"fa": "۰۱۲۳۴۵۶۷۸۹", "ckb": "٠١٢٣٤٥٦٧٨٩", "ar": "٠١٢٣٤٥٦٧٨٩"}


def loc(s, lg):
    m = DIG.get(lg)
    return "".join(m[int(c)] if c.isdigit() else c for c in str(s)) if m else str(s)


def jlabel(d, lg, year=True, wd=False):
    jy, jm, jd = g2j(d)
    s = f"{loc(jd, lg)} {MONTHS[lg][jm - 1]}" + (f" {loc(jy, lg)}" if year else "")
    return (WEEKDAYS[lg][d.weekday()] + " " + s) if wd else s


def glabel(a, b, lg):
    """Gregorian dates of [a, b] (inclusive days), in the reader's language"""
    m = GMONTHS[lg]
    if a == b:
        return f"{m[a.month - 1]} {a.day}, {a.year}" if lg == "en" else f"{loc(a.day, lg)} {m[a.month - 1]} {loc(a.year, lg)}"
    ya = (f", {a.year}" if lg == "en" else f" {loc(a.year, lg)}") if a.year != b.year else ""      # a range across new year names both
    if lg == "en":
        return f"{m[a.month - 1]} {a.day}{ya} – {m[b.month - 1]} {b.day}, {b.year}"
    return f"{loc(a.day, lg)} {m[a.month - 1]}{ya} – {loc(b.day, lg)} {m[b.month - 1]} {loc(b.year, lg)}"


def labels(kind, start, end):
    a, b = start.date(), (end - timedelta(days=1)).date()
    out = {}
    for lg in LANGS:
        jy, jm, _ = g2j(a)
        if kind == "daily":
            sub = jlabel(a, lg, wd=True)
        elif kind == "weekly":
            sub = f"{jlabel(a, lg, year=False)} – {jlabel(b, lg)}" if lg != "en" else f"{jlabel(a, lg, year=False)} – {jlabel(b, lg)}"
        elif kind == "monthly":
            sub = f"{MONTHS[lg][jm - 1]} {loc(jy, lg)}"
        else:
            sub = {"fa": "سال ", "ckb": "ساڵی ", "ar": "عام ", "en": "Year "}[lg] + loc(jy, lg)
        if lg != "fa":
            sub += " · " + glabel(a, b, lg)
        out[lg] = {"title": TITLE[kind][lg], "sub": sub}
    return out


# ------------------------------------------------------------------------------------------------------- the numbers
def btc_price_at(ts, get):
    """Binance BTCUSDT: the open of the one-minute candle that starts at ts (public mirror, no key)"""
    r = get(f"https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&startTime={int(ts) * 1000}&limit=1")
    try:
        row = r[0]
        if abs(int(row[0]) / 1000 - ts) > 120:
            return None
        p = float(row[1])
        return p if p > 0 else None
    except (TypeError, ValueError, IndexError, KeyError):
        return None


def payload(kind, start, end, get=WD._get):
    """everything one post needs, raw (the studio formats it in each language); None for a figure no source gave"""
    F = {f["k"]: f for f in WD.FACTS}
    h0 = WD.first_block_at(start.timestamp(), get)
    h1 = WD.first_block_at(end.timestamp(), get)
    btc = None
    if h0 and h1 and h1 > h0:
        btc = {"h0": h0, "h1": h1 - 1, "blocks": h1 - h0, "btc": WD.issued_sat(h0, h1 - 1) / WD.COIN}
    p0, p1 = btc_price_at(start.timestamp(), get), btc_price_at(end.timestamp() - 60, get)
    rows = [
        {"id": "births", "v": flow_total(F["births"]["per_year"], start, end), "unit": "people"},
        {"id": "deaths", "v": flow_total(F["deaths"]["per_year"], start, end), "unit": "people"},
        {"id": "btc_mined", "v": btc["btc"] if btc else None, "unit": "btc", "blocks": btc["blocks"] if btc else None},
        {"id": "btc_price", "v": p1, "p0": p0, "pct": (p1 / p0 - 1) * 100 if p0 and p1 else None, "unit": "usd"},
        {"id": "co2", "v": flow_total(F["co2"]["per_year"], start, end), "unit": "t"},
        {"id": "military", "v": flow_total(F["military"]["per_year"], start, end), "unit": "usd"},
    ]
    return {"kind": kind, "start": start.isoformat(), "end": end.isoformat(), "labels": labels(kind, start, end), "rows": rows, "btc": btc,
            "pop_end": WD.stock_value(F["pop"], end.astimezone(timezone.utc)),
            "src": "UN WPP 2024 · GCB 2026 · SIPRI 2025 · mempool.space · Binance"}


def check_payload(p):
    bad = []
    for r in p["rows"]:
        if not isinstance(r.get("v"), (int, float)) or not r["v"] > 0:
            bad.append(r["id"])
    b = p.get("btc")
    if not b or abs(b["btc"] - WD.issued_sat(b["h0"], b["h1"]) / WD.COIN) > 1e-9 or not (0 < b["blocks"] < 80000):
        bad.append("btc blocks")
    pr = next(r for r in p["rows"] if r["id"] == "btc_price")
    if pr.get("p0") is None or pr.get("pct") is None or abs(pr["pct"]) > 95:
        bad.append("btc price change")
    return bad


# ----------------------------------------------------------------------------------- pictures and captions (headless)
class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def render(payloads, chrome=None):
    """the studio draws every period in the four languages -> {kind: {lang: {"png": bytes, "caption": str}}}"""
    from playwright.sync_api import sync_playwright
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(_Quiet, directory=ROOT))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    out = {}
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch(executable_path=chrome or os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--no-sandbox"])
            ctx = br.new_context(viewport={"width": 1280, "height": 900})
            ctx.route("**/sw.js", lambda r: r.abort())
            pg = ctx.new_page()
            pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/world/", wait_until="domcontentloaded")
            pg.wait_for_function("window.WL && WL.value && WL.F && Object.keys(WL.F).length > 0", timeout=60000)
            pg.add_script_tag(url="/assets/world/studio.js?v=post")
            pg.wait_for_function("!!(window.WL && WL.studio && WL.studio.renderPeriod)", timeout=30000)
            for p in payloads:
                res = pg.evaluate("p => WL.studio.renderPeriod(p)", p)
                out[p["kind"]] = {lg: {"png": base64.b64decode(v["png"].split(",", 1)[1]), "caption": v["caption"]} for lg, v in res.items()}
            br.close()
    finally:
        srv.shutdown()
    return out


def check_images(imgs):
    from PIL import Image, ImageStat
    bad = []
    for lg in LANGS:
        x = imgs.get(lg)
        if not x:
            bad.append(lg + ": missing")
            continue
        im = Image.open(io.BytesIO(x["png"]))
        if im.format != "PNG" or im.size != (1080, 1080):
            bad.append(f"{lg}: {im.format} {im.size}")
        elif max(ImageStat.Stat(im.convert("L")).stddev) < 12:
            bad.append(f"{lg}: blank")
        if not x["caption"].strip():
            bad.append(lg + ": no caption")
    return bad


def visible(h):
    import re
    return len(html.unescape(re.sub(r"<[^>]+>", "", h)))


def album_caption(imgs):
    """one caption under the album: the Persian text in full, one line in each other language, then the signature"""
    fa = imgs["fa"]["caption"].strip().split("\n")
    tags = fa[-1] if fa[-1].startswith("#") else ""
    body = [ln for ln in fa if ln and not ln.startswith("#")]
    others = []
    for lg, flag in (("ckb", "☀️"), ("ar", "🟠"), ("en", "🔵")):
        first = imgs[lg]["caption"].strip().split("\n")
        others.append(f"{flag} " + html.escape(" — ".join(first[:2])))
    for keep in (len(body), 8, 6):
        cap = "🟢 " + html.escape("\n".join(body[:keep])) + "\n\n" + "\n".join(others) + "\n\n" + html.escape(tags) + "\n" + SIG
        if visible(cap) <= 1024:
            return cap
    raise ValueError("caption over 1024 characters")


# --------------------------------------------------------------------------------------------------------- Telegram
def check_bot(token):
    sys.path.insert(0, os.path.join(ROOT, "scripts", "podcast"))
    import telegram as TG  # the podcast's own read-only check
    return TG.check_bot(token, CHAT)


def send_album(token, imgs, caption):
    import requests
    files, media = {}, []
    for i, lg in enumerate(LANGS):
        files[f"p{i}"] = (f"world_{lg}.png", imgs[lg]["png"], "image/png")
        m = {"type": "photo", "media": f"attach://p{i}"}
        if i == 0:
            m.update(caption=caption, parse_mode="HTML")
        media.append(m)
    r = requests.post(f"https://api.telegram.org/bot{token}/sendMediaGroup", data={"chat_id": CHAT, "media": json.dumps(media, ensure_ascii=False)},
                      files=files, timeout=300)
    j = r.json()
    if not j.get("ok") or len(j.get("result", [])) != len(LANGS):
        raise RuntimeError(f"Telegram refused the album: {j.get('error_code')} {j.get('description')}")
    return [m["message_id"] for m in j["result"]]


def period_key(kind, start):
    jy, jm, jd = g2j(start.date())
    return {"daily": f"{jy}-{jm:02d}-{jd:02d}", "weekly": f"{jy}-{jm:02d}-{jd:02d}w", "monthly": f"{jy}-{jm:02d}", "yearly": str(jy)}[kind]


def load_ledger():
    try:
        return json.load(open(LEDGER, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def save_ledger(kind, key, rec):
    subprocess.run(["git", "pull", "-q", "--rebase", "origin", "main"], cwd=ROOT, check=False)
    led = load_ledger()
    led.setdefault(kind, {})[key] = rec
    for k in led:                                          # keep the ledger small: the last 400 entries of each kind
        led[k] = dict(sorted(led[k].items())[-400:])
    json.dump(led, open(LEDGER, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    subprocess.run(["git", "add", LEDGER], cwd=ROOT, check=False)
    subprocess.run(["git", "commit", "-q", "-m", f"world: posted {kind} {key} to Telegram"], cwd=ROOT, check=False)
    for _ in range(3):
        if subprocess.run(["git", "push", "-q"], cwd=ROOT).returncode == 0:
            break
        subprocess.run(["git", "pull", "-q", "--rebase", "-X", "theirs", "origin", "main"], cwd=ROOT, check=False)
        time.sleep(5)


# -------------------------------------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--wait", action="store_true", help="sleep until the next 24:00 Tehran if it is less than 40 minutes away")
    ap.add_argument("--at", help="pretend the clock reads this (ISO, UTC) — dry runs only")
    ap.add_argument("--kinds", default=",".join(KINDS), help="limit to these period kinds")
    ap.add_argument("--out", default=os.path.join(ROOT, "_world_post"))
    a = ap.parse_args()
    if a.at and not a.dry_run:
        raise SystemExit("--at is for dry runs only")
    if a.wait:
        nxt = (datetime.now(TEH) + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        left = (nxt - datetime.now(TEH)).total_seconds()
        if 0 < left < 40 * 60:
            print(f"waiting {left:.0f} s for 24:00 Tehran")
            time.sleep(left + 45)                         # a little after midnight: the day's last block has a moment to land
    now = datetime.fromisoformat(a.at.replace("Z", "+00:00")) if a.at else datetime.now(timezone.utc)
    ps = [p for p in periods(now) if p[0] in a.kinds.split(",")]
    late_h = (now - ps[0][2]).total_seconds() / 3600
    if late_h > LATE_MAX_H and not a.dry_run:
        print(f"{late_h:.1f} h after midnight: too late, nothing posted")
        return
    led = load_ledger()
    todo = []
    for kind, s, e in ps:
        key = period_key(kind, s)
        if (led.get(kind) or {}).get(key) and not a.dry_run:
            print("already posted:", kind, key)
            continue
        p = payload(kind, s, e)
        bad = check_payload(p)
        print(kind, key, json.dumps({r["id"]: r.get("v") for r in p["rows"]}), "problems:", bad or "none")
        if not bad:
            todo.append((kind, key, p))
    if not todo:
        print("nothing to post")
        return
    imgs = render([p for _, _, p in todo])
    os.makedirs(a.out, exist_ok=True)
    ready = []
    for kind, key, p in todo:
        bad = check_images(imgs[kind])
        cap = None
        try:
            cap = album_caption(imgs[kind])
        except ValueError as ex:
            bad.append(str(ex))
        for lg in LANGS:
            open(os.path.join(a.out, f"{kind}_{lg}.png"), "wb").write(imgs[kind][lg]["png"])
        open(os.path.join(a.out, f"{kind}_caption.html"), "w", encoding="utf-8").write(cap or "")
        json.dump(p, open(os.path.join(a.out, f"{kind}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(kind, "images:", bad or "ok", "caption chars:", visible(cap) if cap else "—")
        if not bad:
            ready.append((kind, key, cap))
    token = os.environ.get("REF_BOT_TOKEN", "")
    if a.dry_run:
        for kind, key, cap in ready:
            print(f"--- {kind} {key} caption ---\n{cap}\n---")
        if token:
            print("bot check (read-only):", *check_bot(token))
        print("dry run: nothing posted. Files in", a.out)
        return
    if not token:
        raise SystemExit("REF_BOT_TOKEN is not set")
    ok, who = check_bot(token)
    print("bot check:", ok, who)
    if not ok:
        raise SystemExit("the bot cannot post in the channel: " + who)
    for i, (kind, key, cap) in enumerate(ready):
        if i:
            time.sleep(20)
        ids = send_album(token, imgs[kind], cap)
        print("posted", kind, key, ids)
        save_ledger(kind, key, {"chat": CHAT, "message_ids": ids, "at": datetime.now(timezone.utc).replace(microsecond=0).isoformat()})


if __name__ == "__main__":
    main()
