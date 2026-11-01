#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Agent Council — میزگرد هوش مصنوعی (روزی یک بار، یک فراخوان Gemini برای صرفه‌جویی در سهمیه)
۵ تحلیلگر با دیدگاه متفاوت (تکنیکال، مشتقه/آپشن، احساسات و خبر، کلان، تاریخ/آمار) فقط بر اساس داده‌های واقعی
نظر، شواهد و اختلاف‌ها را می‌نویسند. هر عدد خارج از داده باعث رد خروجی می‌شود. خروجی: data/council.json
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai  # noqa: E402
from brain import numbers_ok, load  # noqa: E402

D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
PROMPT = """You are moderating the Entekhab AI Council about BTC for the next days. Five analysts, each using ONLY their slice of the JSON facts:
technical (price, RSI, trend, volatility), derivatives (options put/call, IV, DVOL, max pain), sentiment (fear&greed, news headlines, narratives),
macro (correlation with gold and EUR/USD, economic calendar), history (market-memory analogs and Monte-Carlo cone).
Rules: never invent numbers or facts; every number must appear in the facts; no buy/sell advice; say "insufficient data" if a slice is empty.
Each analyst: stance (bullish|bearish|neutral), confidence 1-5, 2-3 evidence bullets citing facts. Then list real disagreements and a balanced summary.
Return JSON: {"agents":[{"id":"technical","stance":"","confidence":3,"fa":{"evidence":[]},"ckb":{"evidence":[]},"en":{"evidence":[]}}...],
"fa":{"disagreements":[],"summary":""},"ckb":{"disagreements":[],"summary":""},"en":{"disagreements":[],"summary":""}}
fa = Persian, ckb = Central Kurdish Sorani (Arabic script), en = English. Keep it short.
FACTS:
"""


def main():
    prev = load("council.json", {})
    if prev.get("at") and datetime.now(timezone.utc) - datetime.fromisoformat(prev["at"]) < timedelta(hours=20) and os.environ.get("COUNCIL_FORCE") != "1":
        print("council not due; last:", prev["at"])
        return
    if not ai.available():
        print("no AI key")
        return
    m, lab, b, ev, nr = load("market.json", {}), load("lab.json", {}), load("brain.json", {}), load("events.json", {}), load("narratives.json", {})
    btc = next((c for c in m.get("coins", []) if c["coin"] == "BTC"), {})
    facts = {
        "technical": {k: btc.get(k) for k in ("price", "chg24", "rsi", "trend")} | {"regime": (b.get("regime") or {}).get("regime"), "vol": (lab.get("vol") or {}).get("BTC")},
        "derivatives": (lab.get("options") or {}).get("BTC"),
        "sentiment": {"fng": (m.get("fng") or {}).get("value"), "narratives": [{"name": x["name"]["en"], "mentions_24h": x["mentions_24h"], "perf_24h": x["perf_24h"]} for x in nr.get("narratives", [])[:5]],
                      "headlines": [h["title"] for h in (load("news.json", {}).get("items") or [])[:8]]},
        "macro": {"corr": lab.get("macro"), "upcoming": [{"title": e.get("title"), "date": e.get("date")} for e in [x for x in ev.get("events", []) if x.get("date", "") >= datetime.now(timezone.utc).isoformat()[:16]][:5]]},
        "history": {"memory": (lab.get("memory") or {}).get("stats"), "today": (lab.get("memory") or {}).get("today"),
                    "montecarlo": {k: (lab.get("futures") or {}).get(k) for k in ("p_up", "p_up10", "p_dn10", "days")}},
    }
    if facts["macro"]["corr"]:
        facts["macro"]["corr"] = {k: ({kk: vv for kk, vv in v.items() if kk != "roll"} if isinstance(v, dict) else v) for k, v in facts["macro"]["corr"].items()}
    try:
        rep = ai.generate(PROMPT + json.dumps(facts, ensure_ascii=False), as_json=True, temperature=0.3, max_tokens=8192)
        assert len(rep.get("agents", [])) >= 4 and rep.get("en", {}).get("summary"), "incomplete"
        en_text = " ".join(" ".join(a.get("en", {}).get("evidence", [])) for a in rep["agents"]) + " " + rep["en"]["summary"] + " " + " ".join(rep["en"].get("disagreements", []))
        bad = numbers_ok({"en": {"headline": "", "body": en_text}}, facts)
        if bad:
            raise RuntimeError(f"numbers not in data: {bad[:6]}")
        out = {"at": datetime.now(timezone.utc).isoformat(), "engine": "gemini:" + ai.model(), "council": rep, "facts": facts}
        json.dump(out, open(os.path.join(D, "council.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print("council ok:", [(a["id"], a["stance"], a.get("confidence")) for a in rep["agents"]])
    except Exception as e:  # noqa: BLE001
        print("council skipped:", e)


if __name__ == "__main__":
    main()
