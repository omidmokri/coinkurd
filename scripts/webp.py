#!/usr/bin/env python3
"""Makes the WebP copies the site serves.

Nothing is deleted: every original stays where it is, so an old browser that cannot read WebP
still gets its JPEG or PNG. The site asks for the WebP only when the browser says it can decode it.

Three sets:
  data/deepimg/*.jpg   -> name.webp (full size) and name-540.webp (half width, for phones)
  assets/ic3d/*.png    -> name.webp (the category icons)
  assets/coin-*.png    -> name.webp at 512 px (the textures of the 3D coin)

Run from the repository root:  python3 -I scripts/webp.py
It only rebuilds a file whose source is newer, so it is cheap to run on every build.
"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def fresh(src, dst):
    return os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)


def save(im, dst, **kw):
    tmp = dst + ".tmp"
    im.save(tmp, "WEBP", method=6, **kw)
    os.replace(tmp, dst)
    return os.path.getsize(dst)


def main():
    os.chdir(ROOT)
    made = skipped = 0
    before = after = 0

    # ---- the analysis pictures: the heaviest thing the site serves
    for f in sorted(glob.glob("data/deepimg/*.jpg")):
        base = f[:-4]
        full, half = base + ".webp", base + "-540.webp"
        if fresh(f, full) and fresh(f, half):
            skipped += 1
            continue
        im = Image.open(f).convert("RGB")
        before += os.path.getsize(f)
        after += save(im, full, quality=78)
        after += save(im.resize((im.width // 2, im.height // 2), Image.LANCZOS), half, quality=78)
        made += 1

    # ---- the category icons: small, with transparency
    for f in sorted(glob.glob("assets/ic3d/*.png")):
        dst = f[:-4] + ".webp"
        if fresh(f, dst):
            skipped += 1
            continue
        before += os.path.getsize(f)
        after += save(Image.open(f).convert("RGBA"), dst, quality=85)
        made += 1

    # ---- the coin's textures: a 512 px texture is as much as a coin this size can show
    for f in sorted(glob.glob("assets/coin-*.png")):
        dst = f[:-4] + ".webp"
        if fresh(f, dst):
            skipped += 1
            continue
        im = Image.open(f)
        im = im.convert("RGBA") if im.mode in ("RGBA", "P") else im.convert("RGB")
        before += os.path.getsize(f)
        # a bump map carries no colour, so it takes a lower quality without showing it
        q = 80 if "bump" in f else 88
        after += save(im.resize((512, 512), Image.LANCZOS), dst, quality=q)
        made += 1

    if before:
        print(f"webp: {made} sources converted, {skipped} already current · "
              f"{before/1024/1024:.1f} MB -> {after/1024/1024:.1f} MB "
              f"({100 - 100*after/before:.0f}% smaller)")
    else:
        print(f"webp: nothing to do, {skipped} files already current")
    return 0


if __name__ == "__main__":
    sys.exit(main())
