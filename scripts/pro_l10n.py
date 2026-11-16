#!/usr/bin/env python3
"""
/market/ in 43 more languages: machine translation of the workspace's English strings, a few at a time, kept for good.

Owner's choice (2026-11-15): the site's free Gemini key does the translating, in CI, after each publish — no cost, and
a string not translated yet simply shows in English (assets/pro/i18n.js: P.tr falls back to English).

What is translated (English is the source; the site's own four languages stay hand-written in i18n.js):
  * every string of the workspace (S.en in assets/pro/i18n.js, read with node exactly as tests/test_pro_i18n.py does);
  * the page text search engines read (title, description, the heading, the line under it, the "what this workspace
    has" section of market/index.html, one block — a heading, a list item, a paragraph — at a time).

The cache, data/pro_l10n/<code>.json (committed by update.yml, one file per language):
  {"lang": "de", "s": {"<key>": ["<hash of the English>", "<translation>"]}}
A translation is kept only when it passes the checks below; when the English of a key changes, its hash no longer
matches and the key is translated again (until then the page shows the new English). Nothing is ever invented: a
batch Gemini answers badly is dropped and asked again next run.

Checks on every translated string (check()):
  * the same {placeholders} as the English, and for page text the same HTML tags (attributes included) in the same order;
  * every protected name in the English (Binance, tgju, Coin_Kurd, TradingView, USDT, RSI, B-ADJ …) still there;
  * written in the language's script (Cyrillic for Russian, Devanagari for Hindi …) wherever the English has words to
    translate, no Arabic letters in a language that does not use them, and not just the English handed back;
  * not empty and not absurdly long.

Budget — the free Gemini quota is shared with the site's own steps (post translations, news, Arabic, reports), and those
come first. The owner keeps several free keys (one per Google account), each with its own daily quota, so the ceiling
is PRO_L10N_DAILY calls (default 80) a key a quota day — Google resets it at midnight Pacific time, and the count is
kept in data/pro_l10n/_quota.json. A run stops at --requests calls (default 10 a key) or --seconds (default 200).
Only the run's own model is used (scripts/ai.py's generate_on_model): a key whose quota runs out hands over to the
next key, and ai.py's fallback models are left to the site's own steps (on 2026-11-15 a run walked those models and
used up two models' day within minutes of the reset).

With more than one key the batches of a run go out several at a time — one worker a key, each worker on its own key,
so the per-minute limits do not collide. Languages are filled in PRIORITY order, so each becomes complete as early as
possible.

CLI:  python3 scripts/pro_l10n.py [--requests N] [--seconds S] [--lang de,tr] [--batch 120] [--jobs N] [--status]
Test: python3 tests/test_pro_l10n.py (a fake Gemini in its real answer format; no network)
"""
import argparse
import hashlib
import html
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pro_langs  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRO = os.path.join(ROOT, "assets", "pro")
CACHE = os.path.join(ROOT, "data", "pro_l10n")
TEMPLATE = os.path.join(ROOT, "market", "index.html")

# the order languages are filled in: the largest audiences of the channel's region and of crypto first
PRIORITY = ["tr", "ru", "es", "br", "de", "fr", "hi", "id", "ur", "vi", "cn", "uk", "it", "pl", "nl", "jp", "kr", "tw",
            "th", "fil", "ms", "bn", "ta", "te", "iw", "gr", "ro", "cz", "hu", "se", "no", "da", "fi", "pt", "bg", "hr",
            "sr", "sk", "sl", "lt", "lv", "et", "cat"]
assert sorted(PRIORITY) == sorted(pro_langs.NEW), "PRIORITY must list every new language once"

# names and codes that stay exactly as written in every language
KEEP = ["Binance", "OKX", "Bybit", "Deribit", "Gate", "tgju.org", "tgju", "TradingView", "Lightweight Charts", "Coin_Kurd",
        "Coin Kurd", "Entekhab", "entekhab.net", "Kurdistani", "ForexFactory", "Telegram", "Discord", "exchange-api",
        "USDT", "USDC", "BTC", "ETH", "XAUT", "PAXG", "BTC1!", "ETH1!", "B-ADJ", "CSV", "PNG", "JSON", "QR", "UTC", "RSI",
        "MACD", "EMA", "SMA", "WMA", "HMA", "VWAP", "ATR", "ADX", "DMI", "CCI", "OBV", "TSI", "PPO", "TRIX", "ALMA",
        "DEMA", "TEMA", "VWMA", "SMMA", "LSMA", "OHLC", "HLC", "Apache-2.0", "IRT", "ECB"]
# (chart types and indicator names — Renko, Kagi, Ichimoku … — are left to each language: platforms write them in
#  their own script in some languages)
FAIL_MAX = 3      # a string that failed its checks this many times stays in English (no endless retries on the quota)
DAILY = int(os.environ.get("PRO_L10N_DAILY", "80"))   # Gemini calls a quota day A KEY at most (the site's own steps come first)
KEEP_RE = [(k, re.compile(r"(?<![A-Za-z0-9_])" + re.escape(k) + r"(?![A-Za-z0-9_])")) for k in sorted(KEEP, key=len, reverse=True)]

# the script a language is written in: a translated string must use it wherever the English has words to translate
SCRIPT = {
    "ru": r"[Ѐ-ӿ]", "uk": r"[Ѐ-ӿ]", "bg": r"[Ѐ-ӿ]", "sr": r"[Ѐ-ӿ]",
    "gr": r"[Ͱ-Ͽ]", "iw": r"[֐-׿]", "ur": r"[؀-ۿ]", "hi": r"[ऀ-ॿ]",
    "bn": r"[ঀ-৿]", "ta": r"[஀-௿]", "te": r"[ఀ-౿]", "th": r"[฀-๿]",
    "jp": r"[぀-ヿ一-鿿]", "kr": r"[가-힯ᄀ-ᇿ]", "cn": r"[一-鿿]",
    "tw": r"[一-鿿]",
}
ARABIC = re.compile(r"[؀-ۿ]")
PH = re.compile(r"\{(\w+)\}")
TAG = re.compile(r"<[^>]+>")

# --------------------------------------------------------------------------------------------- the English source
# The page text is not in English in the template's <head> (it is Persian there): these are its English versions.
SEO_EN = {
    "seo.title": "Live market: multi-chart, replay and price alerts",
    "seo.desc": ("Live crypto charts in your own currency: every Binance coin, up to 16 charts, 17 chart types, 70 "
                 "indicators, bar replay, backtests, price alerts and the economic calendar."),
    "seo.ogt": "Entekhab live market — the crypto analysis desk",
    "seo.ogd": ("Every Binance coin in your own currency; up to 16 charts, 17 chart types, 70 indicators, replay, "
                "backtests, alerts and the economic calendar — free, in 47 languages."),
    "seo.app": "Entekhab live market",
    "seo.noscript": "This workspace needs JavaScript.",
}


def h(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:10]


def ui_strings():
    """S.en of assets/pro/i18n.js, as the browser sees it"""
    code = ("global.window=globalThis;require(process.argv[1]);"
            "process.stdout.write(JSON.stringify(PRO.STR.en))")
    p = subprocess.run(["node", "-e", code, os.path.join(PRO, "i18n.js")], capture_output=True, text=True, check=True)
    return json.loads(p.stdout)


def page_blocks(doc=None):
    """the English page text of market/index.html: heading, the line under it, and each block of the about section"""
    if doc is None:
        doc = open(TEMPLATE, encoding="utf-8").read()
    out = {}
    head = re.search(r'<div class="pm-head">(.*?)</div>', doc, re.S)
    if head:
        m = re.search(r'<h1>.*?<span data-lang="en"[^>]*>(.*?)</span>', head.group(1), re.S)
        if m:
            out["seo.h1"] = m.group(1).strip()
        m = re.search(r'<p>.*?<span data-lang="en"[^>]*>(.*?)</span>', head.group(1), re.S)
        if m:
            out["seo.sub"] = m.group(1).strip()
    sec = re.search(r'<section class="pm-about" data-lang="en"[^>]*>(.*?)</section>', doc, re.S)
    if sec:
        for m in re.finditer(r"<(h2|li|p)>(.*?)</\1>", sec.group(1), re.S):
            t = re.sub(r"\s+", " ", m.group(2)).strip()
            if t:
                out["about." + h(t)] = t
    return out


def about_layout(doc=None):
    """the English about section as a list of (tag, key) and the raw structure, for the page builder"""
    if doc is None:
        doc = open(TEMPLATE, encoding="utf-8").read()
    sec = re.search(r'<section class="pm-about" data-lang="en"[^>]*>(.*?)</section>', doc, re.S)
    return sec.group(1) if sec else ""


def sources(doc=None):
    s = dict(ui_strings())
    s.update(SEO_EN)
    s.update(page_blocks(doc))
    return s


# --------------------------------------------------------------------------------------------- the cache
def cache_path(code):
    return os.path.join(CACHE, code + ".json")


def load(code, fails=False):
    """{key: [hash, text]} (and, with fails=True, also {key: [hash, times it failed]})"""
    try:
        with open(cache_path(code), encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError):
        d = {}
    d = d if isinstance(d, dict) else {}
    s = {k: v for k, v in (d.get("s") or {}).items() if isinstance(v, list) and len(v) == 2 and isinstance(v[1], str)}
    if not fails:
        return s
    f = {k: v for k, v in (d.get("f") or {}).items() if isinstance(v, list) and len(v) == 2 and isinstance(v[1], int)}
    return s, f


def save(code, s, f=None):
    os.makedirs(CACHE, exist_ok=True)
    out = {"lang": code, "s": dict(sorted(s.items()))}
    if f:
        out["f"] = dict(sorted(f.items()))
    with open(cache_path(code), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=0, sort_keys=False)
        fh.write("\n")


def missing(src, s, f=None):
    f = f or {}
    return [k for k, en in src.items() if not (k in s and s[k][0] == h(en)) and not (k in f and f[k][0] == h(en) and f[k][1] >= FAIL_MAX)]


def current(src, s):
    """the translations whose English has not changed since: what a page may use"""
    return {k: s[k][1] for k, en in src.items() if k in s and s[k][0] == h(en)}


# --------------------------------------------------------------------------------------------- checks
def words_to_translate(en):
    """the English words a translation must change: everything but placeholders, tags and protected names"""
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
    if TAG.findall(en) != TAG.findall(tr):
        return "tags"
    for k, rx in KEEP_RE:
        if rx.search(en) and not rx.search(tr):
            return "lost " + k
    if len(tr) > 4 * len(en) + 40:
        return "too long"
    words = words_to_translate(en)
    sc = SCRIPT.get(code)
    if sc and (len(words) >= 2 or any(len(w) >= 5 for w in words)) and not re.search(sc, TAG.sub("", tr)):
        return "wrong script"
    if code not in ("ur",) and ARABIC.search(tr) and not ARABIC.search(en):
        return "arabic letters"
    if not sc and len(words) >= 4 and tr == en.strip():
        return "untranslated"
    return None


# --------------------------------------------------------------------------------------------- Gemini
PROMPT = """You translate the interface of a free crypto trading chart workspace (similar to TradingView) from English into {lang} ({native}){variant}.

Rules:
- Answer with ONE JSON object that has exactly the same keys as the input; each value is the translation of that key's English.
- Keep every placeholder in curly braces exactly as written, e.g. {{n}}, {{s}}, {{c}} — never translate, remove or add one.
- Keep these names and codes exactly as written: {keep}.
- Keep every HTML tag exactly as written, attributes included; translate only the text between tags.
- Use the trading vocabulary that traders and trading platforms use in {lang} (candles, timeframe, indicator, drawing
  tools, stop-loss, take-profit, leverage, backtest, replay, watchlist, order book). Short labels (buttons, menu items)
  stay short. "Toman" is Iran's currency. Write numbers with Western digits (0-9).
- No explanations, no notes, no markdown.

Input:
{payload}"""

VARIANT = {"br": " as written in Brazil", "pt": " as written in Portugal", "cn": " in Simplified Chinese characters",
           "tw": " in Traditional Chinese characters (Taiwan)", "sr": " in the Cyrillic script", "no": " (Bokmål)",
           "fil": " (Filipino / Tagalog)", "ms": " (Bahasa Melayu, Malaysia)", "cat": " (Catalan)"}


def prompt_for(code, batch):
    r = pro_langs.BY[code]
    return PROMPT.format(lang=r["english"], native=r["native"], variant=VARIANT.get(code, ""),
                         keep=", ".join(KEEP), payload=json.dumps(batch, ensure_ascii=False, indent=0))


def batches(keys, src, size, chars=9000):
    """short UI strings together (up to `size` or `chars` of English), the long page blocks in groups of ~2,500
    characters (a long block in Tamil or Telugu is three times the tokens: one answer must fit in 8,192)"""
    cur, n, lim = [], 0, chars
    for k in keys:
        L, kl = len(src[k]), (2500 if k.startswith("about.") else chars)
        if cur and (len(cur) >= size or n + L > lim or kl != lim):
            yield cur
            cur, n = [], 0
        lim = kl
        cur.append(k)
        n += L
    if cur:
        yield cur


def translate_batch(code, keys, src, gen):
    """one request; returns {key: text} of the strings that passed the checks, and the reasons the others did not"""
    batch = {k: src[k] for k in keys}
    ans = gen(prompt_for(code, batch))
    good, bad = {}, {}
    if not isinstance(ans, dict):
        return good, {"*": "not a JSON object"}
    for k in keys:
        if k not in ans:                  # left out (a long answer cut short): asked again, not held against the string
            continue
        why = check(code, src[k], ans.get(k))
        if why:
            bad[k] = why
        else:
            good[k] = ans[k].strip()
    return good, bad


def gemini():
    import ai  # noqa: E402
    if not ai.available():
        return None

    def gen(p):
        # the run's model only (ai.generate_on_model, not ai.generate): a key whose daily quota runs out hands over to
        # the next key, and ai.py's fallback models are left to the site's own steps
        return ai.generate_on_model(p, True, 0.1, 8192, 3, 120)
    return gen


# --------------------------------------------------------------------------------------------- the day's budget
def quota_day(now=None):
    """the Gemini quota day: Google resets the free tier's daily limits at midnight Pacific time"""
    now = time.time() if now is None else now
    try:
        from zoneinfo import ZoneInfo
        import datetime
        return datetime.datetime.fromtimestamp(now, ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")
    except Exception:  # noqa: BLE001  (no time-zone data: UTC-8 is close enough)
        return time.strftime("%Y-%m-%d", time.gmtime(now - 8 * 3600))


def quota_used(day=None):
    """calls this script made in the quota day so far"""
    day = day or quota_day()
    try:
        with open(os.path.join(CACHE, "_quota.json"), encoding="utf-8") as f:
            q = json.load(f)
        return max(0, int(q.get("n", 0))) if q.get("day") == day else 0
    except (OSError, ValueError, TypeError, AttributeError):
        return 0


def quota_add(n, day=None):
    if n <= 0:
        return
    day = day or quota_day()
    total = quota_used(day) + n
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, "_quota.json"), "w", encoding="utf-8") as f:
        json.dump({"day": day, "n": total}, f)
        f.write("\n")


def run(langs, requests_max, seconds, size, gen, src, log=print, counter=None):
    """fill the caches of `langs` in order; returns {code: (done, total)} (and the calls made in counter["used"])"""
    t0, used, quota = time.time(), 0, False
    counter = counter if counter is not None else {}
    counter["used"] = 0
    for code in langs:
        s, f = load(code, fails=True)
        todo = missing(src, s, f)
        if not todo:
            continue
        changed = False
        # page text first: a language's page becomes indexable as soon as its page text is in
        todo.sort(key=lambda k: (not (k.startswith("seo.") or k.startswith("about.")), k))
        for keys in batches(todo, src, size):
            if used >= requests_max or time.time() - t0 > seconds or quota:
                break
            used += 1
            counter["used"] = used
            try:
                good, bad = translate_batch(code, keys, src, gen)
            except Exception as e:  # noqa: BLE001
                name = type(e).__name__
                log(f"{code}: request failed ({name}: {str(e)[:160]})")
                if name == "QuotaError":
                    quota = True
                continue
            for k, v in good.items():
                s[k] = [h(src[k]), v]
                f.pop(k, None)
                changed = True
            for k in bad:
                if k in src:
                    n = f[k][1] + 1 if k in f and f[k][0] == h(src[k]) else 1
                    f[k] = [h(src[k]), n]
                    changed = True
            log(f"{code}: {len(good)}/{len(keys)} kept" + (f"; dropped {dict(list(bad.items())[:6])}" if bad else ""))
        if changed:
            save(code, s, f)
        if used >= requests_max or time.time() - t0 > seconds or quota:
            break
    return status(src)


def plan(langs, src, size, limit):
    """the requests a run would make, in order: (language, the keys of one batch), page text of a language first"""
    items, state = [], {}
    for code in langs:
        s, f = load(code, fails=True)
        state[code] = (s, f)
        todo = missing(src, s, f)
        if not todo:
            continue
        # page text first: a language's page becomes indexable as soon as its page text is in
        todo.sort(key=lambda k: (not (k.startswith("seo.") or k.startswith("about.")), k))
        for keys in batches(todo, src, size):
            items.append((code, keys))
            if len(items) >= limit:
                return items, state
    return items, state


def run_parallel(langs, requests_max, seconds, size, src, pool, log=print, counter=None):
    """run(), but with the owner's keys working at once — one worker a key, each on its own key.

    Each key has its own per-minute and per-day quota, so the workers never queue behind one another. A worker whose
    key runs out of quota puts its batch back for another key and stops. Returns the same status() map as run().
    """
    import ai  # noqa: E402
    t0 = time.time()
    counter = counter if counter is not None else {}
    counter["used"] = 0
    ai.model()                      # resolve the model once, before the workers start (it is looked up over the network)
    items, state = plan(langs, src, size, requests_max)
    if not items:
        return status(src)
    q = queue.Queue()
    for it in items:
        q.put(it)
    lock = threading.Lock()
    changed = set()

    def worker(api_key):
        while time.time() - t0 <= seconds:
            try:
                code, keys = q.get_nowait()
            except queue.Empty:
                return
            with lock:
                counter["used"] += 1
            try:
                good, bad = translate_batch(code, keys, src, lambda p: ai.generate_with(api_key, p, True, 0.1, 8192, 3, 120))
            except Exception as e:  # noqa: BLE001
                name = type(e).__name__
                with lock:
                    log(f"{code}: request failed ({name}: {str(e)[:160]})")
                if name == "QuotaError":
                    q.put((code, keys))     # this key is spent for the run; another one can still do the batch
                    return
                continue
            with lock:
                s, f = state[code]
                for k, v in good.items():
                    s[k] = [h(src[k]), v]
                    f.pop(k, None)
                    changed.add(code)
                for k in bad:
                    if k in src:
                        n = f[k][1] + 1 if k in f and f[k][0] == h(src[k]) else 1
                        f[k] = [h(src[k]), n]
                        changed.add(code)
                log(f"{code}: {len(good)}/{len(keys)} kept" + (f"; dropped {dict(list(bad.items())[:6])}" if bad else ""))

    threads = [threading.Thread(target=worker, args=(k,), daemon=True) for k in pool]
    for th in threads:
        th.start()
    for th in threads:
        th.join(timeout=max(30.0, seconds - (time.time() - t0) + 120))
    for code in sorted(changed):
        s, f = state[code]
        save(code, s, f)
    return status(src)


def status(src):
    out = {}
    for code in pro_langs.NEW:
        s = load(code)
        cur = current(src, s)
        seo = [k for k in src if k.startswith("seo.") or k.startswith("about.")]
        out[code] = {"done": len(cur), "total": len(src), "seo": all(k in cur for k in seo)}
    return out


def main():
    import ai  # noqa: E402
    ap = argparse.ArgumentParser()
    ap.add_argument("--requests", type=int, default=0, help="requests this run (default: 10 a key)")
    ap.add_argument("--seconds", type=int, default=int(os.environ.get("PRO_L10N_SECONDS", "200")))
    ap.add_argument("--batch", type=int, default=120)
    ap.add_argument("--jobs", type=int, default=0, help="requests at once (default: one a key)")
    ap.add_argument("--lang", default="")
    ap.add_argument("--status", action="store_true")
    a = ap.parse_args()
    src = sources()
    if a.status:
        st = status(src)
        for k in PRIORITY:
            print(f"{k:4} {st[k]['done']:4}/{st[k]['total']}  page text {'yes' if st[k]['seo'] else 'no'}")
        done = sum(v["done"] for v in st.values())
        print(f"\n{done} of {len(src) * len(st)} strings in {len(st)} languages; "
              f"complete: {sum(1 for v in st.values() if v['done'] == len(src))}; "
              f"page text ready: {sum(1 for v in st.values() if v['seo'])}")
        return
    gen = gemini()
    if not gen:
        print("pro_l10n: no Gemini key — nothing translated this run (the pages use what the cache has)")
        return
    pool = ai.keys()
    print(f"pro_l10n: {ai.pool_note()}")
    # every key has its own daily quota, so the day's ceiling grows with the pool
    cap = DAILY * len(pool)
    left = cap - quota_used()
    if left <= 0:
        print(f"pro_l10n: today's {cap} Gemini calls ({DAILY} a key) are used; more tomorrow "
              f"(the pages use what the cache has)")
        return
    langs = [x for x in a.lang.split(",") if x] or PRIORITY
    requests_max = min(a.requests or int(os.environ.get("PRO_L10N_REQUESTS", "0")) or 10 * len(pool), left)
    jobs = max(1, min(a.jobs or len(pool), len(pool), requests_max))
    c = {}
    try:
        if jobs > 1:
            st = run_parallel(langs, requests_max, a.seconds, a.batch, src, pool[:jobs], counter=c)
        else:
            st = run(langs, requests_max, a.seconds, a.batch, gen, src, counter=c)
    finally:
        quota_add(c.get("used", 0))
    print(f"pro_l10n: {c.get('used', 0)} Gemini calls this run on {jobs} key(s), {quota_used()} of {cap} today")
    done = sum(v["done"] for v in st.values())
    print(f"pro_l10n: {done} of {len(src) * len(st)} strings translated in {len(st)} languages; "
          f"page text ready in {sum(1 for v in st.values() if v['seo'])}")


if __name__ == "__main__":
    main()
