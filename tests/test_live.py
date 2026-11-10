"""
Offline test of the live-analysis relay (scripts/signals.py): #ESTATE parsing, channel reading, live.json merge.

    python tests/test_live.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import signals as S  # noqa: E402

CODES = {"kmix": "kurdistani-market-intelligence-x", "kroj": "kurdistan-roj",
         "kurdistani-market-intelligence-x": "kurdistani-market-intelligence-x", "kurdistan-roj": "kurdistan-roj"}
IDS = set(CODES.values())
NOW = datetime(2026, 11, 10, 12, tzinfo=timezone.utc)
ok = 0


def check(cond, what):
    global ok
    assert cond, what
    ok += 1


# 1) parsing
s = S.parse_estate("#ESTATE kmix|BINANCE:BTCUSDT|240|74638.5|2026-11-10T08:00:00Z|dir=long|score=72|decision=Wait <b>|sl=72,100|tp1=78000|bad key=1|note=", CODES)
check(s["ind"] == "kurdistani-market-intelligence-x", "code maps to indicator id")
check(s["sym"] == "BTCUSDT" and s["tf"] == "4h" and s["price"] == 74638.5, "symbol / timeframe / price")
check(s["f"]["score"] == 72.0 and s["f"]["sl"] == 72100.0 and s["f"]["tp1"] == 78000.0, "numbers parsed (thousands separator too)")
check(s["f"]["decision"] == "Wait b" and s["f"]["dir"] == "long", "text kept, HTML brackets stripped")
check("bad key" not in s["f"] and "note" not in s["f"], "invalid key and empty value dropped")
check(s["ts"] == "2026-11-10T08:00:00Z", "time field")
check(S.parse_estate("#ESTATE unknown|BINANCE:BTCUSDT|60|1|-|dir=long", CODES) is None, "unknown indicator rejected")
check(S.parse_estate("#ESTATE kmix|BINANCE:BTCUSDT", CODES) is None, "too short rejected")
s2 = S.parse_estate("ESTATE KMIX|OKX:ETHUSDT.P|D|3500|-|" + "|".join(f"k{i}=1" for i in range(40)), CODES)
check(len(s2["f"]) == 24 and s2["tf"] == "1D" and s2["sym"] == "ETHUSDT" and s2["ts"] is None, "field cap, daily tf, perp symbol")
check(S.parse_estate("#ESTATE kmix|BINANCE:BTCUSDT|60|1|-|score=1e3", CODES)["f"]["score"] == 1000.0, "exponent numbers")

# 2) channel reading (fixture HTML in place of t.me/s)
HTML = """<div class="tgme_widget_message" data-post="ch/12"><div class="tgme_widget_message_text">#ESTATE kmix|BINANCE:BTCUSDT|60|70000|-|dir=short|score=31</div><div class="tgme_widget_message_date"><time datetime="2026-11-10T11:00:00+00:00"></time></div></div>
<div class="tgme_widget_message" data-post="ch/13"><div class="tgme_widget_message_text">#ESIG kroj|BINANCE:BTCUSDT|60|buy|70100|L1|long|flat|-|sl=69000|tp=72000</div><div class="tgme_widget_message_date"><time datetime="2026-11-10T11:05:00+00:00"></time></div></div>"""
calls = []
S.get = lambda url, params=None, timeout=30, js=True: (calls.append(url), HTML if len(calls) == 1 else None)[1]
sigs, states, top = S.read_channel("ch", CODES, stop_at=0)
check(len(sigs) == 1 and sigs[0]["side"] == "long" and sigs[0]["sl"] == 69000, "ESIG still read")
check(len(states) == 1 and states[0]["mid"] == 12 and states[0]["t"].startswith("2026-11-10T11:00"), "ESTATE read with Telegram time")
check(top == 13, "highest message id")
calls.clear()
S.read_channel("ch", CODES, stop_at=12)
check(len(calls) == 1, "paging stops at already-read messages")

# 3) merge
t = lambda h: (NOW - timedelta(hours=h)).isoformat()  # noqa: E731
prev = {"items": {"kurdistani-market-intelligence-x": {"states": [
    {"ind": "kurdistani-market-intelligence-x", "tv_sym": "BINANCE:BTCUSDT", "tf": "1h", "t": t(5), "f": {"dir": "long"}},
    {"ind": "kurdistani-market-intelligence-x", "tv_sym": "BINANCE:SOLUSDT", "tf": "1h", "t": t(24 * 40), "f": {}}]}}}
new = [{"ind": "kurdistani-market-intelligence-x", "tv_sym": "BINANCE:BTCUSDT", "tf": "1h", "t": t(1), "ts": "x", "f": {"dir": "short"}}]
engine = {"states": [{"ind": "kurdistan-roj", "tv_sym": "BINANCE:ETHUSDT", "tf": "4h", "t": t(2), "f": {"decision": "WAIT"}},
                     {"ind": "secret-not-listed", "tv_sym": "X", "tf": "1h", "t": t(1), "f": {}}]}
sg = [{"id": "a", "ind": "kurdistan-roj", "src": "tv", "kind": "entry", "side": "long", "t": t(10), "tv_sym": "BINANCE:BTCUSDT", "tf": "1h", "price": 1},
      {"id": "b", "ind": "kurdistan-roj", "src": "tv", "kind": "entry", "side": "long", "t": t(9), "tv_sym": "BINANCE:ETHUSDT", "tf": "1h", "price": 1, "out": {"hit": "sl"}},
      {"id": "c", "ind": "kurdistan-roj", "src": "tv", "kind": "entry", "side": "short", "t": t(8), "tv_sym": "BINANCE:SOLUSDT", "tf": "1h", "price": 1},
      {"id": "d", "ind": "kurdistan-roj", "src": "tv", "kind": "exit", "side": "short", "t": t(7), "tv_sym": "BINANCE:SOLUSDT", "tf": "1h", "price": 1}]
L = S.build_live(prev, new, engine, sg, IDS, now=NOW)
mix = L["kurdistani-market-intelligence-x"]["states"]
check(len(mix) == 1 and mix[0]["f"]["dir"] == "short" and "ts" not in mix[0], "newer state replaces older; >30-day state pruned")
roj = L["kurdistan-roj"]
check(roj["states"][0]["src"] == "engine", "private-engine state merged")
check("secret-not-listed" not in L, "engine states for unlisted indicators ignored")
check([p["id"] for p in roj["pos"]] == ["a"], "open position kept; SL-hit and exited ones removed")
check(roj["last"]["id"] == "d", "last signal")
older = [{"ind": "kurdistani-market-intelligence-x", "tv_sym": "BINANCE:BTCUSDT", "tf": "1h", "t": t(9), "f": {"dir": "old"}}]
check(S.build_live({"items": L}, older, {}, [], IDS, now=NOW)["kurdistani-market-intelligence-x"]["states"][0]["f"]["dir"] == "short",
      "an older message never overwrites a newer state")

bad = S.clean_engine({"ind": "kurdistan-roj", "t": "2026-11-10T10:00:00Z", "tv_sym": "BINANCE:BTCUSDT", "tf": "60", "price": "70000",
                       "code": "//@version=6 strategy(...)", "f": {"dir": "long", "src": "x" * 500, "obj": {"a": 1}, "flag": True, "Bad Key": 1, "score": 5}})
check(set(bad) == {"ind", "tv_sym", "sym", "tf", "price", "t", "src", "f"} and "code" not in bad, "engine: unknown top-level keys dropped")
check(bad["f"] == {"dir": "long", "src": "x" * 48, "score": 5.0} and bad["tf"] == "1h", "engine: only short scalars kept")
check(S.clean_engine({"ind": "x", "t": "not a time"}) is None, "engine: bad time rejected")

print(f"live relay: {ok} checks passed")
