#!/usr/bin/env python3
"""scripts/pro_l10n.py without the network: a fake Gemini that answers in the real format (one JSON object per request,
the keys it was given), some answers good, some broken on purpose. Checks:
  * the checks themselves: placeholders, HTML tags, protected names, the language's script, Arabic letters where they do
    not belong, English handed back, absurd length;
  * the cache keeps only what passed; a string that keeps failing is given up on after FAIL_MAX tries (no endless
    spending of the free quota); a changed English string is translated again; the budget of requests is kept;
  * page text goes first, so a language's page can be indexed as early as possible.
Run: python3 tests/test_pro_l10n.py"""
import json
import os
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import pro_l10n as L  # noqa: E402
import pro_langs  # noqa: E402

FAILS = []


def ok(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {extra}" if extra and not cond else ""))
    if not cond:
        FAILS.append(name)


def main():
    c = L.check
    ok("a good translation passes", c("de", "Every Binance coin", "Jede Binance-Münze") is None)
    ok("a placeholder lost or renamed fails", c("de", "Up to {n} charts", "Bis zu Charts") == "placeholders" and c("de", "Up to {n} charts", "Bis zu {m} Charts") == "placeholders")
    ok("an HTML tag changed fails", c("fr", "<b>Bar replay:</b> pick a bar", "<strong>Relecture :</strong> choisir") == "tags")
    ok("an attribute of a link must stay", c("fr", '<a href="https://www.tradingview.com/" rel="noopener" target="_blank">TradingView Lightweight Charts™</a>', '<a href="https://example.com/">TradingView Lightweight Charts™</a>') == "tags")
    ok("a protected name must stay as written", c("ru", "Every Binance coin", "Каждая монета Бинанс") == "lost Binance")
    ok("the language's script is required where there are words to translate", c("ru", "Every coin", "Every coin") == "wrong script" and c("hi", "Search a coin", "Search a coin") == "wrong script")
    ok("…but a label with nothing to translate may stay as it is", c("jp", "OK", "OK") is None and c("jp", "RSI", "RSI") is None and c("th", "{n} h", "{n} ชม.") is None)
    ok("Arabic letters in a language that does not use them fail", c("de", "Close", "إغلاق") == "arabic letters" and c("ur", "Close", "بند کریں") is None)
    ok("English handed back fails for a longer string", c("de", "Every price and candle is worked out with your rate", "Every price and candle is worked out with your rate") == "untranslated")
    ok("an empty or absurdly long answer fails", c("de", "Close", "") == "empty" and c("de", "Close", "x" * 100) == "too long")
    ok("Hebrew passes in Hebrew letters", c("iw", "Indicators", "אינדיקטורים") is None)

    tmp = tempfile.mkdtemp()
    old_cache = L.CACHE
    L.CACHE = tmp
    try:
        src = {"seo.title": "Live market: multi-chart, replay and price alerts", "seo.h1": "Live market",
               "about.x1": "<b>Multi-chart:</b> 1 to 16 charts on one screen.", "loading": "Loading…",
               "noData": "No data for {s} right now", "maxInds": "Up to 12 indicators per chart.", "toman": "IRT",
               "badOne": "Every Binance coin"}
        calls = []

        def fake(prompt):
            calls.append(prompt)
            payload = json.loads(prompt[prompt.index("Input:") + 6:].strip())
            out = {}
            for k, v in payload.items():
                if k == "badOne":
                    out[k] = "Jede Münze"                       # drops "Binance": must fail every time
                elif k == "noData":
                    out[k] = "Keine Daten für {s} gerade"
                else:
                    out[k] = v.replace("Live market", "Live-Markt").replace("Loading…", "Wird geladen…").replace("charts", "Charts").replace("on one screen", "auf einem Bildschirm").replace("Up to", "Bis zu").replace("indicators per chart", "Indikatoren pro Chart").replace("multi-chart, replay and price alerts", "Multi-Chart, Replay und Preisalarme")
            return out

        st = L.run(["de"], 5, 60, 3, fake, src, log=lambda *a: None)
        cache = json.load(open(os.path.join(tmp, "de.json"), encoding="utf-8"))
        kept = cache["s"]
        ok("good strings are kept with the hash of their English", kept["noData"] == [L.h(src["noData"]), "Keine Daten für {s} gerade"] and kept["seo.h1"][1] == "Live-Markt")
        ok("a failing string is not kept, and its failure is counted", "badOne" not in kept and cache["f"]["badOne"][1] == 1)
        ok("page text was asked first", '"seo.' in calls[0] or '"about.' in calls[0], calls[0][-200:])
        # 8 strings, 3 a request, the long page block on its own: [about] [seo.h1 seo.title badOne] [loading maxInds noData] [toman]
        ok("batches: 3 strings a request at most, a page block on its own, within the budget of 5", len(calls) == 4 and all(len(json.loads(p[p.index("Input:") + 6:])) <= 3 for p in calls), len(calls))
        # run again: only the failed one is asked, up to FAIL_MAX times in total, then never again
        for _ in range(5):
            L.run(["de"], 5, 60, 3, fake, src, log=lambda *a: None)
        cache = json.load(open(os.path.join(tmp, "de.json"), encoding="utf-8"))
        asked = sum(1 for p in calls if '"badOne"' in p)
        ok(f"a string that keeps failing is asked {L.FAIL_MAX} times, then left in English", asked == L.FAIL_MAX and cache["f"]["badOne"][1] == L.FAIL_MAX, (asked, cache["f"]))
        # the English changes: that key is translated again; the others are not asked
        calls.clear()
        src2 = dict(src)
        src2["loading"] = "Loading data…"
        L.run(["de"], 5, 60, 3, fake, src2, log=lambda *a: None)
        ok("a changed English string is translated again, and only it", len(calls) == 1 and '"loading"' in calls[0] and '"noData"' not in calls[0], [p[-120:] for p in calls])
        cur = L.current(src2, L.load("de"))
        ok("current() hands a page only translations of the English as it is now", cur["loading"] == "Loading data…".replace("Loading…", "Wird geladen…") and "badOne" not in cur)
        s = L.status(src2)
        ok("status: done counts and 'page text ready' for de", s["de"]["done"] == len(src2) - 1 and s["de"]["seo"] is True and s["tr"]["seo"] is False, s["de"])
        # a request that fails (quota) stops the run without losing what is cached
        calls.clear()

        class QuotaError(Exception):
            pass

        def broke(prompt):
            calls.append(prompt)
            raise QuotaError("daily quota exhausted")
        L.run(["tr", "ru"], 10, 60, 3, broke, src2, log=lambda *a: None)
        ok("an exhausted quota stops the run at once", len(calls) == 1)
        ok("the real source strings: every UI key of i18n.js plus the page text", len(L.sources()) > 850 and all(k in L.sources() for k in ("seo.title", "seo.h1", "seo.sub", "langTitle")))
        ok("PRIORITY lists each of the 43 new languages once", sorted(L.PRIORITY) == sorted(pro_langs.NEW) and len(L.PRIORITY) == 43)
        p = L.prompt_for("tw", {"k": "Close"})
        ok("the prompt names the language and its variant, and asks for JSON with the same keys", "Chinese (Traditional)" in p and "Traditional Chinese characters" in p and "same keys" in p)
    finally:
        L.CACHE = old_cache
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
