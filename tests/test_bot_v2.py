"""
Offline end-to-end test of the bot's v2 features (no network, no Telegram).

    python tests/test_bot_v2.py

Telegram calls are captured instead of sent; every outside source (DexScreener, GoPlus,
honeypot.is, IODA, Binance, wallet APIs, t.me/s channels) is replaced by small fixtures.
Every menu section and command is rendered in all five languages, and the alert, outage,
proxy-feedback, launch, whale, volume and wallet-follow paths are driven through a full cycle.
"""
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
os.chdir(ROOT)
TMP = tempfile.mkdtemp()
os.environ.update(REF_BOT_TOKEN="", STATE_PATH=os.path.join(TMP, "s.json"), PUBLIC_PATH=os.path.join(TMP, "p.json"),
                  ADMIN_IDS="1", DATA_RAW="http://127.0.0.1:9/")

import refbot as R  # noqa: E402
import bot_data as D  # noqa: E402
import bot_iran as IR  # noqa: E402
import bot_outage as OU  # noqa: E402
import bot_proxy2 as PX2  # noqa: E402
import bot_token as TK  # noqa: E402
import bot_watch as W  # noqa: E402
import bot_learn as LN  # noqa: E402
from bot_i18n import LANGS  # noqa: E402

SENT = []
FAILS = []


def check(cond, what):
    if not cond:
        FAILS.append(what)
        print("  ✗", what)


# ------------------------------------------------------------------ fakes
def fake_tg(method, **p):
    SENT.append((method, p))
    if method == "getChatMember":
        return {"ok": True, "result": {"status": "member"}}
    return {"ok": True, "result": {}}


R.tg = fake_tg
R.requests.post = lambda *a, **k: type("Rsp", (), {"json": lambda self: {"ok": True}})()
R.BOT_USERNAME = "test_bot"
R.time.sleep = lambda *_: None
W.time.sleep = lambda *_: None

NOW_ISO = datetime.now(timezone.utc).isoformat()
OLD_ISO = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
CH = {
    "ttprice": [{"iso": NOW_ISO, "text": "قیمت دلار آزاد : 105,000\nدلار آمریکا تهران : 105,000 [ ۰.۵٪ ]\n106,000 | 105,500 | نوبیتکس",
                 "id": 1, "links": [], "photos": []}],
    "NerkhDollarIRT": [{"iso": NOW_ISO, "text": "دلار تهران 105,200 خرید", "id": 1, "links": [], "photos": []}],
    "USDTTetherp": [{"iso": NOW_ISO, "text": "تتر [USDT] 106,100 خرید", "id": 1, "links": [], "photos": []}],
    "tavanaproxy": [{"iso": NOW_ISO, "text": "Germany\nhttps://t.me/proxy?server=a.example.com&port=443&secret=ee0011223344556677889900aabbccddeeff\n",
                     "id": 1, "links": ["https://t.me/proxy?server=a.example.com&port=443&secret=ee0011223344556677889900aabbccddeeff"]}],
    "Proxy_Qavi": [{"iso": NOW_ISO, "text": "پروکسی", "id": 2,
                    "links": ["https://t.me/proxy?server=b.example.com&port=8443&secret=dd00112233445566778899aabbccddeeff"]}],
    "ProxyMTProto": [{"iso": NOW_ISO, "text": "Server: c.example.com\nPort: 443\nSecret: eed02e349163d9ea4376a2ae6a94fc550b64726976652e676f6f676c652e636f6d", "id": 3, "links": []}],
    "Myporoxy": [], "mtpro_xyz": [],
}
IR._fetch_channel = lambda name: CH.get(name, [])
PRICES = {"BTC": (77000.0, 1.2), "ETH": (2250.0, -0.5), "SOL": (180.0, 2.0), "TRX": (0.3, 0.1), "PEPE": (0.00001, 3.0)}
D.live_prices = lambda: PRICES
DATA = {
    "market": {"updated_at": NOW_ISO, "coins": [{"coin": c, "price": p, "chg24": ch} for c, (p, ch) in PRICES.items()],
               "opportunities": []},
    "whales": {"events": [{"asset": "USDT", "amount": 13_000_000, "usd": 13_000_000, "tx": "0xaaa", "from": "0x" + "1" * 40,
                           "to": "0x" + "2" * 40, "at": NOW_ISO}]},
    "signals": {"signals": [{"id": "s1", "ind": "kurdistani-style-cycle", "sym": "BTCUSDT", "tf": "1D", "side": "long", "price": 77000,
                             "state": "Bull"}],
                "stats": {"kurdistani-style-cycle": {"n": 65, "eval": 33, "win": 42, "avg": -0.61}}},
    "news": {"items": [{"title": "Kurdistan Region warns on crypto firms", "url": "https://x.test/1", "source": "T", "date": NOW_ISO}],
             "regional": {"items": [{"title": "تتر در بازار تهران", "url": "https://x.test/2", "source": "R", "date": NOW_ISO}]}},
}
D.load = lambda name: DATA.get(name)
PX2.probe = lambda host, port, timeout=3.0: 120 if host != "b.example.com" else None

CA = "0x6982508145454Ce325dDbE47a25d4ec3d2311933"
SCAM = "0x" + "ab" * 20
NEW = "So1aNaNewToken1111111111111111111111111pump"[:44]
PAIR = {"chainId": "ethereum", "dexId": "uniswap", "url": "https://dexscreener.com/ethereum/x", "pairAddress": "0xpair",
        "baseToken": {"address": CA, "name": "Pepe", "symbol": "PEPE"}, "priceUsd": "0.000004811",
        "txns": {"h1": {"buys": 300, "sells": 200}, "h24": {"buys": 5000, "sells": 4000}},
        "volume": {"h1": 1_000_000, "h24": 30_000_000}, "priceChange": {"h1": 0.5, "h24": -2.0},
        "liquidity": {"usd": 30_000_000}, "marketCap": 1_990_000_000, "pairCreatedAt": 1681492871000}
SCAM_PAIR = dict(PAIR, baseToken={"address": SCAM, "name": "Rug", "symbol": "RUG"}, liquidity={"usd": 8000},
                 txns={"h1": {"buys": 50, "sells": 0}, "h24": {"buys": 400, "sells": 0}}, pairCreatedAt=int(time.time() * 1000) - 3600_000)
NEW_PAIR = dict(PAIR, chainId="solana", baseToken={"address": NEW, "name": "NewOne", "symbol": "NEW1"}, liquidity={"usd": 90_000},
                volume={"h1": 60_000, "h24": 200_000}, txns={"h1": {"buys": 120, "sells": 60}, "h24": {"buys": 900, "sells": 500}},
                marketCap=900_000, pairCreatedAt=int(time.time() * 1000) - 5 * 3600_000)
SEC_OK = {"is_honeypot": "0", "buy_tax": "0", "sell_tax": "0", "is_open_source": "1", "holder_count": "604311",
          "holders": [{"address": "0x1", "percent": "0.05", "is_locked": 0}],
          "lp_holders": [{"address": "0x000000000000000000000000000000000000dead", "percent": "0.99", "is_locked": 0}]}
SEC_SCAM = {"is_honeypot": "1", "sell_tax": "0.99", "is_open_source": "0", "holder_count": "40", "owner_percent": "0.5",
            "holders": [{"address": "0x9", "percent": "0.8", "is_locked": 0}], "lp_holders": [{"address": "0x9", "percent": "1", "is_locked": 0}]}
SEC_SOL = {"mintable": {"status": "0"}, "freezable": {"status": "0"}, "holder_count": "900",
           "holders": [{"account": "x", "percent": "0.05", "is_locked": 0}], "transfer_hook": [], "transfer_fee": {}}
PRICE_NOW = {"v": 0.000004811, "liq": 30_000_000}


def fake_get(url, params=None, ttl=60, timeout=20):
    if "/latest/dex/tokens/" in url:
        addrs = url.rsplit("/", 1)[-1].split(",")
        out = []
        for a in addrs:
            if a.lower() == CA.lower():
                out.append(dict(PAIR, priceUsd=str(PRICE_NOW["v"]), liquidity={"usd": PRICE_NOW["liq"]}))
            elif a.lower() == SCAM.lower():
                out.append(SCAM_PAIR)
            elif a == NEW:
                out.append(NEW_PAIR)
        return {"pairs": out}
    if "token-profiles" in url:
        return [{"tokenAddress": NEW, "chainId": "solana"}] if fake_get.launch else [{"tokenAddress": "old", "chainId": "solana"}]
    if "solana/token_security" in url:
        return {"code": 1, "result": {NEW: SEC_SOL}}
    if "token_security" in url:
        a = (params or {}).get("contract_addresses", "")
        return {"code": 1, "result": {a: SEC_SCAM if a == SCAM.lower() else SEC_OK}}
    if "honeypot" in url:
        return {"honeypotResult": {"isHoneypot": params.get("address") == SCAM}, "simulationResult": {"sellTax": 0}}
    return None


fake_get.launch = False
TK._get = fake_get


def upd(uid, text=None, data=None, lang="fa"):
    frm = {"id": uid, "first_name": f"u{uid}", "language_code": lang}
    if data:
        return {"update_id": 1, "callback_query": {"id": "cb", "from": frm, "data": data,
                                                    "message": {"message_id": 10, "chat": {"id": uid, "type": "private"}}}}
    return {"update_id": 1, "message": {"message_id": 5, "from": frm, "chat": {"id": uid, "type": "private"}, "text": text}}


def last_text():
    for m, p in reversed(SENT):
        if m in ("sendMessage", "editMessageText"):
            return p.get("text", "")
    return ""


def texts_since(n):
    return [p.get("text", "") for m, p in SENT[n:] if m in ("sendMessage", "editMessageText")]


S = R.load_state()
print("1) every section and command, in every language")
for i, lang in enumerate(LANGS):
    uid = 100 + i
    R.handle_update(S, upd(uid, "/start", lang=lang))
    S["users"][str(uid)]["lang"] = lang
    for key in ("main", "irr", "lite", "proxy", "outage", "token", "pf", "center", "follow", "dca", "learn", "alerts"):
        n = len(SENT)
        R.handle_update(S, upd(uid, data="m:" + key))
        tx = last_text()
        check(len(SENT) > n and tx and "Traceback" not in tx, f"{lang}/{key} renders")
        check(len(tx) <= 4096, f"{lang}/{key} under 4096 chars ({len(tx)})")
    for cmd in ("/help", "/check " + CA, "/check " + SCAM, "/pf add BTC 0.5", "/pf", "/wallet", "/size 77000 75500 20 80000",
                "/dca BTC 20 weekly", "/dca", "/rules", "/local", "/learn", "/outage", "/lite", "/center", "/proxy",
                "/alert BTC +5%", "/alert ETH ±3%", "/alert USDT -1%", "/alerts"):
        n = len(SENT)
        R.handle_update(S, upd(uid, cmd))
        check(len(SENT) > n, f"{lang} {cmd} answers")
    for cb in ("ln:0", "ln:4", "lg:iq", "lg:krd", "lc:0", "qa:BTC", "qa:BTC:+5", "qa:USDT", "qa:USDT:±2", "ca:ETH",
               "tk:" + CA, "sb:whale", "sb:vol", "sb:launch", "sb:sig", "ot:kit", "px:isp", "isp:mci", "px:share"):
        n = len(SENT)
        R.handle_update(S, upd(uid, data=cb))
        check(len(SENT) > n, f"{lang} callback {cb}")

print("2) token card verdicts")
t_ok, _ = TK.card(CA, "en")
t_bad, _ = TK.card(SCAM, "en")
check("🟢 Basic risk: low" in t_ok, "PEPE is low risk")
check("⛔ Critical" in t_bad and "Honeypot" in t_bad, "honeypot is critical")
check("Very low liquidity" in t_bad and "Many buys but almost no sells" in t_bad, "scam heuristics fire")
check(TK.detect("look 0x6982508145454Ce325dDbE47a25d4ec3d2311933 now") == CA, "detect EVM in text")
check(TK.detect("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t") == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", "detect Tron")
check(TK.detect("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263") == "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "detect Solana")
check(TK.detect("bitcoin price today") is None and TK.detect("BTC") is None, "no false address")
n = len(SENT)
R.handle_update(S, upd(100, CA))
check("PEPE" in last_text(), "pasting a CA opens the card")

print("3) % alerts fire, price alerts unaffected")
x = S["users"]["100"]
x["alerts"] = []
R.handle_update(S, upd(100, "/alert BTC +5%"))
R.handle_update(S, upd(100, "/alert ETH ±3%"))
R.handle_update(S, upd(100, "/alert SOL 200"))
check(len(x["alerts"]) == 3, "three alerts stored")
PRICES["BTC"] = (81000.0, 5.0)
PRICES["ETH"] = (2150.0, -4.0)
R._last_alert_check[0] = 0
n = len(SENT)
R.check_alerts(S)
out = texts_since(n)
check(any("BTC" in o for o in out) and any("ETH" in o for o in out), "BTC +5% and ETH ±3% fired")
check(len(x["alerts"]) == 1 and x["alerts"][0]["coin"] == "SOL", "SOL price alert still waiting")

print("4) token alert: price move and liquidity pull")
x["talerts"] = []
TK.add_alert(x, CA, 20, "fa")
PRICE_NOW["liq"] = 10_000_000
TK._last_check[0] = 0
n = len(SENT)
TK.check_alerts(S, R.send_rows)
check(any("نقدینگی" in o for o in texts_since(n)), "liquidity pull warned")
check(not x["talerts"], "token alert cleared after firing")

print("5) outage: detection with hysteresis, kit, digest")
S["users"]["100"]["kit"] = True
OU.ioda_metrics = lambda: {"ping": 0.2, "bgp": 0.5}
OU._last[0] = 0
OU.check(S, R.notify_admins, lambda k, lv: R.outage_push(S, k, lv))
check(OU.level(S) == "ok", "one bad reading is not enough")
OU._last[0] = 0
n = len(SENT)
OU.check(S, R.notify_admins, lambda k, lv: R.outage_push(S, k, lv))
check(OU.level(S) == "blackout", "two bad readings → blackout")
out = texts_since(n)
check(any("t.me/proxy" in o for o in out), "kit with proxy links pushed")
R.handle_update(S, upd(100, data="m:main"))
check("m:outage" in json.dumps(SENT[-1][1].get("reply_markup")), "outage button on top of main menu")
OU.ioda_metrics = lambda: {"ping": 1.0, "bgp": 1.0}
for _ in range(2):
    OU._last[0] = 0
    n = len(SENT)
    OU.check(S, R.notify_admins, lambda k, lv: R.outage_push(S, k, lv))
check(OU.level(S) == "ok", "recovers after two good readings")
check(any("خلاصه" in o or "missed" in o for o in texts_since(n)), "catch-up digest sent")
CH["USDTTetherp"][0]["iso"] = OLD_ISO
CH["NerkhDollarIRT"][0]["iso"] = OLD_ISO
CH["ttprice"][0]["iso"] = OLD_ISO
IR._cache.clear() if hasattr(IR, "_cache") else None
_awake = OU._iran_awake
OU._iran_awake = lambda: True
check("min" in OU.banner(S, "en"), "stale-price banner shows in Iran's daytime")
OU._iran_awake = lambda: False
check(OU.banner(S, "en") == "", "no stale banner at night (channels are quiet)")
OU._iran_awake = lambda: True
print("5b) feed silence alone: admins only, no user kit; manual override expires / off resumes auto")
OU.ioda_metrics = lambda: {"ping": 1.0, "bgp": 1.0}
for _ in range(2):
    OU._last[0] = 0
    n = len(SENT)
    OU.check(S, R.notify_admins, lambda k, lv: R.outage_push(S, k, lv))
check(OU.level(S) == "degraded", "silent feeds → degraded")
check(not any("t.me/proxy" in o for o in texts_since(n)), "…but no kit pushed to users without IODA")
OU.ioda_metrics = lambda: {"ping": 0.5, "bgp": 0.95}
OU._last[0] = 0
n = len(SENT)
OU.check(S, R.notify_admins, lambda k, lv: R.outage_push(S, k, lv))
check(any("t.me/proxy" in o for o in texts_since(n)), "IODA confirmation → kit pushed")
R.handle_update(S, upd(1, "/outage off"))
check(OU.level(S) == "ok" and OU.st(S)["manual"] is None, "/outage off returns to ok and keeps auto detection")
R.handle_update(S, upd(1, "/outage on"))
check(OU.level(S) == "blackout", "/outage on")
OU.st(S)["manual_until"] = 0
check(OU.st(S)["manual"] is None, "manual override expires")
OU._iran_awake = _awake
check(OU.classify({}, 200)[0] in ("ok", "degraded"), "classify without IODA does not crash")

print("6) proxies: multi-source parse, dead dropped, in-Iran votes reorder")
PX2._cache["t"] = 0
items = PX2.ranked(S)
hosts = [i["host"] for i in items]
check("a.example.com" in hosts and "c.example.com" in hosts and "b.example.com" not in hosts, f"parsed + probed {hosts}")
pid_c = [i["id"] for i in items if i["host"] == "c.example.com"][0]
for u in range(200, 206):
    PX2.vote(S, u, "mci", pid_c, True)
check(PX2.ranked(S, "mci")[0]["host"] == "c.example.com", "votes from MCI users push c to the top")
check(not PX2.vote(S, 200, "mci", pid_c, True), "one vote per user per 6h")
R.handle_update(S, upd(1, "/addproxy https://t.me/proxy?server=own.example&port=443&secret=ee11"))
check(PX2.best_links(S)[0].startswith("https://t.me/proxy?server=own.example"), "admin proxy listed first")

print("7) launches, whales, volume, signals, follows, DCA")
S["users"]["101"].setdefault("subs", {})["launch"] = True
S.pop("launch_seen", None)
TK._launch_last[0] = 0
TK.scan_launches(S, R.launch_send)
fake_get.launch = True
TK._launch_last[0] = 0
n = len(SENT)
TK.scan_launches(S, R.launch_send)
check(any("NEW1" in o for o in texts_since(n)), "quality launch delivered")
S["users"]["101"]["subs"]["whale"] = 10_000_000
S.pop("whale_seen", None)
W._whale_last[0] = 0
W.scan_whales(S, D, R.send_rows)
DATA["whales"]["events"].append({"asset": "ETH", "amount": 9000, "usd": 20_000_000, "tx": "0xbbb", "from": "0x" + "3" * 40,
                                  "to": "0x" + "4" * 40})
W._whale_last[0] = 0
n = len(SENT)
W.scan_whales(S, D, R.send_rows)
check(any("9,000 ETH" in o or "9,000" in o for o in texts_since(n)), "new whale delivered (old one not repeated)")
kl = [[0, "1", "1", "1", "1", "0", 0, "1000000"] for _ in range(25)] + [[0, "100", "1", "1", "103", "0", 0, "9000000"], [0, "1", "1", "1", "1", "0", 0, "1"]]
sp = W.spike(kl)
check(sp and sp[0] >= 8 and abs(sp[2] - 3) < 0.01, f"volume spike math {sp}")
S["users"]["101"]["subs"]["sig"] = True
S.pop("sig_seen", None)
W._sig_last[0] = 0
W.scan_signals(S, D, R.send_rows)
DATA["signals"]["signals"].append({"id": "s2", "ind": "kurdistani-style-cycle", "sym": "BTCUSDT", "tf": "1D", "side": "short", "price": 81000})
W._sig_last[0] = 0
n = len(SENT)
W.scan_signals(S, D, R.send_rows)
check(any("42" in o for o in texts_since(n)), "signal comes with its track record")
d = W.diff({"ETH": (1.0, 2000.0)}, {"ETH": (3.0, 6000.0), "PEPE": (1e9, 4000.0)})
check([r[0] for r in d] == ["ETH", "PEPE"] and d[0][2] > 0, f"wallet diff {d}")
holdings = {"w": [{"ETH": (1.0, 2250.0)}, {"ETH": (2.0, 4500.0)}]}
_orig_wh = W.wallet_holdings
W.wallet_holdings = lambda addr, D_, ttl=300: holdings["w"].pop(0) if holdings["w"] else {"ETH": (2.0, 4500.0)}
R.handle_update(S, upd(102, "/follow 0x" + "5" * 40))
W._fw_last[0] = 0
W.scan_follows(S, D, R.send_rows)
W._fw_last[0] = 0
n = len(SENT)
W.scan_follows(S, D, R.send_rows)
check(any("ETH" in o for o in texts_since(n)), "followed wallet buy reported")
plan = S["users"]["100"]["dca"][0]
plan["next"] = 0
W._dca_last[0] = 0
n = len(SENT)
W.dca_due(S, D, R.send_rows)
check(any("DCA" in o or "پله" in o for o in texts_since(n)), "DCA reminder")
R.handle_update(S, upd(100, data="db:1"))
check(len(plan["buys"]) == 1, "DCA buy logged")

print("7b) reviewer regressions")
W.wallet_holdings = _orig_wh
check(W.parse_pct("%") is None, "'/alert BTC %' does not crash")
sec_l = dict(SEC_OK, lp_holders=[{"address": "0x9", "percent": "1", "is_locked": 0}], is_in_cex={"listed": "1", "cex_list": ["Binance"]})
a = TK.analyze(PAIR, sec_l, None)
check(not any(k == "lp_unlocked" for k, _ in a["flags"]), "CEX-listed token skips the LP-lock alarm")
a = TK.analyze(PAIR, dict(SEC_OK, sell_tax="", buy_tax=""), {"simulationResult": {"sellTax": 35}})
check(any(k == "sell_tax" for k, _ in a["flags"]), "honeypot.is sell tax used when GoPlus has none")
taxed = dict(SEC_SOL)
a = TK.analyze(NEW_PAIR, taxed, None, "solana")
a["stats"]["sell_tax"] = 0.22
check(not TK.quality(NEW_PAIR, a), "launch with 22% sell tax is filtered out")
check(TK.best_pair([dict(PAIR, baseToken={"address": "0xother"}, quoteToken={"address": CA})], CA) is None, "no quote-token fallback")
class _Bad:
    status_code = 429
    def raise_for_status(self):
        raise RuntimeError("429")
    def json(self):
        return {"error": {"code": 429}}
_real_get = W.requests.get
W.requests.get = lambda *a, **k: _Bad()
W._wcache.clear()
check(W.wallet_holdings("0x" + "7" * 40, D) is None, "wallet API error → None, not an empty wallet")
W.requests.get = _real_get
check(W.diff({"ETH": (1.0, 2000.0)}, {"ETH": (1.0, 2000.0), "SPAM": (1e6, 0.0)}) == [], "unpriced spam is not a 'buy'")
print("8) scam report reaches admins; state saves")
R.handle_update(S, upd(103, data="lr:0"))
n = len(SENT)
R.handle_update(S, upd(103, "fake support account @scammer asked for my seed"))
check(any(p.get("chat_id") == 1 and "scam report" in p.get("text", "") for m, p in SENT[n:]), "report forwarded to admin")
R.save_state(S)
check(os.path.exists(os.environ["STATE_PATH"]) or os.path.exists(os.environ["STATE_PATH"] + ".enc"), "state saved")
check(W.size("77000 75500 20", "en", D).count("Quantity") == 1, "size calc")
check(W.parse_pct("+5%") == ("+", 5.0) and W.parse_pct("۵٪") == ("±", 5.0) and W.parse_pct("80000") is None, "parse_pct")

print()
print(f"FAILED: {len(FAILS)}" if FAILS else "ALL PASSED")
for f in FAILS:
    print(" -", f)
sys.exit(1 if FAILS else 0)
