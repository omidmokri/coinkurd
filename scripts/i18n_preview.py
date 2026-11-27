#!/usr/bin/env python3
"""Before/after sample of the glossary redo, for the owner to look at before anything goes live.

For each weak language, takes strings that carry a trading term (Google's drafts first), asks Gemini again with the
glossary in the prompt, and asks once more for a plain Persian reading of both versions, so the owner can judge a
language he does not read. Writes data/i18n_preview.json only; the caches and the site are not touched.
"""
import json
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai  # noqa: E402
import i18n_glossary as G  # noqa: E402
import i18n_site as S  # noqa: E402
import pro_langs  # noqa: E402

LANGS = (os.environ.get("PREVIEW_LANGS") or "gr,kmr,sw,ta,th").split(",")
N = int(os.environ.get("PREVIEW_N", "14"))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "i18n_preview.json")


def sample(code):
    s, g = S.load(code), S.load_g(code)
    pick = [k for k in s if 2 <= len(k.split()) <= 12 and "{" not in k and "<" not in k and G.found(k)]
    pick.sort(key=lambda k: (k not in g, k))
    random.Random(code).shuffle(pick)                 # a spread of the site, the same each run
    pick.sort(key=lambda k: k not in g)               # Google's drafts first, the order inside stays shuffled
    return [(k, s[k], k in g) for k in pick[:N]]


def call(prompt, keys, models):
    last = None
    for m in models:
        for k in keys:
            try:
                return ai.generate_with(k, prompt, True, 0.1, 8192, 2, 150, m)
            except Exception as e:  # noqa: BLE001  quota, rate limit or a bad answer: the next key or model
                last = e
                time.sleep(2)
    raise RuntimeError(f"no key answered ({type(last).__name__}: {str(last)[:120]})")


def as_list(out, n):
    if isinstance(out, str):
        import re
        m = re.search(r"\[.*\]", out, re.S)
        out = json.loads(m.group(0)) if m else None
    return out if isinstance(out, list) and len(out) == n else None


def main():
    keys, models = ai.keys(), S.models()
    print("preview:", ai.pool_note(), models)
    res = {"made": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "langs": {}}
    for code in LANGS:
        rows = sample(code)
        if not rows:
            continue
        en = [r[0] for r in rows]
        good, bad = S.translate_batch(code, en, lambda p: call(p, keys, models))
        after = [good.get(e, "") for e in en]
        lang = pro_langs.BY[code]["english"]
        both = [r[1] for r in rows] + after
        back = as_list(call(
            "Translate each string below from " + lang + " into plain Persian (Farsi), as literally as you can, so a "
            "reader sees exactly what it says, including any wrong word choice. Return ONLY a JSON array of strings, "
            "same length and order.\n" + json.dumps(both, ensure_ascii=False), keys, models), len(both)) or [""] * len(both)
        res["langs"][code] = [{"en": r[0], "google": r[2], "before": r[1], "after": a,
                               "before_fa": back[i], "after_fa": back[len(rows) + i],
                               "terms": G.found(r[0]), "rejected": bad.get(r[0], "")}
                              for i, (r, a) in enumerate(zip(rows, after))]
        print(code, len(rows), "samples,", len(good), "redone,", len(bad), "rejected")
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
