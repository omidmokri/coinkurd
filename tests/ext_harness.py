# -*- coding: utf-8 -*-
"""Render the browser extension's popup outside the browser, for tests and store pictures.

The popup is opened as an ordinary page (http://localhost/chrome-extension/src/popup.html) with a small stand-in for
the chrome.* APIs it uses, and every request to https://entekhab.net/ is answered from this repository's own files
(data/market.json, api/v1/*.json …), so it runs with no network. Used by tests/test_extension_logo.py (THE LOGO RULE)
and by `python3 tests/ext_harness.py shots` (the Chrome Web Store screenshots in chrome-extension/store/).
"""
import functools
import http.server
import json
import os
import socketserver
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "chrome-extension", "src")
CHROME = os.environ.get("CHROME_BIN", "/usr/bin/google-chrome")
LANGS = ("ckb", "fa", "ar", "en")


def serve():
    """a quiet static server on a free port, rooted at the repository"""
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    h = functools.partial(Quiet, directory=ROOT)
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), h)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def _read(path):
    p = os.path.join(ROOT, path.lstrip("/"))
    if os.path.isfile(p):
        return open(p, "rb").read()
    return None


def state(lang, alerts=True):
    """what chrome.storage.local holds after a normal day of use"""
    market = json.loads(_read("data/market.json") or b"{}")
    posts = json.loads(_read("api/v1/posts_latest.json") or b'{"posts":[]}').get("posts", [])[:20]
    now = int(time.time() * 1000)
    s = {"lang": lang, "tip": "BTC", "notifyPosts": False, "market": market, "marketAt": now, "checkedAt": now,
         "live": {}, "posts": posts, "postsAt": now, "lastPostId": posts[0]["id"] if posts else 0}
    if alerts:
        s["alerts"] = [{"id": "a1", "coin": "BTC", "op": ">", "price": 80000, "at": now},
                       {"id": "a2", "coin": "ETH", "op": "<", "price": 2000, "at": now, "hit": now}]
    return s


STUB = r"""(() => {
  const mem = %(state)s, man = %(manifest)s, ls = [];
  const pick = keys => { if (keys == null) return JSON.parse(JSON.stringify(mem)); const o = {};
    if (typeof keys === 'string') keys = [keys];
    if (Array.isArray(keys)) keys.forEach(k => { if (k in mem) o[k] = mem[k]; });
    else for (const k in keys) o[k] = k in mem ? mem[k] : keys[k];
    return JSON.parse(JSON.stringify(o)); };
  window.chrome = {
    storage: { local: { get: async k => pick(k), set: async o => { Object.assign(mem, o); }, remove: async k => { [].concat(k).forEach(x => delete mem[x]); } },
               onChanged: { addListener: f => ls.push(f) } },
    runtime: { sendMessage: (m, cb) => setTimeout(() => cb && cb({ ok: true }), 30), getManifest: () => man },
    notifications: { getPermissionLevel: cb => cb && cb('granted') },
    i18n: { getMessage: () => '' }
  };
})();"""


def open_popup(ctx, base, lang, latest=None, scheme="dark", alerts=True):
    """a page showing the popup in `lang`; `latest` makes /extension/latest.json announce that version"""
    man = json.loads(_read("chrome-extension/src/manifest.json"))
    ctx.add_init_script(STUB % {"state": json.dumps(state(lang, alerts)), "manifest": json.dumps(man)})

    def site(route):
        path = route.request.url.split("entekhab.net", 1)[1].split("?", 1)[0]
        if path == "/extension/latest.json":
            body = json.dumps({"version": latest or man["version"]}).encode()
        else:
            body = _read(path)
        if body is None:
            return route.fulfill(status=404, body="not found")
        return route.fulfill(status=200, body=body, headers={"content-type": "application/json", "access-control-allow-origin": "*"})

    ctx.route("https://entekhab.net/**", site)
    ctx.route("https://data-api.binance.vision/**", lambda r: r.fulfill(status=503, body=""))
    pg = ctx.new_page()
    pg.emulate_media(color_scheme=scheme)
    pg.goto(base + "/chrome-extension/src/popup.html", wait_until="load")
    pg.wait_for_timeout(700)
    return pg


# what THE LOGO RULE means, measured: the logo is loaded, opaque, inside the popup, the top element at every point
# of its box, and no other element's box (other than its own ancestors) intersects it.
LOGO_CHECK = r"""(() => {
  const logo = document.getElementById('logo'); if (!logo) return { error: 'no #logo in the popup' };
  const r = logo.getBoundingClientRect(), cs = getComputedStyle(logo), out = [];
  if (!logo.complete || !logo.naturalWidth) out.push('the logo image did not load');
  if (cs.display === 'none' || cs.visibility !== 'visible' || +cs.opacity < 1) out.push('the logo is hidden or faded (' + cs.display + ' ' + cs.visibility + ' ' + cs.opacity + ')');
  if (r.width < 24 || r.height < 24) out.push('the logo is too small: ' + r.width + '×' + r.height);
  if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) out.push('the logo is cut by the popup edge');
  for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) {
    const x = r.left + r.width * i / 6, y = r.top + r.height * j / 6, top = document.elementFromPoint(x, y);
    if (top !== logo) { out.push('at (' + Math.round(x) + ',' + Math.round(y) + ') the logo is under <' + (top ? top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + (top.className ? '.' + String(top.className).split(' ')[0] : '') : 'nothing') + '>'); break; }
  }
  for (const el of document.querySelectorAll('body *')) {
    if (el === logo || el.contains(logo)) continue;
    const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') continue;
    const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    const w = Math.min(r.right, b.right) - Math.max(r.left, b.left), h = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
    if (w > 0.5 && h > 0.5) out.push('<' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '> overlaps the logo by ' + Math.round(w) + '×' + Math.round(h) + 'px');
  }
  return { problems: out, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
           height: document.documentElement.scrollHeight, header: document.querySelector('header').getBoundingClientRect().height };
})()"""


def shots(out_dir=None):
    """the Chrome Web Store screenshots (1280×800): the popup beside a short caption, in Persian"""
    from playwright.sync_api import sync_playwright
    out_dir = out_dir or os.path.join(ROOT, "chrome-extension", "store")
    srv, base = serve()
    cards = [
        ("market", "market", "قیمت زندهٔ کریپتو در مرورگر",
         "بیش از ۱۰۰ رمزارز، ترس و طمع، ارزش کل بازار و دامیننس بیت‌کوین.",
         ["قیمت بیت‌کوین با نگه‌داشتن ماوس روی آیکون", "کوردی · فارسی · العربية · English", "رایگان، بدون تبلیغ و بدون ردیابی"]),
        ("report", "report", "گزارش روزانهٔ بازار",
         "خلاصهٔ هوشمند هر روز بازار، همان گزارشی که سایت و ربات منتشر می‌کنند.",
         ["تحلیل آن‌چین و واقعیت‌سنج", "دانشنامهٔ ۵۰۶ مدخلی بازارهای مالی", "پست‌های تازهٔ کانال Coin_Kurd"]),
        ("alerts", "alerts", "هشدار قیمت و ماشین‌حساب",
         "وقتی کوین به قیمت دلخواه شما برسد، اعلان می‌گیرید.",
         ["حجم پوزیشن، ریسک به بازده، سود و زیان", "قیمت لیکوئید و کارمزد", "همهٔ تنظیمات فقط روی مرورگر شما"]),
    ]
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for name, tab, title, lead, bullets in cards:
            ctx = b.new_context(viewport={"width": 380, "height": 600}, device_scale_factor=2)
            pg = open_popup(ctx, base, "fa")
            pg.evaluate(f"document.querySelector('.tabs button[data-tab={tab}]').click()")
            pg.wait_for_timeout(900)
            png = os.path.join("/tmp", f"popup-{name}.png")
            h = min(600, pg.evaluate("document.documentElement.scrollHeight"))
            pg.screenshot(path=png, clip={"x": 0, "y": 0, "width": 380, "height": h})
            ctx.close()
            ctx = b.new_context(viewport={"width": 1280, "height": 800})
            pg = ctx.new_page()
            lis = "".join(f"<li>{x}</li>" for x in bullets)
            import base64
            b64 = base64.b64encode(open(png, "rb").read()).decode()
            pg.set_content(f"""<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><style>
              @font-face{{font-family:V;font-weight:400;src:url('{base}/fonts/Vazirmatn-Regular.ttf')}}@font-face{{font-family:V;font-weight:700;src:url('{base}/fonts/Vazirmatn-Bold.ttf')}}@font-face{{font-family:V;font-weight:900;src:url('{base}/fonts/Vazirmatn-Black.ttf')}}
              body{{margin:0;width:1280px;height:800px;background:radial-gradient(circle at 15% 0%,#3a2608 0,#0b0b0c 46%,#060606 100%);font-family:V,Tahoma,sans-serif;color:#f4f4f2;display:flex;align-items:center;justify-content:space-between;padding:0 90px;box-sizing:border-box;overflow:hidden}}
              .t{{width:560px}} .t img{{width:118px;height:118px;border-radius:28px;box-shadow:0 10px 40px rgba(247,147,26,.28),0 0 0 1px rgba(247,147,26,.35)}}
              h1{{font-size:46px;font-weight:900;line-height:1.4;margin:22px 0 12px;color:#f7931a;white-space:nowrap}} p{{font-size:25px;line-height:1.8;margin:0 0 18px;color:#e8e6e1}}
              ul{{margin:0;padding-inline-start:30px;font-size:23px;line-height:2;color:#cfcdc8}}
              .ph{{width:380px;border-radius:26px;overflow:hidden;border:1px solid rgba(247,147,26,.35);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 8px rgba(255,255,255,.03)}} .ph img{{display:block;width:380px}}
            </style></head><body><div class="t"><img src="{base}/chrome-extension/src/icons/icon128.png" alt=""><h1>{title}</h1><p>{lead}</p><ul>{lis}</ul></div>
            <div class="ph"><img src="data:image/png;base64,{b64}" alt=""></div></body></html>""", wait_until="load")
            pg.wait_for_timeout(600)
            pg.screenshot(path=os.path.join(out_dir, f"{name}.png"))
            ctx.close()
        # the popup itself, one picture per language, for the /extension/ page (WebP: light for Iranian connections)
        from PIL import Image
        for lg in ("fa", "ckb", "en"):
            ctx = b.new_context(viewport={"width": 380, "height": 600}, device_scale_factor=2)
            pg = open_popup(ctx, base, lg)
            pg.wait_for_timeout(600)
            h = min(600, pg.evaluate("document.documentElement.scrollHeight"))
            tmp = f"/tmp/popup-{lg}.png"
            pg.screenshot(path=tmp, clip={"x": 0, "y": 0, "width": 380, "height": h})
            ctx.close()
            Image.open(tmp).convert("RGB").save(os.path.join(out_dir, f"popup-{lg}.webp"), "WEBP", quality=80, method=6)
        # the small promo tile (440×280): the logo, whole and alone, and the name
        ctx = b.new_context(viewport={"width": 440, "height": 280})
        pg = ctx.new_page()
        pg.set_content(f"""<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
          @font-face{{font-family:V;font-weight:900;src:url('{base}/fonts/Vazirmatn-Black.ttf')}}@font-face{{font-family:V;font-weight:400;src:url('{base}/fonts/Vazirmatn-Regular.ttf')}}
          body{{margin:0;width:440px;height:280px;background:radial-gradient(circle at 50% 0%,#3a2608,#0b0b0c 70%);font-family:V,Tahoma,sans-serif;color:#f4f4f2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;overflow:hidden}}
          img{{width:112px;height:112px;border-radius:26px;box-shadow:0 10px 34px rgba(247,147,26,.3),0 0 0 1px rgba(247,147,26,.35)}} b{{font-size:30px;font-weight:900;color:#f7931a}} span{{font-size:16px;color:#cfcdc8}}
        </style></head><body><img src="{base}/chrome-extension/src/icons/icon128.png" alt=""><b>انتخاب | Entekhab</b><span>قیمت کریپتو، گزارش بازار و دانشنامه</span></body></html>""", wait_until="load")
        pg.wait_for_timeout(400)
        pg.screenshot(path=os.path.join(out_dir, "promo-440x280.png"))
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["shots"]:
        shots()
        print("store pictures written to chrome-extension/store/")
