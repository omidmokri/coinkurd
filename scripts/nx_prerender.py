"""
Write the homepage stage of interface v3 into index.html, so it is on screen before any script arrives.

The stage (#nx: the coin, the headline, the two buttons and the eight panels) is built by assets/nx-home.js from a
template. On a slow connection that script can take seconds, and until then the first screen would be empty. This tool
runs that same template once in a browser and writes its output between <!--nx:stage--> and <!--/nx:stage--> in
index.html, with a hash of that output in data-tpl. assets/nx-home.js then finds the section already there: if its
template gives the same hash now, the section is used as it stands; if not (another language, or the template was
changed and this tool has not been run since), the script rebuilds it in place — so a stale copy never breaks the
page, it only costs the early paint.

Run it after changing the template in assets/nx-home.js or the section titles on the homepage:

    python scripts/nx_prerender.py            # rewrite index.html if needed
    python scripts/nx_prerender.py --check    # exit 1 if index.html is out of date (changes nothing)

It is a maintenance tool, not part of the site build: it needs Playwright and a Chrome/Chromium
(pip install playwright; set CHROME=/path/to/chrome if it is not at /usr/bin/google-chrome).
"""
import functools
import http.server
import os
import re
import sys
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
A, B = "<!--nx:stage-->", "<!--/nx:stage-->"
HOOK = "  if (pre) {"
PROBE = "  w.__nxTpl = (function () { var t = d.createElement('div'); t.innerHTML = tpl; return t.innerHTML; })(); w.__nxHash = h32(w.__nxTpl);\n"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def template_output():
    from playwright.sync_api import sync_playwright
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    src = open(os.path.join(ROOT, "assets", "nx-home.js"), encoding="utf-8").read()
    if src.count(HOOK) != 1:
        raise SystemExit("nx_prerender: the hook line was not found exactly once in assets/nx-home.js")
    src = src.replace(HOOK, PROBE + HOOK)
    chrome = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch()
            pg = b.new_context(viewport={"width": 1440, "height": 900}, locale="fa-IR").new_page()

            def route(r):                                   # nothing leaves this machine; the stage script is the probed copy
                u = r.request.url
                if not u.startswith(base):
                    return r.abort()
                if "/assets/nx-home.js" in u:
                    return r.fulfill(status=200, content_type="application/javascript; charset=utf-8", body=src)
                return r.continue_()
            pg.route("**/*", route)
            pg.goto(base + "/", wait_until="domcontentloaded")
            pg.wait_for_function("typeof window.__nxTpl === 'string'", timeout=20000)
            out = pg.evaluate("window.__nxTpl")
            sig = pg.evaluate("window.__nxHash")
            b.close()
    finally:
        srv.shutdown()
    if not out or 'class="nx-mid"' not in out or out.count('class="nx-p"') < 4:
        raise SystemExit("nx_prerender: the template gave an unexpected result; index.html was left alone")
    if not sig or not re.fullmatch(r"[0-9a-z]{1,8}", sig):
        raise SystemExit("nx_prerender: no template hash; index.html was left alone")
    return '<section class="nx" id="nx" aria-labelledby="nx-h" data-tpl="' + sig + '">' + out + "</section>"


def main():
    doc = open(PAGE, encoding="utf-8").read()
    i, j = doc.find(A), doc.find(B)
    if i < 0 or j < i:
        raise SystemExit("nx_prerender: the <!--nx:stage--> markers are missing from index.html")
    stage = template_output()
    if re.search(r"<script|on\w+=", stage, re.I):
        raise SystemExit("nx_prerender: the stage must be plain markup")
    new = doc[:i + len(A)] + stage + doc[j:]
    if new == doc:
        print("nx_prerender: index.html is up to date")
        return 0
    if "--check" in sys.argv:
        print("nx_prerender: index.html is OUT OF DATE (run: python scripts/nx_prerender.py)")
        return 1
    open(PAGE, "w", encoding="utf-8").write(new)
    print(f"nx_prerender: wrote the stage into index.html ({len(stage.encode('utf-8'))} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
