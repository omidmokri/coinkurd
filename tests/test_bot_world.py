"""
Offline test of /world/ («جهان زنده») inside the bot (no network, no Telegram), in all five languages:
section "world" (m:world) renders with the snapshot lines from the same facts and data/world.json the page reads,
opens the page inside Telegram (Web App) and in the browser, sits in the analysis group, and without the file still
renders its world lines but no Bitcoin lines (nothing made up).        Run: python3 tests/test_bot_world.py
"""
import json
import os
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
import bot_world as WLB  # noqa: E402
from bot_i18n import LANGS  # noqa: E402

SENT, FAILS = [], []


def check(cond, what):
    print(("  ✓ " if cond else "  ✗ ") + what)
    if not cond:
        FAILS.append(what)


R.tg = lambda method, **p: (SENT.append((method, p)), {"ok": True, "result": {"message_id": 77, "status": "member"}})[1]
R.requests.post = lambda *a, **k: type("Rsp", (), {"json": lambda self: {"ok": True, "result": {"message_id": 77}}})()
R.BOT_USERNAME = "test_bot"
R.time.sleep = lambda *_: None
TODAY = datetime.now(timezone.utc).date().isoformat()
DATA = {"world": {"btc": {"tip": 976012, "day0": {"d": TODAY, "h": 975931}}}}
D.live_prices = lambda: {"BTC": (77000.0, 1.2)}
D.load = lambda name: DATA.get(name)


def upd(uid, text=None, data=None, lang="fa"):
    frm = {"id": uid, "first_name": f"u{uid}", "language_code": lang}
    if data:
        return {"update_id": 1, "callback_query": {"id": "cb", "from": frm, "data": data, "message": {"message_id": 10, "chat": {"id": uid, "type": "private"}}}}
    return {"update_id": 1, "message": {"message_id": 5, "from": frm, "chat": {"id": uid, "type": "private"}, "text": text}}


def last_msg(n):
    out = [p for m, p in SENT[n:] if m in ("sendMessage", "editMessageText")]
    return out[-1] if out else {}


S = R.load_state()
for i, lang in enumerate(LANGS):
    uid = 900 + i
    print(f"[{lang}]")
    R.handle_update(S, upd(uid, "/start", lang=lang))
    S["users"][str(uid)]["lang"] = lang
    n = len(SENT)
    R.handle_update(S, upd(uid, data="m:world", lang=lang))
    p = last_msg(n)
    tx, rows = p.get("text", ""), (p.get("reply_markup") or {}).get("inline_keyboard", [])
    check(WLB.L("title", lang) in tx and "Traceback" not in tx and len(tx) <= 4096, "section renders")
    check(WLB.n((976012 - 975931 + 1) * 3.125, lang, 3) in tx and WLB.n(1050000 - 976012, lang) in tx, "Bitcoin lines from data/world.json")
    check(MN.desc("world", lang) in tx, "one-line description under the title")
    check(rows and rows[0][0].get("web_app", {}).get("url") == "https://entekhab.net/world/", "opens inside Telegram (Web App)")
    check(len(rows) > 1 and rows[1][0].get("url") == "https://entekhab.net/world/", "and in the browser")
    check(any(b.get("callback_data") == "m:world" for r in rows for b in r), "refresh button")
    t_g, rows_g = R.render(S, uid, "g_analysis")
    check('"m:world"' in json.dumps(rows_g), "analysis group lists it")
    D.load = lambda name: None
    n = len(SENT)
    R.handle_update(S, upd(uid, data="m:world", lang=lang))
    tx2 = last_msg(n).get("text", "")
    check(WLB.L("title", lang) in tx2 and "₿" not in tx2 and "👥" in tx2, "no file: world lines only, no Bitcoin lines")
    D.load = lambda name: DATA.get(name)

print(f"\ntest_bot_world: {len(FAILS)} failures")
sys.exit(1 if FAILS else 0)
