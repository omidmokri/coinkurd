"""
Offline test of the Observatory inside the bot (no network, no Telegram).

    python tests/test_bot_obs.py

Drives the real handlers (refbot.handle_update) with captured Telegram calls, in all five languages:
  * section "obs" (menu key m:obs): the text, the six Web App buttons + the browser button, the standard navigation,
    its place in the analysis group; the description from the menu table;
  * the pages its buttons open exist in the repo and are the ones scripts/build_obs.py builds;
  * the site's menu (scripts/chrome.py) and the assistant's feature list know the section.
"""
import json
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
os.chdir(ROOT)
TMP = tempfile.mkdtemp()
os.environ.update(REF_BOT_TOKEN="", STATE_PATH=os.path.join(TMP, "s.json"), PUBLIC_PATH=os.path.join(TMP, "p.json"),
                  ADMIN_IDS="1", DATA_RAW="http://127.0.0.1:9/")

import refbot as R  # noqa: E402
import bot_data as D  # noqa: E402
import bot_menu as MN  # noqa: E402
import bot_obs as OBS  # noqa: E402
import build_obs as BO  # noqa: E402
import chrome  # noqa: E402
import assistant_kb as KB  # noqa: E402
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
D.live_prices = lambda: {"BTC": (77000.0, 1.2)}
D.load = lambda name: None


def upd(uid, text=None, data=None, lang="fa"):
    frm = {"id": uid, "first_name": f"u{uid}", "language_code": lang}
    if data:
        return {"update_id": 1, "callback_query": {"id": "cb", "from": frm, "data": data,
                                                    "message": {"message_id": 10, "chat": {"id": uid, "type": "private"}}}}
    return {"update_id": 1, "message": {"message_id": 5, "from": frm, "chat": {"id": uid, "type": "private"}, "text": text}}


def msgs_since(n):
    return [p for m, p in SENT[n:] if m in ("sendMessage", "editMessageText")]


SITE = "https://entekhab.net"
PAGES = [SITE + p for p in ("/charts/liquidation-heatmap/", "/charts/liquidation-map/", "/charts/open-interest/", "/charts/funding-rate/", "/charts/long-short/", "/charts/")]
S = R.load_state()
for i, lang in enumerate(LANGS):
    uid = 900 + i
    print(f"[{lang}]")
    R.handle_update(S, upd(uid, "/start", lang=lang))
    S["users"][str(uid)]["lang"] = lang
    n = len(SENT)
    R.handle_update(S, upd(uid, data="m:obs", lang=lang))
    out = msgs_since(n)
    p = out[-1] if out else {}
    tx, kb = p.get("text", ""), p.get("reply_markup") or {}
    rows = kb.get("inline_keyboard", []) if isinstance(kb, dict) else []
    check(OBS.L("title", lang) in tx and "Traceback" not in tx and len(tx) <= 4096, "section text renders (title, under 4096)")
    check(MN.desc("obs", lang) in tx, "one-line description under the title")
    check("Binance" in tx and "Bybit" in tx and OBS.L("nfa", lang) in tx, "names its sources and says it is an estimate")
    n_open = OBS.N_ROWS - 1
    webapps = [b["web_app"]["url"] for r in rows[:n_open] for b in r if "web_app" in b]
    check(webapps == PAGES, "the five charts and the hub open inside Telegram (Web App buttons)")
    check(len(rows) > n_open and rows[n_open] == [{"text": OBS.L("b_web", lang), "url": PAGES[-1]}], "then the hub in the browser")
    check(all(len(r) <= 2 and all(len(b["text"]) <= 40 for b in r) for r in rows[:OBS.N_ROWS]), "at most two buttons a row, short labels")
    check(all(x in tx for x in ("OKX", "Bitget", "Hyperliquid", "Gate")), "names the other four exchanges it reads")
    check(any(b.get("callback_data") == "m:main" for b in rows[-1]) and any(b.get("callback_data") == "m:g_analysis" for b in rows[-1]),
          "ends with ⬅️ analysis + 🏠")
    check(all(len((b.get("callback_data") or "").encode()) <= 64 for r in rows for b in r), "callback sizes")
    t_g, rows_g = R.render(S, uid, "g_analysis")
    check('"m:obs"' in json.dumps(rows_g), "analysis group lists it")
    n = len(SENT)
    R.handle_update(S, upd(uid, "/start s_obs", lang=lang))
    out = msgs_since(n)
    check(any(OBS.L("title", lang) in (q.get("text") or "") for q in out), "the deep link ?start=s_obs opens the section")

print("[wiring]")
built = ["/" + f + "/" for f in BO.folders()]
check(all(p.replace(SITE, "") in built for p in PAGES), "every button opens a page scripts/build_obs.py builds")
check(all(os.path.exists(os.path.join(ROOT, f, "index.html")) for f in BO.folders()), "those pages exist in the repo")
nav = {h for c in chrome.NAV for h, ic, t, d in c["items"]}
check("/charts/" in nav and "/charts/liquidation-heatmap/" in nav, "the site's menu lists the Observatory and the heatmap")
check(all(f in chrome.STATIC for f in BO.folders()), "chrome.STATIC refreshes the header of every Observatory page")
feat = {h: k for h, k, x in KB.FEATURES}
check(feat.get("/charts/") == ["obs"] and "obs" in feat.get("/charts/liquidation-heatmap/", []), "the assistant knows the section and its bot door")
check(all(h in chrome.CSP for h in ("fapi.binance.com", "api.bybit.com", "www.okx.com", "api.bitget.com", "api.hyperliquid.xyz", "api.gateio.ws")), "the CSP allows the six exchanges the charts read")
check(all(("/" + f + "/") in feat for f in BO.folders()), "the assistant's feature list has every page of the section")
import build_assistant as BA  # noqa: E402
known = {h for h, t, d, k in BA.EXTRA_PAGES} | nav
check(all(("/" + f + "/") in known for f in BO.folders()), "every page of the section has a title the assistant can show (menu or its own list)")
check(all(len(k) >= 4 for h, t, d, k in BO.catalog()), "every chart has search words in more than one language")
print(f"\nbot_obs: {len(FAILS)} failures")
sys.exit(1 if FAILS else 0)
