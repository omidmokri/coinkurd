#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Translate as the second hand for the site's 43 languages, so every language is readable while Gemini works.

Why: the free Gemini pool is held back by Google's per-minute limit (on 2026-11-26 about nine of every ten requests
were turned away) while the site adds a few hundred strings an hour. Gemini alone could not keep up, and the 50
languages the owner asked for would have stayed hidden behind the 70% gate for days.

What it does: after scripts/i18n_site.py has had its turn, this fills the strings still untranslated with Google
Translate (deep-translator, the same library scripts/translate.py and scripts/news_tr.py already use), under the same
checks as Gemini's answers (i18n_site.check) plus one of its own: every HTML tag must come back. A string it fills is
marked in the cache's "g" list; i18n_site queues those after every untranslated string and replaces them with
Gemini's translation as the calls allow, so Google's draft is only ever a stand-in.

It spends no Gemini calls. Languages are taken nearest the gate first (the one a reader is closest to getting), the
homepage and the strings nearly every page has first within each.

CLI:  python3 scripts/i18n_gt.py [--seconds 600] [--lang hi,id] [--threads 6]
Test: python3 tests/test_i18n_gt.py
"""
import argparse
import os
import re
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i18n_site as S  # noqa: E402
import pro_langs  # noqa: E402

# the site's code -> Google Translate's
SPECIAL = {"cn": "zh-CN", "tw": "zh-TW", "iw": "iw", "fil": "tl", "br": "pt", "pt": "pt", "kmr": "ku",
           "no": "no", "cat": "ca"}
CHUNK_CHARS = 3800      # Google's web endpoint takes 5,000; room for the strings that come back longer
CHUNK_LINES = 40
GTX = "https://translate.googleapis.com/translate_a/single"   # the endpoint Google's own web widgets call
RATE = float(os.environ.get("I18N_GT_RATE", "4"))            # requests a second across every thread; Google allows 5


class Pace:
    """one shared clock, so six threads together stay under Google's requests-a-second"""

    def __init__(self, per_second):
        self.gap = 1.0 / max(0.1, per_second)
        self.next = 0.0
        self.lock = threading.Lock()

    def wait(self):
        with self.lock:
            now = time.time()
            at = max(now, self.next)
            self.next = at + self.gap
        if at > now:
            time.sleep(at - now)


def turned_away(e):
    m = str(e).lower()
    return "429" in m or "too many" in m


def gtx_factory(pace):
    import requests
    sess = requests.Session()

    def make(code):
        tl = gcode(code)

        def tr(text):
            pace.wait()
            r = sess.post(GTX, params={"client": "gtx", "sl": "en", "tl": tl, "dt": "t"},
                          data={"q": text}, timeout=30)
            if r.status_code == 429:
                raise RuntimeError("429 too many requests")
            r.raise_for_status()
            return "".join(seg[0] for seg in (r.json() or [[]])[0] or [] if seg and seg[0])
        return tr
    return make


def deep_factory(pace):
    from deep_translator import GoogleTranslator

    def make(code):
        g = GoogleTranslator(source="en", target=gcode(code))

        def tr(text):
            pace.wait()
            return g.translate(text)
        return tr
    return make


def gcode(code):
    if code in SPECIAL:
        return SPECIAL[code]
    bcp = (pro_langs.BY.get(code) or {}).get("bcp") or code
    return bcp.split("-")[0].lower()


def tags_kept(en, tr):
    return sorted(S.TAG.findall(en)) == sorted(S.TAG.findall(tr))


def usable(code, en, tr):
    if not isinstance(tr, str):
        return False
    tr = tr.strip()
    return bool(tr) and S.check(code, en, tr) is None and tags_kept(en, tr)


def chunks(keys):
    """strings joined a line each, so one request carries many; a string with a line break of its own goes alone"""
    cur, n = [], 0
    for k in keys:
        if "\n" in k or len(k) > CHUNK_CHARS:
            if cur:
                yield cur
                cur, n = [], 0
            yield [k]
            continue
        if cur and (len(cur) >= CHUNK_LINES or n + len(k) + 1 > CHUNK_CHARS):
            yield cur
            cur, n = [], 0
        cur.append(k)
        n += len(k) + 1
    if cur:
        yield cur


def translate_chunk(code, chunk, tr_fn):
    """{english: translation} for what passed the checks; tr_fn(text) -> translated text"""
    out = {}
    if len(chunk) == 1:
        en = chunk[0]
        got = tr_fn(en[:4900])
        if usable(code, en, got):
            out[en] = S.i18n_ar.norm(got.strip())
        return out
    got = tr_fn("\n".join(chunk))
    lines = (got or "").split("\n")
    if len(lines) != len(chunk):                 # the lines did not come back one for one: each on its own
        for en in chunk:
            out.update(translate_chunk(code, [en], tr_fn))
        return out
    for en, tr in zip(chunk, lines):
        if usable(code, en, tr):
            out[en] = S.i18n_ar.norm(tr.strip())
    return out


def order(langs, need):
    """nearest the gate first, finished languages left out"""
    rows = []
    for code in langs:
        s = S.load(code)
        done = sum(1 for k in need if k in s)
        if done < len(need):
            rows.append((-done, code))
    return [c for _, c in sorted(rows)]


def fill(langs, need, first, seconds, threads=6, tr_factory=None, log=print):
    """fill the untranslated strings of `langs` with Google Translate, `threads` languages at a time"""
    t0 = time.time()
    if tr_factory is None:
        pace = Pace(RATE)
        tr_factory = (deep_factory if os.environ.get("I18N_GT_ENGINE") == "deep" else gtx_factory)(pace)
    todo_langs = list(order(langs, need))
    lock = threading.Lock()
    stats = {"strings": 0, "requests": 0, "stopped": False}

    def run_lang(code):
        s = S.load(code)
        g = S.load_g(code)
        bad = {k for k, n in S.load_fails(code).items() if n >= S.FAIL_MAX}
        keys = [k for k in need if k not in s and k not in bad]
        keys.sort(key=lambda k: (k not in first, len(k), k))
        tr = tr_factory(code)
        errors, added, last = 0, 0, time.time()
        for ch in chunks(keys):
            if time.time() - t0 > seconds or stats["stopped"]:
                break
            try:
                got = translate_chunk(code, ch, tr)
                errors = 0
            except Exception as e:  # noqa: BLE001
                errors += 1
                log(f"gt {code}: {type(e).__name__}: {str(e)[:120]}")
                if errors >= 3:
                    with lock:
                        if turned_away(e):
                            stats["stopped"] = True       # Google is turning this runner away: stop every language
                    break
                time.sleep(5 * errors)
                continue
            with lock:
                stats["requests"] += 1
            s.update(got)
            g |= set(got)
            added += len(got)
            if time.time() - last > 60:
                S.save(code, s, g=g)
                last = time.time()
        if added:
            S.save(code, s, g=g)
        with lock:
            stats["strings"] += added
        log(f"gt {code}: {added} strings")

    q = list(todo_langs)

    def worker():
        while True:
            with lock:
                if not q or stats["stopped"] or time.time() - t0 > seconds:
                    return
                code = q.pop(0)
            run_lang(code)

    ths = [threading.Thread(target=worker, daemon=True) for _ in range(max(1, threads))]
    for th in ths:
        th.start()
    for th in ths:
        th.join(timeout=max(30.0, seconds - (time.time() - t0) + 90))
    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=int, default=int(os.environ.get("I18N_GT_SECONDS", "600")))
    ap.add_argument("--threads", type=int, default=int(os.environ.get("I18N_GT_THREADS", "6")))
    ap.add_argument("--lang", default="")
    a = ap.parse_args()
    pages, scripts, common, need = S.corpus()
    home = next((v for p, v in pages.items() if os.path.relpath(p, S.ROOT) == "index.html"), set())
    langs = [x for x in a.lang.split(",") if x] or S.LANGS
    stats = fill(langs, need, common | home, a.seconds, a.threads)
    print(f"i18n_gt: {stats['strings']:,} strings in {stats['requests']} requests"
          + (" (Google turned this runner away; stopped)" if stats["stopped"] else ""))


if __name__ == "__main__":
    main()
