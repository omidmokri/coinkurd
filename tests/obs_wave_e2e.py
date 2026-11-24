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
            page.add_init_script("window.__sk = 0; document.addEventListener('readystatechange', function f() { if (!document.documentElement) return; new MutationObserver(function () { if (document.querySelector('.ob-wvbox.sk')) window.__sk = 1; }).observe(document.documentElement, {subtree: true, childList: true, attributes: true}); document.removeEventListener('readystatechange', f); });")
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
            if lang == "fa":
                check("skeleton: the shimmer stands in for the chart while it loads", page.evaluate("() => window.__sk === 1"))
                check("skeleton: it is gone once the data is in", page.evaluate("() => !document.querySelector('.ob-wvbox.sk')"))
            check(f"{lang}: no page errors", not errors, errors[:3])
            if lang == "fa":
                for st_ in ("candle", "line", "wave"):
                    page.evaluate(f"() => OB._wv.S.style = '{st_}'")
                    page.evaluate("() => OB.views.wave.unmount() || 0")
                    page.evaluate("() => OB.views.wave.mount(OB._wv.V.el)")
                    page.wait_for_function("() => OB._wv.V.G && OB._wv.V.G.rows.length", timeout=20000)
                    check(f"style {st_} draws", page.evaluate("() => OB._wv.V.G.rows.length") > 100, st_)
                    if st_ == "candle":
                        bod = page.evaluate("() => OB._wv.V.G.rows.slice(-400).filter(r => r[1] !== r[4]).length")
                        check("candles have a body: a bar opens where the one before it closed", bod > 350, bod)
                        ohlc = page.evaluate("() => OB._wv.V.G.rows.slice(-400).every(r => r[2] >= Math.max(r[1], r[4]) && r[3] <= Math.min(r[1], r[4]))")
                        check("candles are well formed: the high is the highest and the low the lowest", ohlc)
                for b_, mn in (("w", 400), ("m", 90)):
                    page.evaluate(f"() => OB._wv.S.bucket = '{b_}'")
                    page.evaluate("() => OB.views.wave.unmount() || 0")
                    page.evaluate("() => OB.views.wave.mount(OB._wv.V.el)")
                    page.wait_for_function("() => OB._wv.V.G && OB._wv.V.G.rows.length", timeout=20000)
                    n_ = page.evaluate("() => OB._wv.V.G.rows.length")
                    check(f"step {b_} buckets the price ({n_} rows)", n_ > mn and n_ < 4000, n_)
                check("no errors after switching", not errors, errors[:3])
                page.evaluate("() => OB._wv.S.bucket = 'd'")
                # the cycles laid over one another
                page.evaluate("() => { OB._wv.S.ovl = true; OB.views.wave.unmount(); OB.views.wave.mount(OB._wv.V.el); }")
                page.wait_for_function("() => OB._wv.V.G && OB._wv.V.G.ovl", timeout=20000)
                g = page.evaluate("() => ({n: OB._wv.V.G.series.length, e: OB._wv.V.G.cycles.map(c => c.e), cur: OB._wv.V.G.cycles.filter(c => c.cur).map(c => c.e), u: OB._wv.V.G.uNow, cols: OB._wv.V.G.cycles.map(c => c.color)})")
                check("overlay: one series per cycle with a price at its halving", g["n"] == 4 and g["e"] == [1, 2, 3, 4], g)
                check("overlay: the current cycle is the tip's", g["cur"] == [TIP // 210000], g)
                check("overlay: blocks since the halving", g["u"] == TIP - (TIP // 210000) * 210000, g)
                check("overlay: a colour of its own per cycle", len(set(g["cols"])) == 4, g["cols"])
                b0 = page.evaluate("() => OB._wv.V.G.series.map(s => s.data[0][1])")
                check("overlay: every cycle starts at its own halving price", all(abs(b - 1) < 1e-9 for b in b0), b0)
                check("overlay: the index is one curve over a whole cycle", page.evaluate("() => OB._wv.V.G.idx[0][1]") == 0.5 and abs(page.evaluate("() => OB._wv.V.G.idx[OB._wv.V.G.idx.length - 1][1]") - 0.5) < 1e-9)
                check("overlay: no page errors", not errors, errors[:3])
                # the live price feeds the tile and the last bar
                page.evaluate("() => { OB._wv.S.ovl = false; OB.views.wave.unmount(); OB.views.wave.mount(OB._wv.V.el); }")
                page.wait_for_function("() => OB._wv.V.G && OB._wv.V.G.rows.length", timeout=20000)
                page.evaluate("() => { OB._wv.V.live = 123456; OB._wv.V.redraw = 0; }")
                page.evaluate("() => OB._wv.V.el.ownerDocument.getElementById('ob-livepx') && OB._wv.paintLive()")
                page.wait_for_timeout(300)
                txt2 = page.inner_text("#ob-tiles")
                check("live: the price tile follows the stream", "123" in txt2.replace(",", "").replace("\u066c", "").replace("\u06f1", "1").replace("\u06f2", "2").replace("\u06f3", "3"), txt2[:120])
                check("live: the bar in progress follows it too", page.evaluate("() => OB._wv.V.G.rows[OB._wv.V.G.rows.length - 1][4]") == 123456)
                page.evaluate("() => { OB._wv.V.live = null; OB._wv.V.redraw = 0; }")
                # the same point in the earlier cycles, on the read-out and pinned on the plot
                pc = page.evaluate("() => (OB._wv.priorCycles(900000) || {rows: []}).rows.map(r => [r.x, Math.round(r.y), r.color])")
                check("prior cycles: three rows, one per earlier cycle", len(pc) == 3, pc)
                check("prior cycles: one, two and three halvings back, snapped to the bar", all(abs((900000 - r[0]) - k * 210000) <= 144 for k, r in zip((1, 2, 3), pc)), pc)
                check("prior cycles: each in its own cycle's colour", len(set(r[2] for r in pc)) == 3, pc)
                py_ = page.evaluate("() => { const rs = OB._wv.V.G.rows, h = 900000 - 210000; let r = null; for (const x of rs) if (x[0] <= h) r = x; return Math.round(r[4]); }")
                check("prior cycles: the price is the one on that block", pc[0][1] == py_, (pc[0], py_))
            page.screenshot(path=f"{SHOTS}/{lang}-{w}.png", full_page=False)
            ctx.close()
        br.close()
    srv.shutdown()
    print(f"\nblock-cycle: {len(E.FAIL)} failures, {len(E.OK)} checks passed · shots in {SHOTS}")


if __name__ == "__main__":
    main()
    sys.exit(1 if E.FAIL else 0)
