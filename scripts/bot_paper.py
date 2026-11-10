"""
Paper trading inside the bot, and the public leaderboard built from it (data/leaderboard.json → /leaderboard/).

Why in the bot and not on the site: paper trades kept in a browser can be edited by their owner, so a public table
built from them could be faked. Here every open and close is priced by the bot itself from Binance at the moment of
the tap, with the bot's own clock; a user can only open, close, or delete everything.

Rules (shown to the user):
  * every account starts with $10,000 of virtual money; no leverage; a position uses 10%, 25% or 50% of free cash
  * 0.1% fee on each side; a short that loses more than its stake is closed at −100% of the stake
  * at most 5 open positions; prices from Binance spot (data-api.binance.vision), USDT pairs
  * nothing is public unless the user opts in with a nickname; at least 10 closed trades to be ranked
  * ranking uses realised results only (closed trades), after fees; drawdown on the realised equity curve
"""
import html
import re
import time
from datetime import datetime, timezone

import requests

from bot_i18n import pick

START, FEE, MAX_OPEN, MIN_RANK = 10_000.0, 0.001, 5, 10
COINS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "TON", "TRX", "AVAX", "LINK", "SUI"]
SIZES = (10, 25, 50)
API = "https://data-api.binance.vision/api/v3/ticker/price"

T = {
    "title": {"fa": "معاملهٔ آزمایشی", "ckb": "مامەڵەی تاقیکاری", "en": "Paper trading", "kmr": "Bazirganiya ceribandinê", "ar": "التداول التجريبي"},
    "intro": {"fa": "با ۱۰٬۰۰۰ دلار مجازی معامله کن. قیمت هر خرید و فروش را خود ربات همان لحظه از بایننس می‌گیرد، پس نتیجه‌ها واقعی و غیرقابل دستکاری‌اند. کارمزد هر طرف ۰٫۱٪، بدون اهرم.",
              "ckb": "بە ١٠٬٠٠٠ دۆلاری مەجازی مامەڵە بکە. نرخی هەر کڕین و فرۆشتنێک بۆتەکە خۆی هەمان ساتە لە بایننس وەردەگرێت، بۆیە ئەنجامەکان ڕاستەقینە و دەستکارینەکراون. کرێی هەر لایەک ٠٫١٪، بێ لیڤەرێج.",
              "en": "Trade $10,000 of virtual money. The bot itself takes each buy and sell price from Binance at that moment, so results are real and cannot be edited. 0.1% fee each side, no leverage."},
    "equity": {"fa": "دارایی محقق‌شده", "ckb": "سامانی بەدەستهاتوو", "en": "Realised equity"},
    "cash": {"fa": "نقد آزاد", "ckb": "پارەی ئازاد", "en": "Free cash"},
    "open": {"fa": "پوزیشن‌های باز", "ckb": "پۆزیشنە کراوەکان", "en": "Open positions"},
    "none": {"fa": "پوزیشن بازی نداری.", "ckb": "پۆزیشنی کراوەت نییە.", "en": "No open positions."},
    "stats": {"fa": "معامله‌های بسته‌شده", "ckb": "مامەڵە داخراوەکان", "en": "Closed trades"},
    "win": {"fa": "نرخ برد", "ckb": "ڕێژەی بردنەوە", "en": "win rate"},
    "mdd": {"fa": "بیشترین افت", "ckb": "زۆرترین داکەوتن", "en": "max drawdown"},
    "pub_on": {"fa": "🌐 در جدول برترین‌ها با نام «{n}» نمایش داده می‌شوی (از {k} معاملهٔ بسته‌شده به بعد).",
               "ckb": "🌐 لە خشتەی باشترینەکان بە ناوی «{n}» پیشان دەدرێیت (لە {k} مامەڵەی داخراو بەدواوە).",
               "en": "🌐 You appear on the leaderboard as “{n}” (from {k} closed trades on)."},
    "pub_off": {"fa": "🔒 نتیجه‌هایت خصوصی است.", "ckb": "🔒 ئەنجامەکانت تایبەتن.", "en": "🔒 Your results are private."},
    "b_new": {"fa": "➕ معاملهٔ جدید", "ckb": "➕ مامەڵەی نوێ", "en": "➕ New trade"},
    "b_close": {"fa": "✖️ بستن", "ckb": "✖️ داخستن", "en": "✖️ Close"},
    "b_pub": {"fa": "🌐 نمایش در جدول برترین‌ها", "ckb": "🌐 پیشاندان لە خشتەی باشترینەکان", "en": "🌐 Show me on the leaderboard"},
    "b_priv": {"fa": "🔒 خصوصی شود", "ckb": "🔒 تایبەت بێت", "en": "🔒 Make private"},
    "b_nick": {"fa": "✏️ نام مستعار", "ckb": "✏️ ناوی خوازراو", "en": "✏️ Nickname"},
    "b_del": {"fa": "🗑 حذف کامل حساب", "ckb": "🗑 سڕینەوەی تەواوی هەژمار", "en": "🗑 Delete account"},
    "b_board": {"fa": "🏆 جدول برترین‌ها", "ckb": "🏆 خشتەی باشترینەکان", "en": "🏆 Leaderboard"},
    "pick_coin": {"fa": "کدام ارز؟", "ckb": "کام دراو؟", "en": "Which coin?"},
    "pick_side": {"fa": "{c}: خرید (لانگ) یا فروش (شورت)؟", "ckb": "{c}: کڕین (لۆنگ) یان فرۆشتن (شۆرت)؟", "en": "{c}: buy (long) or sell (short)?"},
    "long": {"fa": "📈 لانگ", "ckb": "📈 لۆنگ", "en": "📈 Long"}, "short": {"fa": "📉 شورت", "ckb": "📉 شۆرت", "en": "📉 Short"},
    "pick_size": {"fa": "چند درصد از نقد آزاد ({c})؟", "ckb": "چەند لەسەدی پارەی ئازاد ({c})؟", "en": "What share of free cash ({c})?"},
    "opened": {"fa": "✅ باز شد: {side} {c} به ارزش {u} با قیمت {p}", "ckb": "✅ کرایەوە: {side} {c} بە بەهای {u} بە نرخی {p}",
               "en": "✅ Opened: {side} {c} worth {u} at {p}"},
    "closed": {"fa": "✅ بسته شد: {c} با قیمت {p} — نتیجه {r} ({u})", "ckb": "✅ داخرا: {c} بە نرخی {p} — ئەنجام {r} ({u})",
               "en": "✅ Closed: {c} at {p} — result {r} ({u})"},
    "confirm_close": {"fa": "بستن {side} {c} با قیمت حدود {p}؟ سود/زیان فعلی: {r}", "ckb": "داخستنی {side} {c} بە نرخی نزیکەی {p}؟ ئێستا: {r}",
                      "en": "Close {side} {c} at about {p}? Current P/L: {r}"},
    "yes": {"fa": "بله", "ckb": "بەڵێ", "en": "Yes"}, "no": {"fa": "نه", "ckb": "نەخێر", "en": "No"},
    "max": {"fa": "حداکثر ۵ پوزیشن باز مجاز است.", "ckb": "زۆرترین ٥ پۆزیشنی کراوە ڕێگەپێدراوە.", "en": "At most 5 open positions."},
    "nocash": {"fa": "نقد آزاد کافی نیست.", "ckb": "پارەی ئازاد بەس نییە.", "en": "Not enough free cash."},
    "noprice": {"fa": "قیمت از بایننس دریافت نشد؛ چند لحظهٔ دیگر دوباره امتحان کن. چیزی ثبت نشد.",
                "ckb": "نرخ لە بایننس وەرنەگیرا؛ دواتر هەوڵ بدەرەوە. هیچ شتێک تۆمار نەکرا.", "en": "Could not get the Binance price; try again shortly. Nothing was recorded."},
    "ask_nick": {"fa": "یک نام مستعار بفرست (۲ تا ۲۰ حرف، بدون لینک و @). همین نام در جدول دیده می‌شود.",
                 "ckb": "ناوێکی خوازراو بنێرە (٢ تا ٢٠ پیت، بێ بەستەر و @). هەمان ناو لە خشتەکەدا دەبینرێت.",
                 "en": "Send a nickname (2–20 characters, no links or @). This is the name shown on the board."},
    "bad_nick": {"fa": "این نام قابل قبول نیست؛ ۲ تا ۲۰ حرف، بدون لینک و @.", "ckb": "ئەم ناوە پەسەند نییە؛ ٢ تا ٢٠ پیت، بێ بەستەر و @.",
                 "en": "That name is not accepted: 2–20 characters, no links or @."},
    "nick_ok": {"fa": "✅ نام مستعار: {n}", "ckb": "✅ ناوی خوازراو: {n}", "en": "✅ Nickname: {n}"},
    "need_nick": {"fa": "اول یک نام مستعار انتخاب کن.", "ckb": "سەرەتا ناوێکی خوازراو هەڵبژێرە.", "en": "Choose a nickname first."},
    "del_q": {"fa": "همهٔ معامله‌ها و جایگاهت در جدول برای همیشه پاک شود؟", "ckb": "هەموو مامەڵەکان و شوێنت لە خشتەکە بۆ هەمیشە بسڕدرێتەوە؟",
              "en": "Delete all your trades and your place on the board for good?"},
    "deleted": {"fa": "🗑 حساب آزمایشی پاک شد.", "ckb": "🗑 هەژماری تاقیکاری سڕایەوە.", "en": "🗑 Paper account deleted."},
    "rules": {"fa": "قواعد: بدون اهرم · کارمزد ۰٫۱٪ هر طرف · حداکثر ۵ پوزیشن · رتبه فقط بعد از ۱۰ معاملهٔ بسته‌شده و فقط با رضایت خودت · فقط نتیجهٔ محقق‌شده حساب می‌شود.",
              "ckb": "یاساکان: بێ لیڤەرێج · کرێ ٠٫١٪ هەر لایەک · زۆرترین ٥ پۆزیشن · پلە تەنها دوای ١٠ مامەڵەی داخراو و تەنها بە ڕەزامەندیی خۆت · تەنها ئەنجامی بەدەستهاتوو دەژمێردرێت.",
              "en": "Rules: no leverage · 0.1% fee each side · at most 5 positions · ranked only after 10 closed trades and only if you opt in · only realised results count."},
}


def L(key, lang, **kw):
    """fa / ckb / en as written; Kurmanji and Arabic through bot_i18n.pick (its tables, then English)"""
    d = T[key]
    v = d.get(lang) or (pick(d, lang) if lang in ("kmr", "ar") else d["fa"])
    return v.format(**kw) if kw else v


def fp(x):
    return "$" + (f"{x:,.2f}" if x >= 1 else f"{x:.5f}")


def fu(x):
    return ("-" if x < 0 else "") + "$" + f"{abs(x):,.0f}"


def fpc(x):
    return f"{x * 100:+.2f}%"


def price(coin):
    """live Binance price, or None — never a guess"""
    try:
        r = requests.get(API, params={"symbol": f"{coin}USDT"}, timeout=8)
        if r.ok:
            p = float(r.json()["price"])
            return p if p > 0 else None
    except Exception:  # noqa: BLE001
        pass
    return None


def acct(s, uid, create=True):
    P = s.setdefault("paper", {})
    k = str(uid)
    if k not in P and create:
        P[k] = {"cash": START, "pos": [], "closed": [], "pub": False, "nick": None, "created": int(time.time()), "nid": 0}
    return P.get(k)


def realised(a):
    return a["cash"] + sum(p["usd"] for p in a["pos"])


def pnl_of(p, px):
    """net P/L in dollars of closing position p at px (fees on both sides; a short cannot lose more than its stake)"""
    if p["side"] == "L":
        v = p["qty"] * px * (1 - FEE) - p["usd"]
    else:
        v = p["qty"] * (p["px"] - px) - p["usd"] * FEE - p["qty"] * px * FEE
    return max(-p["usd"], v)


def open_pos(s, uid, coin, side, size):
    a = acct(s, uid)
    if coin not in COINS or side not in ("L", "S") or size not in SIZES:
        return None, "noprice"
    if len(a["pos"]) >= MAX_OPEN:
        return None, "max"
    usd = round(a["cash"] * size / 100, 2)
    if usd < 10:
        return None, "nocash"
    px = price(coin)
    if not px:
        return None, "noprice"
    a["nid"] += 1
    qty = usd * (1 - FEE) / px if side == "L" else usd / px
    p = {"id": a["nid"], "coin": coin, "side": side, "usd": usd, "qty": qty, "px": px, "ts": int(time.time())}
    a["cash"] -= usd
    a["pos"].append(p)
    return p, None


def close_pos(s, uid, pid):
    a = acct(s, uid, create=False)
    p = next((x for x in (a or {}).get("pos", []) if x["id"] == pid), None)
    if not p:
        return None, "none"
    px = price(p["coin"])
    if not px:
        return None, "noprice"
    before = realised(a)
    v = pnl_of(p, px)
    a["pos"].remove(p)
    a["cash"] += p["usd"] + v
    a["closed"].append({"coin": p["coin"], "side": p["side"], "usd": p["usd"], "pin": p["px"], "pout": px,
                        "tin": p["ts"], "tout": int(time.time()), "pnl": round(v, 2), "eq0": round(before, 2)})
    del a["closed"][:-500]
    return a["closed"][-1], None


def stats(closed, since=0):
    """realised return, drawdown, win rate and Sortino (per-trade, on stake) over trades closed after `since`"""
    tr = [c for c in closed if c["tout"] >= since]
    if not tr:
        return None
    eq0 = tr[0]["eq0"]
    eq, pk, mdd = eq0, eq0, 0.0
    for c in tr:
        eq += c["pnl"]
        pk = max(pk, eq)
        mdd = min(mdd, eq / pk - 1)
    r = [c["pnl"] / c["usd"] for c in tr if c["usd"]]
    m = sum(r) / len(r)
    dn = (sum(min(0.0, x) ** 2 for x in r) / len(r)) ** 0.5
    return {"ret": eq / eq0 - 1, "mdd": mdd, "n": len(tr), "win": sum(1 for c in tr if c["pnl"] > 0) / len(tr),
            "sortino": (m / dn) if dn > 0 else None, "pnl": eq - eq0}


NICK_RE = re.compile(r"^[^\s@<>/:][^@<>/:]{0,18}[^\s@<>/:]$")


def set_nick(s, uid, text):
    n = re.sub(r"\s+", " ", (text or "").strip())
    if not NICK_RE.match(n) or re.search(r"https?|www\.|t\.me|\.com", n, re.I):
        return None
    taken = {v.get("nick", "").lower() for k, v in s.get("paper", {}).items() if k != str(uid) and v.get("nick")}
    if n.lower() in taken:
        n = n[:17] + "·" + str(uid)[-2:]
    acct(s, uid)["nick"] = n
    return n


def screen(s, uid, lang):
    """-> (text, rows) for the bot's paper-trading screen"""
    a = acct(s, uid)
    out = [f"📒 <b>{L('title', lang)}</b>", L("intro", lang), ""]
    eq = realised(a)
    out.append(f"💼 {L('equity', lang)}: <b>{fu(eq)}</b> ({fpc(eq / START - 1)}) · {L('cash', lang)} {fu(a['cash'])}")
    out += ["", f"<b>{L('open', lang)}</b>"]
    rows = []
    if not a["pos"]:
        out.append(L("none", lang))
    for p in a["pos"]:
        px = price(p["coin"])
        live = f" → {fp(px)} · {fpc(pnl_of(p, px) / p['usd'])}" if px else ""
        out.append(f"#{p['id']} {L('long' if p['side'] == 'L' else 'short', lang)} <b>{p['coin']}</b> {fu(p['usd'])} @ {fp(p['px'])}{live}")
        rows.append([{"text": f"{L('b_close', lang)} #{p['id']} {p['coin']}", "callback_data": f"pp:x:{p['id']}"}])
    st = stats(a["closed"])
    if st:
        out += ["", f"<b>{L('stats', lang)}</b>: {st['n']} · {fpc(st['ret'])} · {L('win', lang)} {st['win'] * 100:.0f}% · {L('mdd', lang)} {st['mdd'] * 100:.1f}%"]
    out += ["", L("pub_on", lang, n=html.escape(a["nick"] or "—"), k=MIN_RANK) if a["pub"] else L("pub_off", lang), "", L("rules", lang)]
    if len(a["pos"]) < MAX_OPEN:
        rows.insert(0, [{"text": L("b_new", lang), "callback_data": "pp:new"}])
    rows.append([{"text": L("b_priv" if a["pub"] else "b_pub", lang), "callback_data": "pp:pub"},
                 {"text": L("b_nick", lang), "callback_data": "pp:nick"}])
    rows.append([{"text": L("b_board", lang), "url": "https://entekhab.net/leaderboard/"}, {"text": L("b_del", lang), "callback_data": "pp:del"}])
    return "\n".join(out), rows


def callback(s, uid, data, lang):
    """pp:* buttons -> (text, rows, await_nick). The caller edits the message with the result."""
    parts = data.split(":")
    back = [[{"text": "↩️", "callback_data": "m:paper"}]]
    if parts[1] == "new":
        rows = [[{"text": c, "callback_data": f"pp:c:{c}"} for c in COINS[i:i + 4]] for i in range(0, len(COINS), 4)]
        return L("pick_coin", lang), rows + back, False
    if parts[1] == "c":
        c = parts[2]
        return L("pick_side", lang, c=c), [[{"text": L("long", lang), "callback_data": f"pp:s:{c}:L"},
                                            {"text": L("short", lang), "callback_data": f"pp:s:{c}:S"}]] + back, False
    if parts[1] == "s":
        c, sd = parts[2], parts[3]
        return L("pick_size", lang, c=c), [[{"text": f"{z}%", "callback_data": f"pp:z:{c}:{sd}:{z}"} for z in SIZES]] + back, False
    if parts[1] == "z":
        p, err = open_pos(s, uid, parts[2], parts[3], int(parts[4]))
        if err:
            text, rows = screen(s, uid, lang)
            return L(err, lang) + "\n\n" + text, rows, False
        text, rows = screen(s, uid, lang)
        return L("opened", lang, side=L("long" if p["side"] == "L" else "short", lang), c=p["coin"], u=fu(p["usd"]), p=fp(p["px"])) + "\n\n" + text, rows, False
    if parts[1] == "x":
        a = acct(s, uid)
        p = next((x for x in a["pos"] if x["id"] == int(parts[2])), None)
        if not p:
            text, rows = screen(s, uid, lang)
            return text, rows, False
        px = price(p["coin"])
        r = fpc(pnl_of(p, px) / p["usd"]) if px else "—"
        return (L("confirm_close", lang, side=L("long" if p["side"] == "L" else "short", lang), c=p["coin"], p=fp(px) if px else "—", r=r),
                [[{"text": L("yes", lang), "callback_data": f"pp:X:{p['id']}"}, {"text": L("no", lang), "callback_data": "m:paper"}]], False)
    if parts[1] == "X":
        c, err = close_pos(s, uid, int(parts[2]))
        text, rows = screen(s, uid, lang)
        if err:
            return (L(err, lang) + "\n\n" if err == "noprice" else "") + text, rows, False
        return L("closed", lang, c=c["coin"], p=fp(c["pout"]), r=fpc(c["pnl"] / c["usd"]), u=fu(c["pnl"])) + "\n\n" + text, rows, False
    if parts[1] == "pub":
        a = acct(s, uid)
        if not a["pub"] and not a["nick"]:
            return L("need_nick", lang) + "\n\n" + L("ask_nick", lang), back, True
        a["pub"] = not a["pub"]
        text, rows = screen(s, uid, lang)
        return text, rows, False
    if parts[1] == "nick":
        return L("ask_nick", lang), back, True
    if parts[1] == "del":
        return L("del_q", lang), [[{"text": L("yes", lang), "callback_data": "pp:DEL"}, {"text": L("no", lang), "callback_data": "m:paper"}]], False
    if parts[1] == "DEL":
        s.get("paper", {}).pop(str(uid), None)
        return L("deleted", lang), back, False
    text, rows = screen(s, uid, lang)
    return text, rows, False


def board(s):
    """public table: opted-in accounts with at least MIN_RANK closed trades, ranked by realised return per window"""
    now = time.time()
    wins = {"d7": now - 7 * 86400, "d30": now - 30 * 86400, "d90": now - 90 * 86400, "all": 0}
    rows = {w: [] for w in wins}
    waiting = 0
    for k, a in (s.get("paper") or {}).items():
        if not a.get("pub") or not a.get("nick"):
            continue
        if len(a["closed"]) < MIN_RANK:
            waiting += 1
            continue
        for w, since in wins.items():
            st = stats(a["closed"], since)
            if not st:
                continue
            rows[w].append({"nick": a["nick"], "ret": round(st["ret"], 5), "mdd": round(st["mdd"], 5), "n": st["n"], "win": round(st["win"], 4),
                            "sortino": None if st["sortino"] is None else round(st["sortino"], 3), "pnl": round(st["pnl"], 2),
                            "open": len(a["pos"]), "since": datetime.fromtimestamp(a["created"], timezone.utc).strftime("%Y-%m-%d"),
                            "coins": sorted({c["coin"] for c in a["closed"]})[:6]})
    for w in rows:
        rows[w].sort(key=lambda r: (-r["ret"], r["mdd"] * -1))
        for i, r in enumerate(rows[w], 1):
            r["rank"] = i
    return {"updated_at": datetime.now(timezone.utc).isoformat(), "start": START, "fee_side_pct": FEE * 100, "min_trades": MIN_RANK,
            "max_open": MAX_OPEN, "coins": COINS, "waiting": waiting,
            "accounts": len(s.get("paper") or {}), "rows": {w: rows[w][:100] for w in rows}}
