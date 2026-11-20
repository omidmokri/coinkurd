#!/usr/bin/env python3
"""scripts/pro_l10n.py without the network: a fake Gemini that answers in the real format (one JSON object per request,
the keys it was given), some answers good, some broken on purpose. Checks:
  * the checks themselves: placeholders, HTML tags, protected names, the language's script, Arabic letters where they do
    not belong, English handed back, absurd length;
  * the cache keeps only what passed; a string that keeps failing is given up on after FAIL_MAX tries (no endless
    spending of the free quota); a changed English string is translated again; the budget of requests is kept;
  * page text goes first, so a language's page can be indexed as early as possible;
  * the shared free quota: one model only (ai.py's fallback models are left to the site's own steps; a key whose
    quota runs out hands over to the next key instead), the calls of a run are counted, and a quota day (Pacific
    time) has a ceiling a key;
  * run_parallel: the owner's keys working at once give the same cache as one key working through the batches,
    the request cap holds, and a key that runs out of quota hands its batch to another key.
Run: python3 tests/test_pro_l10n.py"""
import json
import os
import shutil
import sys
import tempfile
import time

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
        ok("PRIORITY lists each of the 47 new languages once", sorted(L.PRIORITY) == sorted(pro_langs.NEW) and len(L.PRIORITY) == 47)
        p = L.prompt_for("tw", {"k": "Close"})
        ok("the prompt names the language and its variant, and asks for JSON with the same keys", "Chinese (Traditional)" in p and "Traditional Chinese characters" in p and "same keys" in p)

        # ---- several keys at once (run_parallel): the same work, spread over the owner's keys
        os.environ["GEMINI_MODEL"] = "model-under-test"
        os.environ.setdefault("GEMINI_API_KEY", "test-key")
        import ai  # noqa: E402
        real_with = ai.generate_with
        for code in ("vi", "it"):
            try:
                os.remove(os.path.join(tmp, code + ".json"))
            except OSError:
                pass
        used_by = []

        def by_key(api_key, prompt, *a, **k):
            used_by.append(api_key)
            time.sleep(0.05)          # a real request takes tens of seconds: the workers must overlap
            return fake(prompt)
        ai.generate_with = by_key
        try:
            c2 = {}
            st2 = L.run_parallel(["vi", "it"], 20, 60, 3, src2, ["k1", "k2", "k3"], log=lambda *a: None, counter=c2)
            seq = L.current(src2, L.load("de"))
            vi = L.current(src2, L.load("vi"))
            ok("several keys at once translate the same strings one key would", vi == seq and st2["vi"]["done"] == len(seq), (len(vi), len(seq)))
            ok("the work was shared between the keys", len(set(used_by)) > 1 and len(used_by) == c2["used"], (set(used_by), c2))
            ok("both languages were filled, and the page text of each went out first", st2["vi"]["seo"] and st2["it"]["seo"])

            # the cap on requests holds
            for code in ("vi", "it"):
                os.remove(os.path.join(tmp, code + ".json"))
            used_by.clear()
            c3 = {}
            L.run_parallel(["vi", "it"], 3, 60, 3, src2, ["k1", "k2", "k3"], log=lambda *a: None, counter=c3)
            ok("run_parallel makes no more requests than it was given", c3["used"] == 3 == len(used_by), (c3, len(used_by)))

            # a key whose quota runs out hands its batch to another key, and nothing is lost
            for code in ("vi",):
                os.remove(os.path.join(tmp, code + ".json"))
            dead = {"k1"}

            def one_dead(api_key, prompt, *a, **k):
                if api_key in dead:
                    raise ai.QuotaError("daily quota exhausted")
                return fake(prompt)
            ai.generate_with = one_dead
            L.run_parallel(["vi"], 20, 60, 3, src2, ["k1", "k2"], log=lambda *a: None, counter={})
            ok("a key that runs out of quota hands its batch to another key", L.current(src2, L.load("vi")) == seq, len(L.current(src2, L.load("vi"))))
        finally:
            ai.generate_with = real_with
            os.environ.pop("GEMINI_MODEL", None)

        # ---- the shared free quota
        c = {}
        calls.clear()
        L.run(["fr"], 2, 60, 3, fake, src2, log=lambda *a: None, counter=c)
        ok("a run counts its calls (and keeps to its own ceiling)", c.get("used") == 2 == len(calls), (c, len(calls)))
        # 2026-11-15 08:01 UTC is just past midnight in California (PST); 07:59 UTC is still the 14th there
        ok("the quota day is Google's (midnight Pacific time)", L.quota_day(1794729660) == "2026-11-15" and L.quota_day(1794729540) == "2026-11-14",
           (L.quota_day(1794729660), L.quota_day(1794729540)))
        ok("nothing used yet on a new day", L.quota_used("2026-11-15") == 0)
        L.quota_add(3, "2026-11-15")
        L.quota_add(4, "2026-11-15")
        L.quota_add(0, "2026-11-15")
        ok("the day's calls add up, and are kept in data/pro_l10n/_quota.json", L.quota_used("2026-11-15") == 7 and json.load(open(os.path.join(tmp, "_quota.json"))) == {"day": "2026-11-15", "n": 7})
        ok("a new quota day starts from zero", L.quota_used("2026-11-16") == 0)
        ok("the default ceilings are modest (the site's own Gemini steps come first)", 0 < L.DAILY <= 100)

        # one model only: ai.generate would walk the fallback models; the translator must stop instead
        os.environ.setdefault("GEMINI_API_KEY", "test-key")
        os.environ["GEMINI_MODEL"] = "model-under-test"
        ai.reset()
        seen = []

        def fake_generate(*a, **k):
            seen.append(ai.model())
            raise ai.QuotaError("daily quota exhausted")
        real = ai._generate
        ai._generate = fake_generate
        try:
            gen = L.gemini()
            e1 = e2 = None
            try:
                gen("prompt")
            except Exception as e:  # noqa: BLE001
                e1 = type(e).__name__
            try:
                gen("prompt")
            except Exception as e:  # noqa: BLE001
                e2 = type(e).__name__
            ok("an exhausted quota (every key spent) stops the translator on its own model, no walk through ai.py's fallbacks",
               e1 == "QuotaError" and e2 == "QuotaError" and seen == ["model-under-test"] and ai._model == "model-under-test", (e1, e2, seen, ai._model))
        finally:
            ai._generate = real
            ai.reset()
            os.environ.pop("GEMINI_MODEL", None)
    finally:
        L.CACHE = old_cache
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
