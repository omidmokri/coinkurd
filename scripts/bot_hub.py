"""
Entekhab data products, produced by the always-on bot and published to the site (data/*.json):

  1. Sentiment index  — every news/on-chain summary and every dossier is scored by AI from −100 (very bearish) to
                        +100 (very bullish), per coin; daily index + history → data/sentiment.json  (/sentiment/)
  2. Prediction game  — a daily and a weekly Bitcoin question; users vote with buttons (bot menu, and the weekly
                        question once in the channel); correct answers earn points → data/predict.json  (/predict/)
  3. Whale radar      — large on-chain transfers: Bitcoin ≥ 500 BTC (every new block), Ethereum ≥ 1,000 ETH,
                        USDT/USDC ≥ 10M (public node) → data/whales.json  (/whales/)
Charts on those pages use TradingView Lightweight Charts (assets/vendor/lightweight-charts.js).
"""
import html
import json
import logging
import re
import threading
import time
from datetime import datetime, timedelta, timezone

import requests

import ai
import bot_data as D
import bot_feeds as F

log = logging.getLogger("hub")
UA = {"User-Agent": "Mozilla/5.0 (CoinKurdBot)"}
COINS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "TON", "ADA", "USDT"]


def hub(s):
    h = s.setdefault("hub", {})
    h.setdefault("scores", {})          # key -> {score, coins, at, title}
    h.setdefault("pred", {"rounds": [], "pts": {}})
    h.setdefault("whales", {"events": [], "btc_hash": "", "eth_block": 0})
    return h


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ================================================================== 1. sentiment
SENT_PROMPT = """تو تحلیلگر احساسات بازار کریپتو هستی. برای هر متن خبری زیر، اثر خبر بر بازار را از دید یک معامله‌گر نمره بده:
-100 یعنی خیلی نزولی، 0 خنثی، +100 خیلی صعودی. فقط به خود متن نگاه کن.
coins فهرست نماد ارزهایی است که خبر مستقیماً درباره‌شان است (از این‌ها: BTC, ETH, SOL, XRP, BNB, DOGE, TON, ADA, USDT)؛ اگر خبر کلی بازار است خالی بگذار.
خروجی فقط JSON: [{"id": "...", "score": عدد صحیح, "coins": ["BTC"]}]

متن‌ها:
"""


def sentiment_inputs(s):
    f = F.feed_state(s)
    out = []
    for kind in ("news", "onchain"):
        for it in f["items"].get(kind, []):
            if it.get("fa"):
                out.append((f"{kind}:{it['id']}", it.get("at") or it.get("made") or now_iso(), it["fa"]))
    for it in (s.get("deep") or {}).get("posts", []):
        out.append((f"deep:{it['id']}", it["at"], re.sub(r"</?b>", "", it["fa"]).split("\n", 1)[-1].strip()))
    return out


def parse_scores(raw):
    """the model may answer a bare list, {"items": [...]}, or JSON wrapped in prose/fences (ai.generate(as_json=True)
    may also hand back the already-parsed object)"""
    if isinstance(raw, (list, dict)):
        raw = json.dumps(raw)
    raw = re.sub(r"^```\w*|```$", "", (raw or "").strip()).strip()
    for cand in (raw, (re.search(r"\[.*\]", raw, re.S) or [None])[0]):
        if not cand:
            continue
        try:
            res = json.loads(cand)
        except Exception:
            continue
        if isinstance(res, dict):
            res = next((v for v in res.values() if isinstance(v, list)), [res])
        if isinstance(res, list):
            return [r for r in res if isinstance(r, dict)]
    return []


def score_new(s, limit=25):
    h = hub(s)
    todo = [x for x in sentiment_inputs(s) if x[0] not in h["scores"]][:limit]
    if not todo or not ai.available():
        return False
    body = "\n\n".join(f"[id={k}]\n{t[:700]}" for k, _, t in todo)
    try:
        raw = ai.generate(SENT_PROMPT + body, as_json=True, temperature=0.1, max_tokens=4000)
    except Exception as ex:
        log.warning("sentiment scoring failed: %s", ex)
        return False
    res = parse_scores(raw)
    if not res:
        log.warning("sentiment: unreadable answer: %s", str(raw)[:200])
        return False
    by = {k: (at, t) for k, at, t in todo}
    n = 0
    for r in res if isinstance(res, list) else []:
        k = str(r.get("id", ""))
        if k in by:
            try:
                sc = max(-100, min(100, int(r.get("score", 0))))
            except Exception:
                continue
            coins = [c for c in (r.get("coins") or []) if c in COINS]
            title = by[k][1].split("\n")[0][:140]
            h["scores"][k] = {"score": sc, "coins": coins, "at": by[k][0], "title": title}
            n += 1
    for k, v in h["scores"].items():                  # dossier titles: skip the fixed header line
        if k.startswith("deep:") and v["title"].startswith("🧠"):
            txt = next((t_ for kk, _, t_ in sentiment_inputs(s) if kk == k), "")
            v["title"] = txt.split("\n")[0][:140] or v["title"]
    if len(h["scores"]) > 1500:                         # keep the newest
        for k in sorted(h["scores"], key=lambda k: h["scores"][k]["at"])[:-1500]:
            del h["scores"][k]
    log.info("sentiment: scored %d", n)
    return n > 0


def label(v):
    if v is None:
        return "بدون داده"
    return ("خیلی صعودی" if v >= 40 else "صعودی" if v >= 12 else "خنثی" if v > -12
            else "نزولی" if v > -40 else "خیلی نزولی")


def sentiment_data(s):
    sc = list(hub(s)["scores"].values())
    days = {}
    for x in sc:
        days.setdefault(x["at"][:10], []).append(x["score"])
    hist = [{"d": d, "v": round(sum(v) / len(v), 1), "n": len(v)} for d, v in sorted(days.items())]
    cut = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    last = [x for x in sc if x["at"] >= cut]
    avg = lambda xs: round(sum(xs) / len(xs), 1) if xs else None
    coins = {}
    for c in COINS:
        v = [x["score"] for x in last if c in x["coins"]]
        if v:
            coins[c] = {"v": avg(v), "n": len(v), "label": label(avg(v))}
    now24 = avg([x["score"] for x in last])
    return {"updated_at": now_iso(), "now": now24, "label": label(now24), "n24": len(last), "coins": coins,
            "history": hist[-120:],
            "items": sorted(last, key=lambda x: x["at"], reverse=True)[:30]}


# ================================================================== 2. prediction game
DAILY_PTS, WEEKLY_PTS = 3, 10
# The daily question used to live only inside the bot menu, so almost nobody saw it (0 votes most days, while the
# weekly one, posted in the channel, drew 3-8). It is now also posted in the discussion group, where it is one
# message a day and does not crowd the channel. Set by start(); None keeps the old behaviour.
GROUP = None


def btc_price():
    try:
        p = D.live_prices().get("BTC")
        if p:
            return p[0]
    except Exception:
        pass
    m = D.load("market") or {}
    return next((c["price"] for c in m.get("coins", []) if c.get("coin") == "BTC"), None)


def fmt(x):
    return f"{x:,.0f}"


def new_rounds(s, post_fn, channel):
    """daily round at 06:00 UTC; weekly round on Monday 06:00 UTC (closes Friday, settles Sunday 20:00 UTC)"""
    p = hub(s)["pred"]
    now = datetime.now(timezone.utc)
    if now.hour < 6:
        return False
    day = now.strftime("%Y-%m-%d")
    made = False
    price = None
    if not any(r["id"] == f"d{day}" for r in p["rounds"]):
        price = price or btc_price()
        if price:
            p["rounds"].append({
                "id": f"d{day}", "kind": "daily", "ref": price, "target": price,
                "q": f"بیت‌کوین فردا همین ساعت بالاتر از {fmt(price)} دلار است یا پایین‌تر؟",
                "opts": ["📈 بالاتر", "📉 پایین‌تر"], "close": (now + timedelta(hours=12)).isoformat(),
                "settle": (now + timedelta(hours=24)).isoformat(), "votes": {}, "result": None})
            if GROUP:
                r = p["rounds"][-1]
                res = post_fn(GROUP, round_text(r), kb=round_kb(r))
                if res.get("ok"):
                    r["msg"], r["chat"] = res["result"]["message_id"], GROUP
            made = True
    monday = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    if not any(r["id"] == f"w{monday}" for r in p["rounds"]):
        price = price or btc_price()
        if price:
            target = round(price / 1000) * 1000
            fri = (now - timedelta(days=now.weekday()) + timedelta(days=4)).replace(hour=20, minute=0, second=0, microsecond=0)
            sun = fri + timedelta(days=2)
            r = {"id": f"w{monday}", "kind": "weekly", "ref": price, "target": target,
                 "q": f"یکشنبه ساعت ۲۰ به وقت جهانی، بیت‌کوین بالای {fmt(target)} دلار است؟",
                 "opts": ["✅ بله، بالای آن", "❌ نه، زیر آن"], "close": fri.isoformat(), "settle": sun.isoformat(),
                 "votes": {}, "result": None}
            p["rounds"].append(r)
            res = post_fn(channel, round_text(r), kb=round_kb(r))
            if res.get("ok"):
                r["msg"] = res["result"]["message_id"]
            made = True
    del p["rounds"][:-40]
    return made


def round_text(r, settled_note=""):
    n = len(r["votes"])
    vals = list(r["votes"].values())
    tally = [sum(1 for v in vals if v == i) for i in range(len(r["opts"]))]
    pct = [round(100 * c / n) if n else 0 for c in tally]
    pts = WEEKLY_PTS if r["kind"] == "weekly" else DAILY_PTS
    head = "🎯 <b>پیش‌بینی هفتگی انتخاب</b>" if r["kind"] == "weekly" else "🎯 <b>پیش‌بینی روزانه انتخاب</b>"
    lines = [head, "", html.escape(r["q"]), "",
             f"قیمت هنگام طرح سؤال: {fmt(r['ref'])} دلار",
             f"پایان رأی‌گیری: {r['close'][:16].replace('T', ' ')} به وقت جهانی",
             f"پاسخ درست: {pts} امتیاز · جدول برترین‌ها در ربات و سایت", ""]
    lines += [f"{o}: {p}٪" for o, p in zip(r["opts"], pct)]
    lines.append(f"👥 {n} شرکت‌کننده")
    if r.get("result") is not None:
        lines += ["", f"🏁 نتیجه: {r['opts'][r['result']]} (قیمت نهایی {fmt(r['final'])} دلار)"]
    if settled_note:
        lines += ["", settled_note]
    return "\n".join(lines)


def round_kb(r):
    if r.get("result") is not None or datetime.now(timezone.utc).isoformat() > r["close"]:
        return None
    return {"inline_keyboard": [[{"text": o, "callback_data": f"pv:{r['id']}:{i}"} for i, o in enumerate(r["opts"])]]}


def vote(s, user, rid, opt):
    """-> message for the voter"""
    p = hub(s)["pred"]
    r = next((x for x in p["rounds"] if x["id"] == rid), None)
    if not r:
        return "این پیش‌بینی پیدا نشد"
    if r.get("result") is not None or datetime.now(timezone.utc).isoformat() > r["close"]:
        return "رأی‌گیری این پیش‌بینی بسته شده است"
    uid = str(user["id"])
    if uid in r["votes"]:
        return "رأی تو قبلاً ثبت شده است: " + r["opts"][r["votes"][uid]]
    r["votes"][uid] = int(opt)
    me = p["pts"].setdefault(uid, {"pts": 0, "ok": 0, "n": 0})
    me["name"] = (user.get("first_name") or user.get("username") or "کاربر")[:24]
    return "✅ ثبت شد: " + r["opts"][int(opt)]


def settle(s, edit_fn, channel):
    p = hub(s)["pred"]
    now = datetime.now(timezone.utc).isoformat()
    done = False
    for r in p["rounds"]:
        if r.get("result") is not None or now < r["settle"]:
            continue
        price = btc_price()
        if not price:
            continue
        r["final"] = price
        r["result"] = 0 if price > r["target"] else 1
        pts = WEEKLY_PTS if r["kind"] == "weekly" else DAILY_PTS
        for uid, v in list(r["votes"].items()):
            me = p["pts"].setdefault(uid, {"pts": 0, "ok": 0, "n": 0})
            me["n"] += 1
            if v == r["result"]:
                me["pts"] += pts
                me["ok"] += 1
        if r.get("msg"):
            edit_fn(r.get("chat") or channel, r["msg"], round_text(r), {"inline_keyboard": []})
        done = True
    return done


def round_by_id(s, rid):
    return next((x for x in hub(s)["pred"]["rounds"] if x["id"] == rid), None)


def leaderboard(s, n=10):
    pts = hub(s)["pred"]["pts"]
    rows = sorted(pts.items(), key=lambda kv: (-kv[1]["pts"], -kv[1]["ok"]))
    return [{"name": v.get("name", "کاربر"), "pts": v["pts"], "ok": v["ok"], "n": v["n"]} for _, v in rows if v["n"]][:n]


def section(s, uid):
    """bot menu: open rounds with buttons + top 10"""
    p = hub(s)["pred"]
    now = datetime.now(timezone.utc).isoformat()
    open_r = [r for r in p["rounds"] if r.get("result") is None and now <= r["close"]]
    out, rows = ["🎯 <b>بازی پیش‌بینی انتخاب</b>", ""], []
    for r in open_r[-2:]:
        mine = r["votes"].get(str(uid))
        out += [round_text(r).split("\n", 1)[1].strip(), ("رأی تو: " + r["opts"][mine]) if mine is not None else "", ""]
        if mine is None and round_kb(r):
            rows += round_kb(r)["inline_keyboard"]
    if not open_r:
        out += ["الان سؤال بازی ندارد؛ سؤال روزانه هر روز ساعت ۹:۳۰ به وقت ایران می‌آید", ""]
    me = p["pts"].get(str(uid))
    if me:
        out.append(f"⭐️ امتیاز تو: {me['pts']} · درست {me['ok']} از {me['n']}")
    lb = leaderboard(s)
    if lb:
        out += ["", "🏆 <b>برترین‌ها</b>"] + [f"{i}. {html.escape(x['name'])} — {x['pts']} امتیاز" for i, x in enumerate(lb, 1)]
    return "\n".join(x for x in out if x is not None), rows


def predict_data(s):
    p = hub(s)["pred"]
    pub = lambda r: {k: r.get(k) for k in ("id", "kind", "q", "ref", "target", "opts", "close", "settle", "result", "final")} | {
        "n": len(r["votes"]), "tally": [list(r["votes"].values()).count(i) for i in range(len(r["opts"]))]}
    return {"updated_at": now_iso(), "rounds": [pub(r) for r in reversed(p["rounds"][-20:])], "top": leaderboard(s, 20)}


# ================================================================== 3. whale radar
BTC_MIN, ETH_MIN, STABLE_MIN = 500, 1000, 10_000_000
ETH_RPC = ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://cloudflare-eth.com"]
STABLES = {"0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC"}
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def rpc(method, params):
    for u in ETH_RPC:
        try:
            r = requests.post(u, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=25)
            j = r.json()
            if "result" in j:
                return j["result"]
        except Exception:
            continue
    return None


def add_event(w, ev):
    if any(e["tx"] == ev["tx"] and e["asset"] == ev["asset"] for e in w["events"][:300]):
        return
    w["events"].insert(0, ev)
    del w["events"][400:]


def scan_btc(w, usd):
    try:
        lb = requests.get("https://blockchain.info/latestblock", headers=UA, timeout=20).json()
        if lb["hash"] == w["btc_hash"]:
            return False
        blk = requests.get(f"https://blockchain.info/rawblock/{lb['hash']}", headers=UA, timeout=60).json()
    except Exception as ex:
        log.info("btc scan: %s", ex)
        return False
    w["btc_hash"] = lb["hash"]
    for tx in blk.get("tx", [])[1:]:                       # skip coinbase
        val = sum(o.get("value", 0) for o in tx.get("out", [])) / 1e8
        if val >= BTC_MIN:
            outs = sorted(tx.get("out", []), key=lambda o: -o.get("value", 0))
            add_event(w, {"asset": "BTC", "amount": round(val, 2), "usd": round(val * usd.get("BTC", 0)),
                          "tx": tx["hash"], "to": (outs[0].get("addr") or "")[:64],
                          "from": ((tx.get("inputs") or [{}])[0].get("prev_out") or {}).get("addr", "")[:64],
                          "at": datetime.fromtimestamp(blk.get("time", time.time()), timezone.utc).isoformat()})
    return True


def scan_eth(w, usd):
    head = rpc("eth_blockNumber", [])
    if not head:
        return False
    head = int(head, 16)
    start = max(w["eth_block"] + 1, head - 25)
    if start > head:
        return False
    for n in range(start, head + 1):
        b = rpc("eth_getBlockByNumber", [hex(n), True])
        if not b:
            break
        ts = datetime.fromtimestamp(int(b["timestamp"], 16), timezone.utc).isoformat()
        for tx in b.get("transactions", []):
            v = int(tx.get("value", "0x0"), 16) / 1e18
            if v >= ETH_MIN:
                add_event(w, {"asset": "ETH", "amount": round(v, 2), "usd": round(v * usd.get("ETH", 0)),
                              "tx": tx["hash"], "from": tx.get("from", ""), "to": tx.get("to") or "", "at": ts})
        w["eth_block"] = n
    logs = rpc("eth_getLogs", [{"fromBlock": hex(start), "toBlock": hex(w["eth_block"] or head),
                                "address": list(STABLES), "topics": [TRANSFER]}]) or []
    for lg in logs:
        try:
            amt = int(lg["data"], 16) / 1e6
        except Exception:
            continue
        if amt >= STABLE_MIN:
            add_event(w, {"asset": STABLES[lg["address"].lower()], "amount": round(amt), "usd": round(amt),
                          "tx": lg["transactionHash"], "from": "0x" + lg["topics"][1][-40:],
                          "to": "0x" + lg["topics"][2][-40:], "at": now_iso()})
    return True


def whales_data(s):
    w = hub(s)["whales"]
    cut = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    last = [e for e in w["events"] if e["at"] >= cut]
    tot = {}
    for e in last:
        t = tot.setdefault(e["asset"], {"n": 0, "amount": 0, "usd": 0})
        t["n"] += 1
        t["amount"] += e["amount"]
        t["usd"] += e["usd"]
    hours = {}
    for e in last:
        hours[e["at"][:13]] = hours.get(e["at"][:13], 0) + e["usd"]
    return {"updated_at": now_iso(), "min": {"BTC": BTC_MIN, "ETH": ETH_MIN, "stable": STABLE_MIN},
            "totals24": tot, "hourly": [{"h": k, "usd": v} for k, v in sorted(hours.items())],
            "events": w["events"][:80]}


# ================================================================== export + worker
_last = {"score": 0, "export": 0, "pred": 0, "whale": 0}


def export(s, worktree, push):
    files = {"data/sentiment.json": sentiment_data(s), "data/predict.json": predict_data(s), "data/whales.json": whales_data(s)}
    ok = push(worktree, {k: json.dumps(v, ensure_ascii=False, indent=1) for k, v in files.items()},
              "chore: sentiment, predictions, whale radar")
    if ok:
        F.rebuild_site()
    return ok


def tick(s, send_fn, edit_fn, channel, worktree, push):
    changed = False
    t = time.time()
    if t - _last["whale"] > 90:
        _last["whale"] = t
        usd = {k: v[0] for k, v in (D.live_prices() or {}).items() if k in ("BTC", "ETH")}
        changed |= scan_btc(hub(s)["whales"], usd)
        changed |= scan_eth(hub(s)["whales"], usd)
    if t - _last["pred"] > 60:
        _last["pred"] = t
        changed |= new_rounds(s, send_fn, channel)
        changed |= settle(s, edit_fn, channel)
    if t - _last["score"] > 1200:
        _last["score"] = t
        changed |= score_new(s)
    if t - _last["export"] > 900 and worktree:
        _last["export"] = t
        export(s, worktree, push)
    return changed


def start(s, send_fn, edit_fn, channel, worktree, push, group=None):
    global GROUP
    GROUP = group or None
    hub(s)

    def loop():
        time.sleep(45)
        while True:
            try:
                if tick(s, send_fn, edit_fn, channel, worktree, push):
                    F.DIRTY.set()
            except Exception:
                log.exception("hub error")
            time.sleep(20)

    th = threading.Thread(target=loop, name="hub", daemon=True)
    th.start()
    return th
