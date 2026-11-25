#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The whole site in the other 43 languages — the same layer that gives it Arabic, opened to every language of /market/.

entekhab.net is written in Persian, Sorani and English, and Arabic is already a fourth: scripts/i18n_ar.py reads the
English of every built page and of the scripts it runs, translates it once, and assets/ar.js puts the Arabic in
while the page loads. This script does that for the 43 languages in scripts/pro_langs.py, so the site reads in all
47. It reuses i18n_ar's own reader, so a string is found the same way for every language and the two can never drift.

Not translated, by the owner's choice: the encyclopedia (i18n_ar.NO_DICT_TOP), and pages that are already in a
language of their own (/market/<code>/, marked data-noar).

The cache, data/i18n/<code>.json (committed, one file a language):
  {"lang": "de", "s": {"<the English>": "<the translation>"}}
A string is translated once and kept. A translation is only kept when it passes the checks below; what is not
translated yet simply shows in English, so a language is readable from its first run.

Checks on every translated string (check()):
  * the same {1}, {2}… placeholders as the English, in any order (grammar moves them);
  * written in the language's own script (Cyrillic for Russian, Devanagari for Hindi …) wherever the English has
    words to translate, and no Arabic or Persian letters in a language that does not use them;
  * every protected name still there (Binance, Coin_Kurd, TradingView, BTC …), not empty, not absurdly long, and
    not simply the English handed back.

Budget: the free Gemini keys are shared with the rest of the site, so a run makes at most --requests calls and
--seconds of work, and the batches go out on all of the owner's keys at once (scripts/ai.py's pool, one worker a
key). Languages are filled in scripts/pro_l10n.PRIORITY order, so each becomes complete as early as possible.

Output, i18n/<code>/ (built, never committed — the same shape as i18n/ar/):
  common.json            the menus, footer and tab bar: the strings nearly every page has
  page/<path>.json       what one page needs beyond those
  js/<file>.json         what one script in assets/ needs
  status.json            coverage

CLI:  python3 scripts/i18n_site.py [--requests N] [--seconds S] [--lang de,tr] [--jobs N] [--status] [--no-translate]
Test: python3 tests/test_i18n_site.py
"""
import argparse
import json
import os
import queue
import re
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i18n_ar  # noqa: E402   (the reader: walk, Page, js_strings, variants, numkey, worth, page_key)
import pro_l10n  # noqa: E402  (PRIORITY, the quota day, the script table)
import pro_langs  # noqa: E402

ROOT = i18n_ar.ROOT
CACHE = os.path.join(ROOT, "data", "i18n")
OUT = os.path.join(ROOT, "i18n")
LANGS = pro_l10n.PRIORITY                       # the 43, most-read first
# The site's budget is its share of the pool's quota day (pro_l10n.SHARE["site"]), not a cap of its own; the
# owner chose the site's 50 languages over the market pages on 2026-11-22.
DAILY = int(os.environ.get("I18N_SITE_DAILY", "60"))    # kept for --requests arithmetic and older call sites

PH = re.compile(r"\{\d+\}")
KEEP = ["entekhab.net", "Coin_Kurd", "Coin Kurd", "Entekhab", "Telegram", "TradingView", "Binance", "mempool.space",
        "Bitcoin Core", "OKX", "Bybit", "Deribit", "Kurdistani", "Discord", "GitHub", "BTC", "ETH", "USDT", "USDC",
        "RSI", "MACD", "EMA", "SMA", "VWAP", "ATR", "ADX", "OHLC", "CSV", "PNG", "JSON", "QR", "UTC", "API",
        # product and platform names: a language written in another alphabet keeps them in Latin letters, and
        # without them here the script check turned the answer down and the string was re-sent run after run
        "YouTube", "Instagram", "WhatsApp", "X (Twitter)", "Twitter", "Windows", "macOS", "iOS", "Android",
        "Linux", "Chrome", "Firefox", "Safari", "Edge", "Pine Script", "Pine Studio", "Gemini", "Hurst"]
KEEP_RE = [(k, re.compile(r"(?<![A-Za-z0-9_.])" + re.escape(k) + r"(?![A-Za-z0-9_])")) for k in sorted(KEEP, key=len, reverse=True)]
FAIL_MAX = 3      # after this many unusable answers a string is left in English rather than re-sent every run
SCRIPT = pro_l10n.SCRIPT                        # the alphabet a language must be written in
ARABIC = re.compile(r"[؀-ۿ]")
PERSIAN = re.compile(r"[پچژگ]")
TAG = re.compile(r"<[^>]+>")


# --------------------------------------------------------------------------------- the strings the site needs
def corpus():
    """(pages, scripts, common, need) — read with i18n_ar's own reader, so both layers see the same strings"""
    pages, scripts = {}, {}
    for path in i18n_ar.walk():
        if os.path.relpath(path, ROOT).split(os.sep)[0] in i18n_ar.NO_DICT_TOP:
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                if i18n_ar.NOAR.search(fh.read(800)):      # already in a language of its own
                    continue
            doc = open(path, encoding="utf-8").read()
        except OSError:
            continue
        p = i18n_ar.Page()
        try:
            p.feed(doc)
        except Exception as e:  # noqa: BLE001
            print("skip", path, e, file=sys.stderr)
            continue
        keys = set(p.out)
        for code in p.inline:
            keys |= i18n_ar.js_strings(code)
        if p.title and p.base and i18n_ar.worth(p.title):
            keys.add(i18n_ar.numkey(p.title))
        pages[path] = set().union(*(i18n_ar.variants(k) for k in keys)) if keys else keys
    adir = os.path.join(ROOT, "assets")
    for f in sorted(os.listdir(adir)) if os.path.isdir(adir) else []:
        if f.endswith(".js") and f not in ("ar.js", "i18n.js") and not f.endswith(".min.js"):
            try:
                ks = i18n_ar.js_strings(open(os.path.join(adir, f), encoding="utf-8").read())
                scripts[f] = set().union(*(i18n_ar.variants(k) for k in ks)) if ks else ks
            except Exception as e:  # noqa: BLE001
                print("skip js", f, e, file=sys.stderr)
    from collections import Counter
    cnt = Counter(k for ks in pages.values() for k in ks)
    common = {k for k, c in cnt.items() if c >= max(3, len(pages) * 0.6)}
    need = set().union(*pages.values()) if pages else set()
    for v in scripts.values():
        need |= v
    return pages, scripts, common, need


# --------------------------------------------------------------------------------- the cache
def cache_path(code):
    return os.path.join(CACHE, code + ".json")


def load(code):
    try:
        with open(cache_path(code), encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError):
        return {}
    s = (d.get("s") if isinstance(d, dict) else None) or {}
    return {k: v for k, v in s.items() if isinstance(v, str) and v}


def load_fails(code):
    """how often each string has come back unusable in this language

    Without this the run re-sent the same strings every time. The queue puts the shortest first, and the shortest
    are names — YouTube, Instagram, macOS, en-US — which a language written in another alphabet must keep in Latin
    letters, so the script check turned them down, they stayed outstanding, and they were at the head of the next
    run's batch again. Half of Hindi's batch went on them every run, and the language crawled.
    """
    try:
        with open(cache_path(code), encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError):
        return {}
    v = (d.get("f") if isinstance(d, dict) else None) or {}
    return {k: n for k, n in v.items() if isinstance(n, int) and n > 0}


def save(code, s, fails=None):
    os.makedirs(CACHE, exist_ok=True)
    f_ = dict(sorted((fails if fails is not None else load_fails(code)).items()))
    f_ = {k: n for k, n in f_.items() if k not in s}      # one that came good later starts clean again
    with open(cache_path(code), "w", encoding="utf-8") as f:
        d = {"lang": code, "s": dict(sorted(s.items()))}
        if f_:
            d["f"] = f_
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")


# --------------------------------------------------------------------------------- checks
def words_to_translate(en):
    t = TAG.sub(" ", PH.sub(" ", en))
    for _, rx in KEEP_RE:
        t = rx.sub(" ", t)
    return re.findall(r"[A-Za-z]{2,}", t)


def check(code, en, tr):
    """None when the translation can be used, else why not"""
    if not isinstance(tr, str) or not tr.strip():
        return "empty"
    tr = tr.strip()
    if sorted(PH.findall(en)) != sorted(PH.findall(tr)):
        return "placeholders"
    for k, rx in KEEP_RE:
        if rx.search(en) and not rx.search(tr):
            return "lost " + k
    if len(tr) > 4 * len(en) + 60:
        return "too long"
    words = words_to_translate(en)
    sc = SCRIPT.get(code)
    if sc and (len(words) >= 2 or any(len(w) >= 5 for w in words)) and not re.search(sc, tr):
        return "wrong script"
    if code not in ("ur",) and ARABIC.search(tr) and not ARABIC.search(en):
        return "arabic letters"
    if code not in ("ur",) and PERSIAN.search(tr) and not PERSIAN.search(en):   # پ چ ژ گ are Urdu's own letters too
        return "persian letters"
    if not sc and len(words) >= 4 and tr.lower() == en.strip().lower():
        return "untranslated"
    return None


# --------------------------------------------------------------------------------- Gemini
PROMPT = """You translate the interface and articles of entekhab.net, a crypto-market education site (live prices, charts,
Bitcoin history, trading lessons, on-chain data), from English into {lang} ({native}){variant}.

Rules:
- Return ONLY a JSON array of strings, the same length and order as the input array.
- Keep every placeholder like {{1}}, {{2}} exactly as written (you may move it to where the grammar needs it).
- Keep untranslated: tickers and symbols (BTC, ETH, USDT, sat/vB, vB, kB, MB, %, $), numbers, URLs, code, and these
  names: {keep}.
- Use the words traders and trading platforms use in {lang} (candles, timeframe, indicator, support, resistance,
  leverage, wallet, mining, block, transaction, fee, order book).
- Short interface labels stay short: a button stays one or two words. Keep the tone neutral and clear.
- Write numbers with Western digits (0-9). No explanations, no quotes around the whole answer, no notes.

Input:
"""


def prompt_for(code, batch):
    r = pro_langs.BY[code]
    return PROMPT.format(lang=r["english"], native=r["native"], variant=pro_l10n.VARIANT.get(code, ""),
                         keep=", ".join(KEEP)) + json.dumps(batch, ensure_ascii=False)


def translate_batch(code, batch, gen):
    """one request; returns {english: translation} of what passed the checks, and the reasons the rest did not"""
    out = gen(prompt_for(code, batch))
    if isinstance(out, str):
        m = re.search(r"\[.*\]", out, re.S)
        out = json.loads(m.group(0)) if m else None
    if not isinstance(out, list) or len(out) != len(batch):
        return {}, {"*": "answer was not a list of the right length"}
    good, bad = {}, {}
    for en, tr in zip(batch, out):
        tr = i18n_ar.norm(str(tr)) if tr is not None else ""
        why = check(code, en, tr)
        if why:
            bad[en] = why
        else:
            good[en] = tr
    return good, bad


def batches(keys, size=60, chars=6000):
    cur, n = [], 0
    for k in keys:
        if cur and (len(cur) >= size or n + len(k) > chars):
            yield cur
            cur, n = [], 0
        cur.append(k)
        n += len(k)
    if cur:
        yield cur


# --------------------------------------------------------------------------------- filling the caches
def plan(langs, need, common, limit):
    """the requests a run would make: (language, one batch), the strings nearly every page has first

    The run is shared out a batch at a time, in turn, rather than filling the cap from the top of the list. Taking
    the languages in order starved every language past the first few: the ones at the top always have some strings
    outstanding, so the cap ran out before the planner ever reached the next language to be brought up.
    """
    queues, state, pct = [], {}, {}
    for code in langs:
        s = load(code)
        state[code] = s
        bad = {k for k, n in load_fails(code).items() if n >= FAIL_MAX}
        todo = [k for k in need if k not in s and k not in bad]
        pct[code] = (len(need) - len(todo)) / len(need) * 100 if need else 0
        if not todo:
            continue
        todo.sort(key=lambda k: (k not in common, len(k), k))
        queues.append((code, list(batches(todo))))
    # A language already offered in the globe comes first and takes one batch a round: a language a reader can pick
    # today must not fall behind the pages written today. After them the whole of what is left goes to the one
    # language closest to the gate, until it passes it — shared evenly, no language ever arrived. The rest keep the
    # round-robin they had, on whatever is left over.
    live = [q for q in queues if pct.get(q[0], 0) >= READY]
    rest = sorted((q for q in queues if pct.get(q[0], 0) < READY), key=lambda q: -pct.get(q[0], 0))
    soonest, others = rest[:1], rest[1:]
    items, used = [], {}

    def take(group, cap):
        """one batch a language a round, until the group is spent or the cap is reached"""
        for i in range(max((len(b) for _, b in group), default=0)):
            for code, bs in group:
                if i < len(bs) and i >= used.get(code, 0):
                    items.append((code, bs[i]))
                    used[code] = i + 1
                    if len(items) >= min(cap, limit):
                        return len(items) >= limit
        return len(items) >= limit

    if take(live, limit):                       # a language readers can pick today never falls behind
        return items, state
    if take(soonest, max(1, int(limit * SOONEST))):   # then the one nearest the gate, to bring it over
        return items, state
    if take(others, limit):                     # and the rest share what is left, as they always did
        return items, state
    take(soonest, limit)                        # nothing left to share: the nearest one may use the remainder
    return items, state


def fill(langs, need, common, requests_max, seconds, pool, log=print, counter=None):
    """fill the caches of `langs`, the owner's keys working at once — one worker a key"""
    import ai  # noqa: E402
    t0 = time.time()
    counter = counter if counter is not None else {}
    counter["used"] = 0
    ai.model()                       # settle the model before the workers start
    items, state = plan(langs, need, common, requests_max)
    if not items:
        return state
    q = queue.Queue()
    for it in items:
        q.put(it)
    lock = threading.Lock()
    changed = set()
    fails = {code: load_fails(code) for code in {c for c, _ in items}}

    def worker(api_key):
        while time.time() - t0 <= seconds:
            try:
                code, batch = q.get_nowait()
            except queue.Empty:
                return
            with lock:
                counter["used"] += 1
            try:
                good, bad = translate_batch(code, batch, lambda p: ai.generate_with(api_key, p, True, 0.1, 8192, 2, 120))
            except ai.QuotaError as e:
                with lock:
                    log(f"{code}: key {ai._kid(api_key)} is out for this run ({str(e)[:110]})")
                q.put((code, batch))
                return
            except ai.RateLimited:
                q.put((code, batch))
                time.sleep(20)
                continue
            except Exception as e:  # noqa: BLE001
                with lock:
                    log(f"{code}: request failed on key {ai._kid(api_key)} ({type(e).__name__}: {str(e)[:140]})")
                continue
            with lock:
                state[code].update(good)
                for k in bad:
                    fails[code][k] = fails[code].get(k, 0) + 1
                if good or bad:
                    changed.add(code)
                log(f"{code}: {len(good)}/{len(batch)} kept" + (f"; dropped {dict(list(bad.items())[:4])}" if bad else ""))

    threads = [threading.Thread(target=worker, args=(k,), daemon=True) for k in pool]
    for th in threads:
        th.start()
    for th in threads:
        th.join(timeout=max(30.0, seconds - (time.time() - t0) + 120))
    for code in sorted(changed):
        save(code, state[code], fails.get(code))
    return state


# --------------------------------------------------------------------------------- the dictionaries
def write_dicts(code, pages, scripts, common, need):
    """i18n/<code>/ — the same shape as i18n/ar/, holding only what is translated"""
    s = load(code)
    out = os.path.join(OUT, code)
    import shutil
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, "page"), exist_ok=True)
    os.makedirs(os.path.join(out, "js"), exist_ok=True)

    def dump(rel, keys):
        d = {k: s[k] for k in sorted(keys) if k in s}
        with open(os.path.join(out, rel), "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
        return len(d)

    dump("common.json", common)
    have = tot = 0
    for path, keys in pages.items():
        own = keys - common
        if own:
            dump(os.path.join("page", i18n_ar.page_key(path) + ".json"), own)
        tot += len(keys)
        have += sum(1 for k in keys if k in s)
    for f, keys in scripts.items():
        if keys:
            dump(os.path.join("js", f[:-3] + ".json"), keys)
            tot += len(keys)
            have += sum(1 for k in keys if k in s)
    cov = round(have / tot * 100, 1) if tot else 0
    r = pro_langs.BY[code]
    with open(os.path.join(out, "status.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": code, "dir": r["dir"], "coverage": cov, "strings": len(need),
                   "translated": sum(1 for k in need if k in s),
                   "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, f)
    return cov


READY = int(os.environ.get("I18N_SITE_READY", "70"))   # a language is offered once this much of it is translated
# How much of one run may go to the language nearest that gate. Shared evenly between the thirty-odd unfinished
# languages, none of them ever arrived: each gained a few strings a day while the site itself grew. The eighth
# language reaches readers only if one of them is carried over the line at a time.
SOONEST = float(os.environ.get("I18N_SITE_SOONEST", "0.7"))
VER = "8"      # bump when assets/i18n.js changes, so readers get the new one

# the globe and the chosen language live in assets/i18n.js; this snippet only keeps a reader who has chosen a
# language from seeing the English for a moment while it loads (the same trick the Arabic layer uses)
HEAD = ('<script id="ek-tr-h">try{if(localStorage.getItem("ek_l")&&localStorage.getItem("ek_ar")!=="1"'
        '&&!/^\\/encyclopedia\\//.test(location.pathname)){var h=document.documentElement;h.classList.add("ek-tr-wait");'
        'setTimeout(function(){h.classList.remove("ek-tr-wait")},2600)}}catch(e){}</script>'
        '<style id="ek-tr-s">html.ek-tr-wait body{opacity:0!important}</style>')
SCRIPT_TAG = f'<script src="/assets/i18n.js?v={VER}" defer></script>'
HEAD_RE = re.compile(r'<script id="ek-tr-h">.*?</script><style id="ek-tr-s">.*?</style>', re.S)
SCRIPT_TAG_RE = re.compile(r'<script src="/assets/i18n\.js\?v=\w+" defer></script>')


def inject(path):
    """put assets/i18n.js (and its no-flash snippet) on a page; take it off one already in a language of its own"""
    s = open(path, encoding="utf-8").read()
    own = i18n_ar.NOAR.search(s[:800]) or os.path.relpath(path, ROOT).split(os.sep)[0] in i18n_ar.NO_DICT_TOP
    if own:
        s2 = SCRIPT_TAG_RE.sub("", HEAD_RE.sub("", s))
        if s2 != s:
            open(path, "w", encoding="utf-8").write(s2)
        return False
    s = HEAD_RE.sub(lambda m: HEAD, s, count=1) if 'id="ek-tr-h"' in s else re.sub(r"(<head[^>]*>)", lambda m: m.group(1) + HEAD, s, count=1)
    s = SCRIPT_TAG_RE.sub("", s)
    s = s.replace("</body>", SCRIPT_TAG + "</body>", 1) if "</body>" in s else s + SCRIPT_TAG
    open(path, "w", encoding="utf-8").write(s)
    return True


def write_langs(need):
    """i18n/langs.json — what the globe in the site menu offers: the languages that read well enough to pick.

    The site's own four (Kurdish, Persian, Arabic, English) stay in the menu itself and are not listed here. A
    language appears once READY% of the site's strings are translated, so a reader never picks one that is mostly
    English; the order is the owner's: by English name, as /market/ lists them.
    """
    out = []
    for code in [r[0] for r in pro_langs.LANGS if r[0] in set(LANGS)]:
        s = load(code)
        done = sum(1 for k in need if k in s)
        pct = round(done / len(need) * 100) if need else 0
        if pct >= READY:
            r = pro_langs.BY[code]
            out.append({"code": code, "native": r["native"], "english": r["english"], "dir": r["dir"],
                        "pct": pct, "flag": pro_langs.flag(code)})
    os.makedirs(OUT, exist_ok=True)
    # every language's flag, the site's own four included, so the panel can show one beside each of them too
    flags = {r[0]: pro_langs.flag(r[0]) for r in pro_langs.LANGS if pro_langs.flag(r[0])}
    with open(os.path.join(OUT, "langs.json"), "w", encoding="utf-8") as f:
        json.dump({"ready": out, "flags": flags, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
                  f, ensure_ascii=False, separators=(",", ":"))
    return out


def status(need):
    return {c: {"done": sum(1 for k in need if k in load(c)), "total": len(need)} for c in LANGS}


def main():
    import ai  # noqa: E402
    ap = argparse.ArgumentParser()
    ap.add_argument("--requests", type=int, default=0, help="requests this run (default: 8 a key)")
    ap.add_argument("--seconds", type=int,
                    default=int(os.environ.get("I18N_SITE_SECONDS", "180")),
                    help="translating stops after this long; reading the site and writing the dictionaries\n                          takes about 160s more, and the step is given 8 minutes in all")
    ap.add_argument("--jobs", type=int, default=0, help="requests at once (default: one a key)")
    ap.add_argument("--lang", default="")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--no-translate", action="store_true")
    ap.add_argument("--no-inject", action="store_true", help="dictionaries only (local checks)")
    a = ap.parse_args()

    pages, scripts, common, need = corpus()
    print(f"i18n_site: {len(pages)} pages · {sum(1 for v in scripts.values() if v)} scripts · {len(need)} strings "
          f"· {len(common)} on nearly every page")
    # The script goes on the pages before anything slow happens. It needs no translation to be correct, and a run
    # that is cut short by its timeout used to leave the pages without it — the dictionaries were written, the
    # languages were ready, and the globe still never appeared.
    if not a.status and not a.no_inject:
        n = sum(1 for path in i18n_ar.walk_all() if inject(path))
        print(f"i18n_site: the globe is on {n} pages")
    if a.status:
        for c in LANGS:
            d = status(need)[c]
            print(f"  {c:4} {d['done']:5}/{d['total']}")
        st = status(need)
        print(f"\n{sum(v['done'] for v in st.values()):,} of {len(need) * len(st):,} strings in {len(st)} languages; "
              f"complete: {sum(1 for v in st.values() if v['done'] == len(need))}")
        return

    langs = [x for x in a.lang.split(",") if x] or LANGS
    if not a.no_translate and ai.available():
        pool = ai.keys()
        print(f"i18n_site: {ai.pool_note()}")
        # the site's share of the pool's day, released evenly through it so an afternoon run still has calls
        cap = int(pro_l10n.quota_ceiling(len(pool)) * pro_l10n.SHARE["site"])
        left = pro_l10n.quota_budget("site", len(pool))
        if left <= 0:
            print(f"i18n_site: {pro_l10n.quota_used(who='site')} of the site's {cap} Gemini calls today are used "
                  f"(the pool's day is {pro_l10n.quota_ceiling(len(pool))}, the site takes "
                  f"{int(pro_l10n.SHARE['site'] * 100)}%); the next run has more")
        else:
            requests_max = min(a.requests or 8 * len(pool), left)
            jobs = max(1, min(a.jobs or len(pool), len(pool), requests_max))
            c = {}
            try:
                fill(langs, need, common, requests_max, a.seconds, pool[:jobs], counter=c)
            finally:
                pro_l10n.quota_add(c.get("used", 0), who="site")
            print(f"i18n_site: {c.get('used', 0)} Gemini calls this run on {jobs} key(s)")
            print("i18n_site: the keys this run used —\n" + ai.pool_report())
    elif not a.no_translate:
        print("i18n_site: no Gemini key — nothing translated this run (the pages use what the cache has)")

    ready = []
    for code in LANGS:
        if not os.path.exists(cache_path(code)):
            continue                      # nothing translated into it yet: no folder to write, and much less work
        cov = write_dicts(code, pages, scripts, common, need)
        if cov:
            ready.append(f"{code} {cov:.0f}%")
    offered = write_langs(need)
    print(f"i18n_site: the globe offers {len(offered)} language(s) "
          f"({', '.join(x['code'] for x in offered) if offered else 'none yet'}; a language appears at {READY}%)")
    st = status(need)
    print(f"i18n_site: {sum(v['done'] for v in st.values()):,} of {len(need) * len(st):,} strings in {len(st)} languages")
    print("i18n_site: " + (", ".join(ready) if ready else "no language has any strings yet"))



if __name__ == "__main__":
    main()
