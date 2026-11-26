#!/usr/bin/env python3
"""App and web icons: the entekhab name alone, on an empty (transparent) background.

Owner 2026-11-26: "فقط اسم انتخاب ساده و بدون بکگراند همه جا".
Source: assets/logo-hero.webp (transparent). Writes the PWA icons, the Android
launcher/splash images and the Windows logo/ico, and makes the Android adaptive
icon background transparent.
"""
import os, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)

src = Image.open(P("assets", "logo-hero.webp")).convert("RGBA")
src = src.crop(src.getbbox())


def logo(w, h, frac):
    """The logo fitted into frac of a w*h transparent canvas, centred."""
    box_w, box_h = w * frac, h * frac
    s = min(box_w / src.width, box_h / src.height)
    im = src.resize((max(1, round(src.width * s)), max(1, round(src.height * s))), Image.LANCZOS)
    c = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    c.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2))
    return c


def save(path, w, h, frac):
    logo(w, h, frac).save(P(*path), optimize=True)
    print("wrote", "/".join(path), w, h)


save(("assets", "icon-192.png"), 192, 192, .9)
save(("assets", "icon-512.png"), 512, 512, .9)
save(("assets", "icon-maskable-512.png"), 512, 512, .62)
save(("assets", "apple-touch-icon.png"), 180, 180, .86)

for name, legacy, fg in (("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216),
                         ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)):
    save(("android", f"res.mipmap-{name}.ic_launcher.png"), legacy, legacy, .92)
    save(("android", f"res.mipmap-{name}.ic_launcher_fg.png"), fg, fg, .6)
save(("android", "res.drawable-xxhdpi.splash_logo.png"), 480, 350, .96)

cx = P("android", "res.values.colors.xml")
t = open(cx, encoding="utf-8").read()
t2 = re.sub(r'(<color name="icon_bg">)#[0-9A-Fa-f]+(</color>)', r"\g<1>#00000000\g<2>", t)
open(cx, "w", encoding="utf-8").write(t2)
print("icon_bg ->", "#00000000" if t2 != t else "unchanged")

save(("windows", "logo.png"), 256, 256, .94)
big = logo(256, 256, .92)
big.save(P("windows", "app.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("wrote windows/app.ico")
