"""
Offline test of the market map inside the bot (no network, no Telegram).

    python tests/test_bot_mm.py

Drives the real handlers (refbot.handle_update) with captured Telegram calls, in all five languages:
  * section "mmap" (menu key m:mmap): text with the live lines from the same files the pages read, the five Web App
    buttons + the browser button, the standard navigation, its place in the analysis group and the market section;
  * without data files the section still renders (no live lines, nothing made up);
  * the map's coin panel sends a price alert to the bot in exactly the format the bot reads (and /market/ writes).
"""
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
os.chdir(ROOT)
TMP = tempfile.mkdtemp()
os.environ.update(REF_BOT_TOKEN="", STATE_PATH=os.path.join(TMP, "s.json"), PUBLIC_PATH=os.path.join(TMP, "p.json"),
                  ADMIN_IDS="1", DATA_RAW="http://127.0.0.1:9/")

import refbot as R  # noqa: E402
import bot_data as D  # noqa: E402
import bot_menu as MN  # noqa: E402
import bot_mm as MMB  # noqa: E402
import bot_pro as PRO  # noqa: E402
from bot_i18n import LANGS  # noqa: E402

SENT, FAILS = [], []


def check(cond, what):
    print(("  ✓ " if cond else "  ✗ ") + what)
    if not cond:
        FAILS.append(what)


def fake_tg(method, **p):
    SENT.append((method, p))
    if method == "getChatMember":
        return {"ok": True, "result": {"status": "member"}}
    return {"ok": True, "result": {"message_id": 77}}


def fake_post(url, *a, **k):
    SENT.append((url.rsplit("/", 1)[-1], dict(k.get("data") or k.get("json") or {})))
    return type("Rsp", (), {"json": lambda self: {"ok": True, "result": {"message_id": 77, "photo": [{"file_id": "F1"}]}}})()


R.tg = fake_tg
R.requests.post = fake_post
R.BOT_USERNAME = "test_bot"
R.time.sleep = lambda *_: None

NOW = datetime.now(timezone.utc)
TF = ["5m", "15m", "1h", "2h", "4h", "1d", "7d", "30d", "1y"]


def coin(s, sec, d1):
    return {"s": s, "sec": sec, "ch": [0.1, 0.2, 0.3, 0.4, 0.5, d1, 1.0, 2.0, 3.0]}


DATA = {
    "market": {"updated_at": NOW.isoformat(), "coins": [{"coin": "BTC", "price": 77000.0, "chg24": 1.2}]},
    "mm": {"v": 1, "t": NOW.isoformat(), "tf": TF, "c": [coin("BTC", "btc", 1.5), coin("ETH", "l1", -2.0), coin("SOL", "l1", 6.0),
                                                           coin("DOGE", "meme", -9.0), coin("FET", "ai", 12.5), coin("UNI", "defi", 0.5),
                                                           coin("ARB", "l2", -1.0), coin("LINK", "infra", 2.0), coin("ONDO", "rwa", -0.5),
                                                           coin("BNB", "exch", 0.7), coin("USDT", "stable", 0.0)]},
    "mm_flow": {"v": 1, "f": {"SOL": {"1d": [20e6, 1e9]}, "DOGE": {"1d": [-30e6, 5e8]}, "FET": {"1d": [5e6, 1e8]}},
                "st": {"tot": 3.1e11, "d7": 1.5e9}},
    "etf": {"btc": {"last": {"d": "2026-11-11", "t": 250.0}}, "eth": {"last": {"d": "2026-11-11", "t": -30.5}}},
}
D.live_prices = lambda: {"BTC": (77000.0, 1.2)}
D.load = lambda name: DATA.get(name)


def upd(uid, text=None, data=None, lang="fa"):
    frm = {"id": uid, "first_name": f"u{uid}", "language_code": lang}
    if data:
        return {"update_id": 1, "callback_query": {"id": "cb", "from": frm, "data": data,
                                                    "message": {"message_id": 10, "chat": {"id": uid, "type": "private"}}}}
    return {"update_id": 1, "message": {"message_id": 5, "from": frm, "chat": {"id": uid, "type": "private"}, "text": text}}


def msgs_since(n):
    return [p for m, p in SENT[n:] if m in ("sendMessage", "editMessageText")]


PAGES = ["https://entekhab.net" + p for p in ("/heatmap/", "/bubbles/", "/money-flow/", "/liquidity/", "/etf/")]
S = R.load_state()
for i, lang in enumerate(LANGS):
    uid = 700 + i
    print(f"[{lang}]")
    R.handle_update(S, upd(uid, "/start", lang=lang))
    S["users"][str(uid)]["lang"] = lang

    n = len(SENT)
    R.handle_update(S, upd(uid, data="m:mmap", lang=lang))
    out = msgs_since(n)
    p = out[-1] if out else {}
    tx, kb = p.get("text", ""), p.get("reply_markup") or {}
    rows = kb.get("inline_keyboard", []) if isinstance(kb, dict) else []
    plain = tx.replace("‪", "").replace("‬", "")
    check(MMB.L("title", lang) in tx and "Traceback" not in tx and len(tx) <= 4096, "section text renders (title, under 4096)")
    check(all(w in plain for w in ("FET +12.5%", "DOGE -9.0%", "+$20.0M", "−$30.0M", "$310B", "+$1.50B", "+$250M", "−$30.5M")),
          "live lines from mm.json, mm_flow.json and etf.json")
    check("USDT" not in plain, "stablecoins are not counted as movers")
    check(MN.desc("mmap", lang) in tx, "one-line description under the title")
    webapps = [b["web_app"]["url"] for r in rows[:3] for b in r if "web_app" in b]
    check(webapps == PAGES, "the five pages open inside Telegram (Web App buttons)")
    check(len(rows) > 3 and rows[3] == [{"text": MMB.L("b_web", lang), "url": "https://entekhab.net/heatmap/"}], "then the heatmap in the browser")
    check(any(b.get("callback_data") == "m:main" for b in rows[-1]) and any(b.get("callback_data") == "m:g_analysis" for b in rows[-1]),
          "ends with ⬅️ analysis + 🏠")
    check(any(b.get("callback_data") == "m:mmap" for r in rows for b in r), "refresh button")
    check(all(len((b.get("callback_data") or "").encode()) <= 64 for r in rows for b in r), "callback sizes")

    t_g, rows_g = R.render(S, uid, "g_analysis")
    check('"m:mmap"' in json.dumps(rows_g), "analysis group lists it")
    t_m, rows_m = R.render(S, uid, "mkt")
    check('"m:mmap"' in json.dumps(rows_m) and '"m:pro"' in json.dumps(rows_m), "market section links to it (and still to the live market)")

    # without any data file: still a section, no live lines, nothing invented
    keep = D.load
    D.load = lambda name: None
    n = len(SENT)
    R.handle_update(S, upd(uid, data="m:mmap", lang=lang))
    out = msgs_since(n)
    tx0 = out[-1]["text"] if out else ""
    check(MMB.L("title", lang) in tx0 and "📊" not in tx0 and "$" not in tx0, "no data → the section without live lines")
    D.load = keep

# the coin panel on the map hands a price alert to the bot exactly as /market/ does
js = r"""
global.window = global; global.document = undefined;
var fs = require('fs');
function grab(file) { var src = fs.readFileSync(file, 'utf8'); var m = src.match(/function plainNum\(v\) \{[\s\S]*?\n  \}/); return eval('(' + m[0] + ')'); }
var a = grab('assets/pro/panels.js'), b = grab('assets/mm/panel.js');
var vals = [72155.5, 0.0000006, 1.234567e-8, 0.3, 64250, 0.00001234, 1e-16, 2e12, 999999999999.5, 0.1 + 0.2, '12.50', 'x', -5];
console.log(JSON.stringify(vals.map(function (v) { return [a(v), b(v)]; })));
"""
res = subprocess.run(["node", "-e", js], capture_output=True, text=True, cwd=ROOT)
try:
    pairs = json.loads(res.stdout.strip())
except ValueError:
    pairs = []
check(pairs and all(x == y for x, y in pairs), f"the map encodes prices exactly like /market/ {pairs[:4]}")
for v, (x, _) in zip([72155.5, 0.0000006, 1.234567e-8, 0.3, 64250, 0.00001234], pairs[:6]):
    got = PRO.parse_link("a_X1_" + x.replace(".", "d"))
    check(got and abs(got[1] - v) <= v * 1e-12, f"the bot reads {x} back exactly")
import re  # noqa: E402
ok = lambda v: bool(re.fullmatch(r"\d{1,12}(\.\d{1,18})?", v))      # noqa: E731  (the check panel.js makes before it offers the link)
check(not any(ok(p[1]) for p in pairs[6:9]) and not any(ok(p[1]) for p in pairs[11:]), "out-of-range or bad prices give no link")
check(ok(pairs[9][1]) and pairs[9][1] == "0.3" and pairs[10][1] == "12.5", "0.1 + 0.2 → 0.3, '12.50' → 12.5")
src = open(os.path.join(ROOT, "assets/mm/panel.js"), encoding="utf-8").read()
check("'?start=a_' + c.s + '_' + v.replace('.', 'd')" in src and "/^[A-Z0-9]{2,12}$/.test(c.s)" in src, "the link is only offered for a valid coin and price")

print(f"\nbot market map: {len(FAILS)} failures")
raise SystemExit(1 if FAILS else 0)
