#!/usr/bin/env python3
"""
/market/ in 43 more languages: one page per language at /market/<code>/, and the string pack each one loads.

Run after the other page builders and the Arabic step (scripts/i18n_ar.py), before the search/SEO steps, in both
workflows (update.yml, pages.yml). It writes, from market/index.html as built and the translation cache
data/pro_l10n/<code>.json (scripts/pro_l10n.py):

  assets/pro/l10n/<code>.js   the workspace's strings in that language, only the ones whose English has not changed
                              since they were translated (P.tr shows English for the rest);
  market/<code>/index.html    the same workspace, opened in that language: <html lang/dir data-pro-lang>, its own
                              title, description, heading and "what this workspace has" text, canonical address and
                              hreflang links to every language that is ready; the shared header in English (the site's
                              menus exist in its four languages); no Arabic layer (ar.js) on these pages;
  market/fa|ckb|ar|en/        small pages that send to /market/ in that language (the owner's list gave /fa/, /ar/ …:
                              the site's own four live at /market/ itself);
  the hreflang links of /market/ and the sitemap entries of the ready languages.

A language is "ready" for search engines when its page text is translated; until then its page works, in English
where needed, but says noindex and stays out of the sitemap and the hreflang links.

Both outputs are built, never committed (.gitignore). Run: python3 scripts/build_market_l10n.py [root]
Test: python3 tests/test_market_l10n.py
"""
import hashlib
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pro_l10n  # noqa: E402
import pro_langs  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://entekhab.net"
ALT_RE = re.compile(r"<!--pm:alt-->.*?<!--/pm:alt-->|<!--pm:alt-->", re.S)


def esc(s):
    return html.escape(s or "", quote=True)


def sj(o):
    return json.dumps(o, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def pack_js(code, strings, total):
    r = pro_langs.BY[code]
    body = json.dumps(strings, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return ("/* entekhab.net — /market/ strings in " + r["english"] + " (" + code + "), machine-translated from English by "
            "scripts/pro_l10n.py and checked (placeholders, names, script): " + str(len(strings)) + " of " + str(total) +
            "; the rest show in English. Built by scripts/build_market_l10n.py — never edit by hand. */\n"
            "(function(){var P=window.PRO=window.PRO||{};(P.STR=P.STR||{})[" + json.dumps(code) + "]=" + body + ";})();\n")


def alternates(ready):
    """hreflang links: /market/ (the site's own four, Persian first) and every language whose page text is in"""
    out = ['<link rel="alternate" hreflang="x-default" href="' + SITE + '/market/">',
           '<link rel="alternate" hreflang="fa" href="' + SITE + '/market/">']
    for code in pro_langs.NEW:
        if code in ready:
            out.append('<link rel="alternate" hreflang="' + pro_langs.BY[code]["hreflang"] + '" href="' + SITE + '/market/' + code + '/">')
    return "<!--pm:alt-->" + "".join(out) + "<!--/pm:alt-->"


def english_chrome(doc):
    """the shared header and footer as the English site shows them (chrome.js relabels them the same way at load)"""
    doc = re.sub(r'(<(\w+) class="ek-i[^"]*" data-fa="[^"]*" data-ckb="[^"]*" data-en="([^"]*)"[^>]*>)[^<]*(</\2>)',
                 lambda m: m.group(1) + m.group(3) + m.group(4), doc)
    doc = re.sub(r'aria-label="[^"]*" title="[^"]*"( data-afa="[^"]*" data-ackb="[^"]*" data-aen="([^"]*)")', r'aria-label="\2" title="\2"\1', doc)
    for i in ("ekh", "ekf", "ekb"):
        doc = doc.replace('id="' + i + '" role="banner" data-lang="fa"', 'id="' + i + '" role="banner" data-lang="en"')
        doc = re.sub(r'(id="' + i + r'"[^>]*?)data-lang="fa"', r'\1data-lang="en"', doc)
    doc = doc.replace('class="ek-skip" href="#ek-main">پرش به محتوا<', 'class="ek-skip" href="#ek-main">Skip to content<')
    return doc


def about_html(code, tr, en_section):
    """the English "what this workspace has" section with each block in the language (English where not translated)"""
    def rep(m):
        t = re.sub(r"\s+", " ", m.group(2)).strip()
        return "<" + m.group(1) + ">" + tr.get("about." + pro_l10n.h(t), t) + "</" + m.group(1) + ">"
    return re.sub(r"<(h2|li|p)>(.*?)</\1>", rep, en_section, flags=re.S)


def page(tpl, code, tr, src, ready, pack_src):
    r = pro_langs.BY[code]
    hl, dirn, url = r["hreflang"], r["dir"], SITE + "/market/" + code + "/"
    T = lambda k: tr.get(k, src[k])  # noqa: E731
    doc = tpl
    doc = re.sub(r"<html[^>]*>", '<html lang="' + hl + '" dir="' + dirn + '" data-pro-lang="' + code + '" data-noar="1">', doc, count=1)
    doc = re.sub(r'<script id="pm-lang-go">.*?</script>', "", doc, count=1, flags=re.S)
    doc = re.sub(r'<script id="ek-ar-h">.*?</script><style id="ek-ar-s">.*?</style>', "", doc, flags=re.S)
    doc = re.sub(r'<script src="/assets/ar\.js\?v=\w+" defer></script>', "", doc)
    title = T("seo.title") + " | entekhab.net"
    doc = re.sub(r"<title>.*?</title>", "<title>" + esc(title) + "</title>", doc, count=1, flags=re.S)
    doc = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="' + esc(T("seo.desc")) + '">', doc, count=1)
    doc = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="' + url + '">', doc, count=1)
    doc = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="' + esc(T("seo.ogt")) + '">', doc, count=1)
    doc = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="' + esc(T("seo.ogd")) + '">', doc, count=1)
    doc = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="' + url + '">', doc, count=1)
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": T("seo.app"), "url": url,
          "applicationCategory": "FinanceApplication", "operatingSystem": "Any (web browser)", "inLanguage": hl,
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
          "publisher": {"@type": "Organization", "name": "Entekhab (entekhab.net)", "url": SITE}, "description": T("seo.desc")}
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "entekhab.net", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": T("seo.h1"), "item": url}]}
    doc = re.sub(r'<script type="application/ld\+json">\{"@context":"https://schema.org","@type":"WebApplication".*?</script>',
                 lambda m: '<script type="application/ld+json">' + sj(ld) + '</script><script type="application/ld+json">' + sj(crumbs) + '</script>', doc, count=1, flags=re.S)
    extra = "" if code in ready else '<meta name="robots" content="noindex,follow">'
    doc = ALT_RE.sub(lambda m: alternates(ready) + extra, doc, count=1)
    doc = doc.replace("<!--pm:pack-->", '<script src="' + pack_src + '" defer></script>', 1)
    # the heading and the line under it: this language visible, the others hidden
    head = re.search(r'<div class="pm-head">.*?</div>', doc, re.S)
    if head:
        blk = head.group(0).replace('<span data-lang="fa">', '<span data-lang="fa" hidden>')
        blk = re.sub(r"(<h1>.*?)(</h1>)", lambda m: m.group(1) + '<span data-lang="' + code + '">' + T("seo.h1") + "</span>" + m.group(2), blk, count=1, flags=re.S)
        blk = re.sub(r"(<p>.*?)(</p>)", lambda m: m.group(1) + '<span data-lang="' + code + '">' + T("seo.sub") + "</span>" + m.group(2), blk, count=1, flags=re.S)
        doc = doc[:head.start()] + blk + doc[head.end():]
    doc = re.sub(r"<noscript><p class=\"pm-about\">.*?</p></noscript>", '<noscript><p class="pm-about">' + esc(T("seo.noscript")) + "</p></noscript>", doc, count=1, flags=re.S)
    doc = doc.replace('<section class="pm-about" data-lang="fa">', '<section class="pm-about" data-lang="fa" hidden>', 1)
    en = re.search(r'<section class="pm-about" data-lang="en"[^>]*>(.*?)</section>', doc, re.S)
    if en:
        mine = '\n  <section class="pm-about" data-lang="' + code + '" lang="' + hl + '" dir="' + dirn + '">' + about_html(code, tr, en.group(1)) + "</section>"
        doc = doc[:en.end()] + mine + doc[en.end():]
    return english_chrome(doc)


STUB = ('<!DOCTYPE html><html lang="{hl}"><head><meta charset="UTF-8"><title>entekhab.net</title>'
        '<meta name="robots" content="noindex"><link rel="canonical" href="' + SITE + '/market/">'
        '<meta http-equiv="refresh" content="0;url=/market/?lang={code}">'
        '<script>location.replace("/market/?lang={code}"+location.hash)</script></head>'
        '<body><a href="/market/?lang={code}">entekhab.net/market/</a></body></html>\n')


def add_to_sitemap(root, urls):
    sm = os.path.join(root, "sitemap.xml")
    if not os.path.exists(sm) or not urls:
        return 0
    txt = open(sm, encoding="utf-8").read()
    add = "".join("<url><loc>" + esc(u) + "</loc></url>" for u in urls if "<loc>" + esc(u) + "</loc>" not in txt)
    if add:
        open(sm, "w", encoding="utf-8").write(txt.replace("</urlset>", add + "</urlset>"))
    return add.count("<url>")


def build(root=ROOT, cache_dir=None):
    tpl_path = os.path.join(root, "market", "index.html")
    tpl = open(tpl_path, encoding="utf-8").read()
    if cache_dir:
        pro_l10n.CACHE = cache_dir
    src = pro_l10n.sources(tpl)
    ui = pro_l10n.ui_strings()
    seo_keys = [k for k in src if k.startswith("seo.") or k.startswith("about.")]
    ready, made = [], []
    trs = {}
    for code in pro_langs.NEW:
        tr = pro_l10n.current(src, pro_l10n.load(code))
        trs[code] = tr
        if all(k in tr for k in seo_keys):
            ready.append(code)
    os.makedirs(os.path.join(root, "assets", "pro", "l10n"), exist_ok=True)
    for code in pro_langs.NEW:
        tr = trs[code]
        strings = {k: v for k, v in tr.items() if k in ui}
        js = pack_js(code, strings, len(ui))
        with open(os.path.join(root, "assets", "pro", "l10n", code + ".js"), "w", encoding="utf-8") as f:
            f.write(js)
        ver = hashlib.sha1(js.encode("utf-8")).hexdigest()[:8]
        doc = page(tpl, code, tr, src, ready, "/assets/pro/l10n/" + code + ".js?v=" + ver)
        d = os.path.join(root, "market", code)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
            f.write(doc)
        made.append(code)
    for code in pro_langs.SITE:
        d = os.path.join(root, "market", code)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
            f.write(STUB.format(code=code, hl=pro_langs.BY[code]["hreflang"]))
    # /market/ itself: hreflang links to every ready language
    new_tpl = ALT_RE.sub(lambda m: alternates(ready), tpl, count=1)
    if new_tpl != tpl:
        with open(tpl_path, "w", encoding="utf-8") as f:
            f.write(new_tpl)
    n = add_to_sitemap(root, [SITE + "/market/" + c + "/" for c in ready])
    return {"pages": len(made), "ready": ready, "sitemap_added": n,
            "strings": {c: len([k for k in trs[c] if k in ui]) for c in pro_langs.NEW}, "total": len(ui)}


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else ROOT
    r = build(root, cache_dir=os.environ.get("PRO_L10N_CACHE") or None)      # (tests point PRO_L10N_CACHE at a fake cache)
    full = sum(1 for c, n in r["strings"].items() if n == r["total"])
    print(f"market languages: {r['pages']} pages, {len(r['ready'])} ready for search engines, {full} fully translated, "
          f"{r['sitemap_added']} added to the sitemap")


if __name__ == "__main__":
    main()
