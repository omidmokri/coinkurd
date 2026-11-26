#!/usr/bin/env python3
"""tests for scripts/i18n_gt.py: Google Translate as the stand-in, under the same checks, marked for Gemini to redo"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import i18n_site as S  # noqa: E402
import i18n_gt as G  # noqa: E402

FAILS = []


def ok(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        FAILS.append(name)


def main():
    with tempfile.TemporaryDirectory() as top:
        d = os.path.join(top, "i18n")
        os.makedirs(d)
        S.CACHE = d
        need = {"Open the chart", "Price {1}", "Bitcoin <b>now</b>", "Line one\nline two", "Fear and greed index"}

        def factory(code):
            def tr(text):                      # a fake Google: Russian-looking words, one line for each line
                return "\n".join(("Открыть " + ln) if ln else ln for ln in text.split("\n"))
            return tr
        st = G.fill(["ru"], need, set(), 30, 1, tr_factory=factory, log=lambda *a: None)
        s = S.load("ru")
        ok("Google's answers that pass the checks are kept", "Open the chart" in s and "Price {1}" in s)
        ok("a tag that comes back keeps the string", "Bitcoin <b>now</b>" in s)
        ok("a string with its own line break goes alone and is kept", "Line one\nline two" in s)
        ok("every string it filled is marked for Gemini to redo", S.load_g("ru") == set(s))
        ok("the count adds up", st["strings"] == len(s))

        # a translation that loses a placeholder or a tag is not kept
        def bad_factory(code):
            return lambda text: "\n".join("Цена" for _ in text.split("\n"))
        S.save("de", {})
        G.fill(["de"], {"Price {1}", "Bitcoin <b>now</b>"}, set(), 30, 1, tr_factory=bad_factory, log=lambda *a: None)
        ok("a lost placeholder or tag is turned down", S.load("de") == {})

        # lines that do not come back one for one fall back to one string a request
        calls = []

        def merge_factory(code):
            def tr(text):
                calls.append(text)
                return "Объединено" if "\n" in text else "Открыть " + text
            return tr
        G.fill(["uk"], {"Alpha beta", "Gamma delta"}, set(), 30, 1, tr_factory=merge_factory, log=lambda *a: None)
        ok("merged lines fall back to one string each", len(S.load("uk")) == 2 and len(calls) == 3)

        # Gemini's planner puts Google's drafts last and its answer clears the mark
        items, _ = S.plan(["ru"], need | {"Brand new string"}, set(), 10)
        first = items[0][1] if items else []
        ok("Gemini takes untranslated strings before Google's drafts", first and first[0] == "Brand new string")
        S.save("ru", S.load("ru"), g=S.load_g("ru") - {"Open the chart"})
        ok("a string Gemini redid is no longer marked", "Open the chart" not in S.load_g("ru"))
        raw = json.load(open(os.path.join(d, "ru.json"), encoding="utf-8"))
        ok("the mark is kept in the cache file", isinstance(raw.get("g"), list))

        ok("site codes map to Google's", G.gcode("cn") == "zh-CN" and G.gcode("jp") == "ja" and G.gcode("fil") == "tl"
           and G.gcode("gr") == "el" and G.gcode("se") == "sv" and G.gcode("cz") == "cs")
    print("\nOK" if not FAILS else f"\n{len(FAILS)} FAILED")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
