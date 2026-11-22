#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/i18n_site.py without the network: a fake Gemini answering in the real format (a JSON array the length of
the batch), some answers good and some broken on purpose. Checks:
  * the checks themselves: placeholders, protected names, the language's own script, Arabic or Persian letters where
    they do not belong, English handed back, empty and absurdly long answers;
  * the cache keeps only what passed, and a string already translated is never asked again;
  * batches stay within their size, and the owner's keys share the work;
  * a key that runs out of quota hands its batch to another key;
  * the dictionaries come out in the same shape as i18n/ar/ (common.json, page/, js/, status.json) and hold only
    translated strings;
  * the encyclopedia stays out, and so does a page already in a language of its own;
  * the real corpus of the site is read, and the 47 languages are the ones /market/ uses.
Run: python3 tests/test_i18n_site.py"""
import json
import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import i18n_site as S  # noqa: E402
import pro_langs  # noqa: E402

FAILS = []


def ok(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {extra}" if extra and not cond else ""))
    if not cond:
        FAILS.append(name)


def main():
    c = S.check
    ok("a good translation passes", c("de", "Every Binance coin", "Jede Binance-Münze") is None)
    ok("a lost or renamed placeholder fails",
       c("de", "about {1} min", "ungefähr Minuten") == "placeholders" and c("de", "about {1} min", "ungefähr {2} Min.") == "placeholders")
    ok("a placeholder may move to where the grammar needs it", c("de", "{1} of {2}", "{2} von {1}") is None)
    ok("a protected name must stay", c("ru", "Open Binance", "Открыть Бинанс") == "lost Binance")
    ok("the language's own script is required where there are words to translate",
       c("ru", "Every coin", "Every coin") == "wrong script" and c("hi", "Search a coin", "Search a coin") == "wrong script")
    ok("…but a label with nothing to translate may stay", c("jp", "BTC", "BTC") is None and c("jp", "OK", "OK") is None)
    ok("Arabic letters where they do not belong fail", c("de", "Close", "إغلاق") == "arabic letters")
    ok("Persian letters where they do not belong fail", c("tr", "Price", "قیمت") in ("arabic letters", "persian letters"))
    ok("Urdu may use Arabic letters", c("ur", "Close", "بند کریں") is None)
    ok("English handed back fails for a longer string",
       c("de", "Every price is worked out with your own rate", "Every price is worked out with your own rate") == "untranslated")
    ok("empty and absurdly long answers fail", c("de", "Close", "") == "empty" and c("de", "Close", "x" * 200) == "too long")
    ok("Greek passes in Greek letters", c("gr", "Indicators", "Δείκτες") is None)

    tmp = tempfile.mkdtemp()
    old_cache, old_out = S.CACHE, S.OUT
    S.CACHE, S.OUT = os.path.join(tmp, "cache"), os.path.join(tmp, "i18n")
    try:
        need = {"Live market", "Up to {1} charts", "Open Binance", "Loading…", "Close",
                "Every price is worked out with your own rate", "BTC"}
        common = {"Live market", "Close"}
        pages = {os.path.join(ROOT, "index.html"): set(need) - {"BTC"}}
        scripts = {"app.js": {"BTC", "Loading…"}}
        calls, used_by = [], []

        def answer(prompt, api_key="k"):
            calls.append(prompt)
            used_by.append(api_key)
            batch = json.loads(prompt[prompt.index("Input:") + 6:].strip())
            out = []
            for en in batch:
                if en == "Open Binance":
                    out.append("Открыть Бинанс")          # drops Binance: must fail every time
                else:
                    out.append(en.replace("Live market", "Живой рынок").replace("Up to", "До")
                                 .replace("charts", "графиков").replace("Loading…", "Загрузка…")
                                 .replace("Close", "Закрыть").replace("BTC", "BTC")
                                 .replace("Every price is worked out with your own rate", "Каждая цена рассчитана по вашему курсу"))
            return out

        class FakeAI:
            QuotaError, RateLimited = S.pro_l10n.__dict__.get("_Q", RuntimeError), RuntimeError

        import ai
        real_with, real_model = ai.generate_with, ai.model
        ai.model = lambda: "fake-model"
        dead = set()

        def gen_with(api_key, prompt, *a, **k):
            if api_key in dead:
                raise ai.QuotaError("daily quota exhausted")
            time.sleep(0.03)
            return answer(prompt, api_key)
        ai.generate_with = gen_with
        try:
            cnt = {}
            S.fill(["ru"], need, common, 20, 60, ["k1", "k2", "k3"], log=lambda *a: None, counter=cnt)
            s = S.load("ru")
            ok("good strings are kept, the failing one is not", "Open Binance" not in s and s["Live market"] == "Живой рынок", s)
            ok("every other string of the corpus was translated", len(s) == len(need) - 1, (len(s), len(need)))
            ok("the strings nearly every page has went out first", "Live market" in calls[0] or "Close" in calls[0])
            ok("one batch is one request", cnt["used"] == len(calls) == 1, (cnt, len(calls)))

            # enough strings to fill several batches: the keys must then work at the same time
            big = {f"Chart number {i} of the workspace is ready": "" for i in range(400)}
            used_by.clear()
            cnt2 = {}
            S.fill(["ru"], set(big), set(), 40, 60, ["k1", "k2", "k3"], log=lambda *a: None, counter=cnt2)
            ok("with several batches the keys work at the same time",
               len(set(used_by)) > 1 and len(used_by) == cnt2["used"] > 1, (set(used_by), cnt2))
            shutil.rmtree(S.CACHE, ignore_errors=True)
            S.fill(["ru"], need, common, 20, 60, ["k1"], log=lambda *a: None, counter={})

            # a second run asks only for what is still missing
            calls.clear()
            S.fill(["ru"], need, common, 20, 60, ["k1"], log=lambda *a: None, counter={})
            asked = json.loads(calls[0][calls[0].index("Input:") + 6:].strip()) if calls else []
            ok("a run asks only for the strings that are still missing", asked == ["Open Binance"], asked)

            # a key that runs out hands its batch to another
            shutil.rmtree(S.CACHE, ignore_errors=True)
            dead.add("k1")
            S.fill(["ru"], need, common, 20, 60, ["k1", "k2"], log=lambda *a: None, counter={})
            ok("a key that runs out of quota hands its batch to another key", len(S.load("ru")) == len(need) - 1)

            # the dictionaries
            cov = S.write_dicts("ru", pages, scripts, common, need)
            d = os.path.join(S.OUT, "ru")
            com = json.load(open(os.path.join(d, "common.json"), encoding="utf-8"))
            st = json.load(open(os.path.join(d, "status.json"), encoding="utf-8"))
            js = json.load(open(os.path.join(d, "js", "app.json"), encoding="utf-8"))
            ok("common.json holds the strings nearly every page has", set(com) == common and com["Close"] == "Закрыть", com)
            ok("a page file holds what that page needs beyond those", os.path.isdir(os.path.join(d, "page")))
            ok("a script file holds what that script needs", "Loading…" in js and js["Loading…"] == "Загрузка…", js)
            ok("status.json carries the language, its direction and the coverage",
               st["lang"] == "ru" and st["dir"] == "ltr" and 0 < st["coverage"] <= 100 and cov == st["coverage"], st)
            ok("a string that never passed is in no dictionary",
               not any("Open Binance" in json.load(open(os.path.join(dp, f), encoding="utf-8"))
                       for dp, _, fs in os.walk(d) for f in fs if f.endswith(".json") and f != "status.json"))
        finally:
            ai.generate_with, ai.model = real_with, real_model
    finally:
        S.CACHE, S.OUT = old_cache, old_out
        shutil.rmtree(tmp, ignore_errors=True)

    # batching and the language list
    keys = ["x" * 100] * 200
    bs = list(S.batches(keys))
    ok("a batch holds at most 60 strings or 6000 characters", all(len(b) <= 60 and sum(len(k) for k in b) <= 6000 for b in bs), [len(b) for b in bs[:3]])
    ok("the 47 languages are the ones /market/ uses", sorted(S.LANGS) == sorted(pro_langs.NEW) and len(S.LANGS) == 47)

    # the real site
    pages, scripts, common, need = S.corpus()
    ok("the real corpus is read: many pages, many strings", len(pages) > 20 and len(need) > 1500, (len(pages), len(need)))
    ok("the encyclopedia is left out", not any(os.sep + "encyclopedia" + os.sep in p for p in pages))
    ok("the strings nearly every page has are a small part of the whole", 0 < len(common) < len(need) / 4, (len(common), len(need)))
    # Two faults that between them froze the globe at 10 languages for two days (2026-11-21).
    # A bare host name or a scheme-less link can only come back unchanged, so the checks rejected it every run and
    # it was asked again forever, eating the day's budget.
    import i18n_ar
    hosts = ["cryptoquant.com", "eur-lex.europa.eu", "uk.news.yahoo.com", "t.me/Coin_Kurd_Group", "bitcointalk.org"]
    ok("a bare host name is not sent for translation", not any(i18n_ar.worth(h) for h in hosts),
       [h for h in hosts if i18n_ar.worth(h)])
    prose = ["Open interest", "The market at any past moment", "Trading in the Zone", "Read more"]
    ok("ordinary text is still sent for translation", all(i18n_ar.worth(t) for t in prose),
       [t for t in prose if not i18n_ar.worth(t)])

    # The run is shared out a batch at a time; taking the languages in order starved every one past the first few.
    import unittest.mock
    many = [f"s{i}" for i in range(4000)]
    with unittest.mock.patch.object(S, "load", lambda c: {}):
        items, _ = S.plan(["kmr", "tr", "ru", "es", "br", "de", "fr", "hi", "id", "ur"], many, set(), 20)
    reached = {c for c, _ in items}
    ok("a capped run reaches every unfinished language, not just the first", len(reached) == 10, sorted(reached))

    # The day's calls used to be spendable at once, so translation ran flat out for a few hours and then every
    # translating step did nothing until the next morning. They are released through the quota day instead.
    import pro_l10n, datetime
    from zoneinfo import ZoneInfo
    LA = ZoneInfo("America/Los_Angeles")
    def at(h, m=0):
        return pro_l10n.quota_allowance(1000, datetime.datetime(2026, 11, 22, h, m, tzinfo=LA).timestamp())
    ok("the first run of the day can still work", 100 <= at(0) <= 200, at(0))
    ok("about half the calls are out by midday", 450 <= at(12) <= 550, at(12))
    ok("the whole cap is reachable by the end", at(23, 59) >= 990, at(23, 59))
    ok("the allowance only ever grows through the day",
       all(at(h) <= at(h + 1) for h in range(23)), [at(h) for h in range(0, 24, 6)])
    ok("nothing is released beyond the cap", max(at(h) for h in range(24)) <= 1000)

    # One pool of keys, two translating jobs. They used to have separate caps against a single total, so the site
    # was cut off at 1140 while the market went on to 1600 -- backwards, given the market pages are ~98% done and
    # the site ~16%. The owner chose the site's 50 languages (2026-11-22); each side now spends only its own share.
    pro_l10n.CACHE = tempfile.mkdtemp()
    noon = datetime.datetime(2026, 11, 22, 12, 0, tzinfo=LA).timestamp()
    day = pro_l10n.quota_day(noon)
    site0, mkt0 = pro_l10n.quota_budget("site", 19, noon), pro_l10n.quota_budget("market", 19, noon)
    ok("the site gets the larger share", site0 > mkt0 * 3, (site0, mkt0))
    pro_l10n.quota_add(500, day=day, who="site")
    ok("what the site spends comes off the site's share",
       pro_l10n.quota_budget("site", 19, noon) == site0 - 500)
    ok("and leaves the market's share alone",
       pro_l10n.quota_budget("market", 19, noon) == mkt0, pro_l10n.quota_budget("market", 19, noon))
    pro_l10n.quota_add(100, day=day, who="market")
    ok("the market's spending likewise stays on its own side",
       pro_l10n.quota_budget("market", 19, noon) == mkt0 - 100 and
       pro_l10n.quota_budget("site", 19, noon) == site0 - 500)
    ok("the total still adds up", pro_l10n.quota_used(day=day) == 600, pro_l10n.quota_used(day=day))
    # the allowance and the spending must be read against the same day, or the reset hands out nothing
    after = datetime.datetime(2026, 11, 23, 0, 1, tzinfo=LA).timestamp()
    ok("a new quota day starts clean", pro_l10n.quota_budget("site", 19, after) > 0,
       pro_l10n.quota_budget("site", 19, after))

    p = S.prompt_for("tw", ["Close"])
    ok("the prompt names the language, its variant and what must stay as written",
       "Chinese (Traditional)" in p and "Traditional Chinese" in p and "Coin_Kurd" in p and '["Close"]' in p)

    print(f"\n{len(FAILS)} failure(s)" if FAILS else "\nOK")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
