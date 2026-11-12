#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Arabic (Modern Standard) for entekhab.net, as a layer over the English version of every page.

The site is built in Persian, Sorani and English. Rather than add a fourth copy to forty generators, Arabic is the
English page translated in the browser by assets/ar.js, string by string, from dictionaries this script writes:

  1. after every page is built, read each page's English text (the English copy of a page, data-en labels, English
     attributes) and the English strings of the scripts it runs (the third of each fa/ckb/en triple, with the
     concatenated parts of a sentence turned into {1}, {2}… so "about " + n + " min" becomes "about {1} min");
     numbers in text become {1}, {2}… the same way, so "2,191 transactions" and "16 transactions" share one entry;
  2. translate what data/i18n_ar.json does not have yet (Gemini via scripts/ai.py, or Claude), at most --limit
     strings a run, and keep it there (the cache is committed: a string is translated once);
  3. write i18n/ar/common.json (the menus and footer), i18n/ar/page/<path>.json for each page and i18n/ar/js/<file>.json
     for each script, holding only strings already translated; and i18n/ar/status.json (coverage);
  4. add assets/ar.js to every page (and a two-line head snippet that hides the page until it is translated, so an
     Arabic reader never sees a flash of English).

Not translated, by the owner's choice: the encyclopedia (it stays in its three languages) and posts older than a
month (recent posts get real Arabic pages, /ar/p/<id>/, from scripts/translate.py and build_pages.py).

CLI:  python3 scripts/i18n_ar.py [--limit N] [--no-translate]
"""
import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import re
import sys
import time
from html.parser import HTMLParser

FA = re.compile(r"[پچژگیکۀ\u200c]")   # Persian-only letters: never in an Arabic translation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "i18n_ar.json")
OUT = os.path.join(ROOT, "i18n", "ar")
VER = "3"
SKIP_TOP = {".git", ".github", "ckb", "node_modules", "tts", "data", "i18n", "p", "fonts", "img", "postimg", "scripts", "tests"}
NO_DICT_TOP = {"encyclopedia"}            # the script still goes in, to say the page stays in its three languages
AR = re.compile(r"[؀-ۿ]")
LAT = re.compile(r"[A-Za-z]")
NUM = re.compile(r"(?<![A-Za-z{])\d[\d,]*(?:\.\d+)?")
VOID = {"br", "img", "input", "meta", "link", "hr", "source", "wbr", "area", "col", "embed", "param", "track", "base"}


def norm(s):
    return re.sub(r"\s+", " ", s or "").strip()


def numkey(s):
    """numbers -> {1}, {2}…  (the browser does the same before it looks a string up)"""
    n = [0]

    def f(m):
        n[0] += 1
        return "{%d}" % n[0]
    return NUM.sub(f, s)


def worth(s):
    """English worth translating: has a word, no Arabic script, is not a ticker, a colour, a path or code"""
    if not s or len(s) > 4000 or AR.search(s) or not re.search(r"[A-Za-z]{2,}", s):
        return False
    if re.fullmatch(r"[A-Z0-9/_.\-+:%$ ]{1,12}", s):                     # BTC, ETH/USDT, 1D, 24H
        return False
    if re.match(r"^(#|\.|/|https?:|www\.|<|\{|\[|data:|rgba?\(|var\()", s) or re.search(r"[<>]|=\"|\(\)|=>|;\s*$", s):
        return False
    if re.fullmatch(r"[\w.-]+\.(js|css|json|webp|png|svg|html)(\?.*)?", s):
        return False
    return True


# ------------------------------------------------------------------ JavaScript: the English of each fa/ckb/en triple
def tokens(src):
    """literals, brackets, commas, plus signs and colons, skipping comments and regex literals"""
    out, i, n, prev = [], 0, len(src), ""
    while i < n:
        c = src[i]
        if c in "'\"`":
            q, j, buf = c, i + 1, []
            while j < n and src[j] != q:
                if src[j] == "\\" and j + 1 < n:
                    nx = src[j + 1]
                    buf.append({"n": "\n", "t": "\t", "'": "'", '"': '"', "`": "`", "\\": "\\"}.get(nx, nx if nx not in "u x" else "\\" + nx))
                    j += 2
                    continue
                if q == "`" and src[j] == "$" and j + 1 < n and src[j + 1] == "{":
                    d, j = 1, j + 2
                    while j < n and d:
                        d += {"{": 1, "}": -1}.get(src[j], 0)
                        j += 1
                    buf.append("\x00")
                    continue
                buf.append(src[j])
                j += 1
            out.append(("s", "".join(buf)))
            i, prev = j + 1, "s"
            continue
        if src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if c == "/" and prev in "(,=:[!&|?{};+-*%<>~^" + "":
            j = i + 1
            while j < n and src[j] not in "/\n":
                if src[j] == "\\":
                    j += 1
                elif src[j] == "[":
                    while j < n and src[j] != "]":
                        j += 2 if src[j] == "\\" else 1
                j += 1
            i, prev = j + 1, "r"
            continue
        if c in "()[]{},+:?":
            out.append((c, c))
            prev = c
        elif not c.isspace():
            j = i
            while j < n and (src[j].isalnum() or src[j] in "_$."):
                j += 1
            if j > i:
                out.append(("w", src[i:j]))
                i, prev = j, "w"
                continue
            out.append(("o", c))
            prev = c
        i += 1
    return out


def template(arg):
    """an argument (a list of tokens) as text: literals kept, everything else {1}, {2}…"""
    if len(arg) > 1 and arg[0][0] in "ws" and arg[1][0] == ":":
        arg = arg[2:]
    parts, cur, depth = [], [], 0
    for t in arg:
        if t[0] in "([{":
            depth += 1
        elif t[0] in ")]}":
            depth -= 1
        if t[0] == "+" and depth == 0:
            parts.append(cur)
            cur = []
        else:
            cur.append(t)
    parts.append(cur)
    pieces, lit = [], False
    for p in parts:
        if len(p) == 1 and p[0][0] == "s":
            for i, seg in enumerate(p[0][1].split("\x00")):
                if i:
                    pieces.append(None)
                pieces.append(seg)
            lit = True
        elif p:
            pieces.append(None)
    if not lit:
        return None
    out, k = "", 0
    for x in pieces:
        if x is None:
            k += 1
            out += "{%d}" % k
        else:
            out += x
    return out


def js_strings(src):
    """the English of every fa/ckb/en triple: three neighbouring items (call arguments, array items, object values)
    of which the first two are in Arabic script and the third is English; en: values; and every value of an
    en: {...} table (pages that keep one dictionary per language)"""
    toks, res = tokens(src), set()
    stack = []                                  # frames: {"items": [[tokens]...], "en": bool}
    hist = []
    for t in toks:
        hist = (hist + [t])[-5:]
        if t[0] in "([{":
            par = stack[-1]["items"][-1] if stack else []
            near = any((h[0] == "w" and (h[1] == "en" or h[1].endswith(".en"))) or (h[0] == "s" and h[1] == "en") for h in hist[-5:-1])
            en = t[0] in "{[" and ((len(par) == 2 and par[0][0] in "ws" and par[0][1] == "en" and par[1][0] == ":") or near)
            stack.append({"items": [[]], "en": en or (t[0] in "{[" and bool(stack) and stack[-1]["en"])})
            continue
        if t[0] in ")]}":
            if not stack:
                continue
            fr = stack.pop()
            items = fr["items"]
            if items and not items[-1]:
                items.pop()
            for i in range(len(items)):
                it = items[i]
                key = it[0][1] if len(it) > 1 and it[0][0] in "ws" and it[1][0] == ":" else None
                if fr["en"]:
                    tp = template(it)
                    if tp:
                        res.add(tp)
                elif key == "en":
                    tp = template(it)
                    if tp:
                        res.add(tp)
                elif i >= 2 and key is None:
                    a, b = items[i - 2], items[i - 1]
                    if any(x[0] == "s" and AR.search(x[1]) for x in a) and any(x[0] == "s" and AR.search(x[1]) for x in b) \
                            and not any(x[0] == "s" and AR.search(x[1]) for x in it):
                        tp = template(it)
                        if tp:
                            res.add(tp)
            if stack:
                stack[-1]["items"][-1].append(("x", ""))
            continue
        if not stack:
            continue
        if t[0] == ",":
            stack[-1]["items"].append([])
        else:
            stack[-1]["items"][-1].append(t)
    out = set()
    for s in res:
        for piece in re.split(r"<[^>]*>", s):           # a sentence wrapped in markup: its text pieces
            piece = norm(piece)
            bare = re.sub(r"\{\d+\}", "", piece)
            if worth(bare) and re.search(r"[A-Za-z]{2,}", bare):
                out.add(renum(piece))
    return out


EDGE = re.compile(r"^[^A-Za-z0-9{$£€]+|[\s:·↗↓→←…]+$")


def variants(k):
    """the same text as the browser may also meet it: without a leading emoji/bullet, and each part of "a · b" """
    out = {k}
    core = EDGE.sub("", k)
    if core and core != k and worth(core):
        out.add(renum(core))
    for part in k.split(" · "):
        part = EDGE.sub("", part.strip())
        if part and part != k and worth(part) and re.search(r"[A-Za-z]{2,}", part):
            out.add(renum(part))
    return out


def renum(s):
    """{3} {7} -> {1} {2}, and digits -> placeholders too, so keys match what the browser computes"""
    k = [0]

    def f(m):
        k[0] += 1
        return "{%d}" % k[0]
    return re.sub(r"\{\d+\}|\{[A-Za-z_]\w*\}|" + NUM.pattern, f, s)


# ------------------------------------------------------------------ HTML: the English of each page
class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.st, self.base, self.skip, self.out, self.scripts, self.inline = [], False, 0, set(), [], []
        self.title = None
        self._t = False

    def en(self):
        for _, e, _ in reversed(self.st):
            if e is not None:
                return e
        return self.base

    def handle_starttag(self, tag, a):
        a = {k: (v or "") for k, v in a}
        if tag == "html":
            self.base = a.get("lang", "") in ("en", "ar")
            return
        e = None
        for k in ("lang", "data-lang", "data-rl"):
            if a.get(k):
                e = a[k] in ("en", "ar")
        if tag == "script" and a.get("src"):
            self.scripts.append(a["src"].split("?")[0])
        for k in ("data-en", "data-aen"):
            if worth(norm(a.get(k, ""))):
                self.out.add(numkey(norm(a[k])))
        if (e if e is not None else self.en()):
            for k in ("placeholder", "title", "aria-label", "alt"):
                v = norm(a.get(k, ""))
                if worth(v):
                    self.out.add(numkey(v))
        if tag == "title":
            self._t = True
        if tag in VOID:
            return
        sk = tag in ("script", "style", "code", "pre", "svg", "noscript", "textarea", "kbd")
        self.st.append((tag, e, sk))
        if sk:
            self.skip += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self._t = False
        for i in range(len(self.st) - 1, -1, -1):
            if self.st[i][0] == tag:
                for _, _, sk in self.st[i:]:
                    if sk:
                        self.skip -= 1
                del self.st[i:]
                return

    def handle_data(self, d):
        if self.st and self.st[-1][0] == "script":
            self.inline.append(d)
            return
        if self._t:
            self.title = norm(d)
        if self.skip or not self.en():
            return
        t = norm(d)
        if worth(t):
            self.out.add(numkey(t))


def walk():
    for dp, dns, fns in os.walk(ROOT):
        rel = os.path.relpath(dp, ROOT)
        parts = rel.split(os.sep)
        if parts[0] in SKIP_TOP or (parts[0] == "en" and len(parts) > 1 and parts[1] == "p"):
            dns[:] = []
            continue
        for f in fns:
            if f.endswith(".html"):
                yield os.path.join(dp, f)


def walk_all():
    """every page the visitor can open, for the script tag (posts and the encyclopedia included)"""
    for dp, dns, fns in os.walk(ROOT):
        top = os.path.relpath(dp, ROOT).split(os.sep)[0]
        if top in {".git", ".github", "node_modules", "tts", "data", "i18n", "scripts", "tests", "fonts"}:
            dns[:] = []
            continue
        for f in fns:
            if f.endswith(".html"):
                yield os.path.join(dp, f)


def page_key(path):
    """the dictionary file of a page: from its URL path, as assets/ar.js computes it"""
    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
    u = "/" + rel
    if u.endswith("/index.html"):
        u = u[: -len("index.html")]
    elif u.endswith(".html"):
        u = u[:-5]
    return keyname(u)


def keyname(u):
    u = u.strip("/") or "home"
    return re.sub(r"[^a-z0-9_-]+", "_", u.lower())[:120]


# ------------------------------------------------------------------ translation
PROMPT = """You translate the interface and articles of entekhab.net, a Persian/Kurdish crypto-market education site (prices,
charts, Bitcoin history, trading lessons, on-chain data), from English into Modern Standard Arabic (فصحى), for readers
across the Arab world.

Rules:
- Return ONLY a JSON array of strings, the same length and order as the input array.
- Keep every placeholder like {1}, {2} exactly as written (you may move it to where Arabic grammar needs it).
- Keep untranslated: tickers and symbols (BTC, ETH, USDT, sat/vB, vB, MvB, WU, kB, MB, %, $), numbers, URLs, code,
  brand and product names (entekhab.net, Coin_Kurd, Telegram, TradingView, Binance, mempool.space, Bitcoin Core, OKX,
  Bybit, Gemini, Claude), people's names in Latin script may be written in Arabic letters.
- Use standard Arabic crypto terms: بيتكوين، سلسلة الكتل، كتلة، معاملة، رسوم، محفظة، تعدين، المُعدِّن، الشموع اليابانية،
  مؤشر، اتجاه، دعم، مقاومة، رافعة مالية، عقود دائمة.
- Short interface labels stay short (a button stays one or two words). Keep the tone neutral and clear.
- Do not add explanations, quotes or notes.

Input:
"""


def translate_batch(batch, engine):
    import ai  # noqa: E402  (scripts/ai.py)
    prompt = PROMPT + json.dumps(batch, ensure_ascii=False)
    for attempt in range(3):
        try:
            if engine == "gemini":
                out = ai.generate(prompt, as_json=True, temperature=0.1, max_tokens=8192)
            else:
                out = claude(prompt)
            if isinstance(out, str):
                out = json.loads(re.search(r"\[.*\]", out, re.S).group(0))
            if not isinstance(out, list) or len(out) != len(batch):
                raise ValueError("length %s vs %d" % (len(out) if isinstance(out, list) else "?", len(batch)))
            res = {}
            for src, ar in zip(batch, out):
                ar = norm(str(ar))
                if FA.search(ar) and len(FA.findall(ar)) > max(1, len(re.findall(r"[يكةىإأؤئ]", ar)) // 12):
                    continue                                    # Persian echoed back, not Arabic: next run retries it
                ar = ar.replace("ی", "ي").replace("ک", "ك").replace("ۀ", "ة").replace("\u200c", " ")
                if not ar or set(re.findall(r"\{\d+\}", src)) != set(re.findall(r"\{\d+\}", ar)):
                    continue                                    # a placeholder lost: leave this one for the next run
                if not AR.search(ar) and AR.search(ar) is None and re.search(r"[A-Za-z]{4,}", src) and src.lower() == ar.lower():
                    res[src] = ar                               # a name kept as it is
                    continue
                res[src] = ar
            return res
        except Exception as e:  # noqa: BLE001
            print(f"  batch failed ({attempt + 1}/3): {str(e)[:160]}", file=sys.stderr)
            if "quota" in str(e).lower() or "429" in str(e):
                time.sleep(20)
    return {}


def claude(prompt):
    import requests
    import translate as T  # noqa: E402
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    r = requests.post("https://api.anthropic.com/v1/messages", timeout=180,
                      headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                      json={"model": T.claude_model(key), "max_tokens": 8000, "messages": [{"role": "user", "content": prompt}]})
    r.raise_for_status()
    return "".join(b.get("text", "") for b in r.json().get("content", []))


def engine():
    gen = os.environ.get("COIN_KURD_API_KEY", "").strip()
    if gen.startswith("sk-ant-"):
        os.environ.setdefault("ANTHROPIC_API_KEY", gen)
    try:
        import ai  # noqa: E402
        if ai.available():
            return "gemini"
    except Exception:  # noqa: BLE001
        pass
    return "claude" if os.environ.get("ANTHROPIC_API_KEY", "").strip() else None


# ------------------------------------------------------------------ the head snippet and the script tag
HEAD = ('<script id="ek-ar-h">try{if(localStorage.getItem("ek_ar")==="1"&&!/^\\/encyclopedia\\//.test(location.pathname)){'
        'var h=document.documentElement;h.classList.add("ek-ar","ek-ar-wait");h.dir="rtl";'
        'setTimeout(function(){h.classList.remove("ek-ar-wait")},2600)}}catch(e){}</script>'
        '<style id="ek-ar-s">html.ek-ar-wait body{opacity:0!important}</style>')
TAG = f'<script src="/assets/ar.js?v={VER}" defer></script>'


def inject(path):
    s = open(path, encoding="utf-8").read()
    if 'id="ek-ar-h"' in s:
        s = re.sub(r'<script id="ek-ar-h">.*?</script><style id="ek-ar-s">.*?</style>', lambda m: HEAD, s, count=1, flags=re.S)
    else:
        s = re.sub(r"(<head[^>]*>)", lambda m: m.group(1) + HEAD, s, count=1)
    s = re.sub(r'<script src="/assets/ar\.js\?v=\w+" defer></script>', "", s)
    s = s.replace("</body>", TAG + "</body>", 1) if "</body>" in s else s + TAG
    open(path, "w", encoding="utf-8").write(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=int(os.environ.get("AR_LIMIT", "1800")))
    ap.add_argument("--no-translate", action="store_true")
    ap.add_argument("--no-inject", action="store_true", help="dictionaries only (local checks)")
    args = ap.parse_args()
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}

    pages, js_used = {}, set()
    for path in walk():
        top = os.path.relpath(path, ROOT).split(os.sep)[0]
        if top in NO_DICT_TOP:
            continue
        p = Page()
        try:
            p.feed(open(path, encoding="utf-8").read())
        except Exception as e:  # noqa: BLE001
            print("skip", path, e, file=sys.stderr)
            continue
        keys = set(p.out)
        for code in p.inline:
            keys |= js_strings(code)
        if p.title and (p.base) and worth(p.title):
            keys.add(numkey(p.title))
        pages[path] = set().union(*(variants(k) for k in keys)) if keys else keys
        js_used |= {s for s in p.scripts if s.startswith("/assets/") and s.endswith(".js")}

    scripts = {}
    for f in sorted(os.listdir(os.path.join(ROOT, "assets"))):
        if f.endswith(".js") and f != "ar.js" and not f.endswith(".min.js"):
            try:
                ks = js_strings(open(os.path.join(ROOT, "assets", f), encoding="utf-8").read())
                scripts[f] = set().union(*(variants(k) for k in ks)) if ks else ks
            except Exception as e:  # noqa: BLE001
                print("skip js", f, e, file=sys.stderr)

    feed, free = set(), {}
    try:
        import datetime as dt
        cut = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=3)).isoformat()
        news = json.load(open(os.path.join(ROOT, "data", "news.json"), encoding="utf-8"))
        news = news.get("items", news) if isinstance(news, dict) else news
        for it in sorted(news, key=lambda x: x.get("date") or "", reverse=True)[:250]:
            t = norm(it.get("title") or "")
            if (it.get("date") or "") >= cut and worth(t):
                feed.add(numkey(t))
        for p in json.load(open(os.path.join(ROOT, "data", "posts.json"), encoding="utf-8")):
            tr = p.get("tr") or {}
            en, ar = norm((tr.get("en") or {}).get("title") or ""), norm((tr.get("ar") or {}).get("title") or "")
            if en and ar and worth(en):
                free[numkey(en)] = ar
    except Exception as e:  # noqa: BLE001
        print("feed:", e, file=sys.stderr)
    for k, v in free.items():
        if k not in cache and set(re.findall(r"\{\d+\}", k)) == set(re.findall(r"\{\d+\}", numkey(v))):
            cache[k] = numkey(v)
    feed |= set(free)

    # the menus, footer and tab bar: strings found on (nearly) every page
    from collections import Counter
    cnt = Counter(k for ks in pages.values() for k in ks)
    common = {k for k, c in cnt.items() if c >= max(3, len(pages) * 0.6)}

    need = set().union(*pages.values()) if pages else set()
    for v in scripts.values():
        need |= v
    need |= feed
    todo = sorted(k for k in need if k not in cache)
    print(f"pages {len(pages)} · scripts {sum(1 for v in scripts.values() if v)} · strings {len(need)} · cached {len(need) - len(todo)} · new {len(todo)}")

    eng = None if args.no_translate else engine()
    if todo and eng:
        todo = sorted(todo, key=lambda k: (k not in common, k in feed, -cnt.get(k, 0), len(k)))[: args.limit]
        batches, cur, size = [], [], 0
        for k in todo:
            if cur and (len(cur) >= 60 or size + len(k) > 6000):
                batches.append(cur)
                cur, size = [], 0
            cur.append(k)
            size += len(k)
        if cur:
            batches.append(cur)
        print(f"translating {len(todo)} strings in {len(batches)} batches with {eng}")
        workers = 1 if eng == "gemini" else 4
        done = 0
        with cf.ThreadPoolExecutor(workers) as ex:
            for res in ex.map(lambda b: translate_batch(b, eng), batches):
                cache.update(res)
                done += len(res)
                if done and done % 600 < 60:
                    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        print(f"translated {done}")
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    elif todo:
        print("no translation engine (or --no-translate): the new strings wait for the next run")

    # dictionaries: only what is translated
    import shutil
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "page"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "js"), exist_ok=True)

    def dump(rel, keys):
        d = {k: cache[k] for k in sorted(keys) if k in cache}
        with open(os.path.join(OUT, rel), "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
        return len(d)

    dump("common.json", common)
    dump("feed.json", feed)
    have = tot = 0
    for path, keys in pages.items():
        own = keys - common
        if own:
            dump(os.path.join("page", page_key(path) + ".json"), own)
        tot += len(keys)
        have += sum(1 for k in keys if k in cache)
    for f, keys in scripts.items():
        if keys:
            dump(os.path.join("js", f[:-3] + ".json"), keys)
            tot += len(keys)
            have += sum(1 for k in keys if k in cache)
    cov = round(have / tot * 100, 1) if tot else 0
    json.dump({"coverage": cov, "strings": len(need), "translated": sum(1 for k in need if k in cache),
               "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, open(os.path.join(OUT, "status.json"), "w"))
    print(f"coverage {cov}% ({have}/{tot} page-string uses)")

    n = 0
    for path in ([] if args.no_inject else walk_all()):
        inject(path)
        n += 1
    print(f"ar.js added to {n} pages")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
