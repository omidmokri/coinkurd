# -*- coding: utf-8 -*-
"""
infocard.py — Coin_Kurd «Cyberpunk Financial Intelligence Dashboard» images (1080×1350, Instagram portrait).

Built from the owner's visual prompt (Senior Creative Director + Cyberpunk Visual Architect):
  header      official logo (fixed brand asset) + Persian headline + holographic divider
  hero        the biggest number of the story as a holographic statistic
  dashboard   3D-tilted data panel: BTC chart + live market rows (Binance)
  glass card  market-analysis card (glassmorphism)
  terminal    «ترمینال تحلیل هوش مصنوعی»
  footer      «کانال کوین کورد» (the ONLY place the channel name appears) + «با ما بروز بمانید»

Every image is unique: one of 20 environments (no environment repeats until all 20 were used), one of
8 colour systems A–H (never the same twice in a row), random light angle, HUD style and chart style.

Golden logo rule: assets/brand/coinkurd-logo.png is pasted exactly as it is — only scaled down proportionally
(LANCZOS, aspect ratio kept, never enlarged). No glow, shadow, tint, crop or effect is ever applied to it.

Persian text: everything is shaped (raqm, or arabic_reshaper + python-bidi) and checked BEFORE drawing.
If correct Persian shaping is not available, render() raises TextError instead of producing an image with
reversed, disconnected letters (the bug of 4 Nov 2026: scripts/bidi.py shadowed python-bidi).
"""
import hashlib
import io
import json
import logging
import math
import os
import random
import re
import time
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFilter, ImageFont

log = logging.getLogger("infocard")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "assets", "fonts", "Vazirmatn-Bold.ttf")
LOGO = os.path.join(ROOT, "assets", "brand", "coinkurd-logo.png")
W, H = 1080, 1350
M = 56                                   # side margin
CHANNEL = "کانال کوین کورد"
SLOGAN = "با ما بروز بمانید"


class TextError(RuntimeError):
    """Persian text cannot be rendered correctly — never publish the image"""


# =========================================================== 1. Persian text: shape + verify
EMOJI = re.compile("[\U0001F000-\U0001FFFF☀-➿⬀-⯿️‍⃣←-⇿■-◿]")
CTRL = re.compile("[‎‏‪-‮⁦-⁩﻿]")   # bidi controls (ZWNJ U+200C is kept)
RTL_CH = re.compile("[؀-ۿﭐ-﷿ﹰ-﻿]")
ARABIC_LETTER = re.compile("[ء-يپچژکگی]")
PRESENTATION = re.compile("[ﭐ-﷿ﹰ-﻿]")
FA_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
_mode = {"v": "?"}
_cmap = {}
_fonts = {}


def _get_display():
    """python-bidi's get_display — never a same-named file in scripts/ (that shadowing caused the 4 Nov bug)"""
    import sys
    here = os.path.dirname(os.path.abspath(__file__))
    mod = sys.modules.get("bidi")
    if mod is not None and os.path.dirname(os.path.abspath(getattr(mod, "__file__", "") or "")) == here:
        del sys.modules["bidi"]
    saved = sys.path[:]
    sys.path[:] = [p for p in sys.path if os.path.abspath(p or os.getcwd()) != here]
    try:
        try:
            from bidi import get_display            # python-bidi ≥ 0.5
        except ImportError:
            from bidi.algorithm import get_display  # python-bidi 0.4.x
        return get_display
    finally:
        sys.path[:] = saved


def mode():
    """'raqm' | 'basic' | None — decided once, then self-tested"""
    if _mode["v"] != "?":
        return _mode["v"]
    m = None
    try:
        from PIL import features
        if features.check("raqm"):
            m = "raqm"
    except Exception:
        pass
    if m is None:
        try:
            import arabic_reshaper  # noqa: F401
            _get_display()
            m = "basic"
        except Exception as ex:
            log.error("no Persian shaper (install arabic-reshaper + python-bidi): %s", ex)
    _mode["v"] = m
    if m and not _selftest():
        log.error("Persian shaping self-test failed in mode %s", m)
        _mode["v"] = None
    return _mode["v"]


def font(size):
    m = mode()
    key = (size, m)
    if key not in _fonts:
        eng = ImageFont.Layout.RAQM if m == "raqm" else ImageFont.Layout.BASIC
        _fonts[key] = ImageFont.truetype(FONT, size, layout_engine=eng)
    return _fonts[key]


def clean(s):
    """emoji, bidi controls, HTML and Arabic look-alike letters out; Persian Yeh/Kaf in"""
    s = re.sub(r"</?\w+[^>]*>", "", str(s or ""))
    s = EMOJI.sub("", s)
    s = CTRL.sub("", s)
    s = s.replace("ي", "ی").replace("ك", "ک").replace(" ", " ")
    s = s.replace(" ← ", " • ").replace("→", "•").replace("←", "•")
    s = re.sub(r"(?<=[۰-۹])[.](?=[۰-۹])", "٫", s)          # 1.61 → ۱٫۶۱ (Persian decimal separator)
    s = re.sub(r"(?<=[۰-۹]),(?=[۰-۹]{3})", "٬", s)
    return re.sub(r"\s{2,}", " ", s).strip(" •-–—|")


def is_rtl(s):
    return bool(RTL_CH.search(s))


def shape(s):
    """string ready to be drawn by the current engine"""
    m = mode()
    if m is None:
        raise TextError("no Persian shaper available")
    if m == "raqm" or not is_rtl(s):
        return s
    import arabic_reshaper
    return _get_display()(arabic_reshaper.reshape(s))


def _kw(s):
    return {"direction": "rtl" if is_rtl(s) else "ltr"} if mode() == "raqm" else {}


def textw(f, s):
    return f.getlength(shape(s), **_kw(s))


def _selftest():
    """a joined Persian word must be narrower than its letters drawn one by one"""
    try:
        f = font(40)
        one, word = textw(f, "ب"), textw(f, "ببب")
        if not word < 3 * one - 2:
            return False
        if _mode["v"] == "basic":                   # visual order must be reversed: last letter drawn first
            sh = shape("سب")
            return PRESENTATION.search(sh) is not None and sh[0] in "ﺐﺒﺏﺐ"
        return True
    except Exception:
        log.exception("self-test crashed")
        return False


def _glyphs():
    if "c" not in _cmap:
        try:
            from fontTools.ttLib import TTFont
            _cmap["c"] = set(TTFont(FONT).getBestCmap())
        except Exception:
            _cmap["c"] = None
    return _cmap["c"]


def verify(s):
    """problems that would make the Persian text wrong or unreadable in the image ([] = good)"""
    p = []
    if mode() is None:
        return ["شکل‌دهی حروف فارسی در دسترس نیست"]
    if "�" in s:
        p.append("کاراکتر خراب (�)")
    cm = _glyphs()
    if cm:
        miss = sorted({c for c in s if ord(c) not in cm and c not in " ‌\n"})
        if miss:
            p.append("نویسه بدون حرف در فونت: " + " ".join(miss))
    if mode() == "basic" and ARABIC_LETTER.search(s):
        sh = shape(s)
        if not PRESENTATION.search(sh):
            p.append("حروف فارسی به هم نچسبیده‌اند")
    if re.search(r"(.)\1{4,}", s):
        p.append("تکرار غیرعادی نویسه")
    return p


def safe(s):
    """clean + verify; drops glyph-less characters, raises TextError when Persian cannot be shaped"""
    s = clean(s)
    pr = verify(s)
    if pr and mode() is None:
        raise TextError(pr[0])
    if pr:
        cm = _glyphs()
        if cm:
            s = "".join(c for c in s if ord(c) in cm or c in " ‌")
        pr = verify(s)
        if pr:
            raise TextError("؛ ".join(pr))
    return s


def wrap(s, f, width):
    words, lines, cur = s.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if not cur or textw(f, t) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit(s, sizes, width, max_lines):
    """largest font size whose wrap fits; last size is clipped with an ellipsis"""
    for sz in sizes:
        f = font(sz)
        ls = wrap(s, f, width)
        if len(ls) <= max_lines:
            return f, sz, ls
    ls = ls[:max_lines]
    while ls and textw(f, ls[-1] + " …") > width and " " in ls[-1]:
        ls[-1] = ls[-1].rsplit(" ", 1)[0]
    ls[-1] = ls[-1] + " …"
    return f, sz, ls


def rtext(d, xr, y, s, f, fill):
    """right-aligned line ending at x = xr"""
    d.text((xr - textw(f, s), y), shape(s), font=f, fill=fill, **_kw(s))


def ctext(d, cx, y, s, f, fill):
    d.text((cx - textw(f, s) / 2, y), shape(s), font=f, fill=fill, **_kw(s))


def ltext(d, xl, y, s, f, fill):
    d.text((xl, y), shape(s), font=f, fill=fill, **_kw(s))


def fa_num(x, dec=0):
    return f"{x:,.{dec}f}".replace(",", "٬").replace(".", "٫").translate(FA_DIGITS)


def jalali(dt):
    gy, gm, gd = dt.year, dt.month, dt.day
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + 365 * gy + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400 + gd + g_d_m[gm - 1]
    jy = -1595 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    jm = 1 + days // 31 if days < 186 else 7 + (days - 186) // 30
    jd = 1 + (days % 31 if days < 186 else (days - 186) % 30)
    months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"]
    return f"{str(jd).translate(FA_DIGITS)} {months[jm - 1]} {str(jy).translate(FA_DIGITS)}"


# =========================================================== 2. visual engine (environments, colours, HUD)
ENVIRONMENTS = [
    "Neo Tokyo Megacity", "Underground Crypto Bunker", "Quantum Trading Nexus", "AI Financial Citadel",
    "Cyber Desert Data Station", "Orbital Space Exchange", "Metaverse Financial District",
    "Digital Ocean Command Center", "Neon Industrial Megacomplex", "Holographic Data Cathedral",
    "Arctic Quantum Lab", "Floating Sky Market", "Deep Space Blockchain Station", "Futuristic Crypto Observatory",
    "Hyperloop Financial Hub", "Cyber Jungle Network", "Autonomous AI Capital City", "Dark Matter Trading Core",
    "Virtual Reality Economic Grid", "Interplanetary Finance Center",
]
PALETTES = {  # primary, secondary, accent, sky-top, sky-bottom
    "A": ((0, 240, 255), (255, 0, 200), (255, 255, 255), (4, 8, 22), (18, 6, 40)),        # cyan × magenta
    "B": ((255, 46, 196), (140, 70, 255), (255, 220, 250), (14, 3, 22), (40, 6, 48)),     # magenta × violet
    "C": ((0, 255, 160), (0, 200, 255), (220, 255, 240), (2, 16, 16), (4, 30, 34)),       # emerald × cyan
    "D": ((255, 196, 40), (255, 120, 0), (255, 245, 210), (16, 10, 2), (36, 18, 4)),      # gold × amber
    "E": ((168, 90, 255), (60, 140, 255), (236, 224, 255), (8, 4, 26), (22, 10, 52)),     # violet × blue
    "F": ((60, 160, 255), (160, 240, 255), (230, 245, 255), (2, 8, 26), (6, 22, 50)),     # electric blue × ice
    "G": ((255, 60, 80), (255, 150, 40), (255, 230, 220), (20, 2, 8), (44, 8, 12)),       # crimson × orange
    "H": ((180, 255, 40), (0, 230, 200), (240, 255, 220), (6, 14, 4), (10, 28, 20)),      # lime × teal
}
CHARTS = ["area", "line", "candles", "bars"]
HUDS = ["brackets", "hex", "rails", "ticks"]


def pick_theme(hist=None, seed=None):
    """choose environment / colour system / chart / HUD without repeating; hist (state dict) is updated"""
    hist = hist if hist is not None else {}
    rnd = random.Random(hashlib.sha256(str(seed if seed is not None else time.time_ns()).encode()).digest())
    used = hist.setdefault("envs", [])[-(len(ENVIRONMENTS) - 1):]
    env = rnd.choice([e for e in ENVIRONMENTS if e not in used] or ENVIRONMENTS)
    lastp = (hist.setdefault("pals", []) or [""])[-1]
    pal = rnd.choice([k for k in PALETTES if k != lastp])
    lastc = (hist.setdefault("charts", []) or [""])[-1]
    chart = rnd.choice([c for c in CHARTS if c != lastc])
    lasth = (hist.setdefault("huds", []) or [""])[-1]
    hud = rnd.choice([x for x in HUDS if x != lasth])
    for k, v in (("envs", env), ("pals", pal), ("charts", chart), ("huds", hud)):
        hist[k].append(v)
        del hist[k][:-40]
    return {"env": env, "pal": pal, "chart": chart, "hud": hud, "seed": rnd.randrange(1 << 30),
            "light": rnd.uniform(-0.9, 0.9), "tilt": rnd.uniform(0.05, 0.11)}


def _rgba(c, a):
    return tuple(c[:3]) + (int(a),)


def _mix(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def _glow(base, layer, radius=18, strength=1):
    g = layer.filter(ImageFilter.GaussianBlur(radius))
    for _ in range(strength):
        base.alpha_composite(g)
    base.alpha_composite(layer)


# --- background primitives (all draw on RGBA layers) ---
def _sky(t, im):
    _, _, _, top, bot = PALETTES[t["pal"]]
    d = ImageDraw.Draw(im)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=_mix(top, bot, (y / H) ** 1.3) + (255,))


def _stars(rnd, im, n, col):
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x, y, r = rnd.randrange(W), rnd.randrange(int(H * 0.75)), rnd.choice([1, 1, 1, 2])
        d.ellipse([x - r, y - r, x + r, y + r], fill=_rgba(col, rnd.randint(60, 220)))


def _skyline(rnd, im, base_y, layers, prim, sec, tall=1.0, chimneys=False, tower=False):
    for li in range(layers):
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        depth = (li + 1) / layers
        shade = _mix((6, 8, 16), prim, 0.06 + 0.10 * (1 - depth))
        x = -20
        while x < W:
            bw = rnd.randint(40, 120)
            bh = int(rnd.randint(120, 520) * tall * (0.55 + 0.6 * (1 - depth)))
            top = base_y - bh + li * 40
            d.rectangle([x, top, x + bw, H], fill=shade + (255,))
            for wy in range(top + 14, base_y, rnd.choice([16, 22, 28])):
                for wx in range(x + 6, x + bw - 6, 12):
                    if rnd.random() < 0.22:
                        d.rectangle([wx, wy, wx + 5, wy + 7], fill=_rgba(rnd.choice([prim, sec]), 90 + 120 * depth))
            if rnd.random() < 0.3:
                d.line([(x + bw // 2, top), (x + bw // 2, top - rnd.randint(20, 80))], fill=_rgba(sec, 200), width=2)
            if chimneys and rnd.random() < 0.25:
                d.rectangle([x + 8, top - 90, x + 26, top], fill=shade + (255,))
            x += bw + rnd.randint(0, 10)
        if tower and li == layers - 1:
            cx = W // 2 + rnd.randint(-200, 200)
            d.polygon([(cx - 70, H), (cx - 30, base_y - 820), (cx, base_y - 900), (cx + 30, base_y - 820), (cx + 70, H)],
                      fill=_mix((6, 8, 16), prim, 0.12) + (255,))
            d.line([(cx, base_y - 900), (cx, base_y - 1000)], fill=_rgba(prim, 255), width=3)
        im.alpha_composite(lay)
    edge = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rectangle([0, base_y - 6, W, base_y + 6], fill=_rgba(prim, 90))
    im.alpha_composite(edge.filter(ImageFilter.GaussianBlur(14)))


def _grid(im, horizon, col, ceiling=False, alpha=120):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    cx = W / 2
    for side in ([1, -1] if ceiling else [1]):
        for i in range(-14, 15):
            x2 = cx + i * 160
            if side > 0:
                d.line([(cx + i * 8, horizon), (x2, H)], fill=_rgba(col, alpha), width=2)
            else:
                d.line([(cx + i * 8, horizon - 40), (x2, 0)], fill=_rgba(col, alpha * 0.6), width=2)
        for k in range(1, 18):
            yy = (k / 17) ** 2.2
            y = horizon + yy * (H - horizon) if side > 0 else horizon - 40 - yy * (horizon - 40)
            d.line([(0, y), (W, y)], fill=_rgba(col, alpha * (0.3 + 0.7 * yy) * (1 if side > 0 else 0.6)), width=2)
    _glow(im, lay, 6)


def _planet(rnd, im, cx, cy, r, prim, sec, ring=True):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    lx, ly = -0.45, -0.45                                  # lit from the upper left
    for k in range(r, 0, -3):
        t = k / r
        ox, oy = cx + lx * (r - k), cy + ly * (r - k)
        d.ellipse([ox - k, oy - k, ox + k, oy + k], fill=_mix((6, 6, 18), sec, (1 - t) ** 0.7 * 0.95) + (255,))
    for k in range(6):
        yy = cy - r + (k + 1) * 2 * r / 7
        d.arc([cx - r, yy - 18, cx + r, yy + 18], 0, 180, fill=_rgba(prim, 60), width=2)
    if ring:
        d.ellipse([cx - r * 1.9, cy - r * 0.35, cx + r * 1.9, cy + r * 0.35], outline=_rgba(prim, 200), width=4)
    _glow(im, lay, 30)


def _network(rnd, im, n, col, maxd=200, alpha=70):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    pts = [(rnd.randrange(W), rnd.randrange(H)) for _ in range(n)]
    for i, a in enumerate(pts):
        for b in pts[i + 1:]:
            dist = math.dist(a, b)
            if dist < maxd:
                d.line([a, b], fill=_rgba(col, alpha * (1 - dist / maxd)), width=1)
    for p in pts:
        d.rectangle([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=_rgba(col, 170))
    _glow(im, lay, 4)


def _particles(rnd, im, n, cols):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(n):
        x, y, r = rnd.randrange(W), rnd.randrange(H), rnd.uniform(1, 4)
        d.ellipse([x - r, y - r, x + r, y + r], fill=_rgba(rnd.choice(cols), rnd.randint(80, 230)))
    _glow(im, lay, 5)


def _streams(rnd, im, col, n=40):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(n):
        x = rnd.randrange(W)
        y = rnd.randrange(-200, H)
        for k in range(rnd.randint(6, 26)):
            d.rectangle([x, y + k * 14, x + 3, y + k * 14 + 8], fill=_rgba(col, max(0, 160 - k * 7)))
    _glow(im, lay, 3)


def _arches(rnd, im, col, n=5):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for k in range(n):
        w = W * (1.3 - k * 0.2)
        x0 = (W - w) / 2
        top = 120 + k * 110
        d.arc([x0, top, x0 + w, top + w * 0.9], 180, 360, fill=_rgba(col, 150 - k * 20), width=5)
        d.line([(x0, top + w * 0.45), (x0, H)], fill=_rgba(col, 120 - k * 18), width=5)
        d.line([(x0 + w, top + w * 0.45), (x0 + w, H)], fill=_rgba(col, 120 - k * 18), width=5)
    _glow(im, lay, 10)


def _dunes(rnd, im, base, prim, sec):
    for k in range(4):
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        ph, amp = rnd.uniform(0, 6), rnd.randint(20, 60)
        y0 = base + k * 70
        pts = [(x, y0 + math.sin(x / rnd.randint(140, 260) + ph) * amp) for x in range(0, W + 20, 20)]
        d.polygon(pts + [(W, H), (0, H)], fill=_mix((10, 8, 10), prim, 0.08 + k * 0.05) + (255,))
        d.line(pts, fill=_rgba(sec, 140), width=2)
        im.alpha_composite(lay)


def _waves(rnd, im, base, col):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for k in range(26):
        y0 = base + (k / 25) ** 1.6 * (H - base)
        ph, amp = rnd.uniform(0, 6), 4 + k * 0.9
        pts = [(x, y0 + math.sin(x / (40 + k * 6) + ph) * amp) for x in range(0, W + 10, 10)]
        d.line(pts, fill=_rgba(col, 40 + k * 5), width=2)
    _glow(im, lay, 6)


def _mountains(rnd, im, base, col, ice):
    for k in range(3):
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        x, pts = -100, []
        while x < W + 150:
            pts += [(x, base + k * 80), (x + rnd.randint(80, 180), base - rnd.randint(150, 420) + k * 90)]
            x += rnd.randint(160, 320)
        pts += [(W + 150, base + k * 80), (W, H), (0, H)]
        d.polygon(pts, fill=_mix((8, 12, 22), ice, 0.12 + k * 0.08) + (255,))
        d.line(pts[:-2], fill=_rgba(col, 120), width=2)
        im.alpha_composite(lay)


def _aurora(rnd, im, prim, sec):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for k in range(3):
        ph = rnd.uniform(0, 6)
        y0 = 180 + k * 90
        pts = [(x, y0 + math.sin(x / 170 + ph) * 60) for x in range(0, W + 20, 20)]
        d.line(pts, fill=_rgba(prim if k % 2 == 0 else sec, 160), width=26)
    im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(28)))


def _clouds(rnd, im, col, n=14):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(n):
        x, y = rnd.randrange(-100, W), rnd.randrange(300, H)
        w, h = rnd.randint(200, 480), rnd.randint(50, 110)
        d.ellipse([x, y, x + w, y + h], fill=_rgba(_mix((30, 30, 50), col, 0.3), 110))
    im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(22)))


def _platforms(rnd, im, prim, sec, n=5):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(n):
        cx, cy, w = rnd.randrange(80, W - 80), rnd.randrange(450, H - 150), rnd.randint(140, 280)
        d.ellipse([cx - w / 2, cy - 18, cx + w / 2, cy + 18], fill=_rgba((20, 22, 36), 255), outline=_rgba(prim, 220), width=3)
        for b in range(rnd.randint(2, 5)):
            bx = cx - w / 2 + 20 + b * (w - 40) / 5
            bh = rnd.randint(40, 160)
            d.rectangle([bx, cy - bh, bx + 22, cy - 6], fill=_rgba((16, 18, 30), 255), outline=_rgba(sec, 160))
        d.polygon([(cx - 30, cy + 18), (cx + 30, cy + 18), (cx, cy + 70)], fill=_rgba(prim, 90))
    _glow(im, lay, 8)


def _tubes(rnd, im, col, cx, cy):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for k in range(1, 16):
        r = 18 * k ** 1.6
        d.ellipse([cx - r, cy - r * 0.62, cx + r, cy + r * 0.62], outline=_rgba(col, max(30, 210 - k * 11)), width=3)
    for a in range(0, 360, 30):
        x2, y2 = cx + math.cos(math.radians(a)) * 1400, cy + math.sin(math.radians(a)) * 870
        d.line([(cx, cy), (x2, y2)], fill=_rgba(col, 50), width=2)
    _glow(im, lay, 8)


def _vortex(rnd, im, prim, sec, cx, cy):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for arm in range(5):
        pts = []
        for k in range(260):
            a = k * 0.045 + arm * 2 * math.pi / 5
            r = 6 + k * 2.6
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r * 0.7))
        d.line(pts, fill=_rgba(prim if arm % 2 else sec, 120), width=3)
    d.ellipse([cx - 40, cy - 30, cx + 40, cy + 30], fill=(0, 0, 0, 255), outline=_rgba(prim, 255), width=4)
    _glow(im, lay, 12, 2)


def _vines(rnd, im, prim, sec):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(18):
        x0, amp, ph = rnd.randrange(W), rnd.randint(20, 70), rnd.uniform(0, 6)
        ln = rnd.randint(300, 1100)
        pts = [(x0 + math.sin(y / 90 + ph) * amp, y) for y in range(0, ln, 12)]
        d.line(pts, fill=_rgba(_mix((10, 40, 20), prim, 0.4), 200), width=rnd.randint(3, 8))
        for p in pts[::9]:
            d.ellipse([p[0] - 9, p[1] - 4, p[0] + 9, p[1] + 4], fill=_rgba(sec, 120))
    _glow(im, lay, 5)


def _bunker(rnd, im, prim, sec):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for y in range(0, H, 150):
        for x in range(0, W, 216):
            d.rectangle([x + 4, y + 4, x + 212, y + 146], fill=(22, 24, 30, 255), outline=(40, 44, 52, 255), width=2)
    for k in range(7):                                    # server racks
        x = 30 + k * 150
        d.rectangle([x, 700, x + 110, 1350], fill=(10, 12, 18, 255), outline=_rgba(prim, 120), width=2)
        for yy in range(720, 1340, 26):
            for xx in range(x + 12, x + 100, 14):
                if rnd.random() < 0.5:
                    d.rectangle([xx, yy, xx + 6, yy + 4], fill=_rgba(rnd.choice([prim, sec]), 200))
    for x in range(80, W, 260):                           # ceiling lights
        d.rectangle([x, 40, x + 140, 50], fill=_rgba(prim, 255))
    _glow(im, lay, 10)


def _dome(rnd, im, prim, sec):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    cx, cy, r = W * rnd.uniform(0.3, 0.7), 1120, 300
    d.pieslice([cx - r, cy - r, cx + r, cy + r], 180, 360, fill=(14, 16, 26, 255), outline=_rgba(prim, 220), width=4)
    d.rectangle([cx - r, cy, cx + r, H], fill=(14, 16, 26, 255))
    for a in range(200, 345, 18):
        d.line([(cx, cy), (cx + math.cos(math.radians(a)) * r, cy + math.sin(math.radians(a)) * r)], fill=_rgba(prim, 70), width=2)
    beam = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(beam).polygon([(cx - 10, cy - r + 10), (cx + 10, cy - r + 10), (cx + 340, 0), (cx + 200, 0)], fill=_rgba(sec, 70))
    im.alpha_composite(beam.filter(ImageFilter.GaussianBlur(14)))
    _glow(im, lay, 8)


def _cubes(rnd, im, prim, sec, n=12):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(n):
        x, y, s = rnd.randrange(W), rnd.randrange(200, H - 200), rnd.randint(30, 90)
        o = s * 0.4
        c = rnd.choice([prim, sec])
        d.rectangle([x, y, x + s, y + s], outline=_rgba(c, 200), width=2)
        d.rectangle([x + o, y - o, x + s + o, y + s - o], outline=_rgba(c, 120), width=2)
        for a, b in (((x, y), (x + o, y - o)), ((x + s, y), (x + s + o, y - o)), ((x, y + s), (x + o, y + s - o)),
                     ((x + s, y + s), (x + s + o, y + s - o))):
            d.line([a, b], fill=_rgba(c, 140), width=2)
    _glow(im, lay, 6)


def _rain(rnd, im, col):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(260):
        x, y, ln = rnd.randrange(W), rnd.randrange(H), rnd.randint(20, 60)
        d.line([(x, y), (x - 6, y + ln)], fill=_rgba(col, rnd.randint(30, 90)), width=1)
    im.alpha_composite(lay)


def _beam(t, im, col):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    x = W / 2 + t["light"] * W * 0.6
    ImageDraw.Draw(lay).polygon([(x - 40, 0), (x + 40, 0), (x + 420 * t["light"] + 300, H), (x + 420 * t["light"] - 300, H)],
                                fill=_rgba(col, 34))
    im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(40)))


def _bloom(t, im, rnd):
    """cinematic key light + rim light in the colour system"""
    prim, sec = PALETTES[t["pal"]][:2]
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    kx = W / 2 + t["light"] * W * 0.45
    d.ellipse([kx - 520, -260, kx + 520, 620], fill=_rgba(prim, 95))
    rx = W - kx
    d.ellipse([rx - 460, H - 620, rx + 460, H + 200], fill=_rgba(sec, 80))
    im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(150)))


def background(t):
    """the environment scene, without any text"""
    rnd = random.Random(t["seed"])
    prim, sec, acc = PALETTES[t["pal"]][:3]
    im = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    _sky(t, im)
    _bloom(t, im, rnd)
    e = t["env"]
    if e == "Neo Tokyo Megacity":
        _stars(rnd, im, 60, acc); _skyline(rnd, im, 1180, 3, prim, sec, 1.2); _rain(rnd, im, sec); _network(rnd, im, 25, prim)
    elif e == "Underground Crypto Bunker":
        _bunker(rnd, im, prim, sec); _streams(rnd, im, prim, 20)
    elif e == "Quantum Trading Nexus":
        _grid(im, 820, prim); _particles(rnd, im, 220, [prim, sec, acc]); _tubes(rnd, im, sec, W // 2, 560)
    elif e == "AI Financial Citadel":
        _skyline(rnd, im, 1220, 2, prim, sec, 0.9, tower=True); _arches(rnd, im, sec, 3); _beam(t, im, prim)
    elif e == "Cyber Desert Data Station":
        _planet(rnd, im, int(W * rnd.uniform(0.25, 0.75)), 420, 130, prim, sec, ring=False)
        _dunes(rnd, im, 960, prim, sec); _network(rnd, im, 18, prim, 260)
    elif e == "Orbital Space Exchange":
        _stars(rnd, im, 400, acc); _planet(rnd, im, int(W * rnd.uniform(0.2, 0.8)), 980, 330, prim, sec); _tubes(rnd, im, prim, W // 2, 380)
    elif e == "Metaverse Financial District":
        _grid(im, 900, prim); _cubes(rnd, im, prim, sec, 16); _skyline(rnd, im, 900, 1, prim, sec, 0.5)
    elif e == "Digital Ocean Command Center":
        _stars(rnd, im, 120, acc); _waves(rnd, im, 860, prim); _streams(rnd, im, sec, 30)
    elif e == "Neon Industrial Megacomplex":
        _skyline(rnd, im, 1200, 3, prim, sec, 1.0, chimneys=True); _clouds(rnd, im, sec, 10); _beam(t, im, sec)
    elif e == "Holographic Data Cathedral":
        _arches(rnd, im, prim, 6); _streams(rnd, im, sec, 50); _beam(t, im, acc)
    elif e == "Arctic Quantum Lab":
        _stars(rnd, im, 150, acc); _aurora(rnd, im, prim, sec); _mountains(rnd, im, 1000, prim, (180, 220, 255)); _particles(rnd, im, 120, [acc, prim])
    elif e == "Floating Sky Market":
        _clouds(rnd, im, prim, 18); _platforms(rnd, im, prim, sec, 6); _particles(rnd, im, 80, [acc])
    elif e == "Deep Space Blockchain Station":
        _stars(rnd, im, 600, acc); _network(rnd, im, 70, prim, 220, 110); _planet(rnd, im, int(W * rnd.uniform(0.6, 0.9)), 300, 90, prim, sec)
    elif e == "Futuristic Crypto Observatory":
        _stars(rnd, im, 500, acc); _dome(rnd, im, prim, sec)
    elif e == "Hyperloop Financial Hub":
        _tubes(rnd, im, prim, int(W * rnd.uniform(0.35, 0.65)), 640); _skyline(rnd, im, 1240, 1, prim, sec, 0.6); _streams(rnd, im, sec, 25)
    elif e == "Cyber Jungle Network":
        _vines(rnd, im, prim, sec); _network(rnd, im, 40, sec, 180, 90); _particles(rnd, im, 140, [prim, acc])
    elif e == "Autonomous AI Capital City":
        _grid(im, 1040, sec, alpha=80); _skyline(rnd, im, 1100, 3, prim, sec, 1.1); _particles(rnd, im, 60, [prim])
    elif e == "Dark Matter Trading Core":
        _particles(rnd, im, 300, [prim, sec, acc]); _vortex(rnd, im, prim, sec, W // 2 + rnd.randint(-150, 150), 640)
    elif e == "Virtual Reality Economic Grid":
        _grid(im, 680, prim, ceiling=True); _cubes(rnd, im, prim, sec, 10)
    else:  # Interplanetary Finance Center
        _stars(rnd, im, 350, acc); _planet(rnd, im, 220, 320, 150, prim, sec)
        _planet(rnd, im, 900, 560, 70, sec, prim, ring=False); _skyline(rnd, im, 1260, 2, prim, sec, 0.7)
    # readability: darken the content zone, vignette, scanlines
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    for y in range(H):
        a = 30 + 70 * math.sin(math.pi * y / H)
        ds.line([(0, y), (W, y)], fill=(0, 0, 0, int(a)))
    im.alpha_composite(sh)
    sc = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dsc = ImageDraw.Draw(sc)
    for y in range(0, H, 4):
        dsc.line([(0, y), (W, y)], fill=(0, 0, 0, 26))
    im.alpha_composite(sc)
    return im


def _hud(t, im):
    prim, sec = PALETTES[t["pal"]][:2]
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    c = _rgba(prim, 200)
    if t["hud"] == "brackets":
        for (x, y, sx, sy) in ((16, 16, 1, 1), (W - 16, 16, -1, 1), (16, H - 16, 1, -1), (W - 16, H - 16, -1, -1)):
            d.line([(x, y), (x + 70 * sx, y)], fill=c, width=4)
            d.line([(x, y), (x, y + 70 * sy)], fill=c, width=4)
    elif t["hud"] == "hex":
        for (cx, cy) in ((40, 40), (W - 40, 40), (40, H - 40), (W - 40, H - 40)):
            d.regular_polygon((cx, cy, 22), 6, outline=c, width=3)
    elif t["hud"] == "rails":
        d.line([(12, 80), (12, H - 80)], fill=_rgba(prim, 120), width=3)
        d.line([(W - 12, 80), (W - 12, H - 80)], fill=_rgba(sec, 120), width=3)
        for y in range(120, H - 120, 90):
            d.line([(12, y), (30, y)], fill=c, width=3)
            d.line([(W - 30, y), (W - 12, y)], fill=c, width=3)
    else:
        for x in range(30, W - 20, 30):
            d.line([(x, 10), (x, 18 if x % 150 else 28)], fill=_rgba(prim, 150), width=2)
            d.line([(x, H - 18 if x % 150 else H - 28), (x, H - 10)], fill=_rgba(sec, 150), width=2)
    _glow(im, lay, 6)


def _logo(im, x, y, max_h):
    """the official logo exactly as the file is: proportional downscale only (golden logo rule)"""
    lg = Image.open(LOGO).convert("RGBA")
    if lg.height > max_h:
        s = max_h / lg.height
        lg = lg.resize((max(1, round(lg.width * s)), max_h), Image.LANCZOS)
    im.alpha_composite(lg, (int(x), int(y)))
    return lg.size


def _divider(t, im, y):
    prim, sec = PALETTES[t["pal"]][:2]
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for x in range(M, W - M):
        tt = (x - M) / (W - 2 * M)
        a = int(255 * math.sin(math.pi * tt))
        d.line([(x, y), (x, y + 4)], fill=_mix(sec, prim, tt) + (a,))
    for k in range(5):
        x = W - M - k * 26
        d.rectangle([x - 12, y + 14, x, y + 18], fill=_rgba(prim, 200 - k * 35))
    _glow(im, lay, 10, 2)


def _glass(im, box, radius=28, tint=(255, 255, 255), alpha=26, border=(255, 255, 255)):
    x0, y0, x1, y1 = [int(v) for v in box]
    region = im.crop((x0, y0, x1, y1)).filter(ImageFilter.GaussianBlur(18))
    mask = Image.new("L", region.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, x1 - x0 - 1, y1 - y0 - 1], radius, fill=255)
    im.paste(region, (x0, y0), mask)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle(box, radius, fill=_rgba(tint, alpha), outline=_rgba(border, 90), width=2)
    d.line([(x0 + radius, y0 + 1), (x1 - radius, y0 + 1)], fill=(255, 255, 255, 120), width=2)
    im.alpha_composite(lay)


def _shadow(im, xr, y, s, f, fill, center=False):
    """text with a soft dark shadow so it stays readable over the scene"""
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    (ctext if center else rtext)(ImageDraw.Draw(lay), xr, y + 3, s, f, (0, 0, 0, 255))
    lay = lay.filter(ImageFilter.GaussianBlur(6))
    im.alpha_composite(lay)
    im.alpha_composite(lay)
    (ctext if center else rtext)(ImageDraw.Draw(im), xr, y, s, f, fill)


def _glow_text(im, xr, y, s, f, col, center=False):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    (ctext if center else rtext)(d, xr, y, s, f, _rgba(col, 255))
    g = lay.filter(ImageFilter.GaussianBlur(16))
    im.alpha_composite(g)
    im.alpha_composite(g)
    top = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    (ctext if center else rtext)(ImageDraw.Draw(top), xr, y, s, f, (255, 255, 255, 255))
    im.alpha_composite(top)


# =========================================================== 3. market data (Binance)
COINS = [("BTC", "بیت‌کوین"), ("ETH", "اتریوم"), ("BNB", "بی‌ان‌بی"), ("SOL", "سولانا"), ("XRP", "ریپل")]
BINANCE = ["https://data-api.binance.vision", "https://api.binance.com", "https://api1.binance.com"]


def market(at=None):
    """live (or as of `at`, a UTC datetime) prices from Binance: {'rows': [...], 'series': [...], 'at': dt, 'src': ...}"""
    import requests
    end = int((at or datetime.now(timezone.utc)).timestamp() * 1000)
    rows, series = [], []
    for sym, fa in COINS:
        kl = None
        for base in BINANCE:
            try:
                r = requests.get(base + "/api/v3/klines", timeout=10,
                                 params={"symbol": sym + "USDT", "interval": "1h", "limit": 49, "endTime": end})
                if r.ok and isinstance(r.json(), list) and len(r.json()) > 25:
                    kl = r.json()
                    break
            except Exception:
                continue
        if not kl:
            continue
        closes = [float(k[4]) for k in kl]
        rows.append({"sym": sym, "fa": fa, "price": closes[-1], "chg": (closes[-1] / closes[-25] - 1) * 100})
        if sym == "BTC":
            series = [(float(k[1]), float(k[2]), float(k[3]), float(k[4])) for k in kl[-48:]]
    if len(rows) >= 3 and series:
        return {"rows": rows, "series": series, "at": at or datetime.now(timezone.utc), "src": "binance"}
    try:                                   # fallback: the dashboard file the site workflow writes from Binance
        m = json.load(open(os.path.join(ROOT, "data", "market.json")))
        by = {c["coin"]: c for c in m.get("coins", [])}
        rows = [{"sym": s, "fa": fa, "price": by[s]["price"], "chg": by[s].get("chg24") or 0} for s, fa in COINS if s in by]
        sp = (by.get("BTC") or {}).get("spark") or []
        series = [(a, max(a, b), min(a, b), b) for a, b in zip(sp, sp[1:])]
        return {"rows": rows, "series": series, "at": datetime.fromisoformat(m["updated_at"].replace("Z", "+00:00")),
                "src": "binance-cache"}
    except Exception:
        return {"rows": [], "series": [], "at": at or datetime.now(timezone.utc), "src": None}


def _price(p):
    return fa_num(p, 2 if p < 10 else 0)


def _triangle(d, x, y, up, col):
    if up:
        d.polygon([(x, y + 16), (x + 18, y + 16), (x + 9, y)], fill=col)
    else:
        d.polygon([(x, y), (x + 18, y), (x + 9, y + 16)], fill=col)


def _dashboard(t, im, box, mk):
    """3D-tilted data panel: BTC 48h chart (left) + market rows (right)"""
    prim, sec, acc = PALETTES[t["pal"]][:3]
    x0, y0, x1, y1 = box
    pw, ph = x1 - x0, y1 - y0
    pan = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    d = ImageDraw.Draw(pan)
    d.rounded_rectangle([0, 0, pw - 1, ph - 1], 22, fill=(6, 10, 20, 205), outline=_rgba(prim, 200), width=3)
    for gx in range(0, pw, 40):
        d.line([(gx, 0), (gx, ph)], fill=_rgba(prim, 18))
    for gy in range(0, ph, 40):
        d.line([(0, gy), (pw, gy)], fill=_rgba(prim, 18))
    green, red = (40, 255, 150), (255, 70, 90)
    # chart
    cx0, cy0, cx1, cy1 = 24, 62, int(pw * 0.50), ph - 30
    f = font(24)
    ltext(d, 24, 18, "بیت‌کوین · ۴۸ ساعت", f, acc + (255,))
    s = mk.get("series") or []
    if len(s) > 5:
        lo, hi = min(c[2] for c in s), max(c[1] for c in s)
        Y = lambda v: cy1 - (v - lo) / ((hi - lo) or 1) * (cy1 - cy0)
        step = (cx1 - cx0) / len(s)
        if t["chart"] == "candles":
            for i, (o, h_, l_, c) in enumerate(s):
                x = cx0 + i * step + step / 2
                col = green if c >= o else red
                d.line([(x, Y(h_)), (x, Y(l_))], fill=col + (255,), width=1)
                d.rectangle([x - step * 0.32, min(Y(o), Y(c)), x + step * 0.32, max(Y(o), Y(c)) + 1], fill=col + (255,))
        elif t["chart"] == "bars":
            for i, (o, h_, l_, c) in enumerate(s):
                x = cx0 + i * step
                d.rectangle([x + 1, Y(c), x + step - 2, cy1], fill=_rgba(_mix(sec, prim, i / len(s)), 200))
        else:
            pts = [(cx0 + i * step + step / 2, Y(c[3])) for i, c in enumerate(s)]
            if t["chart"] == "area":
                d.polygon(pts + [(pts[-1][0], cy1), (pts[0][0], cy1)], fill=_rgba(prim, 60))
            d.line(pts, fill=_rgba(prim, 255), width=4, joint="curve")
            d.ellipse([pts[-1][0] - 7, pts[-1][1] - 7, pts[-1][0] + 7, pts[-1][1] + 7], fill=_rgba(acc, 255))
        fs = font(20)
        d.text((cx1 - d.textlength(fa_num(hi), font=fs), cy0 - 26), fa_num(hi), font=fs, fill=(200, 210, 230, 220))
        d.text((cx1 - d.textlength(fa_num(lo), font=fs), cy1 + 2), fa_num(lo), font=fs, fill=(200, 210, 230, 220))
    # rows
    rx1, rx0 = pw - 24, int(pw * 0.54)
    rows = mk.get("rows") or []
    fh, fp = font(24), font(24)
    ry = 22
    rtext(d, rx1, ry - 4, "بازار لحظه‌ای", font(26), acc + (255,))
    ry += 44
    rh = (ph - ry - 16) / max(1, min(5, len(rows)))
    for r in rows[:5]:
        up = r["chg"] >= 0
        col = green if up else red
        rtext(d, rx1, ry, r["fa"], fh, (235, 240, 250, 255))
        ptxt = _price(r["price"]) + " $"
        d.text((rx0, ry), ptxt, font=fp, fill=(255, 255, 255, 255))
        ctxt = fa_num(abs(r["chg"]), 2) + "٪"
        cw = d.textlength(ctxt, font=font(22))
        xm = rx0 + (rx1 - rx0) * 0.52
        _triangle(d, xm - 26, ry + 8, up, col + (255,))
        d.text((xm, ry + 4), ctxt, font=font(22), fill=col + (255,))
        ry += rh
    # 3D tilt: perspective (top edge narrower), then a reflection glow
    k = t["tilt"]
    sk = pan.transform((pw, ph), Image.Transform.PERSPECTIVE,
                       _persp([(0, 0), (pw, 0), (pw, ph), (0, ph)],
                              [(pw * k, 0), (pw * (1 - k), 0), (pw, ph), (0, ph)]), Image.BICUBIC)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle([x0 + 20, y1 - 10, x1 - 20, y1 + 18], 12, fill=_rgba(prim, 150))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(24)))
    im.alpha_composite(sk, (x0, y0))


def _persp(dst, src):
    """coefficients for Image.transform PERSPECTIVE (maps output → input)"""
    A, B = [], []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    n = 8
    M_ = [row[:] + [b] for row, b in zip(A, B)]
    for i in range(n):                                     # gaussian elimination
        p = max(range(i, n), key=lambda r: abs(M_[r][i]))
        M_[i], M_[p] = M_[p], M_[i]
        for r in range(n):
            if r != i:
                fct = M_[r][i] / M_[i][i]
                M_[r] = [a - fct * b for a, b in zip(M_[r], M_[i])]
    return [M_[i][n] / M_[i][i] for i in range(n)]


# =========================================================== 4. content → layout
NUM = re.compile(r"([0-9۰-۹][0-9۰-۹٬,٫.]*)\s*(تریلیون|میلیارد|میلیون|هزار)?\s*(دلار|درصد|٪|بیت‌کوین|اتر|نهاد|سهم|روز|ساعت)?")
SCALE = {"تریلیون": 1e12, "میلیارد": 1e9, "میلیون": 1e6, "هزار": 1e3}


def _num_value(s):
    t = s.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٫", "0123456789.")).replace("٬", "").replace(",", "")
    try:
        return float(t)
    except ValueError:
        return 0.0


def hero_stat(candidates):
    """[(text, context)] → (number phrase, context line) with the biggest money amount, or None"""
    best = None
    for text, ctx in candidates:
        for m in NUM.finditer(clean(text)):
            unit = m.group(3)
            if unit in ("روز", "ساعت", "نهاد", "سهم") or not (m.group(2) or unit):
                continue
            v = _num_value(m.group(1)) * SCALE.get(m.group(2) or "", 1) * (1 if unit in ("دلار", None) else 1e-3)
            phrase = " ".join(x for x in m.groups() if x).replace(",", "٬").translate(FA_DIGITS)
            if best is None or v > best[0]:
                best = (v, phrase, ctx)
    return (best[1], best[2]) if best else None


def parse_dossier(post):
    """«پروندهٔ کوین کورد» post → content dict"""
    lines = [x.strip() for x in post.split("\n")]
    title = clean(lines[1] if len(lines) > 1 else lines[0])
    sec, cur = {}, None
    for ln in lines[2:]:
        if not ln or ln.startswith("━") or ln.startswith("#"):
            continue
        h = clean(ln)
        if re.search(r"<b>[^<]+</b>\s*$", ln) and len(h) < 40 and not ln.lstrip().startswith("•"):
            cur = h
            sec[cur] = []
        elif cur:
            sec[cur].append(ln)
    get = lambda key: next((v for k, v in sec.items() if key in k), [])
    nums = get("عدد")
    hero_c = []
    for ln in nums:
        bolds = re.findall(r"<b>([^<]+)</b>", ln)
        hero_c += [(b, clean(ln)) for b in bolds] or [(ln, clean(ln))]
    sides = get("دو روی")
    return {
        "badge": "پروندهٔ ویژه",
        "title": title,
        "quick": clean(" ".join(get("ثانیه"))),
        "hero": hero_stat(hero_c) or hero_stat([(title, title)]),
        "card_head": "عددهایی که باید بدانی",
        "card": [clean(x) for x in nums][:3],
        "term": [clean(x) for x in sides][:2]
                + [clean(x) for x in get("کیف پول")][:1],
    }


HEADS = ("زمینه", "تمرکز", "پیامدها", "نتیجه‌گیری", "نتیجه گیری")


def parse_summary(text):
    """house-prompt summary (عنوان / زمینه / تمرکز / پیامدها / نتیجه‌گیری) → content dict"""
    raw = [x.strip() for x in text.split("\n") if x.strip() and not x.strip().startswith("#")]
    title = clean(raw[0]) if raw else ""
    sec, cur = {}, None
    for x in raw[1:]:
        c = clean(x)
        if c in HEADS or (len(c) < 14 and any(c.startswith(h) for h in HEADS)):
            cur = c.replace("نتیجه گیری", "نتیجه‌گیری")
            sec[cur] = []
        elif cur:
            sec[cur].append(c)
    allb = [(x, x) for v in sec.values() for x in v]
    return {
        "badge": "خلاصهٔ خبر",
        "title": title,
        "quick": " ".join(sec.get("زمینه", [])[:1]),
        "hero": hero_stat(allb) or hero_stat([(title, title)]),
        "card_head": "تمرکز",
        "card": sec.get("تمرکز", [])[:3],
        "term": sec.get("پیامدها", [])[:2] + sec.get("نتیجه‌گیری", [])[:1],
        "sections": [(k, v) for k, v in sec.items() if v],
    }


def _check_content(c):
    """the mandatory proof-read: every Persian string is cleaned and verified before anything is drawn"""
    out = dict(c)
    for k in ("badge", "title", "quick", "card_head"):
        out[k] = safe(c.get(k) or "")
    out["card"] = [safe(x) for x in c.get("card") or [] if clean(x)]
    out["term"] = [safe(x) for x in c.get("term") or [] if clean(x)]
    if c.get("hero"):
        out["hero"] = (safe(c["hero"][0]), safe(c["hero"][1]))
    out["sections"] = [(safe(h), [safe(p) for p in ps if clean(p)]) for h, ps in c.get("sections") or []]
    if not out["title"]:
        raise TextError("تیتر خالی است")
    return out


def _header(t, im, c, sub=""):
    prim, sec, acc = PALETTES[t["pal"]][:3]
    d = ImageDraw.Draw(im)
    lw, lh = _logo(im, M - 6, 34, 150)
    fb = font(30)
    bw = textw(fb, c["badge"]) + 48
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle([W - M - bw, 52, W - M, 106], 27, fill=_rgba(prim, 235))
    _glow(im, lay, 12)
    rtext(d, W - M - 24, 59, c["badge"], fb, (8, 8, 16, 255))
    rtext(d, W - M, 128, sub or jalali(datetime.now(timezone.utc)), font(26), _rgba(acc, 220))
    return 34 + lh


def render(content, theme=None, hist=None, mk=None, kind="dossier"):
    """content dict (parse_dossier / parse_summary) → JPEG bytes (1080×1350). Raises TextError on bad Persian."""
    if mode() is None:
        raise TextError("Persian shaping unavailable — image not made")
    c = _check_content(content)
    t = theme or pick_theme(hist)
    prim, sec, acc = PALETTES[t["pal"]][:3]
    im = background(t)
    _hud(t, im)
    d = ImageDraw.Draw(im)
    mk = mk if mk is not None else market()
    when = mk.get("at") or datetime.now(timezone.utc)
    _header(t, im, c, jalali(when))
    # headline
    ft, sz, tl = fit(c["title"], (58, 52, 46, 42), W - 2 * M, 3)
    y = 204
    for i, ln in enumerate(tl):
        _glow_text(im, W - M, y, ln, ft, prim) if i == 0 else _shadow(im, W - M, y, ln, ft, (255, 255, 255, 255))
        y += int(sz * 1.36)
    y += 8
    _divider(t, im, y)
    y += 34
    # hero statistic
    hero = c.get("hero")
    if not hero and mk.get("rows"):
        b = mk["rows"][0]
        hero = (_price(b["price"]) + " دلار", "قیمت " + b["fa"] + " در بایننس")
    if hero:
        fh, hs, hl = fit(hero[0], (100, 88, 76, 66), W - 2 * M, 1)
        _glow_text(im, W / 2, y, hl[0], fh, prim, center=True)
        y += int(hs * 1.32)
        fq, qs, ql = fit(hero[1], (27, 24), W - 2 * M - 40, 2)
        for ln in ql:
            _shadow(im, W / 2, y, ln, fq, _rgba(acc, 240), center=True)
            y += int(qs * 1.45)
        y += 14
    # 3D dashboard
    dash_h = 226
    _dashboard(t, im, (M - 10, y, W - M + 10, y + dash_h), mk)
    y += dash_h + 26
    # glassmorphism analysis card + AI terminal: whole sentences only, planned to fit the space left
    foot_top = H - 112
    avail = foot_top - 18 - y
    hero_src = (hero or ("", ""))[1]
    bullets = [b_ for b_ in c["card"] if b_ != hero_src] or c["card"]
    plan = _plan(bullets, c["term"], avail)
    if plan:
        (fc, lhc, card_ls, card_h), (ftm, lht, term_ls, term_h) = plan
        if card_ls:
            _glass(im, (M - 10, y, W - M + 10, y + card_h), tint=_mix(prim, (255, 255, 255), 0.5), alpha=22, border=prim)
            d = ImageDraw.Draw(im)
            rtext(d, W - M - 18, y + 14, c["card_head"], font(29), _rgba(prim, 255))
            yy = y + 58
            for ls in card_ls:
                d.rectangle([W - M - 30, yy + lhc // 2 - 6, W - M - 20, yy + lhc // 2 + 4], fill=_rgba(sec, 255))
                for ln in ls:
                    rtext(d, W - M - 44, yy, ln, fc, (240, 244, 252, 255))
                    yy += lhc
                yy += 6
            y += card_h + 14
        if term_ls:
            tb = (M - 10, y, W - M + 10, y + term_h)
            lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            dl = ImageDraw.Draw(lay)
            dl.rounded_rectangle(tb, 16, fill=(2, 6, 10, 225), outline=_rgba(sec, 200), width=2)
            dl.rounded_rectangle((tb[0], tb[1], tb[2], tb[1] + 36), 16, fill=_rgba(sec, 60))
            for k, col in enumerate(((255, 90, 90), (255, 200, 60), (60, 220, 120))):
                dl.ellipse([tb[0] + 18 + k * 24, tb[1] + 11, tb[0] + 32 + k * 24, tb[1] + 25], fill=col + (255,))
            _glow(im, lay, 8)
            d = ImageDraw.Draw(im)
            rtext(d, W - M - 12, y + 3, "ترمینال تحلیل هوش مصنوعی", font(22), (230, 240, 255, 255))
            yy = y + 46
            for ls in term_ls:
                d.polygon([(W - M - 12, yy + 8), (W - M - 12, yy + 24), (W - M - 24, yy + 16)], fill=_rgba(sec, 255))
                for ln in ls:
                    rtext(d, W - M - 34, yy, ln, ftm, _rgba(_mix(acc, sec, 0.35), 255))
                    yy += lht
            d.rectangle([M + 10, y + term_h - 30, M + 24, y + term_h - 10], fill=_rgba(sec, 255))   # cursor
    _footer(t, im)
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=93, optimize=True, subsampling=0)
    return buf.getvalue()


def _plan(bullets, term, avail):
    """pick fonts and how many whole bullets / terminal lines fit in `avail` px (card first, then terminal)"""
    best = None
    for (cs, clh), (ts, tlh) in (((27, 39), (24, 32)), ((25, 36), (22, 30)), ((23, 33), (21, 28))):
        fc, ft_ = font(cs), font(ts)
        cw = [wrap(b, fc, W - 2 * M - 70) for b in bullets]
        tw = [wrap(x, ft_, W - 2 * M - 90) for x in term]
        for n in range(len(cw), -1, -1):
            card_h = (58 + sum(len(x) for x in cw[:n]) * clh + 6 * n + 10) if n else 0
            for k in range(len(tw), -1, -1):
                term_h = (46 + sum(len(x) for x in tw[:k]) * tlh + 14) if k else 0
                need = card_h + (14 if n and k else 0) + term_h
                if need <= avail and (n or k):
                    score = (min(n, 2) + min(k, 2), n + k, cs)
                    if best is None or score > best[0]:
                        best = (score, (fc, clh, cw[:n], card_h), (ft_, tlh, tw[:k], term_h))
                    break
    return best[1:] if best else None


def _footer(t, im):
    prim, sec, acc = PALETTES[t["pal"]][:3]
    y = H - 112
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(lay)
    dl.rectangle([0, y, W, H], fill=(3, 5, 10, 215))
    for x in range(W):
        dl.point((x, y), fill=_mix(prim, sec, x / W) + (255,))
        dl.point((x, y + 1), fill=_mix(prim, sec, x / W) + (255,))
    im.alpha_composite(lay)
    _glow_text(im, W - M, y + 30, CHANNEL, font(40), prim)
    ltext(ImageDraw.Draw(im), M, y + 38, SLOGAN, font(32), _rgba(acc, 240))


# =========================================================== 5. video slides (same theme for a whole reel)
def slide(theme, content, heading, paras, idx, total):
    """one reel slide in the same visual identity: header, section heading, glass card with the text, footer"""
    c = _check_content(content)
    heading = safe(heading)
    paras = [safe(p) for p in paras if clean(p)]
    t = theme
    prim, sec, acc = PALETTES[t["pal"]][:3]
    im = background(t)
    _hud(t, im)
    _header(t, im, c, f"{str(idx).translate(FA_DIGITS)} از {str(total).translate(FA_DIGITS)}")
    d = ImageDraw.Draw(im)
    d.rectangle([M, 196, M + (W - 2 * M) * idx / total, 202], fill=_rgba(prim, 255))
    y = 240
    ft, sz, tl = fit(c["title"], (44, 40), W - 2 * M, 2)
    for ln in tl:
        rtext(d, W - M, y, ln, ft, (255, 255, 255, 255))
        y += int(sz * 1.4)
    y += 10
    _divider(t, im, y)
    y += 50
    _glow_text(im, W - M, y, heading, font(64), prim)
    y += 110
    f = font(40)
    plan = [wrap(p, f, W - 2 * M - 80) for p in paras]
    need = 34 + sum(len(ls) * 60 + 18 for ls in plan) + 16
    box_bottom = min(H - 150, y + max(need, 200))
    _glass(im, (M - 10, y, W - M + 10, box_bottom), tint=_mix(prim, (255, 255, 255), 0.5), alpha=22, border=prim)
    d = ImageDraw.Draw(im)
    yy = y + 34
    for ls in plan:
        if yy + len(ls) * 60 > box_bottom - 10:          # whole paragraphs only
            break
        d.rectangle([W - M - 32, yy + 22, W - M - 20, yy + 34], fill=_rgba(sec, 255))
        for ln in ls:
            rtext(d, W - M - 48, yy, ln, f, (244, 247, 252, 255))
            yy += 60
        yy += 18
    _footer(t, im)
    return im.convert("RGB")


if __name__ == "__main__":       # python scripts/infocard.py out_dir  → renders samples of the latest dossiers
    import sys
    logging.basicConfig(level=logging.INFO)
    if sys.argv[1:2] == ["--check"]:          # CI guard: shaping engine present and correct
        m = mode()
        probe = "پروندهٔ ویژه؛ بیت‌کوین ۸۰٬۵۶۹ دلار"
        pr = verify(clean(probe)) if m else ["no shaper"]
        print("Persian shaping:", m, "OK" if not pr else pr)
        sys.exit(0 if m and not pr else 1)
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    print("shaping mode:", mode())
    items = json.load(open(os.path.join(ROOT, "data", "deep.json")))["items"]
    hist = {}
    for it in items[:int(sys.argv[2]) if len(sys.argv) > 2 else 3]:
        th = pick_theme(hist, seed=int(hashlib.md5(it["id"].encode()).hexdigest(), 16) % (1 << 30))
        data = render(parse_dossier(it["fa"]), th, mk=market(datetime.fromisoformat(it["at"])))
        p = os.path.join(out, f"{it['id']}.jpg")
        open(p, "wb").write(data)
        print(p, th["env"], th["pal"], th["chart"], len(data))
