"""
Harness for the «نبرد من» scene (battle/): serves the site locally, feeds it a synthetic market (tests/battle_stub.js)
and opens it in headless Chrome, so the scene can be inspected, measured and photographed without the exchanges.

    from battle_harness import Battle
    with Battle(gpu=True) as b:
        b.wait_ready()
        b.free_cam((0, 40, 90), (0, 0, 0))
        b.shot("tests/out/field.png")

gpu=True reports a hardware renderer to the page, so it takes the path real visitors with a graphics card get
(standard materials, shadows, full detail) instead of the software-renderer lite tier.
"""
import functools
import http.server
import os
import socketserver
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tests", "out")
STUB = open(os.path.join(ROOT, "tests", "battle_stub.js"), encoding="utf-8").read()
AUDIT = open(os.path.join(ROOT, "tests", "battle_audit.js"), encoding="utf-8").read()

GPU_SPOOF = """(() => { const f = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function (p) { if (p === 0x9246) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)'; return f.call(this, p); };
  if (window.WebGL2RenderingContext) { const g = WebGL2RenderingContext.prototype.getParameter; WebGL2RenderingContext.prototype.getParameter = function (p) { if (p === 0x9246) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)'; return g.call(this, p); }; } })();"""

# a free camera: while window.__cam is set the director hands the frame to it
FREE_CAM = """(() => { const iv = setInterval(() => {
  if (typeof DIRECTOR === 'undefined' || !DIRECTOR.tick || DIRECTOR.__wrapped) return;
  const orig = DIRECTOR.tick.bind(DIRECTOR); DIRECTOR.__wrapped = true;
  DIRECTOR.tick = function (dt, dtr) { const c = window.__cam; if (!c) return orig(dt, dtr);
    cam.position.set(c.p[0], c.p[1], c.p[2]); cam.up.set(0, 1, 0); cam.lookAt(c.t[0], c.t[1], c.t[2]);
    if (c.fov && cam.fov !== c.fov) { cam.fov = c.fov; cam.updateProjectionMatrix(); } this.letter(false); return cam; };
  clearInterval(iv); }, 20); })();"""


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Battle:
    def __init__(self, gpu=True, quality="high", w=1280, h=720, port=8765, cam="orbit", lang=None, audit=False):
        self.gpu, self.quality, self.w, self.h, self.port, self.cam, self.lang, self.audit = gpu, quality, w, h, port, cam, lang, audit
        self.logs = []

    def __enter__(self):
        handler = functools.partial(_Quiet, directory=ROOT)
        socketserver.TCPServer.allow_reuse_address = True
        self.httpd = socketserver.ThreadingTCPServer(("127.0.0.1", self.port), handler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True,
                                               args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
                                                     "--autoplay-policy=no-user-gesture-required"])
        self.ctx = self.browser.new_context(viewport={"width": self.w, "height": self.h}, device_scale_factor=1)
        pref = '{"quality":"%s","cam":"%s","snd":false,"motion":"full"}' % (self.quality, self.cam)
        init = "try{localStorage.setItem('ek_bf_pref',JSON.stringify(%s));localStorage.setItem('ek_bf_gpu','1');%s}catch(e){}" % (
            pref, ("localStorage.setItem('ek_lang','%s');" % self.lang) if self.lang else "")
        self.ctx.add_init_script(init)
        if self.gpu:
            self.ctx.add_init_script(GPU_SPOOF)
        if self.audit:
            self.ctx.add_init_script(AUDIT)
        self.ctx.add_init_script(STUB)
        self.ctx.add_init_script(FREE_CAM)
        self.page = self.ctx.new_page()
        self.page.on("console", lambda m: self.logs.append((m.type, m.text)))
        self.page.on("pageerror", lambda e: self.logs.append(("pageerror", (getattr(e, "stack", None) or str(e))[:600])))
        self.page.goto("http://127.0.0.1:%d/battle/" % self.port, wait_until="load", timeout=120000)
        return self

    def __exit__(self, *a):
        try:
            self.browser.close()
            self.pw.stop()
        finally:
            self.httpd.shutdown()
            self.httpd.server_close()

    def js(self, code, arg=None):
        return self.page.evaluate(code, arg)

    def wait_ready(self, timeout=180, units=True):
        t0 = time.time()
        while time.time() - t0 < timeout:
            ok = self.js("() => typeof R3 !== 'undefined' && R3 && !!(typeof L !== 'undefined' && L.round) && (typeof ARMY !== 'undefined')")
            if ok and (not units or self.js("() => ARMY.sides.bull.sold.length + ARMY.sides.bear.sold.length > 20")):
                return True
            time.sleep(1)
        raise TimeoutError("scene not ready: " + repr(self.logs[-10:]))

    def free_cam(self, p, t, fov=46):
        self.js("([p,t,f]) => { window.__cam = {p, t, fov: f}; }", [list(p), list(t), fov])

    def clean(self):
        # inspection shots: no HUD, no site chrome
        self.page.add_style_tag(content=".hud,.ekh,.ekb,.ek-skip,[class*='fab'],[id*='help'],#flash{display:none!important}")

    def director(self):
        self.js("() => { window.__cam = null; }")

    def frames(self, n=3):
        # let the page draw n frames
        self.js("(n) => new Promise(r => { let k = 0; const f = () => { if (++k >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); })", n)

    def shot(self, path, frames=3):
        self.frames(frames)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.page.screenshot(path=path)
        return path

    def errors(self):
        return [l for l in self.logs if l[0] in ("error", "pageerror")]
