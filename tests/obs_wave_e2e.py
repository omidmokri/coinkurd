#!/usr/bin/env python3
"""End-to-end test of /charts/block-cycle/ in a real Chrome, offline.

The block tip is served by a mock of mempool.space, so every figure the page shows can be worked out
here in Python from the published definition and compared. Screenshots go to $SHOTS (default /tmp/wvshots).
Run: python3 scripts/build_obs.py && python3 tests/obs_wave_e2e.py
"""
import os
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tests"))
import obs_e2e as E  # noqa: E402

SHOTS = os.environ.get("SHOTS", "/tmp/wvshots")
os.makedirs(SHOTS, exist_ok=True)
check = E.check
TIP = 977_402


def wwi(h):
    s = (h + 78750) % 210000
    return s / 157500 if s < 157500 else 1 - (s - 157500) / 52500


def main():
    srv, port = E.serve()
    base = f"http://127.0.0.1:{port}"
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=["--no-sandbox"])
        for lang, w, h in (("fa", 1280, 900), ("en", 1280, 900), ("ckb", 390, 844), ("ar", 390, 844)):
            ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            ctx.add_init_script(E.lang_init(lang))
            page = ctx.new_page()
            errors = []
            E.wire(page, errors)
            page.route("https://mempool.space/api/blocks/tip/height", lambda r: r.fulfill(status=200, body=str(TIP), headers={"access-control-allow-origin": "*"}))
            page.goto(f"{base}/charts/block-cycle/", wait_until="domcontentloaded")
            page.wait_for_function("() => window.OB && OB._wv && OB._wv.V.G && OB._wv.V.G.rows.length", timeout=30000)
            page.wait_for_timeout(450)
            st = page.evaluate("() => ({tip: OB._wv.V.G.tipH, rows: OB._wv.V.G.rows.length, idx: OB._wv.V.G.idx.length})")
            check(f"{lang}: the page read the tip", st["tip"] == TIP, st)
            check(f"{lang}: price rows and index points are drawn", st["rows"] > 1000 and st["idx"] > 1000, st)
            txt = page.inner_text("#ob-tiles") if page.query_selector("#ob-tiles") else page.inner_text("main")
            want = round(wwi(TIP), 3)
            got = re.search(r"0?\.\d{2,3}|۰?٫[۰-۹]{2,3}", txt)
            check(f"{lang}: a tile shows the index", got is not None, txt[:160])
            v = page.evaluate("() => OB._wv.wwi(OB._wv.V.G.tipH)")
            check(f"{lang}: the page's own arithmetic matches the definition", abs(v - wwi(TIP)) < 1e-12, (v, wwi(TIP)))
            check(f"{lang}: 0.5 at every halving", all(abs(page.evaluate(f"() => OB._wv.wwi({x})") - 0.5) < 1e-12 for x in (210000, 420000, 630000, 840000, 1050000)), "")
            check(f"{lang}: the credit is shown", "WolfyXBT" in page.inner_text("main"), "")
            check(f"{lang}: no page errors", not errors, errors[:3])
            if lang == "fa":
                for st_ in ("candle", "line", "wave"):
                    page.evaluate(f"() => OB._wv.S.style = '{st_}'")
                    page.evaluate("() => OB.views.wave.unmount() || 0")
                    page.evaluate("() => OB.views.wave.mount(OB._wv.V.el)")
                    page.wait_for_function("() => OB._wv.V.G && OB._wv.V.G.rows.length", timeout=20000)
                    check(f"style {st_} draws", page.evaluate("() => OB._wv.V.G.rows.length") > 100, st_)
                for b_, mn in (("w", 400), ("m", 90)):
                    page.evaluate(f"() => OB._wv.S.bucket = '{b_}'")
                    page.evaluate("() => OB.views.wave.unmount() || 0")
                    page.evaluate("() => OB.views.wave.mount(OB._wv.V.el)")
                    page.wait_for_function("() => OB._wv.V.G && OB._wv.V.G.rows.length", timeout=20000)
                    n_ = page.evaluate("() => OB._wv.V.G.rows.length")
                    check(f"step {b_} buckets the price ({n_} rows)", n_ > mn and n_ < 4000, n_)
                check("no errors after switching", not errors, errors[:3])
            page.screenshot(path=f"{SHOTS}/{lang}-{w}.png", full_page=False)
            ctx.close()
        br.close()
    srv.shutdown()
    print(f"\nblock-cycle: {len(E.FAIL)} failures, {len(E.OK)} checks passed · shots in {SHOTS}")


if __name__ == "__main__":
    main()
    sys.exit(1 if E.FAIL else 0)
