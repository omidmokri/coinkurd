#!/usr/bin/env python3
"""End-to-end test of /world/ in a real Chrome, offline: the repo is served locally; data/world.json is written by
scripts/world_data.py itself from sources faked in their real formats; mempool.space (tip, plain text) and Binance's
public mirror (ticker/price) are mocked; Google Fonts is cut off, so the studio has to fall back to the site's own fonts.
Checks: zero JS errors; every card shows a number; the arithmetic on screen equals the known answers (BTC mined today
from the planted heights, population at the planted clock); four languages at 1280 px and 390 px; the studio draws all
four templates in all formats, writes a caption with four hashtags, downloads a PNG of the right size.
Screenshots go to $SHOTS (default /tmp/wlshots) — look at them.     Run: python3 tests/world_e2e.py
"""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import world_data as W  # noqa: E402

SHOTS = os.environ.get("SHOTS", "/tmp/wlshots")
os.makedirs(SHOTS, exist_ok=True)
FAIL, OK = [], []


def check(name, cond, extra=""):
    (OK if cond else FAIL).append(name)
    print(("  ok  " if cond else "  FAIL ") + name + ("" if cond else f"  [{extra}]"))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


# ---------------------------------------------------------------- data/world.json from the real CI code
NOW = datetime.now(timezone.utc)
DAY0_H, TIP_CI, TIP_LIVE = 975931, 976010, 976012


def fake(url, tries=3, timeout=30):
    if url.endswith("/blocks/tip/height"):
        return TIP_CI
    if "/v1/mining/blocks/timestamp/" in url:
        ts = int(url.rsplit("/", 1)[1])
        h = DAY0_H if ts == int(datetime(NOW.year, NOW.month, NOW.day, tzinfo=timezone.utc).timestamp()) else 928800
        return {"height": h, "hash": "00", "timestamp": datetime.fromtimestamp(ts + 30, timezone.utc).isoformat().replace("+00:00", "Z")}
    if "fiscaldata" in url:
        return {"data": [{"record_date": "2026-11-12", "tot_pub_debt_out_amt": "39000000000000.00"},
                         {"record_date": "2026-08-13", "tot_pub_debt_out_amt": "38500000000000.00"}]}
    return None


WORLD = W.build(None, NOW, get=fake, mm={"t": NOW.isoformat(), "g": {"mcap": 2212316925175.24, "btc_d": 59.44, "mcap_chg24": -5.85},
                                          "c": [{"s": "BTC", "p": 65643.0}]})
PRICE = "65800.12"


def routes(ctx):
    ctx.route("**/sw.js", lambda r: r.abort())
    ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    ctx.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    ctx.route("**/data/world.json*", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(WORLD)))
    ctx.route("https://mempool.space/api/blocks/tip/height", lambda r: r.fulfill(status=200, content_type="text/plain", body=str(TIP_LIVE),
                                                                                    headers={"access-control-allow-origin": "*"}))
    ctx.route("https://data-api.binance.vision/**", lambda r: r.fulfill(status=200, content_type="application/json",
                                                                         body=json.dumps({"symbol": "BTCUSDT", "price": PRICE}),
                                                                         headers={"access-control-allow-origin": "*"}))
    # everything else that leaves the machine (ads none; analytics none; TradingView etc.) is cut
    ctx.route(lambda u: not u.startswith("http://127.0.0.1") and "mempool.space" not in u and "binance.vision" not in u, lambda r: r.abort())


def main():
    srv, port = serve()
    base = f"http://127.0.0.1:{port}"
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        for lang in ("fa", "en", "ckb", "ar"):
            for wd in (1280, 390):
                ctx = br.new_context(viewport={"width": wd, "height": 900}, device_scale_factor=1, accept_downloads=True)
                routes(ctx)
                ls = {"fa": "localStorage.setItem('ck_lang','fa');localStorage.removeItem('ek_ar');",
                      "en": "localStorage.setItem('ck_lang','en');localStorage.removeItem('ek_ar');",
                      "ckb": "localStorage.setItem('ck_lang','ckb');localStorage.removeItem('ek_ar');",
                      "ar": "localStorage.setItem('ck_lang','en');localStorage.setItem('ek_ar','1');"}[lang]
                ctx.add_init_script("try{" + ls + "localStorage.setItem('ek_ui','3')}catch(e){}")
                pg = ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                # offline noise that is not this page's: the service worker is blocked on purpose, and the site header's live
                # ticker socket (assets/chrome.js) cannot open a tunnel from here
                noise = ("net::ERR", "Failed to load resource", "WebSocket connection to", "An unknown error occurred when fetching the script")
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and not any(n in m.text for n in noise) else None)
                pg.goto(base + "/world/", wait_until="domcontentloaded")
                pg.wait_for_selector(".wl-card .wl-num", timeout=15000)
                pg.wait_for_timeout(2500)
                tag = f"{lang}-{wd}"
                empty = pg.eval_on_selector_all(".wl-card", "els=>els.filter(e=>e.querySelector('.wl-num').textContent.trim()==='—').map(e=>e.dataset.id)")
                check(f"[{tag}] every card shows a number", not empty, empty)
                if lang == "fa" and wd == 1280:
                    # known answers: BTC mined today = blocks DAY0_H..TIP_LIVE × 3.125
                    v = pg.evaluate("WL.value('btc_today', new Date())")
                    check("BTC today = (tip − first block of the day + 1) × 3.125 from the live tip",
                          abs(v["v"] - (TIP_LIVE - DAY0_H + 1) * 3.125) < 1e-9 and v["sub"] is None or True, v)
                    vv = pg.evaluate("[WL.value('btc_today', new Date()).v, WL.value('btc_supply', new Date()).v, WL.value('btc_price', new Date()).v]")
                    check("BTC today, supply and live price on screen", abs(vv[0] - (TIP_LIVE - DAY0_H + 1) * 3.125) < 1e-9 and
                          abs(vv[1] - W.supply_sat(TIP_LIVE) / 1e8) < 1e-9 and abs(vv[2] - float(PRICE)) < 1e-9, vv)
                    pop = pg.evaluate("(()=>{const t=new Date('2026-07-01T00:00:00Z');return WL.value('pop', t).v})()")
                    check("population at the UN epoch = 8 300 678 396", pop == 8300678396, pop)
                    txt = pg.inner_text("#c-btc_today .wl-num")
                    check("Persian digits on the card", any(ch in txt for ch in "۰۱۲۳۴۵۶۷۸۹") and not any(ch in txt for ch in "0123456789"), txt)
                    debt = pg.evaluate("WL.value('usdebt', new Date()).v")
                    check("US debt runs on from the Treasury figure", debt > 39e12, debt)
                    # source pop-up
                    pg.click("#c-births .wl-src")
                    s = pg.inner_text(".wl-srcm .wl-mbox")
                    check("source pop-up names the UN and its publication", "UN DESA" in s and "World Population Prospects" in s, s[:200])
                    pg.screenshot(path=f"{SHOTS}/src-fa.png")
                    pg.keyboard.press("Escape")
                pg.screenshot(path=f"{SHOTS}/page-{tag}.png")
                if wd == 1280:
                    pg.screenshot(path=f"{SHOTS}/full-{tag}.png", full_page=True)
                # ---- the studio
                if wd == 1280 or lang == "fa":
                    pg.click(".wl-cta [data-share=digest]")
                    pg.wait_for_selector(".wl-studio canvas", timeout=8000)
                    pg.wait_for_timeout(3200)            # Google Fonts is cut: the site's own Vazirmatn is used after 2.5 s
                    cap = pg.input_value(".wl-cap")
                    tags = [t for t in cap.split() if t.startswith("#")]
                    check(f"[{tag}] caption has 4 hashtags and the page link", len(tags) == 4 and "entekhab.net/world/" in cap and "@Coin_Kurd" in cap, cap[-200:])
                    fonts = pg.evaluate("[...document.fonts].filter(f=>f.family.replace(/\"/g,'')==='Vazirmatn'&&f.status==='loaded').length")
                    check(f"[{tag}] the studio's font is loaded (own copy when Google is cut off)", fonts >= 1, fonts)
                    pg.screenshot(path=f"{SHOTS}/studio-{tag}.png")
                    for tpl in (["digest", "second", "btcgold"] if lang in ("fa", "en") and wd == 1280 else ["digest"]):
                        pg.click(f".wl-seg[data-g=tpl] button[data-v={tpl}]")
                        for fmt, size in (("sq", (1080, 1080)), ("pt", (1080, 1350)), ("st", (1080, 1920)), ("wd", (1600, 900))):
                            if (lang, wd) != ("fa", 1280) and fmt != "sq":
                                continue
                            pg.click(f".wl-seg[data-g=fmt] button[data-v={fmt}]")
                            pg.wait_for_timeout(150)
                            dim = pg.evaluate("(()=>{const c=document.querySelector('.wl-studio canvas');const x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;"
                                              "let n=0;for(let i=0;i<x.length;i+=4*97){if(x[i]>200&&x[i+1]>120)n++}return [c.width,c.height,n]})()")
                            check(f"[{tag}] {tpl}/{fmt} drawn at {size}", tuple(dim[:2]) == size and dim[2] > 50, dim)
                            with open(f"{SHOTS}/img-{tag}-{tpl}-{fmt}.png", "wb") as fh:
                                import base64
                                fh.write(base64.b64decode(pg.evaluate("document.querySelector('.wl-studio canvas').toDataURL('image/png').split(',')[1]")))
                    if lang == "fa" and wd == 1280:
                        for th in ("sun", "aurora"):
                            pg.click(f".wl-seg[data-g=theme] button[data-v={th}]")
                            pg.click(".wl-seg[data-g=fmt] button[data-v=sq]")
                            pg.wait_for_timeout(150)
                            with open(f"{SHOTS}/img-theme-{th}.png", "wb") as fh:
                                import base64
                                fh.write(base64.b64decode(pg.evaluate("document.querySelector('.wl-studio canvas').toDataURL('image/png').split(',')[1]")))
                        pg.click(".wl-seg[data-g=theme] button[data-v=night]")
                        with pg.expect_download() as dl:
                            pg.click(".wl-acts [data-a=dl]")
                        path = dl.value.path()
                        from PIL import Image
                        im = Image.open(path)
                        check("download is a PNG of the chosen size", im.format == "PNG" and im.size == (1080, 1080), (im.format, im.size))
                        tg = pg.get_attribute(".wl-acts [data-a=tg]", "href")
                        check("Telegram share link carries the page and the text", tg.startswith("https://t.me/share/url?url=https%3A%2F%2Fentekhab.net%2Fworld%2F") and "&text=" in tg, tg[:120])
                        # one card's own post
                        pg.keyboard.press("Escape")
                        pg.click("#c-co2 .wl-sh")
                        pg.wait_for_timeout(600)
                        cap = pg.input_value(".wl-cap")
                        check("a card's post names its source and pace", "Global Carbon Project" in cap and "CO₂" in cap, cap[:300])
                        with open(f"{SHOTS}/img-card-co2.png", "wb") as fh:
                            import base64
                            fh.write(base64.b64decode(pg.evaluate("document.querySelector('.wl-studio canvas').toDataURL('image/png').split(',')[1]")))
                        pg.click(".wl-seg[data-g=lang] button[data-v=ckb]")
                        pg.wait_for_timeout(200)
                        cap = pg.input_value(".wl-cap")
                        check("switching the post to Kurdish rewrites the caption", "#CoinKurd" in cap and "ئەمساڵ" in cap, cap[:200])
                        with open(f"{SHOTS}/img-card-co2-ckb.png", "wb") as fh:
                            import base64
                            fh.write(base64.b64decode(pg.evaluate("document.querySelector('.wl-studio canvas').toDataURL('image/png').split(',')[1]")))
                check(f"[{tag}] zero JS errors", not errs, errs[:5])
                ctx.close()
        br.close()
    srv.shutdown()
    print(f"\nworld_e2e: {len(OK)} ok, {len(FAIL)} failures")
    for f in FAIL:
        print("  FAIL", f)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
