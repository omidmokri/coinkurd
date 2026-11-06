#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
دفتر ثبت عملکرد سیگنال‌ها با قفل زمانی — Entekhab time-locked signal ledger

هر پیش‌بینی عمومی (تحلیل‌گران هوش مصنوعی شورای انتخاب، اسکنر فرصت‌ها، اندیکاتورهای کردستانی،
خرد جمعی بازی پیش‌بینی، آشکارساز خروج خاموش و پست‌های #قفل کانال Coin_Kurd) در لحظهٔ انتشار
با «قیمت مبنا + جهت + بازه» ثبت می‌شود. هر ردیف هش SHA-256 خودش و ردیف قبلی را دارد (زنجیرهٔ هش)؛
تغییر یا حذف هر ردیف قدیمی زنجیره را می‌شکند و صفحهٔ سایت آن را فوراً نشان می‌دهد.
روزانه «سرِ زنجیره» با OpenTimestamps روی بلاک‌چین بیت‌کوین مهر زمان می‌خورد.

بعد از پایان بازه، نتیجه با دادهٔ عمومی Binance حساب می‌شود (هر کس می‌تواند دوباره حسابش کند):
  قیمت پایان = قیمت باز شدن اولین کندل ساعتی پس از پایان بازه
  باند خنثی = ۰٫۱٪ × √(ساعت‌های بازه)   (۲۴ ساعت ≈ ۰٫۴۹٪، ۷۲ ساعت ≈ ۰٫۸۵٪، ۷ روز ≈ ۱٫۳٪)
  پیش‌بینی صعودی/نزولی: برد اگر حرکت در جهت پیش‌بینی بیشتر از باند باشد، باخت اگر خلافش، وگرنه «خنثی»
  پیش‌بینی خنثی: برد اگر |حرکت| ≤ ۳ × باند
  اگر هدف/حد ضرر داده شده باشد: هر کدام زودتر لمس شود (لمس هم‌زمان در یک کندل = باخت محافظه‌کارانه)
دقت هر منبع = برد ÷ (برد + باخت)؛ رتبه‌بندی با حد پایین بازهٔ اطمینان ویلسون (منصفانه برای نمونهٔ کم).

ورودی‌ها: data/council_log.json · scanlog.json · signals.json · predict.json · posts.json · silent_exit.json
خروجی:   data/ledger.json  +  data/ledger_anchor/<YYYY-MM-DD>.txt(.ots)

قالب پست قفل‌شدنی در کانال (هر جای متن):
  #قفل BTC صعودی ۷ روز هدف ۸۵۰۰۰ حد ضرر ۷۲۰۰۰
  (جهت: صعودی/لانگ/خرید | نزولی/شورت/فروش | خنثی/رنج — بازه: ساعت/روز/هفته، پیش‌فرض ۷ روز)
"""
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reality_common as R  # noqa: E402

GENESIS_PREV = "0" * 64
VERSION = 1
CORE = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "TON", "ADA", "AVAX", "LINK", "DOT", "TRX",
        "LTC", "NEAR", "SUI", "APT", "ARB", "OP", "PEPE", "SHIB", "UNI", "ATOM"]
MAX_NEW_PRICE_CALLS = int(os.environ.get("LEDGER_MAX_PRICE_CALLS", "40"))
FRESH_H = 36            # an item first seen later than this after its own time is not "time-locked" → skipped
L = R.L

AGENTS = {
    "technical": L("تحلیل‌گر تکنیکال", "شیکارکەری تەکنیکی", "Technical analyst"),
    "derivatives": L("تحلیل‌گر مشتقات", "شیکارکەری مەشتەقە", "Derivatives analyst"),
    "sentiment": L("تحلیل‌گر احساسات", "شیکارکەری هەست", "Sentiment analyst"),
    "macro": L("تحلیل‌گر کلان", "شیکارکەری ماکرۆ", "Macro analyst"),
    "history": L("تحلیل‌گر تاریخ بازار", "شیکارکەری مێژووی بازاڕ", "Market-history analyst"),
}
COUNCIL = L("شورای هوش مصنوعی انتخاب", "ئەنجومەنی AIی Entekhab", "Entekhab AI council")

SOURCES = {
    "channel": {"name": L("کانال کوین کورد (#قفل)", "کەناڵی کۆین کورد (#قفل)", "Coin_Kurd channel (#lock)"), "kind": "human",
                "desc": L("پیش‌بینی‌هایی که مدیر کانال با هشتگ #قفل منتشر می‌کند",
                          "ئەو پێشبینیانەی بەڕێوەبەری کەناڵ بە هاشتاگی #قفل بڵاوی دەکاتەوە",
                          "Calls the channel admin publishes with the #قفل (lock) hashtag")},
    "council.majority": {"name": L(COUNCIL["fa"] + " — رأی اکثریت", COUNCIL["ckb"] + " — دەنگی زۆرینە", COUNCIL["en"] + " — majority"),
                         "kind": "ai", "desc": L("رأی اکثریت پنج تحلیل‌گر هوش مصنوعی دربارهٔ بیت‌کوین (۷۲ ساعت)",
                                                 "دەنگی زۆرینەی پێنج شیکارکەری AI دەربارەی بیتکۆین (٧٢ کاتژمێر)",
                                                 "Majority stance of the five AI analysts on BTC (72h)")},
    "scanner": {"name": L("اسکنر فرصت‌های انتخاب (اطمینان بالا)", "سکانەری دەرفەتی Entekhab (متمانەی بەرز)", "Entekhab scanner (high confidence)"),
                "kind": "algo", "desc": L("یافته‌های پراطمینان اسکنر روی ۲۲ کوین اصلی، با هدف و حد باطل‌شدن (۷۲ ساعت)",
                                          "دۆزینەوە پڕمتمانەکانی سکانەر لەسەر ٢٢ دراوی سەرەکی (٧٢ کاتژمێر)",
                                          "High-confidence scanner findings on 22 core coins, with target and invalidation (72h)")},
    "ind.kurdistani-style-cycle": {"name": L("اندیکاتور Kurdistani Style Cycle", "ئیندیکاتۆری Kurdistani Style Cycle", "Kurdistani Style Cycle"),
                                   "kind": "indicator", "desc": L("تغییر فاز چرخهٔ بیت‌کوین", "گۆڕانی قۆناغی سووڕی بیتکۆین", "BTC cycle phase changes")},
    "ind.kurdistani-power-law": {"name": L("اندیکاتور Kurdistani Power Law", "ئیندیکاتۆری Kurdistani Power Law", "Kurdistani Power Law"),
                                 "kind": "indicator", "desc": L("خروج بیت‌کوین از باند قانون توانی", "دەرچوونی بیتکۆین لە باندی یاسای هێز", "BTC leaving its power-law band")},
    "crowd": {"name": L("خرد جمعی (بازی پیش‌بینی)", "ژیریی گشتی (یاریی پێشبینی)", "Crowd (prediction game)"), "kind": "crowd",
              "desc": L("رأی اکثریت شرکت‌کنندگان بازی پیش‌بینی ربات (حداقل ۳ رأی)", "دەنگی زۆرینەی بەشداربووانی یاریی پێشبینی (لانیکەم ٣ دەنگ)",
                        "Majority vote of the bot's prediction game (3+ votes)")},
    "silent_exit": {"name": L("آشکارساز خروج خاموش", "دۆزەرەوەی چوونەدەرەوەی بێدەنگ", "Silent-exit detector"), "kind": "algo",
                    "desc": L("هشدارهای نارنجی و قرمز = پیش‌بینی نزولی ۷ روزه", "ئاگادارییە پرتەقاڵی و سوورەکان = پێشبینیی دابەزین بۆ ٧ ڕۆژ",
                              "Orange/red alerts = 7-day bearish call")},
}
for _a, _n in AGENTS.items():
    SOURCES[f"council.{_a}"] = {"name": L(f"{COUNCIL['fa']} — {_n['fa']}", f"{COUNCIL['ckb']} — {_n['ckb']}", f"{COUNCIL['en']} — {_n['en']}"),
                                "kind": "ai", "desc": L("موضع روزانهٔ این تحلیل‌گر دربارهٔ بیت‌کوین (۷۲ ساعت)",
                                                        "هەڵوێستی ڕۆژانەی ئەم شیکارکەرە دەربارەی بیتکۆین (٧٢ کاتژمێر)",
                                                        "This analyst's daily stance on BTC (72h)")}


# ------------------------------------------------------------------ hashing / integrity
def entry_hash(e):
    return R.sha256_hex({k: v for k, v in e.items() if k != "hash"})


def verify(entries):
    """-> (ok, n_checked, first_bad_seq or None, reason)"""
    prev = GENESIS_PREV
    for i, e in enumerate(entries):
        if e.get("seq") != i + 1:
            return False, i, e.get("seq"), "seq"
        if e.get("prev") != prev:
            return False, i, e.get("seq"), "prev"
        if entry_hash(e) != e.get("hash"):
            return False, i, e.get("seq"), "hash"
        prev = e["hash"]
    return True, len(entries), None, ""


def band(h):
    return 0.001 * math.sqrt(max(1.0, float(h)))


# ------------------------------------------------------------------ candidate collectors
STANCE = {"bullish": "up", "bearish": "down", "neutral": "flat"}


def from_council(seen, now):
    out = []
    for row in R.load("council_log.json", []):
        at, btc = row.get("at"), row.get("btc")
        if not at or not btc:
            continue
        t0 = R.parse_iso(at)
        votes = []
        for agent, val in (row.get("stances") or {}).items():
            if agent not in AGENTS or not val:
                continue
            stance, conf = (val[0], val[1]) if isinstance(val, (list, tuple)) else (val, None)
            call = STANCE.get(stance)
            if not call:
                continue
            votes.append(call)
            out.append({"id": f"council.{agent}:{R.iso(t0)}", "src": f"council.{agent}", "coin": "BTC", "call": call,
                        "t0": R.iso(t0), "p0": float(btc), "h": 72, "note": f"confidence {conf}/5" if conf else "",
                        "ref": "/terminal/#council", "logged": R.iso(t0), "via": "council_log.json"})
        if votes:
            up, down, flat = votes.count("up"), votes.count("down"), votes.count("flat")
            best = max(up, down, flat)
            if [up, down, flat].count(best) == 1:          # a tie is not a call
                call = "up" if best == up else "down" if best == down else "flat"
                out.append({"id": f"council.majority:{R.iso(t0)}", "src": "council.majority", "coin": "BTC", "call": call,
                            "t0": R.iso(t0), "p0": float(btc), "h": 72, "note": f"{up}↑ {down}↓ {flat}→",
                            "ref": "/terminal/#council", "logged": R.iso(t0), "via": "council_log.json"})
    return [c for c in out if c["id"] not in seen]


def from_scanner(seen, now):
    s = R.load("scanlog.json", {})
    live = s.get("live_since")
    if not live:
        return []
    out = []
    for x in s.get("items", []):
        if x.get("conf") != "high" or x.get("coin") not in CORE or x.get("t", "") < live:
            continue
        cid = f"scanner:{x['id']}"
        if cid in seen or not x.get("price"):
            continue
        call = {"bull": "up", "bear": "down"}.get(x.get("dir"))
        if not call:
            continue
        t0 = R.parse_iso(x["t"])
        c = {"id": cid, "src": "scanner", "coin": x["coin"], "call": call, "t0": R.iso(t0), "p0": float(x["price"]), "h": 72,
             "note": x.get("type", ""), "ref": f"/coins/{x['coin'].lower()}/", "logged": R.iso(t0), "via": "scanlog.json"}
        if x.get("target"):
            c["target"] = float(x["target"])
        if x.get("inval"):
            c["stop"] = float(x["inval"])
        out.append(c)
    return out


def from_indicators(seen, now):
    s = R.load("signals.json", {})
    hz = {ind: (st or {}).get("h") for ind, st in (s.get("stats") or {}).items()}
    out = []
    for x in s.get("signals", []):
        call = {"long": "up", "short": "down"}.get(x.get("side"))
        if not call or not x.get("t") or not x.get("price"):
            continue
        cid = f"ind:{x['id']}"
        if cid in seen:
            continue
        t0 = R.parse_iso(x["t"])
        if (now - t0).total_seconds() > FRESH_H * 3600:      # older state changes were not seen live
            continue
        hstr = str(hz.get(x.get("ind")) or "7d")
        m = re.match(r"(\d+)\s*([dh])", hstr)
        h = int(m.group(1)) * (24 if m.group(2) == "d" else 1) if m else 168
        coin = (x.get("sym") or "BTCUSDT").replace("USDT", "")
        out.append({"id": cid, "src": f"ind.{x['ind']}", "coin": coin, "call": call, "t0": R.iso(t0), "p0": float(x["price"]),
                    "h": h, "note": f"{x.get('prev', '')} → {x.get('state', '')}", "ref": "/indicators/", "logged": R.iso(now),
                    "via": "signals.json"})
    return out


def from_crowd(seen, now):
    out = []
    for r in R.load("predict.json", {}).get("rounds", []):
        cid = f"crowd:{r.get('id')}"
        if cid in seen or not r.get("close") or not r.get("settle") or not r.get("target"):
            continue
        close, settle = R.parse_iso(r["close"]), R.parse_iso(r["settle"])
        tally, n = r.get("tally") or [], r.get("n") or 0
        if now < close or now >= settle or n < 3 or len(tally) != 2 or tally[0] == tally[1]:
            continue                                           # voting still open / outcome already known / too few votes / tie
        opts = [str(o) for o in r.get("opts", [])]
        win = 0 if tally[0] > tally[1] else 1
        label = opts[win] if win < len(opts) else ""
        call = "up" if ("بالا" in label or "📈" in label) else "down" if ("پایین" in label or "📉" in label) else None
        if not call:
            continue
        out.append({"id": cid, "src": "crowd", "coin": "BTC", "call": call, "t0": R.iso(close), "p0": float(r["target"]),
                    "h": round((settle - close).total_seconds() / 3600, 2), "note": f"{tally[0]}/{tally[1]} votes · strict",
                    "ref": "/predict/", "logged": R.iso(now), "via": "predict.json", "strict": True, "round": r.get("id")})
    return out


def from_silent_exit(seen, now):
    out = []
    for a in R.load("silent_exit.json", {}).get("alerts", []):
        if a.get("level") not in ("orange", "red"):
            continue
        cid = f"silent_exit:{a.get('id')}"
        if cid in seen or not a.get("p0") or not a.get("t"):
            continue
        t0 = R.parse_iso(a["t"])
        if (now - t0).total_seconds() > FRESH_H * 3600:
            continue
        out.append({"id": cid, "src": "silent_exit", "coin": a.get("coin", "BTC"), "call": "down", "t0": R.iso(t0),
                    "p0": float(a["p0"]), "h": 168, "note": a.get("level"), "ref": "/silent-exit/", "logged": R.iso(t0),
                    "via": "silent_exit.json"})
    return out


# ----- explicit #قفل calls in the channel (and optional external public channels)
LOCK_TAGS = {"قفل", "سیگنال_قفل", "lock", "LOCK", "قفل_سیگنال"}
UP_RX = re.compile(r"صعودی|لانگ|\blong\b|\bup\b|\bbull|گاوی|خرید", re.I)
DOWN_RX = re.compile(r"نزولی|شورت|\bshort\b|\bdown\b|\bbear|خرسی|فروش", re.I)
FLAT_RX = re.compile(r"خنثی|رنج|\bneutral\b|\brange\b|\bflat\b", re.I)
HZ_RX = re.compile(r"(\d+(?:\.\d+)?)\s*(ساعت|روز|هفته|ماه|h\b|hour|d\b|day|w\b|week)", re.I)
NUMRX = r"(\d[\d,]*(?:\.\d+)?)"
TGT_RX = re.compile(r"(?:هدف|تارگت|حد\s*سود|target|tp\d?)\s*[:：=]?\s*" + NUMRX, re.I)
STOP_RX = re.compile(r"(?:حد\s*ضرر|استاپ|stop(?:\s*loss)?|\bsl\b)\s*[:：=]?\s*" + NUMRX, re.I)
TICKER_RX = re.compile(r"\b([A-Z][A-Z0-9]{1,9})(?:/?USDT)?\b")
NOT_TICKERS = {"USDT", "USD", "USDC", "ETF", "SEC", "AI", "TP", "SL", "UP", "LOCK", "CEO", "NFT", "DEFI", "RSI", "EMA", "ATH"}


def parse_lock_call(text, tags, coins_hint=()):
    """'#قفل BTC صعودی ۷ روز هدف ۸۵۰۰۰ حد ضرر ۷۲۰۰۰' -> {coin, call, h, target?, stop?} or None"""
    if not (set(tags or []) & LOCK_TAGS or re.search(r"#(قفل|سیگنال_قفل|lock)\b", text or "", re.I)):
        return None
    t = (text or "").translate(R.FA_DIGITS)
    # the line with the hashtag carries the call; fall back to the whole post
    line = next((ln for ln in t.split("\n") if re.search(r"#(قفل|سیگنال_قفل|lock)", ln, re.I)), t)
    coin = next((m.group(1) for m in TICKER_RX.finditer(line) if m.group(1) not in NOT_TICKERS), None)
    if not coin:
        coin = next((m.group(1) for m in TICKER_RX.finditer(t) if m.group(1) not in NOT_TICKERS), None)
    if not coin and coins_hint:
        coin = coins_hint[0]
    up, down, flat = UP_RX.search(line), DOWN_RX.search(line), FLAT_RX.search(line)
    if sum(bool(x) for x in (up, down, flat)) != 1:
        up, down, flat = UP_RX.search(t), DOWN_RX.search(t), FLAT_RX.search(t)
        if sum(bool(x) for x in (up, down, flat)) != 1:
            return None                                       # no direction, or contradictory words
    call = "up" if up else "down" if down else "flat"
    h = 168
    m = HZ_RX.search(line) or HZ_RX.search(t)
    if m:
        v, u = float(m.group(1)), m.group(2).lower()
        mult = 1 if u in ("ساعت", "h", "hour") else 24 if u in ("روز", "d", "day") else 168 if u in ("هفته", "w", "week") else 720
        h = v * mult
    h = max(1.0, min(h, 90 * 24.0))
    if not coin:
        return None
    out = {"coin": coin.upper(), "call": call, "h": round(h, 2)}
    tg, st = TGT_RX.search(t), STOP_RX.search(t)
    if tg and call != "flat":
        out["target"] = R.num(tg.group(1))
    if st and call != "flat":
        out["stop"] = R.num(st.group(1))
    return out


def from_channel(seen, now, genesis):
    out = []
    g = R.parse_iso(genesis) - R.timedelta(days=1)
    for p in R.load("posts.json", []):
        if not p.get("date") or R.parse_iso(p["date"]) < g:
            continue
        cid = f"channel:{p.get('id')}"
        if cid in seen:
            continue
        call = parse_lock_call(p.get("text", ""), p.get("hashtags", []), p.get("coins") or [])
        if not call:
            continue
        t0 = R.parse_iso(p["date"])
        if (now - t0).total_seconds() > FRESH_H * 3600:
            continue
        c = {"id": cid, "src": "channel", "t0": R.iso(t0), "ref": p.get("url") or f"https://t.me/Coin_Kurd/{p.get('id')}",
             "logged": R.iso(now), "via": "posts.json", "note": ""}
        c.update(call)
        out.append(c)
    return out


def from_external(seen, now):
    """optional: public channels listed in scripts/ledger_external.json [{"handle":"...","name":{"fa","ckb","en"}}]"""
    try:
        cfg = json.load(open(os.path.join(R.HERE, "ledger_external.json"), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return []
    out = []
    for ch in cfg or []:
        handle = ch.get("handle")
        if not handle:
            continue
        src = f"ext.{handle}"
        SOURCES.setdefault(src, {"name": ch.get("name") or L(handle, handle, handle), "kind": "external",
                                 "desc": L(f"کانال عمومی t.me/{handle}", f"کەناڵی گشتیی t.me/{handle}", f"Public channel t.me/{handle}")})
        try:
            page = R.tg_page(handle)
        except Exception as ex:  # noqa: BLE001
            print(f"  external {handle}: {ex}")
            continue
        for p in page:
            cid = f"{src}:{p['id']}"
            if cid in seen or (now - p["t"]).total_seconds() > FRESH_H * 3600:
                continue
            call = parse_lock_call(p["text"], p["tags"])
            if call:
                c = {"id": cid, "src": src, "t0": R.iso(p["t"]), "ref": f"https://t.me/{handle}/{p['id']}", "logged": R.iso(now),
                     "via": "t.me", "note": ""}
                c.update(call)
                out.append(c)
    return out


# ------------------------------------------------------------------ settlement
def settle_one(e, bars, now_ms):
    """bars: 1h klines (ascending) that cover the entry. -> result dict or None if not settleable yet"""
    t0, h = R.ms(e["t0"]), float(e["h"])
    t_end = t0 + int(h * R.H)
    end_bar = next((b for b in bars if b["t"] >= t_end), None)       # first hourly candle at/after the horizon
    if end_bar is None or end_bar["t"] > now_ms:
        return None
    p0, p_end = float(e["p0"]), end_bar["o"]
    path = [b for b in bars if b["t"] >= (t0 // R.H + 1) * R.H and b["t"] < end_bar["t"]]   # full hours inside the window
    sign = 1 if e["call"] == "up" else -1 if e["call"] == "down" else 0
    hi = max([b["h"] for b in path] + [p0, p_end])
    lo = min([b["l"] for b in path] + [p0, p_end])
    if sign >= 0:
        mfe, mae = hi / p0 - 1, lo / p0 - 1
    else:
        mfe, mae = 1 - lo / p0, 1 - hi / p0
    r = p_end / p0 - 1
    exit_, outcome, edge = "horizon", None, r * sign
    tgt = float(e["target"]) if e.get("target") else None
    stop = float(e["stop"]) if e.get("stop") else None
    if sign and (tgt or stop):
        for b in path:
            hit_t = tgt and ((sign > 0 and b["h"] >= tgt) or (sign < 0 and b["l"] <= tgt))
            hit_s = stop and ((sign > 0 and b["l"] <= stop) or (sign < 0 and b["h"] >= stop))
            if hit_s:                                    # stop first (or both in one candle → conservative loss)
                exit_, outcome, edge = "stop", "loss", (stop / p0 - 1) * sign
                break
            if hit_t:
                exit_, outcome, edge = "target", "win", (tgt / p0 - 1) * sign
                break
    if outcome is None:
        b = 0.0 if e.get("strict") else band(h)
        if sign == 0:
            outcome = "win" if abs(r) <= 3 * band(h) else "loss"
            edge = None
        elif r * sign > b:
            outcome = "win"
        elif r * sign < -b:
            outcome = "loss"
        else:
            outcome = "flat"
    return {"at": R.iso(R.from_ms(end_bar["t"])), "p1": round(p_end, 10), "r": round(r * 100, 3),
            "edge": None if edge is None else round(edge * 100, 3), "outcome": outcome, "exit": exit_,
            "mfe": round(mfe * 100, 3), "mae": round(mae * 100, 3), "band": round(band(h) * 100, 3)}


def settle(entries, results, now):
    now_ms = R.ms(now)
    due = [e for e in entries if e["id"] not in results and R.ms(e["t0"]) + float(e["h"]) * R.H + R.H <= now_ms]
    by_coin = {}
    for e in due:
        by_coin.setdefault(e["coin"], []).append(e)
    n = 0
    for coin, es in by_coin.items():
        start = min(R.ms(e["t0"]) for e in es) // R.H * R.H
        end = max(R.ms(e["t0"]) + int(float(e["h"]) * R.H) for e in es) + 2 * R.H
        try:
            bars = R.klines_range(coin, "1h", start, min(end, now_ms))
        except Exception as ex:  # noqa: BLE001
            print(f"  settle {coin}: {ex}")
            continue
        for e in es:
            res = settle_one(e, bars, now_ms)
            if res:
                results[e["id"]] = res
                n += 1
    return n


# ------------------------------------------------------------------ stats
def stats(entries, results):
    by = {}
    for e in entries:
        by.setdefault(e["src"], []).append(e)
    out = {}
    for src, es in by.items():
        settled = sorted(((e, results[e["id"]]) for e in es if e["id"] in results), key=lambda x: x[1]["at"])
        w = sum(1 for _, r in settled if r["outcome"] == "win")
        lo = sum(1 for _, r in settled if r["outcome"] == "loss")
        fl = sum(1 for _, r in settled if r["outcome"] == "flat")
        edges = [r["edge"] for _, r in settled if r.get("edge") is not None]
        curve, cw, cl = [], 0, 0
        for e, r in settled:
            cw += r["outcome"] == "win"
            cl += r["outcome"] == "loss"
            if cw + cl:
                curve.append([r["at"][:10], round(100 * cw / (cw + cl), 1), cw + cl])
        # one point per day (the last of the day), at most 180 points
        daily = {}
        for d, a, n in curve:
            daily[d] = [d, a, n]
        curve = list(daily.values())[-180:]
        last20 = [r for _, r in settled if r["outcome"] in ("win", "loss")][-20:]
        coins = {}
        for e in es:
            coins[e["coin"]] = coins.get(e["coin"], 0) + 1
        out[src] = {"n": len(es), "open": len(es) - len(settled), "settled": len(settled), "win": w, "loss": lo, "flat": fl,
                    "acc": round(100 * w / (w + lo), 1) if w + lo else None, "wlb": round(100 * R.wilson_lb(w, w + lo), 1) if w + lo else None,
                    "acc20": round(100 * sum(1 for r in last20 if r["outcome"] == "win") / len(last20), 1) if last20 else None,
                    "edge": round(sum(edges) / len(edges), 3) if edges else None, "last": max(e["t0"] for e in es),
                    "curve": curve, "coins": dict(sorted(coins.items(), key=lambda kv: -kv[1])[:8])}
    board = sorted([s for s in out if (out[s]["win"] + out[s]["loss"]) >= 5], key=lambda s: (-(out[s]["wlb"] or 0), -(out[s]["acc"] or 0)))
    return out, board


# ------------------------------------------------------------------ OpenTimestamps anchoring (best effort)
CALENDARS = ["https://a.pool.opentimestamps.org", "https://b.pool.opentimestamps.org", "https://a.pool.eternitywall.com"]
ANCHOR_DIR = "ledger_anchor"


def anchor_text(date, head, n):
    return (f"entekhab.net signal ledger anchor\n"
            f"date: {date}\nentries: {n}\nhead: {head}\n"
            f"verify: https://entekhab.net/ledger/\n")


def _ots():
    try:
        from opentimestamps.calendar import RemoteCalendar
        from opentimestamps.core.notary import BitcoinBlockHeaderAttestation, PendingAttestation
        from opentimestamps.core.op import OpSHA256
        from opentimestamps.core.serialize import BytesDeserializationContext, StreamSerializationContext
        from opentimestamps.core.timestamp import DetachedTimestampFile, Timestamp
        return {"RemoteCalendar": RemoteCalendar, "BTC": BitcoinBlockHeaderAttestation, "Pending": PendingAttestation,
                "OpSHA256": OpSHA256, "BDC": BytesDeserializationContext, "SSC": StreamSerializationContext,
                "DTF": DetachedTimestampFile, "Timestamp": Timestamp}
    except Exception as ex:  # noqa: BLE001
        print("  opentimestamps not available:", ex)
        return None


TRUSTED = (".calendar.opentimestamps.org", ".calendar.eternitywall.com", ".calendar.catallaxy.com")


def _trusted_calendar(uri):
    """the pool URLs hand out pending attestations that point at their member calendars (same whitelist as the ots client)"""
    from urllib.parse import urlparse
    try:
        u = urlparse(uri)
    except Exception:  # noqa: BLE001
        return False
    host = (u.hostname or "").lower()
    return u.scheme == "https" and (uri.rstrip("/") in CALENDARS or any(host.endswith(t) for t in TRUSTED))


def _ots_write(O, dtf, path):
    import io
    buf = io.BytesIO()
    dtf.serialize(O["SSC"](buf))
    with open(path, "wb") as f:
        f.write(buf.getvalue())


def _ots_status(O, ts):
    blocks = [a.height for _, a in ts.all_attestations() if isinstance(a, O["BTC"])]
    return ("bitcoin", min(blocks)) if blocks else ("pending", None)


def anchor(led, now):
    """once per UTC day: timestamp the chain head; and try to upgrade older pending proofs"""
    anchors = led.setdefault("anchors", [])
    today = now.strftime("%Y-%m-%d")
    adir = os.path.join(R.D, ANCHOR_DIR)
    os.makedirs(adir, exist_ok=True)
    O = None
    if led.get("head") and not any(a["date"] == today for a in anchors):
        txt = anchor_text(today, led["head"], len(led["entries"]))
        fn = os.path.join(adir, f"{today}.txt")
        with open(fn, "w", encoding="utf-8") as f:
            f.write(txt)
        rec = {"date": today, "created": R.iso(now), "head": led["head"], "n": len(led["entries"]),
               "file": f"/data/{ANCHOR_DIR}/{today}.txt", "sha256": R.sha256_hex(txt.encode("utf-8")), "status": "unsent"}
        O = _ots()
        if O:
            digest = bytes.fromhex(rec["sha256"])
            dtf = O["DTF"](O["OpSHA256"](), O["Timestamp"](digest))
            ok = 0
            for url in CALENDARS:
                try:
                    dtf.timestamp.merge(O["RemoteCalendar"](url, "entekhab.net").submit(digest, timeout=15))
                    ok += 1
                except Exception as ex:  # noqa: BLE001
                    print(f"  ots {url}: {str(ex)[:80]}")
            if ok:
                _ots_write(O, dtf, fn + ".ots")
                rec.update({"ots": rec["file"] + ".ots", "status": "pending", "calendars": ok})
        anchors.append(rec)
    # upgrade pending proofs that are at least 6 hours old (Bitcoin confirmation takes a few hours)
    for a in anchors:
        if a.get("status") != "pending" or not a.get("ots"):
            continue
        if (now - R.parse_iso(a.get("created") or a["date"] + "T00:00:00+00:00")).total_seconds() < 6 * 3600:
            continue
        O = O or _ots()
        if not O:
            break
        path = os.path.join(R.D, ANCHOR_DIR, os.path.basename(a["ots"]))
        try:
            with open(path, "rb") as f:
                dtf = O["DTF"].deserialize(O["BDC"](f.read()))
            changed = False

            def tips(st):
                if st.attestations:
                    yield st
                for sub in st.ops.values():
                    yield from tips(sub)
            for st in list(tips(dtf.timestamp)):
                for att in list(st.attestations):
                    if isinstance(att, O["Pending"]) and _trusted_calendar(att.uri):
                        try:
                            st.merge(O["RemoteCalendar"](att.uri, "entekhab.net").get_timestamp(st.msg, timeout=15))
                            changed = True
                        except Exception as ex:  # noqa: BLE001
                            print(f"  ots upgrade {a['date']} {att.uri}: {str(ex)[:60]}")
            status, block = _ots_status(O, dtf.timestamp)
            if changed:
                _ots_write(O, dtf, path)
            a["status"] = status
            if block:
                a["block"] = block
        except Exception as ex:  # noqa: BLE001
            print(f"  ots upgrade {a.get('date')}: {ex}")
    led["anchors"] = anchors[-400:]


# ------------------------------------------------------------------ main
def main():
    now = R.now()
    led = R.load("ledger.json", {})
    entries = led.get("entries", [])
    results = led.get("results", {})
    genesis = led.get("genesis") or R.iso(now)
    ok, n_ok, bad, why = verify(entries)
    if not ok:
        print(f"!! ledger chain broken at seq {bad} ({why}) — new entries are still appended, the page shows the break")
    seen = {e["id"] for e in entries}

    cands = []
    for name, fn in (("council", from_council), ("scanner", from_scanner), ("indicators", from_indicators),
                     ("crowd", from_crowd), ("silent_exit", from_silent_exit), ("external", from_external)):
        try:
            got = fn(seen, now)
            cands += got
            print(f"  {name}: {len(got)} new")
        except Exception as ex:  # noqa: BLE001
            print(f"  {name} failed: {ex}")
    try:
        got = from_channel(seen, now, genesis)
        cands += got
        print(f"  channel: {len(got)} new")
    except Exception as ex:  # noqa: BLE001
        print(f"  channel failed: {ex}")

    # price at publication for calls that do not carry one (Binance 1-minute open)
    calls = 0
    ready = []
    for c in sorted(cands, key=lambda c: (c["t0"], c["id"])):
        if c["id"] in seen:
            continue
        if not c.get("p0"):
            if calls >= MAX_NEW_PRICE_CALLS:
                continue
            calls += 1
            c["p0"] = R.price_at(c["coin"], R.ms(c["t0"]))
            if not c.get("p0"):
                print(f"  no price for {c['coin']} at {c['t0']} — retry next run")
                continue
        seen.add(c["id"])
        ready.append(c)

    prev = entries[-1]["hash"] if entries else GENESIS_PREV
    for c in ready:
        # every locked field is a string (numbers in canonical decimal form) → the same hash in Python and in the browser
        e = {"seq": len(entries) + 1, "id": c["id"], "src": c["src"], "coin": c["coin"], "call": c["call"],
             "t0": c["t0"], "p0": R.fnum(c["p0"]), "h": R.fnum(c["h"]), "locked": R.iso(now), "logged": c.get("logged") or "",
             "via": c.get("via") or "", "ref": c.get("ref") or "", "note": str(c.get("note") or ""), "prev": prev}
        for k in ("target", "stop"):
            if c.get(k):
                e[k] = R.fnum(c[k])
        if c.get("strict"):
            e["strict"] = "1"
        e["hash"] = entry_hash(e)
        prev = e["hash"]
        entries.append(e)

    n_settled = settle(entries, results, now)
    mk = {c["coin"]: c.get("price") for c in R.load("market.json", {}).get("coins", []) if c.get("price")}
    live = {}
    for e in entries:
        if e["id"] not in results and mk.get(e["coin"]):
            live[e["id"]] = round((mk[e["coin"]] / float(e["p0"]) - 1) * 100, 3)
    st, board = stats(entries, results)
    ok2, n_ok2, bad2, why2 = verify(entries)
    led.update({"version": VERSION, "updated_at": R.iso(now), "genesis": genesis, "n": len(entries),
                "head": entries[-1]["hash"] if entries else None, "entries": entries, "results": results, "live": live,
                "stats": st, "board": board, "sources": {k: SOURCES[k] for k in sorted(SOURCES) if k in st or k in SOURCES},
                "integrity": {"ok": ok2, "checked": n_ok2, "bad_seq": bad2, "why": why2, "at": R.iso(now)},
                "method": {"band": "0.1% × sqrt(hours)", "end_price": "open of the first 1h Binance candle at/after the horizon",
                           "flat_call": "win if |move| <= 3 × band", "target_stop": "whichever is touched first; both in one candle = loss",
                           "rank": "Wilson 95% lower bound of win/(win+loss), min 5 decided calls"}})
    try:
        anchor(led, now)
    except Exception as ex:  # noqa: BLE001
        print("  anchor failed:", ex)
    R.save("ledger.json", led)
    print(f"ledger: +{len(ready)} entries (total {len(entries)}), settled +{n_settled}, open {len(live)}, chain ok={ok2}, "
          f"board={board[:5]}")


if __name__ == "__main__":
    main()
