#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Entekhab Market Brain — مغز بازار

۱) بخش عددی (بدون AI، هر اجرا):
   - رژیم بازار: Bull / Bear / Sideways / High Volatility  (از روند و نوسان BTC + پهنای بازار)
   - پهنای بازار (Breadth): درصد کوین‌های اسکن‌شده در روند صعودی / نزولی، میانگین تغییر ۲۴h
   - بیشترین رشد و افت در ۱۵۰ کوین
   - «چرا حرکت کرد؟» برای بزرگ‌ترین حرکت‌ها: هم‌زمانی با BTC، جهش حجم، خبرهای هم‌زمان (هم‌زمانی ≠ علیت)

۲) گزارش هوشمند (Gemini، حداکثر هر ۶ ساعت یک بار؛ سه زبان):
   فقط بر اساس داده‌های بالا نوشته می‌شود؛ مدل اجازهٔ ساختن عدد یا خبر ندارد و
   خروجی‌ای که عدد خارج از داده داشته باشد رد می‌شود.

خروجی: data/brain.json  (+ تاریخچهٔ گزارش‌ها در data/brain_log.json)
"""
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
REPORT_EVERY_H = float(os.environ.get("BRAIN_EVERY_H", "6"))


def load(n, d):
    try:
        return json.load(open(os.path.join(D, n), encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return d


def stdev(xs):
    if len(xs) < 2:
        return 0
    m = sum(xs) / len(xs)
    return (sum((x - m) ** 2 for x in xs) / (len(xs) - 1)) ** 0.5


def regime(m):
    coins = m.get("coins", [])
    btc = next((c for c in coins if c["coin"] == "BTC"), None)
    if not btc:
        return None
    sp = btc.get("spark", [])
    rets = [(sp[i] / sp[i - 1] - 1) * 100 for i in range(1, len(sp))]
    vol_now = stdev(rets[-12:]) if len(rets) >= 12 else 0
    vol_base = stdev(rets) or 1e-9
    valid = [c for c in coins if c.get("chg24") is not None]
    up = sum(1 for c in valid if c["trend"] == "up")
    down = sum(1 for c in valid if c["trend"] == "down")
    n = len(valid) or 1
    breadth = {"up_pct": round(up * 100 / n), "down_pct": round(down * 100 / n), "range_pct": round((n - up - down) * 100 / n),
               "avg_chg24": round(sum(c["chg24"] for c in valid) / n, 2), "n": len(valid),
               "rsi_gt70": sum(1 for c in valid if (c.get("rsi") or 0) >= 70), "rsi_lt30": sum(1 for c in valid if (c.get("rsi") or 100) <= 30)}
    ratio = vol_now / vol_base
    if ratio > 1.8:
        reg = "high_volatility"
    elif btc["trend"] == "up" and breadth["up_pct"] >= 45:
        reg = "bull"
    elif btc["trend"] == "down" and breadth["down_pct"] >= 45:
        reg = "bear"
    else:
        reg = "sideways"
    return {"regime": reg, "btc_trend": btc["trend"], "btc_chg24": btc.get("chg24"), "btc_rsi": btc.get("rsi"),
            "vol_ratio": round(ratio, 2), "breadth": breadth}


def why_moved(c, btc, news_items):
    """دلایل «هم‌زمان» یک حرکت — بدون ادعای علیت"""
    out = []
    ch, bch = c.get("chg24") or 0, (btc or {}).get("chg24") or 0
    if btc and c["coin"] != "BTC":
        if abs(bch) >= 1 and (ch > 0) == (bch > 0) and abs(ch) <= abs(bch) * 2.5:
            out.append({"k": "with_btc", "v": bch})
        elif abs(ch - bch) >= 5:
            out.append({"k": "idiosyncratic", "v": round(ch - bch, 2)})
    sp = c.get("spark", [])
    if len(sp) >= 25:
        out.append({"k": "range48", "v": round((c["price"] - c["lo48"]) / ((c["hi48"] - c["lo48"]) or 1) * 100)})
    cut = datetime.now(timezone.utc) - timedelta(hours=30)
    nn = [n for n in news_items if c["coin"] in n.get("coins", []) and datetime.fromisoformat(n["date"]) >= cut]
    if nn:
        out.append({"k": "news", "v": len(nn), "items": [{"title": n["title"], "url": n["url"], "source": n["source"]} for n in nn[:3]]})
    else:
        out.append({"k": "no_news", "v": 0})
    return out


def build_facts(m, reg, news, score, posts):
    coins = [c for c in m.get("coins", []) if c.get("chg24") is not None]
    btc = next((c for c in coins if c["coin"] == "BTC"), None)
    eth = next((c for c in coins if c["coin"] == "ETH"), None)
    liquid = [c for c in coins if (c.get("qvol") or 0) >= 5e6] or coins
    gain = sorted(liquid, key=lambda c: -c["chg24"])[:6]
    lose = sorted(liquid, key=lambda c: c["chg24"])[:6]
    movers = []
    for c in gain[:4] + lose[:4]:
        movers.append({"coin": c["coin"], "chg24": c["chg24"], "rsi": c.get("rsi"), "why": why_moved(c, btc, news.get("items", []))})
    opps = [{"coin": o["coin"], "type": o["type"], "confidence": o["confidence"]} for o in m.get("opportunities", [])
            if o.get("confidence") == "high"][:8]
    heads = [{"title": n["title"], "source": n["source"], "coins": n.get("coins", [])} for n in news.get("items", [])[:12]]
    sc = score.get("coins", {})
    return {
        "time_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "regime": reg, "fng": m.get("fng", {}).get("value"), "fng_class": m.get("fng", {}).get("class"),
        "global": m.get("global"),
        "global_fmt": {"mcap_trillion_usd": round((m.get("global") or {}).get("mcap", 0) / 1e12, 2), "vol_billion_usd": round((m.get("global") or {}).get("vol", 0) / 1e9, 1)},
        "btc": btc and {k: btc[k] for k in ("price", "chg24", "rsi", "trend")},
        "eth": eth and {k: eth[k] for k in ("price", "chg24", "rsi", "trend")},
        "top_gainers": [{"coin": c["coin"], "chg24": c["chg24"]} for c in gain],
        "top_losers": [{"coin": c["coin"], "chg24": c["chg24"]} for c in lose],
        "movers_context": movers, "high_conf_scanner": opps, "headlines": heads,
        "entekhab_score": {k: sc[k]["score"] for k in ("BTC", "ETH", "SOL", "BNB", "XRP") if k in sc},
        "latest_channel_posts": [p["title"] for p in posts[:5]],
    }


PROMPT = """You are Entekhab Market Brain, a careful crypto market analyst.
Write a concise market briefing using ONLY the JSON facts below. Hard rules:
- Never invent numbers, prices, events, news or causes. Every number you write must appear in the facts.
- Simultaneity is not causation: say "coincided with" rather than "caused by" unless a fact states the cause.
- No buy/sell advice, no price predictions. Describe conditions, risks, and what would change the picture.
- Structure: 1) one-line headline; 2) market state (regime, BTC/ETH, breadth, sentiment); 3) notable movers and the context given;
  4) key headlines; 5) risks / what to watch (only things derivable from the facts).
Produce three versions with the same content: Persian (fa), Central Kurdish Sorani in Arabic script (ckb), English (en).
Return JSON: {"fa":{"headline":"","body":""},"ckb":{"headline":"","body":""},"en":{"headline":"","body":""}}
Use "• " bullets inside body; no markdown headings. Keep it short and readable: headline ≤ 14 words; body = at most 5 bullets,
each at most 2 short sentences. Never write a number with more than 6 digits: for market cap and volume use global_fmt
(e.g. "$2.63 trillion", "$114.6 billion"); round prices to whole dollars when above 100.

FACTS:
"""


def numbers_ok(report, facts):
    """هر عدد (غیر از اعداد کوچک صحیح) در متن انگلیسی باید با گرد کردن در داده‌ها وجود داشته باشد"""
    allowed = [abs(float(x)) for x in re.findall(r"-?\d+(?:\.\d+)?", json.dumps(facts))]
    text = (report["en"]["headline"] + " " + report["en"]["body"]).replace(",", "")
    bad = []
    for n in re.findall(r"\d+(?:\.\d+)?", text):
        v = float(n)
        if "." not in n and v <= 100:
            continue  # اعداد صحیح کوچک: ۲۴ ساعت، درصدها و شماره‌ها
        if not any(abs(a - v) <= max(0.051, a * 0.005) for a in allowed):
            bad.append(n)
    return bad


def main():
    m = load("market.json", {})
    if not m.get("coins"):
        print("no market data")
        return
    news, score, posts = load("news.json", {}), load("score.json", {}), load("posts.json", [])
    prev = load("brain.json", {})
    reg = regime(m)
    facts = build_facts(m, reg, news, score, posts)
    out = {"updated_at": datetime.now(timezone.utc).isoformat(), "regime": reg, "movers": facts["movers_context"],
           "gainers": facts["top_gainers"], "losers": facts["top_losers"],
           "report": prev.get("report"), "report_at": prev.get("report_at"), "report_engine": prev.get("report_engine"),
           "report_facts": prev.get("report_facts")}
    # the daily BTC regime radar (regime.py): explainable rules with 5-day confirmation, and the probabilistic model
    rg = load("regime.json", {})
    rr = ((rg.get("rule") or {}).get("now")) or {}
    if rr.get("label"):
        out["radar"] = {"rule": rr["label"], "score": rr.get("score"), "pending": (rr.get("pending") or {}).get("to"),
                        "hmm": (rg.get("now") or {}).get("top"), "date": rr.get("date")}
    stamps = [prev.get("report_at")] + [x.get("at") for x in load("brain_log.json", [])[-3:]]
    stamps = [datetime.fromisoformat(t) for t in stamps if t]
    last = max(stamps) if stamps else None
    print("last report:", last, "prev keys:", sorted(prev)[:8])
    due = last is None or datetime.now(timezone.utc) - last >= timedelta(hours=REPORT_EVERY_H)
    if os.environ.get("BRAIN_FORCE") == "1":
        due = True
    if ai.available() and due:
        try:
            rep = ai.generate(PROMPT + json.dumps(facts, ensure_ascii=False), as_json=True, temperature=0.3, max_tokens=8192)
            assert all((rep.get(k) or {}).get("body") for k in ("fa", "ckb", "en")), "incomplete report"
            bad = numbers_ok(rep, facts)
            if bad:
                raise RuntimeError(f"report contains numbers not in data: {bad[:6]}")
            out.update({"report": rep, "report_at": out["updated_at"], "report_engine": "gemini:" + ai.model(),
                        "report_flags": bad,
                        # the numbers the report was written from (shown next to today's numbers on the site)
                        "report_facts": {"fng": facts.get("fng"), "fng_class": facts.get("fng_class"), "regime": reg.get("regime"),
                                         "btc": (facts.get("btc") or {}).get("price"), "btc_chg24": (facts.get("btc") or {}).get("chg24"),
                                         "eth": (facts.get("eth") or {}).get("price"), "up_pct": reg["breadth"]["up_pct"], "down_pct": reg["breadth"]["down_pct"],
                                         "mcap_t": facts["global_fmt"]["mcap_trillion_usd"]}})
            log = load("brain_log.json", [])
            log.append({"at": out["updated_at"], "regime": reg["regime"], "report": rep, "facts": facts})
            json.dump(log[-60:], open(os.path.join(D, "brain_log.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
            print("report generated", "flags:", bad)
        except Exception as e:  # noqa: BLE001
            print(f"report skipped: {e}")
            out["report_error"] = str(e)[:200]
    else:
        print("report not due" if ai.available() else "no AI key")
    json.dump(out, open(os.path.join(D, "brain.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("regime:", reg["regime"], reg["breadth"])


if __name__ == "__main__":
    main()
