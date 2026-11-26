#!/usr/bin/env python3
"""Tests for scripts/build_lang_pages.py (the main pages at their own address in every language).

A small site is built in a temporary folder: a home page whose inline script fetches 'data/x.json', a page with a
relative link and a link to another main page, the language list and a dictionary. Checks: every language gets its
copies, links stay in the language, relative addresses still reach the same files, head text and noindex, hreflang
points both ways, the sitemap holds ready languages only, a second run gives the same files, and the first script of a
copy sets the right keys and sends a language switch to that language's address (run in node with a stub page).
Run: python3 tests/test_lang_pages.py
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "scripts"))
import build_lang_pages as B  # noqa: E402
import pro_langs  # noqa: E402

FAILS = []


def check(name, ok, extra=""):
    print(("ok   " if ok else "FAIL ") + name + (("  " + extra) if extra and not ok else ""))
    if not ok:
        FAILS.append(name)


HOME = """<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="UTF-8"><title>docTitle</title>
<meta name="description" content="فارسی">
<meta property="og:title" content="x"><meta property="og:url" content="https://entekhab.net/">
<link rel="canonical" href="https://entekhab.net/">
<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
</head><body>
<a href="today/">today</a> <a href="/heatmap/#x">heat</a> <a href="#top">top</a> <a href="/terminal/">t</a>
<img src="assets/logo.webp"><a href="https://example.org/a">ext</a>
<script>const T={fa:{docTitle:'تحلیل'},ckb:{docTitle:'شیکاری'},en:{docTitle:'Crypto market analysis and live prices | Entekhab'}};
fetch('data/x.json');const u=`coins/${c}/`;const txt='hello world';const mime='image/webp';const link='today/';</script>
</body></html>"""
PAGE = """<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>نقشه</title>
<meta name="description" content="فارسی"><link rel="canonical" href="https://entekhab.net/heatmap/">
<meta name="robots" content="index,follow">
</head><body><a href="../today/">today</a><a href="/">home</a><a href="/market/">market</a><form action="go/"></form>
<script>fetch('data/x.json')</script></body></html>"""


def site():
    root = tempfile.mkdtemp(prefix="lp_")
    for d in ("data", "data/i18n", "i18n", "assets", "today", "heatmap", "coins", "terminal", "market/de"):
        os.makedirs(os.path.join(root, d), exist_ok=True)
    open(os.path.join(root, "index.html"), "w", encoding="utf-8").write(HOME)
    open(os.path.join(root, "heatmap", "index.html"), "w", encoding="utf-8").write(PAGE)
    open(os.path.join(root, "today", "index.html"), "w", encoding="utf-8").write(PAGE.replace("/heatmap/", "/today/"))
    open(os.path.join(root, "robots.txt"), "w").write("User-agent: *\nAllow: /\n")
    json.dump({"ready": [{"code": "de"}, {"code": "kmr"}]}, open(os.path.join(root, "i18n", "langs.json"), "w"))
    json.dump({"lang": "de", "s": {"Crypto market analysis and live prices | Entekhab": "Krypto-Analyse | Entekhab"}},
              open(os.path.join(root, "data", "i18n", "de.json"), "w"))
    open(os.path.join(root, "market", "de", "index.html"), "w").write("<html><head><title>m</title></head></html>")
    return root


def read(root, rel):
    with open(os.path.join(root, rel), encoding="utf-8") as f:
        return f.read()


def main():
    root = site()
    try:
        n = B.main(root)
        cores = [p for p in B.CORE if os.path.isfile(B.src_file(root, p))]
        check("a copy of every built main page in every language but Persian", n == len(cores) * (len(pro_langs.BY) - 1),
              f"{n}")
        check("both Kurdish dialects have their own home page",
              os.path.isfile(os.path.join(root, "ckb", "index.html")) and os.path.isfile(os.path.join(root, "kmr", "index.html")))
        check("50 languages counting Kurdish once", len({("ku" if c in ("ckb", "kmr") else c) for c in pro_langs.BY}) == 50)
        de = read(root, "de/index.html")
        check("html lang of the copy", '<html lang="de" dir="ltr" data-lp="de">' in de)
        check("title translated from the dictionary", "<title>Krypto-Analyse | Entekhab</title>" in de, de[:400])
        check("canonical is the copy's own address", '<link rel="canonical" href="https://entekhab.net/de/">' in de)
        check("ready language has no noindex", "noindex" not in de)
        check("Persian breadcrumbs dropped", "BreadcrumbList" not in de)
        check("relative link to a main page goes to its copy", '<a href="/de/today/">' in de)
        check("absolute link to a main page goes to its copy", '<a href="/de/heatmap/#x">' in de)
        check("fragment link untouched", '<a href="#top">' in de)
        check("other pages keep their address", '<a href="/terminal/">' in de)
        check("relative image made absolute", '<img src="/assets/logo.webp">' in de)
        check("outside link untouched", 'href="https://example.org/a"' in de)
        check("inline fetch reaches the same file", "fetch('/data/x.json')" in de)
        check("inline template address from the root", "`/coins/${c}/`" in de)
        check("inline link to a main page in the language", "const link='/de/today/'" in de)
        check("plain strings untouched", "'hello world'" in de and "'image/webp'" in de)
        hm = read(root, "iw/heatmap/index.html")
        check("right-to-left language", '<html lang="he" dir="rtl" data-lp="iw">' in hm)
        check("not-ready language says noindex", '<meta name="robots" content="noindex,follow">' in hm)
        check("old robots line removed", 'content="index,follow"' not in hm)
        check("../ link resolved against the original", '<a href="/iw/today/">' in hm)
        check("form action absolute", 'action="/heatmap/go/"' in hm)
        check("market link goes to the language's market page", '<a href="/market/iw/">' in hm)
        check("own-language market link", '<a href="/market/">' in read(root, "en/heatmap/index.html"))
        check("home link stays in the language", '<a href="/iw/">' in hm)
        check("non-home page scripts untouched", "fetch('data/x.json')" in hm)

        alts = lambda h: dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">', h))  # noqa: E731
        orig = read(root, "heatmap/index.html")
        a_o, a_c = alts(orig), alts(read(root, "de/heatmap/index.html"))
        check("original and copy list the same hreflang set", a_o == a_c and len(a_o) > 3, str(a_o))
        check("x-default and fa are the original", a_o.get("x-default") == a_o.get("fa") == "https://entekhab.net/heatmap/")
        check("both Kurdish dialects in hreflang", a_o.get("ckb", "").endswith("/ckb/heatmap/") and a_o.get("kmr", "").endswith("/kmr/heatmap/"))
        check("not-ready language not in hreflang", "he" not in a_o)
        check("hebrew hreflang value is he when listed", all(k != "iw" for k in a_o))
        check("original keeps its Persian head", '<html lang="fa" dir="rtl">' in orig and "<title>نقشه</title>" in orig)
        sm = read(root, "sitemap-langs.xml")
        check("sitemap has ready copies only", "/de/heatmap/" in sm and "/iw/" not in sm and "/kmr/" in sm)
        check("robots lists the sitemap", "Sitemap: https://entekhab.net/sitemap-langs.xml" in read(root, "robots.txt"))

        snap = {r: read(root, r) for r in ("index.html", "de/index.html", "heatmap/index.html", "iw/heatmap/index.html", "robots.txt")}
        B.main(root)
        check("second run gives the same files", all(read(root, r) == v for r, v in snap.items()))
        check("one boot script after rerun", read(root, "heatmap/index.html").count('id="ek-lp"') == 1)
        check("one hreflang block after rerun", read(root, "heatmap/index.html").count(B.MARK) == 1)
        check("boot data cannot close its script", "</" not in B.sj({"x": "</script><b>"}) and "<" not in B.sj({"x": "<"}))

        boot_js(read(root, "de/heatmap/index.html"), read(root, "heatmap/index.html"), read(root, "ar/heatmap/index.html"))
    finally:
        shutil.rmtree(root, ignore_errors=True)
    print(("\nall passed" if not FAILS else f"\n{len(FAILS)} failed"))
    return 0 if not FAILS else 1


NODE = r"""
const vm=require('vm');const [src,path,clicks]=JSON.parse(require('fs').readFileSync(0,'utf8'));
const store={};let L={};let nav=null;const handlers=[];
const ls={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
const doc={addEventListener:(t,f,c)=>handlers.push(f)};
const loc={pathname:path,hash:'',set href(v){nav=v},get href(){return path}};
const ctx={window:{},localStorage:ls,document:doc,location:loc};vm.createContext(ctx);vm.runInContext(src,ctx);
const out={keys:Object.assign({},store),src:ctx.window.EKLP.src,nav:[]};
for(const c of clicks){nav=null;let prevented=false;
 const btn={getAttribute:a=>c[a]===undefined?null:c[a],hasAttribute:a=>c[a]!==undefined};
 const ev={target:{closest:s=>{const ok=s.split(',').some(x=>{x=x.trim();
   if(c.box&&x.startsWith(c.box+' ')){const a=x.match(/\[([\w-]+)\]/)[1];return c[a]!==undefined}return false});return ok?btn:null}},
   preventDefault(){prevented=true},stopImmediatePropagation(){}};
 handlers.forEach(h=>h(ev));out.nav.push([nav,prevented,Object.assign({},store)]);}
console.log(JSON.stringify(out));
"""


def run_boot(h, path, clicks):
    src = re.search(r'<script id="ek-lp">(.*?)</script>', h, re.S).group(1)
    r = subprocess.run(["node", "-e", NODE], input=json.dumps([src, path, clicks]), capture_output=True, text=True, timeout=30)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return json.loads(r.stdout)


def boot_js(de_h, fa_h, ar_h):
    if not shutil.which("node"):
        check("node available for the boot script test", False)
        return
    clicks = [{"box": "#langs", "data-l": "en"}, {"box": ".ekw-wrap", "data-code": "kmr"}, {"box": ".ekw-wrap", "data-back": ""},
              {"box": "#langs", "data-l": "de"}, {"box": ".ek-lang", "data-l": "fa"}, {"box": "#other", "data-l": "en"}]
    o = run_boot(de_h, "/de/heatmap/", clicks)
    check("German copy sets the globe's keys", o["keys"] == {"ek_l": "de", "ck_lang": "en"}, str(o["keys"]))
    check("copy uses the original's dictionary", o["src"] == "/heatmap/")
    check("switch to English goes to the English copy", o["nav"][0][:2] == ["/en/heatmap/", True] and o["nav"][0][2].get("ck_lang") == "en" and "ek_l" not in o["nav"][0][2])
    check("globe card goes to that language's copy", o["nav"][1][0] == "/kmr/heatmap/" and o["nav"][1][2].get("ek_l") == "kmr")
    check("globe 'back' goes to English", o["nav"][2][0] == "/en/heatmap/")
    check("the language already shown is left to the page", o["nav"][3] [:2] == [None, False])
    check("Persian goes to the original", o["nav"][4][0] == "/heatmap/" and o["nav"][4][2].get("ck_lang") == "fa")
    check("buttons elsewhere are not touched", o["nav"][5][:2] == [None, False])
    f = run_boot(fa_h, "/heatmap/", [{"box": "#langs", "data-l": "ckb"}, {"box": ".ekw-wrap", "data-code": "ar"}])
    check("original sets no keys", f["keys"] == {})
    check("original sends Sorani to its copy", f["nav"][0][0] == "/ckb/heatmap/" and f["nav"][0][2].get("ck_lang") == "ckb")
    check("original sends Arabic to its copy", f["nav"][1][0] == "/ar/heatmap/" and f["nav"][1][2].get("ek_ar") == "1")
    a = run_boot(ar_h, "/ar/heatmap/", [])
    check("Arabic copy sets the Arabic keys", a["keys"] == {"ek_ar": "1", "ck_lang": "en"}, str(a["keys"]))


if __name__ == "__main__":
    sys.exit(main())
