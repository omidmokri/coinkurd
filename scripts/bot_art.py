"""
Brand art for the Kurd Kurdistan Bot, drawn at runtime from the site logo (assets/logo-hero.webp):
  banner  1600×800  — dark-premium background, faint blockchain network, Kurdistan sun (21 rays) behind
                      the Entekhab logo, title + tagline + handle. Sent with the welcome message.
  avatar   640×640  — the same composition without text (for BotFather /setuserpic).
Palette (design doc §2.1): #0B0F19 / #0F172A background, gold #D4AF37, cyan #06B6D4, white, #CBD5E1.
Drawing it here (instead of committing images) keeps the art in one script that anyone can tweak.
"""
import io
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "assets", "logo-hero.webp")
FONT = os.path.join(ROOT, "assets", "fonts", "Vazirmatn-Bold.ttf")
BG1, BG2 = (11, 15, 25), (15, 23, 42)
GOLD, CYAN, WHITE, GREY = (212, 175, 55), (6, 182, 212), (255, 255, 255), (203, 213, 225)
_cache = {}


def _rtl(text):
    """shape Persian/Sorani text with the shared, self-tested engine (scripts/infocard.py)"""
    try:
        import infocard as IC
        return IC.shape(text)
    except Exception:
        return text


def _compose(w, h, logo_h, lines, sun_r, logo_cy, seed=7):
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    rnd = random.Random(seed)
    im = Image.new("RGB", (w, h), BG1)
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(BG1[i] * (1 - t) + BG2[i] * t) for i in range(3)))
    im = im.convert("RGBA")
    # blockchain network
    net = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dn = ImageDraw.Draw(net)
    pts = [(rnd.randint(0, w), rnd.randint(0, h)) for _ in range(max(20, w * h // 28000))]
    for i, a in enumerate(pts):
        for b in pts[i + 1:]:
            dist = math.dist(a, b)
            if dist < 230:
                dn.line([a, b], fill=CYAN + (int(55 * (1 - dist / 230)),), width=1)
    for p in pts:
        dn.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=CYAN + (110,))
        dn.rectangle([p[0] - 9, p[1] - 9, p[0] + 9, p[1] + 9], outline=CYAN + (35,))
    im = Image.alpha_composite(im, net)
    # rising chart along the bottom
    ch = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dc = ImageDraw.Draw(ch)
    y, cpts = h * 0.97, []
    for x in range(0, w + 40, 40):
        y -= rnd.uniform(-10, 14) * 0.6
        cpts.append((x, max(80, y)))
    dc.line(cpts, fill=GOLD + (70,), width=3)
    dc.polygon(cpts + [(w, h), (0, h)], fill=GOLD + (8,))
    im = Image.alpha_composite(im, ch)
    # glow + Kurdistan sun (21 rays)
    cx, cy = w // 2, logo_cy
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([cx - sun_r * 2, cy - sun_r * 2, cx + sun_r * 2, cy + sun_r * 2], fill=GOLD + (40,))
    im = Image.alpha_composite(im, glow.filter(ImageFilter.GaussianBlur(80)))
    sun = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sun)
    for i in range(21):
        ang = 2 * math.pi * i / 21 - math.pi / 2
        ds.polygon([(cx + math.cos(ang) * sun_r * 1.95, cy + math.sin(ang) * sun_r * 1.95),
                    (cx + math.cos(ang + 0.075) * sun_r * 1.08, cy + math.sin(ang + 0.075) * sun_r * 1.08),
                    (cx + math.cos(ang - 0.075) * sun_r * 1.08, cy + math.sin(ang - 0.075) * sun_r * 1.08)], fill=GOLD + (60,))
    ds.ellipse([cx - sun_r, cy - sun_r, cx + sun_r, cy + sun_r], outline=GOLD + (100,), width=3)
    im = Image.alpha_composite(im, sun.filter(ImageFilter.GaussianBlur(1)))
    # logo
    lg = Image.open(LOGO).convert("RGBA")
    s = logo_h / lg.height
    lg = lg.resize((int(lg.width * s), logo_h), Image.LANCZOS)
    im.alpha_composite(lg, (cx - lg.width // 2, cy - lg.height // 2))
    # text
    dt = ImageDraw.Draw(im)
    for text, size, col, ty in lines:
        font = ImageFont.truetype(FONT, size)
        text = _rtl(text)
        tw = dt.textlength(text, font=font)
        dt.text((cx - tw / 2, ty), text, font=font, fill=col)
    out = io.BytesIO()
    im.convert("RGB").save(out, "JPEG", quality=90, optimize=True)
    return out.getvalue()


def banner(handle="Kurd_kurdistan_bot"):
    """JPEG bytes, cached for the run; None if Pillow or the logo is missing"""
    if "banner" not in _cache:
        try:
            _cache["banner"] = _compose(1600, 800, 300, [
                ("Kurd Kurdistan Bot", 66, WHITE, 552),
                ("Smart Crypto Assistant for Kurdish Community", 30, GREY, 638),
                ("دستیار هوشمند کریپتو · یاریدەدەری زیرەکی کریپتۆ", 30, GOLD, 686),
                ("@" + handle, 28, CYAN, 738)], sun_r=150, logo_cy=310)
        except Exception:
            _cache["banner"] = None
    return _cache["banner"]


def avatar():
    if "avatar" not in _cache:
        try:
            _cache["avatar"] = _compose(640, 640, 270, [], sun_r=140, logo_cy=320)
        except Exception:
            _cache["avatar"] = None
    return _cache["avatar"]


if __name__ == "__main__":                                  # python scripts/bot_art.py  → writes the two images
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    for name, data in (("banner.jpg", banner()), ("avatar.jpg", avatar())):
        with open(os.path.join(out, name), "wb") as f:
            f.write(data)
        print("wrote", name, len(data))
