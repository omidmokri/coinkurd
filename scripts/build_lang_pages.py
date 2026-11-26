#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The site's main pages at their own address in every one of its languages: /<code>/<page>/.

Until now a reader who picked German from the globe got German on the Persian page's own address: the text is
swapped in the browser (assets/i18n.js), so a search engine only ever saw one language. This step gives each
language its own copy of the main pages, so each can be found, shared and indexed on its own:

  /<code>/index.html, /<code>/<page>/index.html   for every code in scripts/pro_langs.py except fa (the original),
                                                  that is Kurdish (Sorani ckb, Kurmanji kmr), Arabic, English and
                                                  the rest of the site's languages
  /sitemap-langs.xml                              the copies that are ready for search engines
  hreflang links on the originals and the copies  every ready language, x-default = the original

A copy is the built page itself, so it looks and works exactly like the original (the owner's rule: the design does
not change), with these differences only:
  * <html lang dir> of the language, its own title, description, canonical address and social-card text;
  * a small script first in <head> that opens the page in that language for this visit (the same keys the language
    switch sets), and that sends a switch to another language to that language's own address;
  * links between main pages stay inside the language (/de/heatmap/ → /de/etf/), relative addresses made absolute.

A language is ready for search engines when it is one of the site's own (ckb, ar, en) or the globe offers it
(i18n/langs.json, built by scripts/i18n_site.py at 70%). Until then its copies work, in English where a string is not
translated yet, but say noindex and stay out of hreflang and the sitemap. As translations are added the next build
lists them, with nothing to change here.

/market/ is not copied: it has its own pages per language (scripts/build_market_l10n.py, /market/<code>/), and the
copies link to those.

Run after every other page builder and the SEO steps (search index, titles, structured data), so the copies are
neither in the site search nor trimmed twice; before the leak guard. Built, never committed (.gitignore).
Run: python3 scripts/build_lang_pages.py [root]      Test: python3 tests/test_lang_pages.py
"""
import html
import json
import os
import re
import sys
from urllib.parse import urljoin

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pro_langs  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://entekhab.net"

# The main pages, in the menu's order. Each copy is a full page (100-330 KB), so the list is kept to the pages a
# reader from abroad looks for first: 26 pages × 50 languages ≈ 1,300 files.
CORE = ["/", "/indicators/", "/fear-greed/", "/heatmap/", "/bubbles/", "/liquidity/", "/charts/liquidation-heatmap/",
        "/etf/", "/money-flow/", "/coins/", "/derivatives/", "/world/", "/onchain/", "/track-record/", "/reality/",
        "/today/", "/calendar/", "/dca/", "/compare/", "/swap/", "/bitcoin/", "/safety/", "/tools/", "/app/",
        "/about/", "/podcast/"]
MARKET = "/market/"
OWN = ("fa", "ckb", "ar", "en")               # the site's own four; fa is the original
HOME_DESC = ("What is the real state of the market and where is money moving?",
             "Channel posts and scanner patterns against random hours — even when the result does not flatter us.")
MARK = "<!--ek:lp-->"                          # the hreflang block this step writes, so a rerun replaces it
MARK_RE = re.compile(re.escape(MARK) + r".*?" + re.escape(MARK.replace("ek:", "/ek:")), re.S)
ALT_RE = re.compile(r'<link rel="alternate" hreflang="[^"]*" href="[^"]*">')
LD_CRUMBS_RE = re.compile(r'<script type=["\']application/ld\+json["\']>(?:(?!</script>).)*?BreadcrumbList(?:(?!</script>).)*?</script>', re.S)


def esc(s):
    return html.escape(s or "", quote=True)


def sj(o):
    return json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def codes():
    """every language the site offers except the original Persian, Kurdish first as in the menu"""
    return [c for c in pro_langs.BY if c != "fa"]


def src_file(root, path):
    return os.path.join(root, "index.html") if path == "/" else os.path.join(root, path.strip("/"), "index.html")


def lang_path(code, path):
    if code == "fa":
        return path
    if path == MARKET:
        return MARKET if code in OWN else MARKET + code + "/"
    return "/" + code + path


def ready_codes(root):
    """the site's own languages plus every language the globe offers (translated far enough to read)"""
    ready = {"ckb", "ar", "en"}
    try:
        with open(os.path.join(root, "i18n", "langs.json"), encoding="utf-8") as f:
            ready |= {r["code"] for r in json.load(f).get("ready", []) if r.get("code") in pro_langs.BY}
    except (OSError, ValueError):
        pass
    return ready


def market_ready(root):
    """/market/<code>/ pages that are open to search engines (build_market_l10n leaves the others noindex)"""
    out = set()
    for c in pro_langs.BY:
        f = os.path.join(root, "market", c, "index.html")
        if c not in OWN and os.path.isfile(f):
            with open(f, encoding="utf-8") as fh:
                head = fh.read(6000)
            if "noindex" not in head:
                out.add(c)
    return out


# ------------------------------------------------------------------ titles and descriptions in each language
def load_dicts(root):
    """English → translation, per language: the committed caches (data/i18n/<code>.json, data/i18n_ar.json)"""
    D = {}
    for c in pro_langs.BY:
        if c in ("fa", "ckb", "en"):
            continue
        f = os.path.join(root, "data", "i18n_ar.json") if c == "ar" else os.path.join(root, "data", "i18n", c + ".json")
        try:
            with open(f, encoding="utf-8") as fh:
                j = json.load(fh)
            D[c] = j.get("s", j) if isinstance(j, dict) else {}
        except (OSError, ValueError):
            D[c] = {}
    return D


def nav_texts():
    """path → {fa, ckb, en} title and description, from the site menu (scripts/chrome.py)"""
    import chrome  # noqa: E402  (imported here: it is heavy and the test does not need it)
    out = {}
    for g in chrome.NAV:
        for it in g["items"]:
            p = it[0].split("#")[0]
            if p not in out:
                out[p] = (it[2], it[3])
    return out


def home_texts(root):
    """the homepage's own title per language (its script's docTitle) and the English of the two lines used as its
       description, with their Kurdish from the same dictionary"""
    with open(src_file(root, "/"), encoding="utf-8") as f:
        h = f.read()
    t = re.findall(r"docTitle:'((?:[^'\\]|\\.)*)'", h)
    title = dict(zip(("fa", "ckb", "en"), t)) if len(t) >= 3 else {}
    desc = {"en": " ".join(HOME_DESC)}
    ck = []
    for s in HOME_DESC:
        m = re.search(r"(\w+):'" + re.escape(s.replace("'", "\\'")) + "'", h)
        v = re.findall(r"\b" + m.group(1) + r":'((?:[^'\\]|\\.)*)'", h) if m else []
        ck.append(v[1] if len(v) >= 3 else "")
    if all(ck):
        desc["ckb"] = " ".join(ck)
    return title, desc


def tr(D, code, en):
    """one English string in a language: the site's own Kurdish/English as given, others from the dictionary"""
    if not en:
        return ""
    if code == "en":
        return en
    return D.get(code, {}).get(en) or en


def texts_for(code, path, D, nav, home):
    """(title, description) of one page in one language"""
    if path == "/":
        title, desc = home
        if code in ("ckb",):
            return title.get("ckb") or title.get("en", ""), desc.get("ckb") or desc["en"]
        t = tr(D, code, title.get("en", ""))
        d = " ".join(tr(D, code, s) for s in HOME_DESC)
        return t, d
    ti, de = nav.get(path, ({}, {}))
    if code == "ckb":
        t, d = ti.get("ckb") or ti.get("en", ""), de.get("ckb") or de.get("en", "")
    else:
        t, d = tr(D, code, ti.get("en", "")), tr(D, code, de.get("en", ""))
    return (t + " | entekhab.net") if t else "entekhab.net", d


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


# ------------------------------------------------------------------ the page itself
def alt_links(path, ready, mready):
    """hreflang links of one page: the original (fa, x-default) and every ready language"""
    rows = [("x-default", SITE + path), ("fa", SITE + path)]
    for c in codes():
        if path == MARKET:
            continue
        if c in ready:
            rows.append((pro_langs.BY[c]["hreflang"], SITE + lang_path(c, path)))
    return MARK + "".join(f'<link rel="alternate" hreflang="{esc(h)}" href="{esc(u)}">' for h, u in rows) + MARK.replace("ek:", "/ek:")


def boot(code, path, ready):
    """the first script of a copy (and of an original): open this language, and send a switch to the chosen
       language's own address; the alt map holds every language, ready or not, so no choice ever lands back here"""
    alt = {c: lang_path(c, path) for c in pro_langs.BY}
    cfg = {"c": code, "src": path, "alt": alt}
    keys = ""
    if code != "fa":
        keys = ("var l=E.c,s=localStorage;"
                "if(l==='ar'){s.setItem('ek_ar','1');s.removeItem('ek_l');s.setItem('ck_lang','en')}"
                "else if(l==='ckb'||l==='en'){s.removeItem('ek_ar');s.removeItem('ek_l');s.setItem('ck_lang',l)}"
                "else{s.removeItem('ek_ar');s.setItem('ek_l',l);s.setItem('ck_lang','en')}")
    return ("<script id=\"ek-lp\">(function(){var E=window.EKLP=" + sj(cfg) + ";"
            "try{" + keys + "}catch(e){}"
            "function set(l){try{var s=localStorage;"
            "if(l==='ar'){s.setItem('ek_ar','1');s.removeItem('ek_l');s.setItem('ck_lang','en')}"
            "else if(l==='fa'||l==='ckb'||l==='en'){s.removeItem('ek_ar');s.removeItem('ek_l');s.setItem('ck_lang',l)}"
            "else{s.removeItem('ek_ar');s.setItem('ek_l',l);s.setItem('ck_lang','en')}}catch(e){}}"
            "document.addEventListener('click',function(ev){var t=ev.target&&ev.target.closest&&ev.target.closest("
            "'#langs button[data-l],.ek-lang button[data-l],.lsw button[data-l],.ekw-wrap button[data-code],.ekw-wrap [data-back]');"
            "if(!t)return;"
            # the globe's "back" button returns to the site's own languages, which the globe left in English
            "var l=t.hasAttribute('data-back')?'en':(t.getAttribute('data-l')||t.getAttribute('data-code')),to=E.alt[l];"
            "if(!to||to===location.pathname)return;ev.preventDefault();ev.stopImmediatePropagation();set(l);"
            "location.href=to+location.hash},true)})();</script>")


def absolutize(h, path):
    """relative href/src/action → absolute against the original's address (a copy sits one folder deeper)"""
    base = SITE + path

    def fix(m):
        attr, q, url = m.group(1), m.group(2), m.group(3)
        if not url or re.match(r"^(?:[a-z][a-z0-9+.-]*:|/|#|\{|\$|%)", url, re.I):
            return m.group(0)
        return attr + "=" + q + urljoin(base, url)[len(SITE):] + q
    return re.sub(r"\b(href|src|action|poster)=([\"'])([^\"'<>]*)\2", fix, h)


def relink(h, code, core):
    """links between main pages stay in the language"""
    def fix(m):
        url = m.group(2)
        p, frag = (url.split("#", 1) + [""])[:2]
        if p in core or p == MARKET:
            return m.group(1) + lang_path(code, p) + ("#" + frag if frag else "") + m.group(3)
        return m.group(0)
    return re.sub(r'(<a\b[^>]*?\bhref=")(/[^"#?]*(?:#[^"]*)?)(")', fix, h)


def root_names(root):
    """what sits at the site's root (folders and files), the language copies left out"""
    skip = set(codes())
    return {n for n in os.listdir(root) if n not in skip and not n.startswith(".")}


SCRIPT_RE = re.compile(r"(<script\b(?![^>]*\bsrc=)[^>]*>)(.*?)(</script>)", re.S | re.I)
QREL_RE = re.compile(r"(?<=[`'\"])([a-z0-9][a-z0-9_.-]*)((?:/|\?)[^`'\"\s<>\\]*)?(?=[`'\"])", re.I)


def rootify(h, code, names, core):
    """The home page is the only main page whose own scripts use addresses relative to the root ('data/x.json',
       'coins/btc/'). From /<code>/ they would point inside the copy, so in its inline scripts every such address
       becomes the same address from the root (main pages: their copy in this language). Only strings whose first
       part is something that really sits at the root are touched, so text and other strings stay as they are."""
    def fix_str(m):
        first, rest = m.group(1), m.group(2) or ""
        if first not in names or (not rest and "." not in first):
            return m.group(0)
        url = "/" + first + rest
        p = url.split("?", 1)[0].split("#", 1)[0]
        if p in core and p == url:
            return lang_path(code, p)
        return url

    def fix_script(m):
        return m.group(1) + QREL_RE.sub(fix_str, m.group(2)) + m.group(3)
    return SCRIPT_RE.sub(fix_script, h)


def set_head(h, code, path, title, desc, url, index):
    r = pro_langs.BY[code]
    h = re.sub(r"<html\b[^>]*>", f'<html lang="{esc(r["hreflang"])}" dir="{esc(r["dir"])}" data-lp="{esc(code)}">', h, count=1)
    h = re.sub(r"<title>.*?</title>", "<title>" + esc(clip(title, 60)) + "</title>", h, count=1, flags=re.S)
    for pat, val in ((r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(clip(desc, 160))}">'),
                     (r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{esc(title)}">'),
                     (r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{esc(desc)}">'),
                     (r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{esc(url)}">'),
                     (r'<meta name="twitter:title" content="[^"]*">', f'<meta name="twitter:title" content="{esc(title)}">'),
                     (r'<meta name="twitter:description" content="[^"]*">', f'<meta name="twitter:description" content="{esc(desc)}">'),
                     (r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{esc(url)}">')):
        h = re.sub(pat, lambda _m, v=val: v, h, count=1)
    h = re.sub(r'<meta name="robots" content="[^"]*">', "", h)
    if not index:
        h = h.replace("</title>", '</title><meta name="robots" content="noindex,follow">', 1)
    h = LD_CRUMBS_RE.sub("", h)                 # its breadcrumb names are the original's Persian
    return h


CHARSET_RE = re.compile(r"<meta\s+charset=[\"']?[\w-]+[\"']?\s*/?>", re.I)


def put_head_start(h, snippet):
    """the snippet first in <head>, before the pages' own head scripts; the charset line moves in front of it, so it
       stays inside the first 1,024 bytes where browsers look for it"""
    m = re.search(r"<head\b[^>]*>", h)
    if not m:
        return snippet + h
    cs = CHARSET_RE.search(h, m.end())
    meta = ""
    if cs and cs.start() < m.end() + 6000:
        meta = cs.group(0)
        h = h[: cs.start()] + h[cs.end():]
    return h[: m.end()] + meta + snippet + h[m.end():]


def put_alts(h, block):
    h = MARK_RE.sub("", h)
    h = ALT_RE.sub("", h)
    return h.replace("</head>", block + "</head>", 1)


def copy_page(src_html, code, path, title, desc, ready, mready, core, names=()):
    url = SITE + lang_path(code, path)
    h = re.sub(r'<script id="ek-lp">.*?</script>', "", src_html, flags=re.S)
    h = MARK_RE.sub("", h)
    h = absolutize(h, path)
    h = relink(h, code, core)
    if path == "/":
        h = rootify(h, code, names, core)
    h = set_head(h, code, path, title, desc, url, code in ready)
    h = put_alts(h, alt_links(path, ready, mready))
    return put_head_start(h, boot(code, path, ready))


def mark_original(src_html, path, ready, mready):
    """the original carries the same hreflang links (they must point both ways) and the switch script"""
    h = re.sub(r'<script id="ek-lp">.*?</script>', "", src_html, flags=re.S)
    h = put_alts(h, alt_links(path, ready, mready))
    return put_head_start(h, boot("fa", path, ready))


def sitemap(rows):
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    out += [f"<url><loc>{esc(u)}</loc></url>" for u in rows]
    out.append("</urlset>")
    return "\n".join(out) + "\n"


def main(root=ROOT):
    ready, mready = ready_codes(root), market_ready(root)
    D, nav, home = load_dicts(root), nav_texts(), home_texts(root)
    core = [p for p in CORE if os.path.isfile(src_file(root, p))]
    names = root_names(root)
    missing = [p for p in CORE if p not in core]
    n = 0
    urls = []
    for path in core:
        with open(src_file(root, path), encoding="utf-8") as f:
            src = f.read()
        src = re.sub(r'<script id="ek-lp">.*?</script>', "", src, flags=re.S)
        for code in codes():
            title, desc = texts_for(code, path, D, nav, home)
            out = src_file(os.path.join(root, code), path)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, "w", encoding="utf-8") as f:
                f.write(copy_page(src, code, path, title, desc, ready, mready, set(core), names))
            n += 1
            if code in ready:
                urls.append(SITE + lang_path(code, path))
        with open(src_file(root, path), "w", encoding="utf-8") as f:
            f.write(mark_original(src, path, ready, mready))
    with open(os.path.join(root, "sitemap-langs.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap(urls))
    rb = os.path.join(root, "robots.txt")
    if os.path.isfile(rb):
        with open(rb, encoding="utf-8") as f:
            txt = f.read()
        line = f"Sitemap: {SITE}/sitemap-langs.xml"
        if line not in txt:
            with open(rb, "w", encoding="utf-8") as f:
                f.write(txt.rstrip("\n") + "\n" + line + "\n")
    print(f"language pages: {n} copies of {len(core)} pages in {len(codes())} languages; "
          f"{len(ready)} languages open to search engines ({', '.join(sorted(ready))}); {len(urls)} in sitemap-langs.xml"
          + (f"; not built yet, skipped: {', '.join(missing)}" if missing else ""))
    return n


if __name__ == "__main__":
    main(os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else ROOT)
