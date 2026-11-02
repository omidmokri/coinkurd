#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Signals hub — exclusive signals of Coin_Kurd's TradingView indicators on entekhab.net

1) TradingView relay (exact TradingView signals, no server needed):
   TradingView alert → webhook https://api.telegram.org/bot<TOKEN>/sendMessage → public Telegram signals channel
   → this script reads https://t.me/s/<channel> every run and imports every message that contains an #ESIG line:

     #ESIG <indicator-code>|<EXCHANGE:TICKER>|<interval>|<action>|<price>|<order id>|<position>|<prev position>|<time>[|sl=..|tp=..]

   (strategy alerts fill the last fields with {{strategy.order.id}}, {{strategy.market_position}}, {{strategy.prev_market_position}};
    indicator alerts use "-" there and a fixed action buy / sell)
   The channel is set in data/indicators.json → "relay.channel" (or env SIGNALS_CHANNEL). Empty = relay off.

2) Outcomes for every signal (relay + server-computed ones from scripts/kind.py), measured on real Binance candles:
   intraday signals → +6h / +24h / +72h, daily signals → +7d / +30d / +90d, max favourable / adverse move,
   SL / TP hit order when the alert carries them, and realized result when a strategy exit follows its entry.

Output: data/signals.json  {"signals": [...], "stats": {indicator: {...}}, "relay": {...}}
"""
import json
import os
import re
import time
from datetime import datetime, timezone, timedelta

import requests
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
SIG = os.path.join(D, "signals.json")
IND = os.path.join(D, "indicators.json")
NOW = datetime.now(timezone.utc)
BN = "https://data-api.binance.vision/api/v3/klines"
UA = {"User-Agent": "Mozilla/5.0 (compatible; entekhab.net signals/1.0)"}
H_INTRA = [("6h", 6), ("24h", 24), ("72h", 72)]
H_DAILY = [("7d", 7), ("30d", 30), ("90d", 90)]


def load(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def get(url, params=None, timeout=30, js=True):
    for i in range(3):
        try:
            r = requests.get(url, params=params, timeout=timeout, headers=UA)
            if r.status_code == 200:
                return r.json() if js else r.text
            print("  http", r.status_code, url[:80])
            if r.status_code in (400, 404):
                return None
        except Exception as e:  # noqa: BLE001
            print("  err", str(e)[:120])
        time.sleep(2 + 3 * i)
    return None


# ------------------------------------------------------------------ relay import
def norm_tf(x):
    x = (x or "").strip().upper()
    if x.isdigit():
        m = int(x)
        return f"{m}m" if m < 60 else (f"{m // 60}h" if m % 60 == 0 and m < 1440 else f"{m}m")
    return {"D": "1D", "1D": "1D", "W": "1W", "1W": "1W", "M": "1M", "1M": "1M"}.get(x, x.lower())


def binance_symbol(tv):
    t = (tv or "").split(":")[-1].upper().replace(".P", "").replace("PERP", "").replace("/", "").replace("-", "")
    if t.endswith("USD") and not t.endswith(("USDT", "USDC")):
        t += "T"
    return t if re.fullmatch(r"[A-Z0-9]{2,15}(USDT|USDC|BTC|ETH)", t) else None


def fnum(x):
    try:
        v = float(str(x).replace(",", ""))
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def parse_esig(line, codes):
    f = [x.strip() for x in line.split("|")]
    f[0] = re.sub(r"^#?ESIG\s*", "", f[0], flags=re.I).strip()
    if len(f) < 5:
        return None
    ind = codes.get(f[0].lower(), f[0].lower())
    tv, tf, act, price = f[1], norm_tf(f[2]), f[3].lower(), fnum(f[4])
    oid = f[5] if len(f) > 5 and f[5] not in ("-", "") else None
    pos = f[6].lower() if len(f) > 6 and f[6] not in ("-", "") else None
    prev = f[7].lower() if len(f) > 7 and f[7] not in ("-", "") else None
    ts = f[8] if len(f) > 8 and f[8] not in ("-", "") else None
    kv = {}
    for x in f[9:]:
        if "=" in x:
            k, v = x.split("=", 1)
            kv[k.strip().lower()] = fnum(v)
    if pos in ("long", "short", "flat") and prev in ("long", "short", "flat"):
        if pos == "flat" and prev != "flat":
            side, kind = prev, "exit"
        elif pos != prev:
            side, kind = pos, "entry"
        else:
            side, kind = pos, "partial"
    elif act in ("buy", "long"):
        side, kind = "long", "entry"
    elif act in ("sell", "short"):
        side, kind = "short", "entry"
    elif act in ("exit_long", "close_long"):
        side, kind = "long", "exit"
    elif act in ("exit_short", "close_short"):
        side, kind = "short", "exit"
    else:
        return None
    return {"ind": ind, "tv_sym": tv, "sym": binance_symbol(tv), "tf": tf, "side": side, "kind": kind, "price": price,
            "order": oid, "sl": kv.get("sl"), "tp": kv.get("tp"), "tp2": kv.get("tp2"), "ts": ts}


def read_channel(ch, codes, pages=3):
    found, before = [], None
    for _ in range(pages):
        html = get(f"https://t.me/s/{ch}" + (f"?before={before}" if before else ""), js=False)
        if not html:
            break
        soup = BeautifulSoup(html, "html.parser")
        msgs = soup.select("div.tgme_widget_message")
        if not msgs:
            break
        ids = []
        for w in msgs:
            post = w.get("data-post", "")
            try:
                mid = int(post.rsplit("/", 1)[-1])
            except ValueError:
                continue
            ids.append(mid)
            te = w.select_one(".tgme_widget_message_text")
            tm = w.select_one(".tgme_widget_message_date time")
            if not te:
                continue
            for br in te.find_all("br"):
                br.replace_with("\n")
            text = te.get_text()                                   # inline tags (hashtag links) stay on the same line
            for line in text.splitlines():
                if "ESIG" in line.upper() and "|" in line:
                    s = parse_esig(line.strip(), codes)
                    if s:
                        t = None
                        s.pop("ts", None)                          # Telegram post time is used (same moment, reliable format)
                        if tm and tm.get("datetime"):
                            t = datetime.fromisoformat(tm["datetime"].replace("Z", "+00:00")).astimezone(timezone.utc)
                        s.update({"id": f"tv-{ch}-{mid}", "src": "tv", "t": (t or NOW).isoformat(), "msg": f"https://t.me/{ch}/{mid}"})
                        found.append(s)
                    break
        if not ids or min(ids) <= 1:
            break
        before = min(ids)
    return found


# ------------------------------------------------------------------ outcomes
KC = {}


def klines(sym, interval, start_ms):
    key = (sym, interval)
    have = KC.get(key)
    if have and have[0][0] <= start_ms:
        return have
    out, st = [], start_ms
    for _ in range(12):
        k = get(BN, {"symbol": sym, "interval": interval, "startTime": st, "limit": 1000})
        if not k:
            break
        out += [(x[0], float(x[2]), float(x[3]), float(x[4])) for x in k]
        if len(k) < 1000:
            break
        st = k[-1][0] + 1
    KC[key] = out
    return out


def outcome(s):
    if not s.get("sym") or not s.get("price") or s.get("kind") == "exit":
        return None
    daily = s.get("tf") in ("1D", "1W", "1M")
    t0 = datetime.fromisoformat(s["t"])
    unit = timedelta(days=1) if daily else timedelta(hours=1)
    # daily state signals are stamped at the day's open and priced at that day's close → the close happened one day later
    t_eff = t0 + unit if daily else t0
    hs = H_DAILY if daily else H_INTRA
    ks = [k for k in klines(s["sym"], "1d" if daily else "1h", int(t0.timestamp() * 1000) - int(unit.total_seconds() * 1000))
          if k[0] >= int(t_eff.timestamp() * 1000)]
    if not ks:
        return None
    p0, sgn = s["price"], (-1 if s.get("side") == "short" else 1)
    res, done = {}, True
    for name, n in hs:
        target = t_eff + n * unit
        if NOW < target:
            done = False
            continue
        k = next((k for k in ks if k[0] >= int((target - unit).timestamp() * 1000)), None)
        if k:
            res[name] = round(sgn * (k[3] / p0 - 1) * 100, 2)
    end = int((t_eff + hs[-1][1] * unit).timestamp() * 1000)
    win = [k for k in ks if k[0] < end]
    o = {"r": res, "done": done and len(res) == len(hs)}
    if win:
        hi, lo = max(k[1] for k in win), min(k[2] for k in win)
        fav, adv = ((hi / p0 - 1) * 100, (lo / p0 - 1) * 100) if sgn > 0 else ((1 - lo / p0) * 100, (1 - hi / p0) * 100)
        o["mfe"], o["mae"] = round(fav, 2), round(adv, 2)
        o["last"] = round(sgn * (win[-1][3] / p0 - 1) * 100, 2)
    if s.get("sl") or s.get("tp"):
        hit = None
        for k in win:
            sl_hit = s.get("sl") and ((k[2] <= s["sl"]) if sgn > 0 else (k[1] >= s["sl"]))
            tp_hit = s.get("tp") and ((k[1] >= s["tp"]) if sgn > 0 else (k[2] <= s["tp"]))
            if sl_hit or tp_hit:
                hit = "sl" if sl_hit else "tp"            # same candle → assume stop first (conservative)
                o["hit_t"] = datetime.fromtimestamp(k[0] / 1000, timezone.utc).isoformat()
                break
        o["hit"] = hit
    return o


def pair_trades(sigs):
    """strategy alerts: an exit closes the latest open entry of the same indicator/symbol/timeframe/side"""
    open_ = {}
    for s in sorted([x for x in sigs if x.get("src") == "tv"], key=lambda x: x["t"]):
        key = (s["ind"], s.get("tv_sym"), s.get("tf"), s.get("side"))
        if s["kind"] == "entry":
            open_[key] = s
        elif s["kind"] == "exit" and key in open_ and s.get("price") and open_[key].get("price"):
            e = open_.pop(key)
            sg = -1 if e["side"] == "short" else 1
            e.setdefault("out", {})["trade"] = {"exit_t": s["t"], "exit_price": s["price"], "r": round(sg * (s["price"] / e["price"] - 1) * 100, 2)}


def stats(sigs):
    st = {}
    for s in sigs:
        a = st.setdefault(s["ind"], {"n": 0, "n30": 0, "last": None, "long": 0, "short": 0, "eval": 0, "wins": 0, "sum": 0.0, "h": None,
                                      "trades": 0, "twins": 0, "tsum": 0.0})
        if s.get("kind") not in ("entry", "state"):
            continue
        a["n"] += 1
        if NOW - datetime.fromisoformat(s["t"]) <= timedelta(days=30):
            a["n30"] += 1
        a["last"] = max(a["last"] or s["t"], s["t"])
        if s.get("side") in ("long", "short"):
            a[s["side"]] += 1
            h = "30d" if s.get("tf") in ("1D", "1W", "1M") else "24h"
            v = ((s.get("out") or {}).get("r") or {}).get(h)
            if v is not None:
                a["eval"] += 1
                a["wins"] += v > 0
                a["sum"] += v
                a["h"] = h
            tr = (s.get("out") or {}).get("trade")
            if tr:
                a["trades"] += 1
                a["twins"] += tr["r"] > 0
                a["tsum"] += tr["r"]
    for a in st.values():
        a["win"] = round(a["wins"] * 100 / a["eval"]) if a["eval"] else None
        a["avg"] = round(a["sum"] / a["eval"], 2) if a["eval"] else None
        a["twin"] = round(a["twins"] * 100 / a["trades"]) if a["trades"] else None
        a["tavg"] = round(a["tsum"] / a["trades"], 2) if a["trades"] else None
        for k in ("wins", "sum", "twins", "tsum"):
            a.pop(k)
    return st


def main():
    ind = load(IND, {})
    sig = load(SIG, {"signals": []})
    relay = ind.get("relay") or {}
    ch = (os.environ.get("SIGNALS_CHANNEL") or relay.get("channel") or "").strip().lstrip("@")
    codes = {}
    for it in ind.get("items", []):
        if it.get("esig"):
            codes[it["esig"].lower()] = it["id"]
        codes[it["id"].lower()] = it["id"]
    have = {s["id"]: s for s in sig.get("signals", [])}
    new = 0
    if ch:
        for s in read_channel(ch, codes):
            if s["id"] not in have:
                have[s["id"]] = s
                new += 1
        sig["relay"] = {"channel": ch, "checked_at": NOW.isoformat(), "new": new}
    else:
        sig["relay"] = {"channel": None, "checked_at": NOW.isoformat(), "note": "relay not configured yet"}
    sigs = sorted(have.values(), key=lambda s: s["t"], reverse=True)
    calc = 0
    for s in sorted(sigs, key=lambda x: x["t"]):          # oldest first → one candle download per symbol covers all
        o = s.get("out") or {}
        old_ = NOW - datetime.fromisoformat(s["t"]) > timedelta(days=21)
        if o.get("done") and (s.get("src") != "tv" or o.get("trade") or old_):
            continue
        try:
            r = outcome(s)
        except Exception as e:  # noqa: BLE001
            print("  outcome err", s.get("id"), str(e)[:100])
            r = None
        if r:
            if o.get("trade"):
                r["trade"] = o["trade"]
            s["out"] = r
            calc += 1
    pair_trades(sigs)
    sig["signals"] = sigs[:3000]
    sig["stats"] = stats(sigs)
    sig["updated_at"] = NOW.isoformat()
    json.dump(sig, open(SIG, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"relay channel: {ch or '-'} | new: {new} | signals: {len(sigs)} | outcomes updated: {calc} | stats: {json.dumps(sig['stats'], ensure_ascii=False)[:400]}")


if __name__ == "__main__":
    main()
