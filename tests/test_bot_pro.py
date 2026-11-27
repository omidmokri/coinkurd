"""
Offline test of the live market (/market/) inside the bot (no network, no Telegram).

    python tests/test_bot_pro.py

Drives the real handlers (refbot.handle_update) with captured Telegram calls, in all five languages:
  * section "pro" (menu key m:pro): text, the Web App + browser buttons, its place in the analysis group and the market section;
  * the site's alert hand-off t.me/<bot>?start=a_<COIN>_<PRICE>: only an offer first, stored on «add», exact price kept;
  * malformed links / callbacks are refused, a symbol that is also a toman asset (EUR) is never stored as a toman alert;
  * Iran's market in toman: t.me/<bot>?start=t_<ASSET>_<PRICE> offers a toman alert on the bot's own asset (pt:…).
"""
import json
import os
import sys
import tempfile
import time
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
PRICES = {"BTC": (77000.0, 1.2), "ETH": (2250.0, -0.5), "BTTC": (0.0000007, 1.0)}
DATA = {
    "market": {"updated_at": NOW.isoformat(), "coins": [{"coin": c, "price": p, "chg24": ch} for c, (p, ch) in PRICES.items()]},
    "ecocal": {"events": [{"t": NOW.timestamp() + 5400, "c": "USD", "i": "H", "n": "CPI m/m",
                           "tr": {"fa": "تورم ماهانهٔ آمریکا", "ckb": "هەڵئاوسانی مانگانەی ئەمریکا", "ar": "التضخم الشهري الأمريكي"}}]},
}
D.live_prices = lambda: PRICES
D.load = lambda name: DATA.get(name)
TOMAN = {"GOLD_18": 7400000.0, "USD": 101000.0, "USDT": 102000.0}
IR_ASSETS = R.IR.ASSETS
R.IR.asset_price = lambda key, snap=None: TOMAN.get(key)


def upd(uid, text=None, data=None, lang="fa"):
    frm = {"id": uid, "first_name": f"u{uid}", "language_code": lang}
    if data:
        return {"update_id": 1, "callback_query": {"id": "cb", "from": frm, "data": data,
                                                    "message": {"message_id": 10, "chat": {"id": uid, "type": "private"}}}}
    return {"update_id": 1, "message": {"message_id": 5, "from": frm, "chat": {"id": uid, "type": "private"}, "text": text}}


def msgs_since(n):
    return [p for m, p in SENT[n:] if m in ("sendMessage", "editMessageText")]


def kb_json(p):
    rm = p.get("reply_markup")
    return rm if isinstance(rm, str) else json.dumps(rm or {}, ensure_ascii=False)


S = R.load_state()
for i, lang in enumerate(LANGS):
    uid = 500 + i
    print(f"[{lang}]")
    R.handle_update(S, upd(uid, "/start", lang=lang))
    x = S["users"][str(uid)]
    x["lang"] = lang
    check(x.get("joined"), "user registered and verified")

    # 1) section
    n = len(SENT)
    R.handle_update(S, upd(uid, data="m:pro", lang=lang))
    out = msgs_since(n)
    p = out[-1] if out else {}
    tx, kb = p.get("text", ""), p.get("reply_markup") or {}
    rows = kb.get("inline_keyboard", []) if isinstance(kb, dict) else []
    check(PRO.L("title", lang) in tx and "Traceback" not in tx and len(tx) <= 4096, "section text renders (title, under 4096)")
    check("CPI" in tx or "تورم" in tx or "هەڵئاوسان" in tx or "التضخم" in tx, "section shows the next high-impact event")
    check(rows[:1] == [[{"text": PRO.L("b_tg", lang), "web_app": {"url": "https://entekhab.net/market/"}}]], "first row: open inside Telegram (Web App)")
    check(len(rows) > 1 and rows[1] == [{"text": PRO.L("b_web", lang), "url": "https://entekhab.net/market/"}], "second row: open in the browser")
    check(len(rows) > 2 and rows[2] == [{"text": PRO.L("b_lang", lang), "web_app": {"url": "https://entekhab.net/market/#lang"}}], "third row: the 47 languages and your currency (opens the language menu)")
    check(json.dumps(rows).count("entekhab.net/market/") == 3, "no duplicate site link")
    check(any(b.get("callback_data") == "m:main" for r in rows for b in r), "back button kept")

    # 2) where the section is reachable from
    t_g, rows_g = R.render(S, uid, "g_analysis")
    check('"m:pro"' in json.dumps(rows_g), "analysis group lists it")
    t_m, rows_m = R.render(S, uid, "mkt")
    check('"m:pro"' in json.dumps(rows_m), "market section links to it")

    # 3) the alert hand-off: offer only
    before = len(x["alerts"])
    n = len(SENT)
    R.handle_update(S, upd(uid, "/start a_BTC_72155d5", lang=lang))
    offer = [q for q in msgs_since(n) if "pa:BTC:72155.5" in kb_json(q)]
    check(len(offer) == 1, "deep link answers with one offer carrying pa:BTC:72155.5")
    check(offer and "$72,155.5" in offer[0]["text"] and "BTC" in offer[0]["text"], "offer shows the exact dollar price")
    check(len(x["alerts"]) == before, "nothing stored before «add»")
    # 4) «add»
    R.handle_update(S, upd(uid, data="pa:BTC:72155.5", lang=lang))
    check(len(x["alerts"]) == before + 1, "«add» stores one alert")
    a = x["alerts"][-1] if x["alerts"] else {}
    check(a.get("coin") == "BTC" and a.get("price") == 72155.5 and a.get("op") == "<" and not a.get("iran"),
          "stored as BTC ≤ $72,155.5 (below the $77,000 price now), a dollar alert")
    check(msgs_since(n) and "BTC" in msgs_since(n)[-1]["text"], "confirmation names the coin")

    # 5) tiny price round trip (no exponent, no rounding)
    n = len(SENT)
    R.handle_update(S, upd(uid, "/start a_BTTC_0d0000006", lang=lang))
    check(any("pa:BTTC:0.0000006" in kb_json(q) for q in msgs_since(n)), "tiny price offer: pa:BTTC:0.0000006")
    R.handle_update(S, upd(uid, data="pa:BTTC:0.0000006", lang=lang))
    a = x["alerts"][-1]
    check(a.get("coin") == "BTTC" and abs(a.get("price", 0) - 0.0000006) < 1e-15 and a.get("op") == "<", "tiny price stored exactly")

    # 6) refusals
    k = len(x["alerts"])
    for bad in ("/start a_BTC_zz", "/start a_btc_100", "/start a_BTC_0", "/start a_BTC_1e-7"):
        n = len(SENT)
        R.handle_update(S, upd(uid, bad, lang=lang))
        out = msgs_since(n)
        check(out and out[-1]["text"] == PRO.L("bad", lang) and "pa:" not in kb_json(out[-1]), f"{bad!r} refused")
    for bad in ("pa:BTC:abc", "pa:BTC:0", "pa:BTC:1e-7", "pa:btc:100", "pa:BTC:" + "9" * 13):
        n = len(SENT)
        R.handle_update(S, upd(uid, data=bad, lang=lang))
        check(msgs_since(n) and msgs_since(n)[-1]["text"] == PRO.L("bad", lang), f"callback {bad!r} refused")
    check(len(x["alerts"]) == k, "nothing stored by refused links")

    # 7) a coin symbol that is also a toman asset is never turned into a toman alert
    n = len(SENT)
    R.handle_update(S, upd(uid, data="pa:EUR:1.1", lang=lang))
    check(len(x["alerts"]) == k and not any(z.get("iran") for z in x["alerts"]), "EUR from the site is not stored as a toman alert")
    check(msgs_since(n) and "EUR" in msgs_since(n)[-1]["text"], "…and the user is told the coin is unknown")

    # 7b) Iran's market in toman: t_<ASSET>_<PRICE> offers, «pt:» stores a toman alert on the bot's own asset
    n = len(SENT)
    R.handle_update(S, upd(uid, "/start t_GOLD_18_7550000", lang=lang))
    offer = [q for q in msgs_since(n) if "pt:GOLD_18:7550000" in kb_json(q)]
    check(len(offer) == 1 and "7,550,000" in offer[0]["text"] and PRO.L("toman", lang) in offer[0]["text"], "toman link: one offer, exact price in toman")
    check(len(x["alerts"]) == k, "toman link stores nothing before «add»")
    R.handle_update(S, upd(uid, data="pt:GOLD_18:7550000", lang=lang))
    a = x["alerts"][-1] if len(x["alerts"]) > k else {}
    check(a.get("coin") == "GOLD_18" and a.get("price") == 7550000 and a.get("iran") and a.get("op") == ">",
          "«add» stores GOLD_18 ≥ 7,550,000 toman as a toman alert (now 7,400,000)")
    R.handle_update(S, upd(uid, "/start t_USD_95000", lang=lang))
    R.handle_update(S, upd(uid, data="pt:USD:95000", lang=lang))
    check(x["alerts"][-1].get("coin") == "USD" and x["alerts"][-1].get("op") == "<", "USD ≤ 95,000 toman (now 101,000)")
    k2 = len(x["alerts"])
    for bad in ("/start t_BTC_100", "/start t_GOLD_18_0", "/start t_usd_100", "/start t_XAU_2000"):
        n = len(SENT)
        R.handle_update(S, upd(uid, bad, lang=lang))
        out = msgs_since(n)
        check(out and out[-1]["text"] == PRO.L("bad", lang) and "pt:" not in kb_json(out[-1]), f"{bad!r} refused")
    for bad in ("pt:BTC:100", "pt:GOLD_18:abc", "pt:USD:0", "pt:usd:100"):
        n = len(SENT)
        R.handle_update(S, upd(uid, data=bad, lang=lang))
        check(msgs_since(n) and msgs_since(n)[-1]["text"] == PRO.L("bad", lang), f"callback {bad!r} refused")
    check(len(x["alerts"]) == k2, "nothing stored by refused toman links")
    k = k2

    # 8) a typed /alert still works as before (nothing changed for it)
    n = len(SENT)
    R.handle_update(S, upd(uid, "/alert ETH 2500", lang=lang))
    check(x["alerts"] and x["alerts"][-1].get("coin") == "ETH" and x["alerts"][-1].get("op") == ">", "/alert ETH 2500 still works")

    # 8b) ODM: every level of one plan in one link, offered first, «add all» stores one alert per level, never twice
    k = len(x["alerts"])
    n = len(SENT)
    link = "o_BTC_e76000-e75000d5-s71000-x80000-x82500-t81000"
    R.handle_update(S, upd(uid, "/start " + link, lang=lang))
    out = [q for q in msgs_since(n) if "po:BTC_e76000" in kb_json(q)]
    check(len(out) == 1 and "$75,000.5" in out[0]["text"] and "$82,500" in out[0]["text"] and PRO.pick(PRO.O_KIND["s"], lang) in out[0]["text"],
          "ODM link: one offer listing every level with its kind and exact price")
    check(len(x["alerts"]) == k, "ODM link stores nothing before «add all»")
    n = len(SENT)
    R.handle_update(S, upd(uid, data="po:" + link[2:], lang=lang))
    new = x["alerts"][k:]
    check(len(new) == 6 and all(a.get("coin") == "BTC" and not a.get("iran") for a in new), "«add all» stores 6 dollar alerts for BTC")
    ops = {a["price"]: a["op"] for a in new}
    check(ops == {76000: "<", 75000.5: "<", 71000: "<", 80000: ">", 82500: ">", 81000: ">"}, f"each alert points the right way from $77,000: {ops}")
    check(msgs_since(n) and PRO.L("o_done", lang, c="BTC", n=6, d="") in msgs_since(n)[-1]["text"], "confirmation: 6 added")
    n = len(SENT)
    R.handle_update(S, upd(uid, data="po:" + link[2:], lang=lang))
    check(len(x["alerts"]) == k + 6, "a second tap adds nothing")
    check(msgs_since(n) and PRO.L("o_dup", lang, n=6) in msgs_since(n)[-1]["text"], "…and says all 6 were already set")
    for bad in ("/start o_BTC_e1-e1", "/start o_BTC_q76000", "/start o_btc_e1", "/start o_BTC_e0", "/start o_BTC_"):
        n = len(SENT)
        R.handle_update(S, upd(uid, bad, lang=lang))
        out = msgs_since(n)
        check(out and out[-1]["text"] == PRO.L("bad", lang) and "po:" not in kb_json(out[-1]), f"{bad!r} refused")
    for bad in ("po:BTC_e1-e1", "po:BTC_x", "po:btc_e1", "po:BTC_e1;x"):
        n = len(SENT)
        R.handle_update(S, upd(uid, data=bad, lang=lang))
        check(msgs_since(n) and msgs_since(n)[-1]["text"] == PRO.L("bad", lang), f"callback {bad!r} refused")
    k = len(x["alerts"])
    n = len(SENT)
    R.handle_update(S, upd(uid, data="po:NOPE_e1-x2", lang=lang))
    check(len(x["alerts"]) == k and msgs_since(n) and "NOPE" in msgs_since(n)[-1]["text"], "an unknown coin stores nothing and says so")

# 9) the site encodes the link the way the bot reads it
import subprocess  # noqa: E402

js = r"""
global.window = global; global.document = undefined;
var src = require('fs').readFileSync('assets/pro/panels.js', 'utf8');
var m = src.match(/function plainNum\(v\) \{[\s\S]*?\n  \}/);
eval(m[0]);
console.log(JSON.stringify([72155.5, 0.0000006, 1.234567e-8, 0.3, 64250, 0.00001234].map(plainNum)));
"""
res = subprocess.run(["node", "-e", js], capture_output=True, text=True, cwd=ROOT)
try:
    vals = json.loads(res.stdout.strip())
except ValueError:
    vals = []
check(vals == ["72155.5", "0.0000006", "0.00000001234567", "0.3", "64250", "0.00001234"], f"site's plainNum output {vals}")
for v, num in zip(vals, [72155.5, 0.0000006, 1.234567e-8, 0.3, 64250, 0.00001234]):
    got = PRO.parse_link("a_X1_" + v.replace(".", "d"))
    check(got and abs(got[1] - num) <= num * 1e-12, f"bot reads the site's {v} back exactly")

# 9b) the site's ODM link (P.botOdmLink in panels.js) is one the bot reads, and keeps the stop and exits when it must cut
js = r"""
global.window = global; global.document = undefined;
var src = require('fs').readFileSync('assets/pro/panels.js', 'utf8');
eval(src.match(/function plainNum\(v\) \{[\s\S]*?\n  \}/)[0]);
var BOT = 'test_bot', P = { inst: function (s) { return s === 'IRT' ? { kind: 'ir' } : { kind: 'usdt' }; } };
eval(src.match(/P\.botOdmLink = function[\s\S]*?\n  \};/)[0]);
var lv = function (a) { return a.map(function (z) { return { k: z[0], v: z[1] }; }); };
console.log(JSON.stringify([
  P.botOdmLink('BTC', lv([['e', 76000], ['e', 75000.5], ['s', 71000], ['x', 80000], ['x', 82500], ['t', 81000]])),
  P.botOdmLink('PEPE', lv([['e', 0.0000121], ['e', 0.0000115], ['e', 0.0000109], ['e', 0.0000103], ['s', 0.0000097], ['x', 0.0000135], ['x', 0.0000150], ['x', 0.0000171], ['t', 0.0000160]])),
  P.botOdmLink('IRT', lv([['e', 1]])), P.botOdmLink('btc', lv([['e', 1]])), P.botOdmLink('BTC', lv([['q', 1]]))
]));
"""
res = subprocess.run(["node", "-e", js], capture_output=True, text=True, cwd=ROOT)
try:
    full, cut, *nones = json.loads(res.stdout.strip())
except ValueError:
    full, cut, nones = None, None, [1]
pre = "https://t.me/test_bot?start="
check(full and full["url"] == pre + "o_BTC_e76000-e75000d5-s71000-x80000-x82500-t81000" and full["n"] == 6 == full["total"], f"site's ODM link {full}")
got = full and PRO.parse_olink(full["url"][len(pre):])
check(got and [p for _, p, _ in got[1]] == [76000, 75000.5, 71000, 80000, 82500, 81000], "the bot reads every level of the site's ODM link")
arg = cut["url"][len(pre):] if cut else ""
got = PRO.parse_olink(arg)
check(cut and cut["total"] == 9 and cut["n"] < 9 and len(arg) <= 63 and got, f"a long plan is cut to fit one link ({cut and cut['n']} of 9, {len(arg)} chars)")
kinds = [k for k, _, _ in got[1]] if got else []
check("s" in kinds and kinds.count("x") == 3, f"…keeping the stop and every exit first: {kinds}")
check(nones == [None, None, None], "no ODM link for a toman symbol, a lower-case symbol or an unknown level kind")

# 10) every toman asset the site can send is one the bot knows and can price
import re  # noqa: E402
src = open(os.path.join(ROOT, "assets", "pro", "panels.js"), encoding="utf-8").read()
m = re.search(r"var BOT_IR = \{([^}]*)\}", src)
site_keys = re.findall(r":\s*'([A-Z0-9_]+)'", m.group(1)) if m else []
check(len(site_keys) >= 9, f"site's toman assets read: {site_keys}")
for key in site_keys:
    check(key in PRO.T_NAME and key in IR_ASSETS, f"{key}: the bot has a name and an alert asset for it")

print(f"\nbot_pro end-to-end: {len(FAILS)} failures")
raise SystemExit(1 if FAILS else 0)
